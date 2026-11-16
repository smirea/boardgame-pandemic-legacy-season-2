import { pack } from './content/pack';
import type { AbilityId, CityDef, Color, CompanionId, EdgeKind, JobId, RuleId, ScarId } from './content/types';
import type { CardId, CityId, RegionId, SeatId } from './ids';
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
	if (character.job === trait && !character.jobScar) return true;
	if (character.jobScar === trait) return true;
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

/** Whether a straight line between the two locations would cross a line of the same kind already on the board. */
export function crossesEdge(campaign: Campaign, a: CityId, b: CityId, kind: EdgeKind): boolean {
	const from = pack.positions[a]!;
	const to = pack.positions[b]!;
	return campaign.edges.some(
		edge => edge.kind === kind && segmentsCross(from, to, pack.positions[edge.a]!, pack.positions[edge.b]!),
	);
}

const locations = Object.entries(pack.positions) as [CityId, Point][];

/**
 * The location a point on the board belongs to: the nearest one. This one partition is what the
 * rules mean by "unexplored map" and by region boundaries, and it is what the board draws, so a
 * line that looks like it crosses unknown territory or a region line is one the rules refuse.
 */
export function nearestLocation(point: Point): CityId {
	let best = locations[0]![0];
	let closest = Number.POSITIVE_INFINITY;
	for (const [id, at] of locations) {
		const distance = (at.x - point.x) ** 2 + (at.z - point.z) ** 2;
		if (distance < closest) {
			closest = distance;
			best = id;
		}
	}
	return best;
}

export const regionAt = (point: Point): RegionId => cityDef(nearestLocation(point)).region;

const SAMPLES = 48;
const passageCache = new Map<string, { through: CityId[]; regionLines: number }>();

/** What a straight line between two locations passes: every location whose ground it crosses, and how many region lines. */
export function passage(a: CityId, b: CityId): { through: CityId[]; regionLines: number } {
	const key = edgeKey(a, b);
	const known = passageCache.get(key);
	if (known) return known;
	const from = pack.positions[a]!;
	const to = pack.positions[b]!;
	const through: CityId[] = [];
	let regionLines = 0;
	let last: RegionId | null = null;
	for (let step = 0; step <= SAMPLES; step++) {
		const t = step / SAMPLES;
		const owner = nearestLocation({ x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t });
		if (!through.includes(owner)) through.push(owner);
		const region = cityDef(owner).region;
		if (last !== null && region !== last) regionLines += 1;
		last = region;
	}
	const found = { through, regionLines };
	passageCache.set(key, found);
	return found;
}

/** Whether a straight line between the two locations would run over ground no one has revealed yet. */
export const crossesUnexplored = (campaign: Campaign, a: CityId, b: CityId) =>
	passage(a, b).through.some(id => !campaign.locations[id]?.revealed);

export const isCandidate = (a: CityId, b: CityId, kind: EdgeKind) =>
	pack.candidateEdges.some(edge => edge.kind === kind && edgeKey(edge.a, edge.b) === edgeKey(a, b));
