import { describe, expect, test } from 'bun:test';
import type { Action } from './actions';
import { botCommand } from './bot';
import { pack } from './content/pack';
import { grid, handLimit } from './helpers';
import type { CardId, CityId, SeatId } from './ids';
import { score } from './legacy';
import type { Command, GameActor, Phase } from './machine';
import { createGameActor, phaseOf, reject } from './machine';
import { decemberSave, octoberSave } from './scenarios';
import type { Game, World } from './state';

const A = 'seat-1' as SeatId;
const B = 'seat-2' as SeatId;
const city = (id: string) => id as CityId;

/** A two-player January game on its first action step, optionally reshaped before it resumes. */
function january(edit?: (world: World, game: Game) => void, phase: Phase = 'playing.actions'): GameActor {
	const actor = createGameActor({ seed: 42 }).start();
	const havens = pack.cities.filter(candidate => candidate.kind === 'haven' && !candidate.lost);
	actor.send({ type: 'CREATE_CHARACTER', name: 'Ada', job: 'farmer', home: havens[0]!.id });
	actor.send({ type: 'CREATE_CHARACTER', name: 'Bo', job: 'instructor', home: havens[0]!.id });
	actor.send({ type: 'BEGIN_CAMPAIGN' });
	actor.send({
		type: 'START_GAME',
		seating: Object.values(actor.getSnapshot().context.world.campaign.characters).map((character, index) => ({
			seat: [A, B][index]!,
			character: character.id,
		})),
	});
	for (const type of ['ACK_BRIEFING', 'AUTO_SUPPLY', 'CONFIRM_SUPPLY', 'CONFIRM_EVENTS'] as const) actor.send({ type });
	const world = structuredClone(actor.getSnapshot().context.world);
	const game = world.game!;
	game.active = A;
	game.actionsLeft = 4;
	game.pending = [];
	for (const location of Object.values(game.locations)) Object.assign(location, { supplies: 2, plague: 0 });
	game.incidents = 0;
	edit?.(world, game);
	return createGameActor({ seed: 1, save: { v: 1, phase, world } }).start();
}

const worldOf = (actor: GameActor) => actor.getSnapshot().context.world;
const gameOf = (actor: GameActor) => worldOf(actor).game!;
const act = (actor: GameActor, action: Action, seat = A) => send(actor, { type: 'ACTION', seat, action });

function send(actor: GameActor, command: Command) {
	const reason = reject(worldOf(actor), phaseOf(actor.getSnapshot()), command);
	if (reason) throw new Error(`${command.type} rejected: ${reason}`);
	actor.send(command);
}

const refuses = (actor: GameActor, action: Action, seat = A) =>
	reject(worldOf(actor), phaseOf(actor.getSnapshot()), { type: 'ACTION', seat, action });

function cityCards(world: World, id: string, count: number): CardId[] {
	return Object.values(world.campaign.playerCards)
		.filter(card => card.kind === 'city' && card.city === id)
		.slice(0, count)
		.map(card => card.id);
}

/** Moves cards into a hand from wherever they are, so no card ever exists twice. */
function give(world: World, seat: SeatId, cards: CardId[]) {
	const game = world.game!;
	const taken = new Set(cards);
	for (const player of Object.values(game.players)) player.hand = player.hand.filter(card => !taken.has(card));
	game.playerDeck.order = game.playerDeck.order.filter(card => !taken.has(card));
	game.playerDiscard = game.playerDiscard.filter(card => !taken.has(card));
	game.players[seat]!.hand.push(...cards);
}

function emptyHand(world: World, seat: SeatId) {
	world.game!.playerDiscard.push(...world.game!.players[seat]!.hand.splice(0));
}

function stackInfection(world: World, cities: string[]) {
	const game = world.game!;
	const cards = cities.map(
		(id, index) =>
			Object.values(world.campaign.infectionCards).filter(card => card.kind === 'city' && card.city === id)[
				cities.slice(0, index).filter(other => other === id).length
			]!.id,
	);
	const rest = [...game.infectionDeck.order, ...game.infectionDiscard].filter(card => !cards.includes(card));
	game.infectionDiscard = [];
	game.infectionDeck = { order: [...cards, ...rest], strata: [cards.toSorted(), rest.toSorted()] };
}

