import { describe, expect, test } from 'bun:test';
import { checkEdge } from './actions';
import { pack } from './content/pack';
import type { EventId, SearchResult } from './content/types';
import { epidemicCount } from './flow';
import { grid, handLimit, hasEdge } from './helpers';
import type { CardId } from './ids';
import { createGameActor } from './machine';
import { legalPlays } from './options';
import { decemberSave, octoberSave } from './scenarios';
import type { World } from './state';
import {
	A,
	act,
	B,
	C,
	character,
	city,
	cityCards,
	conjure,
	gameOf,
	give,
	infectionCards,
	late,
	phase,
	refuses,
	send,
	stackInfection,
	worldOf,
} from './testkit';
import { publicState } from './view';

const produceCards = (world: World) =>
	Object.values(world.campaign.playerCards)
		.filter(card => card.kind === 'produce')
		.map(card => card.id);

describe('movement', () => {
	test('Charter Boat discards the current city card and reaches any port on the sea route', () => {
		const actor = late((world, game) => {
			game.players[A]!.location = city('new-york');
			give(world, A, cityCards(world, 'new-york'));
		});
		const card = cityCards(worldOf(actor), 'new-york')[0]!;
		expect(refuses(actor, { a: 'charter', card, to: city('chicago') })).toContain('sea route');
		act(actor, { a: 'charter', card, to: city('lagos') });
		expect(gameOf(actor).players[A]!.location).toBe(city('lagos'));
		expect(gameOf(actor).playerDiscard).toContain(card);
	});

	test('Shuttle Flight links havens and supply centers, never a forsaken city', () => {
		const actor = late(world => {
			world.campaign.rules.push('forsaken');
			world.campaign.locations[city('cairo')]!.population = 0;
		});
		expect(refuses(actor, { a: 'shuttle', to: city('denver') })).toContain('havens and supply centers');
		expect(refuses(actor, { a: 'shuttle', to: city('cairo') })).toContain('havens and supply centers');
		act(actor, { a: 'shuttle', to: city('shanghai') });
		expect(gameOf(actor).players[A]!.location).toBe(city('shanghai'));
	});

	test('the Captain sails to any port on the route for any City card', () => {
		const actor = late((world, game) => {
			character(world, A).job = 'captain';
			game.players[A]!.location = city('new-york');
			give(world, A, cityCards(world, 'denver'));
		});
		act(actor, { a: 'captainSail', card: cityCards(worldOf(actor), 'denver')[0]!, to: city('london') });
		expect(gameOf(actor).players[A]!.location).toBe(city('london'));
	});

	test('the Helmsman drives once for free, and the Administrator moves a pawn once per turn', () => {
		const actor = late();
		act(actor, { a: 'drive', to: city('new-york') });
		expect(gameOf(actor).actionsLeft).toBe(4);
		act(actor, { a: 'drive', to: city('washington') });
		expect(gameOf(actor).actionsLeft).toBe(3);
		act(actor, { a: 'administratorMove', pawn: B, to: C });
		expect(gameOf(actor).players[B]!.location).toBe(gameOf(actor).players[C]!.location);
		expect(refuses(actor, { a: 'administratorMove', pawn: C, to: A })).toBe('Once per turn');
	});
});

describe('supplies', () => {
	test('Produce Supplies fills to population here or everywhere, and a spent card is destroyed', () => {
		const actor = late((world, game) => {
			const [first, second] = produceCards(world);
			give(world, A, [first!, second!]);
			(world.campaign.playerCards[second!] as { boxesLeft: number }).boxesLeft = 1;
			game.locations[city('haven-north-atlantic')]!.supplies = 0;
			game.locations[city('cairo')]!.supplies = 0;
			game.locations[city('denver')]!.supplies = 0;
		});
		const [first, second] = gameOf(actor).players[A]!.hand;
		act(actor, { a: 'produce', card: first!, mode: 'local' });
		expect(gameOf(actor).locations[city('haven-north-atlantic')]!.supplies).toBe(3);
		expect(gameOf(actor).locations[city('cairo')]!.supplies).toBe(0);
		act(actor, { a: 'produce', card: second!, mode: 'system' });
		expect(gameOf(actor).locations[city('cairo')]!.supplies).toBe(3);
		expect(gameOf(actor).locations[city('denver')]!.supplies).toBe(0);
		expect(worldOf(actor).campaign.playerCards[second!]).toBeUndefined();
		expect(gameOf(actor).playerDiscard).toContain(first!);
	});

	test('free actions cost nothing, and the Radio Operator transfers at a distance', () => {
		const actor = late((_, game) => void (game.players[B]!.location = game.players[A]!.location));
		act(actor, { a: 'pickUp', count: 2 });
		act(actor, { a: 'transfer', with: B, count: 1, give: true });
		expect(gameOf(actor)).toMatchObject({ actionsLeft: 4 });
		expect([gameOf(actor).players[A]!.supplies, gameOf(actor).players[B]!.supplies]).toEqual([1, 1]);
		expect(refuses(actor, { a: 'transfer', with: C, count: 1, give: true })).toContain('same location');
		const radio = late((world, game) => {
			character(world, A).job = 'radioOperator';
			game.players[A]!.supplies = 3;
		});
		act(radio, { a: 'transfer', with: C, count: 3, give: true });
		expect(gameOf(radio).players[C]!.supplies).toBe(3);
	});

	test('the Immunologist makes supplies from the reserve, and the Courier delivers next door', () => {
		const actor = late((world, game) => {
			character(world, A).job = 'immunologist';
			character(world, A).slots[1] = { kind: 'ability', id: 'courier' };
			game.stockpile = 0;
		});
		const reserve = gameOf(actor).reserve;
		act(actor, { a: 'makeSupplies' });
		expect(gameOf(actor)).toMatchObject({ reserve: reserve - 1, stockpile: 0 });
		act(actor, { a: 'deliver', count: 1, to: city('new-york') });
		expect(gameOf(actor).locations[city('new-york')]!.supplies).toBe(3);
	});

	test("Share Knowledge moves the city's own card, and the Instructor gives any card", () => {
		const setup = (job: 'administrator' | 'instructor') =>
			late((world, game) => {
				character(world, A).job = job;
				game.players[A]!.location = city('cairo');
				game.players[B]!.location = city('cairo');
				give(world, A, [...cityCards(world, 'cairo'), ...cityCards(world, 'london')]);
			});
		const plain = setup('administrator');
		const [cairo, london] = gameOf(plain).players[A]!.hand;
		expect(refuses(plain, { a: 'share', card: london!, with: B, give: true })).toContain("city's card");
		act(plain, { a: 'share', card: cairo!, with: B, give: true });
		expect(gameOf(plain).players[B]!.hand).toEqual([cairo!]);
		const teacher = setup('instructor');
		act(teacher, { a: 'share', card: london!, with: B, give: true });
		expect(gameOf(teacher).players[B]!.hand).toEqual([london!]);
	});
});

