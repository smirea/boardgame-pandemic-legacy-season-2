import type { Action } from './actions';
import { actionGate, actionIds, checkAction, checkEdge, hasAction, isFreeAction, OUT_OF_REACH } from './actions';
import { pack } from './content/pack';
import type { ActionId, Color, CompanionId, EventId } from './content/types';
import { freeCharacters, scarTargets } from './flow';
import {
	cardValue,
	characterOf,
	cityDef,
	grid,
	handLimit,
	has,
	isHaven,
	neighbours,
	player,
	seaRoute,
	isColor,
} from './helpers';
import type { CardId, CityId, SeatId } from './ids';
import type { Purchase } from './legacy';
import { checkPurchase } from './legacy';
import type { Phase } from './machine';
import type { Decide, Play } from './plays';
import { checkDecide, checkPlay, forecastCards } from './plays';
import type { World } from './state';

function cityCards(world: World, cards: CardId[]) {
	return cards.flatMap(id => {
		const card = world.campaign.playerCards[id];
		return card?.kind === 'city' ? [card] : [];
	});
}

/** The cheapest set of hand cards worth `needed` of a colour, or null when the hand cannot pay. */
export function payColor(
	world: World,
	hand: CardId[],
	color: Color,
	needed: number,
	purpose: 'build' | 'recon',
	unique = false,
): CardId[] | null {
	const valued = hand
		.map(id => ({ id, value: cardValue(world.campaign, id, color, purpose) }))
		.filter(entry => entry.value > 0)
		.sort((a, b) => b.value - a.value);
	const picked: CardId[] = [];
	const seen = new Set<CityId>();
	let total = 0;
	for (const entry of valued) {
		if (total >= needed) break;
		const card = world.campaign.playerCards[entry.id]!;
		if (card.kind !== 'city' || (unique && seen.has(card.city))) continue;
		seen.add(card.city);
		picked.push(entry.id);
		total += entry.value;
	}
	return total >= needed ? picked : null;
}

/**
 * Every way to pay a colour cost with no card wasted: leaving any card out would fall short. Copies
 * of a card that differ in nothing a player could care about count as one way.
 */
export function payments(
	world: World,
	hand: CardId[],
	color: Color,
	needed: number,
	purpose: 'build' | 'recon',
	unique = false,
): CardId[][] {
	const valued = hand.flatMap(id => {
		const card = world.campaign.playerCards[id]!;
		const value = cardValue(world.campaign, id, color, purpose);
		if (card.kind !== 'city' || value === 0) return [];
		const kind = `${card.city}:${card.improvement ?? ''}:${card.companion ?? ''}:${card.search.map(box => (box.scratched ? 'x' : 'o')).join('')}`;
		return [{ id, value, city: card.city, kind }];
	});
	const found = new Map<string, CardId[]>();
	for (let mask = 1; mask < 1 << valued.length; mask++) {
		const picked = valued.filter((_, index) => mask & (1 << index));
		const total = picked.reduce((sum, entry) => sum + entry.value, 0);
		if (total < needed || picked.some(entry => total - entry.value >= needed)) continue;
		if (unique && new Set(picked.map(entry => entry.city)).size !== picked.length) continue;
		const key = picked
			.map(entry => entry.kind)
			.toSorted()
			.join('|');
		if (!found.has(key))
			found.set(
				key,
				picked.map(entry => entry.id),
			);
	}
	return [...found.values()];
}

/** Concrete legal actions for the seat. Card-paying actions offer every payment that wastes no card. */
export function legalActions(world: World, seat: SeatId): Action[] {
	return candidateActions(world, seat).filter(action => checkAction(world, seat, action) === null);
}

