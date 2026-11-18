import { pack } from './content/pack';
import type {
	AbilityId,
	ActionId,
	CityImprovementId,
	EventId,
	InfectionImprovementId,
	JobId,
	ObjectiveId,
	RuleId,
	SearchBoxDef,
	StructureKind,
	Unlock,
} from './content/types';
import { settleGrid } from './flow';
import { cityDef, grid, gridCityCount, hasEdge, hasRule, isForsaken, log } from './helpers';
import type { BundleId, CardId, CharacterId, CityId } from './ids';
import { shuffle } from './rng';
import type { Campaign, Character, ExposureBox, World } from './state';

const numbers = pack.numbers;

const newCardId = (campaign: Campaign, prefix: string) => `${prefix}#${campaign.nextCardId++}` as CardId;

function addEvent(campaign: Campaign, event: EventId, mode: 'rationed' | 'unrationed' | 'permanent', copies = 1) {
	for (let i = 0; i < copies; i++) {
		const id = newCardId(campaign, event);
		campaign.playerCards[id] = { id, kind: 'event', event, mode };
	}
}

export function newCampaign(seed: number): Campaign {
	const campaign: Campaign = {
		rng: { seed },
		month: 0,
		attempt: 1,
		rationing: numbers.startingRationing,
		results: [],
		rules: [],
		actions: [
			'drive',
			'sail',
			'charter',
			'makeSupplies',
			'produce',
			'deliver',
			'share',
			'buildCenter',
			'pickUp',
			'transfer',
		],
		legacyIndex: 0,
		legacyHalt: null,
		briefing: [],
		opened: [],
		forced: [],
		routes: [],
		regions: pack.regions.filter(region => region.startsRevealed).map(region => region.id),
		locations: {} as Campaign['locations'],
		edges: pack.edges.map(edge => ({ ...edge })),
		names: {},
		characters: {},
		playerCards: {},
		infectionCards: {},
		stored: { player: [], infection: [] },
		objectives: ['prologueCenters'],
		required: 1,
		carriedProgress: {},
		turningPoints: [],
		abilitiesForSale: [],
		cityImprovementsForSale: [],
		infectionImprovementsForSale: [],
		permanentForSale: [],
		scars: [],
		jobsFound: [],
		stockpileBonus: 0,
		freeAbilityUnits: 0,
		frequenciesUsed: [],
		planRecons: [],
		seating: [],
		sampleDelivered: false,
		losingStreakBonusGames: 0,
		owedScars: 0,
		nextCardId: 1,
	};
	const revealedRegions = new Set(campaign.regions);
	for (const city of pack.cities) {
		campaign.locations[city.id] = {
			population: city.population,
			infested: city.startsInfested ?? false,
			revealed: revealedRegions.has(city.region) && !city.lost,
			permanent: [],
			lab: false,
		};
		if (city.kind !== 'city') continue;
		const boxes: SearchBoxDef[] = pack.searches[city.id] ?? [];
		for (let copy = 0; copy < city.playerCards; copy++) {
			const id = newCardId(campaign, city.id);
			campaign.playerCards[id] = {
				id,
				kind: 'city',
				city: city.id,
				improvement: null,
				// Only the first copy of a city carries its search boxes, so a result can resolve once.
				search: copy === 0 ? boxes.map(box => ({ ...box, scratched: false })) : [],
			};
		}
		for (let copy = 0; copy < city.population; copy++) {
			const id = newCardId(campaign, `inf-${city.id}`);
			campaign.infectionCards[id] = { id, kind: 'city', city: city.id, improvement: null };
		}
	}
	for (let i = 0; i < numbers.produceCards; i++) {
		const id = newCardId(campaign, 'produce');
		campaign.playerCards[id] = { id, kind: 'produce', boxesLeft: numbers.produceBoxes };
	}
	const maxEpidemics = Math.max(...numbers.epidemicTable.map(row => row.epidemics));
	for (let i = 0; i < maxEpidemics; i++) {
		const id = newCardId(campaign, 'epidemic');
		campaign.playerCards[id] = { id, kind: 'epidemic' };
	}
	for (const event of pack.startingEvents) addEvent(campaign, event, 'rationed');
	for (const route of pack.reconRoutes)
		if (campaign.locations[route.city]!.revealed && !route.id.startsWith('hidden:')) campaign.routes.push(route.id);
	return campaign;
}

