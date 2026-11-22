import { reject } from '@repo/game';
import type { Command, Insights, Phase, PlayerCard, SeatId, World } from '@repo/game';
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
	readonly show: InfectionShow;
	send(command: Command): void;
};

/**
 * The next thing the desk asks of its player: a card from the Player deck, an Infection card, the bottom card an
 * Epidemic strikes with, the reshuffle that ends an Epidemic, or passing the turn on.
 */
export type DeskTask = 'draw' | 'flip' | 'bottom' | 'intensify' | 'done';

/** How long the rate marker's move is shown before an Epidemic's bottom card may be drawn. */
const INCREASE_MS = 1200;

const SKIP = { type: 'DECIDE', decide: { d: 'skip' } } as const satisfies Command;

const commandFor = (task: DeskTask, active: SeatId): Command =>
	task === 'draw'
		? { type: 'DRAW' }
		: task === 'flip'
			? { type: 'INFECT' }
			: task === 'done'
				? { type: 'END_TURN', seat: active }
				: SKIP;

/**
 * Everything after a player's actions, in one place on the screen: the Player deck, an Epidemic, the Infection deck,
 * and Done. It says which deck is out, what the next click there does and who may make it. Every step is a command
 * its player sends, so an Event can be played before any of them. Create it while a component is being set up: it
 * keeps effects.
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
	/** The cards that open a game are anyone's to flip: no turn has begun, so no seat is the active one. */
	const opening = $derived(source.phase === 'setup.infect');

	// An Epidemic's first step is done by the time it shows, so it is held up for a beat as the step just taken.
	let increased = $state(-1);
	const increasing = $derived(step === 'epidemicInfect' && increased !== game?.epidemics);
	$effect(() => {
		if (step !== 'epidemicInfect') return;
		const count = game!.epidemics;
		const timer = setTimeout(() => (increased = count), INCREASE_MS);
		return () => clearTimeout(timer);
	});

	const deck = $derived.by((): 'player' | 'infection' | null => {
		if (!game) return null;
		if (step === 'epidemicInfect' || step === 'intensify') return 'infection';
		if (source.phase === 'playing.draw') return 'player';
		// The last card of a turn is still being played out on the board when the next player's turn has begun.
		if (source.phase === 'playing.infect' || opening || show.playing || show.stack.length > 0) return 'infection';
		return turn.reveals.length > 0 ? 'player' : null;
	});

	const task = $derived.by((): DeskTask | null => {
		if (!game || deck === null) return null;
		if (step === 'epidemicInfect') return 'bottom';
		if (step === 'intensify') return 'intensify';
		if (deck === 'player') return source.phase === 'playing.draw' && game.drawsLeft > 0 ? 'draw' : null;
		if (source.phase !== 'playing.infect' && !opening) return null;
		return game.infectionsLeft > 0 ? 'flip' : opening ? null : 'done';
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
		if (source.spectator || !game || !task) return null;
		if (!source.canAct && !opening) return null;
		const command = commandFor(task, game.active);
		if (!allowed(command)) return null;
		// A card still face up beside the deck, or still being played out on the board, is read before the next step.
		return { busy: turn.busy || show.playing || increasing, onclick: () => source.send(command) };
	});
	const left = $derived(!game ? 0 : deck === 'player' ? game.drawsLeft : game.infectionsLeft);
	const count = $derived.by(() => {
		const { info } = source;
		if (!info) return 0;
		if (deck === 'player') return info.playerDeck.cards;
		return info.infection.opening ? (info.infection.strata[0]?.size ?? 0) : info.infection.deck;
	});

	/** Starts the Epidemic that was drawn. */
	const start = () => {
		if (step === 'epidemicDrawn' && allowed(SKIP)) source.send(SKIP);
	};

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
		get task() {
			return task;
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
		/** True for the beat in which an Epidemic that was just started shows the infection rate moving on. */
		get increasing() {
			return increasing;
		},
		start,
	};
}
