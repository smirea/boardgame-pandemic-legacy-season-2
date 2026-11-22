import type { CityId, RegionId, UnchartedId } from '../ids';
import { candidateEdges, positions, redLines, routeCourses, unchartedPositions } from './geometry.generated';
import { sealKey } from './types';
import type {
	Color,
	DoorId,
	DossierDef,
	EventId,
	ContentPack,
	LegacyCardDef,
	LegacyCardKind,
	ObjectiveId,
	ReconRoute,
	SearchBoxDef,
	SealDef,
	SearchResult,
	Seal,
	Unlock,
} from './types';
import { cities, uncharted, edge, regions, startingEdges } from './world';

const city = (id: string) => id as CityId;
const pkg = (id: number): Seal => ({ t: 'package', id });
const door = (id: DoorId): Seal => ({ t: 'door', id });
const opens = (...doors: DoorId[]): Unlock[] => doors.map(id => ({ t: 'open', seal: door(id) }));

function route(
	id: string,
	at: string,
	color: Color,
	count: number,
	unique: boolean,
	opens: Seal | null,
	counts: ObjectiveId[],
	needsCenter = true,
): ReconRoute {
	return { id, city: city(at), color, count, unique, opens, needsCenter, counts };
}

const reconRoutes: ReconRoute[] = [
	route('north-america', 'washington', 'blue', 3, false, pkg(1), ['reconRegion', 'reconNewArea']),
	route('south-america', 'sao-paulo', 'yellow', 4, false, pkg(5), ['reconNewArea']),
	route('europe', 'london', 'blue', 4, true, pkg(4), ['reconNewArea']),
	route('africa', 'lagos', 'yellow', 5, true, pkg(7), ['reconNewArea']),
	route('middle-east', 'cairo', 'black', 4, true, pkg(2), ['reconNewArea']),
	// Hidden until a Monitor frequency or the October perimeter report reveals it.
	route('hidden:east-asia', 'kolkata', 'black', 5, true, pkg(3), ['reconNewArea', 'reconEastAsia']),
	route('coral-sea', 'jakarta', 'red', 2, false, door('59'), ['reconNewArea']),
	route('new-zealand', 'haven-coral-sea', 'red', 2, false, door('19'), ['reconNewArea'], false),
	route('hidden:plan-red', 'shanghai', 'red', 5, true, null, ['plan'], false),
	route('hidden:plan-black', 'shanghai', 'black', 4, true, null, ['plan'], false),
	route('hidden:plan-yellow', 'shanghai', 'yellow', 3, true, null, ['plan'], false),
	route('hidden:plan-blue', 'shanghai', 'blue', 3, true, null, ['plan'], false),
];

const land = (result: SearchResult): SearchBoxDef => ({ scope: 'land', result });
const sea = (result: SearchResult): SearchBoxDef => ({ scope: 'sea', result });
/** A lead to a lost haven: its door, or an action once the haven is already on the map. */
const lostHaven = (seal: Seal): SearchResult => ({ t: 'discover', seals: [seal], orAction: true });
const labFound = (at: string, ...seals: Seal[]): SearchResult => ({ t: 'discover', seals, lab: city(at) });

/** Each City card's search boxes, as the printed cards have them (`box-contents.md`, per package). */
const searches: Record<string, SearchBoxDef[]> = {
	chicago: [land({ t: 'supplies', amount: 2, from: 'stockpile' })],
	'san-francisco': [land({ t: 'supplies', amount: 3, from: 'reserve' }), sea(lostHaven(door('60')))],
	denver: [land({ t: 'companion', companion: 'lineman' })],
	atlanta: [land({ t: 'quarantineCard' })],
	'los-angeles': [land({ t: 'stockpile', amount: 4 }), sea(lostHaven(door('60')))],
	'mexico-city': [land({ t: 'companion', companion: 'trader' })],
	bogota: [land({ t: 'retrieve' })],
	lima: [land({ t: 'companion', companion: 'medic' }), sea(lostHaven(door('60')))],
	santiago: [land({ t: 'infest', opens: door('50') })],
	'buenos-aires': [
		land(labFound('buenos-aires', door('18'), door('20'))),
		sea({ t: 'supplies', amount: 3, from: 'reserve' }),
	],
	paris: [land({ t: 'companion', companion: 'builder' })],
	frankfurt: [land({ t: 'companion', companion: 'porter' })],
	'st-petersburg': [land({ t: 'companion', companion: 'tracker' }), sea({ t: 'freeEdge', kind: 'sea' })],
	moscow: [land({ t: 'giveCard' })],
	kinshasa: [land({ t: 'companion', companion: 'rigger' })],
	khartoum: [land({ t: 'giveCard' })],
	'dar-es-salaam': [land({ t: 'freeEdge', kind: 'land' }), sea(lostHaven(door('65')))],
	antananarivo: [land({ t: 'companion', companion: 'purifier' }), sea(lostHaven(door('65')))],
	johannesburg: [land(labFound('johannesburg', door('46'), door('20')))],
	baghdad: [land({ t: 'actions', amount: 2 })],
	riyadh: [land({ t: 'retrieve' })],
	tehran: [land({ t: 'removeHollow', amount: 2 })],
	delhi: [land({ t: 'companion', companion: 'fieldSurgeon' })],
	'new-mumbai': [land({ t: 'actions', amount: 1 }), sea(lostHaven(door('65')))],
	jakarta: [land({ t: 'companion', companion: 'shelterWright' })],
	'hong-kong': [land({ t: 'companion', companion: 'quartermaster' })],
	shanghai: [land({ t: 'nothing' })],
	seoul: [land({ t: 'freeEdge', kind: 'sea' })],
	osaka: [land({ t: 'companion', companion: 'marksman' })],
	tokyo: [land({ t: 'companion', companion: 'doubleAgent' })],
	utopia: [land({ t: 'companion', companion: 'informant' })],
};

const region = (id: string, ...connect: [string, string, 'land' | 'sea'][]): Unlock => ({
	t: 'region',
	region: id as RegionId,
	connect: connect.map(([a, b, kind]) => edge(a, b, kind)),
});

const numbered = (from: number, to: number, skip: number[] = []) =>
	Array.from({ length: to - from + 1 }, (_, index) => from + index)
		.filter(door => !skip.includes(door))
		.map(String);

/** The sealed packages and the dossier sheets, laid out as the box has them. */
const dossier: DossierDef = {
	packages: [1, 2, 3, 4, 5, 6, 7, 8],
	sheets: [
		['A', 'D', 'E', 'F', 'J', 'K', 'L', 'M', 'P', 'Q', 'R', 'U', 'Y', 'Z'],
		numbered(11, 26, [15, 16]),
		numbered(27, 40),
		numbered(41, 54),
		numbered(55, 60),
		numbered(61, 67),
	],
};

