import type { Command, PublicState } from '@repo/game';

export type Msg =
	| { t: 'state'; state: PublicState }
	| { t: 'command'; command: Command }
	| { t: 'rejected'; reason: string };

/** A cursor position on the board plane, or null when the pointer is off the board. */
export type Presence = { x: number; z: number } | null;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/**
 * Wire boundary. Friends are trusted not to forge states, but a malformed frame must not reach the
 * actor, so each message is checked for its tag and the fields the handlers read.
 */
export function parseMsg(raw: unknown): Msg {
	if (!isRecord(raw)) throw new TypeError('message is not an object');
	if (
		raw['t'] === 'state' &&
		isRecord(raw['state']) &&
		typeof raw['state']['phase'] === 'string' &&
		isRecord(raw['state']['world'])
	)
		return raw as Msg;
	if (raw['t'] === 'command' && isRecord(raw['command']) && typeof raw['command']['type'] === 'string')
		return raw as Msg;
	if (raw['t'] === 'rejected' && typeof raw['reason'] === 'string') return raw as Msg;
	throw new TypeError('unknown message');
}

export function parsePresence(raw: unknown): Presence {
	if (raw === null) return null;
	if (isRecord(raw) && Number.isFinite(raw['x']) && Number.isFinite(raw['z']))
		return { x: raw['x'] as number, z: raw['z'] as number };
	throw new TypeError('bad presence');
}