/** Every concrete action worth asking the rules about, legal or not. */
function candidateActions(world: World, seat: SeatId): Action[] {
	const { campaign, game } = world;
	if (!game || game.outcome) return [];
	const me = player(game, seat);
	const here = me.location;
	const def = cityDef(here);
	const hand = me.hand;
	const held = cityCards(world, hand);
	const others = game.seats.filter(other => other !== seat);
	const ports = [...seaRoute(campaign, here)];
	const candidates: Action[] = [{ a: 'makeSupplies' }, { a: 'buildTower' }, { a: 'selfInject' }];
	for (const city of Object.keys(game.locations) as CityId[])
		if (game.locations[city]!.tower) candidates.push({ a: 'buildTower', moveFrom: city });

	for (const to of neighbours(campaign, here)) {
		// The carrier pays to enter a city with any card of its colour, so each such card is its own option.
		const tolls = characterOf(world, seat).carrier ? held.filter(card => isColor(card, cityDef(to).color)) : [];
		if (tolls.length === 0) candidates.push({ a: 'drive', to });
		for (const toll of tolls) candidates.push({ a: 'drive', to, card: toll.id });
	}
	for (const card of held) candidates.push({ a: 'sail', card: card.id });
	const tickets = held.filter(card => card.city === here);
	for (const to of ports) {
		for (const ticket of tickets) candidates.push({ a: 'charter', card: ticket.id, to });
		for (const card of held) candidates.push({ a: 'captainSail', card: card.id, to });
	}
	for (const id of hand) {
		if (campaign.playerCards[id]?.kind !== 'produce') continue;
		candidates.push({ a: 'produce', card: id, mode: 'local' }, { a: 'produce', card: id, mode: 'system' });
	}
	if (me.supplies > 0) {
		for (let count = me.supplies; count >= 1; count--) candidates.push({ a: 'deliver', count });
		for (const to of neighbours(campaign, here))
			for (let count = me.supplies; count >= 1; count--) candidates.push({ a: 'deliver', count, to });
	}
	const cubesHere = game.locations[here]!.supplies;
	for (let count = cubesHere; count >= 1; count--) candidates.push({ a: 'pickUp', count });
	for (const other of others) {
		for (let count = me.supplies; count >= 1; count--)
			candidates.push({ a: 'transfer', with: other, count, give: true });
		for (let count = player(game, other).supplies; count >= 1; count--)
			candidates.push({ a: 'transfer', with: other, count, give: false });
		for (const card of hand)
			candidates.push({ a: 'share', card, with: other, give: true }, { a: 'transmit', card, to: other });
		for (const card of player(game, other).hand) candidates.push({ a: 'share', card, with: other, give: false });
		for (const target of others)
			if (target !== other) candidates.push({ a: 'administratorMove', pawn: other, to: target });
		candidates.push(
			{ a: 'administratorMove', pawn: other, to: seat },
			{ a: 'administratorMove', pawn: seat, to: other },
		);
	}
	if (def.color) {
		const centerMoves =
			game.pieces.center > 0
				? [undefined]
				: (Object.keys(game.locations) as CityId[]).filter(id => game.locations[id]!.center);
		for (const moveFrom of centerMoves.length ? centerMoves : [undefined]) {
			for (const laborer of [false, true]) {
				for (let needed = pack.numbers.costs.center + 1; needed >= 1; needed--) {
					for (const cards of payments(world, hand, def.color, needed, 'build'))
						candidates.push({
							a: 'buildCenter',
							cards,
							laborer,
							...(moveFrom ? { moveFrom } : {}),
						});
				}
			}
		}
	}
	// With every shelter placed, one is moved: each placed shelter is a way to build.
	const shelterMoves =
		game.pieces.shelter > 0
			? [undefined]
			: (Object.keys(game.locations) as CityId[]).filter(id => game.locations[id]!.shelter);
	for (const moveFrom of shelterMoves) {
		const moved = moveFrom ? { moveFrom } : {};
		candidates.push({ a: 'buildShelter', ...moved });
		for (const card of held) candidates.push({ a: 'buildShelter', card: card.id, ...moved });
	}
	for (const route of pack.reconRoutes) {
		if (route.city !== here || !campaign.routes.includes(route.id)) continue;
		// Paying nothing is never legal, but its refusal says what this route still needs.
		candidates.push({ a: 'recon', route: route.id, cards: [] });
		for (const count of [route.count - 1, route.count, route.count + 1])
			for (const cards of payments(world, hand, route.color, count, 'recon', route.unique))
				candidates.push({ a: 'recon', route: route.id, cards });
	}
	for (const edge of pack.candidateEdges) {
		const to = edge.a === here ? edge.b : edge.b === here ? edge.a : null;
		if (to) candidates.push({ a: edge.kind === 'land' ? 'establishLine' : 'chartLane', to });
	}
	for (const card of cityCards(world, [...hand, ...game.playerDiscard])) {
		card.search.forEach((_, box) => candidates.push({ a: 'search', card: card.id, box }));
	}
	for (const city of grid(campaign)) {
		candidates.push({ a: 'shuttle', to: city });
		if (has(world, seat, 'fearOfFlying')) for (const card of hand) candidates.push({ a: 'shuttle', to: city, card });
	}
	for (let frequency = 0; frequency < pack.frequencies.length; frequency++)
		candidates.push({ a: 'monitor', frequency });
	for (const id of Object.keys(game.locations) as CityId[]) {
		if (game.locations[id]!.hollow === 0) continue;
		for (const to of neighbours(campaign, id)) candidates.push({ a: 'broadcast', from: id, to });
		for (const card of held) candidates.push({ a: 'sabotage', card: card.id, city: id });
	}
	for (const id of [...game.playerDiscard, ...game.infectionDiscard])
		candidates.push({ a: 'inoculate', card: id }, { a: 'destroyInfection', card: id });
	for (const card of held)
		for (const take of cityCards(world, game.playerDiscard))
			candidates.push({ a: 'broker', card: card.id, take: take.id }, { a: 'trade', card: card.id, take: take.id });
	for (const from of neighbours(campaign, here))
		for (let count = 1; count <= (game.locations[from]?.supplies ?? 0); count++)
			candidates.push({ a: 'carry', from, count });
	if (characterOf(world, seat).job === 'sanitationOfficer')
		for (const [index, first] of hand.entries())
			for (const second of hand.slice(index + 1))
				for (const take of game.playerDiscard) candidates.push({ a: 'salvage', discard: [first, second], take });
	for (const to of neighbours(campaign, here)) candidates.push({ a: 'misinform', to });
	if (has(world, seat, 'rehabNurse'))
		for (const [index, first] of hand.entries())
			for (const second of hand.slice(index + 1))
				for (const take of world.campaign.stored.player)
					candidates.push({ a: 'rehab', discard: [first, second], take });
	for (const card of held) candidates.push({ a: 'supply', card: card.id });
	for (const card of hand)
		for (const take of cityCards(world, game.playerDiscard)) candidates.push({ a: 'investigate', card, take: take.id });
	for (const card of held) for (const to of grid(campaign)) candidates.push({ a: 'run', card: card.id, to });
	for (const other of others) {
		candidates.push({ a: 'coordinate', pawn: other });
		for (const card of player(game, other).hand) candidates.push({ a: 'facilitate', with: other, card });
	}
	for (const card of held) candidates.push({ a: 'smuggle', card: card.id });

	return candidates;
}

