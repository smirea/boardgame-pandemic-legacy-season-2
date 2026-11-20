import { pack } from './content/pack';
import { cityDef, grid, isForsaken, reconned, sealDef, unlocksBehind } from './helpers';
import type { CardId, CityId } from './ids';
import { AWAY_FROM_ROUTE, type Action } from './actions';
import type { ReconRoute } from './content/types';
import type { GameSnapshot, Phase } from './machine';
import { phaseOf, reject } from './machine';
import { legalActions } from './options';
import { drawOdds, drawsUntilEpidemicCertain, epidemicOdds, expectedDraws } from './odds';
import type { PlayerCard, World } from './state';
import type { Color } from './content/types';

export type PublicState = { phase: Phase; world: World; canUndo: boolean };

/**
 * What every screen renders and what the host broadcasts. It is the whole state: this is a game for
 * a trusted group, so hidden information (deck order, unscratched boxes) is hidden by the UI, and
 * every player holds enough to export a save.
 */
export function publicState(snapshot: GameSnapshot): PublicState {
	return { phase: phaseOf(snapshot), world: snapshot.context.world, canUndo: snapshot.context.undo.length > 0 };
}

export type PlayerDeckKind = Color | 'haven' | Exclude<PlayerCard['kind'], 'city'>;

export type PlayerCardsAt = { inDeck: number; inHands: number; discarded: number };

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
		/** City cards by region colour (havens have none), every other card by its kind. */
		byKind: Partial<Record<PlayerDeckKind, number>>;
		/** Where each city's player cards are: still in the deck, in someone's hand, or discarded. */
		cities: Record<CityId, PlayerCardsAt>;
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

function playerCardsByCity(world: World): Record<CityId, PlayerCardsAt> {
	const game = world.game!;
	const counts: Record<string, PlayerCardsAt> = {};
	const tally = (cards: CardId[], where: keyof PlayerCardsAt) => {
		for (const id of cards) {
			const card = world.campaign.playerCards[id];
			if (card?.kind !== 'city') continue;
			const at = (counts[card.city] ??= { inDeck: 0, inHands: 0, discarded: 0 });
			at[where]++;
		}
	};
	tally(game.playerDeck.order, 'inDeck');
	for (const seat of game.seats) tally(game.players[seat]!.hand, 'inHands');
	tally(game.playerDiscard, 'discarded');
	return counts as Record<CityId, PlayerCardsAt>;
}

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
	const byKind: Partial<Record<PlayerDeckKind, number>> = {};
	for (const id of game.playerDeck.order) {
		const card = world.campaign.playerCards[id]!;
		const key = card.kind === 'city' ? (cityDef(card.city).color ?? 'haven') : card.kind;
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
			cities: playerCardsByCity(world),
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

/** A recon route still to be taken, as the board prints it beside its city. */
export type ReconBox = {
	route: ReconRoute;
	/** The region the recon reveals, or the package's name when it reveals none. */
	name: string;
	/** The locations it reveals, so the box can point at them. */
	reveals: CityId[];
	/** Every legal recon of this route for the active player, one per payment. Empty when it cannot be taken now. */
	actions: Extract<Action, { a: 'recon' }>[];
	/**
	 * Why it cannot be taken now, from the engine, or null when it can or when the only reason is where the player
	 * stands: the box already prints its city, so it does not say so twice.
	 */
	reason: string | null;
};

const unlessAway = (reason: string | null) => (reason === AWAY_FROM_ROUTE ? null : reason);

/** Each recon route the players know and have not yet taken, at a city they can see. */
export function reconBoxes(world: World, phase: Phase): ReconBox[] {
	const { campaign, game } = world;
	if (!game) return [];
	const here = game.players[game.active]!.location;
	// Listing every legal action is costly, and a route can only be taken from its own city.
	const legal =
		phase === 'playing.actions' && pack.reconRoutes.some(route => route.city === here)
			? legalActions(world, game.active)
			: [];
	return pack.reconRoutes.flatMap(route => {
		if (!campaign.routes.includes(route.id) || reconned(campaign, route)) return [];
		if (!campaign.locations[route.city]?.revealed) return [];
		const inside = route.opens ? unlocksBehind(route.opens) : [];
		const regions = inside.flatMap(unlock => (unlock.t === 'region' ? [unlock.region] : []));
		const havens = new Set(inside.flatMap(unlock => (unlock.t === 'haven' ? [unlock.city] : [])));
		const actions = legal.filter(
			(action): action is ReconBox['actions'][number] => action.a === 'recon' && action.route === route.id,
		);
		const probe: Action = { a: 'recon', route: route.id, cards: [] };
		return [
			{
				route,
				name: regions.length
					? pack.regions.find(region => region.id === regions[0])!.name
					: route.opens
						? sealDef(route.opens).name
						: 'The Plan',
				reveals: pack.cities
					.filter(city => (regions.includes(city.region) && !city.lost) || havens.has(city.id))
					.filter(city => !campaign.locations[city.id]?.revealed)
					.map(city => city.id),
				actions,
				reason: actions.length
					? null
					: unlessAway(reject(world, phase, { type: 'ACTION', seat: game.active, action: probe })),
			},
		];
	});
}
