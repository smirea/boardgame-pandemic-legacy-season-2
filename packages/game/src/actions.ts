import { pack } from './content/pack';
import type { ActionId, CityDef, CompanionId, EdgeKind, RuleId, SearchResult } from './content/types';
import { drawPiled } from './decks';
import { bump, havensWithHollow, kill, movePawn, setProgress, settleCarried, settleGrid, towerColours } from './flow';
import {
	cardLabel,
	cardValue,
	characterOf,
	cityDef,
	crossesEdge,
	crossesUnexplored,
	discardFromHand,
	grid,
	has,
	hasEdge,
	hasRule,
	isCandidate,
	isForsaken,
	log,
	neighbours,
	overLimit,
	passage,
	player,
	removeFromHand,
	seaRoute,
	reconned,
	breakthrough,
} from './helpers';
import type { CardId, CityId, SeatId } from './ids';
import { isOpen, openSeal } from './legacy';
import type { Campaign, Game, GameLocation, Player, World } from './state';

export type Action =
	| { a: 'drive'; to: CityId; card?: CardId }
	| { a: 'sail'; card: CardId }
	| { a: 'charter'; card: CardId; to: CityId }
	| { a: 'captainSail'; card: CardId; to: CityId }
	| { a: 'makeSupplies' }
	/** `first` lists where cubes go first when the stockpile cannot fill everything. */
	| { a: 'produce'; card: CardId; mode: 'local' | 'system'; first?: CityId[] }
	| { a: 'deliver'; count: number; to?: CityId }
	| { a: 'share'; card: CardId; with: SeatId; give: boolean }
	| { a: 'buildCenter'; cards: CardId[]; laborer?: boolean; moveFrom?: CityId }
	| { a: 'recon'; route: string; cards: CardId[] }
	| { a: 'establishLine'; to: CityId }
	| { a: 'chartLane'; to: CityId }
	| { a: 'search'; card: CardId; box: number }
	| { a: 'shuttle'; to: CityId; card?: CardId }
	| { a: 'buildTower'; moveFrom?: CityId }
	| { a: 'transmit'; card: CardId; to: SeatId }
	| { a: 'monitor'; frequency: number }
	| { a: 'broadcast'; from: CityId; to: CityId }
	| { a: 'buildShelter'; card?: CardId; moveFrom?: CityId }
	| { a: 'administratorMove'; pawn: SeatId; to: SeatId }
	| { a: 'sabotage'; card: CardId; city: CityId }
	| { a: 'broker'; card: CardId; take: CardId }
	| { a: 'trade'; card: CardId; take: CardId }
	| { a: 'carry'; from: CityId; count: number }
	| { a: 'investigate'; card: CardId; take: CardId }
	| { a: 'supply'; card: CardId }
	| { a: 'facilitate'; with: SeatId; card: CardId }
	| { a: 'run'; card: CardId; to: CityId }
	| { a: 'misinform'; to: CityId }
	| { a: 'rehab'; discard: CardId[]; take: CardId }
	| { a: 'coordinate'; pawn: SeatId }
	| { a: 'smuggle'; card: CardId }
	| { a: 'selfInject' }
	| { a: 'pickUp'; count: number }
	| { a: 'transfer'; with: SeatId; count: number; give: boolean }
	| { a: 'inoculate'; card: CardId }
	| { a: 'salvage'; discard: CardId[]; take: CardId }
	| { a: 'destroyInfection'; card: CardId };

type Ctx = {
	world: World;
	campaign: Campaign;
	game: Game;
	seat: SeatId;
	me: Player;
	here: CityId;
	loc: GameLocation;
	def: CityDef;
};

type Spec<A> = {
	/** Actions granted by a job or ability are available without a campaign unlock. */
	trait?: Parameters<typeof has>[2];
	/** Actions that a campaign rule switches on, with no action sticker of their own. */
	rule?: RuleId;
	free?: boolean;
	/** Reveals hidden information, so the turn's undo history ends here. */
	reveals?: boolean;
	cost?: (ctx: Ctx, action: A) => number;
	check: (ctx: Ctx, action: A) => string | null;
	apply: (ctx: Ctx, action: A) => void;
};

const numbers = pack.numbers;
const ok = null;

export const AWAY_FROM_ROUTE = "Stand in the route's city";

function cityCard(ctx: Ctx, id: CardId, where: 'hand' | 'discard' = 'hand') {
	const pile = where === 'hand' ? ctx.me.hand : ctx.game.playerDiscard;
	const card = ctx.campaign.playerCards[id];
	return pile.includes(id) && card?.kind === 'city' ? card : null;
}

const distinct = (ids: CardId[]) => new Set(ids).size === ids.length;
const useOnce = (ctx: Ctx, key: string) => ctx.me.used.push(key);
const unused = (ctx: Ctx, key: string) => !ctx.me.used.includes(key);
const trait = (ctx: Ctx, id: Parameters<typeof has>[2]) => has(ctx.world, ctx.seat, id);

function spendCubes(ctx: Ctx, amount: number) {
	ctx.me.supplies -= amount;
	ctx.game.stockpile += amount;
}

function structureCities(game: Game, kind: 'center' | 'tower' | 'shelter'): CityId[] {
	return (Object.keys(game.locations) as CityId[]).filter(id => game.locations[id]![kind]);
}

function fillTargets(ctx: Ctx, mode: 'local' | 'system', first: CityId[] = []): CityId[] {
	if (mode === 'local') return [ctx.here];
	const onGrid = grid(ctx.campaign);
	const sites = pack.cities
		.filter(city => onGrid.has(city.id) && (city.kind === 'haven' || ctx.game.locations[city.id]!.center))
		.map(city => city.id);
	const chosen = first.filter(city => sites.includes(city));
	return [...new Set([...chosen, ctx.here, ...sites])];
}

const shortfall = (ctx: Ctx, city: CityId) =>
	Math.max(0, ctx.campaign.locations[city]!.population - ctx.game.locations[city]!.supplies);

