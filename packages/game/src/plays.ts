import { addEdge, checkEdge } from './actions';
import { pack } from './content/pack';
import type { ScarId } from './content/types';
import { drawPiled } from './decks';
import { canTakeScar, freeCharacters, movePawn, scarTargets } from './flow';
import { characterOf, cityDef, discardFromHand, grid, handLimit, log, player, removeFromHand } from './helpers';
import type { CardId, CharacterId, CityId, SeatId } from './ids';
import { createCharacter } from './legacy';
import type { Game, World } from './state';

/** Event and companion cards, playable by anyone at any time during a game. */
export type Play =
	| { e: 'airlift'; pawn: SeatId; to: CityId }
	| { e: 'quietNight' }
	| { e: 'resilience'; cards: CardId[] }
	| { e: 'supplyDrop'; city: CityId }
	| { e: 'secondWind' }
	| { e: 'scavenge' }
	| { e: 'openWaters'; a: CityId; b: CityId }
	| { e: 'safeHouses'; cities: CityId[] }
	| { e: 'purge'; city: CityId }
	| { e: 'stockUp' }
	| { e: 'cardSwap'; a: SeatId; cardA: CardId; b: SeatId; cardB: CardId }
	| { e: 'surplus' }
	| { e: 'medic' }
	| { e: 'purifier'; city: CityId }
	| { e: 'shelterWright'; city: CityId }
	| { e: 'marksman'; city: CityId };

const ok = null;
const SUPPLY_DROP = 4;
const STOCK_UP = 6;

function removePlague(game: Game, city: CityId, amount: number) {
	const location = game.locations[city]!;
	location.plague -= Math.min(amount, location.plague);
}

export function checkPlay(world: World, seat: SeatId, card: CardId, play: Play): string | null {
	const { campaign, game } = world;
	if (!game || game.outcome) return 'No game in progress';
	const held = campaign.playerCards[card];
	const owner = game.players[seat];
	if (!owner?.hand.includes(card) || !held) return 'You do not hold that card';
	const id = held.kind === 'event' ? held.event : held.kind === 'companion' ? held.companion : null;
	if (id !== play.e) return 'That card does not do that';
	const onGrid = grid(campaign);
	const here = owner.location;
	switch (play.e) {
		case 'airlift': {
			if (!game.players[play.pawn] || !onGrid.has(play.to) || player(game, play.pawn).location === play.to)
				return 'Pick a pawn and a different location on the grid';
			return characterOf(world, play.pawn).carrier ? 'The carrier cannot be moved' : ok;
		}
		case 'quietNight':
			return game.skipInfection ? 'The next Infect step is already skipped' : ok;
		case 'resilience': {
			const cities = new Set(
				play.cards.map(target => {
					const infection = campaign.infectionCards[target];
					return game.infectionDiscard.includes(target) && infection?.kind === 'city' ? infection.city : null;
				}),
			);
			return play.cards.length >= 1 &&
				play.cards.length <= 2 &&
				new Set(play.cards).size === play.cards.length &&
				cities.size === 1 &&
				!cities.has(null)
				? ok
				: 'Pick 1 or 2 discarded Infection cards of one city';
		}
		case 'supplyDrop':
			return onGrid.has(play.city) && game.reserve > 0 ? ok : 'Pick a location on the grid';
		case 'secondWind':
			return ok;
		case 'scavenge':
			return game.playerDeck.order.length > 0 ? ok : 'The Player deck is empty';
		case 'openWaters':
			return checkEdge(campaign, play.a, play.b, 'sea', true);
		case 'safeHouses': {
			const fresh = play.cities.every(city => game.locations[city] && !game.locations[city].shelter);
			const count = play.cities.length;
			return count >= 1 && count <= 3 && new Set(play.cities).size === count && fresh && game.pieces.shelter >= count
				? ok
				: 'Pick up to 3 locations without a shelter';
		}
		case 'purge':
		case 'purifier':
			return (game.locations[play.city]?.plague ?? 0) > 0 ? ok : 'No Plague cubes there';
		case 'stockUp':
			return game.reserve > 0 ? ok : 'The reserve is empty';
		case 'cardSwap': {
			const first = game.players[play.a];
			const second = game.players[play.b];
			return first &&
				second &&
				play.a !== play.b &&
				first.hand.includes(play.cardA) &&
				second.hand.includes(play.cardB) &&
				play.cardA !== card &&
				play.cardB !== card
				? ok
				: 'Pick one card from each of two players';
		}
		case 'surplus':
			return game.stockpile > 0 ? ok : 'The stockpile is empty';
		case 'medic':
			return game.locations[here]!.plague > 0 ? ok : 'No Plague cubes in your location';
		case 'shelterWright':
			return game.locations[play.city] && !game.locations[play.city].shelter && game.pieces.shelter > 0
				? ok
				: 'Pick a location without a shelter';
		case 'marksman':
			return (game.locations[play.city]?.hollow ?? 0) > 0 ? ok : 'No Hollow Men there';
	}
}