const sealed = (seal: Seal, name: string, unlocks: Unlock[] = [], reward?: Unlock[]): SealDef => ({
	seal,
	name,
	unlocks,
	...(reward ? { reward } : {}),
});
/** A door that only holds a reminder for the player aid or the board, with no rule of its own. */
const aid = (id: DoorId, name: string) => sealed(door(id), name);

/**
 * What each package and dossier door holds, as `docs/mechanics/box-contents.md` records it. A package's report opens
 * the doors that carry its map, actions and rules, so the box shows exactly what the table has torn open.
 */
const seals: SealDef[] = [
	sealed(
		pkg(1),
		'North America',
		[
			...opens('66', 'J', '23', 'L', '39'),
			{ t: 'scar', scar: 'frail' },
			{ t: 'scar', scar: 'searchDiscard' },
			{ t: 'scar', scar: 'lineExtraCube' },
		],
		[{ t: 'event', event: 'purge', mode: 'unrationed', now: ['hand'] }],
	),
	sealed(
		pkg(2),
		'Middle East and South Asia',
		[...opens('62', '53', 'F', '14'), { t: 'gather', cards: 4 }],
		[{ t: 'event', event: 'mentor', mode: 'unrationed', now: ['hand'] }],
	),
	sealed(
		pkg(3),
		'East Asia',
		[
			...opens('56', '63'),
			{ t: 'gather', cards: 4 },
			{ t: 'action', action: 'buildShelter' },
			{ t: 'permanentStructure', structure: 'shelter', copies: 5 },
			{ t: 'infectionImprovement', improvement: 'rebirth', copies: 2 },
		],
		[{ t: 'event', event: 'safeHouses', mode: 'unrationed', now: ['hand'] }],
	),
	sealed(
		pkg(4),
		'Europe',
		[...opens('64'), { t: 'action', action: 'shuttle' }],
		[{ t: 'event', event: 'exile', mode: 'unrationed', now: ['hand'] }],
	),
	sealed(
		pkg(5),
		'South America',
		[
			...opens('67', 'J', '23', 'L', '39'),
			{ t: 'ability', ability: 'facilitator' },
			{ t: 'ability', ability: 'outrider' },
			{ t: 'ability', ability: 'foreman' },
		],
		[{ t: 'event', event: 'stockUp', mode: 'unrationed', now: ['hand'] }],
	),
	sealed(pkg(6), 'Eastern Pacific haven reached', [
		{ t: 'action', action: 'inoculate' },
		{ t: 'rule', rule: 'storage' },
		{ t: 'stockpileBonus', amount: 15, fresh: true },
		{ t: 'event', event: 'surplus', mode: 'permanent', copies: 3, now: ['hand', 'discard', 'discard'] },
	]),
	sealed(
		pkg(7),
		'Africa',
		[
			...opens('57', 'F', '14'),
			{ t: 'action', action: 'buildTower' },
			{ t: 'action', action: 'transmit' },
			{ t: 'permanentStructure', structure: 'tower', copies: 4 },
		],
		[{ t: 'event', event: 'antidote', mode: 'unrationed', now: ['hand'] }],
	),
	sealed(
		pkg(8),
		'Utopia',
		[region('utopia', ['shanghai', 'utopia', 'land']), { t: 'gather', cards: 4 }, ...opens('61')],
		[{ t: 'event', event: 'riotControl', mode: 'unrationed', now: ['discard'] }],
	),

	sealed(door('A'), 'Forsaken cities', [{ t: 'rule', rule: 'forsaken' }, ...opens('12', '50')]),
	sealed(door('D'), 'Hollow Men at setup', [{ t: 'rule', rule: 'hollowSetup' }]),
	sealed(door('E'), 'More Epidemics', [{ t: 'rule', rule: 'epidemicScaling' }]),
	sealed(door('F'), 'Infested cities'),
	sealed(door('J'), 'Establish Supply Line', [{ t: 'action', action: 'establishLine' }]),
	sealed(door('K'), 'Chart Sea Lane', [{ t: 'action', action: 'chartLane' }]),
	sealed(door('L'), 'Search', [{ t: 'action', action: 'search' }]),
	sealed(door('M'), 'Monitor', [{ t: 'action', action: 'monitor' }]),
	sealed(door('P'), 'Broadcast Misinformation', [{ t: 'action', action: 'broadcast' }]),
	sealed(door('Q'), 'Self-Infect', [{ t: 'rule', rule: 'carrier' }]),
	sealed(door('R'), 'Epidemics strike storage', [{ t: 'rule', rule: 'epidemicFromStorage' }]),
	sealed(door('U'), 'Out of Hollow Men'),
	aid('Y', 'Hollow Men setup marker'),
	aid('Z', 'Summit'),

	sealed(door('11'), 'Indian Ocean haven reached', [
		{ t: 'actions', amount: 4 },
		{ t: 'stockpileBonus', amount: 15 },
	]),
	aid('12', 'Forsaken cities legend'),
	sealed(door('13'), 'Lab breakthroughs', [{ t: 'rule', rule: 'labBreakthroughs' }]),
	aid('14', 'Infested cities legend'),
	sealed(door('17'), 'The Hollow Men defect', [...opens('58'), { t: 'turningPoint', id: 'defection', over: true }]),
	sealed(door('18'), 'The Immunologist', [{ t: 'job', job: 'immunologist', home: city('buenos-aires') }]),
	sealed(door('19'), 'Topaz lab found', [
		{ t: 'lab', city: city('wellington') },
		...opens('51', '41', '61', '13', '30'),
	]),
	sealed(door('20'), "You've found us", opens('61', '30', '13')),
	sealed(door('21'), 'Frankfurt destroyed', [{ t: 'destroy', city: city('frankfurt') }]),
	sealed(door('22'), 'Pearl lab reached', [{ t: 'lab', city: city('lake-baikal') }, ...opens('Q', '38', '27', '32')]),
	aid('23', 'Supply line reference'),
	aid('24', 'Sea lane reference'),
	aid('25', 'Monitor reference'),
	aid('26', 'Summit'),
	aid('27', 'Carrier stickers'),
	sealed(door('28'), 'New abilities', [
		{ t: 'ability', ability: 'misinformationSpecialist' },
		{ t: 'ability', ability: 'saboteur' },
		{ t: 'ability', ability: 'rehabNurse' },
	]),
	sealed(door('29'), 'New abilities', [
		{ t: 'ability', ability: 'investigator' },
		{ t: 'ability', ability: 'soldier' },
		{ t: 'ability', ability: 'navigator' },
	]),
	aid('30', 'Lab markers'),
	sealed(door('31'), 'New abilities', [
		{ t: 'ability', ability: 'lookout' },
		{ t: 'ability', ability: 'scout' },
		{ t: 'ability', ability: 'smuggler' },
	]),
	aid('32', 'Carrier stickers'),
	sealed(door('33'), 'More Infection card improvements', [
		{ t: 'infectionImprovement', improvement: 'cordon' },
		{ t: 'infectionImprovement', improvement: 'lockdown' },
	]),
	sealed(door('34'), 'Permanent supply centers', [{ t: 'permanentStructure', structure: 'center', copies: 3 }]),
	sealed(door('35'), 'Signals triangulated', [{ t: 'frequencyHint' }]),
	sealed(door('36'), 'More permanent supply centers', [{ t: 'permanentStructure', structure: 'center', copies: 3 }]),
	aid('37', 'Broadcast reference'),
	aid('38', 'Self-Infect reference'),
	aid('39', 'Search reference'),
	aid('40', 'Summit'),
	sealed(door('41'), 'Vector Control', [{ t: 'job', job: 'vectorControl', home: city('wellington') }]),
	sealed(door('42'), 'Broken Link', [{ t: 'infectionImprovement', improvement: 'cordon', copies: 2 }]),
	sealed(door('43'), 'Decryption Key', [{ t: 'cityImprovement', improvement: 'wild' }]),
	sealed(door('44'), 'The Sanitation Officer', [
		{ t: 'job', job: 'sanitationOfficer', home: city('haven-mediterranean') },
	]),
	sealed(door('45'), 'Local Operatives', [{ t: 'cityImprovement', improvement: 'redWild', copies: 2 }]),
	sealed(door('46'), 'The Scientist', [{ t: 'job', job: 'scientist', home: city('johannesburg') }]),
	sealed(door('47'), 'New scars', [
		{ t: 'scar', scar: 'laneExtraCube' },
		{ t: 'scar', scar: 'portBound' },
		{ t: 'scar', scar: 'wasteful' },
	]),
	sealed(door('48'), 'More scars', [
		{ t: 'scar', scar: 'susceptible' },
		{ t: 'scar', scar: 'fearOfNeedles' },
		{ t: 'scar', scar: 'fearOfFlying' },
	]),
	sealed(door('49'), 'The Captain', [{ t: 'job', job: 'captain', home: city('haven-north-atlantic') }]),
	sealed(door('50'), 'Infestation', [...opens('F', '14')]),
	sealed(door('51'), 'Wellington', [region('new-zealand', ['haven-coral-sea', 'wellington', 'sea'])]),
	sealed(door('52'), 'A route into East Asia', [{ t: 'route', route: 'hidden:east-asia' }]),
	sealed(door('53'), 'The way east is unknown'),
	aid('54', 'Summit'),
	aid('55', 'Epidemic reference'),
	sealed(door('56'), 'North East Asia'),
	sealed(door('57'), 'Africa map', [region('africa', ['kinshasa', 'lagos', 'land'])]),
	sealed(door('58'), 'A gap in the wall'),
	sealed(door('59'), 'Coral Sea haven', [
		{ t: 'haven', city: city('haven-coral-sea') },
		{ t: 'region', region: 'coral-sea' as RegionId, connect: [edge('jakarta', 'haven-coral-sea', 'sea')] },
	]),
	sealed(door('60'), 'Eastern Pacific haven', [
		{ t: 'haven', city: city('haven-eastern-pacific') },
		{ t: 'edge', edge: edge('lima', 'haven-eastern-pacific', 'sea') },
	]),
	sealed(door('61'), 'Lake Baikal', [{ t: 'haven', city: city('lake-baikal') }]),
	sealed(door('62'), 'Middle East map', [region('middle-east', ['baghdad', 'cairo', 'land'])]),
	sealed(door('63'), 'South East Asia map', [region('east-asia', ['jakarta', 'kolkata', 'sea'])]),
	sealed(door('64'), 'Europe map', [region('europe', ['paris', 'london', 'land'])]),
	sealed(door('65'), 'Indian Ocean haven', [{ t: 'haven', city: city('haven-indian-ocean') }]),
	sealed(door('66'), 'North America map', [region('north-america', ['chicago', 'washington', 'land'])]),
	sealed(door('67'), 'South America map', [region('south-america', ['buenos-aires', 'sao-paulo', 'sea'])]),
];

