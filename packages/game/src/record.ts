import type { Command } from './machine';
import type { PublicState } from './view';

/**
 * One change to a JSON value. `v` sets the value at the path, `del` removes the key, `len` cuts an
 * array to that length, and `shift` drops that many items from the front of an array.
 */
export type Patch = { p: (string | number)[]; v?: unknown; del?: true; len?: number; shift?: number };

export type RecordStep = {
	at: number;
	/** The player who sent it, when the recorder knows. */
	by: string | null;
	/** Null when the recorder saw the state change without seeing what caused it. */
	command: Command | null;
	patch: Patch[];
};

/** Something said or noted during the game, placed on the timeline by its time. */
export type RecordNote = { at: number; by: string; kind: 'chat' | 'why' | 'issue' | 'note'; text: string };

/**
 * A whole game as it was played: the state it started from and every change after, in order. It
 * stores the changes themselves, so a recording still plays back exactly after the rules change.
 */
export type GameRecord = {
	v: 1;
	id: string;
	month: number;
	attempt: 1 | 2;
	startedAt: number;
	initial: PublicState;
	steps: RecordStep[];
	notes: RecordNote[];
};

type Json = Record<string, unknown> | unknown[];

const isJson = (value: unknown): value is Json => typeof value === 'object' && value !== null;

function equal(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (!isJson(a) || !isJson(b) || Array.isArray(a) !== Array.isArray(b)) return false;
	if (Array.isArray(a)) {
		const other = b as unknown[];
		return a.length === other.length && a.every((item, index) => equal(item, other[index]));
	}
	const left = a as Record<string, unknown>;
	const right = b as Record<string, unknown>;
	const keys = Object.keys(left);
	return keys.length === Object.keys(right).length && keys.every(key => key in right && equal(left[key], right[key]));
}

/** How many items left the front of `before`, when what remains is how `after` begins. Zero when that is not what happened. */
function shifted(before: unknown[], after: unknown[]): number {
	if (before.length < 2 || after.length === 0 || equal(before[0], after[0])) return 0;
	for (let dropped = 1; dropped < before.length; dropped++) {
		const kept = before.length - dropped;
		if (kept > after.length || !equal(before[dropped], after[0])) continue;
		let same = true;
		for (let index = 1; index < kept && same; index++) same = equal(before[dropped + index], after[index]);
		if (same) return dropped;
	}
	return 0;
}

function walk(before: unknown, after: unknown, path: (string | number)[], out: Patch[]) {
	if (before === after) return;
	if (!isJson(before) || !isJson(after) || Array.isArray(before) !== Array.isArray(after)) {
		if (!equal(before, after)) out.push({ p: path, v: after });
		return;
	}
	if (Array.isArray(before)) {
		const next = after as unknown[];
		const dropped = shifted(before, next);
		const base = dropped ? before.slice(dropped) : before;
		const changes: Patch[] = [];
		if (dropped) changes.push({ p: path, shift: dropped });
		const shared = Math.min(base.length, next.length);
		for (let index = 0; index < shared; index++) walk(base[index], next[index], [...path, index], changes);
		for (let index = shared; index < next.length; index++) changes.push({ p: [...path, index], v: next[index] });
		if (next.length < base.length) changes.push({ p: path, len: next.length });
		// A card taken out of the middle of a sorted pile moves every card after it, one patch each. A list of plain
		// values is then shorter sent whole.
		const whole: Patch = { p: path, v: next };
		const plain = changes.length > 1 && next.every(item => typeof item !== 'object' || item === null);
		if (plain && JSON.stringify(whole).length < JSON.stringify(changes).length) out.push(whole);
		else out.push(...changes);
		return;
	}
	const left = before as Record<string, unknown>;
	const right = after as Record<string, unknown>;
	for (const key of Object.keys(left)) if (!(key in right)) out.push({ p: [...path, key], del: true });
	for (const key of Object.keys(right)) {
		if (key in left) walk(left[key], right[key], [...path, key], out);
		else out.push({ p: [...path, key], v: right[key] });
	}
}

/** The changes that turn `before` into `after`. Both are plain JSON values. */
export function diff(before: unknown, after: unknown): Patch[] {
	const out: Patch[] = [];
	walk(before, after, [], out);
	return out;
}