describe('infection', () => {
	test('a supplied city loses a cube, an empty one takes a plague cube and an incident', () => {
		const actor = january((world, game) => {
			stackInfection(world, ['cairo', 'lagos']);
			game.locations[city('lagos')]!.supplies = 0;
			game.infectionsLeft = 2;
		}, 'playing.infect');
		const stockpile = gameOf(actor).stockpile;
		send(actor, { type: 'INFECT' });
		expect(gameOf(actor).locations[city('cairo')]).toMatchObject({ supplies: 1, plague: 0 });
		expect(gameOf(actor).stockpile).toBe(stockpile + 1);
		send(actor, { type: 'INFECT' });
		expect(gameOf(actor).locations[city('lagos')]).toMatchObject({ supplies: 0, plague: 1 });
		expect(gameOf(actor).incidents).toBe(1);
		expect(phaseOf(actor.getSnapshot())).toBe('playing.actions');
		expect(gameOf(actor).active).toBe(B);
	});

	test('a city at 3 plague cubes outbreaks into every neighbour, havens included, and chains', () => {
		const actor = january((world, game) => {
			stackInfection(world, ['tripoli']);
			Object.assign(game.locations[city('tripoli')]!, { supplies: 0, plague: 3 });
			Object.assign(game.locations[city('cairo')]!, { supplies: 0, plague: 3 });
			game.locations[city('haven-mediterranean')]!.supplies = 0;
			game.locations[city('istanbul')]!.supplies = 1;
			game.infectionsLeft = 1;
		}, 'playing.infect');
		send(actor, { type: 'INFECT' });
		const at = (id: string) => gameOf(actor).locations[city(id)]!;
		expect(at('tripoli').plague).toBe(3);
		expect(at('haven-mediterranean').plague).toBe(1);
		expect(at('cairo').plague).toBe(3);
		expect(at('istanbul')).toMatchObject({ supplies: 0, plague: 0 });
		expect(gameOf(actor).incidents).toBe(1);
	});

	test('the eighth incident loses the game at once', () => {
		const actor = january((world, game) => {
			stackInfection(world, ['lagos']);
			game.locations[city('lagos')]!.supplies = 0;
			game.incidents = 7;
			game.infectionsLeft = 2;
		}, 'playing.infect');
		send(actor, { type: 'INFECT' });
		expect(phaseOf(actor.getSnapshot())).toBe('over');
		expect(gameOf(actor).outcome).toMatchObject({ won: false });
	});

	test('an epidemic raises the rate, strips the bottom city without a plague cube, and restacks the discards on top', () => {
		const actor = january((world, game) => {
			const epidemic = Object.values(world.campaign.playerCards).find(card => card.kind === 'epidemic')!.id;
			game.playerDeck.order = [epidemic, ...game.playerDeck.order.filter(card => card !== epidemic)];
			game.playerDeck.piles = [{ size: game.playerDeck.order.length, epidemics: 5 }];
			stackInfection(world, ['cairo']);
			const bottom = game.infectionDeck.order.at(-1)!;
			game.locations[(world.campaign.infectionCards[bottom] as { city: CityId }).city]!.supplies = 3;
			game.infectionDiscard = [game.infectionDeck.order.shift()!];
			game.infectionDeck.strata = [game.infectionDeck.order.toSorted()];
			game.drawsLeft = 2;
		}, 'playing.draw');
		const before = gameOf(actor);
		const bottomCity = (worldOf(actor).campaign.infectionCards[before.infectionDeck.order.at(-1)!] as { city: CityId })
			.city;
		send(actor, { type: 'DRAW' });
		const after = gameOf(actor);
		expect(after.rateIndex).toBe(before.rateIndex + 1);
		expect(after.locations[bottomCity]).toMatchObject({ supplies: 0, plague: 0 });
		expect(after.infectionDiscard).toEqual([]);
		expect(after.infectionDeck.strata[0]).toHaveLength(2);
		expect(after.infectionDeck.order.slice(0, 2).toSorted()).toEqual(after.infectionDeck.strata[0]!);
	});

	test('Hollow Men cards put a figure on the next city instead of infecting it, and leaving them costs an exposure', () => {
		const actor = january((world, game) => {
			const id = 'gather#900' as CardId;
			world.campaign.infectionCards[id] = { id, kind: 'gather' };
			stackInfection(world, ['cairo']);
			game.infectionDeck.order.unshift(id);
			game.infectionDeck.strata[0]!.push(id);
			game.infectionsLeft = 1;
		}, 'playing.infect');
		send(actor, { type: 'INFECT' });
		expect(gameOf(actor).locations[city('cairo')]).toMatchObject({ supplies: 2, hollow: 1 });

		const leaving = january((world, game) => {
			game.players[A]!.location = city('cairo');
			game.locations[city('cairo')]!.hollow = 1;
		});
		act(leaving, { a: 'drive', to: city('tripoli') });
		expect(
			Object.values(worldOf(leaving).campaign.characters).find(character => character.name === 'Ada')!.exposure,
		).toBe(1);
	});
});

