import { pack } from './content/pack';
import { sealKey } from './content/types';
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
	Seal,
	StructureKind,
	Unlock,
} from './content/types';
import { briefUnlock } from './briefing';
import { settleGrid } from './flow';
import { cityDef, grid, gridCityCount, hasEdge, hasRule, isForsaken, log, sealDef } from './helpers';
import type { CardId, CharacterId, CityId, SeatId } from './ids';
import { shuffle } from './rng';
import type { Campaign, Character, ExposureBox, World } from './state';

const numbers = pack.numbers;

const newCardId = (campaign: Campaign, prefix: string) => `${prefix}#${campaign.nextCardId++}` as CardId;

function addEvent(campaign: Campaign, event: EventId, mode: 'rationed' | 'unrationed' | 'permanent', copies = 1) {
	return Array.from({ length: copies }, () => {
		const id = newCardId(campaign, event);
		campaign.playerCards[id] = { id, kind: 'event', event, mode };
		return id;
	});
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
		characterCards: [],
		playerCards: {},
		infectionCards: {},
		stored: { player: [], infection: [] },
		objectives: ['prologueCenters'],
		required: 1,
		carriedProgress: {},
		turningPoints: [],
		abilitiesForSale: [...pack.startingAbilities],
		cityImprovementsForSale: [],
		infectionImprovementsForSale: [],
		permanentForSale: [],
		scars: [...pack.startingScars],
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
	campaign.characterCards = shuffle(campaign.rng, pack.characterCards).map(layout => ({
		track: paddedTrack(layout),
		exposure: 0,
	}));
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
				companion: null,
				// Only the first copy of a city carries its search boxes, so a result can resolve once.
				search: copy === 0 ? boxes.map(box => ({ ...box, scratched: false })) : [],
			};
		}
		for (let copy = 0; copy < (city.noInfectionCards ? 0 : city.population); copy++) {
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

/** Every card shows the same number of boxes, so the boxes past the one that kills are blank and never reached. */
export const paddedTrack = (layout: readonly ExposureBox[]): ExposureBox[] => [
	...layout,
	...Array<ExposureBox>(Math.max(0, numbers.exposureBoxes - layout.length)).fill('empty'),
];

export function createCharacter(
	campaign: Campaign,
	input: { name: string; job: JobId | null; home: CityId; portrait?: number; worker?: boolean },
): Character {
	const count = Object.keys(campaign.characters).length;
	const id = `char-${count + 1}` as CharacterId;
	const card = input.worker ? null : campaign.characterCards.shift();
	if (!input.worker && !card) throw new Error('No Character card is left for a new character');
	const character: Character = {
		id,
		name: input.name,
		job: input.job,
		jobScar: null,
		home: input.home,
		portrait: input.portrait ?? count % numbers.portraits,
		slots: Array.from({ length: numbers.characterSlots }, () => null),
		exposureTrack: card?.track ?? [],
		exposure: card?.exposure ?? 0,
		dead: false,
		diedAt: null,
		worker: input.worker ?? false,
		carrier: false,
		player: null,
	};
	campaign.characters[id] = character;
	return character;
}

export const isOpen = (campaign: Campaign, seal: Seal) => campaign.opened.includes(sealKey(seal));

/** Opens a package or door that is still sealed, and everything its contents open in turn. */
/** `by` is the seat whose recon, search or arrival opened it, who takes what the package hands out. */
export function openSeal(world: World, seal: Seal, forced: boolean, by?: SeatId) {
	const { campaign, game } = world;
	if (isOpen(campaign, seal)) return;
	const def = sealDef(seal);
	const key = sealKey(seal);
	campaign.opened.push(key);
	if (forced) campaign.forced.push(key);
	if (game) log(game, { t: 'unlock', seal: key, forced });
	campaign.briefing.push({
		t: 'card',
		title: def.name,
		text: forced ? 'Opened by a perimeter report.' : null,
		from: { t: 'seal', seal },
	});
	for (const unlock of [...def.unlocks, ...(forced ? [] : (def.reward ?? []))]) {
		briefUnlock(campaign, unlock);
		applyUnlock(world, unlock, by);
	}
}

const pushUnique = <T>(list: T[], value: T) => {
	if (!list.includes(value)) list.push(value);
};

const pushCopies = <T>(list: T[], value: T, copies = 1) => {
	for (let i = 0; i < copies; i++) list.push(value);
};

function takeOne<T>(list: T[], value: T) {
	const index = list.indexOf(value);
	if (index >= 0) list.splice(index, 1);
}

export function applyUnlock(world: World, unlock: Unlock, by?: SeatId) {
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
			if (unlock.over) campaign.turningPoints = campaign.turningPoints.filter(id => id !== unlock.id);
			else pushUnique(campaign.turningPoints, unlock.id);
			return;
		case 'event': {
			const added = addEvent(campaign, unlock.event, unlock.mode, unlock.copies);
			if (!game) return;
			added.forEach((id, index) => {
				const where = unlock.now?.[index];
				if (where === 'hand' && by) game.players[by]!.hand.push(id);
				else if (where) game.playerDiscard.push(id);
			});
			return;
		}
		case 'actions':
			if (game) game.actionsLeft += unlock.amount;
			return;
		case 'ability':
			return pushCopies(campaign.abilitiesForSale, unlock.ability, unlock.copies);
		case 'cityImprovement':
			return pushCopies(campaign.cityImprovementsForSale, unlock.improvement, unlock.copies);
		case 'infectionImprovement':
			return pushCopies(campaign.infectionImprovementsForSale, unlock.improvement, unlock.copies);
		case 'permanentStructure':
			return pushCopies(campaign.permanentForSale, unlock.structure, unlock.copies);
		case 'scar':
			return pushCopies(campaign.scars, unlock.scar, unlock.copies);
		case 'job': {
			// The door creates the character at once, on the next free Character card, at the job's own home. With no
			// card left the job waits for the group to make one when a card is free again.
			if (campaign.characterCards.length === 0) campaign.jobsFound.push({ job: unlock.job, home: unlock.home });
			else
				createCharacter(campaign, {
					name: pack.jobs.find(job => job.id === unlock.job)!.name,
					job: unlock.job,
					home: unlock.home,
				});
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
			// The bonus also lands in the game it is found in: new cubes from the package, or else out of the reserve.
			if (world.game && unlock.fresh) {
				world.game.stockpile += unlock.amount;
				world.game.cubesAdded += unlock.amount;
				log(world.game, { t: 'note', text: `${unlock.amount} new cubes went into the stockpile` });
			} else if (world.game) {
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
		case 'destroy': {
			const record = campaign.locations[unlock.city]!;
			Object.assign(record, { revealed: false, population: 0, permanent: [], lab: false });
			campaign.edges = campaign.edges.filter(edge => edge.a !== unlock.city && edge.b !== unlock.city);
			const gone = new Set<CardId>(
				[...Object.values(campaign.playerCards), ...Object.values(campaign.infectionCards)].flatMap(card =>
					'city' in card && card.city === unlock.city ? [card.id] : [],
				),
			);
			for (const id of gone) {
				delete campaign.playerCards[id];
				delete campaign.infectionCards[id];
			}
			campaign.stored.player = campaign.stored.player.filter(id => !gone.has(id));
			campaign.stored.infection = campaign.stored.infection.filter(id => !gone.has(id));
			if (game) {
				const keep = (ids: CardId[]) => ids.filter(id => !gone.has(id));
				for (const seat of game.seats) game.players[seat]!.hand = keep(game.players[seat]!.hand);
				game.playerDiscard = keep(game.playerDiscard);
				game.infectionDiscard = keep(game.infectionDiscard);
				game.gameEndArea = keep(game.gameEndArea);
			}
			return;
		}
		case 'owedScar':
			campaign.owedScars += 1;
			return;
		case 'frequencyHint':
			return;
		case 'open':
			return openSeal(world, unlock.seal, false, by);
		case 'perimeter':
			if (isOpen(campaign, unlock.seal)) return;
			openSeal(world, unlock.seal, true);
			for (const penalty of unlock.penalty ?? []) applyUnlock(world, penalty);
			return;
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
			campaign.briefing.push({ t: 'card', title: card.title, text: card.text, from: { t: 'legacy', card: card.id } });
			for (const unlock of card.unlocks) {
				briefUnlock(campaign, unlock);
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
		openSeal(world, { t: 'door', id: 'A' }, false);
	}
	const havensHeld = pack.cities.filter(city => city.kind === 'haven' && game.locations[city.id]!.hollow > 0).length;
	if (campaign.turningPoints.includes('defection') && havensHeld >= 3) openSeal(world, { t: 'door', id: '17' }, false);
	if (hasRule(campaign, 'forsaken')) {
		for (const city of pack.cities) if (isForsaken(campaign, city.id)) campaign.locations[city.id]!.infested = true;
	}
	if (campaign.losingStreakBonusGames > 0) campaign.losingStreakBonusGames -= 1;
	const lastFour = [...campaign.results.slice(-3).map(result => result.won), won];
	if (campaign.turningPoints.includes('losingStreak') && lastFour.length === 4 && lastFour.every(result => !result)) {
		campaign.turningPoints = campaign.turningPoints.filter(id => id !== 'losingStreak');
		campaign.losingStreakBonusGames = 3;
		campaign.briefing.push({
			t: 'card',
			title: 'Turning point: four games lost in a row',
			text: 'Relief arrives: 10 extra cubes in the stockpile for each of the next 3 games.',
			from: { t: 'turningPoint' },
		});
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
			if (!campaign.permanentForSale.includes(purchase.structure)) return 'No sticker of that kind is left';
			if (!game.locations[purchase.city]?.[purchase.structure]) return 'The structure must be standing at game end';
			return campaign.locations[purchase.city]!.permanent.includes(purchase.structure) ? 'Already permanent' : null;
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
			takeOne(campaign.abilitiesForSale, purchase.ability);
			campaign.characters[purchase.character]!.slots[purchase.slot] = { kind: 'ability', id: purchase.ability };
			return;
		case 'cityImprovement': {
			const card = campaign.playerCards[purchase.card]!;
			takeOne(campaign.cityImprovementsForSale, purchase.improvement);
			if (card.kind === 'city') card.improvement = purchase.improvement;
			return;
		}
		case 'infectionImprovement': {
			const card = campaign.infectionCards[purchase.card]!;
			takeOne(campaign.infectionImprovementsForSale, purchase.improvement);
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
			takeOne(campaign.permanentForSale, purchase.structure);
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
	campaign.objectives = campaign.objectives.filter(
		id => !(game.completed.includes(id) && pack.objectives.find(objective => objective.id === id)!.destroyOnComplete),
	);
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
