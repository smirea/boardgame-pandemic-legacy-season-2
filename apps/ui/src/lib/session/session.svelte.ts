import {
	createGameActor,
	gameIndexOf,
	parseRecord,
	parseSave,
	publicState,
	recordStep,
	reject,
	startRecord,
} from '@repo/game';
import type { Command, GameActor, GameRecord, PlayerId, PublicState, Save } from '@repo/game';
import { createHost, createMemoryTransport, createPeerId, createWebRtcTransport, joinHost, peerId } from '@repo/net';
import type { ConnectionStatus, PeerInfo, Session } from '@repo/net';
import { importTabletop, isTabletopSave } from '@repo/tts';
import { LS } from '../storage';
import { parseMsg, parsePresence } from './protocol';
import type { Msg, Presence } from './protocol';

export type Mode = 'solo' | 'host' | 'join';

function storedId() {
	const existing = LS.get('playerId');
	if (existing) return peerId(existing);
	const created = createPeerId();
	LS.set({ playerId: created });
	return created;
}

// A save from an older build is dropped for a new campaign: the game keeps no backwards compatibility.
function storedSave(): Save | null {
	const raw = LS.get('save');
	if (!raw) return null;
	try {
		return parseSave(raw);
	} catch (error) {
		console.warn('Starting a new campaign:', error);
		LS.delete('save');
		LS.delete('record');
		return null;
	}
}

/** The recording kept from an earlier page load, if it is of the game the save is in. */
function storedRecord(save: Save | null): GameRecord | null {
	const raw = LS.get('record');
	if (!raw || !save) return null;
	try {
		const record = parseRecord(raw);
		return gameIndexOf(record.initial) === save.world.campaign.results.length ? record : null;
	} catch {
		return null;
	}
}

type DebugApi = {
	getState: () => PublicState | null;
	saveState: () => void;
	loadState: (state?: unknown) => void;
	setState: (state: unknown) => void;
	/** Sends a command the way a click would. Returns why this client would refuse it, or null once it is sent. */
	send: (command: Command) => string | null;
	connection: () => {
		mode: Mode;
		status: ConnectionStatus;
		peers: number;
		notice: string | null;
		fatal: string | null;
	};
	getRecord: () => GameRecord | null;
	/** Renames this player at the table, as the lobby's name field does. */
	setName: (name: string) => void;
};

/** What the game screen needs from a session. A replay supplies the same shape with nothing behind it. */
export type SessionView = Pick<
	GameSession,
	| 'state'
	| 'player'
	| 'rename'
	| 'status'
	| 'peers'
	| 'cursors'
	| 'notice'
	| 'mode'
	| 'send'
	| 'pointer'
	| 'exportSave'
	| 'importSave'
	| 'newCampaign'
	| 'exportRecord'
>;

declare global {
	interface Window {
		DEBUG?: DebugApi;
	}
}

/**
 * One player's connection to the game. The host owns the XState actor and broadcasts a redacted
 * state after every transition. Peers hold the last state they were sent and forward commands.
 */
export class GameSession {
	state = $state.raw<PublicState | null>(null);
	status = $state<ConnectionStatus>('connecting');
	peers = $state.raw<PeerInfo[]>([]);
	cursors = $state.raw<Record<string, { x: number; z: number }>>({});
	notice = $state<{ text: string; at: number } | null>(null);
	fatal = $state<string | null>(null);

	readonly mode: Mode;
	readonly selfId;
	/** This browser's person at the table: the same id the connection introduces it by. */
	readonly player: PlayerId;
	readonly #net: Session<Msg, Presence>;
	readonly #actor: GameActor | null = null;
	/** The game in progress, recorded step by step. Only the host keeps one. */
	#record: GameRecord | null = null;
	#sender: { command: Command; by: string | null } | null = null;