/** What a kind of action needs when the seat's situation offers not even one way to try it. */
const NEEDS: Partial<Record<ActionId, string>> = {
	drive: 'No route leads out of here',
	sail: 'Needs a City card in hand',
	charter: 'Needs the card of this port in hand',
	captainSail: 'Needs a City card in hand and a sea route from here',
	produce: 'Needs a Produce Supplies card',
	deliver: 'Carry supply cubes first',
	pickUp: 'No supply cubes here',
	transfer: 'No one holds cubes to pass',
	share: 'No one else at the table',
	buildCenter: 'Not enough City cards of this colour',
	recon: 'No recon route starts here',
	establishLine: 'No supply line can be drawn from here',
	chartLane: 'No sea lane can be charted from here',
	search: 'Needs a City card with a search box',
	broadcast: 'No Hollow Men on the board',
	sabotage: 'Needs a City card and Hollow Men on the board',
	broker: 'Needs a City card in hand and one in the discard pile',
	trade: 'Needs a City card in hand and one in the discard pile',
	carry: 'No supply cubes in adjacent locations',
	investigate: 'Needs a card in hand and a City card in the discard pile',
	misinform: 'No Hollow Men here',
	rehab: 'Needs 2 cards in hand and a stored City card',
	supply: 'Needs a City card in hand',
	run: 'Needs a City card in hand',
	inoculate: 'Nothing in the discard piles',
	destroyInfection: 'Nothing in the discard piles',
	salvage: 'Needs 2 cards in hand and one in the discard pile',
	facilitate: 'No one else holds cards',
	coordinate: 'No other pawn to move',
	smuggle: 'Needs a City card in hand',
	administratorMove: 'No other pawn to move',
};

export type ActionChoice = {
	a: ActionId;
	/** Every legal way to take it right now. */
	actions: Action[];
	/** Why there is none, when `actions` is empty. */
	reason: string | null;
};

function takeable(world: World, seat: SeatId, candidates: Action[]): boolean {
	return candidates.some(
		action => action.a === 'transfer' && !action.give && checkAction(world, seat, action) === null,
	);
}