const perimeter = (seal: Seal, penalty?: Unlock[]): Unlock => ({
	t: 'perimeter',
	seal,
	...(penalty ? { penalty } : {}),
});

type CardExtras = Pick<LegacyCardDef, 'halt' | 'when'>;

/** One printed Legacy card, by the code printed on it. */
function card(
	code: string,
	kind: LegacyCardKind,
	title: string,
	text: string,
	unlocks: Unlock[] = [],
	extras: CardExtras = {},
): LegacyCardDef {
	return { id: code, month: Number(code.slice(0, 2)), kind, title, text, unlocks, ...extras };
}

const archive = (code: string, extras?: CardExtras) =>
	card(code, 'archive', 'Journal entry', 'An entry from the archive, kept in the reserve.', [], extras);
const objective = (code: string, id: ObjectiveId, title: string, text: string, extras?: CardExtras) =>
	card(code, 'objective', title, text, [{ t: 'objectives', add: [id] }], extras);
const rationed = (code: string, event: EventId, title: string, extras?: CardExtras) =>
	card(
		code,
		'event',
		title,
		'A new Rationed Event joins the reserve.',
		[{ t: 'event', event, mode: 'rationed' }],
		extras,
	);
const rightNow = (code: string, doors: DoorId[], extras?: CardExtras) =>
	card(
		code,
		'pause',
		'Right now!',
		`Open door${doors.length > 1 ? 's' : ''} ${doors.join(', ')}.`,
		opens(...doors),
		extras,
	);
const epidemicCard = (code: string, extras?: CardExtras) =>
	card(code, 'epidemic', 'Epidemic', 'One more Epidemic card goes into the box.', [{ t: 'epidemicCard' }], extras);
const tier = (code: string, title: string, when: 'delivered' | 'notDelivered') =>
	card(code, 'ending', title, 'The outcome for the final score.', [], { when });

/**
 * The Legacy deck as printed, top first. A card's `halt` stands for the STOP or PAUSE printed on the back of
 * the card after it: reading stops there until that card's moment comes.
 */
