import { pack } from './content/pack';
import type {
	AbilityId,
	CityDef,
	Color,
	CompanionId,
	EdgeKind,
	JobId,
	ReconRoute,
	RuleId,
	ScarId,
	Seal,
	SealDef,
	Unlock,
} from './content/types';
import { sealKey } from './content/types';
import type { CardId, CharacterId, CityId, GroundId, RegionId, UnchartedId, SeatId } from './ids';
import { edgeKey } from './ids';
import { redLineCrossings } from './lanes';
import type {
	Campaign,
	Character,
	ExposureBox,
	Game,
	InfectionCard,
	LogInput,
	Player,
	PlayerCard,
	SearchBox,
	World,
} from './state';

const cityIndex = new Map(pack.cities.map(city => [city.id, city]));

export function cityDef(id: CityId): CityDef {
	const city = cityIndex.get(id);
	if (!city) throw new Error(`unknown city ${id}`);
	return city;
}

export const isHaven = (id: CityId) => cityDef(id).kind === 'haven';

export function sealDef(seal: Seal): SealDef {
	const key = sealKey(seal);
	const def = pack.seals.find(candidate => sealKey(candidate.seal) === key);
	if (!def) throw new Error(`nothing is behind ${key}`);
	return def;
}

/** Everything a package or door holds, with what the doors it opens hold in turn, rewards included. */
export function unlocksBehind(seal: Seal, seen = new Set<string>()): Unlock[] {
	const key = sealKey(seal);
	if (seen.has(key)) return [];
	seen.add(key);
	const def = sealDef(seal);
	return [...def.unlocks, ...(def.reward ?? [])].flatMap(unlock =>
		unlock.t === 'open' ? [unlock, ...unlocksBehind(unlock.seal, seen)] : [unlock],
	);
}

/** Whether a recon has been done: what it opens is open, or, for a step of the Plan, the step is checked off. */
export const reconned = (campaign: Campaign, route: ReconRoute) =>
	route.opens ? campaign.opened.includes(sealKey(route.opens)) : campaign.planRecons.includes(route.id);
export const hasRule = (campaign: Campaign, rule: RuleId) => campaign.rules.includes(rule);

/** The labs whose breakthroughs door 13 explains, by the city each stands in. */
export const LABS = { opal: 'buenos-aires', jade: 'johannesburg', topaz: 'wellington' } as const;
/** A lab's breakthrough holds once the lab is found and door 13 has explained the breakthroughs. */
export const breakthrough = (campaign: Campaign, lab: keyof typeof LABS) =>
	hasRule(campaign, 'labBreakthroughs') && campaign.locations[LABS[lab] as CityId]?.lab === true;

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

export const SEAT_IDS = ['seat-1', 'seat-2', 'seat-3', 'seat-4'] as SeatId[];

/**
 * The seats the table has filled for the next game, in seat order. A seat whose character has since
 * died is empty again. A group that has chosen nothing yet is given its first two living characters.
 */
export function tableSeating(campaign: Campaign): Campaign['seating'] {
	const living = (id: CharacterId) => {
		const character = campaign.characters[id];
		return Boolean(character && !character.dead && !character.worker);
	};
	const chosen = campaign.seating
		.filter(entry => entry.character === null || living(entry.character))
		.toSorted((a, b) => SEAT_IDS.indexOf(a.seat) - SEAT_IDS.indexOf(b.seat));
	if (chosen.length) return chosen;
	const first = (Object.keys(campaign.characters) as CharacterId[]).filter(living).slice(0, 2);
	return first.length === 2 ? first.map((character, index) => ({ seat: SEAT_IDS[index]!, character })) : [];
}

/**
 * Who sat in `seat` when the log entry numbered `seq` was written: the next character to die in
 * that seat, or whoever sits there now. A log line about a dead character keeps that character's name.
 */
export function characterAt(world: World, seat: SeatId, seq: number): Character | undefined {
	const game = world.game;
	if (!game) return undefined;
	const death = game.log.find(entry => entry.t === 'death' && entry.seat === seat && entry.seq >= seq);
	const id = death?.t === 'death' ? death.character : game.players[seat]?.character;
	return id ? world.campaign.characters[id] : undefined;
}

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
		return card?.kind === 'city' && card.companion === trait;
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

/** Door 50 holds this many Infested stickers. Once they are gone, no new city becomes infested. */
export const INFESTED_STICKERS = 21;

/** Marks a city infested with one of door 50's stickers, while any are left. Printed infestations need none. */
export function infest(campaign: Campaign, city: CityId) {
	const record = campaign.locations[city]!;
	if (record.infested) return;
	const used = pack.cities.filter(entry => !entry.startsInfested && campaign.locations[entry.id]!.infested).length;
	if (used < INFESTED_STICKERS) record.infested = true;
}

/** Whether a City card has a printed improvement slot (non-search City cards, excluding Utopia). */
export const hasCityImprovementSlot = (card: PlayerCard): boolean =>
	card.kind === 'city' && card.search.length === 0 && card.city !== ('utopia' as CityId);

