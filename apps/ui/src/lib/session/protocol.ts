import type { Command, PublicState } from '@repo/game';

export type Stroke = { id: string; points: { x: number; z: number }[] };

export type CursorTool = 'pen' | 'eraser';

export type Msg =
	| { t: 'state'; state: PublicState }
	| { t: 'command'; command: Command }
	| { t: 'rejected'; reason: string }
	| { t: 'draw'; player: string; strokes: Stroke[] }
	| { t: 'draw-clear' }
	| { t: 'ping'; id: string; player: string; x: number; z: number };

/** A cursor position on the board plane, with optional active drawing tool, or null when off the board. */
export type Presence = { x: number; z: number; tool?: CursorTool } | null;

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
	if (raw['t'] === 'draw' && typeof raw['player'] === 'string' && Array.isArray(raw['strokes'])) {
		const valid = (raw['strokes'] as unknown[]).every(
			stroke =>
				isRecord(stroke) &&
				typeof stroke['id'] === 'string' &&
				Array.isArray(stroke['points']) &&
				(stroke['points'] as unknown[]).every(
					point => isRecord(point) && Number.isFinite(point['x']) && Number.isFinite(point['z']),
				),
		);
		if (valid) return raw as Msg;
	}
	if (raw['t'] === 'draw-clear') return { t: 'draw-clear' };
	if (
		raw['t'] === 'ping' &&
		typeof raw['id'] === 'string' &&
		typeof raw['player'] === 'string' &&
		Number.isFinite(raw['x']) &&
		Number.isFinite(raw['z'])
	)
		return raw as Msg;
	throw new TypeError('unknown message');
}

export function parsePresence(raw: unknown): Presence {
	if (raw === null) return null;
	if (isRecord(raw) && Number.isFinite(raw['x']) && Number.isFinite(raw['z'])) {
		const tool = raw['tool'];
		if (tool !== undefined && tool !== 'pen' && tool !== 'eraser') throw new TypeError('bad presence tool');
		return tool
			? { x: raw['x'] as number, z: raw['z'] as number, tool }
			: { x: raw['x'] as number, z: raw['z'] as number };
	}
	throw new TypeError('bad presence');
}
