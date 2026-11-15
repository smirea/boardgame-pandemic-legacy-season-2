import type { Action } from './actions';
import { checkAction, checkEdge } from './actions';
import { pack } from './content/pack';
import type { Color } from './content/types';
import { freeCharacters, scarTargets } from './flow';
import { cardValue, characterOf, cityDef, grid, handLimit, neighbours, player, seaRoute } from './helpers';
import type { CardId, CityId, SeatId } from './ids';
import type { Decide, Play } from './plays';
import { checkDecide, checkPlay } from './plays';
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

/** Concrete legal actions for the seat. Card-paying actions offer one sensible payment, not every combination. */
export function legalActions(world: World, seat: SeatId): Action[] {
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

	for (const to of neighbours(campaign, here)) {
		const toll = held.find(card => cityDef(card.city).color === cityDef(to).color);
		candidates.push({ a: 'drive', to, ...(characterOf(world, seat).carrier && toll ? { card: toll.id } : {}) });
	}
	for (const card of held) candidates.push({ a: 'sail', card: card.id });
	const ticket = held.find(card => card.city === here);
	for (const to of ports) {
		if (ticket) candidates.push({ a: 'charter', card: ticket.id, to });
		if (held[0]) candidates.push({ a: 'captainSail', card: held[0].id, to });
	}
	for (const id of hand) {
		if (campaign.playerCards[id]?.kind !== 'produce') continue;
		candidates.push({ a: 'produce', card: id, mode: 'local' }, { a: 'produce', card: id, mode: 'system' });
	}
	if (me.supplies > 0) {
		candidates.push({ a: 'deliver', count: me.supplies });
		if (me.supplies > 1) candidates.push({ a: 'deliver', count: 1 });
		for (const to of neighbours(campaign, here)) candidates.push({ a: 'deliver', count: me.supplies, to });
	}
	const cubesHere = game.locations[here]!.supplies;
	if (cubesHere > 0) candidates.push({ a: 'pickUp', count: cubesHere }, { a: 'pickUp', count: 1 });
	for (const other of others) {
		if (me.supplies > 0) candidates.push({ a: 'transfer', with: other, count: me.supplies, give: true });
		const theirs = player(game, other).supplies;
		if (theirs > 0) candidates.push({ a: 'transfer', with: other, count: theirs, give: false });
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
		for (const laborer of [false, true]) {
			for (let needed = pack.numbers.costs.center; needed >= 2; needed--) {
				const cards = payColor(world, hand, def.color, needed, 'build');
				if (!cards) continue;
				const moveFrom = (Object.keys(game.locations) as CityId[]).find(
					id => game.locations[id]!.center && !campaign.locations[id]!.permanent.includes('center'),
				);
				candidates.push({
					a: 'buildCenter',
					cards,
					laborer,
					...(game.pieces.center === 0 && moveFrom ? { moveFrom } : {}),
				});
			}
		}
		const shelterCard = held.find(card => cityDef(card.city).color === def.color);
		if (shelterCard) candidates.push({ a: 'buildShelter', card: shelterCard.id });
	}
	candidates.push({ a: 'buildShelter' });
	for (const route of pack.reconRoutes) {
		if (route.city !== here || !campaign.routes.includes(route.id)) continue;
		for (const count of [route.count - 1, route.count, route.count + 1]) {
			const cards = payColor(world, hand, route.color, count, 'recon', route.unique);
			if (cards?.length === count) candidates.push({ a: 'recon', route: route.id, cards });
		}
	}
	for (const edge of pack.candidateEdges) {
		const to = edge.a === here ? edge.b : edge.b === here ? edge.a : null;
		if (to) candidates.push({ a: edge.kind === 'land' ? 'establishLine' : 'chartLane', to });
	}
	for (const card of cityCards(world, [...hand, ...game.playerDiscard])) {
		card.search.forEach((_, box) => candidates.push({ a: 'search', card: card.id, box }));
	}
	for (const city of grid(campaign)) candidates.push({ a: 'shuttle', to: city });
	for (let frequency = 0; frequency < pack.frequencies.length; frequency++)
		candidates.push({ a: 'monitor', frequency });
	for (const id of Object.keys(game.locations) as CityId[]) {
		if (game.locations[id]!.hollow === 0) continue;
		for (const to of neighbours(campaign, id)) candidates.push({ a: 'broadcast', from: id, to });
		for (const card of held) candidates.push({ a: 'sabotage', card: card.id, city: id });
	}
	for (const id of [...game.playerDiscard, ...game.infectionDiscard])
		candidates.push({ a: 'inoculate', card: id }, { a: 'destroyInfection', card: id });
	if (held[0])
		for (const take of cityCards(world, game.playerDiscard).slice(0, 6))
			candidates.push({ a: 'broker', card: held[0].id, take: take.id });
	if (hand.length >= 2 && game.playerDiscard[0])
		candidates.push({ a: 'salvage', discard: hand.slice(0, 2), take: game.playerDiscard.at(-1)! });

	return candidates.filter(action => checkAction(world, seat, action) === null);
}