describe('building', () => {
	test('the Laborer pays 4 cards and 2 cubes', () => {
		const actor = late((world, game) => {
			character(world, A).job = 'laborer';
			game.players[A]!.location = city('lagos');
			game.players[A]!.supplies = 2;
			give(world, A, cityCards(world, 'lagos', 4));
		});
		act(actor, { a: 'buildCenter', cards: gameOf(actor).players[A]!.hand, laborer: true });
		expect(gameOf(actor).locations[city('lagos')]!.center).toBe(true);
		expect(gameOf(actor).players[A]!.supplies).toBe(0);
	});

	test('the Architect and a Builder companion each save a card, and improved cards count for more', () => {
		const discounted = late((world, game) => {
			character(world, A).slots[1] = { kind: 'ability', id: 'architect' };
			game.players[A]!.location = city('london');
			give(world, A, cityCards(world, 'london', 3));
			conjure(world, A, { kind: 'companion', companion: 'builder' });
		});
		act(discounted, { a: 'buildCenter', cards: gameOf(discounted).players[A]!.hand.slice(0, 3) });
		expect(gameOf(discounted).locations[city('london')]!.center).toBe(true);

		const improved = late((world, game) => {
			const [first, second] = cityCards(world, 'london', 2);
			(world.campaign.playerCards[first!] as { improvement: string }).improvement = 'triple';
			(world.campaign.playerCards[second!] as { improvement: string }).improvement = 'double';
			game.players[A]!.location = city('london');
			give(world, A, [first!, second!]);
		});
		act(improved, { a: 'buildCenter', cards: gameOf(improved).players[A]!.hand });
		expect(gameOf(improved).locations[city('london')]!.center).toBe(true);
	});

	test('with every piece placed, building moves a supply center that is not permanent', () => {
		const actor = late((world, game) => {
			game.pieces.center = 0;
			game.locations[city('lagos')]!.center = true;
			game.players[A]!.location = city('london');
			give(world, A, cityCards(world, 'london', 4));
			give(world, A, cityCards(world, 'new-york', 1));
		});
		const cards = gameOf(actor).players[A]!.hand;
		expect(refuses(actor, { a: 'buildCenter', cards })).toContain('pick one to move');
		expect(refuses(actor, { a: 'buildCenter', cards, moveFrom: city('cairo') })).toContain('permanent');
		act(actor, { a: 'buildCenter', cards, moveFrom: city('lagos') });
		expect(gameOf(actor).locations[city('lagos')]!.center).toBe(false);
		expect(gameOf(actor).locations[city('london')]!.center).toBe(true);
	});

	test('towers cost 2 cubes, count toward triangulation, and enable Transmit and Monitor', () => {
		const actor = late((world, game) => {
			world.campaign.objectives.push('triangulate');
			world.campaign.frequenciesUsed = [];
			world.campaign.routes = world.campaign.routes.filter(route => route !== 'hidden:east-asia');
			world.campaign.opened = world.campaign.opened.filter(bundle => bundle !== 'frequency-route');
			game.players[A]!.location = city('lagos');
			game.players[A]!.supplies = 2;
			give(world, A, [...cityCards(world, 'lagos'), ...cityCards(world, 'london')]);
		});
		const [lagos, london] = gameOf(actor).players[A]!.hand;
		expect(refuses(actor, { a: 'transmit', card: lagos!, to: C })).toContain('tower');
		act(actor, { a: 'buildTower' });
		expect(gameOf(actor).players[A]!.supplies).toBe(0);
		// Tripoli's permanent tower is black and Lagos is yellow: two colours so far.
		expect(gameOf(actor).progress.triangulate).toBe(2);
		expect(refuses(actor, { a: 'transmit', card: london!, to: C })).toContain('colour');
		act(actor, { a: 'transmit', card: lagos!, to: C });
		expect(gameOf(actor).players[C]!.hand).toEqual([lagos!]);
		const discards = gameOf(actor).playerDiscard.length;
		act(actor, { a: 'monitor', frequency: 3 });
		expect(gameOf(actor).playerDiscard.length).toBe(discards + 4);
		expect(worldOf(actor).campaign.routes).toContain('hidden:east-asia');
		expect(refuses(actor, { a: 'monitor', frequency: 3 })).toContain('used up');
	});

	test('a shelter costs a card of the colour and stops exposure in its city', () => {
		const actor = late((world, game) => {
			game.players[A]!.location = city('tehran');
			give(world, A, cityCards(world, 'cairo'));
			game.players[B]!.location = city('tehran');
			game.locations[city('tehran')]!.plague = 1;
			game.locations[city('tehran')]!.hollow = 1;
		});
		act(actor, { a: 'buildShelter', card: gameOf(actor).players[A]!.hand[0]! });
		expect(gameOf(actor).locations[city('tehran')]!.shelter).toBe(true);
		act(actor, { a: 'drive', to: city('moscow') });
		expect(character(worldOf(actor), A).exposure).toBe(0);
	});

	test('the Vector Control Expert shelters any location without a card', () => {
		const actor = late(world => void (character(world, A).job = 'vectorControl'));
		act(actor, { a: 'buildShelter' });
		expect(gameOf(actor).locations[gameOf(actor).players[A]!.location]!.shelter).toBe(true);
	});
});