function centerCost(ctx: Ctx, laborer: boolean) {
	return (
		(laborer ? numbers.costs.center - 1 : numbers.costs.center) -
		(trait(ctx, 'architect') ? 1 : 0) -
		(trait(ctx, 'builder') ? 1 : 0) +
		(trait(ctx, 'buildExtraCard') ? 1 : 0)
	);
}

function edgeCost(ctx: Ctx, kind: EdgeKind) {
	if (kind === 'land')
		return Math.max(
			0,
			numbers.costs.line +
				(trait(ctx, 'lineExtraCube') ? 1 : 0) -
				(trait(ctx, 'lineman') ? 1 : 0) -
				(trait(ctx, 'foreman') ? 1 : 0),
		);
	if (trait(ctx, 'navigator') && unused(ctx, 'navigator')) return 0;
	return numbers.costs.lane + (trait(ctx, 'laneExtraCube') ? 1 : 0);
}

export function checkEdge(
	campaign: Campaign,
	from: CityId,
	to: CityId,
	kind: EdgeKind,
	ignoreRegions = false,
): string | null {
	const target = cityDef(to);
	const origin = cityDef(from);
	if (from === to || !campaign.locations[to]?.revealed) return 'Pick a revealed location';
	if (hasEdge(campaign, from, to)) return 'Those are already joined';
	if (!grid(campaign).has(from)) return 'Start from a location on the grid';
	if (kind === 'land') {
		if (origin.kind !== 'city' || target.kind !== 'city') return 'Supply lines join cities';
		if (!isCandidate(from, to, 'land'))
			return 'No land route between them: a supply line is straight and may not cross water or another city';
		if (crossesUnexplored(campaign, from, to, 'land')) return 'It would cross unexplored map';
		return crossesEdge(campaign, from, to, 'land') ? 'It would cross another supply line' : ok;
	}
	if (!origin.port || !target.port) return 'Sea lanes join ports';
	if (!isCandidate(from, to, 'sea')) return 'No sea route between them: a sea lane may not cross land or another city';
	if (crossesUnexplored(campaign, from, to, 'sea')) return 'It would cross unexplored map';
	if (crossesEdge(campaign, from, to, 'sea')) return 'It would cross another sea lane';
	return ignoreRegions || passage(from, to, 'sea').regionLines <= 1 ? ok : 'A sea lane may cross only one region line';
}

export function addEdge(world: World, a: CityId, b: CityId, kind: EdgeKind, countsForObjective: boolean) {
	const before = grid(world.campaign);
	world.campaign.edges.push({ a, b, kind });
	log(world.game!, { t: 'edge', a, b, kind });
	settleGrid(world, before, countsForObjective);
}

function resolveSearch(ctx: Ctx, result: SearchResult, card: CardId) {
	const { game, campaign } = ctx;
	switch (result.t) {
		case 'supplies': {
			const amount = Math.min(result.amount, game[result.from]);
			game[result.from] -= amount;
			ctx.loc.supplies += amount;
			return;
		}
		case 'stockpile': {
			const amount = Math.min(result.amount, game.reserve);
			game.reserve -= amount;
			game.stockpile += amount;
			return;
		}
		case 'actions':
			game.actionsLeft += result.amount;
			return;
		case 'retrieve':
			if (game.playerDiscard.some(id => campaign.playerCards[id]?.kind !== 'epidemic'))
				game.pending.push({ t: 'retrieve', seat: ctx.seat, filter: 'any' });
			return;
		case 'quarantineCard':
			if (game.infectionDiscard.some(id => campaign.infectionCards[id]?.kind === 'city'))
				game.pending.push({ t: 'quarantineCard', seat: ctx.seat });
			return;
		case 'removeHollow':
			if (Object.values(game.locations).some(location => location.hollow > 0))
				game.pending.push({ t: 'removeHollow', seat: ctx.seat, amount: result.amount });
			return;
		case 'freeEdge':
			game.pending.push({ t: 'freeEdge', seat: ctx.seat, kind: result.kind, ignoreRegions: false });
			return;
		case 'discover':
			if (isOpen(campaign, result.seal)) {
				game.actionsLeft += 1;
				log(game, { t: 'note', text: 'That lead was already followed: 1 extra action this turn' });
			} else openSeal(ctx.world, result.seal, false, ctx.seat);
			return;
		case 'companion': {
			const searched = campaign.playerCards[card]!;
			if (searched.kind === 'city') searched.companion = result.companion;
			return;
		}
		case 'infest':
			if (campaign.locations[ctx.here]!.infested)
				log(game, { t: 'note', text: `${cityDef(ctx.here).name} was already infested, so nothing changes` });
			campaign.locations[ctx.here]!.infested = true;
			if (result.opens) openSeal(ctx.world, result.opens, false, ctx.seat);
			return;
		case 'giveCard':
			if (ctx.me.hand.length && ctx.game.seats.length > 1) game.pending.push({ t: 'giveCard', seat: ctx.seat });
			return;
		case 'nothing':
			return;
	}
}

