import type { CityId, InfectionCard, LogEntry, World } from '@repo/game';
import type { FxKind } from '#lib/board/types.ts';

type Piece = 'supplies' | 'plague' | 'hollow';
type Pieces = Record<Piece, number>;
type Board = { cities: Partial<Record<CityId, Pieces>>; stockpile: number };

/** A change the state already holds, kept off the board until its moment in the show comes. */
type Hidden = { city: CityId | null; piece: Piece | 'stockpile'; amount: number };

type Beat = {
	seq: number;
	city: CityId;
	card: InfectionCard;
	note: string;
	strike: Hidden[];
	pulse: FxKind | null;
	incidents: { city: CityId; hidden: Hidden[] }[];
};

export type Lag = { cities: Partial<Record<CityId, Pieces>>; stockpile: number };

const NOTE = {
	supply: 'cube lost',
	plague: 'incident',
	outbreak: 'outbreak',
	hollow: 'Hollow Men',
	blocked: 'held',
} as const;

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
 * Plays each Infection card the game flips as a short scene: the card leaves the deck, the camera finds the city,
 * and the cube comes off. An incident plays slower: a skull rises over the empty city and becomes the plague cube,
 * then the incident track grows and takes its marker. The state is never held back. The board shows it late
 * instead, through `lag`, so players can act while it plays and the scene keeps to what really happened.
 */
export class InfectionShow {
	card = $state.raw<{ key: number; card: InfectionCard; note: string } | null>(null);
	focus = $state.raw<CityId | null>(null);
	skull = $state.raw<{ key: number; city: CityId; at: number } | null>(null);
	/** The incident track is drawn large while a marker goes into it. */
	surge = $state(false);
	/** Incidents the state holds whose marker has not gone onto the track yet. */
	heldIncidents = $state(0);
	private hidden = $state.raw<Hidden[]>([]);
	private queue: Beat[] = [];
	private seen = -1;
	private board: Board | null = null;
	private run = 0;
	private playing = false;

	constructor(private pulse: (city: CityId, kind: FxKind) => void) {}

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
	observe(world: World, live: boolean) {
		const log = world.game?.log ?? [];
		const newest = log.at(-1)?.seq ?? -1;
		const before = this.board;
		this.board = boardOf(world);
		const fresh = log.filter(entry => entry.seq > this.seen);
		const undone = newest < this.seen;
		this.seen = newest;
		if (undone || !live || !before || !this.board) return this.stop();
		this.reconcile(this.board);
		const beats = this.beats(world, fresh, before, this.board);
		if (beats.length === 0) return;
		if (beats.length > MOST_BEATS) return this.stop();
		this.queue.push(...beats);
		this.hidden = [
			...this.hidden,
			...beats.flatMap(beat => [...beat.strike, ...beat.incidents.flatMap(i => i.hidden)]),
		];
		this.heldIncidents += beats.reduce((sum, beat) => sum + beat.incidents.length, 0);
		if (!this.playing) void this.play(this.run);
	}

	stop() {
		this.run++;
		this.queue = [];
		this.playing = false;
		this.hidden = [];
		this.heldIncidents = 0;
		this.card = null;
		this.focus = null;
		this.skull = null;
		this.surge = false;
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
					city: entry.city,
					card,
					note: NOTE[entry.effect],
					strike,
					pulse: pulse === 'plague' ? null : pulse,
					incidents: [],
				};
				if (entry.effect === 'outbreak') outbreak ??= beat;
				beats.push(beat);
			} else if (entry.t === 'epidemic' && entry.city && entry.card) {
				const card = world.campaign.infectionCards[entry.card];
				if (!card) continue;
				beats.push({
					seq: entry.seq,
					city: entry.city,
					card,
					note: 'epidemic',
					strike: [...take(entry.city, 'supplies', -entry.removed), ...take(null, 'stockpile', entry.removed)],
					pulse: 'epidemic',
					incidents: [],
				});
			} else if (entry.t === 'incident' && beats.length) {
				beats.at(-1)!.incidents.push({ city: entry.city, hidden: take(entry.city, 'plague', 1) });
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

	/**
	 * A player can take away what a scene still holds back, such as a Purge on a city whose plague cube has not landed
	 * yet. The scene then shows less, so the board never counts below nothing.
	 */
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

	private async play(run: number) {
		this.playing = true;
		const wait = (ms: number) => new Promise<boolean>(done => setTimeout(() => done(this.run === run), ms));
		while (this.queue.length) {
			const beat = this.queue[0]!;
			const slow = beat.incidents.length > 0;
			this.card = { key: beat.seq, card: beat.card, note: beat.note };
			this.focus = beat.city;
			if (!(await wait(slow ? 700 : 420))) return;
			this.reveal(beat.strike);
			if (beat.pulse) this.pulse(beat.city, beat.pulse);
			for (const incident of beat.incidents) {
				if (incident.city !== this.focus) {
					this.focus = incident.city;
					if (!(await wait(600))) return;
				}
				// The city is seen empty, then a skull rises over it and sinks into the plague cube it becomes.
				if (!(await wait(300))) return;
				this.skull = { key: beat.seq, city: incident.city, at: this.lagged(incident.city, 'plague') };
				if (!(await wait(1050))) return;
				this.skull = null;
				this.reveal(incident.hidden);
				this.pulse(incident.city, 'plague');
				if (!(await wait(300))) return;
				this.surge = true;
				if (!(await wait(450))) return;
				this.heldIncidents -= 1;
				if (!(await wait(1500))) return;
				this.surge = false;
				if (!(await wait(350))) return;
			}
			if (!(await wait(slow ? 300 : 260))) return;
			this.queue.shift();
		}
		this.playing = false;
		this.card = null;
		this.focus = null;
	}

	/** How many of a city's pieces the board shows right now. */
	private lagged(city: CityId, piece: Piece) {
		return (this.board?.cities[city]?.[piece] ?? 0) - (this.lag.cities[city]?.[piece] ?? 0);
	}
}