function exposureTrack(campaign: Campaign): ExposureBox[] {
	const middle: ExposureBox[] = shuffle(campaign.rng, [
		...Array<ExposureBox>(3).fill('scar'),
		...Array<ExposureBox>(numbers.exposureBoxes - 5).fill('empty'),
	]);
	return ['empty', ...middle, 'skull'];
}

export function createCharacter(
	campaign: Campaign,
	input: { name: string; job: JobId | null; home: CityId; worker?: boolean },
): Character {
	const id = `char-${Object.keys(campaign.characters).length + 1}` as CharacterId;
	const character: Character = {
		id,
		name: input.name,
		job: input.job,
		jobScar: null,
		home: input.home,
		slots: Array.from({ length: numbers.characterSlots }, () => null),
		exposureTrack: input.worker ? [] : exposureTrack(campaign),
		exposure: 0,
		dead: false,
		diedAt: null,
		worker: input.worker ?? false,
		carrier: false,
		player: null,
	};
	campaign.characters[id] = character;
	return character;
}

export function openBundle(world: World, id: BundleId, forced: boolean) {
	const { campaign, game } = world;
	if (campaign.opened.includes(id)) return;
	const bundle = pack.bundles.find(candidate => candidate.id === id);
	if (!bundle) throw new Error(`unknown bundle ${id}`);
	campaign.opened.push(id);
	if (forced) campaign.forced.push(id);
	if (game) log(game, { t: 'unlock', bundle: id, forced });
	campaign.briefing.push(`${bundle.name}${forced ? ' (opened by a perimeter report)' : ''}`);
	for (const unlock of [...bundle.unlocks, ...(forced ? [] : (bundle.reward ?? []))]) {
		const line = unlockLine(campaign, unlock);
		if (line) campaign.briefing.push(line);
		applyUnlock(world, unlock);
	}
}

const pushUnique = <T>(list: T[], value: T) => {
	if (!list.includes(value)) list.push(value);
};

export function applyUnlock(world: World, unlock: Unlock) {
	const { campaign, game } = world;
	switch (unlock.t) {
		case 'rule':
			return pushUnique(campaign.rules, unlock.rule);
		case 'action':
			return pushUnique(campaign.actions, unlock.action);
		case 'region': {
			const before = grid(campaign);
			pushUnique(campaign.regions, unlock.region);
			for (const city of pack.cities)
				if (city.region === unlock.region && !city.lost) campaign.locations[city.id]!.revealed = true;
			for (const route of pack.reconRoutes) {
				if (campaign.locations[route.city]!.revealed && !route.id.startsWith('hidden:'))
					pushUnique(campaign.routes, route.id);
			}
			for (const edge of unlock.connect ?? []) if (!hasEdge(campaign, edge.a, edge.b)) campaign.edges.push({ ...edge });
			if (game) log(game, { t: 'reveal', region: unlock.region });
			return settleGrid(world, before, false);
		}
		case 'haven':
			campaign.locations[unlock.city]!.revealed = true;
			return;
		case 'edge': {
			const before = grid(campaign);
			if (!hasEdge(campaign, unlock.edge.a, unlock.edge.b)) campaign.edges.push({ ...unlock.edge });
			return settleGrid(world, before, false);
		}
		case 'route':
			return pushUnique(campaign.routes, unlock.route);
		case 'objectives':
			campaign.objectives = campaign.objectives.filter(id => !unlock.remove?.includes(id));
			for (const id of unlock.add ?? []) pushUnique(campaign.objectives, id);
			return;
		case 'required':
			campaign.required = unlock.count;
			return;
		case 'turningPoint':
			return pushUnique(campaign.turningPoints, unlock.id);
		case 'event':
			return addEvent(campaign, unlock.event, unlock.mode, unlock.copies);
		case 'ability':
			return pushUnique(campaign.abilitiesForSale, unlock.ability);
		case 'cityImprovement':
			return pushUnique(campaign.cityImprovementsForSale, unlock.improvement);
		case 'infectionImprovement':
			return pushUnique(campaign.infectionImprovementsForSale, unlock.improvement);
		case 'permanentStructure':
			return pushUnique(campaign.permanentForSale, unlock.structure);
		case 'scar':
			return pushUnique(campaign.scars, unlock.scar);
		case 'job': {
			campaign.jobsFound.push({ job: unlock.job, home: unlock.home });
			const job = pack.jobs.find(candidate => candidate.id === unlock.job)!;
			createCharacter(campaign, { name: job.name, job: unlock.job, home: unlock.home });
			return;
		}
		case 'gather':
		case 'assemble':
			for (let i = 0; i < unlock.cards; i++) {
				const id = newCardId(campaign, unlock.t);
				campaign.infectionCards[id] = { id, kind: unlock.t };
				if (game) game.infectionDiscard.push(id);
			}
			return;
		case 'stockpileBonus':
			campaign.stockpileBonus += unlock.amount;
			// The bonus also lands in the game it is found in. The cubes come out of the box, which is the reserve.
			if (world.game) {
				const now = Math.min(unlock.amount, world.game.reserve);
				world.game.reserve -= now;
				world.game.stockpile += now;
				log(world.game, { t: 'note', text: `${now} cubes moved from the reserve to the stockpile` });
			}
			return;
		case 'freeAbilityUnits':
			campaign.freeAbilityUnits += unlock.amount;
			return;
		case 'lab':
			campaign.locations[unlock.city]!.lab = true;
			return;
		case 'infest':
			campaign.locations[unlock.city]!.infested = true;
			return;
		case 'forsake':
			campaign.locations[unlock.city]!.population = 0;
			campaign.locations[unlock.city]!.infested = true;
			return;
		case 'owedScar':
			campaign.owedScars += 1;
			return;
		case 'frequencyHint':
			return;
		case 'open':
			return openBundle(world, unlock.bundle, false);
		case 'perimeter':
			if (campaign.opened.includes(unlock.bundle)) return;
			openBundle(world, unlock.bundle, true);
			for (const penalty of unlock.penalty ?? []) applyUnlock(world, penalty);
			return;
	}
}

