import type { CityId, Phase, PopulationReason, Upkeep, World } from '@repo/game';
import type { BoardMarks, FxKind } from '#lib/board/types.ts';

export const REASON: Record<PopulationReason, string> = {
	plague: 'Plague',
	hollow: 'Hollow Men',
	center: 'Supply center',
};

type Change = Upkeep['populationChanges'][number];

/**
 * Game End's population step, played one city at a time when the game closes: the camera finds each city whose
 * population moved, its disc turns to the new number and a flag says by how much and why. The state already holds
 * every new population; the board shows each late through `lag` until its turn comes. Only a browser that sees the
 * game close plays it, so a reload or a replay seeking into the spending step shows the numbers as they are.
 */
export class PopulationShow {
	focus = $state.raw<CityId | null>(null);
	/** How many of the changes have played so far. */
	shown = $state(0);
	playing = $state(false);
	flags = $state.raw<BoardMarks['flags']>([]);

	private changes = $state.raw<Change[]>([]);
	private phase: Phase | null = null;
	private run = 0;
	private armed = false;

	constructor(private pulse: (city: CityId, kind: FxKind) => void) {}

	/** The population each city still shows as it was, as the amount to take off the state's number. */
	readonly lag: Partial<Record<CityId, number>> = $derived.by(() => {
		const lag: Partial<Record<CityId, number>> = {};
		for (const change of this.changes.slice(this.shown)) lag[change.city] = change.delta;
		return lag;
	});

	readonly marks: BoardMarks | undefined = $derived(
		this.flags.length ? { trails: [], rings: [], flags: this.flags } : undefined,
	);

	/** `held` while something covers the board, such as the Legacy briefing a game end reads: the show waits for it. */
	observe(world: World, live: boolean, phase: Phase, held: boolean) {
		const previous = this.phase;
		this.phase = phase;
		if (phase !== 'upkeep') return this.stop();
		if (previous === 'over' && live) {
			const changes = world.game?.upkeep?.populationChanges ?? [];
			if (changes.length) {
				this.stop();
				this.changes = changes;
				this.armed = true;
			}
		}
		if (this.armed && !held) {
			this.armed = false;
			void this.play(this.run);
		}
	}

	stop() {
		this.run++;
		this.armed = false;
		this.changes = [];
		this.shown = 0;
		this.playing = false;
		this.focus = null;
		this.flags = [];
	}

	private async play(run: number) {
		this.playing = true;
		const wait = (ms: number) => new Promise<boolean>(done => setTimeout(() => done(this.run === run), ms));
		if (!(await wait(700))) return;
		for (const change of this.changes) {
			this.focus = change.city;
			if (!(await wait(950))) return;
			this.shown += 1;
			this.flags = [
				...this.flags,
				{
					id: change.city,
					city: change.city,
					text: `${change.delta > 0 ? '+' : '−'}${Math.abs(change.delta)} ${REASON[change.reason]}`,
					tone: change.delta > 0 ? 'good' : 'bad',
				},
			];
			this.pulse(change.city, change.delta > 0 ? 'build' : 'infect');
			if (!(await wait(1150))) return;
		}
		this.focus = null;
		this.playing = false;
		if (!(await wait(2600))) return;
		this.flags = [];
	}
}
