import { pack } from './content/pack';
import { cityDef, grid } from './helpers';
import type { CardId, CityId } from './ids';
import type { GameSnapshot, Phase } from './machine';
import { phaseOf } from './machine';
import { drawOdds, drawsUntilEpidemicCertain, epidemicOdds, expectedDraws } from './odds';
import type { World } from './state';

export type PublicState = { phase: Phase; world: World; canUndo: boolean };

/**
 * What peers receive and what every screen renders, the host's included. Deck order, the random seed,
 * unscratched exposure boxes, and unscratched search results are stripped. Decks keep their contents
 * as a sorted list, which is what a player could work out by counting cards.
 */
export function publicState(snapshot: GameSnapshot): PublicState {
	const world = structuredClone(snapshot.context.world);
	world.campaign.rng = { seed: 0 };
	for (const character of Object.values(world.campaign.characters))
		character.exposureTrack = character.exposureTrack.slice(0, character.exposure);
	for (const card of Object.values(world.campaign.playerCards)) {
		if (card.kind !== 'city') continue;
		for (const box of card.search) if (!box.scratched) box.result = { t: 'nothing' };
	}
	if (world.game) {
		world.game.playerDeck.order.sort();
		world.game.infectionDeck.order.sort();
	}
	return { phase: phaseOf(snapshot), world, canUndo: snapshot.context.undo.length > 0 };
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
	const rate = rates[game.rateIndex]!;
	const keyOf = (card: CardId) => cityOfInfection(world, card);
	const odds = Object.fromEntries(drawOdds(game.infectionDeck.strata, rate, keyOf)) as Record<CityId, number>;
	const expected = Object.fromEntries(expectedDraws(game.infectionDeck.strata, rate, keyOf)) as Record<CityId, number>;
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
			rate,
			nextRate: rates[Math.min(game.rateIndex + 1, rates.length - 1)]!,
			deck: game.infectionDeck.order.length,
			odds,
			expected,
			strata: game.infectionDeck.strata.map(stratum => ({ size: stratum.length, cities: countCities(world, stratum) })),
			discard: countCities(world, game.infectionDiscard),
			atRisk,
		},
		incidentsLeft: pack.numbers.incidentLimit - game.incidents,
	};
}

export const onGrid = (world: World): CityId[] => [...grid(world.campaign)];