/** One line on what each unlockable action does, as a briefing announces it. */
export const actionBriefs: Partial<Record<ActionId, string>> = {
	recon:
		'New action: Recon. In a marked city with a supply center, discard the cards its route asks for to reveal a region.',
	establishLine:
		'New action: Supply Line. Spend 2 cubes from your character to join your city to a neighbouring one. Lines may not cross each other.',
	search:
		"New action: Search. Holding a city's card while in that city, scratch one of the card's search boxes and take what it finds.",
	shuttle: 'New action: Shuttle Flight. Fly between havens and cities with a supply center.',
	buildTower: 'New action: Build Tower. Spend 2 cubes from your character to raise a tower in your city.',
	transmit: "New action: Transmit. In a tower city, send a City card of that city's colour to any player.",
	buildShelter:
		"New action: Build Shelter. Discard a card of your city's colour. No one is exposed in or leaving a sheltered city, and it loses no population at game end.",
	inoculate:
		"New free action: Inoculate. Move your city's Player card or Infection card from its discard pile into storage, out of the decks.",
	chartLane:
		'New action: Sea Lane. Spend 2 cubes from your character to join your port to another. A lane may cross one region boundary.',
	monitor:
		'New action: Monitor. In a tower city, tune to a frequency. Four Player cards are discarded and the frequency gives what it holds.',
	broadcast:
		"New action: Broadcast. In a tower city, move a Hollow Man out of a city of that city's colour into a neighbouring location.",
};

export const ruleBriefs: Partial<Record<RuleId, string>> = {
	forsaken:
		'New rule: a city at population 0 is forsaken. When one of its Infection cards is flipped it is set aside and another card is flipped in its place, nothing but Drive or Ferry works there, and it becomes infested. Restore at game end brings it back.',
	epidemicScaling: 'New rule: the number of Epidemics in the deck grows with the number of City cards in it.',
	hollowSetup:
		'New rule: the last 3 setup infections place Hollow Men. Running out of Hollow Men figures loses the game.',
	epidemicFromStorage: 'New rule: an Epidemic strikes a stored Infection card first, if there is one.',
	topazShield:
		'New rule: when a city loses a cube to an infection, any player may discard a City card of its colour to keep the cube.',
	gentleEpidemic: 'New rule: an Epidemic removes 1 cube from the city it strikes, not all of them.',
	carrier:
		'New action at Lake Baikal: Take the sample. That character becomes the carrier. The carrier moves only by Drive or Ferry, must discard a City card of the colour of each city it enters, and dies when the game ends.',
};