describe('actions', () => {
	test('movement obeys adjacency, sea routes, and card costs', () => {
		const actor = january((world, game) => {
			game.players[A]!.location = city('new-york');
			give(world, A, [...cityCards(world, 'cairo', 1), ...cityCards(world, 'new-york', 1)]);
		});
		expect(refuses(actor, { a: 'drive', to: city('cairo') })).toBe('Not adjacent');
		act(actor, { a: 'sail', card: cityCards(worldOf(actor), 'cairo', 1)[0]! });
		expect(gameOf(actor).players[A]!.location).toBe(city('cairo'));
		expect(
			refuses(actor, { a: 'charter', card: cityCards(worldOf(actor), 'new-york', 1)[0]!, to: city('london') }),
		).toContain('card of the city');
		act(actor, { a: 'drive', to: city('tripoli') });
		expect(gameOf(actor).actionsLeft).toBe(2);
	});

	test('the farmer delivers for free right after making supplies, once per turn', () => {
		const actor = january((_, game) => void (game.stockpile = 5));
		act(actor, { a: 'makeSupplies' });
		act(actor, { a: 'deliver', count: 1 });
		expect(gameOf(actor).actionsLeft).toBe(3);
		act(actor, { a: 'makeSupplies' });
		act(actor, { a: 'deliver', count: 1 });
		expect(gameOf(actor).actionsLeft).toBe(1);
	});

	test('five cards of the colour build a supply center, and undo takes the action back', () => {
		const actor = january((world, game) => {
			game.players[A]!.location = city('cairo');
			emptyHand(world, A);
			give(world, A, [
				...cityCards(world, 'cairo', 3),
				...cityCards(world, 'tripoli', 2),
				...cityCards(world, 'london', 1),
			]);
		});
		const cards = [...cityCards(worldOf(actor), 'cairo', 3), ...cityCards(worldOf(actor), 'tripoli', 2)];
		expect(
			refuses(actor, { a: 'buildCenter', cards: [...cards.slice(0, 4), cityCards(worldOf(actor), 'london', 1)[0]!] }),
		).toContain('black');
		act(actor, { a: 'buildCenter', cards });
		expect(gameOf(actor).locations[city('cairo')]!.center).toBe(true);
		expect(gameOf(actor).progress.buildCenters).toBe(1);
		send(actor, { type: 'UNDO' });
		expect(gameOf(actor).locations[city('cairo')]!.center).toBe(false);
		expect(gameOf(actor).players[A]!.hand).toEqual(expect.arrayContaining(cards));
	});

	test('recon opens the region, connects its printed city, unlocks its actions, and rewards the explorer', () => {
		const actor = january((world, game) => {
			game.players[A]!.location = city('washington');
			game.locations[city('washington')]!.center = true;
			give(world, A, [...cityCards(world, 'washington', 2), ...cityCards(world, 'london', 1)]);
		});
		const cards = [...cityCards(worldOf(actor), 'washington', 2), ...cityCards(worldOf(actor), 'london', 1)];
		act(actor, { a: 'recon', route: 'north-america', cards });
		const { campaign } = worldOf(actor);
		expect(campaign.locations[city('denver')]!.revealed).toBe(true);
		expect(grid(campaign).has(city('chicago'))).toBe(true);
		expect(grid(campaign).has(city('denver'))).toBe(false);
		expect(campaign.actions).toEqual(expect.arrayContaining(['establishLine', 'search']));
		expect(Object.values(campaign.playerCards).some(card => card.kind === 'event' && card.mode === 'unrationed')).toBe(
			true,
		);
		expect(gameOf(actor).completed).toContain('reconRegion');
		expect(gameOf(actor).playerDiscard).toEqual(expect.arrayContaining(cityCards(worldOf(actor), 'chicago', 2)));
	});

	test('completing the required objectives wins immediately', () => {
		const actor = january((world, game) => {
			game.progress = { buildCenters: 2 };
			game.completed = ['reconRegion'];
			game.players[A]!.location = city('lagos');
			emptyHand(world, A);
			give(world, A, [...cityCards(world, 'lagos', 3), ...cityCards(world, 'sao-paulo', 2)]);
		});
		act(actor, {
			a: 'buildCenter',
			cards: [...cityCards(worldOf(actor), 'lagos', 3), ...cityCards(worldOf(actor), 'sao-paulo', 2)],
		});
		expect(phaseOf(actor.getSnapshot())).toBe('over');
		expect(gameOf(actor).outcome).toMatchObject({ won: true });
	});

	test('a supply line needs cubes, a land route, and no crossing, and brings a new city onto the grid', () => {
		const actor = january((world, game) => {
			const { campaign } = world;
			campaign.actions.push('establishLine');
			campaign.regions.push('north-america' as never);
			for (const id of ['chicago', 'denver', 'atlanta']) campaign.locations[city(id)]!.revealed = true;
			campaign.edges.push({ a: city('chicago'), b: city('new-york'), kind: 'land' });
			campaign.objectives.push('connectCities');
			game.players[A]!.location = city('chicago');
			game.players[A]!.supplies = 1;
		});
		expect(refuses(actor, { a: 'establishLine', to: city('denver') })).toContain('cubes');
		expect(refuses(actor, { a: 'establishLine', to: city('london') })).toContain('No land route between them');
		const funded = january((world, game) => {
			const { campaign } = world;
			campaign.actions.push('establishLine');
			for (const id of ['chicago', 'denver']) campaign.locations[city(id)]!.revealed = true;
			campaign.edges.push({ a: city('chicago'), b: city('new-york'), kind: 'land' });
			campaign.objectives.push('connectCities');
			game.players[A]!.location = city('chicago');
			game.players[A]!.supplies = 3;
		});
		act(funded, { a: 'establishLine', to: city('denver') });
		expect(grid(worldOf(funded).campaign).has(city('denver'))).toBe(true);
		expect(gameOf(funded).players[A]!.supplies).toBe(1);
		expect(gameOf(funded).progress.connectCities).toBe(1);
		expect(gameOf(funded).gameEndArea.length).toBe(
			pack.cities.find(candidate => candidate.id === 'denver')!.population,
		);
	});
});

