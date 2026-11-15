import { PEER_ID_PATTERN } from './signal-protocol.ts';
import { MAX_FRAME_BYTES } from './transport.ts';
import { NetError, type PeerId, type PeerInfo } from './types.ts';

export type ReliableWire =
	| { t: 'hello'; name: string }
	| { t: 'roster'; peers: PeerInfo[] }
	| { t: 'msg'; d: unknown }
	| { t: 'replaced' };

/** `from` is set only host to peer. The host never trusts a peer's claim and uses the link's id. */
export type LossyWire = { d: unknown; from?: PeerId };

const MORE = 0;
const LAST = 1;
const MAX_MESSAGE_BYTES = 32 * 1024 * 1024;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * The reliable lane is ordered and a message's frames are sent back to back, so one header byte saying whether more
 * frames follow is all reassembly needs.
 */
export function encodeReliable(wire: ReliableWire): Uint8Array[] {
	const bytes = encoder.encode(JSON.stringify(wire));
	const body = MAX_FRAME_BYTES - 1;
	const frames: Uint8Array[] = [];
	for (let offset = 0; ; offset += body) {
		const end = Math.min(offset + body, bytes.length);
		const frame = new Uint8Array(1 + end - offset);
		frame[0] = end === bytes.length ? LAST : MORE;
		frame.set(bytes.subarray(offset, end), 1);
		frames.push(frame);
		if (end === bytes.length) return frames;
	}
}

export function createReassembler() {
	let parts: Uint8Array[] = [];
	let size = 0;
	return {
		/** Returns the decoded message once its last frame arrives, otherwise undefined. */
		push(frame: Uint8Array): ReliableWire | undefined {
			parts.push(frame.subarray(1));
			size += frame.length - 1;
			if (size > MAX_MESSAGE_BYTES) {
				parts = [];
				size = 0;
				throw new NetError('protocol', `Message exceeds ${MAX_MESSAGE_BYTES} bytes`);
			}
			if (frame[0] !== LAST) return undefined;
			const bytes = new Uint8Array(size);
			let offset = 0;
			for (const part of parts) {
				bytes.set(part, offset);
				offset += part.length;
			}
			parts = [];
			size = 0;
			return parseReliable(decodeJson(bytes));
		},
	};
}

export function encodeLossy(wire: LossyWire): Uint8Array {
	const frame = encoder.encode(JSON.stringify(wire));
	if (frame.length > MAX_FRAME_BYTES) throw new RangeError(`Presence must encode to at most ${MAX_FRAME_BYTES} bytes`);
	return frame;
}

export function decodeLossy(frame: Uint8Array): LossyWire {
	const raw = decodeJson(frame);
	if (!isRecord(raw) || !('d' in raw)) throw new NetError('protocol', 'Malformed presence frame');
	if (raw.from === undefined) return { d: raw.d };
	if (isPeerId(raw.from)) return { d: raw.d, from: raw.from };
	throw new NetError('protocol', 'Malformed presence sender');
}

function parseReliable(raw: unknown): ReliableWire {
	if (isRecord(raw)) {
		if (raw.t === 'hello' && typeof raw.name === 'string') return { t: 'hello', name: raw.name };
		if (raw.t === 'roster' && Array.isArray(raw.peers) && raw.peers.every(isPeerInfo))
			return { t: 'roster', peers: raw.peers };
		if (raw.t === 'msg' && 'd' in raw) return { t: 'msg', d: raw.d };
		if (raw.t === 'replaced') return { t: 'replaced' };
	}
	throw new NetError('protocol', 'Malformed reliable frame');
}

function decodeJson(bytes: Uint8Array): unknown {
	try {
		return JSON.parse(decoder.decode(bytes));
	} catch (error) {
		throw new NetError('protocol', 'Frame is not valid JSON', { cause: error });
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPeerId(value: unknown): value is PeerId {
	return typeof value === 'string' && PEER_ID_PATTERN.test(value);
}

function isPeerInfo(value: unknown): value is PeerInfo {
	return (
		isRecord(value) && isPeerId(value.id) && typeof value.name === 'string' && typeof value.connected === 'boolean'
	);
}