const named = <T extends { id: string; name: string; text: string }>(list: T[], id: string) => {
	const found = list.find(entry => entry.id === id)!;
	return `${found.name}. ${found.text}`;
};

/** What a briefing says about an unlock that adds something with a name and a rule of its own. */
function unlockLine(campaign: Campaign, unlock: Unlock): string | null {
	switch (unlock.t) {
		case 'event': {
			const mode = unlock.mode === 'rationed' ? 'Rationed' : unlock.mode === 'unrationed' ? 'Unrationed' : 'permanent';
			const owned = Object.values(campaign.playerCards).some(
				card => card.kind === 'event' && card.event === unlock.event,
			);
			const where =
				unlock.mode === 'rationed'
					? 'The card joins the Rationed Events the group picks from at each setup, starting next game.'
					: 'The card is in the Player deck from the next game on.';
			const event = pack.events.find(entry => entry.id === unlock.event)!;
			return `${owned ? `Another copy of a ${mode} Event card` : `New ${mode} Event card`}: ${event.name}. ${where} When played it reads: ${event.text}`;
		}
		case 'ability':
			return `New ability for sale: ${named(pack.abilities, unlock.ability)}`;
		case 'cityImprovement':
			return `New City card improvement for sale: ${named(pack.cityImprovements, unlock.improvement)}`;
		case 'infectionImprovement':
			return `New Infection card improvement for sale: ${named(pack.infectionImprovements, unlock.improvement)}`;
		case 'scar':
			return `New scar in the box: ${named(pack.scars, unlock.scar)}`;
		case 'job':
			return `A new character has joined the roster with a job nobody had before: ${named(pack.jobs, unlock.job)} That text describes the job, not a new rule for everyone.`;
		case 'lab':
			return `A lab was found in ${pack.cities.find(entry => entry.id === unlock.city)!.name}. Every lab found counts toward the final score.`;
		case 'action':
			return actionBriefs[unlock.action] ?? null;
		case 'region': {
			const infested = pack.cities
				.filter(city => city.region === unlock.region && city.startsInfested)
				.map(city => city.name);
			return infested.length
				? `Infested from the start, so a character who begins a turn there is exposed: ${infested.join(', ')}.`
				: null;
		}
		case 'objectives': {
			const names = (ids: ObjectiveId[] = []) =>
				ids.map(id => pack.objectives.find(entry => entry.id === id)!.name).join(', ');
			const parts = [
				unlock.remove?.length ? `Objectives leaving play: ${names(unlock.remove)}.` : '',
				unlock.add?.length ? `New objectives: ${names(unlock.add)}.` : '',
			].filter(Boolean);
			return parts.length ? parts.join(' ') : null;
		}
		case 'rule':
			return ruleBriefs[unlock.rule] ?? null;
		case 'route': {
			const route = pack.reconRoutes.find(entry => entry.id === unlock.route);
			if (!route) return null;
			const city = pack.cities.find(entry => entry.id === route.city)!.name;
			return `A recon route is now known: at ${city}, discard ${route.count} ${route.color} cards${route.unique ? ' of different cities' : ''}${route.needsCenter ? '. The city needs a supply center' : ''}.`;
		}
		case 'haven': {
			const reached = pack.bundles.some(
				bundle =>
					bundle.unlocks.includes(unlock) &&
					bundle.unlocks.some(
						other =>
							other.t === 'region' && other.connect?.some(edge => edge.a === unlock.city || edge.b === unlock.city),
					),
			);
			const name = pack.cities.find(entry => entry.id === unlock.city)!.name;
			return reached
				? `${name} is now on the map, and a line already reaches it.`
				: `${name} is now on the map. It is not on the grid until a line reaches it.`;
		}
		case 'frequencyHint': {
			const worth = pack.frequencies.flatMap((reward, index) => (reward && 'bundle' in reward ? [index + 1] : []));
			return `The bearings cross on three Monitor frequencies that open something new: ${worth.join(', ')}. The other seven only return cards.`;
		}
		case 'gather':
			return `Hollow Men: ${unlock.cards} Gather cards join the Infection cards. They start each game in the discard pile and enter the deck with the first Epidemic. When one is flipped, the next city flipped gets a Hollow Man and is not infected. Leaving a location that holds Hollow Men exposes a character.`;
		case 'assemble':
			return `Hollow Men: ${unlock.cards} Assemble cards join the Infection cards. They work as Gather cards do.`;
		case 'freeAbilityUnits':
			return `${unlock.amount} free production units for character abilities: spend them now, during setup, on abilities that last all year.`;
		case 'stockpileBonus':
			return `The stockpile grows by ${unlock.amount} cubes now and at every later setup.`;
		case 'permanentStructure':
			return `New at game end: a ${unlock.structure} can be made permanent, so it starts every later game already built.`;
		default:
			return null;
	}
}