describe('exploring', () => {
	test('a sea lane costs 2 cubes, joins ports within reach, and is free once a turn for the Navigator', () => {
		const find = (world: World) =>
			pack.candidateEdges.find(
				edge =>
					edge.kind === 'sea' &&
					!hasEdge(world.campaign, edge.a, edge.b) &&
					checkEdge(world.campaign, edge.a, edge.b, 'sea') === null,
			)!;
		const actor = late((world, game) => {
			game.players[A]!.location = find(world).a;
			game.players[A]!.supplies = 1;
		});
		const edge = find(worldOf(actor));
		expect(refuses(actor, { a: 'chartLane', to: edge.b })).toContain('cubes');
		const funded = late((world, game) => {
			game.players[A]!.location = find(world).a;
			game.players[A]!.supplies = 2;
		});
		act(funded, { a: 'chartLane', to: edge.b });
		expect(hasEdge(worldOf(funded).campaign, edge.a, edge.b)).toBe(true);
		expect(gameOf(funded).players[A]!.supplies).toBe(0);
		const navigator = late((world, game) => {
			character(world, A).slots[1] = { kind: 'ability', id: 'navigator' };
			game.players[A]!.location = find(world).a;
		});
		act(navigator, { a: 'chartLane', to: edge.b });
		expect(hasEdge(worldOf(navigator).campaign, edge.a, edge.b)).toBe(true);
	});

	test('a sea lane may not jump past a neighbouring region', () => {
		const { campaign } = worldOf(late());
		expect(checkEdge(campaign, city('new-york'), city('tokyo'), 'sea')).not.toBeNull();
	});

	const searching = (result: SearchResult, edit?: (world: World) => void) => {
		const actor = late((world, game) => {
			const [card] = cityCards(world, 'denver');
			(world.campaign.playerCards[card!] as { search: unknown[] }).search = [
				{ scope: 'land', result, scratched: false },
			];
			game.players[A]!.location = city('denver');
			give(world, A, [card!]);
			edit?.(world);
		});
		act(actor, { a: 'search', card: gameOf(actor).players[A]!.hand[0]!, box: 0 });
		return actor;
	};

	test('search results: supplies, stockpile, actions, companion, infest, discovery', () => {
		expect(gameOf(searching({ t: 'supplies', amount: 3, from: 'reserve' })).locations[city('denver')]!.supplies).toBe(
			5,
		);
		expect(gameOf(searching({ t: 'stockpile', amount: 4 })).stockpile).toBe(24);
		expect(gameOf(searching({ t: 'actions', amount: 2 })).actionsLeft).toBe(5);
		const found = searching({ t: 'companion', companion: 'medic' });
		expect(
			gameOf(found).players[A]!.hand.some(id => worldOf(found).campaign.playerCards[id]?.kind === 'companion'),
		).toBe(true);
		expect(worldOf(searching({ t: 'infest' })).campaign.locations[city('denver')]!.infested).toBe(true);
		const repeat = searching({ t: 'discover', bundle: 'opal' as never });
		expect(gameOf(repeat).actionsLeft).toBe(4);
		expect(refuses(repeat, { a: 'search', card: gameOf(repeat).players[A]!.hand[0]!, box: 0 })).toContain('used up');
	});

	test('search results that ask for a choice: retrieve, set aside, remove Hollow Men, free route', () => {
		const retrieve = searching(
			{ t: 'retrieve' },
			world => void world.game!.playerDiscard.push(...cityCards(world, 'tokyo')),
		);
		expect(gameOf(retrieve).pending[0]).toMatchObject({ t: 'retrieve' });
		const tokyo = cityCards(worldOf(retrieve), 'tokyo')[0]!;
		send(retrieve, { type: 'DECIDE', decide: { d: 'retrieve', card: tokyo } });
		expect(gameOf(retrieve).players[A]!.hand).toContain(tokyo);

		const aside = searching({ t: 'quarantineCard' }, world => {
			stackInfection(world, []);
			world.game!.infectionDiscard = [world.game!.infectionDeck.order.shift()!];
			world.game!.infectionDeck.strata = [world.game!.infectionDeck.order.toSorted()];
		});
		const target = gameOf(aside).infectionDiscard[0]!;
		send(aside, { type: 'DECIDE', decide: { d: 'quarantineCard', card: target } });
		expect(gameOf(aside).gameEndArea).toEqual([target]);

		const hunt = searching(
			{ t: 'removeHollow', amount: 2 },
			world => void (world.game!.locations[city('cairo')]!.hollow = 2),
		);
		send(hunt, { type: 'DECIDE', decide: { d: 'removeHollow', cities: [city('cairo'), city('cairo')] } });
		expect(gameOf(hunt).locations[city('cairo')]!.hollow).toBe(0);

		const route = searching({ t: 'freeEdge', kind: 'land' });
		expect(gameOf(route).pending[0]).toMatchObject({ t: 'freeEdge' });
		const to = pack.candidateEdges
			.map(edge =>
				edge.kind === 'land' && edge.a === 'denver'
					? edge.b
					: edge.kind === 'land' && edge.b === 'denver'
						? edge.a
						: null,
			)
			.find(other => other && !hasEdge(worldOf(route).campaign, city('denver'), other))!;
		send(route, { type: 'DECIDE', decide: { d: 'freeEdge', to } });
		expect(hasEdge(worldOf(route).campaign, city('denver'), to)).toBe(true);
	});

	test('the Lookout searches with a card from the discard pile', () => {
		const actor = late((world, game) => {
			character(world, A).slots[1] = { kind: 'ability', id: 'lookout' };
			const [card] = cityCards(world, 'denver');
			(world.campaign.playerCards[card!] as { search: unknown[] }).search = [
				{ scope: 'land', result: { t: 'actions', amount: 1 }, scratched: false },
			];
			give(world, A, [card!]);
			game.playerDiscard.push(game.players[A]!.hand.pop()!);
			game.players[A]!.location = city('denver');
		});
		act(actor, { a: 'search', card: cityCards(worldOf(actor), 'denver')[0]!, box: 0 });
		expect(gameOf(actor).searches).toBe(1);
	});

	test('recon: different cities when the route says so, the Surveyor saves a card, a scar adds one, the Scout needs no center', () => {
		const at = (edit?: (world: World) => void) =>
			late((world, game) => {
				world.campaign.routes.push('hidden:plan-blue');
				game.players[A]!.location = city('shanghai');
				give(world, A, [
					...cityCards(world, 'london', 2),
					...cityCards(world, 'new-york'),
					...cityCards(world, 'washington'),
					...cityCards(world, 'paris'),
				]);
				edit?.(world);
			});
		const plain = at();
		const [london, london2, newYork, washington, paris] = gameOf(plain).players[A]!.hand as [
			CardId,
			CardId,
			CardId,
			CardId,
			CardId,
		];
		expect(refuses(plain, { a: 'recon', route: 'hidden:plan-blue', cards: [london, london2, newYork] })).toContain(
			'different city',
		);
		act(plain, { a: 'recon', route: 'hidden:plan-blue', cards: [london, newYork, washington] });
		expect(worldOf(plain).campaign.opened as string[]).toContain('plan-blue');
		expect(refuses(plain, { a: 'recon', route: 'hidden:plan-blue', cards: [london2, paris] })).toBe('Already reconned');

		const surveyor = at(world => void (character(world, A).slots[1] = { kind: 'ability', id: 'surveyor' }));
		act(surveyor, { a: 'recon', route: 'hidden:plan-blue', cards: [london, newYork] });
		const scarred = at(world => void (character(world, A).slots[1] = { kind: 'scar', id: 'reconExtraCard' }));
		expect(refuses(scarred, { a: 'recon', route: 'hidden:plan-blue', cards: [london, newYork, washington] })).toContain(
			'4',
		);
		act(scarred, { a: 'recon', route: 'hidden:plan-blue', cards: [london, newYork, washington, paris] });

		const scout = (ability: boolean) =>
			late((world, game) => {
				world.campaign.opened = world.campaign.opened.filter(bundle => bundle !== 'coral-sea');
				if (ability) character(world, A).slots[1] = { kind: 'ability', id: 'scout' };
				game.players[A]!.location = city('jakarta');
				give(world, A, [...cityCards(world, 'jakarta'), ...cityCards(world, 'tokyo')]);
			});
		expect(
			refuses(scout(false), { a: 'recon', route: 'coral-sea', cards: gameOf(scout(false)).players[A]!.hand }),
		).toContain('supply center');
		const scouting = scout(true);
		act(scouting, { a: 'recon', route: 'coral-sea', cards: gameOf(scouting).players[A]!.hand });
		expect(worldOf(scouting).campaign.opened as string[]).toContain('coral-sea');
	});
});

