import type { Game, LogEntry } from '@repo/game';

/**
 * What a game logged after entry `seq`, oldest first. Read from the end: a log runs to hundreds of entries and only
 * the last few are ever new.
 */
export function entriesSince(log: readonly LogEntry[], seq: number): LogEntry[] {
	let start = log.length;
	while (start > 0 && log[start - 1]!.seq > seq) start--;
	return log.slice(start);
}

/**
 * Follows a game's log from one state to the next, for whatever shows the table what just happened. `take` returns
 * what was logged since the state before, or null when there is nothing to show: the first state it is given (the
 * table was already there), a log that went backwards (an undo, another game), no game, or a state nobody lived
 * through, such as a replay seeking.
 */
export class LogWatch {
	#seen: number | null = null;

	take(game: Game | null | undefined, live: boolean): LogEntry[] | null {
		const log = game?.log ?? [];
		const newest = log.at(-1)?.seq ?? -1;
		const before = this.#seen;
		this.#seen = newest;
		if (before === null || newest < before || !live || !game) return null;
		return entriesSince(log, before);
	}
}
