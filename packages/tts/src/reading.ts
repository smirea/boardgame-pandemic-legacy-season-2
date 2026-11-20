import { pack } from '@repo/game';
import type {
	AbilityId,
	ActionId,
	CityImprovementId,
	InfectionImprovementId,
	JobId,
	ObjectiveId,
	RuleId,
	ScarId,
	StructureKind,
	TurningPointId,
} from '@repo/game';
import { anchors, nearestAnchor, onMap } from './board';
import type { Census, Colour, ImageId, Piece, Vec } from './census';
import { characterSheets, faces } from './legend';
import type { Face } from './legend';

/** One card as it lies on the table: its face, and the sticker glued to it if any. */
export type CardRead = {
	guid: string;
	image: ImageId;
	face: Face;
	improvement: InfectionImprovementId | CityImprovementId | null;
};

export type CharacterRead = {
	name: string;
	/** The seat colour of the player whose hand the card lies beside. */
	player: string | null;
	home: string | null;
	job: JobId | null;
	abilities: AbilityId[];
	scars: ScarId[];
	/** Which of the engine's Character card layouts this card is. */
	card: number;
	exposure: number;
	portrait: ImageId | null;
	note: string;
	evidence: string[];
};

export type LocationRead = {
	/** The population sticker, or null when the printed number still shows. */
	population: number | null;
	infested: boolean;
	permanent: StructureKind[];
	center: boolean;
	tower: boolean;
	shelter: boolean;
	supplies: number;
	plague: number;
	hollow: number;
	/** Crossed out in red: the group's mark that none of its Infection cards remain. */
	crossed: boolean;
	evidence: string[];
};

export type LineRead = { a: string; b: string; kind: 'land' | 'sea'; evidence: string };

export type PlayerRead = {
	/** The seat colour in Tabletop Simulator. */
	colour: string;
	name: string;
	at: string | null;
	hand: CardRead[];
};

export type Reading = {
	save: { name: string; date: string };
	/** One entry per month from the prologue on, each game in the order played. */
	calendar: ('won' | 'lost')[][];
	notes: string[];
	players: PlayerRead[];
	locations: Record<string, LocationRead>;
	havenNames: Record<string, string>;
	regions: string[];
	havensFound: string[];
	lines: LineRead[];
	characters: CharacterRead[];
	spareCharacterCards: { card: number; exposure: number }[];
	objectives: { objective: ObjectiveId; progress: number | null }[];
	turningPoints: TurningPointId[];
	piles: {
		playerDeck: CardRead[];
		playerDiscard: CardRead[];
		infectionDeck: CardRead[];
		infectionDiscard: CardRead[];
		/** Infection cards of forsaken cities, set beside the board. */
		forsaken: CardRead[];
		/** Cards of cities that are not on the grid, kept off the board. */
		offGrid: CardRead[];
		/** Inoculated: kept out of the decks in the Package 6 bags, Player cards in one and Infection cards in the other. */
		stored: CardRead[];
		/** Destroyed by an effect, kept in the trash packet. */
		destroyed: CardRead[];
		rationedPool: CardRead[];
		/** Rationed Events laid out beside the board for the game just played. */
		pickedEvents: CardRead[];
		spareEpidemics: CardRead[];
	};
	/** Legacy cards still unread. */
	legacyRemaining: number;
	tracks: { infectionRate: number; incidents: number };
	pools: {
		stockpile: number;
		reserve: number;
		plague: number;
		hollow: number;
		centers: number;
		towers: number;
		shelters: number;
		infestedStickers: number;
	};
	forSale: {
		abilities: AbilityId[];
		scars: ScarId[];
		jobs: JobId[];
		cityImprovements: CityImprovementId[];
		infectionImprovements: InfectionImprovementId[];
		permanent: StructureKind[];
	};
	actions: ActionId[];
	rules: RuleId[];
	stockpileBonus: number;
	doors: { opened: string[]; sealed: string[] };
	packages: { opened: string[]; sealed: string[] };
	/** Facts the table shows that the reader could not settle. Each one is for a person to look at. */
	problems: string[];
};