export function applyPlay(world: World, seat: SeatId, card: CardId, play: Play) {
	const { campaign, game } = world as { campaign: World['campaign']; game: Game };
	const held = campaign.playerCards[card]!;
	const owner = player(game, seat);
	removeFromHand(game, seat, card);
	const destroyed = (held.kind === 'event' && held.mode === 'unrationed') || held.kind === 'companion';
	if (destroyed) delete campaign.playerCards[card];
	else game.playerDiscard.push(card);
	if (held.kind === 'event') log(game, { t: 'event', seat, event: held.event, detail: '' });

	switch (play.e) {
		case 'airlift':
			movePawn(world, play.pawn, play.to, 'airlift');
			return;
		case 'quietNight':
			game.skipInfection = true;
			return;
		case 'resilience':
			for (const target of play.cards) {
				game.infectionDiscard.splice(game.infectionDiscard.indexOf(target), 1);
				game.gameEndArea.push(target);
			}
			return;
		case 'supplyDrop': {
			const amount = Math.min(SUPPLY_DROP, game.reserve);
			game.reserve -= amount;
			game.locations[play.city]!.supplies += amount;
			return;
		}
		case 'secondWind':
			game.actionsLeft += 2;
			return;
		case 'scavenge':
			for (let i = 0; i < 4 && game.playerDeck.order.length > 0; i++) {
				const drawn = drawPiled(game.playerDeck, id => campaign.playerCards[id]!.kind === 'epidemic')!;
				if (campaign.playerCards[drawn]!.kind === 'city') owner.hand.push(drawn);
				else game.playerDiscard.push(drawn);
			}
			return;
		case 'openWaters':
			addEdge(world, play.a, play.b, 'sea', true);
			return;
		case 'safeHouses':
			for (const city of play.cities) {
				game.locations[city]!.shelter = true;
				game.pieces.shelter -= 1;
				log(game, { t: 'structure', city, structure: 'shelter' });
			}
			return;
		case 'purge':
		case 'purifier':
			removePlague(game, play.city, pack.numbers.maxPlaguePerCity);
			return;
		case 'stockUp': {
			const amount = Math.min(STOCK_UP, game.reserve);
			game.reserve -= amount;
			game.stockpile += amount;
			return;
		}
		case 'cardSwap':
			removeFromHand(game, play.a, play.cardA);
			removeFromHand(game, play.b, play.cardB);
			player(game, play.a).hand.push(play.cardB);
			player(game, play.b).hand.push(play.cardA);
			return;
		case 'surplus': {
			const amount = Math.min(3, game.stockpile);
			game.stockpile -= amount;
			owner.supplies += amount;
			return;
		}
		case 'medic':
			removePlague(game, owner.location, 1);
			return;
		case 'shelterWright':
			game.locations[play.city]!.shelter = true;
			game.pieces.shelter -= 1;
			log(game, { t: 'structure', city: play.city, structure: 'shelter' });
			return;
		case 'marksman':
			game.locations[play.city]!.hollow -= 1;
			game.pieces.hollow += 1;
			return;
	}
}

/** Answers to the choice at the front of the pending queue, or a hand-limit discard. */
export type Decide =
	| { d: 'discard'; seat: SeatId; cards: CardId[] }
	| { d: 'scar'; scar: ScarId; target: number | 'job' }
	| { d: 'replace'; character: CharacterId | null }
	| { d: 'retrieve'; card: CardId }
	| { d: 'freeEdge'; to: CityId }
	| { d: 'removeHollow'; cities: CityId[] }
	| { d: 'quarantineCard'; card: CardId }
	| { d: 'shield'; seat: SeatId; card: CardId }
	| { d: 'skip' };

const OPTIONAL = new Set(['retrieve', 'freeEdge', 'removeHollow', 'quarantineCard', 'shield']);

