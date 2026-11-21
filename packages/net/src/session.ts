import type { Link, LinkHandlers } from './transport.ts';
import {
	NetError,
	peerId,
	type ConnectionStatus,
	type PeerId,
	type PeerInfo,
	type Session,
	type SessionEvents,
	type SessionOptions,
} from './types.ts';
import { createReassembler, decodeLossy, encodeLossy, encodeReliable, type ReliableWire } from './wire.ts';

const ATTEMPT_TIMEOUT_MS = 15_000;
/** Long enough for the `replaced` notice to flush before the host tears the old link down. */
const REPLACED_GRACE_MS = 1_000;

export function createHost<Msg, Presence>(options: SessionOptions<Msg, Presence>): Session<Msg, Presence> {
	const config = resolveOptions(options);
	const { selfId, transport } = config;
	const core = createCore<Msg, Presence>(config);
	const roster = new Map<PeerId, PeerInfo>([[selfId, { id: selfId, name: config.name, connected: true }]]);
	const links = new Map<PeerId, Link>();

	const publishRoster = () => {
		const peers = [...roster.values()];
		core.peers = peers;
		const frames = encodeReliable({ t: 'roster', peers });
		for (const link of links.values()) sendFrames(frames, link);
		core.emit('peers', peers);
	};

	const presence = createPresenceSender(config.presenceHz, frame => {
		let delivered = true;
		for (const link of links.values()) delivered = link.sendLossy(frame) && delivered;
		return delivered;
	});

	const accept = (link: Link): LinkHandlers => {
		const id = link.remoteId;
		const reassembler = createReassembler();
		let joined = false;

		const onReliable = (wire: ReliableWire) => {
			if (!joined) {
				if (wire.t !== 'hello') throw new NetError('protocol', `Peer ${id} spoke before hello`);
				joined = true;
				const previous = links.get(id);
				links.set(id, link);
				if (previous) {
					sendFrames(encodeReliable({ t: 'replaced' }), previous);
					setTimeout(() => previous.close(), REPLACED_GRACE_MS);
				}
				roster.set(id, { id, name: wire.name, connected: true });
				publishRoster();
				return;
			}
			if (wire.t !== 'msg') throw new NetError('protocol', `Unexpected ${wire.t} from peer ${id}`);
			core.deliverMessage(wire.d, id);
		};

		return {
			frame(lane, frame) {
				core.guard(() => {
					if (lane === 'reliable') {
						const wire = reassembler.push(frame);
						if (wire) onReliable(wire);
						return;
					}
					if (links.get(id) !== link) return;
					const presenceValue = core.parsePresence(decodeLossy(frame).d);
					if (presenceValue === undefined) return;
					const relay = encodeLossy({ d: presenceValue.value, from: id });
					for (const [otherId, other] of links) if (otherId !== id) other.sendLossy(relay);
					core.emit('presence', presenceValue.value, id);
				});
			},
			close() {
				if (links.get(id) !== link) return;
				links.delete(id);
				const entry = roster.get(id);
				if (entry) roster.set(id, { ...entry, connected: false });
				publishRoster();
			},
		};
	};

	const listener = transport.listen(selfId, {
		link: accept,
		status: status => core.setStatus(status),
		fail: error => {
			core.report(error);
			session.close();
		},
	});

	core.peers = [...roster.values()];

	const session: Session<Msg, Presence> = {
		role: 'host',
		selfId,
		get status() {
			return core.status;
		},
		get peers() {
			return core.peers;
		},
		send(msg, to) {
			core.assertOpen();
			const frames = encodeReliable({ t: 'msg', d: msg });
			if (to === undefined || typeof to === 'object') {
				for (const [id, link] of links) if (id !== to?.except) sendFrames(frames, link);
				return;
			}
			if (!roster.has(to)) throw new Error(`Unknown peer ${to}`);
			const link = links.get(to);
			if (link) sendFrames(frames, link);
		},
		sendPresence(value) {
			core.assertOpen();
			presence.push(encodeLossy({ d: value, from: selfId }));
		},
		on: core.on,
		close() {
			if (core.status === 'closed') return;
			presence.stop();
			listener.close();
			for (const link of links.values()) link.close();
			links.clear();
			core.setStatus('closed');
		},
	};
	return session;
}