	constructor(options: { mode: Mode; secret: string }) {
		this.mode = options.mode;
		this.selfId = storedId();
		this.player = this.selfId as string as PlayerId;
		const name = LS.get('name', '').trim() || 'Player';
		const transport =
			options.mode === 'solo'
				? createMemoryTransport()
				: createWebRtcTransport({ signalUrl: new URL(__SIGNAL_URL__, location.href).href, secret: options.secret });
		const config = { selfId: this.selfId, name, transport, parseMsg, parsePresence };
		this.#net = options.mode === 'join' ? joinHost<Msg, Presence>(config) : createHost<Msg, Presence>(config);

		this.#net.on('status', status => (this.status = status));
		this.#net.on('peers', peers => {
			this.peers = peers;
			const present = new Set(peers.filter(peer => peer.connected).map(peer => peer.id as string));
			this.cursors = Object.fromEntries(Object.entries(this.cursors).filter(([id]) => present.has(id)));
			if (this.#actor && this.state) this.#net.send({ t: 'state', state: this.state });
			this.#tidyLobby();
		});
		this.#net.on('presence', (presence, from) => {
			const { [from]: _gone, ...rest } = this.cursors;
			this.cursors = presence ? { ...rest, [from]: presence } : rest;
		});
		this.#net.on('error', error => {
			if (error.fatal) this.fatal = error.message;
			else console.warn(error.code, error.message);
		});
		this.#net.on('message', (msg, from) => {
			if (msg.t === 'state' && !this.#actor) {
				this.state = msg.state;
				this.#sitDown();
			}
			if (msg.t === 'rejected') this.#say(msg.reason);
			if (msg.t === 'command' && this.#actor) {
				const reason = this.#apply(msg.command, this.#nameOf(from));
				if (reason) this.#net.send({ t: 'rejected', reason }, from);
			}
		});
		this.status = this.#net.status;

		if (options.mode !== 'join') {
			const save = storedSave();
			this.#record = storedRecord(save);
			this.#actor = createGameActor({ seed: Math.floor(Math.random() * 2 ** 31), save });
			this.#actor.subscribe(snapshot => {
				const before = this.state;
				this.state = publicState(snapshot);
				if (before) this.#remember(before, this.state);
				// An imported campaign reaches its lobby with nobody seated, so the host sits down there as on arrival.
				if (before && before.phase !== 'lobby' && this.state.phase === 'lobby')
					queueMicrotask(() => {
						this.#tidyLobby();
						this.#sitDown();
					});
				LS.set({ save: this.#save() });
				if (this.#net.status !== 'closed') this.#net.send({ t: 'state', state: this.state });
			});
			this.#actor.start();
			this.#sitDown();
			this.#tidyLobby();
		}
	}

	#nameOf(player: string): string | null {
		return (
			this.state?.world.table.seats.find(entry => entry.player === player)?.name ??
			this.peers.find(peer => peer.id === player)?.name ??
			null
		);
	}

	/** A player in the lobby is seated as soon as they arrive. Playing on one screen, they hold two seats from the start. */
	#sitDown() {
		if (this.state?.phase !== 'lobby') return;
		const held = () => this.state!.world.table.seats.filter(entry => entry.player === this.player).length;
		const join: Command = { type: 'JOIN', player: this.player, name: LS.get('name', '').trim() || 'Player' };
		if (held() === 0 && !this.explain(join)) this.send(join);
		const another: Command = { type: 'ADD_SEAT', player: this.player };
		if (this.mode === 'solo' && held() === 1 && !this.explain(another)) this.send(another);
	}

	/** The host gets up for anyone who left the lobby, so the rest are not left waiting on them to ready. */
	#tidyLobby() {
		const state = this.state;
		if (!this.#actor || this.mode === 'solo' || state?.phase !== 'lobby') return;
		const here = new Set(this.peers.filter(peer => peer.connected).map(peer => peer.id as string));
		here.add(this.selfId);
		const gone = new Set(state.world.table.seats.map(entry => entry.player).filter(player => !here.has(player)));
		for (const player of gone) this.#apply({ type: 'LEAVE', player }, null);
	}

	/** Keeps the name for next time and renames this player wherever they sit. */
	rename(name: string) {
		LS.set({ name: name.trim() });
		const join: Command = { type: 'JOIN', player: this.player, name: name.trim() };
		if (name.trim() && !this.explain(join)) this.send(join);
	}

	get online() {
		return this.status === 'connected';
	}

	#say(text: string) {
		this.notice = { text, at: Date.now() };
	}

	/** Adds the change to the recording of the game it belongs to, starting a new recording when a new game begins. */
	#remember(before: PublicState, after: PublicState) {
		if (!this.#record || gameIndexOf(this.#record.initial) !== gameIndexOf(before))
			this.#record = startRecord(before, Date.now());
		const sender = this.#sender;
		this.#sender = null;
		const entry = { at: Date.now(), by: sender?.by ?? null, command: sender?.command ?? null };
		if (recordStep(this.#record, before, after, entry)) LS.set({ record: this.#record });
	}

	#apply(command: Command, by: string | null = this.mode === 'solo' ? null : this.#nameOf(this.selfId)): string | null {
		const snapshot = this.#actor!.getSnapshot();
		const current = publicState(snapshot);
		const reason =
			command.type === 'UNDO'
				? current.canUndo
					? null
					: 'Nothing to undo'
				: reject(snapshot.context.world, current.phase, command);
		if (!reason) {
			this.#sender = { command, by };
			this.#actor!.send(command);
			this.#sender = null;
		}
		return reason;
	}

	/** Why a command would be refused right now, checked against the state this client can see. */
	explain(command: Command): string | null {
		if (!this.state) return 'Not connected';
		return reject(this.state.world, this.state.phase, command);
	}

	send(command: Command) {
		if (this.#actor) {
			const reason = this.#apply(command);
			if (reason) this.#say(reason);
		} else if (this.online) {
			this.#net.send({ t: 'command', command });
		} else {
			this.#say('Reconnecting to the host');
		}
	}

	pointer(point: Presence) {
		if (this.status === 'connected') this.#net.sendPresence(point);
	}

	#save(): Save | null {
		return this.state ? { v: 1, phase: this.state.phase, world: this.state.world } : null;
	}

	/** Any player can export: everyone holds the whole state. */
	exportSave(): string {
		return JSON.stringify(this.#save());
	}

	/** The recording of the game in progress, or of the last one until the next begins. Only the host has it. */
	exportRecord(): string | null {
		return this.#record ? JSON.stringify(this.#record) : null;
	}

	/**
	 * Replaces the campaign with a save, the game's own or a Tabletop Simulator table, which is read and imported first.
	 * The page reloads so the actor restarts from it.
	 */
	importSave(raw: unknown) {
		if (!this.#actor) throw new Error('Only the host can load a campaign');
		const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
		let save = parsed;
		if (isTabletopSave(parsed)) {
			const imported = importTabletop(parsed);
			save = imported.save;
			LS.set({ tableImport: { name: imported.name, date: imported.date, at: Date.now(), rows: imported.rows } });
		}
		LS.delete('record');
		LS.set({ save: parseSave(save) });
		location.reload();
	}

	newCampaign() {
		LS.delete('save');
		LS.delete('record');
		location.reload();
	}

	/** Console helpers for reproducing a live state, per the game framework convention. */
	debugApi(): DebugApi {
		return {
			getState: () => this.state,
			saveState: () => LS.set({ debugSnapshot: this.#save() }),
			loadState: state => this.importSave(state ?? LS.get('debugSnapshot')),
			setState: state => this.importSave(state),
			send: command => {
				const reason = this.explain(command);
				if (!reason) this.send(command);
				return reason;
			},
			connection: () => ({
				mode: this.mode,
				status: this.status,
				peers: this.peers.filter(peer => peer.connected).length,
				notice: this.notice?.text ?? null,
				fatal: this.fatal,
			}),
			getRecord: () => this.#record,
			setName: name => this.rename(name),
		};
	}

	close() {
		this.#actor?.stop();
		this.#net.close();
	}
}