/**
 * Stickers stuck beside one location's population box that lie nearer another location's disc.
 * Cairo's permanent stickers sit west of it, a hair nearer Tripoli.
 */
const STUCK_BESIDE: Record<string, string> = { '9e93ee': 'cairo', c29e67: 'cairo' };

const PLAYER_DECK = { x: 16, z: -20 };
const PLAYER_DISCARD = { x: 25, z: -20 };
const INFECTION_DECK = { x: 26, z: 21.5 };
const INFECTION_DISCARD = { x: 37.5, z: 21.5 };
const RATE_TRACK = { x: 21.68, z: 16.07, step: 2.88 };
const INCIDENT_TRACK = { z: 12.43, step: 2.03 };
const CALENDAR = { first: -41.87, step: 2.119, top: 18.5, bottom: 12.5 };
const OBJECTIVE_STEP = 1.95;

const near = (a: Pick<Vec, 'x' | 'z'>, b: Pick<Vec, 'x' | 'z'>, within: number) =>
	Math.hypot(a.x - b.x, a.z - b.z) <= within;
const hue = ({ r, g, b }: Colour) =>
	r > 0.8 && g < 0.3 && b < 0.3
		? 'red'
		: g > 0.8 && r < 0.45 && b < 0.3
			? 'green'
			: r < 0.15 && g < 0.15 && b < 0.15
				? 'black'
				: b > 0.7 && r < 0.35
					? 'blue'
					: 'other';
const sameTint = (a: Colour, b: Colour) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 0.15;
const sheetOf = (image: ImageId) => image.split('#')[0]!;

const SEAT_COLOURS: [name: string, tint: Colour][] = [
	['White', { r: 1, g: 1, b: 1 }],
	['Blue', { r: 0.12, g: 0.53, b: 1 }],
	['Pink', { r: 0.96, g: 0.44, b: 0.81 }],
	['Brown', { r: 0.44, g: 0.23, b: 0.09 }],
	['Red', { r: 0.86, g: 0.1, b: 0.09 }],
	['Green', { r: 0.19, g: 0.7, b: 0.17 }],
	['Yellow', { r: 0.9, g: 0.9, b: 0.17 }],
	['Purple', { r: 0.63, g: 0.12, b: 0.94 }],
	['Orange', { r: 0.96, g: 0.39, b: 0.11 }],
	['Teal', { r: 0.13, g: 0.69, b: 0.61 }],
];

/** The mod's own signs over its sorting stations. They say nothing about the game. */
const SIGNS = new Set([
	'Game End Upgrades',
	'(Cost is in the discription)',
	'Character Abilities',
	'Infection Card Upgrades',
	'Player Card Upgrades',
	'Put Player Deck Here',
	'Unpacking Station',
	'Jobs',
	'Scars',
	'Rationed Events',
	'Others',
	'Produce Supplies',
	'Events',
	'Epidemic',
	'Infection Statistics',
	'Decal Applying Station',
	'Player Cards',
	'Type Here',
]);

/** How far a point lies from the straight run between two points. */
function offSegment(point: Pick<Vec, 'x' | 'z'>, a: [number, number], b: [number, number]): number {
	const length = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
	const along = Math.max(
		0,
		Math.min(1, ((point.x - a[0]) * (b[0] - a[0]) + (point.z - a[1]) * (b[1] - a[1])) / length),
	);
	return Math.hypot(point.x - (a[0] + along * (b[0] - a[0])), point.z - (a[1] + along * (b[1] - a[1])));
}