describe('turn flow', () => {
	test('a hand over the limit blocks the turn until the player discards', () => {
		const actor = january((world, game) => {
			give(
				world,
				A,
				game.playerDeck.order.filter(card => world.campaign.playerCards[card]!.kind === 'city').slice(0, 5),
			);
			game.playerDeck.piles = [{ size: game.playerDeck.order.length, epidemics: 5 }];
		});
		expect(gameOf(actor).players[A]!.hand.length).toBeGreaterThan(7);
		expect(reject(worldOf(actor), 'playing.actions', { type: 'END_ACTIONS', seat: A })).toContain('pending');
		while (gameOf(actor).players[A]!.hand.length > 7)
			send(actor, { type: 'DECIDE', decide: { d: 'discard', seat: A, cards: [gameOf(actor).players[A]!.hand[0]!] } });
		send(actor, { type: 'END_ACTIONS', seat: A });
		expect(phaseOf(actor.getSnapshot())).toBe('playing.draw');
	});

	test('starting a turn on a plague cube scratches an exposure box, and a skull kills', () => {
		const actor = january((world, game) => {
			const bo = Object.values(world.campaign.characters).find(character => character.name === 'Bo')!;
			bo.exposureTrack = ['skull'];
			game.players[B]!.location = city('cairo');
			game.locations[city('cairo')]!.plague = 1;
			game.players[B]!.supplies = 2;
			stackInfection(world, ['lagos']);
			game.infectionsLeft = 1;
		}, 'playing.infect');
		send(actor, { type: 'INFECT' });
		expect(gameOf(actor).active).toBe(B);
		const bo = Object.values(worldOf(actor).campaign.characters).find(character => character.name === 'Bo')!;
		expect(bo).toMatchObject({ dead: true, diedAt: city('cairo') });
		expect(gameOf(actor).players[B]).toMatchObject({ hand: [], supplies: 0 });
		expect(gameOf(actor).actionsLeft).toBe(0);
		send(actor, { type: 'DECIDE', decide: { d: 'replace', character: null } });
		expect(worldOf(actor).campaign.characters[gameOf(actor).players[B]!.character]!.worker).toBe(true);
	});
});

