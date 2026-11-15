import { createGameActor, parseSave, publicState, reject } from '@repo/game';
import type { Command, GameActor, PublicState, Save } from '@repo/game';
import { createHost, createMemoryTransport, createPeerId, createWebRtcTransport, joinHost, peerId } from '@repo/net';
import type { ConnectionStatus, PeerInfo, Session } from '@repo/net';
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

function storedSave(): Save | null {
	const raw = LS.get('save');
	return raw ? parseSave(raw) : null;
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
};

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
	readonly #net: Session<Msg, Presence>;
	readonly #actor: GameActor | null = null;

	constructor(options: { mode: Mode; name: string; secret: string }) {
		this.mode = options.mode;
		this.selfId = storedId();
		const transport =
			options.mode === 'solo'
				? createMemoryTransport()
				: createWebRtcTransport({ signalUrl: __SIGNAL_URL__, secret: options.secret });
		const config = { selfId: this.selfId, name: options.name, transport, parseMsg, parsePresence };
		this.#net = options.mode === 'join' ? joinHost<Msg, Presence>(config) : createHost<Msg, Presence>(config);

		this.#net.on('status', status => (this.status = status));
		this.#net.on('peers', peers => {
			this.peers = peers;
			const present = new Set(peers.filter(peer => peer.connected).map(peer => peer.id as string));
			this.cursors = Object.fromEntries(Object.entries(this.cursors).filter(([id]) => present.has(id)));
			if (this.#actor && this.state) this.#net.send({ t: 'state', state: this.state });
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
			if (msg.t === 'state' && !this.#actor) this.state = msg.state;
			if (msg.t === 'rejected') this.#say(msg.reason);
			if (msg.t === 'command' && this.#actor) {
				const reason = this.#apply(msg.command);
				if (reason) this.#net.send({ t: 'rejected', reason }, from);
			}
		});
		this.status = this.#net.status;

		if (options.mode !== 'join') {
			this.#actor = createGameActor({ seed: Math.floor(Math.random() * 2 ** 31), save: storedSave() });
			this.#actor.subscribe(snapshot => {
				this.state = publicState(snapshot);
				LS.set({ save: this.#save() });
				if (this.#net.status !== 'closed') this.#net.send({ t: 'state', state: this.state });
			});
			this.#actor.start();
		}
	}

	get online() {
		return this.status === 'connected';
	}

	#say(text: string) {
		this.notice = { text, at: Date.now() };
	}

	#apply(command: Command): string | null {
		const snapshot = this.#actor!.getSnapshot();
		const current = publicState(snapshot);
		const reason =
			command.type === 'UNDO'
				? current.canUndo
					? null
					: 'Nothing to undo'
				: reject(snapshot.context.world, current.phase, command);
		if (!reason) this.#actor!.send(command);
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

	/** Replaces the campaign with a save. The page reloads so the actor restarts from it. */
	importSave(raw: unknown) {
		if (!this.#actor) throw new Error('Only the host can load a campaign');
		LS.set({ save: parseSave(typeof raw === 'string' ? JSON.parse(raw) : raw) });
		location.reload();
	}

	newCampaign() {
		LS.delete('save');
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
		};
	}

	close() {
		this.#actor?.stop();
		this.#net.close();
	}
}
