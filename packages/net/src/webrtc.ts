import {
	KEEPALIVE,
	PEER_ID_PATTERN,
	SignalClose,
	type ClientMessage,
	type ServerMessage,
	type SignalRole,
} from './signal-protocol.ts';
import type { Lane, Link, LinkHandlers, Transport } from './transport.ts';
import { NetError, type PeerId } from './types.ts';

export type WebRtcTransportOptions = {
	/** The signaling Worker, e.g. `https://net-signal.<you>.workers.dev` or `ws://127.0.0.1:8787` under `wrangler dev`. */
	signalUrl: string;
	secret: string;
	/** Added after Cloudflare's STUN server, e.g. a TURN server for players behind strict NATs. */
	iceServers?: RTCIceServer[];
};

const STUN: RTCIceServer = { urls: 'stun:stun.cloudflare.com:3478' };
const KEEPALIVE_MS = 30_000;
/** Above this the reliable lane queues in JS instead of growing the browser's send buffer, which throws when full. */
const RELIABLE_HIGH_WATER = 1024 * 1024;
const RELIABLE_LOW_WATER = 256 * 1024;
const LOSSY_HIGH_WATER = 16 * 1024;

type SignalData = { attempt: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };

export function createWebRtcTransport(options: WebRtcTransportOptions): Transport {
	const endpoint = parseSignalUrl(options.signalUrl);
	if (typeof options.secret !== 'string' || options.secret === '')
		throw new TypeError('secret must be a non-empty string');
	const extra = options.iceServers ?? [];
	if (!Array.isArray(extra) || !extra.every(server => typeof server?.urls === 'string' || Array.isArray(server?.urls)))
		throw new TypeError('iceServers must be RTCIceServer objects with `urls`');
	const rtcConfig: RTCConfiguration = { iceServers: [STUN, ...extra] };

	const socketUrl = (role: SignalRole, id: PeerId) => {
		const url = new URL(endpoint);
		url.searchParams.set('role', role);
		url.searchParams.set('id', id);
		url.searchParams.set('secret', options.secret);
		return url;
	};

	return {
		listen(selfId, handlers) {
			const pending = new Map<PeerId, { attempt: string; pc: RTCPeerConnection; link: Link }>();
			let socket: SignalSocket | null = null;
			let closed = false;
			let failures = 0;
			let retry: ReturnType<typeof setTimeout> | undefined;

			const onSignal = (from: PeerId, data: SignalData) => {
				if (data.sdp?.type === 'offer') {
					pending.get(from)?.link.close();
					const pc = new RTCPeerConnection(rtcConfig);
					const connection = wireConnection(pc, from);
					const entry = { attempt: data.attempt, pc, link: connection.link };
					pending.set(from, entry);
					const reply = (payload: Omit<SignalData, 'attempt'>) =>
						socket?.send({ t: 'signal', to: from, data: { attempt: data.attempt, ...payload } });
					pc.onicecandidate = event => {
						if (event.candidate) reply({ candidate: event.candidate.toJSON() });
					};
					const answer = async () => {
						await pc.setRemoteDescription(data.sdp!);
						await pc.setLocalDescription();
						reply({ sdp: pc.localDescription!.toJSON() });
					};
					answer().catch(() => connection.link.close());
					connection.ready.then(
						() => {
							if (pending.get(from) === entry) pending.delete(from);
							connection.attach(handlers.link(connection.link));
						},
						() => {
							if (pending.get(from) === entry) pending.delete(from);
						},
					);
				} else if (data.candidate) {
					const entry = pending.get(from);
					if (entry?.attempt === data.attempt) entry.pc.addIceCandidate(data.candidate).catch(() => {});
				}
			};

			const open = () => {
				socket = openSignalSocket(socketUrl('host', selfId), {
					message(msg) {
						if (msg.t === 'ready') {
							failures = 0;
							handlers.status('connected');
						} else if (msg.t === 'signal') {
							const from = asPeerId(msg.from);
							const data = parseSignalData(msg.data);
							if (from && data) onSignal(from, data);
						}
					},
					close(code) {
						socket = null;
						if (closed) return;
						const fatal = closeError(code);
						if (fatal) {
							shutdown();
							return handlers.fail(fatal);
						}
						handlers.status('reconnecting');
						retry = setTimeout(open, Math.min(5_000, 250 * 2 ** failures++));
					},
				});
			};

			const shutdown = () => {
				closed = true;
				clearTimeout(retry);
				socket?.close();
				for (const entry of pending.values()) entry.link.close();
				pending.clear();
			};

			open();
			return { close: shutdown };
		},

		connect(selfId, handlers, signal) {
			return new Promise<Link>((resolve, reject) => {
				const attempt = crypto.randomUUID();
				let settled = false;
				let pc: RTCPeerConnection | null = null;
				let link: Link | null = null;
				let hostId: PeerId | null = null;

				const finish = (error?: unknown) => {
					if (settled) return;
					settled = true;
					signal.removeEventListener('abort', onAbort);
					socket.close();
					if (error === undefined) return resolve(link!);
					link?.close();
					reject(error);
				};
				const onAbort = () => finish(signal.reason ?? new Error('Connection attempt aborted'));

				const send = (payload: Omit<SignalData, 'attempt'>) =>
					hostId && socket.send({ t: 'signal', to: hostId, data: { attempt, ...payload } });

				const start = (id: PeerId) => {
					hostId = id;
					pc = new RTCPeerConnection(rtcConfig);
					const connection = wireConnection(pc, id);
					link = connection.link;
					connection.attach(handlers);
					pc.onicecandidate = event => {
						if (event.candidate) send({ candidate: event.candidate.toJSON() });
					};
					const offer = async () => {
						await pc!.setLocalDescription();
						send({ sdp: pc!.localDescription!.toJSON() });
					};
					offer().catch(finish);
					connection.ready.then(() => finish(), finish);
				};

				const socket = openSignalSocket(socketUrl('peer', selfId), {
					message(msg) {
						if (msg.t === 'host' && !pc) {
							const id = asPeerId(msg.id);
							if (id) start(id);
						} else if (msg.t === 'signal' && pc && msg.from === hostId) {
							const data = parseSignalData(msg.data);
							if (data?.attempt !== attempt) return;
							if (data.sdp?.type === 'answer') pc.setRemoteDescription(data.sdp).catch(finish);
							else if (data.candidate) pc.addIceCandidate(data.candidate).catch(() => {});
						}
					},
					close(code) {
						finish(closeError(code) ?? new Error(`Signaling closed (${code}) before the host answered`));
					},
				});

				if (signal.aborted) onAbort();
				else signal.addEventListener('abort', onAbort);
			});
		},
	};
}

