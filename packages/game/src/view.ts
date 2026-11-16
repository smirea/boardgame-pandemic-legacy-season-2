import { pack } from './content/pack';
import { cityDef, grid, isForsaken } from './helpers';
import type { CardId, CityId } from './ids';
import type { GameSnapshot, Phase } from './machine';
import { phaseOf } from './machine';
import { drawOdds, drawsUntilEpidemicCertain, epidemicOdds, expectedDraws } from './odds';
import type { World } from './state';

export type PublicState = { phase: Phase; world: World; canUndo: boolean };

/**
 * What every screen renders and what the host broadcasts. It is the whole state: this is a game for
 * a trusted group, so hidden information (deck order, unscratched boxes) is hidden by the UI, and
 * every player holds enough to export a save.
 */
export function publicState(snapshot: GameSnapshot): PublicState {
	return { phase: phaseOf(snapshot), world: snapshot.context.world, canUndo: snapshot.context.undo.length > 0 };
}

export type Insights = {
	playerDeck: {
		cards: number;
		turnsLeft: number;
		epidemicsLeft: number;
		epidemicsDrawn: number;
		/** Chance that the next 2-card draw holds an epidemic. */
		epidemicNextDraw: number;
		/** Draws until the next epidemic must have appeared, or null when none remain. */
		epidemicWithin: number | null;
		byKind: Record<string, number>;
	};
	infection: {
		/** True during setup, when the odds describe the opening infection, not a turn's Infect step. */
		opening: boolean;
		rate: number;
		nextRate: number;
		deck: number;
		/** Chance each city is hit at least once in the next Infect step. */
		odds: Record<CityId, number>;
		expected: Record<CityId, number>;
		/** Top stratum first: the cards known to be in each layer of the deck. */
		strata: { size: number; cities: Record<CityId, number> }[];
		discard: Record<CityId, number>;
		/** Cities that would take a Plague cube or outbreak if hit now, with their odds. */
		atRisk: { city: CityId; odds: number; outbreak: boolean }[];
	};
	incidentsLeft: number;
};

const cityOfInfection = (world: World, card: CardId): CityId | 'hollow' => {
	const found = world.campaign.infectionCards[card];
	return found?.kind === 'city' ? found.city : 'hollow';
};

function countCities(world: World, cards: CardId[]): Record<CityId, number> {
	const counts: Record<string, number> = {};
	for (const card of cards) {
		const city = cityOfInfection(world, card);
		counts[city] = (counts[city] ?? 0) + 1;
	}
	return counts as Record<CityId, number>;
}

export function insights(world: World): Insights | null {
	const game = world.game;
	if (!game) return null;
	const rates = pack.numbers.infectionRates;
	// Before the opening infection the deck is not built yet, but its contents are known: every card of a city on the grid.
	const opening = game.infectionDeck.order.length === 0 && game.infectionDiscard.length === 0 && game.turn === 0;
	const onGridNow = grid(world.campaign);
	const stored = new Set(world.campaign.stored.infection);
	const openingDeck = Object.values(world.campaign.infectionCards)
		.filter(card => card.kind === 'city' && onGridNow.has(card.city) && !stored.has(card.id))
		.map(card => card.id);
	// A forsaken city's card is set aside when it comes up and another is flipped, so it takes no share of the odds.
	const infects = (card: CardId) => {
		const found = world.campaign.infectionCards[card];
		return found?.kind !== 'city' || !isForsaken(world.campaign, found.city);
	};
	const layers = opening ? [openingDeck] : game.infectionDeck.strata;
	const strata = layers.map(stratum => stratum.filter(infects));
	const hollowSetup = world.campaign.rules.includes('hollowSetup');
	const rate = opening ? pack.numbers.setupInfections - (hollowSetup ? 3 : 0) : rates[game.rateIndex]!;
	const keyOf = (card: CardId) => cityOfInfection(world, card);
	const odds = Object.fromEntries(drawOdds(strata, rate, keyOf)) as Record<CityId, number>;
	const expected = Object.fromEntries(expectedDraws(strata, rate, keyOf)) as Record<CityId, number>;
	const byKind: Record<string, number> = {};
	for (const id of game.playerDeck.order) {
		const card = world.campaign.playerCards[id];
		const key = !card ? 'unknown' : card.kind === 'city' ? (cityDef(card.city).color ?? 'city') : card.kind;
		byKind[key] = (byKind[key] ?? 0) + 1;
	}
	const epidemicsLeft = game.playerDeck.piles.reduce((sum, pile) => sum + pile.epidemics, 0);
	const atRisk = (Object.entries(odds) as [CityId | 'hollow', number][])
		.filter(([city, chance]) => city !== 'hollow' && chance > 0 && game.locations[city]!.supplies === 0)
		.map(([city, chance]) => ({
			city: city as CityId,
			odds: chance,
			outbreak: game.locations[city as CityId]!.plague >= pack.numbers.maxPlaguePerCity,
		}))
		.sort((a, b) => b.odds - a.odds);
	return {
		playerDeck: {
			cards: game.playerDeck.order.length,
			turnsLeft: Math.floor(game.playerDeck.order.length / 2),
			epidemicsLeft,
			epidemicsDrawn: game.epidemics,
			epidemicNextDraw: epidemicOdds(game.playerDeck.piles, 2),
			epidemicWithin: drawsUntilEpidemicCertain(game.playerDeck.piles),
			byKind,
		},
		infection: {
			opening,
			rate,
			nextRate: rates[Math.min(game.rateIndex + 1, rates.length - 1)]!,
			deck: game.infectionDeck.order.length,
			odds,
			expected,
			strata: layers.map(stratum => ({ size: stratum.length, cities: countCities(world, stratum) })),
			discard: countCities(world, game.infectionDiscard),
			atRisk,
		},
		incidentsLeft: pack.numbers.incidentLimit - game.incidents,
	};
}

export const onGrid = (world: World): CityId[] => [...grid(world.campaign)];