describe('Hollow Men and forsaken cities', () => {
	test('Broadcast moves Hollow Men next door, and three in havens completes the October objective', () => {
		const actor = late((world, game) => {
			world.campaign.objectives = ['defect'];
			world.campaign.required = 1;
			game.players[A]!.location = city('tripoli');
			game.locations[city('tripoli')]!.tower = true;
			game.locations[city('istanbul')]!.hollow = 3;
		});
		expect(refuses(actor, { a: 'broadcast', from: city('lagos'), to: city('haven-south-atlantic') })).toContain(
			'colour',
		);
		for (let i = 0; i < 3; i++) act(actor, { a: 'broadcast', from: city('istanbul'), to: city('haven-mediterranean') });
		expect(gameOf(actor).locations[city('haven-mediterranean')]!.hollow).toBe(3);
		expect(gameOf(actor).outcome).toMatchObject({ won: true });
		expect(worldOf(actor).campaign.opened as string[]).toContain('defection');
	});

	test('the Saboteur discards a card to remove a Hollow Man from a city of its colour', () => {
		const actor = late((world, game) => {
			character(world, A).slots[1] = { kind: 'ability', id: 'saboteur' };
			give(world, A, cityCards(world, 'tripoli'));
			game.locations[city('cairo')]!.hollow = 1;
		});
		act(actor, { a: 'sabotage', card: gameOf(actor).players[A]!.hand[0]!, city: city('cairo') });
		expect(gameOf(actor).locations[city('cairo')]!.hollow).toBe(0);
	});

	test('a fourth Hollow Man costs the city a point of population, and running out of figures loses', () => {
		const gather = (edit: (world: World) => void) =>
			late((world, game) => {
				const card = Object.values(world.campaign.infectionCards).find(entry => entry.kind === 'gather')!.id;
				stackInfection(world, ['cairo']);
				game.infectionDeck.order = [card, ...game.infectionDeck.order.filter(id => id !== card)];
				game.infectionDeck.strata = [game.infectionDeck.order.toSorted()];
				game.infectionsLeft = 1;
				edit(world);
			}, 'playing.infect');
		const full = gather(world => void (world.game!.locations[city('cairo')]!.hollow = 3));
		const before = worldOf(full).campaign.locations[city('cairo')]!.population;
		send(full, { type: 'INFECT' });
		expect(gameOf(full).locations[city('cairo')]!.hollow).toBe(3);
		expect(worldOf(full).campaign.locations[city('cairo')]!.population).toBe(before - 1);
		const empty = gather(world => void (world.game!.pieces.hollow = 0));
		send(empty, { type: 'INFECT' });
		expect(gameOf(empty).outcome).toMatchObject({ won: false });
	});

	test('from September the last three setup infections place Hollow Men instead', () => {
		const actor = createGameActor({ seed: 5, save: decemberSave() }).start();
		send(actor, {
			type: 'START_GAME',
			seating: Object.values(worldOf(actor).campaign.characters)
				.slice(0, 2)
				.map((entry, index) => ({ seat: [A, B][index]!, character: entry.id })),
		});
		send(actor, { type: 'AUTO_SUPPLY' });
		send(actor, { type: 'CONFIRM_SUPPLY' });
		const game = gameOf(actor);
		const hollow = Object.values(game.locations).reduce((sum, location) => sum + location.hollow, 0);
		const cityDiscards = game.infectionDiscard.filter(
			id => worldOf(actor).campaign.infectionCards[id]!.kind === 'city',
		);
		expect(hollow).toBe(3);
		expect(cityDiscards).toHaveLength(9);
		// Six ordinary setup infections: each either returned a cube to the stockpile or left a plague cube.
		expect(game.stockpile + game.incidents).toBe(6);
	});

	test('a forsaken city is skipped by infection, allows only Drive or Ferry, and exposes whoever starts there', () => {
		const actor = late((world, game) => {
			world.campaign.rules.push('forsaken');
			Object.assign(world.campaign.locations[city('cairo')]!, { population: 0, infested: true });
			stackInfection(world, ['cairo', 'lagos']);
			game.infectionsLeft = 1;
			game.players[B]!.location = city('cairo');
		}, 'playing.infect');
		send(actor, { type: 'INFECT' });
		expect(gameOf(actor).gameEndArea).toEqual(infectionCards(worldOf(actor), 'cairo', 1));
		expect(gameOf(actor).locations[city('lagos')]!.supplies).toBe(1);
		expect(gameOf(actor).active).toBe(B);
		expect(character(worldOf(actor), B).exposure).toBe(1);
		expect(refuses(actor, { a: 'makeSupplies' }, B)).toContain('forsaken');
		act(actor, { a: 'drive', to: city('istanbul') }, B);
	});

	test('a Field Surgeon companion shrugs off an infested city', () => {
		const actor = late((world, game) => {
			game.players[B]!.location = city('delhi');
			conjure(world, B, { kind: 'companion', companion: 'fieldSurgeon' });
			stackInfection(world, ['lagos']);
			game.infectionsLeft = 1;
		}, 'playing.infect');
		expect(worldOf(actor).campaign.locations[city('delhi')]!.infested).toBe(true);
		send(actor, { type: 'INFECT' });
		expect(gameOf(actor).active).toBe(B);
		expect(character(worldOf(actor), B).exposure).toBe(0);
	});
});

