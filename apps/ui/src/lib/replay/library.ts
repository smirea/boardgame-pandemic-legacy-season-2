import { framesOf, pack, parseRecord } from '@repo/game';
import type { GameRecord, IndexGame, PublicState, ReplayIndex } from '@repo/game';
import { DEBUG_ID, LS } from '#lib/storage.ts';

/** The `run` of the index built from this browser's games, which the replay page links home from differently. */
export const LIBRARY_RUN = 'browser';

const GAMES = 'games';
const RECORDS = 'records';

// Recordings outgrow localStorage, so every game the host plays is kept here, apart per `?DEBUG_ID=` as `LS` is.
const database = () =>
	new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open(`legacy-replays${DEBUG_ID ? `-DEBUG_ID=${DEBUG_ID}` : ''}`, 1);
		request.onupgradeneeded = () => {
			request.result.createObjectStore(GAMES, { keyPath: 'file' });
			request.result.createObjectStore(RECORDS);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('The replay database could not be opened'));
	});

async function run<T>(
	mode: IDBTransactionMode,
	work: (transaction: IDBTransaction) => IDBRequest<T> | void,
): Promise<T> {
	const db = await database();
	return new Promise<T>((resolve, reject) => {
		const transaction = db.transaction([GAMES, RECORDS], mode);
		const request = work(transaction);
		transaction.oncomplete = () => {
			db.close();
			resolve(request ? request.result : (undefined as T));
		};
		transaction.onerror = transaction.onabort = () => {
			db.close();
			reject(transaction.error ?? new Error('The replay database refused the change'));
		};
	});
}

/** A recording keeps its start for good, while its id moves from the prologue lobby to January. */
const keyOf = (record: GameRecord) => `${record.startedAt}`;

/** Each seat of the game, as who sat there and the character they played. A seat nobody claimed goes by its character. */
function playersIn(state: PublicState): IndexGame['players'] {
	const { game, campaign, table } = state.world;
	if (!game) return [];
	return game.seats.map(seat => {
		const character = campaign.characters[game.players[seat]!.character];
		const job = pack.jobs.find(entry => entry.id === character?.job)?.name ?? 'No occupation';
		const name = character?.name ?? seat;
		return { name: table.seats.find(entry => entry.seat === seat)?.name ?? name, character: name, job };
	});
}

/**
 * What the games list shows of a recording at `state`. Once the game is cleared away its list keeps who played and
 * how it ended from before.
 */
function summarize(record: GameRecord, state: PublicState, previous: IndexGame | undefined): IndexGame | null {
	const game = state.world.game;
	if (!game && !previous) return null;
	return {
		// A new campaign numbers its games from the start again, so the record's own id does not tell games apart here.
		id: keyOf(record),
		file: keyOf(record),
		month: record.month,
		attempt: record.attempt,
		outcome: game ? game.outcome : (previous?.outcome ?? null),
		turns: game ? game.turn : (previous?.turns ?? 0),
		steps: record.steps.length,
		startedAt: record.startedAt,
		endedAt: record.steps.at(-1)?.at ?? record.startedAt,
		players: game ? playersIn(state) : previous!.players,
		notes: null,
	};
}

/** Keeps the recording as it stands at `state`. A lobby nobody left without starting a game is not kept. */
export async function keepGame(record: GameRecord, state: PublicState) {
	const db = await database();
	const previous = await new Promise<IndexGame | undefined>((resolve, reject) => {
		const request = db.transaction(GAMES).objectStore(GAMES).get(keyOf(record));
		request.onsuccess = () => resolve(request.result as IndexGame | undefined);
		request.onerror = () => reject(request.error ?? new Error('The replay database could not be read'));
	});
	db.close();
	// The copy in localStorage stops growing once that fills up, and a reload reads it back: the longer recording
	// already kept here is the game.
	if (previous && previous.steps > record.steps.length) return;
	const entry = summarize(record, state, previous);
	if (!entry) return;
	await run<void>('readwrite', transaction => {
		transaction.objectStore(GAMES).put(entry);
		transaction.objectStore(RECORDS).put(record, entry.file);
	});
}

let pending: { record: GameRecord; state: PublicState } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Writes what `keepSoon` holds now rather than when its second is up. */
export async function flushGames() {
	if (timer !== null) clearTimeout(timer);
	timer = null;
	const next = pending;
	pending = null;
	if (next) await keepGame(next.record, next.state).catch(error => console.warn('The game was not kept:', error));
}

/**
 * Keeps the recording at most once a second, since a turn sends many commands. A new recording first writes the one
 * it replaces in full.
 */
export function keepSoon(record: GameRecord, state: PublicState) {
	if (pending && pending.record !== record) void flushGames();
	pending = { record, state };
	timer ??= setTimeout(() => void flushGames(), 1000);
}

/**
 * Keeps the host's recording that localStorage holds. A tab closed within a second of its last change leaves the
 * library behind it, and this catches it up.
 */
export async function keepStoredGame() {
	const raw = LS.get('record');
	if (raw) await keepRecord(raw);
}

/** Keeps a whole recording, such as the host's that a peer fetched, and returns its id in the library. */
export async function keepRecord(raw: unknown): Promise<string> {
	const record = parseRecord(raw);
	const frames = framesOf(record);
	await keepGame(record, frames.findLast(frame => frame.world.game) ?? frames.at(-1)!);
	return keyOf(record);
}

/** Every game this browser has hosted, oldest first. */
export async function libraryIndex(): Promise<ReplayIndex> {
	const games = await run<IndexGame[]>('readonly', transaction => transaction.objectStore(GAMES).getAll());
	return {
		run: LIBRARY_RUN,
		title: 'Games played in this browser',
		updatedAt: Math.max(0, ...games.map(game => game.endedAt)),
		games: games.toSorted((a, b) => a.startedAt - b.startedAt),
	};
}

export async function libraryRecord(file: string): Promise<GameRecord> {
	const record = await run<GameRecord | undefined>('readonly', transaction =>
		transaction.objectStore(RECORDS).get(file),
	);
	if (!record) throw new Error('This browser no longer holds that game');
	return record;
}