function sendFrames(frames: Uint8Array[], link: Link) {
	for (const frame of frames) link.sendReliable(frame);
}

export function joinHost<Msg, Presence>(options: SessionOptions<Msg, Presence>): Session<Msg, Presence> {
	const config = resolveOptions(options);
	const { selfId, transport } = config;
	const core = createCore<Msg, Presence>(config);
	const stop = new AbortController();
	let link: Link | null = null;

	const presence = createPresenceSender(config.presenceHz, frame => link?.sendLossy(frame) ?? true);

	const fail = (error: NetError) => {
		core.report(error);
		session.close();
	};

	/** Resolves when the link it opened goes away. */
	const connectOnce = async (): Promise<void> => {
		const reassembler = createReassembler();
		const { promise: lost, resolve: onLost } = Promise.withResolvers<void>();
		let current: Link | null = null;
		const handlers: LinkHandlers = {
			frame(lane, frame) {
				if (!current || link !== current) return;
				const hostId = current.remoteId;
				core.guard(() => {
					if (lane === 'lossy') {
						const wire = decodeLossy(frame);
						if (!wire.from) throw new NetError('protocol', 'Presence from host lacks a sender');
						const presenceValue = core.parsePresence(wire.d);
						if (presenceValue !== undefined) core.emit('presence', presenceValue.value, wire.from);
						return;
					}
					const wire = reassembler.push(frame);
					if (!wire) return;
					if (wire.t === 'roster') {
						core.peers = wire.peers;
						core.emit('peers', wire.peers);
					} else if (wire.t === 'msg') core.deliverMessage(wire.d, hostId);
					else if (wire.t === 'replaced') fail(new NetError('replaced', `${selfId} connected from another tab`));
					else throw new NetError('protocol', `Unexpected ${wire.t} from host`);
				});
			},
			close() {
				if (link === current) link = null;
				onLost();
			},
		};

		const attempt = AbortSignal.any([stop.signal, AbortSignal.timeout(ATTEMPT_TIMEOUT_MS)]);
		current = await transport.connect(selfId, handlers, attempt);
		if (stop.signal.aborted) {
			current.close();
			return;
		}
		link = current;
		sendFrames(encodeReliable({ t: 'hello', name: config.name }), current);
		core.setStatus('connected');
		await lost;
		if (stop.signal.aborted) return;
		core.peers = core.peers.map(peer => (peer.id === selfId ? peer : { ...peer, connected: false }));
		core.emit('peers', core.peers);
	};

	const run = async () => {
		for (let failures = 0; !stop.signal.aborted;) {
			try {
				await connectOnce();
				failures = 0;
			} catch (error) {
				if (error instanceof NetError && error.fatal) return fail(error);
				failures++;
			}
			if (stop.signal.aborted) return;
			core.setStatus(core.status === 'connecting' ? 'connecting' : 'reconnecting');
			await sleep(backoffMs(failures), stop.signal);
		}
	};
	void run();

	const session: Session<Msg, Presence> = {
		role: 'peer',
		selfId,
		get status() {
			return core.status;
		},
		get peers() {
			return core.peers;
		},
		send(msg, to) {
			core.assertOpen();
			if (to !== undefined) throw new Error('A peer can only send to the host; omit `to`');
			if (link) sendFrames(encodeReliable({ t: 'msg', d: msg }), link);
		},
		sendPresence(value) {
			core.assertOpen();
			presence.push(encodeLossy({ d: value }));
		},
		on: core.on,
		close() {
			if (core.status === 'closed') return;
			stop.abort();
			presence.stop();
			link?.close();
			link = null;
			core.setStatus('closed');
		},
	};
	return session;
}

type ResolvedOptions<Msg, Presence> = Required<SessionOptions<Msg, Presence>>;

function resolveOptions<Msg, Presence>(options: SessionOptions<Msg, Presence>): ResolvedOptions<Msg, Presence> {
	const { selfId, name, transport, parseMsg, parsePresence, presenceHz = 30 } = options;
	peerId(selfId);
	if (typeof name !== 'string' || name.trim() === '') throw new TypeError('name must be a non-empty string');
	if (typeof transport?.listen !== 'function' || typeof transport.connect !== 'function')
		throw new TypeError('transport must come from createWebRtcTransport() or createMemoryTransport()');
	if (typeof parseMsg !== 'function' || typeof parsePresence !== 'function')
		throw new TypeError('parseMsg and parsePresence must be functions');
	if (!Number.isFinite(presenceHz) || presenceHz <= 0 || presenceHz > 120)
		throw new RangeError('presenceHz must be in (0, 120]');
	return { selfId, name, transport, parseMsg, parsePresence, presenceHz };
}