const legacyDeck: LegacyCardDef[] = [
	card(
		'00-01',
		'prologue',
		'Prologue',
		'Play with all rules except: no Legacy deck, no character exposure, no Recon, no System-Wide Production, and no Game End upgrades. Destroyed when January begins.',
	),
	card('00-02', 'objective', 'Build 3 supply centers', 'The Prologue objective.', [], { halt: 'stop' }),

	card(
		'01-01',
		'stop',
		'January',
		'The campaign begins. Recon is now available, and the Prologue cards are destroyed.',
		[
			{ t: 'objectives', remove: ['prologueCenters'] },
			{ t: 'action', action: 'recon' },
			{ t: 'cityImprovement', improvement: 'double', copies: 3 },
			{ t: 'cityImprovement', improvement: 'triple' },
			{ t: 'infectionImprovement', improvement: 'wellStocked', copies: 2 },
			{ t: 'infectionImprovement', improvement: 'lockdown', copies: 2 },
		],
	),
	archive('01-02'),
	card('01-03', 'priorities', 'New priorities', 'This month 2 objectives are mandatory.', [
		{ t: 'required', count: 2 },
	]),
	objective('01-04', 'buildCenters', 'Build 3 new supply centers', 'Build 3 new supply centers.'),
	objective(
		'01-05',
		'reconRegion',
		'Recon North America',
		'Recon North America. If completed in a lost first game of January, it still counts in the second game.',
	),
	card(
		'01-06',
		'turningPoint',
		'Forsaken Cities',
		'Turning point: at Game End, if a city has population 0, open doors A and 12.',
		[{ t: 'turningPoint', id: 'firstForsaken' }],
		{ halt: 'pause' },
	),
	card('01-07', 'pause', 'Right now!', 'New Rationed Events follow, for the reserve.'),
	rationed('01-08', 'cardSwap', 'Data Transfer'),
	rationed('01-09', 'spreadOut', 'Dispersal'),
	rationed('01-10', 'cleanse', 'Drastic Measures'),
	rationed('01-11', 'forecast', 'Extended Forecast', { halt: 'stop' }),

	card('02-01', 'stop', 'Perimeter report', 'If door 66 is still sealed, Package 1 opens without its reward.', [
		perimeter(pkg(1)),
	]),
	archive('02-02'),
	card('02-03', 'priorities', 'New priorities', 'Recon North America is destroyed. 2 objectives are still mandatory.', [
		{ t: 'objectives', remove: ['reconRegion'] },
	]),
	objective('02-04', 'reconNewArea', 'Recon 1 unknown region', 'Recon 1 unknown region.'),
	objective('02-05', 'connectCities', 'Connect 2 new cities to the grid', 'Connect 2 new cities to the grid.'),
	card(
		'02-06',
		'turningPoint',
		'Give Us the Tools',
		'Turning point: after 4 games lost in a row, up to 10 extra reserve cubes go to the stockpile at setup, three times.',
		[{ t: 'turningPoint', id: 'losingStreak' }],
		{ halt: 'pause' },
	),
	rightNow('02-07', ['34']),
	rationed('02-08', 'cache', 'Hidden Stockpile'),
	rationed('02-09', 'encore', 'It Worked the First Time'),
	rationed('02-10', 'secondWind', 'Extended Time', { halt: 'stop' }),

	card(
		'03-01',
		'stop',
		'Perimeter report',
		'If door 67 is still sealed: a warning that South America is still unexplored.',
		[{ t: 'scratch', box: '03-01:1', unlessOpen: door('67') }],
	),
	archive('03-02'),
	card('03-03', 'priorities', 'New priorities', 'From now on 3 objectives are mandatory each month.', [
		{ t: 'required', count: 3 },
	]),
	objective('03-04', 'searches', 'Complete 2 searches', 'Complete 2 searches.'),
	objective(
		'03-05',
		'lostHaven',
		'Access a lost haven',
		'Access a lost haven. Destroy this card at the end of the game in which you complete it.',
		{ halt: 'pause' },
	),
	rightNow('03-06', ['K', '24', '47', 'E']),
	epidemicCard('03-07'),
	epidemicCard('03-08'),
	epidemicCard('03-09'),
	epidemicCard('03-10'),
	epidemicCard('03-11', { halt: 'stop' }),

	card('04-01', 'stop', 'Perimeter report', 'If door 67 is still sealed, Package 5 opens without its reward.', [
		perimeter(pkg(5)),
	]),
	archive('04-02', { halt: 'pause' }),
	rightNow('04-03', ['42'], { halt: 'stop' }),

	card('05-01', 'stop', 'Perimeter report', 'If door 60 is still sealed, the eastern Pacific haven goes on the map.', [
		perimeter(door('60')),
	]),
	archive('05-02', { halt: 'pause' }),
	rightNow('05-03', ['31', '36'], { halt: 'stop' }),

	card(
		'06-01',
		'stop',
		'Perimeter report',
		'If door 64 is still sealed, Package 4 opens without its reward, and door 21 destroys Frankfurt.',
		[perimeter(pkg(4), opens('21'))],
	),
	archive('06-02', { halt: 'pause' }),
	card('06-03', 'pause', 'Right now!', 'New volunteers join. Open doors 44, 49.', opens('44', '49')),
	rationed('06-04', 'massInoculation', 'Inoculation Unit'),
	rationed('06-05', 'openWaters', 'Expeditionary Voyage', { halt: 'stop' }),

	card('07-01', 'stop', 'Perimeter report', 'If door 57 is still sealed, Package 7 opens without its reward.', [
		perimeter(pkg(7)),
	]),
	archive('07-02'),
	objective(
		'07-03',
		'triangulate',
		'Triangulate signals',
		'Have a satellite tower in a blue, a yellow, and a black city. When completed, open doors 43 and 52.',
		{ halt: 'stop' },
	),

	card('08-01', 'stop', 'Perimeter report', 'If door 62 is still sealed, Package 2 opens without its reward.', [
		perimeter(pkg(2)),
	]),
	card(
		'08-02',
		'archive',
		'Journal entry',
		'Spend up to 3 free production units on character abilities now, before the supplies go out.',
		[{ t: 'freeAbilityUnits', amount: 3 }],
	),
	card('08-03', 'priorities', 'Right now!', 'Open doors M, 25.', opens('M', '25')),
	card(
		'08-04',
		'scanner',
		'Frequency Scanner',
		'Each Monitor action scratches one of its ten frequencies: an orange square opens a door, a white one takes Player cards back from the discard pile.',
		[],
		{ halt: 'pause' },
	),
	rightNow('08-05', ['29', '48'], { halt: 'stop' }),

	card('09-01', 'stop', 'Perimeter report', 'If door 65 is still sealed, the Indian Ocean haven goes on the map.', [
		perimeter(door('65')),
	]),
	archive('09-02'),
	card('09-03', 'priorities', 'New priorities', 'Recon 1 unknown region is destroyed. Open doors R, 55, D, Y, U.', [
		{ t: 'objectives', remove: ['reconNewArea'] },
		...opens('R', '55', 'D', 'Y', 'U'),
	]),
	objective(
		'09-04',
		'reconEastAsia',
		'Recon East Asia',
		'Recon East Asia. If completed in a lost first game of September, it still counts in the second game.',
		{ halt: 'pause' },
	),
	rightNow('09-05', ['33']),
	rationed('09-06', 'scavenge', 'Cautious Approach', { halt: 'stop' }),

	card(
		'10-01',
		'stop',
		'Perimeter report',
		'If doors 56 and 63 are not both open, Package 3 opens without its reward and one character takes a scar.',
		[perimeter(pkg(3), [{ t: 'owedScar' }])],
	),
	archive('10-02'),
	card(
		'10-03',
		'priorities',
		'New priorities',
		'Recon East Asia, Connect 2 new cities and Complete 2 searches are destroyed. 2 objectives are mandatory. Open doors P, 37.',
		[
			{ t: 'objectives', remove: ['reconEastAsia', 'connectCities', 'searches'] },
			{ t: 'required', count: 2 },
			...opens('P', '37'),
		],
	),
	objective(
		'10-04',
		'defect',
		'Get Hollow Men to defect',
		'Have at least 1 Hollow Man on 3 different havens. If completed in a lost first game of October, it still counts in the second game.',
	),
	card(
		'10-05',
		'turningPoint',
		'Hollow Men Have Defected',
		'Turning point: at Game End, with a Hollow Man on 3 different havens, open door 17.',
		[{ t: 'turningPoint', id: 'defection' }],
		{ halt: 'pause' },
	),
	rightNow('10-06', ['28', '45']),
	rationed('10-07', 'mobileShelters', 'Mobile Shelters', { halt: 'stop' }),

	card(
		'11-01',
		'stop',
		'Intelligence report',
		'If the Hollow Men have not defected, door 17 opens anyway and two characters take a scar.',
		[perimeter(door('17'), [{ t: 'owedScar' }, { t: 'owedScar' }])],
	),
	archive('11-02'),
	card(
		'11-03',
		'priorities',
		'New priorities',
		'Build 3 new supply centers and Get Hollow Men to defect are destroyed. Only 1 objective is mandatory.',
		[
			{ t: 'objectives', remove: ['buildCenters', 'defect'] },
			{ t: 'required', count: 1 },
		],
	),
	objective(
		'11-04',
		'plan',
		'Complete the Plan',
		'Complete all four parts of The Plan. Destroy this card at the end of the game in which you complete it.',
	),
	card(
		'11-05',
		'plan',
		'The Plan',
		'Four recons at Shanghai, no supply center needed: 5 different red cards, 4 black, 3 yellow, 3 blue. Checked boxes carry over.',
		[
			{ t: 'route', route: 'hidden:plan-red' },
			{ t: 'route', route: 'hidden:plan-black' },
			{ t: 'route', route: 'hidden:plan-yellow' },
			{ t: 'route', route: 'hidden:plan-blue' },
		],
		{ halt: 'stop' },
	),

	card('12-01', 'stop', 'Perimeter report', 'If the Plan is not complete, Package 8 opens without its reward.', [
		perimeter(pkg(8)),
	]),
	archive('12-02'),
	card('12-03', 'priorities', 'New priorities', 'The Plan cards are destroyed. Only 1 objective is mandatory.', [
		{ t: 'objectives', remove: ['plan'] },
		{ t: 'required', count: 1 },
	]),
	objective(
		'12-04',
		'deliverSample',
		'Deliver the Sample',
		'Have a player carrying the sample in Johannesburg, with a supply center in Johannesburg.',
		{ halt: 'finale' },
	),
	card('12-05', 'stop', 'At last', 'The campaign is over. What happens next, then the final score.'),
	tier('12-06', 'If you failed to deliver the sample', 'notDelivered'),
	tier('12-07', 'If you delivered the sample', 'delivered'),
	card('12-08', 'reckoning', 'The Final Reckoning', 'The campaign is scored.'),
	tier('12-09', 'Did not deliver: 851 and above, 701 to 850', 'notDelivered'),
	tier('12-10', 'Did not deliver: 551 to 700, 401 to 550, 400 and below', 'notDelivered'),
	tier('12-11', 'Delivered: 851 and above, 701 to 850', 'delivered'),
	tier('12-12', 'Delivered: 551 to 700, 401 to 550, 400 and below', 'delivered'),
	// Nothing printed stops the reading here, so the campaign ends on this card.
	card('12-13', 'end', 'Congratulations', 'The end of the Legacy deck and of the campaign.'),
];