describe('storage and shields', () => {
	test('Inoculate stores a city card from either discard pile for free', () => {
		const actor = late((world, game) => {
			game.players[A]!.location = city('cairo');
			game.playerDiscard.push(...cityCards(world, 'cairo'));
			stackInfection(world, ['cairo']);
			game.infectionDiscard = [game.infectionDeck.order.shift()!];
			game.infectionDeck.strata = [game.infectionDeck.order.toSorted()];
		});
		const player = cityCards(worldOf(actor), 'cairo')[0]!;
		const infection = gameOf(actor).infectionDiscard[0]!;
		act(actor, { a: 'inoculate', card: player });
		act(actor, { a: 'inoculate', card: infection });
		expect(worldOf(actor).campaign.stored).toEqual({ player: [player], infection: [infection] });
		expect(gameOf(actor).actionsLeft).toBe(4);
	});

	test('from September an Epidemic strikes a stored Infection card before the bottom of the deck', () => {
		const actor = late((world, game) => {
			const epidemic = Object.values(world.campaign.playerCards).find(card => card.kind === 'epidemic')!.id;
			game.playerDeck.order = [epidemic, ...game.playerDeck.order.filter(card => card !== epidemic)];
			game.playerDeck.piles = [{ size: game.playerDeck.order.length, epidemics: 10 }];
			const [stored] = infectionCards(world, 'lagos');
			stackInfection(world, []);
			game.infectionDeck.order = game.infectionDeck.order.filter(card => card !== stored);
			game.infectionDeck.strata = [game.infectionDeck.order.toSorted()];
			world.campaign.stored.infection = [stored!];
			game.drawsLeft = 2;
		}, 'playing.draw');
		const bottom = gameOf(actor).infectionDeck.order.at(-1)!;
		send(actor, { type: 'DRAW' });
		expect(gameOf(actor).locations[city('lagos')]!.supplies).toBe(0);
		expect(worldOf(actor).campaign.stored.infection).toEqual([]);
		expect(gameOf(actor).infectionDeck.order.at(-1)).toBe(bottom);
		expect(gameOf(actor).infectionDeck.order[0]).toBe(infectionCards(worldOf(actor), 'lagos')[0]!);
	});

	test('with the Topaz lab found, a matching card may be discarded to keep the cube', () => {
		const flip = () =>
			late((world, game) => {
				stackInfection(world, ['cairo']);
				give(world, B, cityCards(world, 'tripoli'));
				game.infectionsLeft = 1;
			}, 'playing.infect');
		const shielded = flip();
		send(shielded, { type: 'INFECT' });
		expect(gameOf(shielded).pending[0]).toMatchObject({ t: 'shield', city: city('cairo') });
		send(shielded, { type: 'DECIDE', decide: { d: 'shield', seat: B, card: gameOf(shielded).players[B]!.hand[0]! } });
		expect(gameOf(shielded).locations[city('cairo')]!.supplies).toBe(2);
		expect(gameOf(shielded).players[B]!.hand).toEqual([]);
		const skipped = flip();
		send(skipped, { type: 'INFECT' });
		send(skipped, { type: 'DECIDE', decide: { d: 'skip' } });
		expect(gameOf(skipped).locations[city('cairo')]!.supplies).toBe(1);
	});
});

describe('jobs with free actions', () => {
	test('the Sanitation Officer trades two cards for one from the discard pile', () => {
		const actor = late((world, game) => {
			character(world, A).job = 'sanitationOfficer';
			give(world, A, [...cityCards(world, 'cairo'), ...cityCards(world, 'london')]);
			game.playerDiscard.push(...cityCards(world, 'tokyo'));
		});
		const tokyo = cityCards(worldOf(actor), 'tokyo')[0]!;
		act(actor, { a: 'salvage', discard: gameOf(actor).players[A]!.hand, take: tokyo });
		expect(gameOf(actor).players[A]!.hand).toEqual([tokyo]);
		expect(gameOf(actor).actionsLeft).toBe(4);
	});

	test("the Scientist destroys the city's discarded Infection card, once per turn", () => {
		const actor = late((world, game) => {
			character(world, A).job = 'scientist';
			game.players[A]!.location = city('cairo');
			const cards = infectionCards(world, 'cairo', 2);
			game.infectionDeck.order = game.infectionDeck.order.filter(card => !cards.includes(card));
			game.infectionDeck.strata = [game.infectionDeck.order.toSorted()];
			game.infectionDiscard = [...game.infectionDiscard.filter(card => !cards.includes(card)), ...cards];
		});
		const [first, second] = infectionCards(worldOf(actor), 'cairo', 2);
		act(actor, { a: 'destroyInfection', card: first! });
		expect(worldOf(actor).campaign.infectionCards[first!]).toBeUndefined();
		expect(refuses(actor, { a: 'destroyInfection', card: second! })).toBe('Once per turn');
	});

	test('the Broker swaps a card for one of the same colour from the discard pile', () => {
		const actor = late((world, game) => {
			character(world, A).slots[1] = { kind: 'ability', id: 'broker' };
			give(world, A, cityCards(world, 'cairo'));
			game.playerDiscard.push(...cityCards(world, 'tripoli'), ...cityCards(world, 'london'));
		});
		const tripoli = cityCards(worldOf(actor), 'tripoli')[0]!;
		expect(
			refuses(actor, {
				a: 'broker',
				card: gameOf(actor).players[A]!.hand[0]!,
				take: cityCards(worldOf(actor), 'london')[0]!,
			}),
		).toContain('same colour');
		act(actor, { a: 'broker', card: gameOf(actor).players[A]!.hand[0]!, take: tripoli });
		expect(gameOf(actor).players[A]!.hand).toEqual([tripoli]);
	});

	test('the Record Keeper holds one more card and a Burdened scar one fewer', () => {
		const world = worldOf(late(inner => void (character(inner, C).slots[0] = { kind: 'scar', id: 'smallHand' })));
		expect([handLimit(world, A), handLimit(world, B), handLimit(world, C)]).toEqual([7, 8, 6]);
	});
});