/** Reads Legacy cards in order until one halts. `won` is only known for cards read at game end. */
export function readLegacy(world: World, phase: 'setup' | 'gameEnd', won?: boolean) {
	const campaign = world.campaign;
	if (campaign.month === 0) return;
	const halt = campaign.legacyHalt;
	if (phase === 'setup' && halt && (halt.kind === 'pause' || halt.month >= campaign.month)) return;
	if (phase === 'gameEnd' && halt?.kind !== 'pause') return;
	for (;;) {
		const card = pack.legacyDeck[campaign.legacyIndex];
		if (!card || card.month > campaign.month) return;
		campaign.legacyIndex += 1;
		const applies = !card.when || (card.when === 'won') === won;
		if (applies) {
			campaign.briefing.push(`${card.title}: ${card.text}`);
			for (const unlock of card.unlocks) {
				const line = unlockLine(campaign, unlock);
				if (line) campaign.briefing.push(line);
				applyUnlock(world, unlock);
			}
		}
		if (card.halt) {
			campaign.legacyHalt = { kind: card.halt, month: campaign.month };
			return;
		}
	}
}

export function productionUnits(campaign: Campaign, won: boolean): number {
	const cities = gridCityCount(campaign);
	return numbers.productionTable.find(row => cities <= row.maxCities)!.units + (won ? 1 : 0);
}

/** Game End steps 1 to 3, then opens the spending step. The board stays in place so purchases can see it. */
export function resolveGameEnd(world: World) {
	const { campaign, game } = world as { campaign: Campaign; game: NonNullable<World['game']> };
	const won = game.outcome?.won ?? false;
	const changes: { city: CityId; delta: number }[] = [];
	if (campaign.month === 0) {
		game.upkeep = { units: 0, populationChanges: [] };
		return;
	}
	for (const city of pack.cities) {
		const location = game.locations[city.id]!;
		const record = campaign.locations[city.id]!;
		const loss = (location.plague > 0 || location.hollow > 0) && !location.shelter ? 1 : 0;
		const gain = location.center && city.kind === 'city' ? 1 : 0;
		const next = Math.max(0, Math.min(8, record.population - loss + gain));
		if (next !== record.population) changes.push({ city: city.id, delta: next - record.population });
		record.population = next;
	}
	readLegacy(world, 'gameEnd', won);
	if (
		campaign.turningPoints.includes('firstForsaken') &&
		pack.cities.some(city => city.kind === 'city' && campaign.locations[city.id]!.population === 0)
	) {
		campaign.turningPoints = campaign.turningPoints.filter(id => id !== 'firstForsaken');
		openBundle(world, 'forsaken' as BundleId, false);
	}
	if (hasRule(campaign, 'forsaken')) {
		for (const city of pack.cities) if (isForsaken(campaign, city.id)) campaign.locations[city.id]!.infested = true;
	}
	if (campaign.losingStreakBonusGames > 0) campaign.losingStreakBonusGames -= 1;
	const lastFour = [...campaign.results.slice(-3).map(result => result.won), won];
	if (campaign.turningPoints.includes('losingStreak') && lastFour.length === 4 && lastFour.every(result => !result)) {
		campaign.turningPoints = campaign.turningPoints.filter(id => id !== 'losingStreak');
		campaign.losingStreakBonusGames = 3;
		campaign.briefing.push(
			'Turning point: four games lost in a row. Relief arrives: 10 extra cubes in the stockpile for each of the next 3 games.',
		);
	}
	for (const character of Object.values(campaign.characters)) {
		if (character.carrier && !character.dead) {
			character.dead = true;
			character.diedAt =
				Object.values(game.players).find(entry => entry.character === character.id)?.location ?? character.home;
		}
	}
	game.upkeep = { units: productionUnits(campaign, won), populationChanges: changes };
}

