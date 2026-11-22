import { createGameActor, gameIndexOf, parseSave, publicState, recordStep, reject, startRecord } from '@repo/game';
import type { Command, GameActor, GameRecord, PlayerId, PublicState, Save } from '@repo/game';
import { createHost, createMemoryTransport, createWebRtcTransport, joinHost, peerId } from '@repo/net';
import type { ConnectionStatus, PeerId, PeerInfo, Session } from '@repo/net';
import { LS } from '../storage';
import { createDebugApi } from './debug';
import type { DebugApi } from './debug';
import { parseMsg, parsePresence } from './protocol';
import type { CursorTool, Msg, Point, Presence, Stroke } from './protocol';
import { Sketch } from './sketch.svelte';
import { storedId, storedName, storedRecord, storedSave } from './stored';
import { StateFeed, StateMirror } from './sync';

export type Mode = 'solo' | 'host' | 'join';
export type { MapPing } from './sketch.svelte';

/** What the game screen needs from a session. A replay supplies the same shape with nothing behind it. */
export type SessionView = Pick<
	GameSession,
	| 'state'
	| 'player'
	| 'rename'
	| 'status'
	| 'peers'
	| 'cursors'
	| 'drawings'
	| 'pings'
	| 'notice'
	| 'mode'
	| 'send'
	| 'pointer'
	| 'stroke'
	| 'redraw'
	| 'clearMyDrawings'
	| 'ping'
	| 'exportSave'
	| 'importSave'
	| 'newCampaign'
	| 'exportRecord'
>;

/**
 * One player's connection to the game. The host owns the XState actor and sends every peer what each transition
 * changed. Peers hold the state that adds up to and forward commands.
 */
export class GameSession {
	state = $state.raw<PublicState | null>(null);
	status = $state<ConnectionStatus>('connecting');
	peers = $state.raw<PeerInfo[]>([]);
	cursors = $state.raw<Record<string, Point & { tool?: CursorTool }>>({});
	notice = $state<{ text: string; at: number } | null>(null);
	fatal = $state<string | null>(null);

	readonly mode: Mode;
	readonly selfId;
	/** This browser's person at the table: the same id the connection introduces it by. */
	readonly player: PlayerId;
	readonly #net: Session<Msg, Presence>;
	readonly #actor: GameActor | null = null;
	readonly #sketch: Sketch;
	/** The host's side of keeping peers on its state, and a peer's. */
	readonly #feed = new StateFeed();
	readonly #mirror = new StateMirror();
	/** True from asking the host for the whole state until it arrives, so it is asked for once. */
	#asked = false;
	/** The game in progress, recorded step by step. Only the host keeps one. */
	#record: GameRecord | null = null;
	#sender: { command: Command; by: string | null } | null = null;
	/** Prevents re-seating a player mid-game after they explicitly vacated their seat. */
	#resumedGame: number | null = null;
	/** Where every other pointer is, as it arrives. The screen is handed them once a frame. */
	readonly #pointers = new Map<string, NonNullable<Presence>>();
	#pointersFrame = 0;
	#storageFailed = false;

	/** False for a session that stands apart from this browser's campaign, which neither reads nor writes storage. */
	readonly #persist: boolean;

