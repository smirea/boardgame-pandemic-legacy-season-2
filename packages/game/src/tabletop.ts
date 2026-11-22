import { pack } from './content/pack';
import type {
	AbilityId,
	CityImprovementId,
	CompanionId,
	DoorId,
	EventId,
	InfectionImprovementId,
	JobId,
	ObjectiveId,
	ScarId,
	Seal,
	StructureKind,
	TurningPointId,
} from './content/types';
import { sealKey } from './content/types';
import { gridCityCount, isForsaken } from './helpers';
import type { CardId, CharacterId, CityId } from './ids';
import { newCampaign, openSeal, paddedTrack, readLegacy } from './legacy';
import type { Save } from './machine';
import type { Character, World } from './state';
import { newTable } from './table';

type Result = 'won' | 'lost';
const pkg = (id: number): Seal => ({ t: 'package', id });
const door = (id: DoorId): Seal => ({ t: 'door', id });
type CityCardFact = {
	city: string;
	copies?: number;
	improvement?: CityImprovementId;
	search?: ['land' | 'sea', boolean][];
	companion?: CompanionId;
	/** Inoculated: kept in Package 6, out of the decks. */
	stored?: true;
};
type InfectionCardFact = { city: string; copies?: number; improvement?: InfectionImprovementId; stored?: true };
type SlotFact = { ability: AbilityId } | { scar: ScarId } | null;
type CharacterFact = {
	name: string;
	job: JobId | null;
	home: string;
	/** Which of the pack's Character cards it is on, for its exposure layout. */
	card: number;
	exposure: number;
	slots: SlotFact[];
	/** Who played it in the last game, by seat colour on the table. */
	played: boolean;
};

/**
 * One real group's campaign, read off their table after July's game and set up at the August lobby. Their table
 * ran in a physics sandbox, so they kept some rules with workarounds; these facts record the game state each
 * workaround stood for, never the workaround. The calendar is replayed through our Legacy schedule, then every fact
 * here replaces what the replay produced, and anything the replay disagrees with fails loudly.
 *
 * Where the table and the rules part, the rules win, and these are the readings taken:
 * - Rationing is 0: the rule gives 0 after July's win, and the die beside the board has no 0 face, so it showed 1.
 * - Purge is still owned. Played one-shot cards went to the retired-components bag; it lay in the bag for inactive
 *   pieces, which is not that.
 * - Doors 44 and 49 create the Sanitation Officer and the Captain at once. The table had not made them yet, so they
 *   join the roster on the next two clean Character cards.
 * - Jacksonville keeps its third Infection card. One copy was missing from the table with no rule that removes it.
 * - The Antananarivo lane is Lagos to Antananarivo: its pen stroke stops short, and the city's cards are in play.
 * - Tib's exposure is 2, as the loose copy and his scar show; the glued copy was stale. E. Holmes has no job: both
 *   unused starting job stickers are still on the shelf.
 */