type Handlers<Msg, Presence> = {
	[E in keyof SessionEvents<Msg, Presence>]: Set<SessionEvents<Msg, Presence>[E]>;
};

function createCore<Msg, Presence>(config: ResolvedOptions<Msg, Presence>) {
	const handlers: Handlers<Msg, Presence> = {
		message: new Set(),
		presence: new Set(),
		peers: new Set(),
		status: new Set(),
		error: new Set(),
	};

	const emit = <E extends keyof SessionEvents<Msg, Presence>>(
		event: E,
		...args: Parameters<SessionEvents<Msg, Presence>[E]>
	) => {
		for (const handler of handlers[event]) (handler as (...a: typeof args) => void)(...args);
	};

	const report = (error: NetError) => {
		if (handlers.error.size === 0) console.warn(`[net] ${error.code}: ${error.message}`, error.cause ?? '');
		emit('error', error);
	};

	const core = {
		status: 'connecting' as ConnectionStatus,
		peers: [] as PeerInfo[],
		emit,
		report,
		on<E extends keyof SessionEvents<Msg, Presence>>(event: E, handler: SessionEvents<Msg, Presence>[E]) {
			const set = handlers[event] as Set<SessionEvents<Msg, Presence>[E]>;
			set.add(handler);
			return () => void set.delete(handler);
		},
		setStatus(status: ConnectionStatus) {
			if (core.status === status || core.status === 'closed') return;
			core.status = status;
			emit('status', status);
		},
		assertOpen() {
			if (core.status === 'closed') throw new Error('Session is closed');
		},
		/** Runs frame handling, turning protocol errors into reports so one bad frame never kills the link. */
		guard(handle: () => void) {
			try {
				handle();
			} catch (error) {
				if (error instanceof NetError) report(error);
				else throw error;
			}
		},
		deliverMessage(raw: unknown, from: PeerId) {
			let msg: Msg;
			try {
				msg = config.parseMsg(raw);
			} catch (error) {
				return report(
					new NetError('invalid-message', `Dropped a message from ${from} that failed parsing`, { cause: error }),
				);
			}
			emit('message', msg, from);
		},
		parsePresence(raw: unknown): { value: Presence } | undefined {
			try {
				return { value: config.parsePresence(raw) };
			} catch (error) {
				report(new NetError('invalid-presence', 'Dropped presence that failed parsing', { cause: error }));
				return undefined;
			}
		},
	};
	return core;
}

/**
 * Keeps only the newest frame and sends it at most `hz` times a second. A send the lane refuses keeps that frame
 * pending for the next tick instead of queueing it, so a backed-up lane never replays stale values.
 */
function createPresenceSender(hz: number, send: (frame: Uint8Array) => boolean) {
	const intervalMs = 1000 / hz;
	let pending: Uint8Array | null = null;
	let lastSentAt = -Infinity;
	let timer: ReturnType<typeof setTimeout> | null = null;

	const schedule = () => {
		if (timer !== null) return;
		timer = setTimeout(flush, Math.max(0, lastSentAt + intervalMs - performance.now()));
	};
	const flush = () => {
		timer = null;
		if (!pending) return;
		lastSentAt = performance.now();
		if (send(pending)) pending = null;
		else schedule();
	};

	return {
		push(frame: Uint8Array) {
			pending = frame;
			schedule();
		},
		stop() {
			if (timer !== null) clearTimeout(timer);
			timer = null;
			pending = null;
		},
	};
}

function backoffMs(failures: number): number {
	const base = Math.min(5_000, 250 * 2 ** failures);
	return base / 2 + (Math.random() * base) / 2;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise(resolve => {
		const timer = setTimeout(done, ms);
		signal.addEventListener('abort', done, { once: true });
		function done() {
			clearTimeout(timer);
			signal.removeEventListener('abort', done);
			resolve();
		}
	});
}