/** Whether a City card can currently receive a City Card Improvement sticker. */
export const canImproveCityCard = (card: PlayerCard): boolean =>
	card.kind === 'city' && hasCityImprovementSlot(card) && card.improvement === null;

/** Whether an Infection card has a printed improvement slot (City cards, excluding Utopia). */
export const hasInfectionImprovementSlot = (card: InfectionCard): boolean =>
	card.kind === 'city' && card.city !== ('utopia' as CityId);

/** Whether an Infection card can currently receive an Infection Card Improvement sticker. */
export const canImproveInfectionCard = (card: InfectionCard): boolean =>
	card.kind === 'city' && hasInfectionImprovementSlot(card) && card.improvement === null;

/** The companion revealed on a search City card from its scratched search boxes, if any. */
export function searchCardCompanion(search: readonly SearchBox[]): CompanionId | null {
	for (const box of search) {
		if (box.scratched && box.result.t === 'companion') return box.result.companion;
	}
	return null;
}

/** Every card shows the same number of boxes, so the boxes past the one that kills are blank and never reached. */
export const paddedTrack = (layout: readonly ExposureBox[]): ExposureBox[] => [
	...layout,
	...Array<ExposureBox>(Math.max(0, pack.numbers.exposureBoxes - layout.length)).fill('empty'),
];

const characterTrackKeys = pack.characterCards.map(layout => paddedTrack(layout).join(','));

/** Canonical index (`0..9`) in `pack.characterCards` for any padded or unpadded exposure track, or -1 if unknown. */
export function characterCardIndex(track: readonly ExposureBox[]): number {
	return characterTrackKeys.indexOf(paddedTrack(track).slice(0, pack.numbers.exposureBoxes).join(','));
}

/** Whether a City card counts as `color`. Local Operatives also makes it red, for every purpose. */
export const isColor = (card: { city: CityId; improvement: string | null }, color: Color | null) =>
	cityDef(card.city).color === color || (card.improvement === 'redWild' && color === 'red');

/** How many cards of `color` this card is worth when paying a colour cost. Wild improvements match any colour. */
export function cardValue(campaign: Campaign, id: CardId, color: Color, purpose: 'build' | 'recon'): number {
	const card = playerCard(campaign, id);
	if (card.kind !== 'city') return 0;
	if (card.improvement === 'wild') return 1;
	if (card.improvement === 'redWild' && color === 'red') return 1;
	if (cityDef(card.city).color !== color) return 0;
	if (purpose === 'recon' && card.companion === 'doubleAgent') return 2;
	if (purpose === 'build' && card.improvement === 'double') return 2;
	if (purpose === 'build' && card.improvement === 'triple') return 3;
	return 1;
}

/** A Player card by what is printed on it, for log lines. */
export function cardLabel(campaign: Campaign, id: CardId): string {
	const card = playerCard(campaign, id);
	switch (card.kind) {
		case 'city':
			return cityDef(card.city).name;
		case 'epidemic':
			return 'an Epidemic';
		case 'produce':
			return 'Produce Supplies';
		case 'event':
			return pack.events.find(event => event.id === card.event)!.name;
	}
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

export type Point = { x: number; z: number };

const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

/** Proper intersection only: segments that merely share an endpoint do not cross. */
export function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
	const d1 = cross(c, d, a);
	const d2 = cross(c, d, b);
	const d3 = cross(a, b, c);
	const d4 = cross(a, b, d);
	return d1 * d2 < 0 && d3 * d4 < 0;
}

type Course = { points: Point[]; min: Point; max: Point };
const courses = new Map<string, Course>();

/**
 * The course a line between two locations takes on the board, from `a` to `b`: the arch or the way
 * around the coasts that `gen-geometry.ts` chose. The rules test this course and the board draws it, so
 * a line that looks clear is clear.
 */
export function routeCourse(a: CityId, b: CityId, kind: EdgeKind): Point[] {
	const course = courseOf(a, b, kind).points;
	return a < b ? course : course.toReversed();
}

function courseOf(a: CityId, b: CityId, kind: EdgeKind): Course {
	const key = `${kind}:${edgeKey(a, b)}`;
	const known = courses.get(key);
	if (known) return known;
	const generated = pack.routeCourses[key];
	// A line drawn before a rule change took its pair off the candidates keeps its place on the board, run straight.
	// A pair still legal with no course means the geometry was not regenerated.
	if (!generated && isCandidate(a, b, kind)) throw new Error(`No course for ${key}: rerun gen-geometry.ts`);
	const points = generated
		? generated.map(([x, z]) => ({ x, z }))
		: (a < b ? [a, b] : [b, a]).map(id => pack.positions[id as keyof typeof pack.positions] as Point);
	const course = {
		points,
		min: { x: Math.min(...points.map(point => point.x)), z: Math.min(...points.map(point => point.z)) },
		max: { x: Math.max(...points.map(point => point.x)), z: Math.max(...points.map(point => point.z)) },
	};
	courses.set(key, course);
	return course;
}