describe('exposure and the carrier', () => {
	test('an exposed haven worker drops their hand and goes home', () => {
		const actor = late((world, game) => {
			Object.assign(character(world, B), { worker: true, exposureTrack: [], job: null });
			game.players[B]!.location = city('cairo');
			game.locations[city('cairo')]!.plague = 1;
			give(world, B, cityCards(world, 'london'));
			stackInfection(world, ['lagos']);
			game.infectionsLeft = 1;
		}, 'playing.infect');
		send(actor, { type: 'INFECT' });
		expect(gameOf(actor).players[B]).toMatchObject({ hand: [], location: character(worldOf(actor), B).home });
		expect(gameOf(actor).actionsLeft).toBe(0);
	});

	test('taking the sample scars the carrier, who then walks, pays to enter cities, and wins on arrival', () => {
		const actor = late((world, game) => {
			world.campaign.edges.push({ a: city('utopia'), b: city('lake-baikal'), kind: 'land' });
			character(world, A).exposureTrack = ['empty', 'scar', 'skull'];
			game.players[A]!.location = city('lake-baikal');
			give(world, A, cityCards(world, 'tokyo'));
		});
		act(actor, { a: 'selfInject' });
		expect(character(worldOf(actor), A)).toMatchObject({ carrier: true, exposure: 2, dead: false });
		expect(character(worldOf(actor), A).slots.filter(slot => slot?.id === 'carrier')).toHaveLength(2);
		expect(refuses(actor, { a: 'shuttle', to: city('shanghai') })).toContain('Drive or Ferry');
		expect(refuses(actor, { a: 'drive', to: city('utopia') })).toContain('colour');
		act(actor, { a: 'drive', to: city('utopia'), card: gameOf(actor).players[A]!.hand[0]! });
		expect(gameOf(actor).players[A]!.location).toBe(city('utopia'));
		expect(refuses(actor, { a: 'administratorMove', pawn: A, to: B })).toContain('carrier');

		const arriving = late((world, game) => {
			character(world, A).carrier = true;
			game.players[A]!.location = city('dar-es-salaam');
			give(world, A, cityCards(world, 'london'));
		});
		act(arriving, { a: 'drive', to: city('johannesburg'), card: gameOf(arriving).players[A]!.hand[0]! });
		expect(gameOf(arriving).outcome).toMatchObject({ won: true });
		expect(worldOf(arriving).campaign.sampleDelivered).toBe(true);
		send(arriving, { type: 'CONTINUE' });
		expect(character(worldOf(arriving), A).dead).toBe(true);
	});
});

describe('events and companions', () => {
	const scene = (world: World) => {
		const game = world.game!;
		game.players[A]!.location = city('cairo');
		game.locations[city('cairo')]!.plague = 2;
		game.locations[city('lagos')]!.hollow = 1;
		give(world, B, cityCards(world, 'london'));
		give(world, C, cityCards(world, 'tokyo'));
		stackInfection(world, []);
		game.infectionDiscard = game.infectionDeck.order.splice(0, 2);
		game.infectionDeck.strata = [game.infectionDeck.order.toSorted()];
	};
	const checks: Record<string, (before: World, after: World) => void> = {
		airlift: (before, after) =>
			expect(Object.values(after.game!.players).map(player => player.location)).not.toEqual(
				Object.values(before.game!.players).map(player => player.location),
			),
		quietNight: (_, after) => expect(after.game!.skipInfection).toBe(true),
		resilience: (_, after) => expect(after.game!.gameEndArea).toHaveLength(1),
		supplyDrop: (before, after) => expect(after.game!.reserve).toBe(before.game!.reserve - 4),
		secondWind: (_, after) => expect(after.game!.actionsLeft).toBe(6),
		scavenge: (before, after) =>
			expect(after.game!.playerDeck.order.length).toBe(before.game!.playerDeck.order.length - 4),
		openWaters: (before, after) => expect(after.campaign.edges.length).toBe(before.campaign.edges.length + 1),
		safeHouses: (before, after) => expect(after.game!.pieces.shelter).toBe(before.game!.pieces.shelter - 1),
		purge: (_, after) => expect(after.game!.locations[city('cairo')]!.plague).toBe(0),
		stockUp: (before, after) => expect(after.game!.stockpile).toBe(before.game!.stockpile + 6),
		cardSwap: (before, after) => expect(after.game!.players[B]!.hand).not.toEqual(before.game!.players[B]!.hand),
		surplus: (_, after) => expect(after.game!.players[A]!.supplies).toBe(3),
		medic: (_, after) => expect(after.game!.locations[city('cairo')]!.plague).toBe(1),
		purifier: (_, after) => expect(after.game!.locations[city('cairo')]!.plague).toBe(0),
		shelterWright: (before, after) => expect(after.game!.pieces.shelter).toBe(before.game!.pieces.shelter - 1),
		marksman: (_, after) => expect(after.game!.locations[city('lagos')]!.hollow).toBe(0),
	};

	for (const event of pack.events) {
		test(`event: ${event.name}`, () => {
			const actor = late(world => {
				scene(world);
				conjure(world, A, { kind: 'event', event: event.id });
			});
			const before = worldOf(actor);
			const card = gameOf(actor).players[A]!.hand.at(-1)!;
			const play = legalPlays(before).find(option => option.card === card);
			expect(play).toBeDefined();
			send(actor, { type: 'PLAY', ...play! });
			checks[event.id as EventId]!(before, worldOf(actor));
			expect(gameOf(actor).playerDiscard).toContain(card);
		});
	}

	for (const companion of pack.companions.filter(entry => entry.spent)) {
		test(`companion: ${companion.name}`, () => {
			const actor = late(world => {
				scene(world);
				conjure(world, A, { kind: 'companion', companion: companion.id });
			});
			const before = worldOf(actor);
			const card = gameOf(actor).players[A]!.hand.at(-1)!;
			const play = legalPlays(before).find(option => option.card === card);
			expect(play).toBeDefined();
			send(actor, { type: 'PLAY', ...play! });
			checks[companion.id]!(before, worldOf(actor));
			expect(worldOf(actor).campaign.playerCards[card]).toBeUndefined();
		});
	}

	test('an Unrationed Event is destroyed after use, and companions lower costs while held', () => {
		const actor = late(world => {
			const id = conjure(world, A, { kind: 'event', event: 'stockUp' });
			(world.campaign.playerCards[id] as { mode: string }).mode = 'unrationed';
		});
		const card = gameOf(actor).players[A]!.hand[0]!;
		send(actor, { type: 'PLAY', seat: A, card, play: { e: 'stockUp' } });
		expect(worldOf(actor).campaign.playerCards[card]).toBeUndefined();

		const cheap = late((world, game) => {
			conjure(world, A, { kind: 'companion', companion: 'rigger' });
			conjure(world, A, { kind: 'companion', companion: 'tracker' });
			game.players[A]!.location = city('lagos');
			game.players[A]!.supplies = 1;
		});
		act(cheap, { a: 'buildTower' });
		expect(gameOf(cheap).locations[city('lagos')]!.tower).toBe(true);
	});
});