describe('between games', () => {
	function lost(edit?: (world: World, game: Game) => void) {
		const actor = january((world, game) => {
			game.outcome = { won: false, reason: 'test' };
			edit?.(world, game);
		}, 'over');
		send(actor, { type: 'CONTINUE' });
		return actor;
	}

	test('plague costs population, a supply center adds it, and the two cancel', () => {
		const actor = lost((_, game) => {
			game.locations[city('cairo')]!.plague = 2;
			game.locations[city('lagos')]!.center = true;
			Object.assign(game.locations[city('london')]!, { plague: 1, center: true });
		});
		const population = (id: string) => worldOf(actor).campaign.locations[city(id)]!.population;
		expect([population('cairo'), population('lagos'), population('london')]).toEqual([2, 4, 3]);
		expect(gameOf(actor).upkeep!.units).toBe(3);
	});

	test('a loss replays the month with more rationing, and a second loss moves on', () => {
		const actor = lost();
		send(actor, { type: 'PURCHASE', purchase: { t: 'population', city: city('cairo'), steps: 2 } });
		expect(
			reject(worldOf(actor), 'upkeep', {
				type: 'PURCHASE',
				purchase: { t: 'population', city: city('cairo'), steps: 2 },
			}),
		).toContain('units');
		send(actor, { type: 'FINISH_UPKEEP' });
		expect(worldOf(actor).campaign).toMatchObject({ month: 1, attempt: 2, rationing: 6 });
		expect(worldOf(actor).campaign.locations[city('cairo')]!.population).toBe(5);
		expect(worldOf(actor).game).toBeNull();
	});

	test('February forces North America open with no explorer reward when it was never reconned', () => {
		const actor = lost();
		send(actor, { type: 'FINISH_UPKEEP' });
		const seating = Object.values(worldOf(actor).campaign.characters).map((character, index) => ({
			seat: [A, B][index]!,
			character: character.id,
		}));
		send(actor, { type: 'START_GAME', seating });
		for (const type of ['AUTO_SUPPLY', 'CONFIRM_SUPPLY', 'CONFIRM_EVENTS'] as const) send(actor, { type });
		const second = structuredClone(worldOf(actor));
		second.game!.outcome = { won: false, reason: 'test' };
		const next = createGameActor({ seed: 1, save: { v: 1, phase: 'over', world: second } }).start();
		send(next, { type: 'CONTINUE' });
		send(next, { type: 'FINISH_UPKEEP' });
		expect(worldOf(next).campaign.month).toBe(2);
		send(next, { type: 'START_GAME', seating });
		const { campaign } = worldOf(next);
		expect(campaign.forced as string[]).toContain('north-america');
		expect(campaign.objectives).toEqual(expect.arrayContaining(['reconNewArea', 'connectCities']));
		expect(Object.values(campaign.playerCards).some(card => card.kind === 'event' && card.mode === 'unrationed')).toBe(
			false,
		);
		expect(worldOf(next).game!.stockpile).toBe(33);
	});

	test('the score adds wins, population, labs and the sample, and charges for forsaken cities', () => {
		const actor = january();
		const campaign = structuredClone(worldOf(actor).campaign);
		campaign.results = [
			{ month: 1, attempt: 1, won: true, gridCities: 9, rationing: 4 },
			{ month: 2, attempt: 1, won: false, gridCities: 9, rationing: 2 },
			{ month: 2, attempt: 2, won: true, gridCities: 9, rationing: 4 },
		];
		campaign.locations[city('cairo')]!.population = 0;
		campaign.locations[city('lagos')]!.lab = true;
		campaign.sampleDelivered = true;
		expect(score(campaign)).toMatchObject({
			earlyWins: 50,
			lateWins: 30,
			population: 33,
			sample: 100,
			labs: 25,
			forsaken: -5,
			total: 233,
		});
	});
});