const specs: { [K in Action['a']]: Spec<Extract<Action, { a: K }>> } = {
	drive: {
		cost: ctx => (trait(ctx, 'helmsman') && unused(ctx, 'helmsman') ? 0 : 1),
		check(ctx, { to, card }) {
			if (!neighbours(ctx.campaign, ctx.here).includes(to)) return 'Not adjacent';
			if (!characterOf(ctx.world, ctx.seat).carrier || cityDef(to).kind === 'haven') return ok;
			const paid = card ? cityCard(ctx, card) : null;
			return paid && cityDef(paid.city).color === cityDef(to).color
				? ok
				: "The carrier must discard a card of the destination's colour";
		},
		apply(ctx, { to, card }) {
			if (trait(ctx, 'helmsman') && unused(ctx, 'helmsman')) useOnce(ctx, 'helmsman');
			if (card && characterOf(ctx.world, ctx.seat).carrier && cityDef(to).kind === 'city')
				discardFromHand(ctx.game, ctx.seat, card);
			movePawn(ctx.world, ctx.seat, to, 'drive');
		},
	},
	sail: {
		check(ctx, { card }) {
			const paid = cityCard(ctx, card);
			if (!paid) return 'Pick a City card from your hand';
			if (!ctx.def.port || !cityDef(paid.city).port) return 'Both ends must be ports';
			return seaRoute(ctx.campaign, ctx.here).has(paid.city) ? ok : 'No sea route reaches that city';
		},
		apply(ctx, { card }) {
			const target = cityCard(ctx, card)!.city;
			discardFromHand(ctx.game, ctx.seat, card);
			movePawn(ctx.world, ctx.seat, target, 'sail');
		},
	},
	charter: {
		check(ctx, { card, to }) {
			if (cityCard(ctx, card)?.city !== ctx.here) return "Discard the card of the city you're in";
			return seaRoute(ctx.campaign, ctx.here).has(to) ? ok : 'No sea route reaches that port';
		},
		apply(ctx, { card, to }) {
			discardFromHand(ctx.game, ctx.seat, card);
			movePawn(ctx.world, ctx.seat, to, 'charter');
		},
	},
	captainSail: {
		trait: 'captain',
		free: true,
		check(ctx, { card, to }) {
			if (!cityCard(ctx, card)) return 'Pick a City card from your hand';
			return seaRoute(ctx.campaign, ctx.here).has(to) ? ok : 'No sea route reaches that port';
		},
		apply(ctx, { card, to }) {
			discardFromHand(ctx.game, ctx.seat, card);
			movePawn(ctx.world, ctx.seat, to, 'sail');
		},
	},
	makeSupplies: {
		check: ctx => (ctx.game[trait(ctx, 'immunologist') ? 'reserve' : 'stockpile'] > 0 ? ok : 'No cubes left to take'),
		apply(ctx) {
			const source = trait(ctx, 'immunologist') ? 'reserve' : 'stockpile';
			ctx.game[source] -= 1;
			ctx.me.supplies += 1;
			if (breakthrough(ctx.campaign, 'opal') && (ctx.def.kind === 'haven' || ctx.loc.center) && ctx.game[source] > 0) {
				ctx.game[source] -= 1;
				ctx.me.supplies += 1;
			}
			if (trait(ctx, 'wasteful') && ctx.game.stockpile > 0) {
				ctx.game.stockpile -= 1;
				ctx.game.reserve += 1;
			}
			if (unused(ctx, 'madeSupplies')) useOnce(ctx, 'madeSupplies');
			useOnce(ctx, 'farmerReady');
		},
	},
	produce: {
		check(ctx, { card, mode }) {
			if (!ctx.me.hand.includes(card) || ctx.campaign.playerCards[card]?.kind !== 'produce')
				return 'Pick a Produce Supplies card';
			if (ctx.def.kind !== 'haven' && !ctx.loc.center) return 'Stand in a haven or a supply center city';
			if (mode === 'system' && ctx.campaign.month === 0)
				return 'System-wide production is not available in the prologue';
			const needed = fillTargets(ctx, mode).reduce((sum, city) => sum + shortfall(ctx, city), 0);
			return needed > 0 && ctx.game.stockpile > 0 ? ok : 'Nothing would be produced';
		},
		apply(ctx, { card, mode, first }) {
			const filled: string[] = [];
			const short: string[] = [];
			for (const city of fillTargets(ctx, mode, first)) {
				const wanted = shortfall(ctx, city);
				const amount = Math.min(wanted, ctx.game.stockpile);
				ctx.game.stockpile -= amount;
				ctx.game.locations[city]!.supplies += amount;
				if (amount > 0) filled.push(`${cityDef(city).name} +${amount}`);
				if (amount < wanted) short.push(cityDef(city).name);
			}
			log(ctx.game, {
				t: 'note',
				text: `Produced: ${filled.join(', ')}${short.length ? `. The stockpile ran out before filling ${short.join(', ')}` : ''}`,
			});
			removeFromHand(ctx.game, ctx.seat, card);
			const produce = ctx.campaign.playerCards[card]!;
			if (mode === 'system' && produce.kind === 'produce' && --produce.boxesLeft <= 0)
				delete ctx.campaign.playerCards[card];
			else ctx.game.playerDiscard.push(card);
		},
	},
	deliver: {
		cost: ctx => (trait(ctx, 'farmer') && ctx.me.used.at(-1) === 'farmerReady' && unused(ctx, 'farmer') ? 0 : 1),
		check(ctx, { count, to }) {
			if (!Number.isInteger(count) || count < 1 || count > ctx.me.supplies) return 'You do not hold that many cubes';
			if (trait(ctx, 'grasping') && ctx.me.supplies - count < 2) return 'This character keeps its last 2 cubes';
			if (!to || to === ctx.here) return ok;
			return trait(ctx, 'courier') && neighbours(ctx.campaign, ctx.here).includes(to)
				? ok
				: 'Deliver to your own location';
		},
		apply(ctx, { count, to }) {
			if (trait(ctx, 'farmer') && ctx.me.used.at(-1) === 'farmerReady' && unused(ctx, 'farmer')) useOnce(ctx, 'farmer');
			ctx.me.supplies -= count;
			ctx.game.locations[to ?? ctx.here]!.supplies += count;
		},
	},
	share: {
		check(ctx, action) {
			const other = ctx.game.players[action.with];
			if (!other || action.with === ctx.seat || other.location !== ctx.here)
				return 'Both pawns must be in the same location';
			const giver = action.give ? ctx.seat : action.with;
			if (!player(ctx.game, giver).hand.includes(action.card)) return 'The giver does not hold that card';
			const card = ctx.campaign.playerCards[action.card];
			if (card?.kind === 'city' && card.city === ctx.here) return ok;
			// The Instructor's own gift, once a turn, may be any card. It is never a way to take one.
			return action.give && trait(ctx, 'instructor') && unused(ctx, 'instructor')
				? ok
				: "Only this city's card can be shared here";
		},
		apply(ctx, action) {
			const card = ctx.campaign.playerCards[action.card];
			if (action.give && !(card?.kind === 'city' && card.city === ctx.here)) useOnce(ctx, 'instructor');
			const [giver, receiver] = action.give ? [ctx.seat, action.with] : [action.with, ctx.seat];
			removeFromHand(ctx.game, giver, action.card);
			player(ctx.game, receiver).hand.push(action.card);
		},
	},
	buildCenter: {
		check(ctx, { cards, laborer = false, moveFrom }) {
			const color = ctx.def.color;
			if (ctx.def.kind !== 'city' || !color) return 'Supply centers go in cities';
			if (ctx.loc.center) return 'This city already has a supply center';
			if (laborer && (!trait(ctx, 'laborer') || ctx.me.supplies < 2))
				return 'The laborer option needs the job and 2 cubes';
			if (!distinct(cards) || !cards.every(card => ctx.me.hand.includes(card))) return 'Pick cards from your hand';
			const values = cards.map(card => cardValue(ctx.campaign, card, color, 'build'));
			const total = values.reduce((sum, value) => sum + value, 0);
			const needed = centerCost(ctx, laborer);
			if (values.includes(0) || total < needed) return `Needs ${needed} ${color} cards`;
			if (total - Math.min(...values) >= needed) return 'That is more cards than needed';
			if (ctx.game.pieces.center > 0) return ok;
			return moveFrom && ctx.game.locations[moveFrom]?.center ? ok : 'Every supply center is placed: pick one to move';
		},
		apply(ctx, { cards, laborer = false, moveFrom }) {
			for (const card of cards) discardFromHand(ctx.game, ctx.seat, card);
			if (laborer) spendCubes(ctx, 2);
			const isNew = ctx.game.pieces.center > 0;
			if (isNew) {
				ctx.game.pieces.center -= 1;
				ctx.game.centersBuilt += 1;
			} else {
				ctx.game.locations[moveFrom!]!.center = false;
			}
			ctx.loc.center = true;
			log(ctx.game, { t: 'structure', city: ctx.here, structure: 'center' });
			if (isNew) {
				bump(ctx.world, 'buildCenters');
				bump(ctx.world, 'prologueCenters');
			}
		},
	},
	recon: {
		reveals: true,
		check(ctx, { route: routeId, cards }) {
			const route = pack.reconRoutes.find(candidate => candidate.id === routeId);
			if (!route || !ctx.campaign.routes.includes(routeId)) return 'That recon route is not known';
			if (ctx.campaign.month === 0) return 'Recon is not available in the prologue';
			if (reconned(ctx.campaign, route)) return 'Already reconned';
			if (route.city !== ctx.here) return AWAY_FROM_ROUTE;
			if (route.needsCenter && !ctx.loc.center && !trait(ctx, 'scout')) return 'The city needs a supply center';
			const needed = Math.max(
				1,
				route.count + (trait(ctx, 'reconExtraCard') ? 1 : 0) - (trait(ctx, 'outrider') ? 1 : 0),
			);
			const values = cards.map(card => (cityCard(ctx, card) ? cardValue(ctx.campaign, card, route.color, 'recon') : 0));
			const total = values.reduce((sum, value) => sum + value, 0);
			// Every card counts, and none is spare: the Double Agent counts as two.
			if (!distinct(cards) || values.includes(0) || total < needed || total - Math.min(...values) >= needed)
				return `Needs ${needed} ${route.color} cards`;
			const paid = cards.map(card => cityCard(ctx, card));
			if (route.unique && new Set(paid.map(card => card!.city)).size !== paid.length)
				return 'Each card must name a different city';
			return ok;
		},
		apply(ctx, { route: routeId, cards }) {
			const route = pack.reconRoutes.find(candidate => candidate.id === routeId)!;
			for (const card of cards) discardFromHand(ctx.game, ctx.seat, card);
			const connectedBefore = ctx.game.connectedThisGame.length;
			if (route.opens) openSeal(ctx.world, route.opens, false, ctx.seat);
			else ctx.campaign.planRecons.push(route.id);
			for (const objective of route.counts) bump(ctx.world, objective);
			const joined = ctx.game.connectedThisGame
				.slice(connectedBefore)
				.filter(city => cityDef(city).kind === 'city').length;
			if (joined) bump(ctx.world, 'connectCities', joined);
		},
	},
	establishLine: {
		check(ctx, { to }) {
			const cost = edgeCost(ctx, 'land');
			return (
				checkEdge(ctx.campaign, ctx.here, to, 'land') ??
				(ctx.me.supplies >= cost ? ok : `Needs ${cost} cubes on your character`)
			);
		},
		apply(ctx, { to }) {
			spendCubes(ctx, edgeCost(ctx, 'land'));
			addEdge(ctx.world, ctx.here, to, 'land', true);
		},
	},
	chartLane: {
		check(ctx, { to }) {
			const cost = edgeCost(ctx, 'sea');
			return (
				checkEdge(ctx.campaign, ctx.here, to, 'sea') ??
				(ctx.me.supplies >= cost ? ok : `Needs ${cost} cubes on your character`)
			);
		},
		apply(ctx, { to }) {
			const cost = edgeCost(ctx, 'sea');
			if (trait(ctx, 'navigator') && unused(ctx, 'navigator')) useOnce(ctx, 'navigator');
			spendCubes(ctx, cost);
			addEdge(ctx.world, ctx.here, to, 'sea', true);
		},
	},
	search: {
		reveals: true,
		cost: ctx => (trait(ctx, 'tracker') ? 0 : 1),
		check(ctx, { card, box }) {
			const held = cityCard(ctx, card) ?? (trait(ctx, 'lookout') ? cityCard(ctx, card, 'discard') : null);
			if (held?.city !== ctx.here) return "Hold this city's card to search here";
			return held.search[box] && !held.search[box].scratched ? ok : 'That search box is used up';
		},
		apply(ctx, { card, box }) {
			const held = ctx.campaign.playerCards[card]!;
			if (held.kind !== 'city') return;
			// The Lookout takes the card out of the discard pile to search it, and keeps it.
			if (!ctx.me.hand.includes(card)) {
				ctx.game.playerDiscard.splice(ctx.game.playerDiscard.indexOf(card), 1);
				ctx.me.hand.push(card);
			}
			const target = held.search[box]!;
			target.scratched = true;
			ctx.game.searches += 1;
			log(ctx.game, { t: 'search', seat: ctx.seat, city: ctx.here, result: target.result.t });
			resolveSearch(ctx, target.result, card);
			bump(ctx.world, 'searches');
			if (trait(ctx, 'searchDiscard') && ctx.me.hand.includes(card)) discardFromHand(ctx.game, ctx.seat, card);
		},
	},
	shuttle: {
		check(ctx, { to, card }) {
			const usable = (city: CityId) =>
				(cityDef(city).kind === 'haven' || ctx.game.locations[city]!.center) && !isForsaken(ctx.campaign, city);
			if (to === ctx.here || !usable(ctx.here) || !usable(to)) return 'Shuttles fly between havens and supply centers';
			if (!grid(ctx.campaign).has(to)) return 'That location is not on the grid';
			const scared = trait(ctx, 'fearOfFlying') && ctx.me.hand.length > 0;
			if (scared && !(card && ctx.me.hand.includes(card))) return 'Fear of Flying: discard a card to fly';
			return !scared && card ? 'No card is needed to fly' : ok;
		},
		apply(ctx, { to, card }) {
			if (card) discardFromHand(ctx.game, ctx.seat, card);
			movePawn(ctx.world, ctx.seat, to, 'shuttle');
		},
	},
	buildTower: {
		check(ctx, { moveFrom }) {
			if (ctx.def.kind !== 'city' || ctx.loc.tower) return 'Pick a city without a tower';
			if (ctx.game.pieces.tower === 0 && !(moveFrom && ctx.game.locations[moveFrom]?.tower))
				return 'Every tower is placed: pick one to move';
			if (ctx.game.pieces.tower > 0 && moveFrom) return 'A tower is still in the box';
			const cost = Math.max(0, numbers.costs.tower - (trait(ctx, 'rigger') ? 1 : 0));
			return ctx.me.supplies >= cost ? ok : `Needs ${cost} cubes on your character`;
		},
		apply(ctx, { moveFrom }) {
			spendCubes(ctx, Math.max(0, numbers.costs.tower - (trait(ctx, 'rigger') ? 1 : 0)));
			if (moveFrom) ctx.game.locations[moveFrom]!.tower = false;
			else ctx.game.pieces.tower -= 1;
			ctx.loc.tower = true;
			log(ctx.game, { t: 'structure', city: ctx.here, structure: 'tower' });
			setProgress(ctx.world, 'triangulate', towerColours(ctx.game));
		},
	},
	transmit: {
		check(ctx, { card, to }) {
			if (!ctx.loc.tower) return 'Stand in a city with a tower';
			if (!ctx.game.players[to] || to === ctx.seat) return 'Pick another player';
			const held = cityCard(ctx, card);
			return held && cityDef(held.city).color === ctx.def.color ? ok : "Send a City card of the tower city's colour";
		},
		apply(ctx, { card, to }) {
			removeFromHand(ctx.game, ctx.seat, card);
			player(ctx.game, to).hand.push(card);
		},
	},
	monitor: {
		reveals: true,
		check(ctx, { frequency }) {
			if (!ctx.loc.tower) return 'Stand in a city with a tower';
			const valid = Number.isInteger(frequency) && frequency >= 0 && frequency < pack.frequencies.length;
			if (!valid || ctx.campaign.frequenciesUsed.includes(frequency)) return 'That frequency is used up';
			return ctx.game.playerDeck.order.length >= 4 ? ok : 'Fewer than 4 Player cards are left';
		},
		apply(ctx, { frequency }) {
			const revealed: CardId[] = [];
			for (let i = 0; i < 4 && ctx.game.playerDeck.order.length > 0; i++)
				revealed.push(drawPiled(ctx.game.playerDeck, card => ctx.campaign.playerCards[card]!.kind === 'epidemic')!);
			ctx.game.playerDiscard.push(...revealed);
			ctx.campaign.frequenciesUsed.push(frequency);
			const reward = pack.frequencies[frequency];
			// Only what this Monitor revealed may be kept, never an older discard.
			const keep =
				reward && 'take' in reward
					? revealed
							.filter(id => ctx.campaign.playerCards[id]!.kind !== 'epidemic')
							.toReversed()
							.slice(0, reward.take)
					: [];
			const names = (cards: CardId[]) => cards.map(id => cardLabel(ctx.campaign, id)).join(', ') || 'nothing';
			log(ctx.game, {
				t: 'note',
				text: `Monitor revealed ${names(revealed)}${keep.length ? `. ${characterOf(ctx.world, ctx.seat).name} kept ${names(keep)}` : ''}. The rest went to the discard pile. An Epidemic revealed this way has no effect`,
			});
			if (reward && 'seal' in reward) openSeal(ctx.world, reward.seal, false, ctx.seat);
			ctx.game.playerDiscard = ctx.game.playerDiscard.filter(id => !keep.includes(id));
			ctx.me.hand.push(...keep);
		},
	},
	broadcast: {
		check(ctx, { from, to }) {
			if (!ctx.loc.tower) return 'Stand in a city with a tower';
			const source = ctx.game.locations[from];
			if (!source || source.hollow === 0 || cityDef(from).color !== ctx.def.color)
				return "Pick Hollow Men in a city of the tower city's colour";
			if (!neighbours(ctx.campaign, from).includes(to)) return 'Move them to an adjacent location';
			return ctx.game.locations[to]!.hollow < numbers.maxHollowPerCity ? ok : 'That location is full';
		},
		apply(ctx, { from, to }) {
			ctx.game.locations[from]!.hollow -= 1;
			ctx.game.locations[to]!.hollow += 1;
			setProgress(ctx.world, 'defect', havensWithHollow(ctx.game));
		},
	},
	buildShelter: {
		check(ctx, { card, moveFrom }) {
			if (ctx.loc.shelter) return 'There is already a shelter here';
			if (ctx.game.pieces.shelter === 0 && !(moveFrom && ctx.game.locations[moveFrom]?.shelter))
				return 'Every shelter is placed: pick one to move';
			if (ctx.game.pieces.shelter > 0 && moveFrom) return 'A shelter is still in the box';
			if (trait(ctx, 'vectorControl')) return ok;
			const held = card ? cityCard(ctx, card) : null;
			return ctx.def.kind === 'city' &&
				held &&
				(trait(ctx, 'quartermaster') || cityDef(held.city).color === ctx.def.color)
				? ok
				: "Discard a City card of this city's colour";
		},
		apply(ctx, { card, moveFrom }) {
			if (card && !trait(ctx, 'vectorControl')) discardFromHand(ctx.game, ctx.seat, card);
			if (moveFrom) ctx.game.locations[moveFrom]!.shelter = false;
			else ctx.game.pieces.shelter -= 1;
			ctx.loc.shelter = true;
			log(ctx.game, { t: 'structure', city: ctx.here, structure: 'shelter' });
		},
	},
	administratorMove: {
		trait: 'administrator',
		check(ctx, { pawn, to }) {
			const moved = ctx.game.players[pawn];
			const target = ctx.game.players[to];
			if (!unused(ctx, 'administrator')) return 'Once per turn';
			if (!moved || !target || moved.location === target.location) return 'Pick two pawns in different locations';
			return characterOf(ctx.world, pawn).carrier ? 'The carrier cannot be moved' : ok;
		},
		apply(ctx, { pawn, to }) {
			useOnce(ctx, 'administrator');
			movePawn(ctx.world, pawn, player(ctx.game, to).location, 'administrator');
		},
	},
	sabotage: {
		trait: 'saboteur',
		check(ctx, { card, city }) {
			const held = cityCard(ctx, card);
			if (!held) return 'Pick a City card from your hand';
			const target = ctx.game.locations[city];
			return target && target.hollow > 0 && cityDef(city).color === cityDef(held.city).color
				? ok
				: "Pick Hollow Men in a city of the card's colour";
		},
		apply(ctx, { card, city }) {
			discardFromHand(ctx.game, ctx.seat, card);
			ctx.game.locations[city]!.hollow -= 1;
			ctx.game.pieces.hollow += 1;
			log(ctx.game, { t: 'note', text: `A Hollow Man was removed from ${cityDef(city).name}` });
		},
	},
	broker: {
		trait: 'broker',
		check(ctx, { card, take }) {
			const paid = cityCard(ctx, card);
			const wanted = cityCard(ctx, take, 'discard');
			return paid && wanted && cityDef(paid.city).color === cityDef(wanted.city).color
				? ok
				: 'Trade for a City card of the same colour';
		},
		apply(ctx, { card, take }) {
			ctx.game.playerDiscard.splice(ctx.game.playerDiscard.indexOf(take), 1);
			discardFromHand(ctx.game, ctx.seat, card);
			ctx.me.hand.push(take);
		},
	},
	trade: {
		trait: 'trader',
		check(ctx, { card, take }) {
			const paid = cityCard(ctx, card);
			const wanted = cityCard(ctx, take, 'discard');
			return paid && wanted && cityDef(paid.city).color === cityDef(wanted.city).color
				? ok
				: 'Trade for a City card of the same colour';
		},
		apply(ctx, { card, take }) {
			ctx.game.playerDiscard.splice(ctx.game.playerDiscard.indexOf(take), 1);
			discardFromHand(ctx.game, ctx.seat, card);
			ctx.me.hand.push(take);
		},
	},
	carry: {
		trait: 'porter',
		free: true,
		check(ctx, { from, count }) {
			if (!unused(ctx, 'porter')) return 'Once per turn';
			if (!neighbours(ctx.campaign, ctx.here).includes(from)) return 'Pick an adjacent location';
			const there = ctx.game.locations[from]?.supplies ?? 0;
			return Number.isInteger(count) && count >= 1 && count <= there ? ok : 'There are not that many cubes there';
		},
		apply(ctx, { from, count }) {
			useOnce(ctx, 'porter');
			ctx.game.locations[from]!.supplies -= count;
			ctx.loc.supplies += count;
		},
	},
	investigate: {
		trait: 'investigator',
		check(ctx, { card, take }) {
			if (!unused(ctx, 'investigator')) return 'Once per turn';
			return ctx.me.hand.includes(card) && cityCard(ctx, take, 'discard')
				? ok
				: 'Discard a card from your hand for a City card in the discard pile';
		},
		apply(ctx, { card, take }) {
			useOnce(ctx, 'investigator');
			ctx.game.playerDiscard.splice(ctx.game.playerDiscard.indexOf(take), 1);
			discardFromHand(ctx.game, ctx.seat, card);
			ctx.me.hand.push(take);
		},
	},
	supply: {
		trait: 'supplier',
		check(ctx, { card }) {
			const held = cityCard(ctx, card);
			if (!unused(ctx, 'supplier')) return 'Once per turn';
			if (!held || !grid(ctx.campaign).has(held.city)) return 'Hold the card of a city on the grid';
			return ctx.game.stockpile > 0 ? ok : 'The stockpile is empty';
		},
		apply(ctx, { card }) {
			useOnce(ctx, 'supplier');
			ctx.game.stockpile -= 1;
			ctx.game.locations[cityCard(ctx, card)!.city]!.supplies += 1;
		},
	},
	smuggle: {
		trait: 'smuggler',
		check(ctx, { card }) {
			const held = cityCard(ctx, card);
			if (!held || !ctx.campaign.locations[held.city]!.revealed) return 'Discard a City card from your hand';
			return ctx.game.reserve > 0 ? ok : 'The reserve is empty';
		},
		apply(ctx, { card }) {
			const { city } = cityCard(ctx, card)!;
			discardFromHand(ctx.game, ctx.seat, card);
			ctx.game.reserve -= 1;
			ctx.game.locations[city]!.supplies += 1;
		},
	},
	coordinate: {
		trait: 'coordinator',
		free: true,
		check(ctx, { pawn }) {
			const moved = ctx.game.players[pawn];
			if (!moved || pawn === ctx.seat || !neighbours(ctx.campaign, ctx.here).includes(moved.location))
				return 'Pick a pawn in an adjacent location';
			return characterOf(ctx.world, pawn).carrier ? 'The carrier cannot be moved' : ok;
		},
		apply: (ctx, { pawn }) => void movePawn(ctx.world, pawn, ctx.here, 'coordinator'),
	},
	facilitate: {
		trait: 'facilitator',
		check(ctx, action) {
			const other = ctx.game.players[action.with];
			if (!unused(ctx, 'facilitator')) return 'Once per turn';
			if (!other || action.with === ctx.seat || other.location !== ctx.here)
				return 'Both pawns must be in the same location';
			return other.hand.includes(action.card) ? ok : 'They do not hold that card';
		},
		apply(ctx, action) {
			useOnce(ctx, 'facilitator');
			removeFromHand(ctx.game, action.with, action.card);
			ctx.me.hand.push(action.card);
		},
	},
	run: {
		trait: 'runner',
		check(ctx, { card, to }) {
			if (!cityCard(ctx, card)) return 'Pick a City card from your hand';
			if (ctx.def.kind !== 'haven' && !ctx.loc.center) return 'Start from a haven or a supply center';
			return to !== ctx.here && grid(ctx.campaign).has(to) ? ok : 'Pick another location on the grid';
		},
		apply(ctx, { card, to }) {
			discardFromHand(ctx.game, ctx.seat, card);
			movePawn(ctx.world, ctx.seat, to, 'run');
		},
	},
	misinform: {
		trait: 'misinformationSpecialist',
		check(ctx, { to }) {
			if (ctx.loc.hollow === 0) return 'No Hollow Men here';
			if (!neighbours(ctx.campaign, ctx.here).includes(to) || cityDef(to).kind !== 'city')
				return 'Pick a neighbouring city';
			return ctx.game.locations[to]!.hollow <= 2 ? ok : 'That city already holds 3 Hollow Men';
		},
		apply(ctx, { to }) {
			ctx.loc.hollow -= 1;
			ctx.game.locations[to]!.hollow += 1;
			log(ctx.game, { t: 'note', text: `A Hollow Man was led from ${ctx.def.name} to ${cityDef(to).name}` });
		},
	},
	rehab: {
		trait: 'rehabNurse',
		check(ctx, { discard, take }) {
			if (discard.length !== 2 || !distinct(discard) || !discard.every(card => ctx.me.hand.includes(card)))
				return 'Discard 2 cards from your hand';
			return ctx.campaign.stored.player.includes(take) && ctx.campaign.playerCards[take]?.kind === 'city'
				? ok
				: 'Pick a stored City card';
		},
		apply(ctx, { discard, take }) {
			for (const card of discard) discardFromHand(ctx.game, ctx.seat, card);
			ctx.campaign.stored.player = ctx.campaign.stored.player.filter(card => card !== take);
			ctx.me.hand.push(take);
		},
	},
	selfInject: {
		rule: 'carrier',
		reveals: true,
		check(ctx) {
			const character = characterOf(ctx.world, ctx.seat);
			if (!hasRule(ctx.campaign, 'carrier') || ctx.here !== pack.sampleFrom) return 'The sample is not here';
			if (character.worker || character.carrier) return 'This character cannot carry the sample';
			if (ctx.campaign.dosesUsed >= numbers.selfInfectDoses) return 'Every dose of the sample is used';
			// The Carrier scar covers 2 slots and may not cover another scar.
			return character.slots.filter(slot => slot?.kind !== 'scar').length >= 2
				? ok
				: 'This character has no room for the Carrier scar, which covers 2 slots';
		},
		apply(ctx) {
			const character = characterOf(ctx.world, ctx.seat);
			ctx.campaign.dosesUsed += 1;
			for (;;) {
				const box = character.exposureTrack[character.exposure] ?? 'skull';
				character.exposure += 1;
				log(ctx.game, { t: 'exposure', seat: ctx.seat, result: box });
				if (box === 'skull') return kill(ctx.world, ctx.seat);
				if (box !== 'scar') continue;
				character.carrier = true;
				log(ctx.game, { t: 'note', text: `${character.name} now carries the sample` });
				// The scar covers 2 slots. Empty ones go first, so an ability is lost only when there is no room.
				const order = character.slots
					.map((slot, index) => ({ slot, index }))
					.filter(entry => entry.slot?.kind !== 'scar')
					.toSorted((a, b) => Number(a.slot !== null) - Number(b.slot !== null))
					.slice(0, 2);
				for (const entry of order) character.slots[entry.index] = { kind: 'scar', id: 'carrier' };
				return;
			}
		},
	},
	pickUp: {
		free: true,
		check: (ctx, { count }) =>
			Number.isInteger(count) && count >= 1 && count <= ctx.loc.supplies ? ok : 'Not that many cubes here',
		apply(ctx, { count }) {
			ctx.loc.supplies -= count;
			ctx.me.supplies += count;
		},
	},
	transfer: {
		free: true,
		check(ctx, action) {
			const other = ctx.game.players[action.with];
			if (!other || action.with === ctx.seat) return 'Pick another player';
			if (other.location !== ctx.here && !trait(ctx, 'radioOperator')) return 'Both pawns must be in the same location';
			const giver = action.give ? ctx.me : other;
			return Number.isInteger(action.count) && action.count >= 1 && action.count <= giver.supplies
				? ok
				: 'The giver does not hold that many cubes';
		},
		apply(ctx, action) {
			const other = player(ctx.game, action.with);
			const [giver, receiver] = action.give ? [ctx.me, other] : [other, ctx.me];
			giver.supplies -= action.count;
			receiver.supplies += action.count;
		},
	},
	inoculate: {
		free: true,
		check(ctx, { card }) {
			if (trait(ctx, 'fearOfNeedles')) return 'Fear of Needles: this character may not Inoculate';
			const asPlayer = ctx.campaign.playerCards[card];
			const asInfection = ctx.campaign.infectionCards[card];
			if (ctx.game.playerDiscard.includes(card) && asPlayer?.kind === 'city' && asPlayer.city === ctx.here) {
				return ctx.campaign.stored.player.length < numbers.storageCap ? ok : 'Storage is full';
			}
			if (ctx.game.infectionDiscard.includes(card) && asInfection?.kind === 'city' && asInfection.city === ctx.here) {
				return ctx.campaign.stored.infection.length < numbers.storageCap ? ok : 'Storage is full';
			}
			return "Pick this city's card from a discard pile";
		},
		apply(ctx, { card }) {
			const pile = ctx.game.playerDiscard.includes(card) ? 'player' : 'infection';
			const discard = pile === 'player' ? ctx.game.playerDiscard : ctx.game.infectionDiscard;
			discard.splice(discard.indexOf(card), 1);
			ctx.campaign.stored[pile].push(card);
			log(ctx.game, {
				t: 'note',
				text: `${ctx.def.name}'s ${pile === 'player' ? 'Player' : 'Infection'} card was inoculated: it is in storage, out of the decks`,
			});
		},
	},
	salvage: {
		trait: 'sanitationOfficer',
		free: true,
		check(ctx, { discard, take }) {
			if (discard.length !== 2 || !distinct(discard) || !discard.every(card => ctx.me.hand.includes(card)))
				return 'Discard 2 cards from your hand';
			const wanted = ctx.campaign.playerCards[take];
			return ctx.game.playerDiscard.includes(take) && (wanted?.kind === 'city' || wanted?.kind === 'produce')
				? ok
				: 'Take a City or Produce Supplies card from the discard pile';
		},
		apply(ctx, { discard, take }) {
			ctx.game.playerDiscard.splice(ctx.game.playerDiscard.indexOf(take), 1);
			for (const card of discard) discardFromHand(ctx.game, ctx.seat, card);
			ctx.me.hand.push(take);
		},
	},
	destroyInfection: {
		trait: 'scientist',
		free: true,
		check(ctx, { card }) {
			const target = ctx.campaign.infectionCards[card];
			if (!unused(ctx, 'scientist')) return 'Once per turn';
			return ctx.game.infectionDiscard.includes(card) && target?.kind === 'city' && target.city === ctx.here
				? ok
				: "Pick this city's Infection card from the discard pile";
		},
		apply(ctx, { card }) {
			useOnce(ctx, 'scientist');
			ctx.game.infectionDiscard.splice(ctx.game.infectionDiscard.indexOf(card), 1);
			delete ctx.campaign.infectionCards[card];
		},
	},
};

