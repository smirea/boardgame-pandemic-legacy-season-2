import { reject } from '@repo/game';
import type { Command, Insights, Phase, PlayerCard, World } from '@repo/game';
import { untrack } from 'svelte';
import type { InfectionShow } from './infectionShow.svelte.ts';
import { TurnShow } from './turnShow.svelte.ts';

/** What winding a turn up reads from the game screen. */
export type TurnAdminSource = {
	readonly world: World;
	readonly phase: Phase;
	readonly info: Insights | null;
	/** This browser plays the active seat. */
	readonly canAct: boolean;
	/** This browser plays no seat, or shows a recording. */
	readonly spectator: boolean;
	/** False for a jump nobody lived through, such as a replay seeking. */
	readonly lived: boolean;
	/** How many Events could be played right now, by anyone. */
	readonly playable: number;
	readonly show: InfectionShow;
	send(command: Command): void;
};

/** How long each step of an Epidemic stays up before the next is taken, so the whole table can follow it. */
const INFECT_AFTER_MS = 2300;
const INTENSIFY_AFTER_MS = 1500;

const SKIP = { type: 'DECIDE', decide: { d: 'skip' } } as const satisfies Command;

/**
 * Everything after a player's actions, in one place on the screen: the Player deck, an Epidemic, then the Infection
 * deck. It says which deck is out, who may take the next card from it, and paces an Epidemic's steps once its player
 * has started it. Create it while a component is being set up: it keeps effects.
 */
export function createTurnAdmin(source: TurnAdminSource) {
	const turn = new TurnShow();
	const game = $derived(source.world.game);
	const step = $derived(game?.pending[0]?.t ?? null);
	const { show } = source;

	$effect.pre(() => {
		const world = source.world;
		const lived = source.lived;
		untrack(() => turn.observe(world, lived));
	});
	$effect(() => () => turn.stop());

	// An Epidemic that was drawn lies beside the deck until its player starts it, or an Antidote answers it.
	const epidemic = $derived.by((): PlayerCard | null => {
		if (!game || step !== 'epidemicDrawn') return null;
		const drawn = game.log.findLast(entry => entry.t === 'draw');
		const card = drawn?.t === 'draw' ? source.world.campaign.playerCards[drawn.card] : undefined;
		return card?.kind === 'epidemic' ? card : null;
	});
	/** True while an Epidemic's steps are being taken, when the desk makes way for them. */
	const resolving = $derived(step === 'epidemicInfect' || step === 'intensify');
	/** The cards that open a game are anyone's to flip: no turn has begun, so no seat is the active one. */
	const opening = $derived(source.phase === 'setup.infect');

	const deck = $derived.by((): 'player' | 'infection' | null => {
		if (!game || resolving) return null;
		if (source.phase === 'playing.draw') return 'player';
		// The last card of a turn is still being played out on the board when the next player's turn has begun.
		if (source.phase === 'playing.infect' || opening || show.playing || show.stack.length > 0) return 'infection';
		return turn.reveals.length > 0 ? 'player' : null;
	});

	// Whose turn is being wound up. The last Infection card is still played out after the next turn has begun, and
	// the desk goes on naming the player who flipped it. Before the first turn it is nobody's.
	let last = untrack(() => game?.active ?? null);
	const seat = $derived.by(() => {
		if (!game || game.turn === 0) return null;
		if (source.phase === 'playing.draw' || source.phase === 'playing.infect') last = game.active;
		return last ?? game.active;
	});

	const allowed = (command: Command) => reject(source.world, source.phase, command) === null;
	const action = $derived.by(() => {
		if (source.spectator || !game || deck === null) return null;
		const busy = turn.busy || show.playing;
		if (!source.canAct && !opening) return null;
		const command: Command = deck === 'player' ? { type: 'DRAW' } : { type: 'INFECT' };
		return allowed(command) ? { busy, onclick: () => source.send(command) } : null;
	});
	const left = $derived(!game ? 0 : deck === 'player' ? game.drawsLeft : game.infectionsLeft);
	const count = $derived.by(() => {
		const { info } = source;
		if (!info) return 0;
		if (deck === 'player') return info.playerDeck.cards;
		return info.infection.opening ? (info.infection.strata[0]?.size ?? 0) : info.infection.deck;
	});

	// The last step waits for its player while an Event or a Lockdown card could still be played before it.
	const held = $derived(
		source.playable > 0 ||
			(game?.infectionDiscard.some(id => {
				const card = source.world.campaign.infectionCards[id];
				return card?.kind === 'city' && card.improvement === 'lockdown';
			}) ??
				false),
	);

	/** Starts the Epidemic that was drawn, or takes its next step now. */
	const advance = () => {
		if (allowed(SKIP)) source.send(SKIP);
	};

	// Once started, the steps follow on their own from the browser of the player whose turn it is.
	$effect(() => {
		if (source.spectator || !source.canAct) return;
		const wait =
			step === 'epidemicInfect'
				? INFECT_AFTER_MS
				: step === 'intensify' && !held && !show.playing
					? INTENSIFY_AFTER_MS
					: null;
		if (wait === null) return;
		const timer = setTimeout(advance, wait);
		return () => clearTimeout(timer);
	});

	return {
		turn,
		/** True while the cards that open a game are flipped, a step that belongs to the whole table. */
		get opening() {
			return opening;
		},
		/** The deck that is out on the desk, or null when the desk is put away. */
		get deck() {
			return deck;
		},
		/** The seat whose turn the desk is winding up, or null while the table opens a game. */
		get seat() {
			return seat;
		},
		get action() {
			return action;
		},
		get left() {
			return left;
		},
		get count() {
			return count;
		},
		get epidemic() {
			return epidemic;
		},
		get held() {
			return held;
		},
		advance,
	};
}