describe('review regressions', () => {
	test('a prologue game leaves no permanent mark on the campaign', () => {
		const actor = createGameActor({ seed: 7 }).start();
		const havens = pack.cities.filter(candidate => candidate.kind === 'haven' && !candidate.lost);
		actor.send({ type: 'CREATE_CHARACTER', name: 'Ada', job: 'farmer', home: havens[0]!.id });
		actor.send({ type: 'CREATE_CHARACTER', name: 'Bo', job: 'instructor', home: havens[0]!.id });
		const before = structuredClone(worldOf(actor).campaign);
		send(actor, {
			type: 'START_GAME',
			seating: Object.values(before.characters).map((character, index) => ({
				seat: [A, B][index]!,
				character: character.id,
			})),
		});
		for (const type of ['AUTO_SUPPLY', 'CONFIRM_SUPPLY', 'CONFIRM_EVENTS'] as const) send(actor, { type });
		// A JSON round trip, as a save does: structuredClone would keep the restore copy aliased to the live campaign.
		const world = JSON.parse(JSON.stringify(worldOf(actor))) as World;
		world.game!.locations[city('london')]!.plague = 2;
		world.game!.outcome = { won: false, reason: 'test' };
		Object.values(world.campaign.characters)[0]!.exposure = 3;
		const ended = createGameActor({ seed: 1, save: { v: 1, phase: 'over', world } }).start();
		send(ended, { type: 'CONTINUE' });
		expect(gameOf(ended).upkeep).toEqual({ units: 0, populationChanges: [] });
		send(ended, { type: 'FINISH_UPKEEP' });
		const after = worldOf(ended).campaign;
		expect(after.locations).toEqual(before.locations);
		expect(after.characters).toEqual(before.characters);
		expect(after).toMatchObject({ month: 0, rationing: before.rationing });
		expect(after.results).toHaveLength(1);
	});

	test('Resilience refuses the same card twice', () => {
		const actor = january((world, game) => {
			const id = 'resilience#901' as CardId;
			world.campaign.playerCards[id] = { id, kind: 'event', event: 'resilience', mode: 'rationed' };
			game.players[A]!.hand.push(id);
			game.infectionDiscard = game.infectionDeck.order.splice(0, 2);
			game.infectionDeck.strata = [game.infectionDeck.order.toSorted()];
		});
		const target = gameOf(actor).infectionDiscard[0]!;
		const play = (cards: CardId[]): Command => ({
			type: 'PLAY',
			seat: A,
			card: 'resilience#901' as CardId,
			play: { e: 'resilience', cards },
		});
		expect(reject(worldOf(actor), 'playing.actions', play([target, target]))).not.toBeNull();
		send(actor, play([target]));
		expect(gameOf(actor).infectionDiscard).toHaveLength(1);
		expect(gameOf(actor).gameEndArea).toEqual([target]);
	});

	test('both cards are drawn before the hand limit applies', () => {
		const actor = january((world, game) => {
			const cards = game.playerDeck.order.filter(card => world.campaign.playerCards[card]!.kind === 'city');
			give(world, A, cards.slice(0, 7 - game.players[A]!.hand.length));
			game.playerDeck.order = [
				...cards.slice(10, 12),
				...game.playerDeck.order.filter(card => !cards.slice(10, 12).includes(card)),
			];
			game.playerDeck.piles = [{ size: game.playerDeck.order.length, epidemics: 5 }];
			game.drawsLeft = 2;
		}, 'playing.draw');
		expect(gameOf(actor).players[A]!.hand).toHaveLength(7);
		send(actor, { type: 'DRAW' });
		send(actor, { type: 'DRAW' });
		expect(gameOf(actor).players[A]!.hand).toHaveLength(9);
		expect(phaseOf(actor.getSnapshot())).toBe('playing.draw');
		expect(reject(worldOf(actor), 'playing.draw', { type: 'INFECT' })).not.toBeNull();
	});

	test('an objective completed in a lost early attempt starts the late attempt complete, and partial progress does not carry', () => {
		const seats = [A, B, 'seat-3' as SeatId];
		const start = (carried: World['campaign']['carriedProgress']) => {
			const save = octoberSave();
			save.world.campaign.attempt = 2;
			save.world.campaign.carriedProgress = carried;
			const actor = createGameActor({ seed: 3, save }).start();
			actor.send({
				type: 'START_GAME',
				seating: Object.values(worldOf(actor).campaign.characters)
					.slice(0, 3)
					.map((entry, index) => ({ seat: seats[index]!, character: entry.id })),
			});
			return actor;
		};
		expect(worldOf(start({})).campaign.objectives).toContain('defect');
		expect(gameOf(start({ defect: 3 })).completed).toEqual(['defect']);
		expect(gameOf(start({})).completed).toEqual([]);
	});

	test('a scar placed over the job switches the job off and still applies', () => {
		const actor = january((world, game) => {
			world.campaign.scars = ['smallHand'];
			game.pending = [{ t: 'scar', seat: A }];
			game.stockpile = 4;
		});
		send(actor, { type: 'DECIDE', decide: { d: 'scar', scar: 'smallHand', target: 'job' } });
		expect(handLimit(worldOf(actor), A)).toBe(6);
		act(actor, { a: 'makeSupplies' });
		act(actor, { a: 'deliver', count: 1 });
		expect(gameOf(actor).actionsLeft).toBe(2);
	});
});