export type Purchase =
	| { t: 'ability'; ability: AbilityId; character: CharacterId; slot: number }
	| { t: 'cityImprovement'; improvement: CityImprovementId; card: CardId }
	| { t: 'infectionImprovement'; improvement: InfectionImprovementId; card: CardId }
	| { t: 'population'; city: CityId; steps: number }
	| { t: 'restore'; city: CityId }
	| { t: 'permanent'; structure: StructureKind; city: CityId };

export function purchaseCost(purchase: Purchase): number {
	switch (purchase.t) {
		case 'ability':
			return pack.abilities.find(ability => ability.id === purchase.ability)!.cost;
		case 'cityImprovement':
			return pack.cityImprovements.find(item => item.id === purchase.improvement)!.cost;
		case 'infectionImprovement':
			return pack.infectionImprovements.find(item => item.id === purchase.improvement)!.cost;
		case 'population':
			return purchase.steps * numbers.costs.population;
		case 'restore':
			return numbers.costs.restore;
		case 'permanent':
			return numbers.costs.permanent[purchase.structure];
	}
}

export function checkPurchase(world: World, purchase: Purchase): string | null {
	const { campaign, game } = world;
	// Free ability units are spent the moment they arrive, which is during setup, as well as at game end.
	const freeNow = purchase.t === 'ability' && campaign.freeAbilityUnits > 0;
	if (!game || (!game.upkeep && !freeNow)) return 'Not in the spending step';
	const cost = purchaseCost(purchase);
	const budget = (game.upkeep?.units ?? 0) + (purchase.t === 'ability' ? campaign.freeAbilityUnits : 0);
	if (cost > budget) return 'Not enough production units';
	const onGrid = grid(campaign);
	switch (purchase.t) {
		case 'ability': {
			const character = campaign.characters[purchase.character];
			if (!campaign.abilitiesForSale.includes(purchase.ability)) return 'That ability is not available yet';
			if (!character || character.dead || character.worker) return 'Pick a living character';
			if (character.slots[purchase.slot] !== null || purchase.slot >= character.slots.length)
				return 'That slot is taken';
			if (character.slots.some(slot => slot?.id === purchase.ability)) return 'The character already has it';
			return null;
		}
		case 'cityImprovement': {
			const card = campaign.playerCards[purchase.card];
			if (!campaign.cityImprovementsForSale.includes(purchase.improvement))
				return 'That improvement is not available yet';
			if (card?.kind !== 'city' || card.improvement) return 'Pick a City card with an empty slot';
			return onGrid.has(card.city) ? null : 'The city is not on the grid';
		}
		case 'infectionImprovement': {
			const card = campaign.infectionCards[purchase.card];
			if (!campaign.infectionImprovementsForSale.includes(purchase.improvement))
				return 'That improvement is not available yet';
			if (card?.kind !== 'city' || card.improvement) return 'Pick an Infection card with an empty slot';
			return onGrid.has(card.city) ? null : 'The city is not on the grid';
		}
		case 'population': {
			const record = campaign.locations[purchase.city];
			if (!record?.revealed) return 'Pick a revealed location';
			if (!Number.isInteger(purchase.steps) || purchase.steps < 1) return 'Population is bought in whole steps';
			if (cityDef(purchase.city).kind === 'city' && record.population === 0)
				return 'A forsaken city must be restored first';
			return record.population + purchase.steps <= 8 ? null : 'Population caps at 8';
		}
		case 'restore': {
			const record = campaign.locations[purchase.city];
			return record?.revealed && cityDef(purchase.city).kind === 'city' && record.population === 0
				? null
				: 'Pick a forsaken city';
		}
		case 'permanent': {
			if (!campaign.permanentForSale.includes(purchase.structure)) return 'Permanent structures are not available yet';
			if (!game.locations[purchase.city]?.[purchase.structure]) return 'The structure must be standing at game end';
			if (campaign.locations[purchase.city]!.permanent.includes(purchase.structure)) return 'Already permanent';
			const limit = purchase.structure === 'center' ? 6 : numbers.pieces[purchase.structure];
			const placed = Object.values(campaign.locations).filter(record =>
				record.permanent.includes(purchase.structure),
			).length;
			return placed < limit ? null : 'No stickers left';
		}
	}
}