export function legalPlays(world: World): { seat: SeatId; card: CardId; play: Play }[] {
	const { campaign, game } = world;
	if (!game || game.outcome) return [];
	const onGrid = [...grid(campaign)];
	const allCities = Object.keys(game.locations) as CityId[];
	const result: { seat: SeatId; card: CardId; play: Play }[] = [];
	for (const seat of game.seats) {
		for (const card of player(game, seat).hand) {
			const held = campaign.playerCards[card]!;
			const id = held.kind === 'event' ? held.event : held.kind === 'companion' ? held.companion : null;
			if (!id) continue;
			const plays: Play[] = [];
			switch (id) {
				case 'airlift':
					for (const pawn of game.seats) for (const to of onGrid) plays.push({ e: 'airlift', pawn, to });
					break;
				case 'resilience':
					for (const target of game.infectionDiscard) plays.push({ e: 'resilience', cards: [target] });
					break;
				case 'supplyDrop':
					for (const city of onGrid) plays.push({ e: 'supplyDrop', city });
					break;
				case 'openWaters':
					for (const edge of pack.candidateEdges)
						if (edge.kind === 'sea')
							plays.push({ e: 'openWaters', a: edge.a, b: edge.b }, { e: 'openWaters', a: edge.b, b: edge.a });
					break;
				case 'safeHouses':
					for (const city of onGrid) plays.push({ e: 'safeHouses', cities: [city] });
					break;
				case 'purge':
				case 'purifier':
				case 'shelterWright':
				case 'marksman':
					for (const city of allCities) plays.push({ e: id, city });
					break;
				case 'cardSwap':
					for (const a of game.seats) {
						for (const b of game.seats) {
							const cardA = player(game, a).hand.find(other => other !== card);
							const cardB = player(game, b).hand.find(other => other !== card);
							if (a !== b && cardA && cardB) plays.push({ e: 'cardSwap', a, cardA, b, cardB });
						}
					}
					break;
				case 'quietNight':
				case 'secondWind':
				case 'scavenge':
				case 'stockUp':
				case 'surplus':
				case 'medic':
					plays.push({ e: id });
					break;
				default:
					break;
			}
			for (const play of plays) if (checkPlay(world, seat, card, play) === null) result.push({ seat, card, play });
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
				for (const scar of campaign.scars)
					for (const target of scarTargets(characterOf(world, pending.seat)))
						candidates.push({ d: 'scar', scar, target });
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
						checkEdge(campaign, player(game, pending.seat).location, city, pending.kind, pending.ignoreRegions) === null
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
			case 'shield':
				for (const seat of game.seats)
					for (const card of player(game, seat).hand) candidates.push({ d: 'shield', seat, card });
				break;
			case 'discard':
				break;
		}
	}
	return candidates.filter(decide => checkDecide(world, decide) === null);
}