export const pack: ContentPack = {
	regions,
	cities,
	edges: startingEdges,
	candidateEdges,
	positions,
	routeCourses,
	redLines,
	uncharted: uncharted.map(patch => {
		const at = unchartedPositions[patch.id];
		if (!at) throw new Error(`No position for the uncharted ground ${patch.id}: rerun gen-geometry.ts`);
		return { id: patch.id as UnchartedId, at, revealedWith: patch.revealedWith as CityId | null };
	}),
	reconRoutes,
	searches: searches as ContentPack['searches'],
	jobs: [
		{
			id: 'administrator',
			name: 'Administrator',
			text: 'Once per turn, as an action, move any pawn to the location of another pawn.',
			starting: true,
		},
		{
			id: 'radioOperator',
			name: 'Radio Operator',
			text: 'On your turn, transfer supplies with a character in any location.',
			starting: true,
		},
		{
			id: 'laborer',
			name: 'Laborer',
			text: 'May build a supply center with 1 card fewer by also spending 2 cubes.',
			starting: true,
		},
		{
			id: 'farmer',
			name: 'Farmer',
			text: 'Once per turn, a Deliver right after Make Supplies is free.',
			starting: true,
		},
		{
			id: 'instructor',
			name: 'Instructor',
			text: 'Once per turn, Share Knowledge may give any Player card to a character in the same location.',
			starting: true,
		},
		{ id: 'immunologist', name: 'Immunologist', text: 'Make Supplies takes cubes from the reserve.', starting: false },
		{
			id: 'captain',
			name: 'Captain',
			text: 'Free: discard any City card to move to any port on your sea route.',
			starting: false,
		},
		{
			id: 'sanitationOfficer',
			name: 'Sanitation Officer',
			text: 'Free: discard 2 cards to take a City or Produce Supplies card from the discard pile.',
			starting: false,
		},
		{
			id: 'scientist',
			name: 'Scientist',
			text: "Once per turn, free: destroy this city's Infection card in the discard pile.",
			starting: false,
		},
		{
			id: 'vectorControl',
			name: 'Vector Control Expert',
			text: 'Build Shelter needs no card and works in any location.',
			starting: false,
		},
	],
	abilities: [
		{ id: 'recordKeeper', name: 'Record Keeper', text: 'Hand limit +1.', cost: 1 },
		{ id: 'helmsman', name: 'Helmsman', text: 'Your first Drive or Ferry each turn is free.', cost: 3 },
		{ id: 'architect', name: 'Architect', text: 'Build a supply center with 1 card fewer.', cost: 3 },
		{ id: 'courier', name: 'Courier', text: 'Deliver supplies to an adjacent location.', cost: 3 },
		{ id: 'scout', name: 'Scout', text: 'Recon without a supply center.', cost: 2 },
		{ id: 'navigator', name: 'Navigator', text: 'Once per turn, Chart Sea Lane costs no cubes.', cost: 1 },
		{
			id: 'lookout',
			name: 'Lookout',
			text: "Search by taking this city's card from the discard pile into your hand.",
			cost: 2,
		},
		{
			id: 'broker',
			name: 'Broker',
			text: 'As an action, discard a City card to take one of the same colour from the discard pile.',
			cost: 2,
		},
		{
			id: 'saboteur',
			name: 'Saboteur',
			text: 'As an action, discard a City card to remove 1 Hollow Man from a city of that colour.',
			cost: 2,
		},
		{
			id: 'investigator',
			name: 'Investigator',
			text: 'Once per turn, as an action, discard a Player card to take any City card from the discard pile.',
			cost: 3,
		},
		{
			id: 'supplier',
			name: 'Supplier',
			text: 'Once per turn, as an action, move 1 cube from the stockpile to a city whose card you hold.',
			cost: 3,
		},
		{
			id: 'facilitator',
			name: 'Facilitator',
			text: 'Once per turn, as an action, take any card from a player in your location.',
			cost: 2,
		},
		{
			id: 'runner',
			name: 'Runner',
			text: 'As an action, discard any City card to move from a haven or supply center to anywhere on the grid.',
			cost: 1,
		},
		{ id: 'foreman', name: 'Foreman', text: 'Supply lines cost 1 cube fewer.', cost: 2 },
		{ id: 'outrider', name: 'Outrider', text: 'Recon with 1 card fewer.', cost: 3 },
		{
			id: 'soldier',
			name: 'Soldier',
			text: 'Leaving a location that holds Hollow Men, discard a City card of its colour instead of being exposed.',
			cost: 2,
		},
		{
			id: 'misinformationSpecialist',
			name: 'Misinformation Specialist',
			text: 'As an action, move a Hollow Man from your city to a neighbouring city that holds 2 or fewer.',
			cost: 2,
		},
		{
			id: 'rehabNurse',
			name: 'Rehab Nurse',
			text: 'As an action, discard 2 Player cards to take any stored City card into your hand.',
			cost: 1,
		},
		{
			id: 'coordinator',
			name: 'Coordinator',
			text: 'Free: move a pawn from an adjacent location to yours.',
			cost: 2,
		},
		{
			id: 'smuggler',
			name: 'Smuggler',
			text: 'As an action, discard a City card to put 1 cube from the reserve in that city.',
			cost: 1,
		},
	],
	scars: [
		{ id: 'reconExtraCard', name: 'Shaken', text: 'Recon needs 1 extra card.', slots: 1 },
		{ id: 'lineExtraCube', name: 'Injured', text: 'Supply lines cost 1 more cube.', slots: 1 },
		{ id: 'laneExtraCube', name: 'Seasick', text: 'Sea lanes cost 1 more cube.', slots: 1 },
		{ id: 'searchDiscard', name: 'Careless', text: 'Discard the City card you searched.', slots: 1 },
		{ id: 'smallHand', name: 'Burdened', text: 'Hand limit -1.', slots: 1 },
		{
			id: 'wasteful',
			name: 'Wasteful',
			text: 'Each Make Supplies also moves 1 cube from the stockpile to the reserve.',
			slots: 1,
		},
		{ id: 'portBound', name: 'Landsick', text: 'Starting a turn anywhere but a port costs 1 action.', slots: 1 },
		{ id: 'oddHand', name: 'Fixated', text: 'End your turn holding an odd number of cards, or discard 1.', slots: 1 },
		{
			id: 'rattled',
			name: 'Rattled',
			text: 'Each Epidemic sends the cubes on this character back to the stockpile.',
			slots: 1,
		},
		{
			id: 'plagueShy',
			name: 'Squeamish',
			text: 'Starting a turn in a location with a Plague cube costs 1 action.',
			slots: 1,
		},
		{ id: 'frail', name: 'Frail', text: 'Carries at most 3 cubes. Any more go back to the stockpile.', slots: 1 },
		{
			id: 'haunted',
			name: 'Haunted',
			text: 'Leaving a city that holds no cubes costs a card from your hand.',
			slots: 1,
		},
		{
			id: 'grasping',
			name: 'Grasping',
			text: 'Deliver may not place the last 2 cubes this character carries.',
			slots: 1,
		},
		{ id: 'buildExtraCard', name: 'Exacting', text: 'Build Supply Center needs 1 extra card.', slots: 1 },
		{
			id: 'wary',
			name: 'Wary',
			text: 'May not leave a haven that holds no cubes while carrying cubes.',
			slots: 1,
		},
		{
			id: 'susceptible',
			name: 'Susceptible',
			text: 'Starting a turn in an infested city exposes you twice.',
			slots: 1,
		},
		{ id: 'fearOfNeedles', name: 'Fear of Needles', text: 'May not Inoculate.', slots: 1 },
		{
			id: 'fearOfFlying',
			name: 'Fear of Flying',
			text: 'Shuttle Flight costs a card from your hand, when you hold one.',
			slots: 1,
		},
		{
			id: 'carrier',
			name: 'Carrier',
			text: 'Moves only by Drive or Ferry and discards a matching card to enter a city. Dies at game end.',
			slots: 2,
		},
	],
	companions: [
		{
			id: 'builder',
			name: 'Engineer',
			text: 'While in your hand: Build Supply Center needs 1 fewer card (may include this card).',
			spent: false,
		},
		{
			id: 'lineman',
			name: 'Logistics Expert',
			text: 'While in your hand: Establish Supply Lines costs 1 fewer Supply cube.',
			spent: false,
		},
		{
			id: 'rigger',
			name: 'Technician',
			text: 'While in your hand: Build Satellite Tower costs 1 fewer Supply cube.',
			spent: false,
		},
		{
			id: 'tracker',
			name: 'Operative',
			text: 'While in your hand: Search is a free action.',
			spent: false,
		},
		{
			id: 'fieldSurgeon',
			name: 'Vector Control Technician',
			text: 'While in your hand: no exposure when beginning your turn in an infested city.',
			spent: false,
		},
		{
			id: 'trader',
			name: 'Scout',
			text: 'While in your hand, as an action: discard a City card (including this card) to draw a same-colour City card from the Player discard pile.',
			spent: false,
		},
		{
			id: 'porter',
			name: 'Messenger',
			text: 'While in your hand, free action: move Supply cubes from an adjacent location into yours.',
			spent: false,
		},
		{
			id: 'medic',
			name: 'Herbalist',
			text: 'Play at any time (discard, reusable): remove 1 Plague cube from your location.',
			spent: true,
		},
		{
			id: 'purifier',
			name: 'Containment Specialist',
			text: 'Play at any time (discard, reusable): remove all Plague cubes from 1 location on the grid.',
			spent: true,
		},
		{
			id: 'shelterWright',
			name: 'Builder',
			text: 'Play at any time (discard, reusable): place a shelter on 1 city on the grid.',
			spent: true,
		},
		{
			id: 'marksman',
			name: 'Local Resistance',
			text: 'Play at any time (discard, reusable): remove 1 Hollow Men figure from anywhere on the grid.',
			spent: true,
		},
		{
			id: 'quartermaster',
			name: 'Structural Engineer',
			text: 'While in your hand: Build Shelter may discard a City card of any colour (including this card).',
			spent: false,
		},
		{
			id: 'doubleAgent',
			name: 'Spies',
			text: 'Counts as 2 unique red cards for the Recon action (discarded as normal, reusable).',
			spent: false,
		},
		{
			id: 'informant',
			name: 'Informant',
			text: 'Play at any time (discard, reusable): move up to 4 Utopia Infection cards from the Infection discard pile to the Game End area.',
			spent: true,
		},
	],
	events: [
		{ id: 'airlift', name: 'Airlift', text: 'Move any pawn to any location on the grid.' },
		{ id: 'quietNight', name: 'One Quiet Night', text: 'Skip the next Infect step.' },
		{
			id: 'resilience',
			name: 'Resilient Population',
			text: 'Set aside up to 2 discarded Infection cards of one city until game end.',
		},
		{ id: 'handout', name: 'Team Bravo', text: 'Move up to 2 cubes from the stockpile to any locations on the map.' },
		{ id: 'cardSwap', name: 'Data Transfer', text: 'Two players trade one card each.' },
		{ id: 'spreadOut', name: 'Dispersal', text: 'Move up to 3 cubes from one haven to locations on the grid.' },
		{ id: 'cleanse', name: 'Drastic Measures', text: 'Remove up to 2 Plague cubes from the grid.' },
		{
			id: 'forecast',
			name: 'Extended Forecast',
			text: 'Look at the top 8 Infection cards and put them back in any order.',
		},
		{ id: 'cache', name: 'Hidden Stockpile', text: 'Move 6 cubes from the reserve to a location with a pawn.' },
		{
			id: 'encore',
			name: 'It Worked the First Time',
			text: 'Take a Rationed Event from the Player discard pile into your hand.',
		},
		{ id: 'secondWind', name: 'Extended Time', text: 'The active player gains 3 actions this turn.' },
		{
			id: 'massInoculation',
			name: 'Inoculation Unit',
			text: 'Put up to 3 cards from the Infection discard pile into storage. May be played while an Epidemic waits to reshuffle.',
		},
		{
			id: 'scavenge',
			name: 'Cautious Approach',
			text: 'Draw the top 4 Player cards. Keep the City cards, discard the rest without effect.',
		},
		{
			id: 'openWaters',
			name: 'Expeditionary Voyage',
			text: 'The active player charts a sea lane from their port for free. Region lines do not limit it.',
		},
		{ id: 'safeHouses', name: 'Biodome Prototype', text: 'Place up to 3 shelters for free.' },
		{
			id: 'riotControl',
			name: 'Riot Control',
			text: 'Move up to 4 Utopia Infection cards from the discard pile to the Game End area.',
		},
		{ id: 'mobileShelters', name: 'Mobile Shelters', text: 'Free: place 2 shelters on grid locations.' },
		{ id: 'purge', name: 'Decontamination Kit', text: 'Remove all Plague cubes from one location.' },
		{ id: 'stockUp', name: 'Strategic Reserves', text: 'Move 8 cubes from the reserve to the stockpile.' },
		{
			id: 'exile',
			name: 'Relocation',
			text: 'Destroy up to 3 Infection cards of one city from the Infection discard pile.',
		},
		{
			id: 'antidote',
			name: 'TOPAZ Experimental Vaccine',
			text: 'Play when an Epidemic is drawn: discard it with no effect.',
		},
		{
			id: 'mentor',
			name: 'Renewal',
			text: 'Put an ability that costs 2 or less on a character in this game, on an empty slot or over a scar.',
		},
		{
			id: 'surplus',
			name: 'Portable Antiviral Lab',
			text: 'Play after you Make Supplies this turn: take 3 more cubes from the stockpile.',
		},
	],
	characterCards: [
		['scar', 'empty', 'empty', 'scar', 'skull'],
		['empty', 'empty', 'scar', 'scar', 'empty', 'skull'],
		['empty', 'scar', 'empty', 'scar', 'empty', 'skull'],
		['scar', 'empty', 'scar', 'empty', 'skull'],
		['empty', 'empty', 'scar', 'scar', 'skull'],
		['empty', 'scar', 'scar', 'empty', 'skull'],
		['scar', 'empty', 'scar', 'empty', 'scar', 'empty', 'skull'],
		['empty', 'scar', 'empty', 'empty', 'scar', 'scar', 'skull'],
		['scar', 'empty', 'scar', 'empty', 'scar', 'skull'],
		['empty', 'scar', 'empty', 'skull'],
	],
	cityImprovements: [
		{
			id: 'double',
			name: 'Foundations',
			text: 'Counts as 2 cards of its colour for the Build Supply Center action.',
			cost: 1,
		},
		{
			id: 'triple',
			name: 'Infrastructure',
			text: 'Counts as 3 cards of its colour for the Build Supply Center action.',
			cost: 2,
		},
		{
			id: 'wild',
			name: 'Decryption Key',
			text: 'May be used as a City card of any colour for the Recon or Build Supply Center action.',
			cost: 1,
		},
		{
			id: 'redWild',
			name: 'Local Operatives',
			text: 'Counts as both a red City card and a card of its original colour.',
			cost: 1,
		},
	],
	infectionImprovements: [
		{
			id: 'wellStocked',
			name: 'Well Stocked',
			text: 'If there are 2 or more Supply cubes in this city when this card is drawn, do not remove any Supply cubes.',
			cost: 1,
		},
		{
			id: 'lockdown',
			name: 'Lockdown',
			text: 'If this card is in the Infection discard pile, any player may discard a Player card to destroy this card at any time.',
			cost: 1,
		},
		{
			id: 'rebirth',
			name: 'Rebirth',
			text: 'If the city is recovering (population 6 or more), this card will not infect it. Hollow Men Gather cards still take effect.',
			cost: 1,
		},
		{
			id: 'cordon',
			name: 'Broken Link',
			text: 'After discarding this card, any player may discard a Player card to stop drawing Infection cards for the rest of this turn. No effect during setup or epidemics.',
			cost: 1,
		},
	],
	objectives: [
		{
			id: 'prologueCenters',
			name: 'Build 3 supply centers',
			rule: 'Build 3 supply centers.',
			target: 3,
			mandatory: true,
			carriesOver: false,
		},
		{
			id: 'buildCenters',
			name: 'Build 3 new supply centers',
			rule: 'Build 3 new supply centers this game.',
			target: 3,
			mandatory: true,
			carriesOver: false,
		},
		{
			id: 'reconRegion',
			name: 'Recon North America',
			rule: 'Recon North America from Washington.',
			target: 1,
			mandatory: true,
			carriesOver: true,
			doneIfReconned: true,
		},
		{
			id: 'reconNewArea',
			name: 'Recon 1 unknown region',
			rule: 'Recon any unknown region.',
			target: 1,
			mandatory: false,
			carriesOver: false,
		},
		{
			id: 'connectCities',
			name: 'Connect 2 new cities to the grid',
			rule: 'Join 2 cities to the grid this game.',
			target: 2,
			mandatory: false,
			carriesOver: false,
		},
		{
			id: 'searches',
			name: 'Complete 2 searches',
			rule: 'Search twice this game.',
			target: 2,
			mandatory: false,
			carriesOver: false,
		},
		{
			id: 'lostHaven',
			name: 'Access a lost haven',
			rule: 'Move a pawn into a lost haven.',
			target: 1,
			mandatory: false,
			carriesOver: false,
			destroyOnComplete: true,
		},
		{
			id: 'triangulate',
			name: 'Triangulate signals',
			rule: 'Have towers in a blue city, a yellow city and a black city at the same time.',
			target: 3,
			mandatory: false,
			carriesOver: false,
			reward: door('35'),
			destroyOnComplete: true,
		},
		{
			id: 'reconEastAsia',
			name: 'Recon East Asia',
			rule: 'Recon East Asia from Kolkata.',
			target: 1,
			mandatory: true,
			carriesOver: true,
			doneIfReconned: true,
		},
		{
			id: 'defect',
			name: 'Get Hollow Men to defect',
			rule: 'Have a Hollow Man in each of 3 different havens at the same time.',
			target: 3,
			mandatory: true,
			carriesOver: true,
		},
		{
			id: 'plan',
			name: 'Complete the Plan',
			rule: 'Perform all 4 recons at Shanghai.',
			target: 4,
			mandatory: true,
			carriesOver: true,
			stepsCarry: true,
			reward: pkg(8),
		},
		{
			id: 'deliverSample',
			name: 'Deliver the Sample',
			rule: 'Carry the sample from Lake Baikal to a supply center in Johannesburg.',
			target: 1,
			mandatory: true,
			carriesOver: false,
		},
	],
	seals,
	legacyDeck,
	dossier,
	// The scratched boxes show one card or two (the legend's "1 or 2 cards"): only 9.31 shows two.
	frequencies: [
		{ take: 1 },
		{ take: 1 },
		{ take: 1 },
		{ seal: door('52') },
		{ take: 2 },
		{ take: 1 },
		{ take: 1 },
		{ take: 1 },
		{ take: 1 },
		{ seal: door('43') },
	],
	frequencyLabels: ['8.24', '8.81', '9.1', '9.2', '9.31', '9.58', '9.75', '10.31', '10.57', '11.88'],
	startingEvents: ['airlift', 'quietNight', 'resilience', 'handout'],
	startingAbilities: [
		'architect',
		'helmsman',
		'recordKeeper',
		'courier',
		'broker',
		'supplier',
		'runner',
		'coordinator',
	],
	// Package 1 and doors 47 and 48 bring the rest.
	startingScars: [
		'reconExtraCard',
		'smallHand',
		'oddHand',
		'rattled',
		'plagueShy',
		'haunted',
		'grasping',
		'buildExtraCard',
		'wary',
	],
	sampleFrom: city('lake-baikal'),
	sampleTo: city('johannesburg'),
	numbers: {
		actionsPerTurn: 4,
		handLimit: 7,
		setupInfections: 9,
		infectionRates: [2, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5],
		incidentLimit: 8,
		maxPlaguePerCity: 3,
		maxHollowPerCity: 3,
		supplyByMonth: [36, 36, 33, 30, 27, 24, 21, 18, 15, 12, 8, 4, 0],
		requiredByMonth: [1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 2, 1, 1],
		pieces: { center: 9, tower: 6, shelter: 6, hollow: 24 },
		produceBoxes: [1, 1, 1, 2, 2, 2, 3, 3],
		characterSlots: 4,
		portraits: 10,
		exposureBoxes: 7,
		storageCap: 30,
		selfInfectDoses: 4,
		rebirthPopulation: 6,
		startingRationing: 4,
		epidemicTable: [
			{ maxCityCards: 36, epidemics: 5 },
			{ maxCityCards: 44, epidemics: 6 },
			{ maxCityCards: 51, epidemics: 7 },
			{ maxCityCards: 57, epidemics: 8 },
			{ maxCityCards: 62, epidemics: 9 },
			{ maxCityCards: Number.POSITIVE_INFINITY, epidemics: 10 },
		],
		productionTable: [
			{ maxCities: 10, units: 3 },
			{ maxCities: 16, units: 4 },
			{ maxCities: 24, units: 5 },
			{ maxCities: 33, units: 6 },
			{ maxCities: 42, units: 7 },
			{ maxCities: Number.POSITIVE_INFINITY, units: 8 },
		],
		dealByPlayers: { 1: 4, 2: 4, 3: 3, 4: 2 },
		costs: {
			center: 5,
			line: 2,
			lane: 2,
			tower: 2,
			population: 1,
			restore: 2,
			permanent: { center: 3, tower: 3, shelter: 2 },
		},
	},
};

// Every package and door in the box has its contents, and every opening names one that exists.
const contents = new Set(seals.map(def => sealKey(def.seal)));
for (const id of dossier.packages) if (!contents.has(`package:${id}`)) throw new Error(`Package ${id} holds nothing`);
for (const id of dossier.sheets.flat()) if (!contents.has(`door:${id}`)) throw new Error(`Door ${id} holds nothing`);
for (const unlock of [...seals, ...legacyDeck].flatMap(holder => [
	...holder.unlocks,
	...('reward' in holder ? (holder.reward ?? []) : []),
]))
	if ((unlock.t === 'open' || unlock.t === 'perimeter') && !contents.has(sealKey(unlock.seal)))
		throw new Error(`An opening names ${sealKey(unlock.seal)}, which is not in the box`);