/**
 * Both data channels are negotiated with fixed ids, so neither side waits for `ondatachannel`. Frames that arrive
 * before `attach` are held, because the host learns its handlers only once both lanes are open.
 */
function wireConnection(pc: RTCPeerConnection, remoteId: PeerId) {
	const reliable = pc.createDataChannel('reliable', { negotiated: true, id: 0, ordered: true });
	const lossy = pc.createDataChannel('lossy', { negotiated: true, id: 1, ordered: false, maxRetransmits: 0 });
	reliable.binaryType = 'arraybuffer';
	lossy.binaryType = 'arraybuffer';
	reliable.bufferedAmountLowThreshold = RELIABLE_LOW_WATER;

	let state: 'opening' | 'open' | 'closed' = 'opening';
	let handlers: LinkHandlers | null = null;
	const early: [Lane, Uint8Array][] = [];
	const backlog: Uint8Array<ArrayBuffer>[] = [];
	const { promise: ready, resolve, reject } = Promise.withResolvers<void>();

	const teardown = () => {
		const wasOpen = state === 'open';
		state = 'closed';
		pc.close();
		backlog.length = 0;
		reject(new Error(`Connection to ${remoteId} failed before opening`));
		return wasOpen;
	};
	const lost = () => {
		if (state !== 'closed' && teardown()) handlers?.close();
	};
	const onOpen = () => {
		if (state !== 'opening' || reliable.readyState !== 'open' || lossy.readyState !== 'open') return;
		state = 'open';
		resolve();
	};
	const onFrame = (lane: Lane) => (event: MessageEvent<ArrayBuffer>) => {
		const frame = new Uint8Array(event.data);
		if (handlers) handlers.frame(lane, frame);
		else early.push([lane, frame]);
	};

	reliable.onopen = onOpen;
	lossy.onopen = onOpen;
	reliable.onclose = lost;
	lossy.onclose = lost;
	reliable.onmessage = onFrame('reliable');
	lossy.onmessage = onFrame('lossy');
	reliable.onbufferedamountlow = () => {
		while (backlog.length > 0 && reliable.bufferedAmount < RELIABLE_HIGH_WATER) reliable.send(backlog.shift()!);
	};
	pc.onconnectionstatechange = () => {
		if (pc.connectionState === 'failed' || pc.connectionState === 'closed') lost();
	};

	const link: Link = {
		remoteId,
		sendReliable(frame) {
			if (state !== 'open') return;
			const owned = new Uint8Array(frame);
			if (backlog.length > 0 || reliable.bufferedAmount >= RELIABLE_HIGH_WATER) backlog.push(owned);
			else reliable.send(owned);
		},
		sendLossy(frame) {
			if (state !== 'open' || lossy.bufferedAmount > LOSSY_HIGH_WATER) return false;
			lossy.send(new Uint8Array(frame));
			return true;
		},
		close() {
			if (state !== 'closed') teardown();
		},
	};

	return {
		link,
		ready,
		attach(next: LinkHandlers) {
			handlers = next;
			for (const [lane, frame] of early.splice(0)) next.frame(lane, frame);
		},
	};
}