export function applyPurchase(world: World, purchase: Purchase) {
	const { campaign, game } = world as { campaign: Campaign; game: NonNullable<World['game']> };
	let cost = purchaseCost(purchase);
	if (purchase.t === 'ability') {
		const free = Math.min(cost, campaign.freeAbilityUnits);
		campaign.freeAbilityUnits -= free;
		cost -= free;
	}
	if (game.upkeep) game.upkeep.units -= cost;
	switch (purchase.t) {
		case 'ability':
			campaign.characters[purchase.character]!.slots[purchase.slot] = { kind: 'ability', id: purchase.ability };
			return;
		case 'cityImprovement': {
			const card = campaign.playerCards[purchase.card]!;
			if (card.kind === 'city') card.improvement = purchase.improvement;
			return;
		}
		case 'infectionImprovement': {
			const card = campaign.infectionCards[purchase.card]!;
			if (card.kind === 'city') card.improvement = purchase.improvement;
			return;
		}
		case 'population':
			campaign.locations[purchase.city]!.population += purchase.steps;
			return;
		case 'restore':
			campaign.locations[purchase.city]!.population = 1;
			return;
		case 'permanent':
			campaign.locations[purchase.city]!.permanent.push(purchase.structure);
			return;
	}
}

/** Records the result, moves the calendar, and clears the board. */
export function closeGame(world: World) {
	const { campaign, game } = world as { campaign: Campaign; game: NonNullable<World['game']> };
	const won = game.outcome?.won ?? false;
	const result = {
		month: campaign.month,
		attempt: campaign.attempt,
		won,
		gridCities: gridCityCount(campaign),
		rationing: campaign.rationing,
		characters: game.seats.map(seat => game.players[seat]!.character),
	};
	if (game.prologueRestore) {
		// Nothing a prologue game does is permanent: scars, deaths, drawn lines and used cards all roll back.
		world.campaign = {
			...game.prologueRestore,
			rng: campaign.rng,
			nextCardId: campaign.nextCardId,
			results: [...campaign.results, result],
		};
		world.game = null;
		return;
	}
	campaign.results.push(result);
	campaign.carriedProgress = {};
	if (campaign.month > 0) campaign.rationing = Math.max(0, Math.min(10, campaign.rationing + (won ? -2 : 2)));
	if (campaign.month === 0) {
		// The prologue repeats until the players choose to begin.
	} else if (won || campaign.attempt === 2) {
		campaign.month += 1;
		campaign.attempt = 1;
	} else {
		campaign.attempt = 2;
		for (const objective of pack.objectives) {
			const kept = objective.stepsCarry || game.completed.includes(objective.id);
			if (objective.carriesOver && kept && game.progress[objective.id])
				campaign.carriedProgress[objective.id] = game.progress[objective.id];
		}
	}
	campaign.freeAbilityUnits = 0;
	world.game = null;
}

export const campaignOver = (campaign: Campaign) => campaign.month > 12;

export function score(campaign: Campaign) {
	const months = campaign.results.filter(result => result.month >= 1 && result.won);
	const early = months.filter(result => result.attempt === 1).length;
	const late = months.filter(result => result.attempt === 2).length;
	const onGrid = grid(campaign);
	const revealed = pack.cities.filter(city => onGrid.has(city.id));
	const population = revealed.reduce((sum, city) => sum + campaign.locations[city.id]!.population, 0);
	const labs = Object.values(campaign.locations).filter(record => record.lab).length;
	const forsaken = revealed.filter(
		city => city.kind === 'city' && campaign.locations[city.id]!.population === 0,
	).length;
	const parts = {
		earlyWins: early * 50,
		lateWins: late * 30,
		population,
		sample: campaign.sampleDelivered ? 100 : 0,
		labs: labs * 25,
		forsaken: forsaken * -5,
	};
	return { ...parts, total: Object.values(parts).reduce((sum, value) => sum + value, 0) };
}