function context(world: World, seat: SeatId): Ctx {
	const game = world.game!;
	const me = player(game, seat);
	return {
		world,
		campaign: world.campaign,
		game,
		seat,
		me,
		here: me.location,
		loc: game.locations[me.location]!,
		def: cityDef(me.location),
	};
}

type AnySpec = Spec<Action>;
const specFor = (action: Action) => specs[action.a] as unknown as AnySpec;

export const actionReveals = (action: Action) => specFor(action).reveals ?? false;

export const actionIds = Object.keys(specs) as Action['a'][];

/** Free actions cost nothing from the turn's actions, whatever their details. */
export const isFreeAction = (id: ActionId) => (specs[id] as unknown as AnySpec).free ?? false;

export function actionCost(world: World, seat: SeatId, action: Action): number {
	const spec = specFor(action);
	return spec.free ? 0 : (spec.cost?.(context(world, seat), action) ?? 1);
}

const MOVES = new Set<ActionId>(['sail', 'charter', 'captainSail', 'shuttle', 'run']);

/** A wary character will not walk out of a haven it could have stocked. */
function staysToStock(world: World, seat: SeatId): boolean {
	const me = player(world.game!, seat);
	return (
		has(world, seat, 'wary') &&
		cityDef(me.location).kind === 'haven' &&
		world.game!.locations[me.location]!.supplies === 0 &&
		me.supplies > 0
	);
}