test('the December scenario starts with three players and plays to the end of the campaign', () => {
	const actor = createGameActor({ seed: 3, save: decemberSave() }).start();
	const { campaign } = worldOf(actor);
	expect(campaign).toMatchObject({ month: 12, stockpileBonus: 30 });
	expect(grid(campaign).has(city('utopia'))).toBe(true);
	expect(grid(campaign).has(city('johannesburg'))).toBe(true);
	const seats = ['seat-1', 'seat-2', 'seat-3'] as SeatId[];
	send(actor, {
		type: 'START_GAME',
		seating: Object.values(campaign.characters)
			.slice(0, 3)
			.map((character, index) => ({ seat: seats[index]!, character: character.id })),
	});
	expect(worldOf(actor).campaign.objectives).toEqual(['deliverSample']);
	expect(worldOf(actor).campaign.locations[city('lake-baikal')]!.revealed).toBe(true);
	expect(gameOf(actor).stockpile).toBe(30);
	const rng = { seed: 9 };
	for (let i = 0; i < 20_000 && phaseOf(actor.getSnapshot()) !== 'finished'; i++) {
		actor.send(botCommand(worldOf(actor), phaseOf(actor.getSnapshot()), rng, 3));
	}
	expect(phaseOf(actor.getSnapshot())).toBe('finished');
	expect(worldOf(actor).campaign.results.at(-1)!.month).toBe(12);
});
