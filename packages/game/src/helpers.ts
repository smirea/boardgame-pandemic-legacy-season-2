import { pack } from './content/pack';
import type { AbilityId, CityDef, Color, CompanionId, EdgeKind, JobId, RuleId, ScarId } from './content/types';
import type { CardId, CityId, SeatId } from './ids';
import { edgeKey } from './ids';
import type { Campaign, Character, Game, LogInput, Player, PlayerCard, World } from './state';

const cityIndex = new Map(pack.cities.map(city => [city.id, city]));

export function cityDef(id: CityId): CityDef {
	const city = cityIndex.get(id);
	if (!city) throw new Error(`unknown city ${id}`);
	return city;
}

export const isHaven = (id: CityId) => cityDef(id).kind === 'haven';
export const hasRule = (campaign: Campaign, rule: RuleId) => campaign.rules.includes(rule);

export function neighbours(campaign: Campaign, city: CityId, kind?: EdgeKind): CityId[] {
	const result: CityId[] = [];
	for (const edge of campaign.edges) {
		if (kind && edge.kind !== kind) continue;
		if (edge.a === city) result.push(edge.b);
		else if (edge.b === city) result.push(edge.a);
	}
	return result;
}

export const hasEdge = (campaign: Campaign, a: CityId, b: CityId) =>
	campaign.edges.some(edge => edgeKey(edge.a, edge.b) === edgeKey(a, b));

function reach(campaign: Campaign, from: CityId[], kind?: EdgeKind): Set<CityId> {
	const seen = new Set(from);
	const queue = [...from];
	while (queue.length) {
		for (const next of neighbours(campaign, queue.pop()!, kind)) {
			if (seen.has(next)) continue;
			seen.add(next);
			queue.push(next);
		}
	}
	return seen;
}

/** Every location with a path of supply lines and sea lanes back to a starting haven. */
export function grid(campaign: Campaign): Set<CityId> {
	return reach(
		campaign,
		pack.cities.filter(city => city.kind === 'haven' && !city.lost).map(city => city.id),
	);
}

/** Ports joined to `from` by a chain of sea lanes. */
export function seaRoute(campaign: Campaign, from: CityId): Set<CityId> {
	const ports = reach(campaign, [from], 'sea');
	ports.delete(from);
	return ports;
}

export const isForsaken = (campaign: Campaign, city: CityId) =>
	hasRule(campaign, 'forsaken') && cityDef(city).kind === 'city' && campaign.locations[city]!.population === 0;

export function gridCityCount(campaign: Campaign): number {
	return [...grid(campaign)].filter(id => cityDef(id).kind === 'city' && campaign.locations[id]!.population > 0).length;
}

export const player = (game: Game, seat: SeatId): Player => {
	const found = game.players[seat];
	if (!found) throw new Error(`no player in seat ${seat}`);
	return found;
};

export const characterOf = (world: World, seat: SeatId): Character =>
	world.campaign.characters[player(world.game!, seat).character]!;

type Trait = JobId | AbilityId | CompanionId | ScarId;

/** Whether a job, ability, scar, or held companion currently applies to the seat's character. */
export function has(world: World, seat: SeatId, trait: Trait): boolean {
	const character = characterOf(world, seat);
	if (character.job === trait && !character.jobCovered) return true;
	if (character.slots.some(slot => slot?.id === trait)) return true;
	return player(world.game!, seat).hand.some(id => {
		const card = world.campaign.playerCards[id];
		return card?.kind === 'companion' && card.companion === trait;
	});
}

export function handLimit(world: World, seat: SeatId): number {
	return pack.numbers.handLimit + (has(world, seat, 'recordKeeper') ? 1 : 0) - (has(world, seat, 'smallHand') ? 1 : 0);
}

export const overLimit = (world: World): SeatId[] =>
	world.game!.seats.filter(seat => player(world.game!, seat).hand.length > handLimit(world, seat));

export function playerCard(campaign: Campaign, id: CardId): PlayerCard {
	const card = campaign.playerCards[id];
	if (!card) throw new Error(`unknown player card ${id}`);
	return card;
}

/** How many cards of `color` this card is worth when paying a colour cost. Wild improvements match any colour. */
export function cardValue(campaign: Campaign, id: CardId, color: Color, purpose: 'build' | 'recon'): number {
	const card = playerCard(campaign, id);
	if (card.kind !== 'city') return 0;
	if (card.improvement === 'wild') return 1;
	if (card.improvement === 'redWild' && color === 'red') return 1;
	if (cityDef(card.city).color !== color) return 0;
	if (purpose === 'build' && card.improvement === 'double') return 2;
	if (purpose === 'build' && card.improvement === 'triple') return 3;
	return 1;
}

export function log(game: Game, entry: LogInput) {
	game.log.push({ ...entry, seq: game.nextSeq++ } as Game['log'][number]);
	if (game.log.length > 400) game.log.splice(0, game.log.length - 400);
}

export function removeFromHand(game: Game, seat: SeatId, card: CardId) {
	const hand = player(game, seat).hand;
	const index = hand.indexOf(card);
	if (index === -1) throw new Error(`card ${card} is not in the hand of ${seat}`);
	hand.splice(index, 1);
}

export function discardFromHand(game: Game, seat: SeatId, card: CardId) {
	removeFromHand(game, seat, card);
	game.playerDiscard.push(card);
}

type Point = { x: number; z: number };

const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

/** Proper intersection only: segments that merely share an endpoint do not cross. */
export function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
	const d1 = cross(c, d, a);
	const d2 = cross(c, d, b);
	const d3 = cross(a, b, c);
	const d4 = cross(a, b, d);
	return d1 * d2 < 0 && d3 * d4 < 0;
}

export function crossesSupplyLine(campaign: Campaign, a: CityId, b: CityId): boolean {
	const from = pack.positions[a]!;
	const to = pack.positions[b]!;
	return campaign.edges.some(
		edge => edge.kind === 'land' && segmentsCross(from, to, pack.positions[edge.a]!, pack.positions[edge.b]!),
	);
}

export const isCandidate = (a: CityId, b: CityId, kind: EdgeKind) =>
	pack.candidateEdges.some(edge => edge.kind === kind && edgeKey(edge.a, edge.b) === edgeKey(a, b));