describe('game end and the campaign', () => {
	const ended = (won: boolean, edit?: (world: World) => void) => {
		const actor = late(world => {
			world.campaign.month = 10;
			world.game!.outcome = { won, reason: 'test' };
			edit?.(world);
		}, 'over');
		send(actor, { type: 'CONTINUE' });
		return actor;
	};

	test('every purchase applies, and permanent structures stand at the next setup', () => {
		const actor = ended(false, world => {
			const game = world.game!;
			game.locations[city('lagos')]!.tower = true;
			game.locations[city('tehran')]!.shelter = true;
			game.locations[city('london')]!.center = true;
			world.campaign.locations[city('frankfurt')]!.population = 0;
			world.campaign.freeAbilityUnits = 2;
			world.campaign.abilitiesForSale.push('architect');
		});
		const { campaign } = worldOf(actor);
		const units = gameOf(actor).upkeep!.units;
		const ada = Object.values(campaign.characters)[0]!.id;
		const purchases = [
			{ t: 'ability', ability: 'architect', character: ada, slot: 1 },
			{ t: 'cityImprovement', improvement: 'double', card: cityCards(worldOf(actor), 'london')[0]! },
			{ t: 'infectionImprovement', improvement: 'wellStocked', card: infectionCards(worldOf(actor), 'cairo')[0]! },
			{ t: 'population', city: city('lagos'), steps: 1 },
			{ t: 'restore', city: city('frankfurt') },
			{ t: 'permanent', structure: 'shelter', city: city('tehran') },
		] as const;
		for (const purchase of purchases) send(actor, { type: 'PURCHASE', purchase });
		const after = worldOf(actor).campaign;
		expect(gameOf(actor).upkeep!.units).toBe(units - 1 - 1 - 1 - 2 - 2);
		expect(after.freeAbilityUnits).toBe(0);
		expect(after.characters[ada]!.slots[1]).toEqual({ kind: 'ability', id: 'architect' });
		expect(after.locations[city('frankfurt')]!.population).toBe(1);
		expect(after.locations[city('lagos')]!.population).toBe(campaign.locations[city('lagos')]!.population + 1);
		send(actor, { type: 'FINISH_UPKEEP' });
		expect(phase(actor)).toBe('lobby');
		expect(worldOf(actor).campaign).toMatchObject({ month: 10, attempt: 2 });
		send(actor, {
			type: 'START_GAME',
			seating: [
				{ seat: A, character: ada },
				{ seat: B, character: Object.values(after.characters)[1]!.id },
			],
		});
		expect(gameOf(actor).locations[city('tehran')]!.shelter).toBe(true);
		expect(gameOf(actor).pieces.shelter).toBe(pack.numbers.pieces.shelter - 1);
	});

	test('the first city to hit population 0 brings in the forsaken rules', () => {
		const actor = ended(false, world => {
			world.campaign.rules = world.campaign.rules.filter(rule => rule !== 'forsaken');
			world.campaign.locations[city('tehran')]!.population = 1;
			world.game!.locations[city('tehran')]!.plague = 1;
		});
		const { campaign } = worldOf(actor);
		expect(campaign.rules).toContain('forsaken');
		expect(campaign.locations[city('tehran')]).toMatchObject({ population: 0, infested: true });
		expect(campaign.turningPoints).not.toContain('firstForsaken');
	});

	test('four losses in a row add 10 cubes to the next games', () => {
		const actor = ended(false, world => {
			world.campaign.results = world.campaign.results
				.slice(0, -3)
				.concat([7, 8, 9].map(month => ({ month, attempt: 2 as const, won: false, gridCities: 40, rationing: 6 })));
		});
		expect(worldOf(actor).campaign.losingStreakBonusGames).toBe(3);
		send(actor, { type: 'FINISH_UPKEEP' });
		const characters = Object.values(worldOf(actor).campaign.characters);
		send(actor, {
			type: 'START_GAME',
			seating: [
				{ seat: A, character: characters[0]!.id },
				{ seat: B, character: characters[1]!.id },
			],
		});
		expect(gameOf(actor).stockpile).toBe(8 + 30 + 10);
	});

	test('a win moves to the next month and eases rationing, and December ends the campaign', () => {
		const october = ended(true);
		const rationing = worldOf(october).campaign.rationing;
		send(october, { type: 'FINISH_UPKEEP' });
		expect(worldOf(october).campaign).toMatchObject({ month: 11, attempt: 1, rationing: Math.max(0, rationing - 2) });
		const december = ended(true, world => void (world.campaign.month = 12));
		send(december, { type: 'FINISH_UPKEEP' });
		expect(phase(december)).toBe('finished');
	});

	test('Infection card improvements: Well Stocked, Rebirth, and Lockdown', () => {
		const actor = late((world, game) => {
			const [cairo] = infectionCards(world, 'cairo');
			const [lagos] = infectionCards(world, 'lagos');
			(world.campaign.infectionCards[cairo!] as { improvement: string }).improvement = 'wellStocked';
			(world.campaign.infectionCards[lagos!] as { improvement: string }).improvement = 'rebirth';
			world.campaign.locations[city('lagos')]!.population = 4;
			game.locations[city('lagos')]!.supplies = 0;
			stackInfection(world, ['cairo', 'lagos', 'london']);
			const [london] = infectionCards(world, 'london');
			(world.campaign.infectionCards[london!] as { improvement: string }).improvement = 'lockdown';
			game.infectionsLeft = 3;
		}, 'playing.infect');
		send(actor, { type: 'INFECT' });
		send(actor, { type: 'INFECT' });
		expect(gameOf(actor).locations[city('cairo')]!.supplies).toBe(2);
		expect(gameOf(actor).locations[city('lagos')]).toMatchObject({ supplies: 0, plague: 0 });
		const london = infectionCards(worldOf(actor), 'london')[0]!;
		send(actor, { type: 'INFECT' });
		send(actor, { type: 'LOCKDOWN', card: london });
		expect(worldOf(actor).campaign.infectionCards[london]).toBeUndefined();
		expect(gameOf(actor).infectionDiscard).not.toContain(london);
	});

	test('an empty Infection deck reshuffles its discards and raises the rate, and an empty Player deck loses', () => {
		const actor = late((world, game) => {
			stackInfection(world, ['cairo']);
			game.infectionDiscard = game.infectionDeck.order.splice(1);
			game.infectionDeck.strata = [[...game.infectionDeck.order]];
			game.infectionsLeft = 2;
		}, 'playing.infect');
		send(actor, { type: 'INFECT' });
		const rate = gameOf(actor).rateIndex;
		send(actor, { type: 'INFECT' });
		expect(gameOf(actor).rateIndex).toBe(rate + 1);
		expect(gameOf(actor).infectionDeck.order.length).toBeGreaterThan(10);

		const drained = late((_, game) => {
			game.playerDeck.order = game.playerDeck.order.slice(0, 1);
			game.playerDeck.piles = [{ size: 1, epidemics: 0 }];
		});
		send(drained, { type: 'END_ACTIONS', seat: A });
		expect(gameOf(drained).outcome).toMatchObject({ won: false, reason: 'The Player deck ran out' });
	});

	test('the epidemic count grows with the City cards in the deck', () => {
		expect([36, 37, 44, 45, 57, 62, 63].map(epidemicCount)).toEqual([5, 6, 6, 7, 8, 9, 10]);
		const game = gameOf(late());
		expect(game.epidemics + game.playerDeck.piles.reduce((sum, pile) => sum + pile.epidemics, 0)).toBe(10);
	});

	test('undo reaches back through the turn but not past an action that revealed something', () => {
		const actor = late((world, game) => {
			const [card] = cityCards(world, 'denver');
			(world.campaign.playerCards[card!] as { search: unknown[] }).search = [
				{ scope: 'land', result: { t: 'nothing' }, scratched: false },
			];
			game.players[A]!.location = city('denver');
			give(world, A, [card!]);
		});
		act(actor, { a: 'makeSupplies' });
		expect(publicState(actor.getSnapshot()).canUndo).toBe(true);
		act(actor, { a: 'search', card: gameOf(actor).players[A]!.hand[0]!, box: 0 });
		expect(publicState(actor.getSnapshot()).canUndo).toBe(false);
		expect(grid(worldOf(actor).campaign).has(city('denver'))).toBe(true);
	});
});

