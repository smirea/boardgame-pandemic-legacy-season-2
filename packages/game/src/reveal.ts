import { pack } from './content/pack';
import { drawPiled } from './decks';
import { log, player } from './helpers';
import type { CardId, SeatId } from './ids';
import { openSeal } from './legacy';
import type { Decision, Game, RevealSource, World } from './state';

export type Reveal = Extract<Decision, { t: 'reveal' }>;

/** Monitor and Cautious Approach both turn over the top 4 Player cards. */
export const REVEAL_COUNT = 4;

/** Holds the table on the top of the Player deck: each card is turned over by a command of its own. */
export function startReveal(game: Game, seat: SeatId, by: RevealSource) {
	// An Event played between an Epidemic's steps comes before the rest of that Epidemic.
	game.pending.unshift({ t: 'reveal', seat, by, cards: [] });
}

/** Whether every card the reveal turns over is face up, so the next command puts them away. */
export const revealDone = (game: Game, reveal: Reveal) =>
	reveal.cards.length >= REVEAL_COUNT || game.playerDeck.order.length === 0;

/** Where each card turned over goes once the reveal is put away, and the door or package it opens. */
export function revealOutcome(world: World, reveal: Reveal): { keep: CardId[]; discard: CardId[] } {
	const { campaign } = world;
	const kind = (id: CardId) => campaign.playerCards[id]?.kind;
	let keep: CardId[];
	if (reveal.by.t === 'scavenge') keep = reveal.cards.filter(id => kind(id) === 'city');
	else {
		const reward = pack.frequencies[reveal.by.frequency];
		// Only what this Monitor revealed may be kept, never an older discard.
		keep =
			reward && 'take' in reward
				? reveal.cards
						.filter(id => kind(id) !== 'epidemic')
						.toReversed()
						.slice(0, reward.take)
				: [];
	}
	return { keep, discard: reveal.cards.filter(id => !keep.includes(id)) };
}

export function stepReveal(world: World, reveal: Reveal) {
	const { campaign } = world;
	const game = world.game!;
	if (!revealDone(game, reveal)) {
		reveal.cards.push(drawPiled(game.playerDeck, id => campaign.playerCards[id]!.kind === 'epidemic')!);
		return;
	}
	game.pending.shift();
	const { keep, discard } = revealOutcome(world, reveal);
	player(game, reveal.seat).hand.push(...keep);
	game.playerDiscard.push(...discard);
	log(game, { t: 'revealed', seat: reveal.seat, by: reveal.by, cards: [...reveal.cards], kept: keep });
	if (reveal.by.t === 'scavenge') return;
	const reward = pack.frequencies[reveal.by.frequency];
	if (reward && 'seal' in reward) openSeal(world, reward.seal, false, reveal.seat);
}