/** Whether the seat's character has this kind of action at all: a job, an ability, or a campaign unlock. */
export function hasAction(world: World, seat: SeatId, id: ActionId): boolean {
	const spec = specs[id] as unknown as AnySpec;
	if (spec.trait) return has(world, seat, spec.trait);
	if (spec.rule) return hasRule(world.campaign, spec.rule);
	return world.campaign.actions.includes(id);
}

/** What stops the seat taking any action of this kind right now, before its details are looked at. */
export function actionGate(world: World, seat: SeatId, id: ActionId): string | null {
	const game = world.game;
	if (!game || game.outcome) return 'No game in progress';
	if (seat !== game.active) return 'Not your turn';
	if (game.pending.length || overLimit(world).length) return 'Resolve the pending choice first';
	if (!specs[id]) return 'Unknown action';
	if (characterOf(world, seat).dead) return 'Choose a new character first';
	if (!hasAction(world, seat, id)) return 'That action is not available';
	if (isForsaken(world.campaign, player(game, seat).location) && id !== 'drive')
		return 'Only Drive or Ferry works in a forsaken city';
	if (characterOf(world, seat).carrier && MOVES.has(id)) return 'The carrier moves only by Drive or Ferry';
	if ((MOVES.has(id) || id === 'drive') && staysToStock(world, seat))
		return 'This character will not leave a haven that holds no cubes while carrying some';
	return null;
}

/** Null when the action is legal for the active player right now, otherwise the reason it is not. */
export function checkAction(world: World, seat: SeatId, action: Action): string | null {
	const gate = actionGate(world, seat, action.a);
	if (gate) return gate;
	if (actionCost(world, seat, action) > world.game!.actionsLeft) return 'No actions left';
	return specFor(action).check(context(world, seat), action);
}

export function applyAction(world: World, seat: SeatId, action: Action) {
	const ctx = context(world, seat);
	const cost = actionCost(world, seat, action);
	ctx.game.actionsLeft -= cost;
	if (action.a !== 'makeSupplies')
		ctx.me.used = ctx.me.used.filter(key => key !== 'farmerReady' || action.a === 'deliver');
	specFor(action).apply(ctx, action);
	if (action.a === 'deliver') ctx.me.used = ctx.me.used.filter(key => key !== 'farmerReady');
	settleCarried(world);
	log(ctx.game, { t: 'action', seat, action: action.a, detail: '' });
}

/** Cubes the seat's character would pay to draw a supply line or sea lane right now. */
export const routeCost = (world: World, seat: SeatId, kind: EdgeKind) => edgeCost(context(world, seat), kind);
