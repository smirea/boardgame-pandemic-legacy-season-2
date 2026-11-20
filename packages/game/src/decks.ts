import type { CardId } from './ids';
import type { RngState } from './rng';
import { shuffle } from './rng';

/**
 * A deck whose exact order is hidden but whose layering is public: every time known cards are
 * shuffled and stacked on top, they form a stratum. Anyone tracking the discard pile at the table
 * knows the strata, so the UI may show them and compute draw odds from them without leaking order.
 */
export type StratifiedDeck = {
	/** Top of the deck first. Never sent to peers. */
	order: CardId[];
	/** Top stratum first. Each stratum is sorted so it carries no order information. */
	strata: CardId[][];
};

export function newDeck(rng: RngState, cards: readonly CardId[]): StratifiedDeck {
	return { order: shuffle(rng, cards), strata: cards.length ? [[...cards].sort()] : [] };
}

function removeFromStratum(deck: StratifiedDeck, stratumIndex: number, card: CardId) {
	const stratum = deck.strata[stratumIndex]!;
	stratum.splice(stratum.indexOf(card), 1);
	if (stratum.length === 0) deck.strata.splice(stratumIndex, 1);
}

export function drawTop(deck: StratifiedDeck): CardId | undefined {
	const card = deck.order.shift();
	if (card !== undefined) removeFromStratum(deck, 0, card);
	return card;
}

export function drawBottom(deck: StratifiedDeck): CardId | undefined {
	const card = deck.order.pop();
	if (card !== undefined) removeFromStratum(deck, deck.strata.length - 1, card);
	return card;
}

export function stackOnTop(deck: StratifiedDeck, rng: RngState, cards: readonly CardId[]) {
	if (cards.length === 0) return;
	deck.order.unshift(...shuffle(rng, cards));
	deck.strata.unshift([...cards].sort());
}

/** Shuffles new cards into the whole deck, which collapses everything known about its layering. */
export function shuffleInto(deck: StratifiedDeck, rng: RngState, cards: readonly CardId[]) {
	const all = [...deck.order, ...cards];
	deck.order = shuffle(rng, all);
	deck.strata = all.length ? [all.sort()] : [];
}

export function removeCard(deck: StratifiedDeck, card: CardId): boolean {
	const index = deck.order.indexOf(card);
	if (index === -1) return false;
	deck.order.splice(index, 1);
	removeFromStratum(
		deck,
		deck.strata.findIndex(stratum => stratum.includes(card)),
		card,
	);
	return true;
}

/**
 * The player deck is dealt into piles with one epidemic shuffled into each, then stacked. The pile
 * sizes and which piles still hold their epidemic are public.
 */
export type PiledDeck = {
	order: CardId[];
	/** Top pile first. */
	piles: { size: number; epidemics: number }[];
};

export function newPiledDeck(rng: RngState, cards: readonly CardId[], epidemics: readonly CardId[]): PiledDeck {
	const shuffled = shuffle(rng, cards);
	const pileCount = Math.max(1, epidemics.length);
	const piles: CardId[][] = Array.from({ length: pileCount }, () => []);
	shuffled.forEach((card, index) => piles[index % pileCount]!.push(card));
	// Larger piles go on top, which is how the tabletop rule stacks uneven piles.
	const stacked = piles.map((pile, index) =>
		shuffle(rng, epidemics[index] === undefined ? pile : [...pile, epidemics[index]]),
	);
	return {
		order: stacked.flat(),
		piles: stacked.map((pile, index) => ({ size: pile.length, epidemics: epidemics[index] === undefined ? 0 : 1 })),
	};
}

export function drawPiled(deck: PiledDeck, isEpidemic: (card: CardId) => boolean): CardId | undefined {
	const card = deck.order.shift();
	if (card === undefined) return undefined;
	const pile = deck.piles[0]!;
	pile.size -= 1;
	if (isEpidemic(card)) pile.epidemics -= 1;
	if (pile.size === 0) deck.piles.shift();
	return card;
}

/** Puts the top cards back in a chosen order, which the table then knows card by card. */
export function restackTop(deck: StratifiedDeck, order: readonly CardId[]) {
	for (const card of order) removeCard(deck, card);
	deck.order.unshift(...order);
	deck.strata.unshift(...order.map(card => [card]));
}
