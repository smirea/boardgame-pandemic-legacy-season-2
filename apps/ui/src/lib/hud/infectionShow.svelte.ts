import { pack } from '@repo/game';
import type { CityId, InfectionCard, LogEntry, Phase, World } from '@repo/game';
import type { FxKind } from '#lib/board/types.ts';

type Piece = 'supplies' | 'plague' | 'hollow';
type Pieces = Record<Piece, number>;
type Board = { cities: Partial<Record<CityId, Pieces>>; stockpile: number };

/** A change the state already holds, kept off the board until its moment in the show comes. */
type Hidden = { city: CityId | null; piece: Piece | 'stockpile'; amount: number };

type Beat = {
	seq: number;
	/** What the card does, when that has a sound of its own. A cube lost is heard as the cube leaves. */
	effect: Extract<ShowCue, { t: 'strike' }>['effect'] | null;
	/** A Gather card names no city, so the camera stays where it is. */
	city: CityId | null;
	card: InfectionCard;
	strike: Hidden[];
	pulse: FxKind | null;
	incidents: { city: CityId; hidden: Hidden[] }[];
	/**
	 * How much rides on the card, which sets how long it is held: `low` for a cube from a city with cubes to spare,
	 * `close` for one that leaves a city with one cube or none, and `brink` for an incident with the track nearly full.
	 */
	stakes: 'low' | 'close' | 'brink';
};

/** How long a card lies face up before it strikes, and how long after, in milliseconds. */
const HOLD = { low: [430, 430], close: [900, 700], incident: [1050, 750], brink: [1900, 900] } as const;
/** With this many incidents left or fewer, each one is held as the one that may lose the game. */
const BRINK = 2;

/** A moment of the show that is heard: the card turning over, what it does to its city, and an incident's three beats. */
export type ShowCue =
	| { t: 'flip' }
	| { t: 'strike'; effect: 'hollow' | 'outbreak' | 'blocked' | 'gather'; city: CityId | null }
	| { t: 'skull' }
	| { t: 'plague'; city: CityId }
	/** A marker lands on the incident track. `waiting` is how many more the state holds that have not landed. */
	| { t: 'marker'; waiting: number };

export type DrawnInfection = { key: number; card: InfectionCard; city: CityId | null };
export type Lag = { cities: Partial<Record<CityId, Pieces>>; stockpile: number };

/** How long the riffle on the turn desk takes, with a little to spare. */
const SHUFFLE_MS = 2200;

/** More beats than this at once is a jump, such as a reload or a replay seeking, and is not shown. */
const MOST_BEATS = 12;

function boardOf(world: World): Board | null {
	const game = world.game;
	if (!game) return null;
	const cities: Board['cities'] = {};
	for (const [city, location] of Object.entries(game.locations) as [CityId, (typeof game.locations)[CityId]][])
		cities[city] = { supplies: location.supplies, plague: location.plague, hollow: location.hollow };
	return { cities, stockpile: game.stockpile };
}

/**
 * When the cards flipped stay out on the desk: through a turn's Infect step until its player ends the turn, while
 * the cards that open a game are flipped, and through an Epidemic from its bottom card to its reshuffle.
 */
const holds = (phase: Phase, step: string | null) =>
	phase === 'playing.infect' || phase === 'setup.infect' || step === 'epidemicInfect' || step === 'intensify';

/**
 * Plays each Infection card flipped, one at a time and in the order the state flipped them, lingering on each city
 * and stacking the cards so every city name stays in view until the step ends, when the camera zooms back out. Every
 * flip is a command of its own, so each browser plays it as it arrives and nobody flips a card the others cannot see.
 */