/** Whether two courses cross. Courses that share a location meet there, which is not a crossing. */
function coursesCross(one: Course, other: Course): boolean {
	if (one.max.x < other.min.x || other.max.x < one.min.x || one.max.z < other.min.z || other.max.z < one.min.z)
		return false;
	for (let i = 1; i < one.points.length; i++)
		for (let j = 1; j < other.points.length; j++)
			if (segmentsCross(one.points[i - 1]!, one.points[i]!, other.points[j - 1]!, other.points[j]!)) return true;
	return false;
}

/** Whether a line between the two locations would cross a line of the same kind already on the board. */
export function crossesEdge(campaign: Campaign, a: CityId, b: CityId, kind: EdgeKind): boolean {
	const course = courseOf(a, b, kind);
	return campaign.edges.some(
		edge =>
			edge.kind === kind &&
			edge.a !== a &&
			edge.a !== b &&
			edge.b !== a &&
			edge.b !== b &&
			coursesCross(course, courseOf(edge.a, edge.b, edge.kind)),
	);
}

const grounds: (readonly [GroundId, Point, number])[] = [
	...(Object.entries(pack.positions) as [CityId, Point][]).map(
		([id, at]) => [id, at, pack.cities.find(city => city.id === id)!.groundWeight ?? 0] as const,
	),
	...pack.uncharted.map(patch => [patch.id, patch.at, 0] as const),
];
const unchartedIndex = new Map(pack.uncharted.map(patch => [patch.id as GroundId, patch]));

export const isUncharted = (id: GroundId): id is UnchartedId => unchartedIndex.has(id);

/**
 * What a point on the board belongs to: the nearest location or uncharted ground, weighed by `groundWeight`. This one
 * partition is what the rules mean by "unexplored map" and by region boundaries, and it is what the board draws, so
 * a line that looks like it crosses unknown territory is one the rules refuse.
 */
export function nearestGround(point: Point): GroundId {
	let best = grounds[0]![0];
	let closest = Number.POSITIVE_INFINITY;
	for (const [id, at, weight] of grounds) {
		const distance = (at.x - point.x) ** 2 + (at.z - point.z) ** 2 - weight;
		if (distance < closest) {
			closest = distance;
			best = id;
		}
	}
	return best;
}

/** The location whose reveal uncovers this ground: itself, or the one uncharted ground opens with, if any. */
export const groundCity = (id: GroundId): CityId | null =>
	isUncharted(id) ? unchartedIndex.get(id)!.revealedWith : id;

/** Whether players can see this ground. A uncharted ground that nothing uncovers never is. */
export function groundRevealed(campaign: Campaign, id: GroundId): boolean {
	const city = groundCity(id);
	return city !== null && campaign.locations[city]?.revealed === true;
}

/** The region a point lies in, or null in uncharted ground that stays dark. */
export const regionAt = (point: Point): RegionId | null => {
	const city = groundCity(nearestGround(point));
	return city && cityDef(city).region;
};

const STEP = 0.5;
const passageCache = new Map<string, { through: GroundId[]; redLines: number }>();
let redLines: Point[][] | undefined;

/** What a line between two locations passes along its course: every location or uncharted ground whose ground it crosses, and how many red region lines. */
export function passage(a: CityId, b: CityId, kind: EdgeKind): { through: GroundId[]; redLines: number } {
	const key = `${kind}:${edgeKey(a, b)}`;
	const known = passageCache.get(key);
	if (known) return known;
	const points = courseOf(a, b, kind).points;
	const through: GroundId[] = [];
	const visit = (point: Point) => {
		const owner = nearestGround(point);
		if (!through.includes(owner)) through.push(owner);
	};
	visit(points[0]!);
	for (let i = 1; i < points.length; i++) {
		const from = points[i - 1]!;
		const to = points[i]!;
		const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / STEP));
		for (let step = 1; step <= steps; step++)
			visit({ x: from.x + ((to.x - from.x) * step) / steps, z: from.z + ((to.z - from.z) * step) / steps });
	}
	const found = {
		through,
		redLines: redLineCrossings(points, (redLines ??= pack.redLines.map(line => line.map(([x, z]) => ({ x, z }))))),
	};
	passageCache.set(key, found);
	return found;
}

/** Whether a line between the two locations would run over ground no one has revealed yet. */
export const crossesUnexplored = (campaign: Campaign, a: CityId, b: CityId, kind: EdgeKind) =>
	passage(a, b, kind).through.some(id => !groundRevealed(campaign, id));

export const isCandidate = (a: CityId, b: CityId, kind: EdgeKind) =>
	pack.candidateEdges.some(edge => edge.kind === kind && edgeKey(edge.a, edge.b) === edgeKey(a, b));