describe('late additions', () => {
	test('Monitor frequencies that keep cards take the newest non-Epidemic discards', () => {
		const actor = late((world, game) => {
			world.campaign.frequenciesUsed = [];
			game.players[A]!.location = city('lagos');
			game.locations[city('lagos')]!.tower = true;
		});
		const top = gameOf(actor)
			.playerDeck.order.slice(0, 4)
			.filter(id => worldOf(actor).campaign.playerCards[id]!.kind !== 'epidemic');
		act(actor, { a: 'monitor', frequency: 2 });
		expect(gameOf(actor).players[A]!.hand).toHaveLength(Math.min(2, top.length));
		expect(top).toEqual(expect.arrayContaining(gameOf(actor).players[A]!.hand));
	});

	test('a Cordon card lets any player discard to end the Infect step', () => {
		const actor = late((world, game) => {
			const [cairo] = infectionCards(world, 'cairo');
			(world.campaign.infectionCards[cairo!] as { improvement: string }).improvement = 'cordon';
			world.campaign.rules = world.campaign.rules.filter(rule => rule !== 'topazShield');
			stackInfection(world, ['cairo', 'lagos']);
			give(world, C, cityCards(world, 'tokyo'));
			game.infectionsLeft = 2;
		}, 'playing.infect');
		send(actor, { type: 'INFECT' });
		expect(gameOf(actor).pending[0]).toEqual({ t: 'cordon' });
		send(actor, { type: 'DECIDE', decide: { d: 'cordon', seat: C, card: gameOf(actor).players[C]!.hand[0]! } });
		expect(gameOf(actor).locations[city('lagos')]!.supplies).toBe(2);
		expect(gameOf(actor).active).toBe(B);
	});

	test('a short stockpile fills the chosen locations first', () => {
		const actor = late((world, game) => {
			give(world, A, produceCards(world).slice(0, 1));
			for (const id of ['haven-north-atlantic', 'cairo', 'shanghai']) game.locations[city(id)]!.supplies = 0;
			game.stockpile = 3;
		});
		act(actor, { a: 'produce', card: gameOf(actor).players[A]!.hand[0]!, mode: 'system', first: [city('shanghai')] });
		expect(gameOf(actor).locations[city('shanghai')]!.supplies).toBe(1);
		expect(gameOf(actor).locations[city('haven-north-atlantic')]!.supplies).toBe(2);
		expect(gameOf(actor).locations[city('cairo')]!.supplies).toBe(0);
	});

	test('waiving an impossible objective lets the rest decide the game', () => {
		const actor = late((world, game) => {
			world.campaign.objectives = ['buildCenters', 'reconNewArea', 'searches'];
			world.campaign.required = 3;
			game.completed = ['buildCenters', 'searches'];
		});
		send(actor, { type: 'WAIVE_OBJECTIVE', objective: 'reconNewArea' });
		expect(gameOf(actor).outcome).toMatchObject({ won: true });
	});

	test('havens can be renamed in the lobby', () => {
		const actor = createGameActor({ seed: 2 }).start();
		send(actor, { type: 'RENAME_HAVEN', city: city('haven-north-atlantic'), name: ' Avalon ' });
		expect(worldOf(actor).campaign.names[city('haven-north-atlantic')]).toBe('Avalon');
	});

	test('a scar owed from a forced opening goes to a character the group picks as the game begins', () => {
		const actor = createGameActor({ seed: 4, save: decemberSave() }).start();
		const world = JSON.parse(JSON.stringify(worldOf(actor))) as World;
		world.campaign.owedScars = 1;
		const owed = createGameActor({ seed: 4, save: { v: 1, phase: 'lobby', world } }).start();
		const characters = Object.values(world.campaign.characters);
		send(owed, {
			type: 'START_GAME',
			seating: [
				{ seat: A, character: characters[0]!.id },
				{ seat: B, character: characters[1]!.id },
			],
		});
		for (const type of ['AUTO_SUPPLY', 'CONFIRM_SUPPLY', 'CONFIRM_EVENTS'] as const) send(owed, { type });
		expect(gameOf(owed).pending[0]).toEqual({ t: 'scar', seat: null });
		send(owed, { type: 'DECIDE', decide: { d: 'scar', scar: 'smallHand', target: 2, seat: B } });
		expect(character(worldOf(owed), B).slots[2]).toEqual({ kind: 'scar', id: 'smallHand' });
		expect(worldOf(owed).campaign.owedScars).toBe(0);
	});
});

test('the October scenario sets up with Hollow Men, the defection objective, and permanent shelters for sale', () => {
	const actor = createGameActor({ seed: 6, save: octoberSave() }).start();
	const characters = Object.values(worldOf(actor).campaign.characters);
	send(actor, {
		type: 'START_GAME',
		seating: [A, B, C].map((seat, index) => ({ seat, character: characters[index]!.id })),
	});
	const { campaign } = worldOf(actor);
	expect(campaign).toMatchObject({ month: 10, required: 2 });
	expect(campaign.objectives).toEqual(['buildCenters', 'defect']);
	expect(campaign.actions).toEqual(
		expect.arrayContaining(['broadcast', 'buildTower', 'buildShelter', 'monitor', 'chartLane', 'shuttle']),
	);
	expect(campaign.permanentForSale).toEqual(expect.arrayContaining(['center', 'tower', 'shelter']));
	expect(campaign.forced).toEqual([]);
	expect(gameOf(actor).stockpile).toBe(8 + 30);
	send(actor, { type: 'AUTO_SUPPLY' });
	send(actor, { type: 'CONFIRM_SUPPLY' });
	expect(Object.values(gameOf(actor).locations).reduce((sum, location) => sum + location.hollow, 0)).toBe(3);
	expect(gameOf(actor).locations[city('tripoli')]!.tower).toBe(true);
});