export function read(table: Census): Reading {
	const problems: string[] = [];
	const used = new Set<string>();
	const top = table.pieces;
	const use = (...pieces: Piece[]) => {
		for (const piece of pieces) used.add(piece.guid);
	};
	const faceOf = (piece: Piece): Face | null => (piece.image ? (faces[piece.image] ?? null) : null);
	const card = (piece: Piece): CardRead => {
		const face = faceOf(piece);
		if (!face) throw new Error(`The legend has no entry for ${piece.image} (card ${piece.guid} ${piece.nickname})`);
		const sticker = piece.attached
			.map(faceOf)
			.find(glued => glued?.t === 'infectionImprovement' || glued?.t === 'cityImprovement');
		const improvement =
			sticker?.t === 'infectionImprovement' || sticker?.t === 'cityImprovement' ? sticker.improvement : null;
		return { guid: piece.guid, image: piece.image!, face, improvement };
	};
	/** A deck's cards, or a lone card as a pile of one. */
	const cardsOf = (piece: Piece): CardRead[] => (piece.type === 'Deck' ? piece.contents.map(card) : [card(piece)]);
	const pileAt = (point: { x: number; z: number }): CardRead[] => {
		const pile = top.find(piece => (piece.type === 'Deck' || piece.type === 'Card') && near(piece.pos, point, 2.5));
		if (!pile) return [];
		use(pile);
		return cardsOf(pile);
	};

	// --- Players: a pawn names a colour, a hand zone of the same colour holds that player's cards.
	const pawns = top.filter(piece => piece.type === 'PlayerPawn');
	const hands = top.filter(piece => piece.type === 'HandTrigger');
	use(...pawns, ...hands);
	const inHand = (zone: Piece, piece: Piece) =>
		piece.type === 'Card' &&
		piece.pos.y > 2.5 &&
		Math.abs(piece.pos.x - zone.pos.x) < zone.scale / 2 &&
		Math.abs(piece.pos.z - zone.pos.z) < 5;
	const players: (PlayerRead & { zone: Piece | null; tint: Colour })[] = [];
	for (const pawn of pawns) {
		const zone = hands.find(hand => sameTint(hand.tint, pawn.tint)) ?? null;
		const held = zone ? top.filter(piece => inHand(zone, piece)) : [];
		const spot = onMap(pawn.pos) ? nearestAnchor(pawn.pos) : null;
		if (!spot && held.length === 0) continue;
		if (spot && spot.distance > 2.5)
			problems.push(`${pawn.nickname}'s pawn stands ${spot.distance.toFixed(1)} from ${spot.city}`);
		use(...held);
		players.push({
			colour: SEAT_COLOURS.find(([, tint]) => sameTint(tint, pawn.tint))?.[0] ?? pawn.nickname,
			name: pawn.nickname,
			at: spot?.city ?? null,
			hand: held.toSorted((a, b) => a.pos.x - b.pos.x).map(card),
			zone,
			tint: pawn.tint,
		});
	}

	// --- The map.
	const blank = (): LocationRead => ({
		population: null,
		infested: false,
		permanent: [],
		center: false,
		tower: false,
		shelter: false,
		supplies: 0,
		plague: 0,
		hollow: 0,
		crossed: false,
		evidence: [],
	});
	const locations: Record<string, LocationRead> = Object.fromEntries(Object.keys(anchors).map(id => [id, blank()]));
	const havenNames: Record<string, string> = {};
	const regions: string[] = [];
	const havensFound: string[] = [];
	const notes: string[] = [];
	const at = (piece: Piece, within: number, what: string): LocationRead | null => {
		const stuck = STUCK_BESIDE[piece.guid];
		const spot = stuck ? { city: stuck, distance: 0 } : nearestAnchor(piece.pos);
		if (spot.distance > within) {
			problems.push(`${what} ${piece.guid} lies ${spot.distance.toFixed(1)} from the nearest location, ${spot.city}`);
			return null;
		}
		const location = locations[spot.city]!;
		location.evidence.push(piece.guid);
		return location;
	};
	const MODELS: Record<string, keyof LocationRead> = {
		'Supply Center': 'center',
		'Satellite Tower': 'tower',
		Shelter: 'shelter',
		'Supply Cube': 'supplies',
		'Plague Cube': 'plague',
		'Hollow Men': 'hollow',
	};
	for (const piece of top) {
		if (!onMap(piece.pos)) continue;
		const face = faceOf(piece);
		if (face?.t === 'region' || face?.t === 'haven') {
			if (face.t === 'region') regions.push(face.region);
			else havensFound.push(face.city);
			use(piece);
		} else if (face?.t === 'population') {
			const location = at(piece, 2.7, 'Population sticker');
			if (location) location.population = face.value;
			use(piece);
		} else if (face?.t === 'infested') {
			const location = at(piece, 2, 'Infested sticker');
			if (location) location.infested = true;
			use(piece);
		} else if (face?.t === 'permanent') {
			const location = at(piece, 2.7, 'Permanent structure sticker');
			if (location) location.permanent.push(face.structure);
			use(piece);
		} else if (piece.type === 'Custom_Model' && MODELS[piece.nickname]) {
			const location = at(piece, 3, piece.nickname);
			const field = MODELS[piece.nickname]!;
			if (location && (field === 'center' || field === 'tower' || field === 'shelter')) location[field] = true;
			else if (location && (field === 'supplies' || field === 'plague' || field === 'hollow')) location[field] += 1;
			use(piece);
		} else if (piece.type === '3DText') {
			const haven = Object.keys(anchors)
				.filter(id => id.startsWith('haven-'))
				.map(id => ({ id, distance: Math.hypot(piece.pos.x - anchors[id]![0], piece.pos.z - anchors[id]![1]) }))
				.toSorted((a, b) => a.distance - b.distance)[0]!;
			if (haven.distance < 5) havenNames[haven.id] = piece.text!.replaceAll(/\s+/g, ' ').trim();
			else notes.push(piece.text!);
			use(piece);
		} else if (face?.t === 'paper') use(piece);
	}

	// --- Lines drawn on the map: straight black strokes are supply lines, blue ones sea lanes, red ones cross a city out.
	const lines: LineRead[] = [];
	const isPort = (id: string) => pack.cities.find(city => city.id === id)?.port ?? false;
	const ports = Object.keys(anchors).filter(isPort);
	const nearestPort = (point: Vec) =>
		ports
			.map(city => ({ city, distance: Math.hypot(point.x - anchors[city]![0], point.z - anchors[city]![1]) }))
			.toSorted((a, b) => a.distance - b.distance)[0]!;
	const loose: { first: Vec; last: Vec; colour: string; source: string; near: [string, string] }[] = [];
	const calendar: ('won' | 'lost')[][] = [];
	const marks = new Map<number, { red: number; green: number }>();
	const drawn = [
		...table.strokes.map((stroke, index) => ({ stroke, source: `table stroke ${index}` })),
		...top.flatMap(piece =>
			piece.strokes.map((stroke, index) => ({ stroke, source: `${piece.guid} stroke ${index}` })),
		),
	];
	for (const { stroke, source } of drawn) {
		const first = stroke.points[0]!;
		const last = stroke.points.at(-1)!;
		const middle = {
			x: stroke.points.reduce((sum, point) => sum + point.x, 0) / stroke.points.length,
			z: stroke.points.reduce((sum, point) => sum + point.z, 0) / stroke.points.length,
		};
		const colour = hue(stroke.colour);
		const inCalendar =
			middle.z < CALENDAR.top && middle.z > CALENDAR.bottom && middle.x < CALENDAR.first + CALENDAR.step * 12.5;
		if (inCalendar && (colour === 'red' || colour === 'green')) {
			const month = Math.round((middle.x - CALENDAR.first) / CALENDAR.step);
			const entry = marks.get(month) ?? { red: 0, green: 0 };
			entry[colour] += 1;
			marks.set(month, entry);
			continue;
		}
		if (!onMap(middle)) continue;
		if (colour === 'red') {
			const spot = nearestAnchor(middle);
			if (spot.distance <= 1.8) locations[spot.city]!.crossed = true;
			else
				problems.push(
					`A red stroke (${source}) is ${spot.distance.toFixed(1)} from the nearest location, ${spot.city}`,
				);
			continue;
		}
		if (colour !== 'black' && colour !== 'blue') continue;
		// A dot or a tick joins nothing. Denver and Los Angeles are the closest pair the group joined, about 1.5 apart.
		if (Math.hypot(first.x - last.x, first.z - last.z) < 1) continue;
		const freehand = stroke.points.length > 2;
		const ends = [first, last].map(point => {
			const city = nearestAnchor(point);
			const port = nearestPort(point);
			return colour === 'blue' && freehand && port.distance <= 3.6 ? port : city;
		});
		const [a, b] = ends as [(typeof ends)[number], (typeof ends)[number]];
		const reach = colour === 'blue' && freehand ? 3.6 : 1.9;
		if (a.distance > reach || b.distance > reach || a.city === b.city) {
			loose.push({ first, last, colour, source, near: [a.city, b.city] });
			continue;
		}
		const kind = colour === 'blue' && isPort(a.city) && isPort(b.city) ? 'sea' : 'land';
		if (!lines.some(line => (line.a === a.city && line.b === b.city) || (line.a === b.city && line.b === a.city)))
			lines.push({ a: a.city, b: b.city, kind, evidence: source });
	}
	// A line drawn in two goes may leave a piece that reaches neither end. It is ink on a line already read.
	for (const {
		first,
		last,
		colour,
		source,
		near: [a, b],
	} of loose) {
		const retraced = lines.some(line =>
			[first, last].every(point => offSegment(point, anchors[line.a]!, anchors[line.b]!) < 1.2),
		);
		if (!retraced)
			problems.push(
				`A ${colour} stroke (${source}) from (${first.x.toFixed(1)}, ${first.z.toFixed(1)}) to (${last.x.toFixed(1)}, ${last.z.toFixed(1)}) joins no two locations: nearest are ${a} and ${b}`,
			);
	}
	const lastMonth = Math.max(-1, ...marks.keys());
	for (let month = 0; month <= lastMonth; month++) {
		const entry = marks.get(month) ?? { red: 0, green: 0 };
		calendar.push([
			...Array<'lost'>(Math.round(entry.red / 2)).fill('lost'),
			...(entry.green > 0 ? (['won'] as const) : []),
		]);
	}

	// --- Characters. One card per character shows its name, job and stickers at state 1; a second copy,
	// or the same card turned to a later state, shows the scratched exposure boxes.
	const isCharacterCard = (piece: Piece) =>
		piece.type === 'Card' && piece.back === 'E74FB7E5' && faceOf(piece)?.t !== 'haven-worker';
	const spareDeck = top.find(piece => piece.type === 'Deck' && piece.contents.some(isCharacterCard));
	const characterCards = [...top.filter(isCharacterCard), ...(spareDeck?.contents.filter(isCharacterCard) ?? [])];
	if (spareDeck) use(spareDeck);
	const sheet = (piece: Piece) => sheetOf(piece.state === 1 ? piece.states[2]!.image! : piece.image!);
	const footprint = (identity: Piece, piece: Piece) =>
		Math.abs(piece.pos.x - identity.pos.x) < 4.8 && Math.abs(piece.pos.z - identity.pos.z) < 3.4;
	const characters: CharacterRead[] = [];
	const spareCharacterCards: Reading['spareCharacterCards'] = [];
	const onCharacter = new Set<ImageId>();
	const bySheet = Map.groupBy(characterCards, sheet);
	for (const [sheetId, cards] of bySheet) {
		const layout = characterSheets[sheetId];
		if (layout === undefined) throw new Error(`Character card sheet ${sheetId} is not one of the ten the legend knows`);
		use(...cards.filter(piece => piece.holder === null));
		const scratched = cards.find(piece => piece.state !== 1);
		const shown = cards.find(piece => piece.state === 1 && piece.holder === null) ?? null;
		// The name and stickers live on the state 1 face, which a card turned to a later state still carries.
		const identity = shown ?? scratched?.states[1] ?? null;
		const decorated = identity && (identity.nickname || identity.decals.length > 0 || identity.attached.length > 0);
		const told = /(?:state|exposure)\s*(\d+)/i.exec(identity?.description ?? '');
		const exposure = scratched ? scratched.state! - 1 : told ? Number(told[1]) - (/state/i.test(told[0]) ? 1 : 0) : 0;
		// The group sometimes glued a scratched copy onto the card and also left another lying near it.
		const glued = (identity?.attached ?? []).filter(
			piece => isCharacterCard(piece) && piece.state !== null && piece.state !== 1,
		);
		const counts = new Set([...(scratched ? [scratched] : []), ...glued].map(piece => piece.state! - 1));
		if (counts.size > 1)
			problems.push(
				`${identity?.nickname || 'A character'}'s scratched copies disagree: ${[...(scratched ? [scratched] : []), ...glued].map(piece => `${piece.guid} shows ${piece.state! - 1}`).join(', ')}. The import uses ${exposure}.`,
			);
		if (!decorated) {
			spareCharacterCards.push({ card: layout, exposure });
			continue;
		}
		const loose = shown ? top.filter(piece => piece.type === 'Custom_Token' && footprint(shown, piece)) : [];
		use(...loose);
		const stuck: { image: ImageId | null }[] = [...identity.decals, ...identity.attached, ...loose];
		const stickers = stuck
			.map(entry => (entry.image ? faces[entry.image] : undefined))
			.filter(face => face !== undefined);
		for (const entry of stuck) if (entry.image) onCharacter.add(entry.image);
		const jobs = stickers.filter(face => face.t === 'job').map(face => face.job);
		if (jobs.length > 1) problems.push(`${identity.nickname || 'A character'} carries ${jobs.length} job stickers`);
		const owner = shown
			? players
					.filter(player => player.zone)
					.map(player => ({ player, distance: Math.abs(player.zone!.pos.x - shown.pos.x) }))
					.toSorted((a, b) => a.distance - b.distance)[0]
			: undefined;
		const player = owner && owner.distance < 30 && shown!.pos.z < -20 ? owner.player : null;
		const hint = /^\s*([A-Za-z]+)/.exec(identity.description)?.[1]?.toLowerCase();
		const named = hint
			? Object.entries(havenNames).find(([, name]) => name.toLowerCase().includes(hint))?.[0]
			: undefined;
		const portrait = stuck.find(entry => entry.image && faces[entry.image]?.t === 'portrait')?.image ?? null;
		characters.push({
			name: identity.nickname,
			player: player?.colour ?? null,
			home: named ?? player?.at ?? null,
			job: jobs[0] ?? null,
			abilities: stickers.filter(face => face.t === 'ability').map(face => face.ability),
			scars: stickers.filter(face => face.t === 'scar').map(face => face.scar),
			card: layout,
			exposure,
			portrait,
			note: identity.description.trim(),
			evidence: cards.map(piece => piece.guid),
		});
	}
	const workers = top.filter(
		piece =>
			(piece.type === 'Deck' || piece.type === 'Card') &&
			cardsOfQuietly(piece).some(face => face?.t === 'haven-worker'),
	);
	use(...workers);

	// --- Objectives and the Game End area, along the top of the board.
	const objectives: Reading['objectives'] = [];
	const turningPoints: TurningPointId[] = [];
	const tracking = top.filter(piece => piece.nickname === 'Tracking Token');
	use(...tracking);
	for (const piece of top) {
		const face = faceOf(piece);
		if (piece.type !== 'Card' || piece.pos.z < 17 || piece.pos.z > 26 || Math.abs(piece.pos.x) > 44) continue;
		if (face?.t === 'objective') {
			const target = pack.objectives.find(objective => objective.id === face.objective)!.target;
			const token = tracking.find(candidate => near(candidate.pos, piece.pos, 4));
			const progress = token
				? Math.max(0, Math.min(target, Math.round((token.pos.x - piece.pos.x) / OBJECTIVE_STEP + target / 2)))
				: null;
			objectives.push({ objective: face.objective, progress });
			use(piece);
		} else if (face?.t === 'turningPoint') {
			turningPoints.push(face.id);
			use(piece);
		}
	}

	// --- Decks and piles.
	const playerDeck = pileAt(PLAYER_DECK);
	const playerDiscard = pileAt(PLAYER_DISCARD);
	const infectionDeck = pileAt(INFECTION_DECK);
	const infectionDiscard = pileAt(INFECTION_DISCARD);
	const legacyDeck = top.find(piece => piece.nickname === 'Legacy Deck');
	if (legacyDeck) use(legacyDeck);
	const forsaken: CardRead[] = [];
	const offGrid: CardRead[] = [];
	const stored: CardRead[] = [];
	const destroyed: CardRead[] = [];
	const rationedPool: CardRead[] = [];
	const pickedEvents: CardRead[] = [];
	const spareEpidemics: CardRead[] = [];
	const sealedBag = (piece: Piece) =>
		/^Folder \d$/.test(piece.nickname) ||
		(/^Package \d$/.test(piece.nickname) && piece.tint.g > 0.9 && piece.contents.length > 0);
	const doors = { opened: [] as string[], sealed: [] as string[] };
	const packages = { opened: [] as string[], sealed: [] as string[] };
	const noteDoors = (piece: Piece, sealed: boolean) => {
		const packet = /^Packet (\w+)$/.exec(piece.nickname);
		if (packet) (sealed ? doors.sealed : doors.opened).push(packet[1]!);
		for (const inner of piece.contents) noteDoors(inner, sealed);
	};
	/** Cards in a bag that is not sealed are out of the game: a Package 6 bag holds the inoculated, any other the destroyed. */
	const emptyOut = (bag: Piece, into = /^Package 6$/.test(bag.nickname) ? stored : destroyed) => {
		for (const inner of bag.contents) {
			if (inner.type === 'Card' || inner.type === 'Deck') {
				for (const each of inner.type === 'Deck' ? inner.contents : [inner]) {
					const face = faceOf(each);
					if (face && face.t !== 'paper' && face.t !== 'objective' && face.t !== 'turningPoint') {
						into.push(card(each));
						if (bag.nickname === 'The Reserve')
							problems.push(
								`Card ${each.guid} (${face.t}) lies in the bag "The Reserve", not the trash: the import treats it as destroyed`,
							);
					}
				}
			} else emptyOut(inner, into);
		}
	};
	for (const piece of top) {
		if (used.has(piece.guid)) continue;
		const isBag = piece.type === 'Bag' || piece.type === 'Custom_Model_Bag' || piece.type === 'Infinite_Bag';
		if (isBag) {
			const number = /^Package (\d)$/.exec(piece.nickname)?.[1];
			if (sealedBag(piece)) {
				if (number) packages.sealed.push(number);
				noteDoors(piece, true);
			} else {
				if (number && !packages.opened.includes(number)) packages.opened.push(number);
				noteDoors(piece, false);
				emptyOut(piece);
			}
			use(piece);
			continue;
		}
		if (piece.type !== 'Card' && piece.type !== 'Deck') continue;
		const cards = cardsOfQuietly(piece);
		if (cards.some(face => face === null)) continue;
		const kinds = new Set(cards.map(face => face!.t));
		const playArea = Math.abs(piece.pos.x) < 60 && piece.pos.z > -30 && piece.pos.z < 40;
		if ([...kinds].every(kind => kind === 'paper' || kind === 'objective' || kind === 'turningPoint')) use(piece);
		else if (kinds.has('event') && cards.every(face => face!.t === 'event' && face.mode === 'rationed')) {
			(playArea ? pickedEvents : rationedPool).push(...cardsOf(piece));
			use(piece);
		} else if (kinds.size === 1 && kinds.has('epidemic')) {
			spareEpidemics.push(...cardsOf(piece));
			use(piece);
		} else if (kinds.size === 1 && kinds.has('infection') && playArea) {
			forsaken.push(...cardsOf(piece));
			use(piece);
		} else if (playArea && near(piece.pos, PLAYER_DISCARD, 13) && [...kinds].every(kind => kind === 'city')) {
			// Cards spent on one action are often left fanned beside the discard pile.
			playerDiscard.push(...cardsOf(piece));
			use(piece);
		} else if (!playArea && [...kinds].every(kind => kind === 'city' || kind === 'infection')) {
			offGrid.push(...cardsOf(piece));
			use(piece);
		}
	}

	// --- Tracks and pools.
	const marker = (which: 'incidents' | 'infectionRate') =>
		top.find(piece => {
			const face = faceOf(piece);
			return face?.t === 'marker' && face.marker === which;
		});
	const rate = marker('infectionRate');
	const incident = marker('incidents');
	if (rate) use(rate);
	if (incident) use(incident);
	const count = (nickname: string) =>
		top.filter(piece => piece.nickname === nickname && !onMap(piece.pos) && !used.has(piece.guid) && (use(piece), true))
			.length;
	const bagOf = (nickname: string) => top.find(piece => piece.nickname === nickname)?.contents.length ?? 0;
	const pools = {
		stockpile: count('Supply Cube'),
		reserve: bagOf('Supply Cube Reserve'),
		plague: count('Plague Cube'),
		hollow: count('Hollow Men') + bagOf('Hollow Men Bag'),
		centers: bagOf('Supply Centers'),
		towers: bagOf('Satellite Towers'),
		shelters: bagOf('Shelters'),
		infestedStickers: bagOf('Infected City Stickers'),
	};

	// --- Stickers not yet used, and the action and rule stickers that say what is unlocked.
	const forSale: Reading['forSale'] = {
		abilities: [],
		scars: [],
		jobs: [],
		cityImprovements: [],
		infectionImprovements: [],
		permanent: [],
	};
	const actions = new Set<ActionId>();
	const rules = new Set<RuleId>();
	let stockpileBonus = 0;
	for (const piece of top) {
		const face = faceOf(piece);
		if (!face) continue;
		if (face.t === 'action') for (const action of face.actions) actions.add(action);
		if (face.t === 'rule') rules.add(face.rule);
		if (face.t === 'marker' && face.marker === 'stockpileBonus') stockpileBonus += 15;
		if (used.has(piece.guid) || piece.type !== 'Custom_Token') continue;
		// A token whose picture is already on a character is the leftover the sticker was copied from.
		const leftover = piece.image !== null && onCharacter.has(piece.image);
		if (face.t === 'ability' && !leftover) forSale.abilities.push(face.ability);
		else if (face.t === 'scar' && !leftover) forSale.scars.push(face.scar);
		else if (face.t === 'job' && !leftover) forSale.jobs.push(face.job);
		else if (face.t === 'cityImprovement') forSale.cityImprovements.push(face.improvement);
		else if (face.t === 'infectionImprovement') forSale.infectionImprovements.push(face.improvement);
		else if (face.t === 'permanent') forSale.permanent.push(face.structure);
		use(piece);
	}

	for (const piece of top) {
		if (used.has(piece.guid)) continue;
		if (piece.type === '3DText') {
			if (!SIGNS.has(piece.text!.trim())) notes.push(piece.text!);
		}
		// Zones, the scripted helper buttons, the trays and mats, and the rationing die the group left off the board.
		else if (!/^(ScriptingTrigger|Checker_|Custom_Model$|Custom_Tile$|Die_)/.test(piece.type) && faceOf(piece) === null)
			problems.push(
				`Nothing reads ${piece.type} ${piece.guid} ${JSON.stringify(piece.nickname)} at (${piece.pos.x.toFixed(1)}, ${piece.pos.z.toFixed(1)})`,
			);
	}

	return {
		save: { name: table.name, date: table.date },
		calendar,
		notes,
		players: players.map(({ zone: _zone, tint: _tint, ...player }) => player),
		locations,
		havenNames,
		regions,
		havensFound,
		lines,
		characters,
		spareCharacterCards,
		objectives,
		turningPoints,
		piles: {
			playerDeck,
			playerDiscard,
			infectionDeck,
			infectionDiscard,
			forsaken,
			offGrid,
			stored,
			destroyed,
			rationedPool,
			pickedEvents,
			spareEpidemics,
		},
		legacyRemaining: legacyDeck?.contents.length ?? 0,
		tracks: {
			infectionRate: rate ? Math.round((rate.pos.x - RATE_TRACK.x) / RATE_TRACK.step) : 0,
			incidents: incident ? Math.max(0, Math.round((INCIDENT_TRACK.z - incident.pos.z) / INCIDENT_TRACK.step)) : 0,
		},
		pools,
		forSale,
		actions: [...actions],
		rules: [...rules],
		stockpileBonus,
		doors,
		packages,
		problems,
	};

	function cardsOfQuietly(piece: Piece): (Face | null)[] {
		return (piece.type === 'Deck' ? piece.contents : [piece]).map(faceOf);
	}
}