export function checkDecide(world: World, decide: Decide): string | null {
	const { campaign, game } = world;
	if (!game || game.outcome) return 'No game in progress';
	const pending = game.pending[0];
	if (decide.d === 'discard') {
		const owner = game.players[decide.seat];
		if (
			!owner ||
			!decide.cards.length ||
			new Set(decide.cards).size !== decide.cards.length ||
			!decide.cards.every(card => owner.hand.includes(card))
		)
			return 'Pick cards from that hand';
		const forced = pending?.t === 'discard' && pending.seat === decide.seat ? pending.count : 0;
		const excess = Math.max(0, owner.hand.length - handLimit(world, decide.seat));
		return decide.cards.length <= Math.max(forced, excess) ? ok : 'That is more than you need to discard';
	}
	if (!pending) return 'Nothing to decide';
	if (decide.d === 'skip') return OPTIONAL.has(pending.t) ? ok : 'This choice cannot be skipped';
	if (decide.d !== pending.t) return 'A different choice is pending';
	switch (decide.d) {
		case 'scar': {
			const character = characterOf(world, (pending as { seat: SeatId }).seat);
			if (!campaign.scars.includes(decide.scar) || decide.scar === 'carrier') return 'That scar is not available';
			return scarTargets(character).includes(decide.target) ? ok : 'A scar cannot go there';
		}
		case 'replace': {
			const free = freeCharacters(world);
			if (decide.character === null) return free.length === 0 ? ok : 'A living character is still free';
			return free.some(character => character.id === decide.character) ? ok : 'That character is not free';
		}
		case 'retrieve': {
			const card = campaign.playerCards[decide.card];
			return game.playerDiscard.includes(decide.card) && card && card.kind !== 'epidemic'
				? ok
				: 'Pick a card from the Player discard pile';
		}
		case 'freeEdge': {
			const seat = (pending as { seat: SeatId }).seat;
			const kind = (pending as { kind: 'land' | 'sea' }).kind;
			return checkEdge(
				campaign,
				player(game, seat).location,
				decide.to,
				kind,
				(pending as { ignoreRegions: boolean }).ignoreRegions,
			);
		}
		case 'removeHollow': {
			const amount = (pending as { amount: number }).amount;
			const counts = new Map<CityId, number>();
			for (const city of decide.cities) counts.set(city, (counts.get(city) ?? 0) + 1);
			const valid = [...counts].every(([city, count]) => (game.locations[city]?.hollow ?? 0) >= count);
			return decide.cities.length >= 1 && decide.cities.length <= amount && valid ? ok : 'Pick Hollow Men on the board';
		}
		case 'quarantineCard':
			return game.infectionDiscard.includes(decide.card) && campaign.infectionCards[decide.card]?.kind === 'city'
				? ok
				: 'Pick a City card from the Infection discard pile';
		case 'shield': {
			const card = campaign.playerCards[decide.card];
			const color = (pending as { color: string }).color;
			return game.players[decide.seat]?.hand.includes(decide.card) &&
				card?.kind === 'city' &&
				cityDef(card.city).color === color
				? ok
				: "Discard a City card of the city's colour";
		}
	}
}

export function applyDecide(world: World, decide: Decide) {
	const { campaign, game } = world as { campaign: World['campaign']; game: Game };
	const pending = game.pending[0];
	if (decide.d === 'discard') {
		for (const card of decide.cards) discardFromHand(game, decide.seat, card);
		if (pending?.t === 'discard' && pending.seat === decide.seat) {
			pending.count -= decide.cards.length;
			if (pending.count <= 0 || player(game, decide.seat).hand.length === 0) game.pending.shift();
		}
		return;
	}
	game.pending.shift();
	if (decide.d === 'skip' || !pending) return;
	const seat = 'seat' in pending ? pending.seat : game.active;
	switch (decide.d) {
		case 'scar': {
			const character = characterOf(world, seat);
			if (decide.target === 'job') character.jobScar = decide.scar;
			else character.slots[decide.target] = { kind: 'scar', id: decide.scar };
			return;
		}
		case 'replace': {
			const current = player(game, seat);
			const next =
				decide.character ??
				createCharacter(campaign, {
					name: 'Haven worker',
					job: null,
					home: pack.cities.find(city => city.kind === 'haven' && !city.lost)!.id,
					worker: true,
				}).id;
			current.character = next;
			current.location = campaign.characters[next]!.home;
			return;
		}
		case 'retrieve':
			game.playerDiscard.splice(game.playerDiscard.indexOf(decide.card), 1);
			player(game, seat).hand.push(decide.card);
			return;
		case 'freeEdge':
			addEdge(world, player(game, seat).location, decide.to, (pending as { kind: 'land' | 'sea' }).kind, true);
			return;
		case 'removeHollow':
			for (const city of decide.cities) {
				game.locations[city]!.hollow -= 1;
				game.pieces.hollow += 1;
			}
			return;
		case 'quarantineCard':
			game.infectionDiscard.splice(game.infectionDiscard.indexOf(decide.card), 1);
			game.gameEndArea.push(decide.card);
			return;
		case 'shield': {
			const city = (pending as { city: CityId }).city;
			discardFromHand(game, decide.seat, decide.card);
			game.locations[city]!.supplies += 1;
			game.stockpile -= 1;
			return;
		}
	}
}

/** A pending scar or replacement the engine can settle without asking, because there is nothing to choose. */
export function autoResolve(world: World) {
	const game = world.game;
	if (!game) return;
	for (;;) {
		const pending = game.pending[0];
		if (!pending) return;
		if (pending.t === 'scar' && !canTakeScar(world, characterOf(world, pending.seat))) game.pending.shift();
		else if (pending.t === 'discard' && player(game, pending.seat).hand.length === 0) game.pending.shift();
		else return;
	}
}