/** Each kind of action the seat's character has, in rule order, with its legal variants or why it has none. */
export function actionMenu(world: World, seat: SeatId): ActionChoice[] {
	const game = world.game;
	if (!game || game.outcome) return [];
	const candidates = candidateActions(world, seat);
	return actionIds
		.filter(id => hasAction(world, seat, id))
		.map(id => {
			const gate = actionGate(world, seat, id);
			if (gate) return { a: id, actions: [], reason: gate };
			const tried = candidates.filter(action => action.a === id);
			const verdicts = tried.map(action => ({ action, reason: checkAction(world, seat, action) }));
			const actions = verdicts.flatMap(verdict => (verdict.reason === null ? [verdict.action] : []));
			if (actions.length) return { a: id, actions, reason: null };
			if (!isFreeAction(id) && game.actionsLeft === 0) return { a: id, actions, reason: 'No actions left' };
			// Players reach for Pick up to take a cube from someone beside them, which the rules call a Transfer.
			if (id === 'pickUp' && tried.length === 0 && takeable(world, seat, candidates))
				return { a: id, actions, reason: "No supply cubes here. Take a player's with Transfer" };
			// A shortfall ("Needs 2 cubes") comes from a target that was otherwise fine, so it says more than the
			// refusals of targets that were never in reach.
			const shortfalls = verdicts.filter(({ reason }) => reason!.startsWith('Needs '));
			// A pawn standing here was refused for what it holds, which says more than every pawn elsewhere being out of reach.
			const inReach = verdicts.filter(({ reason }) => reason !== OUT_OF_REACH);
			const counts = new Map<string, number>();
			for (const { reason } of shortfalls.length ? shortfalls : inReach.length ? inReach : verdicts)
				counts.set(reason!, (counts.get(reason!) ?? 0) + 1);
			// Of two prices the character could pay (a Laborer's 4 cards and 2 cubes, or 5 cards), the nearer one is the one to show.
			const needs = (reason: string) => Number(/^Needs (\d+)/.exec(reason)?.[1] ?? Infinity);
			const common = [...counts].sort((a, b) => b[1] - a[1] || needs(a[0]) - needs(b[0]))[0]?.[0];
			return { a: id, actions, reason: common ?? NEEDS[id] ?? 'Nothing to do with it here' };
		});
}

/** Every way a card with this effect could be aimed, before the rules filter them. */
function playsOf(world: World, card: CardId, id: EventId | CompanionId): Play[] {
	const { campaign, game } = world as { campaign: World['campaign']; game: NonNullable<World['game']> };
	const onGrid = [...grid(campaign)];
	const allCities = Object.keys(game.locations) as CityId[];
	const onMap = allCities.filter(city => campaign.locations[city]!.revealed);
	const plays: Play[] = [];
	switch (id) {
		case 'airlift':
			for (const pawn of game.seats) for (const to of onMap) plays.push({ e: 'airlift', pawn, to });
			break;
		case 'resilience':
			for (const [index, target] of game.infectionDiscard.entries()) {
				plays.push({ e: 'resilience', cards: [target] });
				for (const second of game.infectionDiscard.slice(index + 1))
					plays.push({ e: 'resilience', cards: [target, second] });
			}
			break;
		case 'handout':
			for (const city of onMap) plays.push({ e: 'handout', cities: [city] });
			break;
		case 'spreadOut':
			for (const from of onGrid)
				if (isHaven(from) && game.locations[from]!.supplies > 0)
					for (const to of onGrid) plays.push({ e: 'spreadOut', from, to: [to] });
			break;
		case 'cleanse':
			for (const city of onGrid) plays.push({ e: 'cleanse', cities: [city] });
			break;
		case 'forecast':
			plays.push({ e: 'forecast', order: forecastCards(game) });
			break;
		case 'cache':
			for (const city of new Set(game.seats.map(other => player(game, other).location)))
				plays.push({ e: 'cache', city });
			break;
		case 'encore':
			for (const target of game.playerDiscard) {
				const event = campaign.playerCards[target]!;
				if (event.kind !== 'event' || event.mode !== 'rationed' || event.event === 'encore') continue;
				for (const played of playsOf(world, target, event.event)) plays.push({ e: 'encore', card: target, played });
			}
			break;
		case 'massInoculation':
			for (const target of game.infectionDiscard) plays.push({ e: 'massInoculation', cards: [target] });
			break;
		case 'exile':
			for (const target of game.infectionDiscard) plays.push({ e: 'exile', cards: [target] });
			break;
		case 'mentor':
			for (const other of game.seats)
				for (const ability of new Set(campaign.abilitiesForSale))
					characterOf(world, other).slots.forEach((_, slot) => plays.push({ e: 'mentor', seat: other, ability, slot }));
			break;
		case 'openWaters':
			for (const edge of pack.candidateEdges)
				if (edge.kind === 'sea') plays.push({ e: 'openWaters', to: edge.a }, { e: 'openWaters', to: edge.b });
			break;
		case 'safeHouses':
		case 'mobileShelters':
			for (const city of onGrid) plays.push({ e: id, cities: [city] });
			break;
		case 'purge':
		case 'purifier':
		case 'shelterWright':
		case 'marksman':
			for (const city of allCities) plays.push({ e: id, city });
			break;
		case 'cardSwap':
			for (const [index, a] of game.seats.entries()) {
				for (const b of game.seats.slice(index + 1)) {
					for (const cardA of player(game, a).hand)
						for (const cardB of player(game, b).hand)
							if (cardA !== card && cardB !== card) plays.push({ e: 'cardSwap', a, cardA, b, cardB });
				}
			}
			break;
		case 'quietNight':
		case 'secondWind':
		case 'scavenge':
		case 'stockUp':
		case 'antidote':
		case 'surplus':
		case 'medic':
		case 'riotControl':
		case 'informant':
			plays.push({ e: id });
			break;
		default:
			break;
	}
	return plays;
}

