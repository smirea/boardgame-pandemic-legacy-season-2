import { characterAt } from '@repo/game';
import type { Character, CityId, ExposureBox, JobId, LogEntry, SeatId, World } from '@repo/game';

type Who = { name: string; portrait: number; job: JobId | null; worker: boolean; seat: SeatId; voice: number };

/** A scratched exposure box, from the box still covered to what was under it. */
export type Scratch = {
	t: 'scratch';
	key: number;
	who: Who;
	/** The whole track, with only the boxes scratched before this one known. */
	track: (ExposureBox | 'hidden')[];
	box: number;
	result: ExposureBox;
	stage: 'covered' | 'scratching' | 'open';
};

/** A character's death, held in front of the whole table. */
export type Memorial = {
	t: 'memorial';
	key: number;
	who: Who;
	at: CityId;
	month: number;
	/** Games played, this one included. */
	games: number;
	scars: string[];
	abilities: string[];
};

export type FateScene = Scratch | Memorial;
export type FateCue =
	| { t: 'scratch' }
	| { t: 'result'; result: ExposureBox; voice: number }
	| { t: 'memorial'; key: number };

/** More than this at once is a jump, such as a reload or a replay seeking, and nothing anyone watched. */
const MOST_SCENES = 4;
const SCRATCH_MS = { covered: 650, scratching: 950, empty: 1100, scar: 1700, skull: 1500 } as const;
/** Long enough for the Chronicler to say most of a line over it. */
const MEMORIAL_MS = 8000;

const voiceOf = (id: string) => [...id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);

/**
 * What happens to a character, as the table watches it: an exposure box is scratched open before anyone knows what
 * is under it, and a death is held up for a moment. It is driven by the log, so every browser and a replay see the
 * same thing. The state is never held back: the scar is already owed and the dead character already replaced, and
 * the screen only waits (`playing`) before it shows what comes next.
 */
export class FateShow {
	scene = $state.raw<FateScene | null>(null);
	playing = $state(false);

	private seen: number | null = null;
	private queue: FateScene[] = [];
	private run = 0;

	constructor(
		private names: { scar: (character: Character) => string[]; ability: (character: Character) => string[] },
		private cue: (cue: FateCue) => void,
	) {}

	observe(world: World, live: boolean) {
		const log = world.game?.log ?? [];
		const newest = log.at(-1)?.seq ?? -1;
		const before = this.seen;
		this.seen = newest;
		if (before === null || newest < before || !live || !world.game) return this.stop();
		const scenes = this.scenes(
			world,
			log.filter(entry => entry.seq > before),
		);
		if (scenes.length > MOST_SCENES) return this.stop();
		if (!scenes.length) return;
		this.queue.push(...scenes);
		if (!this.playing) void this.play(this.run);
	}

	stop() {
		this.run++;
		this.queue = [];
		this.scene = null;
		this.playing = false;
	}

	private scenes(world: World, fresh: LogEntry[]): FateScene[] {
		const who = (seat: SeatId, seq: number): { character: Character; who: Who } | null => {
			const character = characterAt(world, seat, seq);
			return character
				? {
						character,
						who: {
							name: character.name,
							portrait: character.portrait,
							job: character.jobScar ? null : character.job,
							worker: character.worker,
							seat,
							voice: voiceOf(character.id),
						},
					}
				: null;
		};
		// A character exposed twice at once scratched two boxes, the last of them the one its card now stops at.
		const later = new Map<string, number>();
		for (const entry of fresh)
			if (entry.t === 'exposure' && entry.result !== 'worker') {
				const id = who(entry.seat, entry.seq)?.character.id;
				if (id) later.set(id, (later.get(id) ?? 0) + 1);
			}
		const scenes: FateScene[] = [];
		for (const entry of fresh) {
			if (entry.t === 'exposure' && entry.result !== 'worker') {
				const found = who(entry.seat, entry.seq);
				if (!found) continue;
				const { character } = found;
				const left = later.get(character.id)! - 1;
				later.set(character.id, left);
				const box = character.exposure - 1 - left;
				if (box < 0) continue;
				scenes.push({
					t: 'scratch',
					key: entry.seq,
					who: found.who,
					track: character.exposureTrack.map((kind, index) => (index < box ? kind : 'hidden')),
					box,
					result: entry.result,
					stage: 'covered',
				});
			} else if (entry.t === 'death') {
				const character = world.campaign.characters[entry.character];
				if (!character) continue;
				scenes.push({
					t: 'memorial',
					key: entry.seq,
					who: {
						name: character.name,
						portrait: character.portrait,
						job: character.job,
						worker: character.worker,
						seat: entry.seat,
						voice: voiceOf(character.id),
					},
					at: entry.at,
					month: world.campaign.month,
					games: world.campaign.results.filter(result => result.characters.includes(character.id)).length + 1,
					scars: this.names.scar(character),
					abilities: this.names.ability(character),
				});
			}
		}
		return scenes;
	}

	private async play(run: number) {
		this.playing = true;
		const wait = (ms: number) => new Promise<boolean>(done => setTimeout(() => done(this.run === run), ms));
		for (;;) {
			const scene = this.queue.shift();
			if (!scene) break;
			this.scene = scene;
			if (scene.t === 'memorial') {
				this.cue({ t: 'memorial', key: scene.key });
				if (!(await wait(MEMORIAL_MS))) return;
			} else {
				if (!(await wait(SCRATCH_MS.covered))) return;
				this.scene = { ...scene, stage: 'scratching' };
				this.cue({ t: 'scratch' });
				if (!(await wait(SCRATCH_MS.scratching))) return;
				this.scene = {
					...scene,
					stage: 'open',
					track: scene.track.map((kind, index) => (index === scene.box ? scene.result : kind)),
				};
				this.cue({ t: 'result', result: scene.result, voice: scene.who.voice });
				if (!(await wait(SCRATCH_MS[scene.result]))) return;
			}
			this.scene = null;
			if (!(await wait(260))) return;
		}
		this.playing = false;
	}
}
