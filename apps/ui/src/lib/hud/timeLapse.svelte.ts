import { framesOf, parseRecord } from '@repo/game';
import type { PublicState, World } from '@repo/game';

/** How long the whole game takes to play back, however long it was. */
const LAPSE_MS = 20_000;
/** A state stays up at least this long, so a long game skips states instead of drawing each for a blink. */
const FASTEST_MS = 45;
/** And no longer than this, so a short game does not crawl. */
const SLOWEST_MS = 220;
/** The last state is held this long before the board goes back to where the table is. */
const REST_MS = 1400;

/**
 * The game just ended, played back on the board in about twenty seconds: every pawn's trips, every cube and every
 * incident, from the recording. Each browser plays its own and anyone may stop theirs; nothing waits for it. Only the
 * host keeps the recording, so `fetch` is the session's `exportRecord`, which asks the host from a peer's browser.
 */
export class TimeLapse {
	/** The moment of the game on the board, or null while the board shows the table as it is. */
	world = $state.raw<World | null>(null);
	/** How far through the game the board is, from 0 to 1. */
	progress = $state(0);
	/** True once a game ended here has a recording to play. */
	ready = $state(false);

	readonly playing = $derived(this.world !== null);

	private frames: PublicState[] = [];
	private run = 0;

	constructor(private fetch: () => Promise<string | null>) {}

	/** Fetches the recording of the game that just ended. Resolves false when there is none to play. */
	async load(): Promise<boolean> {
		const run = ++this.run;
		this.world = null;
		this.ready = false;
		// Reading a whole game back takes tens of milliseconds, and the board is still showing how the game ended.
		await new Promise<void>(done =>
			typeof requestIdleCallback === 'function'
				? requestIdleCallback(() => done(), { timeout: 1500 })
				: setTimeout(done, 300),
		);
		if (run !== this.run) return false;
		const raw = await this.fetch().catch(() => null);
		if (run !== this.run || !raw) return false;
		const inGame = framesOf(parseRecord(JSON.parse(raw))).filter(
			frame => frame.world.game !== null && frame.phase !== 'lobby',
		);
		const stride = Math.ceil(inGame.length / (LAPSE_MS / FASTEST_MS));
		this.frames = inGame.filter((_, index) => index % stride === 0 || index === inGame.length - 1);
		this.ready = this.frames.length > 8;
		return this.ready;
	}

	async play() {
		if (!this.ready) return;
		const run = ++this.run;
		const frames = this.frames;
		const each = Math.min(SLOWEST_MS, Math.max(FASTEST_MS, LAPSE_MS / frames.length));
		const wait = (ms: number) => new Promise<boolean>(done => setTimeout(() => done(this.run === run), ms));
		for (const [index, frame] of frames.entries()) {
			this.world = frame.world;
			this.progress = (index + 1) / frames.length;
			if (!(await wait(each))) return;
		}
		if (!(await wait(REST_MS))) return;
		this.world = null;
	}

	stop() {
		this.run++;
		this.world = null;
	}

	/** Forgets the game: the next one has its own recording. */
	clear() {
		this.stop();
		this.frames = [];
		this.ready = false;
	}
}