export function legalPlays(world: World, phase: Phase): { seat: SeatId; card: CardId; play: Play }[] {
	const { campaign, game } = world;
	if (!game || game.outcome) return [];
	const result: { seat: SeatId; card: CardId; play: Play }[] = [];
	for (const seat of game.seats) {
		for (const card of player(game, seat).hand) {
			const held = campaign.playerCards[card]!;
			const id = held.kind === 'event' ? held.event : held.kind === 'city' ? held.companion : null;
			if (!id) continue;
			const plays = playsOf(world, card, id);
			for (const play of plays) {
				if (checkPlay(world, seat, card, play, phase) !== null) continue;
				const repeated =
					play.e === 'openWaters' &&
					result.some(other => other.card === card && other.play.e === 'openWaters' && other.play.to === play.to);
				if (!repeated) result.push({ seat, card, play });
			}
		}
	}
	return result;
}

/** Valid answers to whatever choice is blocking the game, hand-limit discards included. */
export function legalDecides(world: World): Decide[] {
	const { campaign, game } = world;
	if (!game || game.outcome) return [];
	const pending = game.pending[0];
	const candidates: Decide[] = [];
	for (const seat of game.seats) {
		const hand = player(game, seat).hand;
		const forced = pending?.t === 'discard' && pending.seat === seat;
		if (forced || hand.length > handLimit(world, seat))
			for (const card of hand) candidates.push({ d: 'discard', seat, cards: [card] });
	}
	if (pending) {
		candidates.push({ d: 'skip' });
		switch (pending.t) {
			case 'scar':
				for (const seat of pending.seat ? [pending.seat] : game.seats) {
					for (const scar of new Set(campaign.scars)) {
						for (const target of scarTargets(characterOf(world, seat)))
							candidates.push({ d: 'scar', scar, target, ...(pending.seat ? {} : { seat }) });
					}
				}
				break;
			case 'replace':
				candidates.push({ d: 'replace', character: null });
				for (const character of freeCharacters(world)) candidates.push({ d: 'replace', character: character.id });
				break;
			case 'retrieve':
				for (const card of game.playerDiscard) candidates.push({ d: 'retrieve', card });
				break;
			case 'freeEdge':
				for (const city of Object.keys(game.locations) as CityId[]) {
					if (
						checkEdge(campaign, player(game, pending.seat).location, city, pending.kind, pending.ignoreRedLines) ===
						null
					)
						candidates.push({ d: 'freeEdge', to: city });
				}
				break;
			case 'removeHollow':
				for (const city of Object.keys(game.locations) as CityId[])
					if (game.locations[city]!.hollow > 0) candidates.push({ d: 'removeHollow', cities: [city] });
				break;
			case 'quarantineCard':
				for (const card of game.infectionDiscard) candidates.push({ d: 'quarantineCard', card });
				break;
			case 'giveCard':
				for (const card of player(game, pending.seat).hand)
					for (const to of game.seats) if (to !== pending.seat) candidates.push({ d: 'giveCard', card, to });
				break;
			case 'shield':
				for (const seat of game.seats)
					for (const card of player(game, seat).hand) candidates.push({ d: 'shield', seat, card });
				break;
			case 'cordon':
				for (const seat of game.seats)
					for (const card of player(game, seat).hand) candidates.push({ d: 'cordon', seat, card });
				break;
			case 'discard':
				break;
		}
	}
	return candidates.filter(decide => checkDecide(world, decide) === null);
}