const TABLE = {
	/** Prologue, then January to July: each month's games in order. */
	calendar: [
		['lost'],
		['won'],
		['won'],
		['lost', 'won'],
		['lost', 'lost'],
		['won'],
		['lost', 'won'],
		['won'],
	] as Result[][],
	/**
	 * What the group opened themselves, by the month. May's perimeter report forced the eastern Pacific haven onto
	 * the map; everything else was earned. The first forsaken city opened A at a game end, by July at the latest.
	 */
	openedByMonth: {
		1: [pkg(1)],
		3: [pkg(5)],
		5: [pkg(4)],
		6: [pkg(7)],
		7: [pkg(2), pkg(6), door('A'), door('35')],
	} as Partial<Record<number, Seal[]>>,
	doors: [
		'L',
		'J',
		'23',
		'66',
		'39',
		'64',
		'67',
		'34',
		'K',
		'24',
		'47',
		'E',
		'60',
		'50',
		'F',
		'14',
		'A',
		'57',
		'42',
		'36',
		'31',
		'44',
		'49',
		'53',
		'62',
		'35',
		'12',
	] as DoorId[],
	packages: [1, 4, 5, 6, 7, 2],
	regions: ['north-america', 'south-america', 'europe', 'africa', 'middle-east'],
	actions: ['recon', 'establishLine', 'search', 'shuttle', 'chartLane', 'inoculate', 'transmit', 'buildTower'],
	rules: ['epidemicScaling', 'forsaken', 'storage'],
	stockpileBonus: 15,
	havenNames: {
		'haven-south-atlantic': 'Tiberian Sun',
		'haven-north-atlantic': 'Light of Heaven',
		'haven-mediterranean': 'Via Stafida',
		'haven-eastern-pacific': 'Forsaken America',
	} as Record<string, string>,
	/** Every revealed location, with its population where a sticker changed it, infestation and permanent structures. */
	locations: {
		'haven-north-atlantic': { population: 3 },
		'haven-mediterranean': { population: 3 },
		'haven-south-atlantic': { population: 3 },
		'haven-eastern-pacific': {},
		'new-york': { population: 1 },
		washington: { population: 3 },
		jacksonville: { population: 1 },
		'sao-paulo': { population: 5 },
		london: { population: 2 },
		istanbul: { population: 2 },
		tripoli: { population: 2 },
		cairo: { population: 8, permanent: ['center', 'tower'] },
		lagos: { population: 8, permanent: ['center', 'tower'] },
		chicago: { population: 0 },
		'san-francisco': { population: 3 },
		denver: { population: 4, permanent: ['center', 'tower'] },
		atlanta: { population: 4 },
		'los-angeles': { population: 1 },
		'mexico-city': { population: 2 },
		bogota: { population: 2 },
		lima: { population: 0, infested: true },
		santiago: { population: 2 },
		'buenos-aires': { population: 0, infested: true },
		paris: { population: 2 },
		frankfurt: { population: 1 },
		'st-petersburg': { population: 1 },
		moscow: { population: 6, permanent: ['center'] },
		kinshasa: { population: 0 },
		khartoum: { population: 1 },
		'dar-es-salaam': { population: 1 },
		antananarivo: { population: 1 },
		johannesburg: { population: 2 },
		baghdad: {},
		riyadh: {},
		tehran: {},
		delhi: {},
		'new-mumbai': {},
		kolkata: {},
	} as Record<string, { population?: number; infested?: true; permanent?: StructureKind[] }>,
	/** Supply lines and sea lanes drawn in pen. */
	lines: [
		['sao-paulo', 'santiago', 'land'],
		['atlanta', 'jacksonville', 'land'],
		['chicago', 'atlanta', 'land'],
		['chicago', 'denver', 'land'],
		['denver', 'atlanta', 'land'],
		['denver', 'los-angeles', 'land'],
		['denver', 'mexico-city', 'land'],
		['denver', 'san-francisco', 'land'],
		['lima', 'sao-paulo', 'land'],
		['lima', 'lagos', 'sea'],
		['frankfurt', 'istanbul', 'land'],
		['frankfurt', 'moscow', 'land'],
		['frankfurt', 'paris', 'land'],
		['st-petersburg', 'frankfurt', 'land'],
		['moscow', 'tehran', 'land'],
		['lagos', 'antananarivo', 'sea'],
		['kinshasa', 'khartoum', 'land'],
		['kinshasa', 'johannesburg', 'land'],
		['lagos', 'dar-es-salaam', 'sea'],
		['khartoum', 'cairo', 'land'],
		['tehran', 'new-mumbai', 'land'],
	] as [string, string, 'land' | 'sea'][],
	cities: [
		{
			city: 'antananarivo',
			search: [
				['land', false],
				['sea', false],
			],
		},
		{ city: 'antananarivo' },
		{ city: 'atlanta', search: [['land', true]], stored: true },
		{ city: 'baghdad', search: [['land', false]] },
		{ city: 'baghdad' },
		{ city: 'bogota', search: [['land', false]] },
		{ city: 'bogota' },
		{
			city: 'buenos-aires',
			search: [
				['land', false],
				['sea', false],
			],
		},
		{ city: 'buenos-aires' },
		{ city: 'cairo', copies: 4 },
		{ city: 'chicago', search: [['land', true]] },
		{ city: 'chicago' },
		{
			city: 'dar-es-salaam',
			search: [
				['land', false],
				['sea', false],
			],
		},
		{ city: 'dar-es-salaam' },
		{ city: 'delhi', search: [['land', false]] },
		{ city: 'denver', search: [['land', true]], companion: 'lineman' },
		{ city: 'denver' },
		{ city: 'frankfurt', search: [['land', true]], companion: 'porter' },
		{ city: 'frankfurt' },
		{ city: 'istanbul', copies: 4 },
		{ city: 'jacksonville', copies: 4 },
		{ city: 'johannesburg', search: [['land', false]] },
		{ city: 'johannesburg' },
		{ city: 'khartoum', search: [['land', true]] },
		{ city: 'kinshasa', search: [['land', false]] },
		{ city: 'kolkata' },
		{ city: 'lagos', copies: 4 },
		{
			city: 'lima',
			search: [
				['land', true],
				['sea', true],
			],
			companion: 'medic',
		},
		{ city: 'london', copies: 4 },
		{
			city: 'los-angeles',
			search: [
				['land', true],
				['sea', true],
			],
		},
		{ city: 'mexico-city', search: [['land', true]], companion: 'trader' },
		{ city: 'moscow', search: [['land', false]] },
		{
			city: 'new-mumbai',
			search: [
				['land', false],
				['sea', false],
			],
		},
		{ city: 'new-mumbai' },
		{ city: 'new-york', copies: 4 },
		{ city: 'paris', search: [['land', true]], companion: 'builder' },
		{ city: 'paris' },
		{ city: 'riyadh', search: [['land', false]] },
		{ city: 'riyadh' },
		{
			city: 'san-francisco',
			search: [
				['land', false],
				['sea', false],
			],
		},
		{ city: 'san-francisco' },
		{ city: 'santiago', search: [['land', false]] },
		{ city: 'sao-paulo' },
		{ city: 'sao-paulo', copies: 3, stored: true },
		{
			city: 'st-petersburg',
			search: [
				['land', false],
				['sea', false],
			],
		},
		{ city: 'tehran', search: [['land', true]] },
		{ city: 'tripoli', copies: 4 },
		{ city: 'washington', copies: 4 },
	] as CityCardFact[],
	infection: [
		{ city: 'antananarivo', copies: 2 },
		{ city: 'atlanta' },
		{ city: 'baghdad', copies: 2 },
		{ city: 'bogota', copies: 2 },
		{ city: 'buenos-aires', copies: 2 },
		{ city: 'chicago', copies: 2 },
		{ city: 'dar-es-salaam', copies: 2, stored: true },
		{ city: 'delhi' },
		{ city: 'denver', copies: 2, improvement: 'cordon' },
		{ city: 'frankfurt', copies: 2, stored: true },
		{ city: 'istanbul', copies: 3 },
		{ city: 'jacksonville', copies: 3 },
		{ city: 'johannesburg', copies: 2 },
		{ city: 'khartoum' },
		{ city: 'kinshasa' },
		{ city: 'kolkata' },
		{ city: 'lagos', copies: 3, stored: true },
		{ city: 'lima' },
		{ city: 'london', copies: 3, stored: true },
		{ city: 'los-angeles', stored: true },
		{ city: 'mexico-city', stored: true },
		{ city: 'moscow', stored: true },
		{ city: 'new-mumbai', copies: 2 },
		{ city: 'new-york' },
		{ city: 'new-york', copies: 2, stored: true },
		{ city: 'paris', copies: 2, improvement: 'wellStocked' },
		{ city: 'riyadh', copies: 2 },
		{ city: 'san-francisco', copies: 2 },
		{ city: 'sao-paulo' },
		{ city: 'sao-paulo', copies: 2, stored: true },
		{ city: 'st-petersburg', stored: true },
		{ city: 'tehran', improvement: 'lockdown' },
		{ city: 'tripoli', copies: 2 },
		{ city: 'tripoli', stored: true },
		{ city: 'washington', copies: 3, stored: true },
	] as InfectionCardFact[],
	events: [
		{ event: 'airlift', mode: 'rationed' },
		{ event: 'antidote', mode: 'unrationed' },
		{ event: 'cache', mode: 'rationed' },
		{ event: 'cardSwap', mode: 'rationed' },
		{ event: 'cleanse', mode: 'rationed' },
		{ event: 'encore', mode: 'rationed' },
		{ event: 'forecast', mode: 'rationed' },
		{ event: 'handout', mode: 'rationed' },
		{ event: 'massInoculation', mode: 'rationed' },
		{ event: 'mentor', mode: 'unrationed' },
		{ event: 'openWaters', mode: 'rationed' },
		{ event: 'quietNight', mode: 'rationed' },
		{ event: 'resilience', mode: 'rationed' },
		{ event: 'secondWind', mode: 'rationed' },
		{ event: 'spreadOut', mode: 'rationed' },
		{ event: 'stockUp', mode: 'unrationed' },
		{ event: 'purge', mode: 'unrationed' },
		{ event: 'surplus', mode: 'permanent', copies: 3 },
	] as { event: EventId; mode: 'rationed' | 'unrationed' | 'permanent'; copies?: number }[],
	produce: [1, 1, 2, 2, 2, 3],
	epidemics: 10,
	gather: 4,
	characters: [
		{
			name: 'E. Holmes',
			job: null,
			home: 'haven-mediterranean',
			card: 4,
			exposure: 2,
			slots: [{ ability: 'helmsman' }, null, null, null],
			played: false,
		},
		{
			name: 'Anki',
			job: 'farmer',
			home: 'haven-north-atlantic',
			card: 1,
			exposure: 1,
			slots: [{ ability: 'runner' }, { ability: 'foreman' }, { ability: 'courier' }, null],
			played: true,
		},
		{
			name: 'Tib',
			job: 'laborer',
			home: 'haven-south-atlantic',
			card: 9,
			exposure: 2,
			slots: [
				// The table put Architect in the job box and the Laborer job in the first slot: he is a Laborer with Architect.
				{ ability: 'architect' },
				{ ability: 'facilitator' },
				{ ability: 'coordinator' },
				{ scar: 'reconExtraCard' },
			],
			played: true,
		},
		{
			name: 'Unnamed Administrator',
			job: 'administrator',
			home: 'haven-mediterranean',
			card: 3,
			exposure: 2,
			slots: [{ scar: 'plagueShy' }, { ability: 'recordKeeper' }, { ability: 'supplier' }, { ability: 'outrider' }],
			played: true,
		},
		{
			name: 'Sanitation Officer',
			job: 'sanitationOfficer',
			home: 'haven-mediterranean',
			card: 2,
			exposure: 0,
			slots: [null, null, null, null],
			played: false,
		},
		{
			name: 'Captain',
			job: 'captain',
			home: 'haven-north-atlantic',
			card: 7,
			exposure: 0,
			slots: [null, null, null, null],
			played: false,
		},
	] as CharacterFact[],
	spareCharacterCards: [
		{ card: 5, exposure: 2 },
		{ card: 6, exposure: 0 },
		{ card: 0, exposure: 0 },
		{ card: 8, exposure: 0 },
	],
	objectives: ['buildCenters', 'reconNewArea', 'connectCities', 'searches'] as ObjectiveId[],
	turningPoints: ['losingStreak'] as TurningPointId[],
	forSale: {
		abilities: ['broker', 'lookout', 'smuggler', 'scout'] as AbilityId[],
		scars: [
			'buildExtraCard',
			'wary',
			'haunted',
			'grasping',
			'oddHand',
			'rattled',
			'smallHand',
			'frail',
			'lineExtraCube',
			'searchDiscard',
			'laneExtraCube',
			'wasteful',
			'portBound',
		] as ScarId[],
		cityImprovements: ['triple', 'double', 'double', 'double'] as CityImprovementId[],
		infectionImprovements: [] as InfectionImprovementId[],
		permanent: ['tower', 'center', 'center'] as StructureKind[],
	},
};