type SignalSocket = { send(msg: ClientMessage): void; close(): void };

function openSignalSocket(
	url: URL,
	handlers: { message: (msg: ServerMessage) => void; close: (code: number) => void },
): SignalSocket {
	const ws = new WebSocket(url);
	let keepalive: ReturnType<typeof setInterval> | undefined;
	let closed = false;
	ws.onopen = () => {
		keepalive = setInterval(() => ws.send(KEEPALIVE.ping), KEEPALIVE_MS);
	};
	ws.onmessage = event => {
		const msg = typeof event.data === 'string' ? parseServerMessage(event.data) : null;
		if (msg) handlers.message(msg);
	};
	ws.onclose = event => {
		clearInterval(keepalive);
		if (closed) return;
		closed = true;
		handlers.close(event.code);
	};
	return {
		send(msg) {
			if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
		},
		close() {
			closed = true;
			clearInterval(keepalive);
			ws.close();
		},
	};
}

function parseSignalUrl(value: string): URL {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new TypeError(`signalUrl is not a URL: ${JSON.stringify(value)}`);
	}
	const protocols: Record<string, string> = { 'http:': 'ws:', 'https:': 'wss:', 'ws:': 'ws:', 'wss:': 'wss:' };
	const protocol = protocols[url.protocol];
	if (!protocol) throw new TypeError(`signalUrl must be http(s) or ws(s), got ${url.protocol}`);
	url.protocol = protocol;
	return url;
}

function closeError(code: number): NetError | null {
	if (code === SignalClose.unauthorized)
		return new NetError('unauthorized', 'The signaling Worker rejected the secret');
	if (code === SignalClose.hostTaken) return new NetError('host-taken', 'Another client is already hosting');
	if (code === SignalClose.replaced) return new NetError('replaced', 'This id connected again from another tab');
	return null;
}

function asPeerId(value: unknown): PeerId | null {
	return typeof value === 'string' && PEER_ID_PATTERN.test(value) ? (value as PeerId) : null;
}

function parseServerMessage(text: string): ServerMessage | null {
	try {
		const raw: unknown = JSON.parse(text);
		if (typeof raw !== 'object' || raw === null || !('t' in raw)) return null;
		return raw as ServerMessage;
	} catch {
		return null;
	}
}

function parseSignalData(raw: unknown): SignalData | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const { attempt, sdp, candidate } = raw as Record<string, unknown>;
	if (typeof attempt !== 'string') return null;
	const data: SignalData = { attempt };
	if (typeof sdp === 'object' && sdp !== null && typeof (sdp as RTCSessionDescriptionInit).type === 'string')
		data.sdp = sdp as RTCSessionDescriptionInit;
	if (typeof candidate === 'object' && candidate !== null) data.candidate = candidate as RTCIceCandidateInit;
	return data;
}