/** Everything the group could buy right now in the game-end step. */
export function legalPurchases(world: World): Purchase[] {
	const { campaign } = world;
	const onGrid = [...grid(campaign)];
	const candidates: Purchase[] = [];
	for (const character of Object.values(campaign.characters)) {
		for (const ability of new Set(campaign.abilitiesForSale)) {
			character.slots.forEach((_, slot) => candidates.push({ t: 'ability', ability, character: character.id, slot }));
		}
	}
	for (const improvement of new Set(campaign.cityImprovementsForSale)) {
		for (const card of Object.keys(campaign.playerCards) as CardId[])
			candidates.push({ t: 'cityImprovement', improvement, card });
	}
	for (const improvement of new Set(campaign.infectionImprovementsForSale)) {
		for (const card of Object.keys(campaign.infectionCards) as CardId[])
			candidates.push({ t: 'infectionImprovement', improvement, card });
	}
	for (const city of onGrid) {
		candidates.push({ t: 'population', city, steps: 1 }, { t: 'restore', city });
		for (const structure of new Set(campaign.permanentForSale)) candidates.push({ t: 'permanent', structure, city });
	}
	return candidates.filter(purchase => checkPurchase(world, purchase) === null);
}

export function cardTargets(world: World, phase: Phase, card: CardId): { cities: CityId[]; seats: SeatId[] } {
	const held = world.campaign.playerCards[card];
	const infection = world.campaign.infectionCards[card];
	const cities = new Set<CityId>();
	const seats = new Set<SeatId>();
	if (held?.kind === 'city') cities.add(held.city);
	if (infection?.kind === 'city') cities.add(infection.city);
	if (held?.kind === 'produce' && world.game) {
		for (const city of pack.cities)
			if (grid(world.campaign).has(city.id) && (city.kind === 'haven' || world.game.locations[city.id]?.center))
				cities.add(city.id);
	}
	if (held?.kind === 'event' || (held?.kind === 'city' && held.companion)) {
		for (const entry of legalPlays(world, phase)) {
			if (entry.card !== card) continue;
			const play = entry.play;
			switch (play.e) {
				case 'secondWind':
				case 'scavenge':
					seats.add(world.game!.active);
					break;
				case 'riotControl':
				case 'informant':
					cities.add('utopia' as CityId);
					break;
				case 'surplus':
					seats.add(entry.seat);
					break;
				case 'medic':
					cities.add(world.game!.players[entry.seat]!.location);
					break;
				case 'airlift':
					seats.add(play.pawn);
					break;
				case 'cardSwap':
					seats.add(play.a);
					seats.add(play.b);
					break;
				case 'cache':
				case 'purge':
				case 'purifier':
				case 'shelterWright':
				case 'marksman':
					cities.add(play.city);
					break;
				case 'safeHouses':
				case 'mobileShelters':
				case 'handout':
				case 'cleanse':
					for (const city of play.cities) cities.add(city);
					break;
				case 'spreadOut':
					cities.add(play.from);
					for (const city of play.to) cities.add(city);
					break;
				case 'openWaters':
					cities.add(world.game!.players[world.game!.active]!.location);
					cities.add(play.to);
					break;
				case 'mentor':
					seats.add(play.seat);
					break;
				case 'antidote':
					seats.add(entry.seat);
					break;
				case 'resilience':
				case 'massInoculation':
				case 'exile':
					for (const id of play.cards) {
						const infection = world.campaign.infectionCards[id];
						if (infection?.kind === 'city') cities.add(infection.city);
					}
					break;
			}
		}
	}
	return { cities: [...cities].filter(city => world.campaign.locations[city]?.revealed), seats: [...seats] };
}