	/**
	 * `save` starts the game from that state in place of this browser's campaign and keeps it out of storage, and
	 * `player` sits down as that id, so a state captured in one browser opens the same in another.
	 */
	constructor(options: { mode: Mode; secret: string; save?: Save | null; player?: string }) {
		this.mode = options.mode;
		this.#persist = options.save === undefined;
		this.selfId = options.player ? peerId(options.player) : storedId();
		this.player = this.selfId as string as PlayerId;
		const transport =
			options.mode === 'solo'
				? createMemoryTransport()
				: createWebRtcTransport({ signalUrl: new URL(__SIGNAL_URL__, location.href).href, secret: options.secret });
		const config = { selfId: this.selfId, name: storedName(), transport, parseMsg, parsePresence };
		this.#net = options.mode === 'join' ? joinHost<Msg, Presence>(config) : createHost<Msg, Presence>(config);
		this.#sketch = new Sketch(this.selfId, msg => {
			if (this.status === 'connected') this.#net.send(msg);
		});

		this.#net.on('status', status => {
			this.status = status;
			if (this.#actor) return;
			// A peer whose link just came up has nothing it can trust: what it holds may be from before the host
			// restarted. It asks for the game whole, and until that arrives no change is applied to what it has.
			this.#mirror.reset();
			this.#asked = false;
			if (status === 'connected') this.#resync();
		});
		this.#net.on('peers', peers => this.#onPeers(peers));
		this.#net.on('presence', (presence, from) => {
			if (presence) this.#pointers.set(from, presence);
			else this.#pointers.delete(from);
			this.#showPointers();
		});
		this.#net.on('error', error => {
			if (error.fatal) this.fatal = error.message;
			else console.warn(error.code, error.message);
		});
		this.#net.on('message', (msg, from) => this.#onMessage(msg, from));
		this.status = this.#net.status;

		if (options.mode !== 'join') {
			const save = options.save === undefined ? storedSave() : options.save;
			const savedUndo = this.#persist && save ? ((LS.get('undo') as Save['world'][] | null) ?? []) : [];
			this.#record = this.#persist ? storedRecord(save) : null;
			this.#actor = createGameActor({ seed: Math.floor(Math.random() * 2 ** 31), save, undo: savedUndo });
			this.#actor.subscribe(snapshot => {
				const before = this.state;
				const after = publicState(snapshot);
				// The actor reports every event it is sent, and most change nothing the screen shows.
				if (before && before.world === after.world && before.phase === after.phase && before.canUndo === after.canUndo)
					return;
				this.state = after;
				if (before) this.#remember(before, after);
				// An imported campaign reaches its lobby with nobody seated, so the host sits down there as on arrival.
				if (before && before.phase !== 'lobby' && after.phase === 'lobby')
					queueMicrotask(() => {
						this.#tidyLobby();
						this.#sitDown();
					});
				this.#store({ save: this.save(), undo: snapshot.context.undo });
				const change = this.#feed.next(after);
				if (change && this.#net.status !== 'closed') this.#net.send(change);
			});
			this.#actor.start();
			this.#sitDown();
			this.#tidyLobby();
		}
	}

	get drawings() {
		return this.#sketch.drawings;
	}

	get pings() {
		return this.#sketch.pings;
	}

	get record() {
		return this.#record;
	}

	#onPeers(peers: PeerInfo[]) {
		this.peers = peers;
		const present = new Set(peers.filter(peer => peer.connected).map(peer => peer.id as string));
		for (const id of this.#pointers.keys()) if (!present.has(id)) this.#pointers.delete(id);
		this.#showPointers();
		this.#tidyLobby();
	}

	#onMessage(msg: Msg, from: PeerId) {
		switch (msg.t) {
			case 'state':
			case 'patch': {
				if (this.#actor) return;
				const state = this.#mirror.apply(msg);
				if (state === 'lost') return this.#resync();
				if (msg.t === 'state') this.#asked = false;
				this.state = state;
				return this.#sitDown();
			}
			case 'resync': {
				// The game and what is drawn on the map, whole, for a peer that just connected or lost its place.
				const whole = this.#actor && this.#feed.whole();
				if (!whole) return;
				this.#net.send(whole, from);
				// What the peer holds of the map's drawings may be from before this host restarted, so it starts clean.
				this.#net.send({ t: 'draw-clear' }, from);
				for (const drawn of this.#sketch.whole()) this.#net.send(drawn, from);
				return;
			}
			case 'rejected':
				return this.#say(msg.reason);
			case 'command': {
				if (!this.#actor) return;
				const reason = this.#apply(msg.command, this.#nameOf(from));
				if (reason) this.#net.send({ t: 'rejected', reason }, from);
				return;
			}
			default:
				this.#sketch.receive(msg);
				if (this.#actor) this.#net.send(msg, { except: from });
		}
	}

	#resync() {
		if (this.#asked || this.status !== 'connected') return;
		this.#asked = true;
		this.#net.send({ t: 'resync' });
	}

	/** Pointers arrive many times a frame with a full table, so the screen takes them once a frame. */
	#showPointers() {
		if (this.#pointersFrame) return;
		this.#pointersFrame = requestAnimationFrame(() => {
			this.#pointersFrame = 0;
			this.cursors = Object.fromEntries(this.#pointers);
		});
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
		const state = this.state;
		if (!state) return;
		const held = () => this.state!.world.table.seats.filter(entry => entry.player === this.player).length;
		const name = storedName();
		if (state.phase === 'lobby') {
			this.#resumedGame = null;
			const join: Command = { type: 'JOIN', player: this.player, name };
			if (held() === 0 && !this.explain(join)) this.send(join);
			const another: Command = { type: 'ADD_SEAT', player: this.player };
			if (this.mode === 'solo' && held() === 1 && !this.explain(another)) this.send(another);
			return;
		}
		const { game, campaign, table } = state.world;
		if (
			!game ||
			this.mode === 'solo' ||
			state.phase === 'upkeep' ||
			state.phase === 'over' ||
			state.phase === 'finished'
		)
			return;
		const index = gameIndexOf(state);
		if (this.#resumedGame === index) return;
		this.#resumedGame = index;
		if (held() > 0) return;
		const present = new Set(this.peers.filter(peer => peer.connected).map(peer => peer.id as string));
		for (const seat of game.seats) {
			const character = campaign.characters[game.players[seat]!.character];
			if (character?.player !== this.player) continue;
			const holder = table.seats.find(entry => entry.seat === seat);
			if (holder && holder.player !== this.player && present.has(holder.player)) continue;
			const take: Command = { type: 'TAKE_SEAT', player: this.player, name, seat };
			if (!this.explain(take)) this.send(take);
		}
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

	/**
	 * Writes the host's game to this browser. A browser whose storage is full must not stop the game for the table,
	 * so the game goes on unsaved and the host is told once.
	 */
	#store(values: Parameters<typeof LS.set>[0]) {
		if (!this.#persist) return;
		try {
			LS.set(values);
		} catch (error) {
			console.warn('The game could not be saved in this browser:', error);
			if (!this.#storageFailed)
				this.#say('This browser cannot save the game: its storage is full. Export the campaign from the Menu.');
			this.#storageFailed = true;
		}
	}

	/** Adds the change to the recording of the game it belongs to, starting a new recording when a new game begins. */
	#remember(before: PublicState, after: PublicState) {
		if (!this.#record || gameIndexOf(this.#record.initial) !== gameIndexOf(before))
			this.#record = startRecord(before, Date.now());
		const sender = this.#sender;
		this.#sender = null;
		const entry = { at: Date.now(), by: sender?.by ?? null, command: sender?.command ?? null };
		if (recordStep(this.#record, before, after, entry)) this.#store({ record: this.#record });
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

	/** Adds a point to this player's stroke `id` on the map, starting it if it is new. */
	stroke(id: string, point: Point) {
		this.#sketch.stroke(id, point);
	}

	/** Puts `strokes` in place of a player's strokes on the map, as an eraser does. */
	redraw(player: string, strokes: Stroke[]) {
		this.#sketch.redraw(player, strokes);
	}

	clearMyDrawings() {
		this.#sketch.clearMine();
	}

	ping(point: Point) {
		this.#sketch.ping(point);
	}

	save(): Save | null {
		return this.state ? { v: 1, phase: this.state.phase, world: this.state.world } : null;
	}

	/** Any player can export: everyone holds the whole state. */
	exportSave(): string {
		return JSON.stringify(this.save());
	}

	/** The recording of the game in progress, or of the last one until the next begins. Only the host has it. */
	exportRecord(): string | null {
		return this.#record ? JSON.stringify(this.#record) : null;
	}

	/** Replaces the campaign with a save. The page reloads so the actor restarts from it. */
	importSave(raw: unknown) {
		if (!this.#actor) throw new Error('Only the host can load a campaign');
		const save: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
		LS.delete('record');
		LS.delete('undo');
		LS.set({ save: parseSave(save) });
		location.reload();
	}

	newCampaign() {
		LS.delete('save');
		LS.delete('undo');
		LS.delete('record');
		location.reload();
	}

	debugApi(): DebugApi {
		return createDebugApi(this);
	}

	close() {
		cancelAnimationFrame(this.#pointersFrame);
		this.#sketch.dispose();
		this.#actor?.stop();
		this.#net.close();
	}
}