const at = (id: string): CityId => {
	if (!pack.cities.some(city => city.id === id)) throw new Error(`The table names an unknown location ${id}`);
	return id as CityId;
};

function differs(what: string, ours: readonly unknown[], table: readonly unknown[]) {
	const a = [...ours].map(String).toSorted().join();
	const b = [...table].map(String).toSorted().join();
	if (a !== b) throw new Error(`The replay's ${what} (${a}) differ from the table's (${b})`);
}

export function tabletopSave(seed = 7): Save {
	const world: World = { campaign: newCampaign(seed), game: null, table: newTable() };
	const { campaign } = world;
	const last = TABLE.calendar.length - 1;

	for (const [index, result] of TABLE.calendar[0]!.entries())
		campaign.results.push({
			month: 0,
			attempt: (index + 1) as 1 | 2,
			won: result === 'won',
			gridCities: 0,
			rationing: campaign.rationing,
			characters: [],
		});
	for (let month = 1; month <= last; month++) {
		const games = TABLE.calendar[month]!;
		campaign.month = month;
		campaign.attempt = 1;
		readLegacy(world, 'setup');
		for (const seal of TABLE.openedByMonth[month] ?? []) openSeal(world, seal, false);
		readLegacy(world, 'gameEnd', games[0] === 'won');
		for (const [index, result] of games.entries()) {
			campaign.results.push({
				month,
				attempt: (index + 1) as 1 | 2,
				won: result === 'won',
				gridCities: gridCityCount(campaign),
				rationing: campaign.rationing,
				characters: [],
			});
			campaign.rationing = Math.max(0, Math.min(10, campaign.rationing + (result === 'won' ? -2 : 2)));
		}
	}

	const start = newCampaign(seed);
	differs(
		'unlocked actions',
		campaign.actions.filter(action => !start.actions.includes(action)),
		TABLE.actions,
	);
	differs('rules', campaign.rules, TABLE.rules);
	differs('stockpile bonus', [campaign.stockpileBonus], [TABLE.stockpileBonus]);
	differs(
		'revealed regions',
		campaign.regions.filter(region => !start.regions.includes(region)),
		TABLE.regions,
	);

	campaign.month = last + 1;
	campaign.attempt = 1;
	campaign.briefing = [];
	campaign.carriedProgress = {};
	campaign.freeAbilityUnits = 0;
	differs('opened packages and doors', campaign.opened, [
		...TABLE.packages.map(id => sealKey(pkg(id))),
		...TABLE.doors.map(id => sealKey(door(id))),
	]);
	differs('forced packages and doors', campaign.forced, [sealKey(door('60'))]);
	campaign.objectives = [...TABLE.objectives];
	campaign.turningPoints = [...TABLE.turningPoints];
	campaign.abilitiesForSale = [...TABLE.forSale.abilities];
	campaign.scars = [...TABLE.forSale.scars];
	campaign.cityImprovementsForSale = [...TABLE.forSale.cityImprovements];
	campaign.infectionImprovementsForSale = [...TABLE.forSale.infectionImprovements];
	campaign.permanentForSale = [...TABLE.forSale.permanent];
	campaign.names = Object.fromEntries(Object.entries(TABLE.havenNames).map(([id, name]) => [at(id), name]));

	for (const [id, fact] of Object.entries(TABLE.locations)) {
		const record = campaign.locations[at(id)]!;
		if (!record.revealed) throw new Error(`The table shows ${id} revealed, the replay does not`);
		const printed = pack.cities.find(city => city.id === id)!;
		if (fact.population !== undefined) record.population = fact.population;
		record.infested = Boolean(fact.infested) || Boolean(printed.startsInfested);
		record.permanent = [...(fact.permanent ?? [])];
	}
	// As July's game end would have: a forsaken city is infested for good, sticker or not.
	for (const city of pack.cities) if (isForsaken(campaign, city.id)) campaign.locations[city.id]!.infested = true;
	for (const [id, record] of Object.entries(campaign.locations))
		if (record.revealed && !(id in TABLE.locations)) throw new Error(`The replay reveals ${id}, the table does not`);

	const drawn = new Set(campaign.edges.map(edge => `${[edge.a, edge.b].toSorted().join('~')}:${edge.kind}`));
	for (const [a, b, kind] of TABLE.lines) {
		const key = `${[a, b].toSorted().join('~')}:${kind}`;
		if (!(`${kind}:${[a, b].toSorted().join('~')}` in pack.routeCourses))
			throw new Error(`The map has no course for the ${kind} route ${a} to ${b}`);
		if (drawn.has(key)) continue;
		drawn.add(key);
		campaign.edges.push({ a: at(a), b: at(b), kind });
	}

	campaign.playerCards = {};
	campaign.infectionCards = {};
	campaign.stored = { player: [], infection: [] };
	let next = 1;
	const id = (name: string) => `${name}#${next++}` as CardId;
	for (const fact of TABLE.cities)
		for (let copy = 0; copy < (fact.copies ?? 1); copy++) {
			const city = at(fact.city);
			const printed = [...(pack.searches[city] ?? [])];
			const search = (fact.search ?? []).map(([scope, scratched]) => {
				const index = printed.findIndex(box => box.scope === scope);
				if (index < 0) throw new Error(`${fact.city}'s card has a ${scope} search box the pack does not`);
				const [box] = printed.splice(index, 1);
				return { scope, result: box!.result, scratched };
			});
			const card = id(city);
			campaign.playerCards[card] = {
				id: card,
				kind: 'city',
				city,
				improvement: fact.improvement ?? null,
				search,
				companion: fact.companion ?? null,
			};
			if (fact.stored) campaign.stored.player.push(card);
		}
	for (const fact of TABLE.events)
		for (let copy = 0; copy < (fact.copies ?? 1); copy++) {
			const card = id(fact.event);
			campaign.playerCards[card] = { id: card, kind: 'event', event: fact.event, mode: fact.mode };
		}
	for (const boxesLeft of TABLE.produce) {
		const card = id('produce');
		campaign.playerCards[card] = { id: card, kind: 'produce', boxesLeft };
	}
	for (let copy = 0; copy < TABLE.epidemics; copy++) {
		const card = id('epidemic');
		campaign.playerCards[card] = { id: card, kind: 'epidemic' };
	}
	for (const fact of TABLE.infection)
		for (let copy = 0; copy < (fact.copies ?? 1); copy++) {
			const card = id(fact.city);
			campaign.infectionCards[card] = {
				id: card,
				kind: 'city',
				city: at(fact.city),
				improvement: fact.improvement ?? null,
			};
			if (fact.stored) campaign.stored.infection.push(card);
		}
	for (let copy = 0; copy < TABLE.gather; copy++) {
		const card = id('gather');
		campaign.infectionCards[card] = { id: card, kind: 'gather' };
	}
	const openedRegions = new Set<string>(['starting']);
	for (const seal of pack.seals) {
		if (!campaign.opened.includes(sealKey(seal.seal))) continue;
		for (const unlock of seal.unlocks) if (unlock.t === 'region') openedRegions.add(unlock.region);
	}
	for (const city of pack.cities) {
		if (city.kind !== 'city' || openedRegions.has(city.region)) continue;
		const boxes = pack.searches[city.id] ?? [];
		for (let copy = 0; copy < city.playerCards; copy++) {
			const card = id(city.id);
			campaign.playerCards[card] = {
				id: card,
				kind: 'city',
				city: city.id,
				improvement: null,
				companion: null,
				search: copy === 0 ? boxes.map(box => ({ ...box, scratched: false })) : [],
			};
		}
		for (let copy = 0; copy < (city.noInfectionCards ? 0 : city.population); copy++) {
			const card = id(`inf-${city.id}`);
			campaign.infectionCards[card] = {
				id: card,
				kind: 'city',
				city: city.id,
				improvement: null,
			};
		}
	}
	campaign.nextCardId = next;

	campaign.characters = {};
	campaign.characterCards = TABLE.spareCharacterCards.map(spare => ({
		track: paddedTrack(pack.characterCards[spare.card]!),
		exposure: spare.exposure,
	}));
	const played: CharacterId[] = [];
	for (const [index, fact] of TABLE.characters.entries()) {
		const character = `char-${index + 1}` as CharacterId;
		if (fact.slots.length !== pack.numbers.characterSlots)
			throw new Error(`${fact.name} has ${fact.slots.length} slots, not ${pack.numbers.characterSlots}`);
		campaign.characters[character] = {
			id: character,
			name: fact.name,
			job: fact.job,
			jobScar: null,
			home: at(fact.home),
			portrait: index % pack.numbers.portraits,
			slots: fact.slots.map(slot =>
				slot === null
					? null
					: 'ability' in slot
						? { kind: 'ability', id: slot.ability }
						: { kind: 'scar', id: slot.scar },
			),
			exposureTrack: paddedTrack(pack.characterCards[fact.card]!),
			exposure: fact.exposure,
			dead: false,
			diedAt: null,
			worker: false,
			carrier: false,
			player: null,
		} satisfies Character;
		if (fact.played) played.push(character);
	}
	for (const game of campaign.results.filter(entry => entry.month === last)) game.characters = played;

	return { v: 1, phase: 'lobby', world };
}