function applyOne(value: unknown, patch: Patch, depth: number): unknown {
	if (depth === patch.p.length) {
		if (patch.shift !== undefined) return (value as unknown[]).slice(patch.shift);
		if (patch.len !== undefined) return (value as unknown[]).slice(0, patch.len);
		return patch.v;
	}
	const key = patch.p[depth]!;
	const last = depth === patch.p.length - 1;
	if (Array.isArray(value)) {
		const copy = [...value];
		copy[key as number] = applyOne(copy[key as number], patch, depth + 1);
		return copy;
	}
	const copy = { ...(value as Record<string, unknown>) };
	if (last && patch.del) delete copy[key];
	else copy[key] = applyOne(copy[key], patch, depth + 1);
	return copy;
}

/** Applies patches without touching `state`. Untouched branches are shared with it. */
export function applyPatches<T>(state: T, patches: Patch[]): T {
	let next: unknown = state;
	for (const patch of patches) next = applyOne(next, patch, 0);
	return next as T;
}

/**
 * `value` with every object in it frozen, as the machine's own states are. A branch already frozen is taken as frozen
 * all the way down, so freezing a state built from one before it costs only what changed. What reads a state may then
 * keep answers by the identity of its parts, on a peer as on the host.
 */
export function frozen<T>(value: T): T {
	if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
	for (const child of Object.values(value)) frozen(child);
	return Object.freeze(value);
}

const recordId = (state: PublicState) => {
	const { campaign } = state.world;
	return `g${String(campaign.results.length).padStart(2, '0')}-m${String(campaign.month).padStart(2, '0')}a${campaign.attempt}`;
};

/** Which game a state belongs to. The lobby before a game belongs to the game about to start. */
export const gameIndexOf = (state: PublicState) => state.world.campaign.results.length;

export function startRecord(initial: PublicState, at: number): GameRecord {
	const { campaign } = initial.world;
	return {
		v: 1,
		id: recordId(initial),
		month: campaign.month,
		attempt: campaign.attempt,
		startedAt: at,
		initial,
		steps: [],
		notes: [],
	};
}

/** Adds one state change to a recording. A change that left the state as it was is not recorded. */
export function recordStep(
	record: GameRecord,
	before: PublicState,
	after: PublicState,
	entry: { at: number; by: string | null; command: Command | null },
): boolean {
	const patch = diff(before, after);
	if (patch.length === 0) return false;
	record.steps.push({ ...entry, patch });
	// The lobby before a game names it for good only once the game starts: the prologue lobby becomes January there.
	if (gameIndexOf(after) === gameIndexOf(record.initial)) {
		record.id = recordId(after);
		record.month = after.world.campaign.month;
		record.attempt = after.world.campaign.attempt;
	}
	return true;
}

/** Every state of the recording in order. Index 0 is the start, index n is the state after step n. */
export function framesOf(record: GameRecord): PublicState[] {
	const recorded = [record.initial];
	for (const step of record.steps) recorded.push(applyPatches(recorded.at(-1)!, step.patch));
	return recorded;
}

export function parseRecord(raw: unknown): GameRecord {
	const record = raw as Partial<GameRecord> | null;
	if (
		!record ||
		record.v !== 1 ||
		!Array.isArray(record.steps) ||
		!record.initial ||
		typeof record.initial.phase !== 'string' ||
		!record.initial.world
	)
		throw new TypeError('That is not a game recording');
	return { ...record, notes: record.notes ?? [] } as GameRecord;
}

/** What the group wrote about one game: shown beside its replay. */
export type GameNotes = {
	summary: string;
	story: string;
	highlights: string[];
	parity: string;
	findings: { finding: string; kind: string; fix: string }[];
};

export type IndexGame = {
	id: string;
	file: string;
	month: number;
	attempt: 1 | 2;
	outcome: { won: boolean; reason: string } | null;
	turns: number;
	steps: number;
	startedAt: number;
	endedAt: number;
	players: { name: string; character: string; job: string }[];
	notes: GameNotes | null;
};

/** The list a campaign page is built from: every recorded game of one run, oldest first. */
export type ReplayIndex = { run: string; title: string; updatedAt: number; games: IndexGame[] };

/** One playtest run as the runs page lists it. */
export type RunSummary = { run: string; games: number; won: number; lost: number; updatedAt: number };
