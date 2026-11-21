import type { CardId, PlayerCard, SeatId, World } from '@repo/game';

/** A drawn Player card turns face up beside the deck, rests there for everyone to read, then goes to its hand. */
export const FLIP_MS = 420;
export const LINGER_MS = 500;
/** Long enough for any flight to land. A card whose flight never reported back is let into its hand then. */
const LANDED_BY_MS = 1600;
/** More draws than this at once is a jump, such as a reload or a replay seeking, and nothing anyone watched. */
const MOST_DRAWS = 4;

export type Reveal = {
	key: number;
	card: PlayerCard;
	seat: SeatId;
	/** Face up beside the deck, then on its way to the hand that drew it. */
	stage: 'shown' | 'leaving';
};

/**
 * The end of a turn as everyone at the table watches it: each Player card drawn is shown beside the deck before it
 * joins a hand, and the next player is announced. It is driven by the log, so the player who draws, the others and
 * a replay all see the same thing. The state is never held back: a hand hides a card only until its flight lands.
 */
export class TurnShow {
	reveals = $state.raw<Reveal[]>([]);
	/** Cards in a hand whose flight there has not landed, which the hand keeps a place for and does not show yet. */
	arriving = $state.raw<ReadonlySet<CardId>>(new Set());
	/** The player whose turn just began, until the announcement has been shown. */
	turn = $state.raw<{ key: number; seat: SeatId } | null>(null);
	/** How many Epidemics have been started while this watched, so the screen can raise its banner at each. */
	struck = $state(0);

	/** True while a card is still face up beside the deck, when the next draw waits. */
	readonly busy = $derived(this.reveals.some(reveal => reveal.stage === 'shown'));

	private seen: number | null = null;
	private step: string | null = null;
	private timers = new Set<ReturnType<typeof setTimeout>>();

	/** Takes in the newest state. `live` is false for a jump that nobody lived through, which only catches up. */
	observe(world: World, live: boolean) {
		const game = world.game;
		const log = game?.log ?? [];
		const newest = log.at(-1)?.seq ?? -1;
		const before = this.seen;
		this.seen = newest;
		const step = game?.pending[0]?.t ?? null;
		const started = this.step === 'epidemicDrawn' && step === 'epidemicInfect';
		this.step = step;
		// The first state seen is where the table already was, and a log that went backwards was undone.
		if (before === null || newest < before || !live || !game) return this.stop();
		if (started) this.struck++;
		const fresh = log.filter(entry => entry.seq > before);
		const draws = fresh.filter(entry => entry.t === 'draw');
		if (draws.length > MOST_DRAWS) return this.stop();
		for (const entry of fresh) {
			if (entry.t === 'turn') this.turn = { key: entry.seq, seat: entry.seat };
			if (entry.t !== 'draw') continue;
			const card = world.campaign.playerCards[entry.card];
			// An Epidemic is no one's card: it lies beside the deck for as long as the state says it waits there.
			if (!card || card.kind === 'epidemic') continue;
			this.reveals = [...this.reveals, { key: entry.seq, card, seat: entry.seat, stage: 'shown' }];
			this.arriving = new Set([...this.arriving, card.id]);
			this.after(FLIP_MS + LINGER_MS, () => {
				this.reveals = this.reveals.map(reveal =>
					reveal.key === entry.seq ? { ...reveal, stage: 'leaving' as const } : reveal,
				);
			});
			this.after(FLIP_MS + LINGER_MS + LANDED_BY_MS, () => this.landed(entry.seq));
		}
	}

	/** The card's flight reached its hand. */
	landed(key: number) {
		const reveal = this.reveals.find(entry => entry.key === key);
		if (!reveal) return;
		this.reveals = this.reveals.filter(entry => entry !== reveal);
		this.arriving = new Set([...this.arriving].filter(card => card !== reveal.card.id));
	}

	/** The announcement of whose turn it is has been shown. */
	announced(key: number) {
		if (this.turn?.key === key) this.turn = null;
	}

	stop() {
		for (const timer of this.timers) clearTimeout(timer);
		this.timers.clear();
		this.reveals = [];
		this.arriving = new Set();
		this.turn = null;
	}

	private after(ms: number, run: () => void) {
		const timer = setTimeout(() => {
			this.timers.delete(timer);
			run();
		}, ms);
		this.timers.add(timer);
	}
}