export class InfectionShow {
	/** All Infection cards drawn in the current phase, newest first. */
	stack = $state.raw<DrawnInfection[]>([]);
	/** Where the cards went when the stack was last cleared: an Epidemic's reshuffle puts them back on the deck. */
	exit = $state<'discard' | 'deck'>('discard');
	focus = $state.raw<CityId | null>(null);
	skull = $state.raw<{ key: number; city: CityId; at: number } | null>(null);
	/** The incident track is drawn large while a marker goes into it. */
	surge = $state(false);
	/** Incidents the state holds whose marker has not gone onto the track yet. */
	heldIncidents = $state(0);
	/** True while a flipped card is being played out, or more wait their turn. */
	playing = $state(false);
	/** An Epidemic's reshuffle that this watched: the discard pile riffled back onto the deck, with how many cards it held. */
	shuffle = $state.raw<{ key: number; cards: number } | null>(null);

	private hidden = $state.raw<Hidden[]>([]);
	private queue: Beat[] = [];
	private seen = -1;
	private board: Board | null = null;
	private run = 0;
	private phase: Phase | null = null;
	private step: string | null = null;
	private held = false;
	private discarded = 0;
	private clearTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private pulse: (city: CityId, kind: FxKind) => void,
		private cue: (cue: ShowCue) => void,
	) {}

	readonly lag: Lag = $derived.by(() => {
		const lag: Lag = { cities: {}, stockpile: 0 };
		for (const entry of this.hidden) {
			if (entry.piece === 'stockpile') lag.stockpile += entry.amount;
			else if (entry.city) {
				const pieces = (lag.cities[entry.city] ??= { supplies: 0, plague: 0, hollow: 0 });
				pieces[entry.piece] += entry.amount;
			}
		}
		return lag;
	});

	/** Takes in the newest state. `live` is false for a jump that nobody lived through, which only catches up. */
	observe(world: World, live: boolean, phase: Phase) {
		const prevPhase = this.phase;
		const prevStep = this.step;
		const wasHeld = this.held;
		this.phase = phase;
		this.step = world.game?.pending[0]?.t ?? null;
		this.held = holds(phase, this.step);
		const log = world.game?.log ?? [];
		const newest = log.at(-1)?.seq ?? -1;
		const before = this.board;
		const discarded = this.discarded;
		this.discarded = world.game?.infectionDiscard.length ?? 0;
		this.board = boardOf(world);
		const fresh = log.filter(entry => entry.seq > this.seen);
		const undone = newest < this.seen;
		this.seen = newest;
		if (undone || !live || !before || !this.board) return this.stop();
		this.reconcile(this.board);
		const beats = this.beats(world, fresh, before, this.board);
		if (beats.length > MOST_BEATS) return this.stop();
		// Intensify takes every card flipped so far back onto the deck.
		if (prevStep === 'intensify' && this.step !== 'intensify') {
			this.clear('deck');
			if (discarded > 0 && this.discarded === 0) {
				const shuffle = { key: newest, cards: discarded };
				this.shuffle = shuffle;
				// Gone once it has played, so the deck coming back out next turn does not play it again.
				setTimeout(() => this.shuffle === shuffle && (this.shuffle = null), SHUFFLE_MS);
			}
		} else if (!wasHeld && this.held && !this.playing) this.clear('discard');
		if (beats.length > 0) {
			this.cancelClear();
			this.queue.push(...beats);
			this.hidden = [
				...this.hidden,
				...beats.flatMap(beat => [...beat.strike, ...beat.incidents.flatMap(i => i.hidden)]),
			];
			this.heldIncidents += beats.reduce((sum, beat) => sum + beat.incidents.length, 0);
			if (!this.playing) void this.play(this.run);
			return;
		}
		// The step is over and nothing is left to play, so the cards go and the camera zooms back out to fit.
		if (wasHeld && !this.held && !this.playing) this.clear('discard');
		// The first turn begins with a clear table, whatever of the opening cards is still up.
		if (prevPhase?.startsWith('setup') && phase.startsWith('playing') && (this.playing || this.stack.length > 0))
			this.stop();
	}

	stop() {
		this.cancelClear();
		this.run++;
		this.queue = [];
		this.playing = false;
		this.hidden = [];
		this.heldIncidents = 0;
		this.stack = [];
		this.focus = null;
		this.skull = null;
		this.surge = false;
		this.shuffle = null;
	}

	private clear(exit: 'discard' | 'deck') {
		this.cancelClear();
		this.exit = exit;
		this.stack = [];
		if (!this.playing) this.focus = null;
	}

	private cancelClear() {
		if (this.clearTimer) {
			clearTimeout(this.clearTimer);
			this.clearTimer = null;
		}
	}

	private scheduleClear(delay = 900) {
		this.cancelClear();
		const token = this.run;
		this.clearTimer = setTimeout(() => {
			this.clearTimer = null;
			if (this.run !== token || this.playing || this.held) return;
			this.clear('discard');
		}, delay);
	}

	/** Splits fresh log entries into beats, each holding back the part of the change it shows. */
	private beats(world: World, fresh: LogEntry[], before: Board, after: Board): Beat[] {
		const change: Board = { cities: {}, stockpile: after.stockpile - before.stockpile };
		for (const city of Object.keys(after.cities) as CityId[]) {
			const now = after.cities[city]!;
			const was = before.cities[city] ?? { supplies: 0, plague: 0, hollow: 0 };
			change.cities[city] = {
				supplies: now.supplies - was.supplies,
				plague: now.plague - was.plague,
				hollow: now.hollow - was.hollow,
			};
		}
		// Only what the state really changed can be held back, so the board always ends where the state is.
		const take = (city: CityId | null, piece: Hidden['piece'], want: number): Hidden[] => {
			const have = piece === 'stockpile' ? change.stockpile : (change.cities[city!]?.[piece] ?? 0);
			if (Math.sign(have) !== Math.sign(want)) return [];
			const amount = Math.sign(want) * Math.min(Math.abs(have), Math.abs(want));
			if (piece === 'stockpile') change.stockpile -= amount;
			else change.cities[city!]![piece] -= amount;
			return amount ? [{ city, piece, amount }] : [];
		};
		const beats: Beat[] = [];
		let outbreak: Beat | null = null;
		const left = new Map<CityId, number>();
		const cubesLeft = (city: CityId, taken: number) => {
			const now = (left.get(city) ?? before.cities[city]?.supplies ?? 0) - taken;
			left.set(city, now);
			return now;
		};
		const limit = pack.numbers.incidentLimit;
		for (const entry of fresh) {
			if (entry.t === 'infect' && entry.effect !== 'skipped') {
				const card = world.campaign.infectionCards[entry.card];
				if (!card) continue;
				const strike =
					entry.effect === 'supply'
						? [...take(entry.city, 'supplies', -1), ...take(null, 'stockpile', 1)]
						: entry.effect === 'hollow'
							? take(entry.city, 'hollow', 1)
							: [];
				const pulse = entry.effect === 'supply' ? 'infect' : entry.effect === 'blocked' ? null : entry.effect;
				const beat: Beat = {
					seq: entry.seq,
					effect: entry.effect === 'supply' || entry.effect === 'plague' ? null : entry.effect,
					city: entry.city,
					card,
					strike,
					pulse: pulse === 'plague' ? null : pulse,
					incidents: [],
					stakes: entry.effect === 'supply' && cubesLeft(entry.city, 1) >= 2 ? 'low' : 'close',
				};
				if (entry.effect === 'outbreak') outbreak ??= beat;
				beats.push(beat);
			} else if (entry.t === 'gather') {
				const card = world.campaign.infectionCards[entry.card];
				if (!card) continue;
				beats.push({
					seq: entry.seq,
					effect: 'gather',
					city: null,
					card,
					strike: [],
					pulse: null,
					incidents: [],
					stakes: 'close',
				});
			} else if (entry.t === 'epidemic' && entry.city && entry.card) {
				const card = world.campaign.infectionCards[entry.card];
				if (!card) continue;
				beats.push({
					seq: entry.seq,
					effect: null,
					city: entry.city,
					card,
					strike: [...take(entry.city, 'supplies', -entry.removed), ...take(null, 'stockpile', entry.removed)],
					pulse: 'epidemic',
					incidents: [],
					stakes: 'close',
				});
			} else if (entry.t === 'incident' && beats.length) {
				const beat = beats.at(-1)!;
				beat.incidents.push({ city: entry.city, hidden: take(entry.city, 'plague', 1) });
				if (limit - entry.total < BRINK) beat.stakes = 'brink';
			}
		}
		// An outbreak takes cubes from its neighbours without a log entry for each, so they go with the outbreak.
		if (outbreak)
			for (const city of Object.keys(change.cities) as CityId[]) {
				const lost = change.cities[city]!.supplies;
				if (lost < 0) outbreak.strike.push(...take(city, 'supplies', lost), ...take(null, 'stockpile', -lost));
			}
		return beats;
	}

	private reconcile(board: Board) {
		let changed = false;
		const shown = (entry: Hidden) =>
			(entry.piece === 'stockpile' ? board.stockpile : (board.cities[entry.city!]?.[entry.piece] ?? 0)) -
			this.hidden
				.filter(other => other.piece === entry.piece && other.city === entry.city)
				.reduce((sum, other) => sum + other.amount, 0);
		for (const entry of this.hidden) {
			const deficit = -shown(entry);
			if (entry.amount <= 0 || deficit <= 0) continue;
			entry.amount -= Math.min(entry.amount, deficit);
			changed = true;
		}
		if (changed) this.hidden = [...this.hidden];
	}

	private reveal(entries: Hidden[]) {
		const gone = new Set(entries);
		this.hidden = this.hidden.filter(entry => !gone.has(entry));
	}

	/** Plays every beat that waits, one after another, lingering on each city. */
	private async play(run: number) {
		this.playing = true;
		const wait = (ms: number) => new Promise<boolean>(done => setTimeout(() => done(this.run === run), ms));
		for (;;) {
			const beat = this.queue.shift();
			if (!beat) break;
			const [before, after] = HOLD[beat.stakes === 'brink' || !beat.incidents.length ? beat.stakes : 'incident'];
			const brink = beat.stakes === 'brink';
			this.stack = [{ key: beat.seq, card: beat.card, city: beat.city }, ...this.stack];
			if (beat.city) this.focus = beat.city;
			this.cue({ t: 'flip' });
			if (!(await wait(before))) return;
			this.reveal(beat.strike);
			if (beat.effect) this.cue({ t: 'strike', effect: beat.effect, city: beat.city });
			if (beat.pulse && beat.city) this.pulse(beat.city, beat.pulse);
			for (const incident of beat.incidents) {
				if (incident.city !== this.focus) {
					this.focus = incident.city;
					if (!(await wait(900))) return;
				}
				if (!(await wait(450))) return;
				this.skull = { key: beat.seq, city: incident.city, at: this.lagged(incident.city, 'plague') };
				this.cue({ t: 'skull' });
				if (!(await wait(brink ? 2400 : 1575))) return;
				this.skull = null;
				this.reveal(incident.hidden);
				this.cue({ t: 'plague', city: incident.city });
				this.pulse(incident.city, 'plague');
				if (!(await wait(450))) return;
				this.surge = true;
				if (!(await wait(675))) return;
				this.heldIncidents -= 1;
				this.cue({ t: 'marker', waiting: this.heldIncidents });
				if (!(await wait(2250))) return;
				this.surge = false;
				if (!(await wait(525))) return;
			}
			if (!(await wait(after))) return;
		}
		this.playing = false;
		// The camera stays on the city while more cards are to come, and zooms back out once the step is over.
		if (!this.held) this.scheduleClear(950);
	}

	private lagged(city: CityId, piece: Piece) {
		return (this.board?.cities[city]?.[piece] ?? 0) - (this.lag.cities[city]?.[piece] ?? 0);
	}
}
