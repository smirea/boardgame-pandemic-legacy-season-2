import { describe, expect, test } from 'bun:test';
import { checkEdge } from './actions';
import type { Action } from './actions';
import { botCommand } from './bot';
import { pack } from './content/pack';
import type { EdgeDef, EventId, ScarId, SearchResult } from './content/types';
import { edge } from './content/world';
import { beginTurn, bump, epidemicCount, placeHollow, setupInfection } from './flow';
import {
	breakthrough,
	grid,
	handLimit,
	hasEdge,
	isCandidate,
	neighbours,
	passage,
	removeFromHand,
	segmentsCross,
	tableSeating,
} from './helpers';
import { edgeKey } from './ids';
import type { CardId, CityId, PlayerId } from './ids';
import { createGameActor, parseSave, phaseOf, reject } from './machine';
import type { Command, GameActor, Phase, Save } from './machine';
import { legalActions, legalDecides, legalPlays } from './options';
import { applyUnlock, closeGame, newCampaign, openSeal, readLegacy, score } from './legacy';
import type { Purchase } from './legacy';
import { newTable } from './table';
import { canonicalSave, decemberSave, octoberSave } from './scenarios';
import { tabletopSave } from './tabletop';
import { violations } from './invariants';
import type { Character, Game, World } from './state';
import {
	A,
	act,
	B,
	C,
	character,
	city,
	cityCards,
	conjure,
	emptyHand,
	gameOf,
	give,
	infectionCards,
	late,
	passTurn,
	phase,
	refuses,
	showReveals,
	send,
	setUp,
	stackInfection,
	worldOf,
} from './testkit';
import { insights, publicState } from './view';

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
			world.campaign.rules = world.campaign.rules.filter(rule => rule !== 'labBreakthroughs');
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
	test('the Laborer builds a supply center with 4 cards and 2 cubes', () => {
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

	test('with every piece placed, building moves a supply center, a permanent one too, and a tower moves the same way', () => {
		const actor = late((world, game) => {
			game.pieces.center = 0;
			game.locations[city('lagos')]!.center = true;
			game.players[A]!.location = city('london');
			give(world, A, cityCards(world, 'london', 4));
			give(world, A, cityCards(world, 'new-york', 1));
		});
		const cards = gameOf(actor).players[A]!.hand;
		expect(refuses(actor, { a: 'buildCenter', cards })).toContain('pick one to move');
		expect(refuses(actor, { a: 'buildCenter', cards, moveFrom: city('cairo') })).toBeNull();
		act(actor, { a: 'buildCenter', cards, moveFrom: city('lagos') });
		expect(gameOf(actor).locations[city('lagos')]!.center).toBe(false);
		expect(gameOf(actor).locations[city('london')]!.center).toBe(true);

		const towers = late((world, game) => {
			game.pieces.tower = 0;
			game.locations[city('lagos')]!.tower = true;
			game.players[A]!.location = city('london');
			game.players[A]!.supplies = 2;
		});
		expect(refuses(towers, { a: 'buildTower' })).toBe('Every tower is placed: pick one to move');
		act(towers, { a: 'buildTower', moveFrom: city('lagos') });
		expect(gameOf(towers).locations[city('lagos')]!.tower).toBe(false);
		expect(gameOf(towers).locations[city('london')]!.tower).toBe(true);
	});

	test('towers cost 2 cubes, count toward triangulation, and enable Transmit and Monitor', () => {
		const actor = late((world, game) => {
			world.campaign.objectives.push('triangulate');
			world.campaign.frequenciesUsed = [];
			world.campaign.routes = world.campaign.routes.filter(route => route !== 'hidden:east-asia');
			world.campaign.opened = world.campaign.opened.filter(key => key !== 'door:52');
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
		showReveals(actor);
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
		showReveals(actor);
		return actor;
	};

	test('each search result takes effect: supplies, stockpile, actions, a companion, infestation and a discovery', () => {
		expect(gameOf(searching({ t: 'supplies', amount: 3, from: 'reserve' })).locations[city('denver')]!.supplies).toBe(
			5,
		);
		expect(gameOf(searching({ t: 'stockpile', amount: 4 })).stockpile).toBe(24);
		expect(gameOf(searching({ t: 'actions', amount: 2 })).actionsLeft).toBe(5);
		const found = searching({ t: 'companion', companion: 'medic' });
		const searched = worldOf(found).campaign.playerCards[gameOf(found).players[A]!.hand[0]!];
		expect(searched).toMatchObject({ kind: 'city', city: 'denver', companion: 'medic' });
		expect(worldOf(searching({ t: 'infest' })).campaign.locations[city('denver')]!.infested).toBe(true);
		const santiago = searching({ t: 'infest', opens: { t: 'door', id: '50' } }, world => {
			world.campaign.opened = world.campaign.opened.filter(key => key !== 'door:50');
		});
		expect(worldOf(santiago).campaign.locations[city('denver')]!.infested).toBe(true);
		expect(worldOf(santiago).campaign.opened).toContain('door:50');
		const repeat = searching({ t: 'discover', seals: [{ t: 'door', id: '60' }], orAction: true }, world => {
			world.campaign.opened.push('door:60');
		});
		expect(gameOf(repeat).actionsLeft).toBe(4);
		expect(refuses(repeat, { a: 'search', card: gameOf(repeat).players[A]!.hand[0]!, box: 0 })).toContain('used up');
	});

	test('a search that gives a card hands one from the searcher to another player of their choice', () => {
		const giving = searching({ t: 'giveCard' }, world => give(world, A, cityCards(world, 'tokyo')));
		expect(gameOf(giving).pending[0]).toMatchObject({ t: 'giveCard', seat: A });
		const tokyo = cityCards(worldOf(giving), 'tokyo')[0]!;
		send(giving, { type: 'DECIDE', decide: { d: 'giveCard', card: tokyo, to: B } });
		expect(gameOf(giving).players[B]!.hand).toContain(tokyo);
		expect(gameOf(giving).players[A]!.hand).not.toContain(tokyo);
	});

	test('the Double Agent counts as two red cards for Recon, with no card to spare', () => {
		const actor = late((world, game) => {
			world.campaign.opened = world.campaign.opened.filter(key => key !== 'door:59');
			game.players[A]!.location = city('jakarta');
			game.locations[city('jakarta')]!.center = true;
			const [tokyo] = cityCards(world, 'tokyo');
			(world.campaign.playerCards[tokyo!] as { companion: unknown }).companion = 'doubleAgent';
			give(world, A, [tokyo!, ...cityCards(world, 'manila')]);
		});
		const [tokyo] = cityCards(worldOf(actor), 'tokyo');
		const [manila] = cityCards(worldOf(actor), 'manila');
		expect(refuses(actor, { a: 'recon', route: 'coral-sea', cards: [tokyo!, manila!] })).toContain('Needs 2');
		act(actor, { a: 'recon', route: 'coral-sea', cards: [tokyo!] });
		expect(worldOf(actor).campaign.opened).toContain('door:59');
	});

	test('with all six shelters placed, building one moves a placed shelter', () => {
		const actor = late((world, game) => {
			game.players[A]!.location = city('cairo');
			game.pieces.shelter = 0;
			game.locations[city('london')]!.shelter = true;
			give(world, A, cityCards(world, 'baghdad'));
		});
		const [baghdad] = cityCards(worldOf(actor), 'baghdad');
		expect(refuses(actor, { a: 'buildShelter', card: baghdad! })).toBe('Every shelter is placed: pick one to move');
		act(actor, { a: 'buildShelter', card: baghdad!, moveFrom: city('london') });
		expect(gameOf(actor).locations[city('cairo')]!.shelter).toBe(true);
		expect(gameOf(actor).locations[city('london')]!.shelter).toBe(false);
	});

	test('the Quartermaster builds a shelter with a City card of any colour', () => {
		const actor = late((world, game) => {
			game.players[A]!.location = city('cairo');
			const [tokyo] = cityCards(world, 'tokyo');
			(world.campaign.playerCards[tokyo!] as { companion: unknown }).companion = 'quartermaster';
			give(world, A, [tokyo!, ...cityCards(world, 'london')]);
		});
		const [london] = cityCards(worldOf(actor), 'london');
		act(actor, { a: 'buildShelter', card: london! });
		expect(gameOf(actor).locations[city('cairo')]!.shelter).toBe(true);
	});

	test('a search result that asks for a choice takes effect once chosen: retrieve, set aside, remove Hollow Men or a free route', () => {
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

	test('removing up to N Hollow Men takes N of the choices offered, from any cities, or stops early', () => {
		const offered = (actor: GameActor, from: string) =>
			legalDecides(worldOf(actor)).find(decide => decide.d === 'removeHollow' && decide.city === city(from))!;
		const hunt = searching({ t: 'removeHollow', amount: 2 }, world => {
			world.game!.locations[city('cairo')]!.hollow = 2;
			world.game!.locations[city('lagos')]!.hollow = 1;
		});
		send(hunt, { type: 'DECIDE', decide: offered(hunt, 'cairo') });
		send(hunt, { type: 'DECIDE', decide: offered(hunt, 'lagos') });
		expect(gameOf(hunt).locations[city('cairo')]!.hollow).toBe(1);
		expect(gameOf(hunt).locations[city('lagos')]!.hollow).toBe(0);
		expect(gameOf(hunt).pending).toEqual([]);

		const short = searching({ t: 'removeHollow', amount: 2 }, world => {
			world.game!.locations[city('cairo')]!.hollow = 2;
		});
		send(short, { type: 'DECIDE', decide: offered(short, 'cairo') });
		send(short, { type: 'DECIDE', decide: { d: 'skip' } });
		expect(gameOf(short).locations[city('cairo')]!.hollow).toBe(1);
		expect(gameOf(short).pending).toEqual([]);
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
		showReveals(actor);
		expect(gameOf(actor).searches).toBe(1);
	});

	test('recon needs different cities when the route says so, the Outrider saves a card, a scar adds one, and the Scout needs no supply center', () => {
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
		expect(worldOf(plain).campaign.planRecons).toContain('hidden:plan-blue');
		expect(refuses(plain, { a: 'recon', route: 'hidden:plan-blue', cards: [london2, paris] })).toBe('Already reconned');

		const outrider = at(world => void (character(world, A).slots[1] = { kind: 'ability', id: 'outrider' }));
		act(outrider, { a: 'recon', route: 'hidden:plan-blue', cards: [london, newYork] });
		const scarred = at(world => void (character(world, A).slots[1] = { kind: 'scar', id: 'reconExtraCard' }));
		expect(refuses(scarred, { a: 'recon', route: 'hidden:plan-blue', cards: [london, newYork, washington] })).toContain(
			'4',
		);
		act(scarred, { a: 'recon', route: 'hidden:plan-blue', cards: [london, newYork, washington, paris] });

		const scout = (ability: boolean) =>
			late((world, game) => {
				world.campaign.opened = world.campaign.opened.filter(key => key !== 'door:59');
				if (ability) character(world, A).slots[1] = { kind: 'ability', id: 'scout' };
				game.players[A]!.location = city('jakarta');
				give(world, A, [...cityCards(world, 'jakarta'), ...cityCards(world, 'tokyo')]);
			});
		expect(
			refuses(scout(false), { a: 'recon', route: 'coral-sea', cards: gameOf(scout(false)).players[A]!.hand }),
		).toContain('supply center');
		const scouting = scout(true);
		act(scouting, { a: 'recon', route: 'coral-sea', cards: gameOf(scouting).players[A]!.hand });
		expect(worldOf(scouting).campaign.opened).toContain('door:59');
	});
});

describe('Hollow Men and forsaken cities', () => {
	const defectScene = (havens: string[]) =>
		late((world, game) => {
			world.campaign.objectives = ['defect'];
			world.campaign.required = 1;
			world.campaign.opened = world.campaign.opened.filter(key => key !== 'door:17' && key !== 'door:58');
			world.campaign.turningPoints.push('defection');
			game.players[A]!.location = city('tripoli');
			game.locations[city('tripoli')]!.tower = true;
			game.locations[city('tripoli')]!.hollow = 3;
			for (const haven of havens) game.locations[city(haven)]!.hollow = 1;
		});

	test('Broadcast moves Hollow Men next door, and three stacked in one haven do not complete the October objective', () => {
		const actor = defectScene([]);
		expect(refuses(actor, { a: 'broadcast', from: city('lagos'), to: city('haven-south-atlantic') })).toContain(
			'colour',
		);
		for (let i = 0; i < 3; i++) act(actor, { a: 'broadcast', from: city('tripoli'), to: city('haven-mediterranean') });
		expect(gameOf(actor).locations[city('haven-mediterranean')]!.hollow).toBe(3);
		expect(gameOf(actor).progress.defect).toBe(1);
		expect(gameOf(actor).outcome).toBeNull();
	});

	test('a Hollow Man in each of three different havens completes the October objective, and the game end opens door 17', () => {
		const actor = defectScene(['haven-north-atlantic', 'haven-south-atlantic']);
		act(actor, { a: 'broadcast', from: city('tripoli'), to: city('haven-mediterranean') });
		expect(gameOf(actor).outcome).toMatchObject({ won: true });
		expect(worldOf(actor).campaign.opened).not.toContain('door:17');
		send(actor, { type: 'CONTINUE' });
		expect(worldOf(actor).campaign.opened).toEqual(expect.arrayContaining(['door:17', 'door:58']));
		expect(worldOf(actor).campaign.turningPoints).not.toContain('defection');
	});

	test('June forces Europe when it was never reconned, and door 21 destroys Frankfurt with its cards and lines', () => {
		const world: World = { campaign: newCampaign(4), game: null, table: newTable() };
		const june = pack.legacyDeck.find(card => card.month === 6)!;
		for (const unlock of june.unlocks) applyUnlock(world, unlock);
		const { campaign } = world;
		expect(campaign.forced).toContain('package:4');
		expect(campaign.opened).toContain('door:21');
		expect(campaign.locations[city('frankfurt')]!.revealed).toBe(false);
		expect(campaign.locations[city('paris')]!.revealed).toBe(true);
		const cards = [...Object.values(campaign.playerCards), ...Object.values(campaign.infectionCards)];
		expect(cards.some(card => 'city' in card && card.city === 'frankfurt')).toBe(false);
		expect(campaign.edges.some(edge => edge.a === 'frankfurt' || edge.b === 'frankfurt')).toBe(false);
	});

	test('November forces the defection when no game ended with Hollow Men in three havens, and two scars are owed', () => {
		const world: World = { campaign: newCampaign(4), game: null, table: newTable() };
		const november = pack.legacyDeck.find(card => card.month === 11)!;
		for (const unlock of november.unlocks) applyUnlock(world, unlock);
		expect(world.campaign.forced).toContain('door:17');
		expect(world.campaign.owedScars).toBe(2);
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
		send(full, { type: 'INFECT' });
		expect(gameOf(full).locations[city('cairo')]!.hollow).toBe(3);
		expect(worldOf(full).campaign.locations[city('cairo')]!.population).toBe(before - 1);
		const empty = gather(world => void (world.game!.pieces.hollow = 0));
		send(empty, { type: 'INFECT' });
		send(empty, { type: 'INFECT' });
		expect(gameOf(empty).outcome).toMatchObject({ won: false });
	});

	test('each card that opens a game is flipped by its own command, and Events wait for the last', () => {
		const actor = createGameActor({ seed: 5, save: decemberSave() }).start();
		send(actor, {
			type: 'START_GAME',
			seating: Object.values(worldOf(actor).campaign.characters)
				.slice(0, 2)
				.map((entry, index) => ({ seat: [A, B][index]!, character: entry.id })),
		});
		send(actor, { type: 'AUTO_SUPPLY' });
		send(actor, { type: 'CONFIRM_SUPPLY' });
		const flipped = () => gameOf(actor).log.filter(entry => entry.t === 'infect' && entry.effect !== 'skipped').length;
		expect(flipped()).toBe(0);
		for (let card = 1; card <= 9; card++) {
			expect(phase(actor)).toBe('setup.infect');
			expect(reject(worldOf(actor), phase(actor), { type: 'CONFIRM_EVENTS' })).not.toBeNull();
			send(actor, { type: 'INFECT' });
			expect(flipped()).toBe(card);
		}
		expect(phase(actor)).toBe('setup.events');
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
		while (phase(actor) === 'setup.infect') send(actor, { type: 'INFECT' });
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
		passTurn(actor);
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
		passTurn(actor);
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
			world.campaign.rules = world.campaign.rules.filter(rule => rule !== 'labBreakthroughs');
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
		send(actor, { type: 'DECIDE', decide: { d: 'skip' } });
		send(actor, { type: 'DECIDE', decide: { d: 'skip' } });
		send(actor, { type: 'DECIDE', decide: { d: 'skip' } });
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
		passTurn(actor);
		expect(gameOf(actor).players[B]).toMatchObject({ hand: [], location: character(worldOf(actor), B).home });
		expect(gameOf(actor).actionsLeft).toBe(0);
	});

	test('taking the sample scars the carrier, who then walks, pays to enter cities, and wins on arrival', () => {
		const actor = late((world, game) => {
			world.campaign.edges.push({ a: city('utopia'), b: city('lake-baikal'), kind: 'land' });
			openSeal(world, { t: 'door', id: '22' }, false);
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
		const utopia = Object.values(world.campaign.infectionCards).find(
			card => card.kind === 'city' && card.city === 'utopia',
		)!.id;
		game.infectionDeck.order = game.infectionDeck.order.filter(card => card !== utopia);
		game.infectionDiscard.push(utopia);
		game.infectionDeck.strata = [game.infectionDeck.order.toSorted()];
	};
	const checks: Record<string, (before: World, after: World) => void> = {
		airlift: (before, after) =>
			expect(Object.values(after.game!.players).map(player => player.location)).not.toEqual(
				Object.values(before.game!.players).map(player => player.location),
			),
		quietNight: (_, after) => expect(after.game!.skipInfection).toBe(true),
		resilience: (_, after) => expect(after.game!.gameEndArea).toHaveLength(1),
		handout: (before, after) => expect(after.game!.stockpile).toBe(before.game!.stockpile - 1),
		spreadOut: (before, after) =>
			expect(after.game!.locations[city('haven-north-atlantic')]!.supplies).toBe(
				before.game!.locations[city('haven-north-atlantic')]!.supplies - 1,
			),
		cleanse: (_, after) => expect(after.game!.locations[city('cairo')]!.plague).toBe(1),
		forecast: (_, after) =>
			expect(after.game!.infectionDeck.strata.slice(0, 8).every(layer => layer.length === 1)).toBe(true),
		cache: (before, after) => expect(after.game!.reserve).toBe(before.game!.reserve - 6),
		// The event taken back is played at once, so both cards end in the discard pile and neither in a hand.
		encore: (before, after) => expect(after.game!.playerDiscard.length).toBe(before.game!.playerDiscard.length + 1),
		secondWind: (_, after) => expect(after.game!.actionsLeft).toBe(7),
		massInoculation: (before, after) =>
			expect(after.campaign.stored.infection).toHaveLength(before.campaign.stored.infection.length + 1),
		exile: (before, after) =>
			expect(Object.keys(after.campaign.infectionCards)).toHaveLength(
				Object.keys(before.campaign.infectionCards).length - 1,
			),
		antidote: (_, after) => expect(after.game!.pending).toEqual([]),
		mentor: (_, after) => expect(after.campaign.abilitiesForSale).not.toContain('scout'),
		scavenge: (before, after) =>
			expect(after.game!.playerDeck.order.length).toBe(before.game!.playerDeck.order.length - 4),
		openWaters: (before, after) => expect(after.campaign.edges.length).toBe(before.campaign.edges.length + 1),
		safeHouses: (before, after) => expect(after.game!.pieces.shelter).toBe(before.game!.pieces.shelter - 1),
		purge: (_, after) => expect(after.game!.locations[city('cairo')]!.plague).toBe(0),
		stockUp: (before, after) => expect(after.game!.stockpile).toBe(before.game!.stockpile + 8),
		cardSwap: (before, after) => expect(after.game!.players[B]!.hand).not.toEqual(before.game!.players[B]!.hand),
		surplus: (_, after) => expect(after.game!.players[A]!.supplies).toBe(3),
		medic: (_, after) => expect(after.game!.locations[city('cairo')]!.plague).toBe(1),
		purifier: (_, after) => expect(after.game!.locations[city('cairo')]!.plague).toBe(0),
		shelterWright: (before, after) => expect(after.game!.pieces.shelter).toBe(before.game!.pieces.shelter - 1),
		marksman: (_, after) => expect(after.game!.locations[city('lagos')]!.hollow).toBe(0),
		riotControl: (before, after) => expect(after.game!.gameEndArea).toHaveLength(before.game!.gameEndArea.length + 1),
		informant: (before, after) => expect(after.game!.gameEndArea).toHaveLength(before.game!.gameEndArea.length + 1),
		mobileShelters: (before, after) => expect(after.game!.pieces.shelter).toBe(before.game!.pieces.shelter - 1),
	};

	const setup: Partial<Record<EventId, (world: World) => void>> = {
		spreadOut: world => void (world.game!.locations[city('haven-north-atlantic')]!.supplies = 3),
		encore: world => {
			const spent = conjure(world, B, { kind: 'event', event: 'airlift' });
			removeFromHand(world.game!, B, spent);
			world.game!.playerDiscard.push(spent);
		},
		openWaters: world => {
			const port = pack.candidateEdges.find(
				edge => edge.kind === 'sea' && checkEdge(world.campaign, edge.a, edge.b, 'sea', true) === null,
			)!;
			world.game!.players[A]!.location = port.a;
		},
		antidote: world => void world.game!.pending.push({ t: 'epidemicDrawn' }),
		mentor: world => {
			world.campaign.abilitiesForSale = ['scout'];
			character(world, A).slots[3] = null;
		},
		surplus: world => void world.game!.players[A]!.used.push('madeSupplies'),
	};

	test('a drawn Epidemic steps through Increase, Infect, and Intensify, pausing for TOPAZ Experimental Vaccine before Increase', () => {
		const drawing = (antidote: boolean) =>
			late((world, game) => {
				if (antidote) conjure(world, B, { kind: 'event', event: 'antidote' });
				const epidemic = Object.values(world.campaign.playerCards).find(card => card.kind === 'epidemic')!.id;
				game.playerDeck.order = [epidemic, ...game.playerDeck.order.filter(card => card !== epidemic)];
				game.playerDeck.piles = [{ size: game.playerDeck.order.length, epidemics: 10 }];
				game.drawsLeft = 2;
			}, 'playing.draw');
		const plain = drawing(false);
		send(plain, { type: 'DRAW' });
		expect(gameOf(plain).pending).toEqual([{ t: 'epidemicDrawn' }]);
		expect(gameOf(plain).epidemics).toBe(0);
		send(plain, { type: 'DECIDE', decide: { d: 'skip' } });
		expect(gameOf(plain).epidemics).toBe(1);
		expect(gameOf(plain).pending).toEqual([{ t: 'epidemicInfect' }]);
		send(plain, { type: 'DECIDE', decide: { d: 'skip' } });
		expect(gameOf(plain).pending).toEqual([{ t: 'intensify' }]);
		send(plain, { type: 'DECIDE', decide: { d: 'skip' } });
		expect(gameOf(plain).pending).toEqual([]);

		const held = drawing(true);
		send(held, { type: 'DRAW' });
		expect(gameOf(held).pending).toEqual([{ t: 'epidemicDrawn' }]);
		expect(gameOf(held).epidemics).toBe(0);
		const antidote = gameOf(held).players[B]!.hand.at(-1)!;
		send(held, { type: 'PLAY', seat: B, card: antidote, play: { e: 'antidote' } });
		expect(gameOf(held).pending).toEqual([]);
		expect(gameOf(held).epidemics).toBe(0);
	});

	test('once an Epidemic has started, any Event may be played between its steps', () => {
		let card = '' as CardId;
		const actor = late((world, game) => {
			card = conjure(world, B, { kind: 'event', event: 'airlift' });
			const epidemic = Object.values(world.campaign.playerCards).find(entry => entry.kind === 'epidemic')!.id;
			game.playerDeck.order = [epidemic, ...game.playerDeck.order.filter(id => id !== epidemic)];
			game.playerDeck.piles = [{ size: game.playerDeck.order.length, epidemics: 10 }];
			game.drawsLeft = 2;
		}, 'playing.draw');
		const airlift = (): Command => ({
			type: 'PLAY',
			seat: B,
			card,
			play: { e: 'airlift', pawn: A, to: city('lagos') },
		});
		send(actor, { type: 'DRAW' });
		expect(reject(worldOf(actor), phase(actor), airlift())).not.toBeNull();
		send(actor, { type: 'DECIDE', decide: { d: 'skip' } });
		expect(gameOf(actor).pending).toEqual([{ t: 'epidemicInfect' }]);
		expect(reject(worldOf(actor), phase(actor), airlift())).toBeNull();
		send(actor, { type: 'DECIDE', decide: { d: 'skip' } });
		expect(gameOf(actor).pending).toEqual([{ t: 'intensify' }]);
		send(actor, airlift());
		expect(gameOf(actor).players[A]!.location).toBe(city('lagos'));
		expect(gameOf(actor).pending).toEqual([{ t: 'intensify' }]);
	});

	test('a turn stays with its player after the last Infection card until they end it', () => {
		const actor = late((world, game) => {
			stackInfection(world, ['lagos']);
			game.infectionsLeft = 1;
		}, 'playing.infect');
		expect(reject(worldOf(actor), phase(actor), { type: 'END_TURN', seat: A })).not.toBeNull();
		send(actor, { type: 'INFECT' });
		expect(phase(actor)).toBe('playing.infect');
		expect(gameOf(actor).active).toBe(A);
		expect(reject(worldOf(actor), phase(actor), { type: 'END_TURN', seat: B })).not.toBeNull();
		send(actor, { type: 'END_TURN', seat: A });
		expect(phase(actor)).toBe('playing.actions');
		expect(gameOf(actor).active).toBe(B);
	});

	test('with Opal found and door 13 open, making supplies at a haven or supply center takes 2 cubes, elsewhere 1', () => {
		const making = (where: string) =>
			late(world => {
				world.game!.players[A]!.location = city(where);
				world.game!.locations[city('cairo')]!.center = false;
			});
		const atHaven = making('haven-north-atlantic');
		act(atHaven, { a: 'makeSupplies' });
		expect(gameOf(atHaven).players[A]!.supplies).toBe(2);
		const inCity = making('cairo');
		act(inCity, { a: 'makeSupplies' });
		expect(gameOf(inCity).players[A]!.supplies).toBe(1);
	});

	test('Surplus is played by the active player after they Make Supplies that turn', () => {
		let card = '' as CardId;
		const actor = late(world => {
			card = conjure(world, A, { kind: 'event', event: 'surplus' });
			world.campaign.rules = world.campaign.rules.filter(rule => rule !== 'labBreakthroughs');
		});
		const play = { type: 'PLAY', seat: A, card, play: { e: 'surplus' } } as const;
		expect(reject(worldOf(actor), phase(actor), play)).toBe('Play it after you Make Supplies this turn');
		act(actor, { a: 'makeSupplies' });
		send(actor, play);
		expect(gameOf(actor).players[A]!.supplies).toBe(4);
	});

	for (const event of pack.events) {
		test(`the ${event.name} event takes effect and goes to the discard pile`, () => {
			const actor = late(world => {
				scene(world);
				setup[event.id]?.(world);
				conjure(world, A, { kind: 'event', event: event.id });
			});
			const before = worldOf(actor);
			const card = gameOf(actor).players[A]!.hand.at(-1)!;
			const play = legalPlays(before, 'playing.actions').find(option => option.card === card);
			expect(play).toBeDefined();
			send(actor, { type: 'PLAY', ...play! });
			showReveals(actor);
			checks[event.id as EventId]!(before, worldOf(actor));
			expect(gameOf(actor).playerDiscard).toContain(card);
		});
	}

	for (const companion of pack.companions.filter(entry => entry.spent)) {
		test(`the ${companion.name} companion takes effect and its City card goes to the discard pile, still carrying it`, () => {
			const actor = late(world => {
				scene(world);
				conjure(world, A, { kind: 'companion', companion: companion.id });
			});
			const before = worldOf(actor);
			const card = gameOf(actor).players[A]!.hand.at(-1)!;
			const play = legalPlays(before, 'playing.actions').find(option => option.card === card);
			expect(play).toBeDefined();
			send(actor, { type: 'PLAY', ...play! });
			checks[companion.id]!(before, worldOf(actor));
			expect(gameOf(actor).playerDiscard).toContain(card);
			expect(worldOf(actor).campaign.playerCards[card]).toMatchObject({ companion: companion.id });
		});
	}

	test('the Porter and the Trader work while their City card is held, and leave with it', () => {
		const actor = late(world => {
			conjure(world, A, { kind: 'companion', companion: 'porter' });
			const here = world.game!.players[A]!.location;
			world.game!.locations[neighbours(world.campaign, here)[0]!]!.supplies = 2;
		});
		const here = gameOf(actor).players[A]!.location;
		const from = neighbours(worldOf(actor).campaign, here)[0]!;
		const before = gameOf(actor).locations[here]!.supplies;
		act(actor, { a: 'carry', from, count: 2 });
		expect(gameOf(actor).locations[here]!.supplies).toBe(before + 2);
		expect(gameOf(actor).actionsLeft).toBe(4);
		expect(refuses(actor, { a: 'carry', from, count: 1 })).toBe('There are not that many cubes there');

		const trading = late(world => {
			conjure(world, A, { kind: 'companion', companion: 'trader' });
			give(world, A, cityCards(world, 'cairo', 1));
			world.game!.playerDiscard.push(...cityCards(world, 'tripoli', 1));
		});
		const [cairo] = cityCards(worldOf(trading), 'cairo', 1);
		const [tripoli] = cityCards(worldOf(trading), 'tripoli', 1);
		act(trading, { a: 'trade', card: cairo!, take: tripoli! });
		expect(gameOf(trading).players[A]!.hand).toContain(tripoli);

		const dropped = late(world => {
			const card = conjure(world, A, { kind: 'companion', companion: 'porter' });
			removeFromHand(world.game!, A, card);
			world.game!.playerDiscard.push(card);
		});
		expect(refuses(dropped, { a: 'carry', from, count: 1 })).toBeTruthy();
	});

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

	test('a completed lost-haven objective leaves play, and a recon of a region carries into the second attempt', () => {
		const actor = ended(false, world => {
			world.campaign.attempt = 1;
			world.campaign.objectives.push('lostHaven', 'reconRegion');
			world.game!.completed.push('lostHaven', 'reconRegion');
			world.game!.progress.reconRegion = 1;
		});
		send(actor, { type: 'FINISH_UPKEEP', player: 'host' as PlayerId, done: true });
		const { campaign } = worldOf(actor);
		expect(campaign.objectives).not.toContain('lostHaven');
		expect(campaign.objectives).toContain('reconRegion');
		expect(campaign.carriedProgress.reconRegion).toBe(1);
		expect(pack.objectives.find(objective => objective.id === 'reconRegion')!.mandatory).toBe(true);
	});

	test('giving purchases back restores the units and the campaign as they were, and a restore waits for the population on it', () => {
		const actor = ended(true, world => {
			world.game!.locations[city('tehran')]!.shelter = true;
			world.campaign.locations[city('frankfurt')]!.population = 0;
			world.campaign.freeAbilityUnits = 3;
		});
		const sorted = (world: World) => {
			const campaign = structuredClone(world.campaign);
			for (const key of [
				'abilitiesForSale',
				'cityImprovementsForSale',
				'infectionImprovementsForSale',
				'permanentForSale',
			] as const)
				(campaign[key] as string[]).sort();
			return { campaign, units: world.game!.upkeep!.units };
		};
		const before = sorted(worldOf(actor));
		const character = Object.values(worldOf(actor).campaign.characters)[0]!;
		const purchases: Purchase[] = [
			{
				t: 'ability',
				ability: worldOf(actor).campaign.abilitiesForSale[0]!,
				character: character.id,
				slot: character.slots.indexOf(null),
			},
			{ t: 'cityImprovement', improvement: 'double', card: cityCards(worldOf(actor), 'london')[0]! },
			{ t: 'restore', city: city('frankfurt') },
			{ t: 'population', city: city('frankfurt'), steps: 1 },
			{ t: 'permanent', structure: 'shelter', city: city('tehran') },
		];
		for (const purchase of purchases) send(actor, { type: 'PURCHASE', purchase });
		expect(gameOf(actor).upkeep!.bought.map(entry => entry.purchase)).toEqual(purchases);
		expect(reject(worldOf(actor), 'upkeep', { type: 'REFUND', index: 2 })).toBe(
			"Give back Frankfurt's population first",
		);
		send(actor, { type: 'REFUND', index: 3 });
		send(actor, { type: 'REFUND', index: 2 });
		while (gameOf(actor).upkeep!.bought.length) send(actor, { type: 'REFUND', index: 0 });
		expect(sorted(worldOf(actor))).toEqual(before);
	});

	test('the game closes only once everyone at the table is done, and a purchase or refund calls the vote again', () => {
		const ann = 'ann' as PlayerId;
		const ben = 'ben' as PlayerId;
		const actor = ended(true, world => {
			world.table.seats = [
				{ seat: A, player: ann, name: 'Ann' },
				{ seat: B, player: ben, name: 'Ben' },
			];
		});
		const done = (player: PlayerId) => send(actor, { type: 'FINISH_UPKEEP', player, done: true });
		expect(reject(worldOf(actor), 'upkeep', { type: 'FINISH_UPKEEP', player: 'cat' as PlayerId, done: true })).toBe(
			'Sit down first',
		);
		done(ann);
		expect(gameOf(actor).upkeep!.done).toEqual([ann]);
		send(actor, { type: 'PURCHASE', purchase: { t: 'population', city: city('lagos'), steps: 1 } });
		expect(gameOf(actor).upkeep!.done).toEqual([]);
		done(ann);
		send(actor, { type: 'REFUND', index: 0 });
		expect(gameOf(actor).upkeep!.done).toEqual([]);
		done(ann);
		expect(phase(actor)).toBe('upkeep');
		done(ben);
		expect(phase(actor)).toBe('lobby');
	});

	test('every purchase applies, and permanent structures stand at the next setup', () => {
		const actor = ended(false, world => {
			const game = world.game!;
			game.locations[city('lagos')]!.tower = true;
			game.locations[city('tehran')]!.shelter = true;
			game.locations[city('london')]!.center = true;
			world.campaign.locations[city('frankfurt')]!.population = 0;
		});
		const { campaign } = worldOf(actor);
		const units = gameOf(actor).upkeep!.units;
		const ada = Object.values(campaign.characters)[0]!.id;
		const purchases = [
			{ t: 'cityImprovement', improvement: 'double', card: cityCards(worldOf(actor), 'london')[0]! },
			{ t: 'infectionImprovement', improvement: 'wellStocked', card: infectionCards(worldOf(actor), 'cairo')[0]! },
			{ t: 'population', city: city('lagos'), steps: 1 },
			{ t: 'restore', city: city('frankfurt') },
			{ t: 'permanent', structure: 'shelter', city: city('tehran') },
		] as const;
		for (const purchase of purchases) send(actor, { type: 'PURCHASE', purchase });
		const after = worldOf(actor).campaign;
		expect(gameOf(actor).upkeep!.units).toBe(units - 1 - 1 - 1 - 2 - 2);
		expect(after.locations[city('frankfurt')]!.population).toBe(1);
		expect(after.locations[city('lagos')]!.population).toBe(campaign.locations[city('lagos')]!.population + 1);
		send(actor, { type: 'FINISH_UPKEEP', player: 'host' as PlayerId, done: true });
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

	test('four losses in a row move 10 reserve cubes into the stockpile in the next games', () => {
		const actor = ended(false, world => {
			world.campaign.results = world.campaign.results.slice(0, -3).concat(
				[7, 8, 9].map(month => ({
					month,
					attempt: 2 as const,
					won: false,
					gridCities: 40,
					rationing: 6,
					characters: [],
				})),
			);
		});
		expect(worldOf(actor).campaign.losingStreakBonusGames).toBe(3);
		send(actor, { type: 'FINISH_UPKEEP', player: 'host' as PlayerId, done: true });
		const characters = Object.values(worldOf(actor).campaign.characters);
		send(actor, {
			type: 'START_GAME',
			seating: [
				{ seat: A, character: characters[0]!.id },
				{ seat: B, character: characters[1]!.id },
			],
		});
		expect(gameOf(actor).stockpile).toBe(8 + 30 + 10);
		// The reserve holds what the supply track leaves out of the stockpile, less the 10 the turning point moves.
		expect(gameOf(actor).reserve).toBe(36 - 8 - 10);
	});

	test('a win moves to the next month and eases rationing, and December ends the campaign', () => {
		const october = ended(true);
		const rationing = worldOf(october).campaign.rationing;
		send(october, { type: 'FINISH_UPKEEP', player: 'host' as PlayerId, done: true });
		expect(worldOf(october).campaign).toMatchObject({ month: 11, attempt: 1, rationing: Math.max(0, rationing - 2) });
		const december = ended(true, world => void (world.campaign.month = 12));
		send(december, { type: 'FINISH_UPKEEP', player: 'host' as PlayerId, done: true });
		expect(phase(december)).toBe('finished');
	});

	test('Well Stocked keeps a cube, Rebirth spares an emptied city, and Lockdown destroys its card from the discard pile', () => {
		const actor = late((world, game) => {
			const [cairo] = infectionCards(world, 'cairo');
			const [lagos] = infectionCards(world, 'lagos');
			(world.campaign.infectionCards[cairo!] as { improvement: string }).improvement = 'wellStocked';
			(world.campaign.infectionCards[lagos!] as { improvement: string }).improvement = 'rebirth';
			world.campaign.locations[city('lagos')]!.population = 6;
			game.locations[city('lagos')]!.supplies = 0;
			stackInfection(world, ['cairo', 'lagos', 'london']);
			const [london] = infectionCards(world, 'london');
			(world.campaign.infectionCards[london!] as { improvement: string }).improvement = 'lockdown';
			give(world, B, cityCards(world, 'tokyo', 1));
			game.infectionsLeft = 3;
		}, 'playing.infect');
		send(actor, { type: 'INFECT' });
		send(actor, { type: 'INFECT' });
		expect(gameOf(actor).locations[city('cairo')]!.supplies).toBe(2);
		expect(gameOf(actor).locations[city('lagos')]).toMatchObject({ supplies: 0, plague: 0 });
		const london = infectionCards(worldOf(actor), 'london')[0]!;
		send(actor, { type: 'INFECT' });
		const seat = gameOf(actor).seats.find(other => gameOf(actor).players[other]!.hand.length > 0)!;
		const pay = gameOf(actor).players[seat]!.hand[0]!;
		expect(reject(worldOf(actor), phase(actor), { type: 'LOCKDOWN', card: london, seat, pay: london })).toBe(
			'Discard a Player card from that hand',
		);
		send(actor, { type: 'LOCKDOWN', card: london, seat, pay });
		expect(worldOf(actor).campaign.infectionCards[london]).toBeUndefined();
		expect(gameOf(actor).playerDiscard).toContain(pay);
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

	test('undoing an action that revealed information requires unanimous table consensus', () => {
		const actor = late((world, game) => {
			const [card] = cityCards(world, 'denver');
			(world.campaign.playerCards[card!] as { search: unknown[] }).search = [
				{ scope: 'land', result: { t: 'nothing' }, scratched: false },
			];
			game.players[A]!.location = city('denver');
			give(world, A, [card!]);
		});
		const ann = 'ann' as PlayerId;
		const ben = 'ben' as PlayerId;
		send(actor, { type: 'TAKE_SEAT', player: ann, name: 'Ann', seat: A });
		send(actor, { type: 'TAKE_SEAT', player: ben, name: 'Ben', seat: B });
		const card = gameOf(actor).players[A]!.hand[0]!;
		const scratched = () => {
			const held = worldOf(actor).campaign.playerCards[card]!;
			return held.kind === 'city' && held.search[0]!.scratched;
		};
		act(actor, { a: 'makeSupplies' });
		expect(publicState(actor.getSnapshot()).canUndo).toBe(true);
		act(actor, { a: 'search', card, box: 0 });
		showReveals(actor);
		expect(publicState(actor.getSnapshot()).canUndo).toBe(true);
		expect(scratched()).toBe(true);

		// Requesting undo opens a vote and blocks other actions until resolved.
		send(actor, { type: 'UNDO', by: ann });
		expect(worldOf(actor).table.undoVote).toMatchObject({
			seat: A,
			subject: { kind: 'action', action: 'search' },
			by: ann,
			votes: {},
		});
		expect(publicState(actor.getSnapshot()).canUndo).toBe(false);
		expect(reject(worldOf(actor), 'playing.actions', { type: 'END_ACTIONS', seat: A })).toBe(
			'Finish the undo vote first',
		);

		// A split vote denies the undo and keeps the action.
		send(actor, { type: 'UNDO_VOTE', player: ann, vote: 'yes' });
		expect(worldOf(actor).table.undoVote?.votes).toEqual({ [ann]: 'yes' });
		send(actor, { type: 'UNDO_VOTE', player: ben, vote: 'no' });
		expect(worldOf(actor).table.undoVote).toBeNull();
		expect(scratched()).toBe(true);

		// Unanimous yes allows the undo and restores state before the revealing action.
		send(actor, { type: 'UNDO', by: ann });
		send(actor, { type: 'UNDO_VOTE', player: ann, vote: 'yes' });
		send(actor, { type: 'UNDO_VOTE', player: ben, vote: 'yes' });
		expect(worldOf(actor).table.undoVote).toBeNull();
		expect(scratched()).toBe(false);
		expect(publicState(actor.getSnapshot()).canUndo).toBe(true);
	});

	test('playing a non-revealing event during actions keeps undo and restores the card and cubes immediately', () => {
		const actor = late((world, game) => {
			const stockUp = Object.values(world.campaign.playerCards).find(
				card => card.kind === 'event' && card.event === 'stockUp',
			)!.id;
			game.reserve = 10;
			game.stockpile = 2;
			give(world, A, [stockUp]);
		});
		const ann = 'ann' as PlayerId;
		const ben = 'ben' as PlayerId;
		send(actor, { type: 'TAKE_SEAT', player: ann, name: 'Ann', seat: A });
		send(actor, { type: 'TAKE_SEAT', player: ben, name: 'Ben', seat: B });
		const stockUp = gameOf(actor).players[A]!.hand[0]!;
		const initialSupplies = gameOf(actor).players[A]!.supplies;

		act(actor, { a: 'makeSupplies' });
		const beforeEvent = {
			stockpile: gameOf(actor).stockpile,
			reserve: gameOf(actor).reserve,
			supplies: gameOf(actor).players[A]!.supplies,
		};

		send(actor, { type: 'PLAY', seat: A, card: stockUp, play: { e: 'stockUp' } });
		expect(publicState(actor.getSnapshot()).canUndo).toBe(true);
		expect(gameOf(actor).stockpile).toBe(beforeEvent.stockpile + 8);
		expect(gameOf(actor).reserve).toBe(beforeEvent.reserve - 8);
		expect(gameOf(actor).players[A]!.hand).not.toContain(stockUp);

		// Undoing stockUp succeeds immediately without a vote and restores card + cubes.
		send(actor, { type: 'UNDO', by: ann });
		expect(worldOf(actor).table.undoVote).toBeNull();
		expect(gameOf(actor).stockpile).toBe(beforeEvent.stockpile);
		expect(gameOf(actor).reserve).toBe(beforeEvent.reserve);
		expect(gameOf(actor).players[A]!.hand).toContain(stockUp);
		expect(worldOf(actor).campaign.playerCards[stockUp]).toBeDefined();

		// Earlier action from the same turn is still undoable too.
		expect(publicState(actor.getSnapshot()).canUndo).toBe(true);
		send(actor, { type: 'UNDO', by: ann });
		expect(gameOf(actor).players[A]!.supplies).toBe(initialSupplies);
		expect(publicState(actor.getSnapshot()).canUndo).toBe(false);
	});

	test('undoing a revealing event played during actions requires unanimous table consensus', () => {
		const actor = late((world, game) => {
			const forecast = Object.values(world.campaign.playerCards).find(
				card => card.kind === 'event' && card.event === 'forecast',
			)!.id;
			give(world, A, [forecast]);
			// Ensure at least 2 cards in infection deck to reorder visibly.
			if (game.infectionDeck.order.length < 2) throw new Error('expected infection cards');
		});
		const ann = 'ann' as PlayerId;
		const ben = 'ben' as PlayerId;
		send(actor, { type: 'TAKE_SEAT', player: ann, name: 'Ann', seat: A });
		send(actor, { type: 'TAKE_SEAT', player: ben, name: 'Ben', seat: B });
		const forecast = gameOf(actor).players[A]!.hand[0]!;
		const originalTop = gameOf(actor).infectionDeck.order.slice(0, 8);
		const reversed = [...originalTop].reverse();

		send(actor, { type: 'PLAY', seat: A, card: forecast, play: { e: 'forecast', order: reversed } });
		expect(publicState(actor.getSnapshot()).canUndo).toBe(true);
		expect(gameOf(actor).infectionDeck.order.slice(0, 8)).toEqual(reversed);

		// Requesting undo opens a consensus vote naming the forecast play.
		send(actor, { type: 'UNDO', by: ann });
		expect(worldOf(actor).table.undoVote).toMatchObject({
			seat: A,
			subject: { kind: 'play', play: 'forecast' },
			by: ann,
			votes: {},
		});

		// Split vote denies the undo.
		send(actor, { type: 'UNDO_VOTE', player: ann, vote: 'yes' });
		send(actor, { type: 'UNDO_VOTE', player: ben, vote: 'no' });
		expect(worldOf(actor).table.undoVote).toBeNull();
		expect(gameOf(actor).infectionDeck.order.slice(0, 8)).toEqual(reversed);

		// Unanimous yes undoes the forecast and restores the card and deck order.
		send(actor, { type: 'UNDO', by: ann });
		send(actor, { type: 'UNDO_VOTE', player: ann, vote: 'yes' });
		send(actor, { type: 'UNDO_VOTE', player: ben, vote: 'yes' });
		expect(worldOf(actor).table.undoVote).toBeNull();
		expect(gameOf(actor).infectionDeck.order.slice(0, 8)).toEqual(originalTop);
		expect(gameOf(actor).players[A]!.hand).toContain(forecast);
	});

	test('resolving a pending decision keeps the action undoable', () => {
		const actor = late((world, game) => {
			world.campaign.frequenciesUsed = [];
			game.players[A]!.location = city('lagos');
			game.locations[city('lagos')]!.tower = true;
			const nonEpidemics = game.playerDeck.order.filter(id => world.campaign.playerCards[id]!.kind !== 'epidemic');
			const hand = nonEpidemics.slice(4, 11);
			game.playerDeck.order = game.playerDeck.order.filter(id => !hand.includes(id));
			game.playerDeck.piles = [{ size: game.playerDeck.order.length, epidemics: 0 }];
			game.players[A]!.hand = hand;
		});
		const ann = 'ann' as PlayerId;
		const ben = 'ben' as PlayerId;
		send(actor, { type: 'TAKE_SEAT', player: ann, name: 'Ann', seat: A });
		send(actor, { type: 'TAKE_SEAT', player: ben, name: 'Ben', seat: B });
		const handBefore = [...gameOf(actor).players[A]!.hand];
		const deckBefore = [...gameOf(actor).playerDeck.order];

		act(actor, { a: 'monitor', frequency: 8 });
		showReveals(actor);
		expect(gameOf(actor).players[A]!.hand).toHaveLength(8);
		send(actor, { type: 'DECIDE', decide: { d: 'discard', seat: A, cards: [handBefore[0]!] } });
		expect(gameOf(actor).players[A]!.hand).toHaveLength(7);
		expect(publicState(actor.getSnapshot()).canUndo).toBe(true);

		send(actor, { type: 'UNDO', by: ann });
		send(actor, { type: 'UNDO_VOTE', player: ann, vote: 'yes' });
		send(actor, { type: 'UNDO_VOTE', player: ben, vote: 'yes' });
		expect(gameOf(actor).players[A]!.hand).toEqual(handBefore);
		expect(gameOf(actor).playerDeck.order).toEqual(deckBefore);
		expect(worldOf(actor).campaign.frequenciesUsed).toEqual([]);
	});
});

test('Monitor turns over one card per command, and the cards reach a hand or the discard pile only once put away', () => {
	const actor = late((world, game) => {
		world.campaign.frequenciesUsed = [];
		game.players[A]!.location = city('lagos');
		game.locations[city('lagos')]!.tower = true;
	});
	const top = gameOf(actor).playerDeck.order.slice(0, 4);
	const hand = gameOf(actor).players[A]!.hand.length;
	const discards = gameOf(actor).playerDiscard.length;
	act(actor, { a: 'monitor', frequency: 4 });
	for (let turned = 1; turned <= 4; turned++) {
		send(actor, { type: 'DECIDE', decide: { d: 'reveal' } });
		expect(gameOf(actor).pending[0]).toMatchObject({ t: 'reveal', cards: top.slice(0, turned) });
		expect(gameOf(actor).players[A]!.hand.length + gameOf(actor).playerDiscard.length).toBe(hand + discards);
	}
	send(actor, { type: 'DECIDE', decide: { d: 'reveal' } });
	expect(gameOf(actor).pending).toEqual([]);
	expect(gameOf(actor).players[A]!.hand.length + gameOf(actor).playerDiscard.length).toBe(hand + discards + 4);
});

test('Monitor frequencies that keep cards take the newest non-Epidemic discards', () => {
	const actor = late((world, game) => {
		world.campaign.frequenciesUsed = [];
		game.players[A]!.location = city('lagos');
		game.locations[city('lagos')]!.tower = true;
	});
	const top = gameOf(actor)
		.playerDeck.order.slice(0, 4)
		.filter(id => worldOf(actor).campaign.playerCards[id]!.kind !== 'epidemic');
	act(actor, { a: 'monitor', frequency: 4 });
	showReveals(actor);
	expect(gameOf(actor).players[A]!.hand).toHaveLength(Math.min(2, top.length));
	expect(top).toEqual(expect.arrayContaining(gameOf(actor).players[A]!.hand));
});

test('a Cordon card lets any player discard to end the Infect step', () => {
	const actor = late((world, game) => {
		const [cairo] = infectionCards(world, 'cairo');
		(world.campaign.infectionCards[cairo!] as { improvement: string }).improvement = 'cordon';
		world.campaign.rules = world.campaign.rules.filter(rule => rule !== 'labBreakthroughs');
		stackInfection(world, ['cairo', 'lagos']);
		give(world, C, cityCards(world, 'tokyo'));
		game.infectionsLeft = 2;
	}, 'playing.infect');
	send(actor, { type: 'INFECT' });
	expect(gameOf(actor).pending[0]).toEqual({ t: 'cordon' });
	send(actor, { type: 'DECIDE', decide: { d: 'cordon', seat: C, card: gameOf(actor).players[C]!.hand[0]! } });
	expect(gameOf(actor).locations[city('lagos')]!.supplies).toBe(2);
	expect(reject(worldOf(actor), phase(actor), { type: 'INFECT' })).not.toBeNull();
	passTurn(actor);
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
	setUp(owed);
	expect(gameOf(owed).pending[0]).toEqual({ t: 'scar', seat: null });
	send(owed, { type: 'DECIDE', decide: { d: 'scar', scar: 'smallHand', target: 2, seat: B } });
	expect(character(worldOf(owed), B).slots[2]).toEqual({ kind: 'scar', id: 'smallHand' });
	expect(worldOf(owed).campaign.owedScars).toBe(0);
});

describe('seats in the lobby are shared state', () => {
	const lobby = () => createGameActor({ seed: 2, save: null }).start();
	const seats = (actor: ReturnType<typeof lobby>) =>
		tableSeating(worldOf(actor).campaign).map(entry => `${entry.seat}:${entry.character ?? 'worker'}`);

	test('each new character takes the first empty seat', () => {
		const actor = lobby();
		const home = city('haven-north-atlantic');
		send(actor, { type: 'CREATE_CHARACTER', name: 'Ada', job: 'administrator', home });
		send(actor, { type: 'CREATE_CHARACTER', name: 'Bo', job: 'farmer', home });
		const [ada, bo] = Object.values(worldOf(actor).campaign.characters);
		expect(seats(actor)).toEqual([`seat-1:${ada!.id}`, `seat-2:${bo!.id}`]);
	});

	test('a seat can be changed, emptied or given to a haven worker, and a character sits in one seat only', () => {
		const actor = lobby();
		const home = city('haven-north-atlantic');
		send(actor, { type: 'CREATE_CHARACTER', name: 'Ada', job: 'administrator', home });
		send(actor, { type: 'CREATE_CHARACTER', name: 'Bo', job: 'farmer', home });
		const [ada, bo] = Object.values(worldOf(actor).campaign.characters);
		send(actor, { type: 'SEAT', seat: C, choice: ada!.id });
		expect(seats(actor)).toEqual([`seat-2:${bo!.id}`, `seat-3:${ada!.id}`]);
		send(actor, { type: 'SEAT', seat: A, choice: 'worker' });
		send(actor, { type: 'SEAT', seat: B, choice: null });
		expect(seats(actor)).toEqual(['seat-1:worker', `seat-3:${ada!.id}`]);
		expect(reject(worldOf(actor), 'lobby', { type: 'SEAT', seat: A, choice: 'nobody' as never })).toBe(
			'Pick a living character',
		);
	});

	test("a found job's character joins at once at the job's home, or waits for a free Character card", () => {
		const world = mutable(lobby());
		applyUnlock(world, { t: 'job', job: 'captain', home: city('haven-north-atlantic') });
		expect(Object.values(world.campaign.characters).find(entry => entry.job === 'captain')).toMatchObject({
			name: 'Captain',
			home: 'haven-north-atlantic',
		});

		const full = mutable(lobby());
		full.campaign.characterCards = [];
		applyUnlock(full, { t: 'job', job: 'captain', home: city('haven-north-atlantic') });
		expect(full.campaign.jobsFound).toEqual([{ job: 'captain', home: city('haven-north-atlantic') }]);
		full.campaign.characterCards = mutable(lobby()).campaign.characterCards;
		const found = createGameActor({ seed: 2, save: { v: 1 as const, phase: 'lobby' as const, world: full } }).start();
		const make = (home: string) =>
			({ type: 'CREATE_CHARACTER', name: 'Cap', job: 'captain', home: city(home) }) as const;
		expect(reject(worldOf(found), 'lobby', make('haven-mediterranean'))).toContain('lives at');
		send(found, make('haven-north-atlantic'));
		expect(Object.values(worldOf(found).campaign.characters).some(entry => entry.job === 'captain')).toBe(true);
	});

	test('the seats a game started with are still set in the next lobby', () => {
		const actor = lobby();
		const home = city('haven-north-atlantic');
		send(actor, { type: 'CREATE_CHARACTER', name: 'Ada', job: 'administrator', home });
		send(actor, { type: 'CREATE_CHARACTER', name: 'Bo', job: 'farmer', home });
		const before = seats(actor);
		send(actor, { type: 'START_GAME', seating: tableSeating(worldOf(actor).campaign) });
		expect(phase(actor)).toBe('setup.supply');
		expect(seats(actor)).toEqual(before);
	});
});

describe('the remaining abilities and the Jade lab', () => {
	const withAbility = (ability: string, edit?: (world: World) => void) =>
		late(world => {
			character(world, A).slots[1] = { kind: 'ability', id: ability } as never;
			edit?.(world);
		});

	test('the Investigator discards any card for a City card from the discard pile, once per turn', () => {
		const actor = withAbility('investigator', world => {
			give(world, A, cityCards(world, 'cairo', 2));
			world.game!.playerDiscard.push(...cityCards(world, 'london', 2));
		});
		const [first, second] = cityCards(worldOf(actor), 'london', 2);
		const cairo = gameOf(actor).players[A]!.hand[0]!;
		act(actor, { a: 'investigate', card: cairo, take: first! });
		expect(gameOf(actor).players[A]!.hand).toContain(first);
		expect(gameOf(actor).playerDiscard).toContain(cairo);
		expect(refuses(actor, { a: 'investigate', card: gameOf(actor).players[A]!.hand[0]!, take: second! })).toBe(
			'Once per turn',
		);
	});

	test('the Supplier moves a stockpile cube to a city whose card they hold, once per turn', () => {
		const actor = withAbility('supplier', world => give(world, A, cityCards(world, 'tokyo')));
		const { stockpile } = gameOf(actor);
		const before = gameOf(actor).locations[city('tokyo')]!.supplies;
		const card = gameOf(actor).players[A]!.hand[0]!;
		act(actor, { a: 'supply', card });
		expect(gameOf(actor).locations[city('tokyo')]!.supplies).toBe(before + 1);
		expect(gameOf(actor).stockpile).toBe(stockpile - 1);
		expect(gameOf(actor).players[A]!.hand).toEqual([card]);
		expect(refuses(actor, { a: 'supply', card })).toBe('Once per turn');
	});

	test('the Smuggler discards a City card to put a reserve cube in that city', () => {
		const actor = withAbility('smuggler', world => give(world, A, cityCards(world, 'tokyo')));
		const { reserve } = gameOf(actor);
		const before = gameOf(actor).locations[city('tokyo')]!.supplies;
		const card = gameOf(actor).players[A]!.hand[0]!;
		act(actor, { a: 'smuggle', card });
		expect(gameOf(actor).locations[city('tokyo')]!.supplies).toBe(before + 1);
		expect(gameOf(actor).reserve).toBe(reserve - 1);
		expect(gameOf(actor).players[A]!.hand).toEqual([]);
		expect(gameOf(actor).playerDiscard).toContain(card);
	});

	test('the Coordinator pulls a pawn from an adjacent location for free', () => {
		const actor = withAbility('coordinator', world => {
			const here = world.game!.players[A]!.location;
			world.game!.players[B]!.location = neighbours(world.campaign, here)[0]!;
		});
		const here = gameOf(actor).players[A]!.location;
		const actions = gameOf(actor).actionsLeft;
		act(actor, { a: 'coordinate', pawn: B });
		expect(gameOf(actor).players[B]!.location).toBe(here);
		expect(gameOf(actor).actionsLeft).toBe(actions);
		expect(refuses(actor, { a: 'coordinate', pawn: B })).toBe('Pick a pawn in an adjacent location');
	});

	test('the Facilitator takes any card from a player in the same location', () => {
		const actor = withAbility('facilitator', world => {
			world.game!.players[B]!.location = world.game!.players[A]!.location;
			give(world, B, cityCards(world, 'tokyo'));
			give(world, C, cityCards(world, 'osaka'));
		});
		const tokyo = cityCards(worldOf(actor), 'tokyo')[0]!;
		expect(refuses(actor, { a: 'facilitate', with: C, card: cityCards(worldOf(actor), 'osaka')[0]! })).toContain(
			'same location',
		);
		act(actor, { a: 'facilitate', with: B, card: tokyo });
		expect(gameOf(actor).players[A]!.hand).toEqual([tokyo]);
	});

	test('the Runner discards a City card to go anywhere on the grid from a haven or supply center', () => {
		const actor = withAbility('runner', world => give(world, A, cityCards(world, 'cairo')));
		const card = gameOf(actor).players[A]!.hand[0]!;
		act(actor, { a: 'run', card, to: city('denver') });
		expect(gameOf(actor).players[A]!.location).toBe(city('denver'));
		const stranded = withAbility('runner', world => {
			world.game!.players[A]!.location = city('denver');
			give(world, A, cityCards(world, 'cairo'));
		});
		expect(refuses(stranded, { a: 'run', card, to: city('cairo') })).toContain('haven or a supply center');
	});

	test('the Foreman builds supply lines for 1 cube fewer', () => {
		const find = (world: World) =>
			pack.candidateEdges.find(
				edge =>
					edge.kind === 'land' &&
					!hasEdge(world.campaign, edge.a, edge.b) &&
					checkEdge(world.campaign, edge.a, edge.b, 'land') === null,
			)!;
		const actor = withAbility('foreman', world => {
			world.game!.players[A]!.location = find(world).a;
			world.game!.players[A]!.supplies = 1;
		});
		const edge = find(worldOf(actor));
		act(actor, { a: 'establishLine', to: edge.b });
		expect(hasEdge(worldOf(actor).campaign, edge.a, edge.b)).toBe(true);
		expect(gameOf(actor).players[A]!.supplies).toBe(0);
	});

	test('the Soldier discards a card of the colour to leave Hollow Men unexposed, and is exposed without one', () => {
		const leaving = (card: boolean) =>
			withAbility('soldier', world => {
				world.game!.players[A]!.location = city('cairo');
				world.game!.locations[city('cairo')]!.hollow = 2;
				give(world, A, card ? cityCards(world, 'baghdad') : cityCards(world, 'london'));
			});
		const guarded = leaving(true);
		act(guarded, { a: 'drive', to: city('tripoli') });
		expect(character(worldOf(guarded), A).exposure).toBe(0);
		expect(gameOf(guarded).players[A]!.hand).toEqual([]);
		const caught = leaving(false);
		act(caught, { a: 'drive', to: city('tripoli') });
		expect(character(worldOf(caught), A).exposure).toBe(1);
	});

	test("door 48's scars: Susceptible is exposed twice in an infested city, Fear of Needles may not Inoculate, Fear of Flying pays a card to shuttle", () => {
		const scarred = (scar: string, edit?: (world: World) => void) =>
			late(world => {
				character(world, A).slots[1] = { kind: 'scar', id: scar } as never;
				edit?.(world);
			});
		const exposures = (scar: string) => {
			const world = mutable(scarred(scar));
			world.campaign.locations[city('kinshasa')]!.infested = true;
			Object.assign(world.game!, { active: A });
			world.game!.players[A]!.location = city('kinshasa');
			character(world, A).exposureTrack = ['empty', 'empty', 'empty', 'empty', 'skull'];
			beginTurn(world);
			return character(world, A).exposure;
		};
		expect(exposures('susceptible')).toBe(2);
		expect(exposures('wary')).toBe(1);
		const needles = scarred('fearOfNeedles', world => {
			world.game!.players[A]!.location = city('cairo');
			world.game!.playerDiscard.push(...cityCards(world, 'cairo'));
		});
		expect(refuses(needles, { a: 'inoculate', card: cityCards(worldOf(needles), 'cairo')[0]! })).toContain(
			'Fear of Needles',
		);
		const flying = scarred('fearOfFlying', world => {
			world.game!.players[A]!.location = city('haven-north-atlantic');
			give(world, A, cityCards(world, 'tokyo'));
		});
		const to = city('haven-mediterranean');
		expect(refuses(flying, { a: 'shuttle', to })).toContain('Fear of Flying');
		act(flying, { a: 'shuttle', to, card: cityCards(worldOf(flying), 'tokyo')[0]! });
		expect(gameOf(flying).players[A]!.location).toBe(to);
	});

	test('the Misinformation Specialist leads a Hollow Man to a neighbouring city holding 2 or fewer', () => {
		const actor = withAbility('misinformationSpecialist', world => {
			world.game!.players[A]!.location = city('cairo');
			world.game!.locations[city('cairo')]!.hollow = 2;
			world.game!.locations[city('tripoli')]!.hollow = 3;
		});
		expect(refuses(actor, { a: 'misinform', to: city('tripoli') })).toBe('That city already holds 3 Hollow Men');
		const before = gameOf(actor).locations[city('baghdad')]!.hollow;
		act(actor, { a: 'misinform', to: city('baghdad') });
		expect(gameOf(actor).locations[city('cairo')]!.hollow).toBe(1);
		expect(gameOf(actor).locations[city('baghdad')]!.hollow).toBe(before + 1);
	});

	test('the Rehab Nurse discards 2 cards to take a stored City card into hand', () => {
		const actor = withAbility('rehabNurse', world => {
			give(world, A, cityCards(world, 'cairo', 2));
			world.campaign.stored.player.push(cityCards(world, 'london')[0]!);
		});
		const stored = cityCards(worldOf(actor), 'london')[0]!;
		act(actor, { a: 'rehab', discard: cityCards(worldOf(actor), 'cairo', 2), take: stored });
		expect(gameOf(actor).players[A]!.hand).toContain(stored);
		expect(worldOf(actor).campaign.stored.player).not.toContain(stored);
	});

	test('with the Jade lab found, an Epidemic removes 1 cube from the struck city instead of all', () => {
		const actor = late((world, game) => {
			world.campaign.rules = world.campaign.rules.filter(rule => rule !== 'epidemicFromStorage');
			const epidemic = Object.values(world.campaign.playerCards).find(card => card.kind === 'epidemic')!.id;
			game.playerDeck.order = [epidemic, ...game.playerDeck.order.filter(card => card !== epidemic)];
			game.playerDeck.piles = [{ size: game.playerDeck.order.length, epidemics: 10 }];
			stackInfection(world, []);
			const bottom = world.campaign.infectionCards[game.infectionDeck.order.at(-1)!] as unknown as { city: CityId };
			game.locations[bottom.city]!.supplies = 3;
			game.drawsLeft = 2;
		}, 'playing.draw');
		expect(breakthrough(worldOf(actor).campaign, 'jade')).toBe(true);
		const struck = (
			worldOf(actor).campaign.infectionCards[gameOf(actor).infectionDeck.order.at(-1)!] as unknown as { city: CityId }
		).city;
		send(actor, { type: 'DRAW' });
		send(actor, { type: 'DECIDE', decide: { d: 'skip' } });
		send(actor, { type: 'DECIDE', decide: { d: 'skip' } });
		expect(gameOf(actor).locations[struck]!.supplies).toBe(2);
	});

	test('every ability the game defines is in the box from the start or unlocked by a Legacy card, package or door', () => {
		const unlocks = [...pack.legacyDeck, ...pack.seals].flatMap(source => [
			...source.unlocks,
			...('reward' in source ? (source.reward ?? []) : []),
		]);
		const offered = new Set([
			...pack.startingAbilities,
			...unlocks.flatMap(unlock => (unlock.t === 'ability' ? [unlock.ability] : [])),
		]);
		expect([...offered].toSorted()).toEqual(pack.abilities.map(ability => ability.id).toSorted());
	});
});

const inInfectStep = (edit?: (world: World) => void) =>
	late((world, game) => {
		game.actionsLeft = 0;
		game.drawsLeft = 0;
		game.infectionsLeft = pack.numbers.infectionRates[game.rateIndex]!;
		stackInfection(world, ['cairo', 'lagos', 'london']);
		edit?.(world);
	}, 'playing.infect');

test('One Quiet Night played before the first flip skips the Infect step it is played in', () => {
	let card = '' as CardId;
	const actor = inInfectStep(world => (card = conjure(world, B, { kind: 'event', event: 'quietNight' })));
	const cubes = gameOf(actor).locations[city('cairo')]!.supplies;
	send(actor, { type: 'PLAY', seat: B, card, play: { e: 'quietNight' } });
	expect(reject(worldOf(actor), phase(actor), { type: 'INFECT' })).not.toBeNull();
	passTurn(actor);
	expect(phase(actor)).toBe('playing.actions');
	expect(gameOf(actor).active).toBe(B);
	expect(gameOf(actor).locations[city('cairo')]!.supplies).toBe(cubes);
	expect(gameOf(actor).skipInfection).toBe(false);
});

test('One Quiet Night played after a flip leaves this step alone and skips the next one', () => {
	let card = '' as CardId;
	const actor = inInfectStep(world => (card = conjure(world, B, { kind: 'event', event: 'quietNight' })));
	send(actor, { type: 'INFECT' });
	const left = gameOf(actor).infectionsLeft;
	send(actor, { type: 'PLAY', seat: B, card, play: { e: 'quietNight' } });
	expect(phase(actor)).toBe('playing.infect');
	expect(gameOf(actor).infectionsLeft).toBe(left);
	expect(gameOf(actor).skipInfection).toBe(true);
});

test('Extended Time is refused once the action step is over, and the card stays in hand', () => {
	for (const at of ['playing.draw', 'playing.infect'] as const) {
		let card = '' as CardId;
		const actor = late((world, game) => {
			game.actionsLeft = 0;
			game.drawsLeft = at === 'playing.draw' ? 2 : 0;
			game.infectionsLeft = at === 'playing.infect' ? 2 : 0;
			card = conjure(world, A, { kind: 'event', event: 'secondWind' });
		}, at);
		const command = { type: 'PLAY', seat: A, card, play: { e: 'secondWind' } } as const;
		expect(reject(worldOf(actor), phase(actor), command)).toContain('action step');
		actor.send(command);
		expect(gameOf(actor).players[A]!.hand).toContain(card);
		expect(gameOf(actor).actionsLeft).toBe(0);
	}
});

const mutable = (actor: ReturnType<typeof late>) => JSON.parse(JSON.stringify(worldOf(actor))) as World;

test('Lake Baikal can only be joined to the grid from Utopia', () => {
	const partners = pack.candidateEdges
		.filter(edge => edge.a === pack.sampleFrom || edge.b === pack.sampleFrom)
		.map(edge => (edge.a === pack.sampleFrom ? edge.b : edge.a));
	expect(partners as string[]).toEqual(['utopia']);
});

test('South America leaves the eastern Pacific haven hidden, and sighting the haven draws its sea route from Lima', () => {
	const world: World = { campaign: newCampaign(4), game: null, table: newTable() };
	openSeal(world, { t: 'package', id: 5 }, false);
	const { campaign } = world;
	expect(campaign.locations[city('haven-eastern-pacific')]!.revealed).toBe(false);
	openSeal(world, { t: 'door', id: '60' }, false);
	expect(campaign.locations[city('haven-eastern-pacific')]!.revealed).toBe(true);
	expect(
		campaign.edges.some(
			edge => edge.kind === 'sea' && [edge.a, edge.b].toSorted().join() === 'haven-eastern-pacific,lima',
		),
	).toBe(true);
});

test('opening a package, even by a perimeter report, opens the doors its report names', () => {
	const world: World = { campaign: newCampaign(4), game: null, table: newTable() };
	openSeal(world, { t: 'package', id: 1 }, false);
	openSeal(world, { t: 'package', id: 2 }, true);
	expect(world.campaign.opened).toEqual([
		'package:1',
		'door:66',
		'door:J',
		'door:23',
		'door:L',
		'door:39',
		'package:2',
		'door:62',
		'door:53',
		'door:F',
		'door:14',
	]);
	expect(world.campaign.forced).toEqual(['package:2']);
});

test('the March perimeter report scratches its first box only while door 67 is sealed', () => {
	const [box] = pack.legacyDeck.find(card => card.id === '03-01')!.unlocks;
	const sealed: World = { campaign: newCampaign(5), game: null, table: newTable() };
	applyUnlock(sealed, box!);
	expect(sealed.campaign.scratched).toEqual(['03-01:1']);
	const opened: World = { campaign: newCampaign(5), game: null, table: newTable() };
	openSeal(opened, { t: 'door', id: '67' }, false);
	applyUnlock(opened, box!);
	expect(opened.campaign.scratched).toEqual([]);
});

test('the first pawn at the eastern Pacific haven opens Package 6: 15 new cubes, one Lab card in hand and two in the discard pile', () => {
	const actor = late((world, game) => {
		world.campaign.opened = world.campaign.opened.filter(key => key !== 'package:6');
		world.campaign.playerCards = Object.fromEntries(
			Object.entries(world.campaign.playerCards).filter(
				([, card]) => card.kind !== 'event' || card.event !== 'surplus',
			),
		);
		game.players[A]!.location = city('lima');
		world.campaign.edges.push({ a: city('lima'), b: city('haven-eastern-pacific'), kind: 'sea' });
		world.campaign.locations[city('haven-eastern-pacific')]!.revealed = true;
	});
	const before = gameOf(actor);
	act(actor, { a: 'drive', to: city('haven-eastern-pacific') });
	const labs = (ids: CardId[]) =>
		ids.filter(id => {
			const card = worldOf(actor).campaign.playerCards[id];
			return card?.kind === 'event' && card.event === 'surplus';
		});
	expect(worldOf(actor).campaign.opened).toContain('package:6');
	expect(gameOf(actor).stockpile).toBe(before.stockpile + 15);
	expect(labs(gameOf(actor).players[A]!.hand)).toHaveLength(1);
	expect(labs(gameOf(actor).playerDiscard)).toHaveLength(2);
});

test('the Pearl lab (door 22) opens on the first arrival at Lake Baikal only once Package 8 is open', () => {
	const reach = (package8: boolean) => {
		const actor = late((world, game) => {
			world.campaign.opened = world.campaign.opened.filter(
				key => key !== 'door:22' && (package8 || key !== 'package:8'),
			);
			if (package8 && !world.campaign.opened.includes('package:8')) world.campaign.opened.push('package:8');
			game.players[A]!.location = city('seoul');
			world.campaign.locations[city('seoul')]!.revealed = true;
			world.campaign.locations[city('lake-baikal')]!.revealed = true;
			world.campaign.edges.push({ a: city('seoul'), b: city('lake-baikal'), kind: 'land' });
		});
		act(actor, { a: 'drive', to: city('lake-baikal') });
		expect(gameOf(actor).players[A]!.location).toBe(city('lake-baikal'));
		return worldOf(actor).campaign.opened.includes('door:22');
	};
	expect(reach(false)).toBe(false);
	expect(reach(true)).toBe(true);
});

test('the canonical tabletop campaign still builds against the pack, at the August lobby with no invariant broken', () => {
	const save = parseSave(JSON.parse(JSON.stringify(tabletopSave())));
	expect(save.phase).toBe('lobby');
	expect(save.world.campaign.month).toBe(8);
	expect(violations(save.world, new Map())).toEqual([]);
});

test('the canonical save loads in this build, at the September lobby with no invariant broken', () => {
	const save = canonicalSave();
	expect(save.phase).toBe('lobby');
	expect(save.world.campaign.month).toBe(9);
	expect(violations(save.world, new Map())).toEqual([]);
});

test('only the North America recon completes the January objective', () => {
	const counting = pack.reconRoutes.filter(route => route.counts.includes('reconRegion')).map(route => route.id);
	expect(counting).toEqual(['north-america']);
});

test('a stockpile bonus found during a game lands in that game, out of the reserve', () => {
	const world = mutable(late());
	const game = world.game!;
	const before = { stockpile: game.stockpile, reserve: game.reserve, bonus: world.campaign.stockpileBonus };
	applyUnlock(world, { t: 'stockpileBonus', amount: 15 });
	expect(game.stockpile).toBe(before.stockpile + 15);
	expect(game.reserve).toBe(before.reserve - 15);
	expect(world.campaign.stockpileBonus).toBe(before.bonus + 15);
});

test('a shelter stops the population loss from a fourth Hollow Man', () => {
	for (const shelter of [true, false]) {
		const world = mutable(late());
		const location = world.game!.locations[city('cairo')]!;
		Object.assign(location, { hollow: 3, shelter });
		const population = world.campaign.locations[city('cairo')]!.population;
		placeHollow(world, city('cairo'), infectionCards(world, 'cairo')[0]!);
		expect(world.campaign.locations[city('cairo')]!.population).toBe(shelter ? population : population - 1);
	}
});

test('running out of Hollow Men figures loses the game only once the September rule is in', () => {
	for (const withRule of [false, true]) {
		const world = mutable(late());
		world.campaign.rules = world.campaign.rules.filter(rule => rule !== 'hollowSetup');
		if (withRule) world.campaign.rules.push('hollowSetup');
		world.game!.pieces.hollow = 0;
		placeHollow(world, city('cairo'), infectionCards(world, 'cairo')[0]!);
		expect(world.game!.outcome?.won).toBe(withRule ? false : undefined);
	}
});

test('the second December game lost reads the Legacy deck down to its last card', () => {
	const world = decemberSave().world;
	world.campaign.legacyIndex = pack.legacyDeck.findIndex(card => card.id === '12-05');
	world.campaign.legacyHalt = { kind: 'finale', month: 12 };
	world.campaign.attempt = 2;
	readLegacy(world, 'gameEnd', false);
	expect(world.campaign.legacyIndex).toBe(pack.legacyDeck.length);
});

test('the final score counts population on the grid only', () => {
	const { campaign } = mutable(late());
	const onGrid = grid(campaign);
	const expected = [...onGrid].reduce((sum, id) => sum + campaign.locations[id]!.population, 0);
	expect(score(campaign).population).toBe(expected);
	const off = pack.cities.find(entry => !onGrid.has(entry.id))!;
	Object.assign(campaign.locations[off.id]!, { revealed: true, population: 5 });
	expect(score(campaign).population).toBe(expected);
});

test('free ability units are spent at setup on abilities only, and what is left is lost once the supplies go out', () => {
	const save = octoberSave();
	save.world.campaign.freeAbilityUnits = 2;
	save.world.campaign.abilitiesForSale = ['scout'];
	const actor = createGameActor({ seed: 3, save }).start();
	const cast = Object.values(worldOf(actor).campaign.characters).slice(0, 3);
	actor.send({
		type: 'START_GAME',
		seating: cast.map((entry, index) => ({ seat: [A, B, C][index]!, character: entry.id })),
	});
	expect(phase(actor)).toBe('setup.supply');
	const onGrid = [...grid(worldOf(actor).campaign)];
	expect(
		reject(worldOf(actor), phase(actor), {
			type: 'PURCHASE',
			purchase: { t: 'population', city: onGrid[5]!, steps: 1 },
		}),
	).toBe('Not in the spending step');
	send(actor, { type: 'PURCHASE', purchase: { t: 'ability', ability: 'scout', character: cast[2]!.id, slot: 3 } });
	expect(worldOf(actor).campaign.characters[cast[2]!.id]!.slots[3]).toEqual({ kind: 'ability', id: 'scout' });
	expect(worldOf(actor).campaign.freeAbilityUnits).toBe(0);

	const unspent = createGameActor({ seed: 3, save: { ...save, world: { ...save.world } } }).start();
	unspent.send({
		type: 'START_GAME',
		seating: cast.map((entry, index) => ({ seat: [A, B, C][index]!, character: entry.id })),
	});
	send(unspent, { type: 'AUTO_SUPPLY' });
	send(unspent, { type: 'CONFIRM_SUPPLY' });
	expect(worldOf(unspent).campaign.freeAbilityUnits).toBe(0);
});

test('Utopia forced open at December setup puts its Infection cards in the discard pile', () => {
	const world = mutable(late());
	world.campaign.forced.push('package:8');
	world.campaign.attempt = 1;
	setupInfection(world);
	const cards = infectionCards(world, 'utopia', 9);
	expect(cards.length).toBeGreaterThan(0);
	for (const card of cards) {
		expect(world.game!.infectionDeck.order).not.toContain(card);
		expect(world.game!.infectionDiscard).toContain(card);
	}
});

test('Triangulate needs towers in blue, yellow and black, and a red tower does not stand in', () => {
	const scene = (third: string) =>
		late((world, game) => {
			world.campaign.objectives = ['triangulate'];
			world.campaign.required = 1;
			for (const location of Object.values(game.locations)) location.tower = false;
			game.locations[city('london')]!.tower = true;
			game.locations[city('lagos')]!.tower = true;
			game.players[A]!.location = city(third);
			game.players[A]!.supplies = 2;
		});
	const red = scene('shanghai');
	act(red, { a: 'buildTower' });
	expect(gameOf(red).progress.triangulate).toBe(2);
	expect(gameOf(red).outcome).toBeNull();
	const black = scene('cairo');
	act(black, { a: 'buildTower' });
	expect(gameOf(black).completed).toContain('triangulate');
	expect(worldOf(black).campaign.opened).toContain('door:35');
});

test('a lost early attempt carries completed objectives and Plan steps, not partial progress', () => {
	const world = mutable(late());
	const { campaign } = world;
	const game = world.game!;
	campaign.month = 10;
	campaign.attempt = 1;
	game.outcome = { won: false, reason: 'test' };
	game.upkeep = { units: 0, populationChanges: [], bought: [], done: [] };
	game.completed = ['reconEastAsia'];
	game.progress = { reconEastAsia: 1, defect: 2, plan: 2 };
	closeGame(world);
	expect(campaign.attempt as number).toBe(2);
	expect(campaign.carriedProgress).toEqual({ reconEastAsia: 1, plan: 2 });
});

test('a recon objective for a region already reconned counts as complete', () => {
	const save = octoberSave();
	const { campaign } = save.world;
	campaign.objectives = ['buildCenters', 'reconRegion'];
	campaign.required = 2;
	expect(campaign.opened).toContain('package:1');
	const actor = createGameActor({ seed: 3, save }).start();
	const cast = Object.values(worldOf(actor).campaign.characters).slice(0, 3);
	actor.send({
		type: 'START_GAME',
		seating: cast.map((entry, index) => ({ seat: [A, B, C][index]!, character: entry.id })),
	});
	expect(gameOf(actor).waived).toEqual([]);
	expect(gameOf(actor).completed).toEqual(['reconRegion']);
	const world = JSON.parse(JSON.stringify(worldOf(actor))) as World;
	world.campaign.objectives = ['buildCenters', 'reconRegion'];
	world.game!.progress.buildCenters = 2;
	bump(world, 'buildCenters');
	expect(world.game!.outcome).toMatchObject({ won: true });
});

test('Data Transfer offers every pair of cards, not only the first in each hand', () => {
	const actor = late(world => {
		give(world, A, cityCards(world, 'cairo', 2));
		give(world, B, [...cityCards(world, 'lagos', 2), ...cityCards(world, 'london')]);
		conjure(world, A, { kind: 'event', event: 'cardSwap' });
	});
	const swaps = legalPlays(worldOf(actor), 'playing.actions').filter(option => option.play.e === 'cardSwap');
	expect(swaps).toHaveLength(2 * 3);
});

test('an Epidemic waits for a Resilient Population holder before the discard pile is reshuffled', () => {
	let card = '' as CardId;
	const actor = late((world, game) => {
		card = conjure(world, B, { kind: 'event', event: 'resilience' });
		const epidemic = Object.values(world.campaign.playerCards).find(entry => entry.kind === 'epidemic')!.id;
		give(world, A, [epidemic]);
		game.players[A]!.hand = game.players[A]!.hand.filter(id => id !== epidemic);
		game.playerDeck.order.unshift(epidemic);
		game.playerDeck.piles = [{ size: game.playerDeck.order.length, epidemics: 1 }];
		game.drawsLeft = 2;
	}, 'playing.draw');
	send(actor, { type: 'DRAW' });
	send(actor, { type: 'DECIDE', decide: { d: 'skip' } });
	send(actor, { type: 'DECIDE', decide: { d: 'skip' } });
	const struck = gameOf(actor).infectionDiscard.at(-1)!;
	expect(gameOf(actor).pending[0]).toEqual({ t: 'intensify' });
	expect(reject(worldOf(actor), phase(actor), { type: 'DRAW' })).not.toBeNull();
	send(actor, { type: 'PLAY', seat: B, card, play: { e: 'resilience', cards: [struck] } });
	expect(gameOf(actor).pending).toEqual([]);
	expect(gameOf(actor).infectionDiscard).toEqual([]);
	expect(gameOf(actor).gameEndArea).toContain(struck);
	expect(gameOf(actor).infectionDeck.order).not.toContain(struck);
});

test('passing on that pause reshuffles the discard pile onto the deck', () => {
	const actor = late((world, game) => {
		conjure(world, B, { kind: 'event', event: 'resilience' });
		game.infectionDiscard = game.infectionDeck.order.splice(0, 3);
		game.infectionDeck.strata = [game.infectionDeck.order.toSorted()];
		game.pending = [{ t: 'intensify' }];
	});
	const waiting = [...gameOf(actor).infectionDiscard];
	send(actor, { type: 'DECIDE', decide: { d: 'skip' } });
	expect(gameOf(actor).infectionDiscard).toEqual([]);
	expect(gameOf(actor).infectionDeck.order.slice(0, 3).toSorted()).toEqual(waiting.toSorted());
});

test('cubes can be delivered, picked up and transferred in any number, not only one or all', () => {
	const actor = late((_, game) => {
		game.players[A]!.supplies = 3;
		game.players[B]!.supplies = 2;
		game.players[B]!.location = game.players[A]!.location;
		game.locations[game.players[A]!.location]!.supplies = 3;
	});
	const offered = legalActions(worldOf(actor), A);
	const counts = (pick: (action: Action) => number | null) => offered.flatMap(action => pick(action) ?? []).toSorted();
	expect(counts(action => (action.a === 'deliver' && !action.to ? action.count : null))).toEqual([1, 2, 3]);
	expect(counts(action => (action.a === 'pickUp' ? action.count : null))).toEqual([1, 2, 3]);
	expect(counts(action => (action.a === 'transfer' && action.give && action.with === B ? action.count : null))).toEqual(
		[1, 2, 3],
	);
	expect(
		counts(action => (action.a === 'transfer' && !action.give && action.with === B ? action.count : null)),
	).toEqual([1, 2]);
});

test('a supply center build offers each set of cards that wastes none, so the player picks what to keep', () => {
	const actor = late((world, game) => {
		game.players[A]!.location = city('cairo');
		game.locations[city('cairo')]!.center = false;
		give(world, A, [
			...cityCards(world, 'cairo', 2),
			...cityCards(world, 'tripoli', 2),
			...cityCards(world, 'istanbul', 2),
		]);
	});
	const builds = legalActions(worldOf(actor), A).filter(action => action.a === 'buildCenter');
	const kept = builds.map(action => {
		const paid = new Set(action.a === 'buildCenter' ? action.cards : []);
		const left = gameOf(actor).players[A]!.hand.find(card => !paid.has(card))!;
		const card = worldOf(actor).campaign.playerCards[left]!;
		return card.kind === 'city' ? card.city : '';
	});
	expect(kept.toSorted() as string[]).toEqual(['cairo', 'istanbul', 'tripoli']);
	for (const build of builds) expect(refuses(actor, build)).toBeNull();
});

test('Resilient Population can set aside two discarded Infection cards of one city', () => {
	const actor = late((world, game) => {
		conjure(world, A, { kind: 'event', event: 'resilience' });
		const wanted = infectionCards(world, 'cairo', 2);
		game.infectionDeck.order = game.infectionDeck.order.filter(card => !wanted.includes(card));
		game.infectionDeck.strata = [game.infectionDeck.order.toSorted()];
		game.infectionDiscard = [...wanted, ...infectionCards(world, 'lagos', 1)];
	});
	const world = worldOf(actor);
	const cairo = infectionCards(world, 'cairo', 2);
	const pairs = legalPlays(world, 'playing.actions').filter(
		option => option.play.e === 'resilience' && option.play.cards.length === 2,
	);
	expect(pairs.map(option => (option.play.e === 'resilience' ? option.play.cards : []))).toEqual([cairo]);
	send(actor, { type: 'PLAY', ...pairs[0]! });
	expect(gameOf(actor).gameEndArea).toEqual(expect.arrayContaining(cairo));
	expect(gameOf(actor).infectionDiscard).toHaveLength(1);
});

test('setup says how many cubes are left when a placement asks for more', () => {
	const save = octoberSave();
	const actor = createGameActor({ seed: 3, save }).start();
	const cast = Object.values(worldOf(actor).campaign.characters).slice(0, 3);
	actor.send({
		type: 'START_GAME',
		seating: cast.map((entry, index) => ({ seat: [A, B, C][index]!, character: entry.id })),
	});
	const left = gameOf(actor).stockpile;
	const target = [...grid(worldOf(actor).campaign)][3]!;
	expect(reject(worldOf(actor), phase(actor), { type: 'PLACE_SUPPLY', city: target, count: left + 1 })).toBe(
		`Only ${left} cubes are left to place`,
	);
});

test('infection odds leave out forsaken cities, whose cards are set aside and replaced', () => {
	const actor = late(world => {
		if (!world.campaign.rules.includes('forsaken')) world.campaign.rules.push('forsaken');
		world.campaign.locations[city('cairo')]!.population = 0;
		stackInfection(world, ['cairo', 'lagos', 'london']);
	});
	const odds = insights(worldOf(actor))!.infection.odds;
	expect(odds[city('cairo')]).toBeUndefined();
	expect(odds[city('lagos')]).toBe(1);
	expect(odds[city('london')]).toBe(1);
});

test('a Courier may deliver any number of cubes to a neighbouring city', () => {
	const actor = late((world, game) => {
		character(world, A).slots[1] = { kind: 'ability', id: 'courier' };
		game.players[A]!.supplies = 3;
	});
	const next = legalActions(worldOf(actor), A).flatMap(action => (action.a === 'deliver' && action.to ? [action] : []));
	const first = next[0]!.to;
	expect(
		next
			.filter(action => action.to === first)
			.map(action => action.count)
			.toSorted(),
	).toEqual([1, 2, 3]);
});

test("Open Waters charts a free lane from the active player's port, each port offered once", () => {
	let card = '' as CardId;
	const actor = late(world => {
		card = conjure(world, B, { kind: 'event', event: 'openWaters' });
		const port = pack.candidateEdges.find(
			edge => edge.kind === 'sea' && checkEdge(world.campaign, edge.a, edge.b, 'sea', true) === null,
		)!;
		world.game!.players[A]!.location = port.a;
	});
	const here = gameOf(actor).players[A]!.location;
	const targets = legalPlays(worldOf(actor), 'playing.actions').flatMap(option =>
		option.play.e === 'openWaters' ? [option.play.to] : [],
	);
	expect(targets.length).toBeGreaterThan(0);
	expect(new Set(targets).size).toBe(targets.length);
	send(actor, { type: 'PLAY', seat: B, card, play: { e: 'openWaters', to: targets[0]! } });
	expect(hasEdge(worldOf(actor).campaign, here, targets[0]!)).toBe(true);
});

test('the Sanitation Officer may discard any two cards to salvage, not only the first two', () => {
	const actor = late((world, game) => {
		character(world, A).job = 'sanitationOfficer';
		give(world, A, [
			...cityCards(world, 'cairo', 1),
			...cityCards(world, 'lagos', 1),
			...cityCards(world, 'london', 1),
		]);
		game.playerDiscard.push(...cityCards(world, 'tripoli', 1));
		game.playerDeck.order = game.playerDeck.order.filter(card => !game.playerDiscard.includes(card));
		game.playerDeck.piles = [{ size: game.playerDeck.order.length, epidemics: 0 }];
	});
	const pairs = legalActions(worldOf(actor), A).flatMap(action =>
		action.a === 'salvage' ? [action.discard.toSorted().join('+')] : [],
	);
	expect(new Set(pairs).size).toBe(3);
});

test('the Captain and the Runner may discard any City card, not only the first in hand', () => {
	const actor = late((world, game) => {
		character(world, A).job = 'captain';
		character(world, A).slots[1] = { kind: 'ability', id: 'runner' };
		give(world, A, [...cityCards(world, 'cairo', 1), ...cityCards(world, 'lagos', 1)]);
		game.players[A]!.location = city('haven-mediterranean');
	});
	const offered = legalActions(worldOf(actor), A);
	const cards = (kind: 'captainSail' | 'run') =>
		new Set(offered.flatMap(action => (action.a === kind ? [action.card] : []))).size;
	expect(cards('captainSail')).toBe(2);
	expect(cards('run')).toBe(2);
});

describe('drawing connections: what a line may not cross', () => {
	const fresh = () => newCampaign(4);
	const reveal = (campaign: World['campaign'], ids: string[]) => {
		for (const id of ids) campaign.locations[city(id)]!.revealed = true;
	};

	test('a supply line may not run over water: the generated pairs leave out lines that would', () => {
		for (const [a, b] of [
			['istanbul', 'lagos'],
			['jacksonville', 'buenos-aires'],
			['jacksonville', 'san-francisco'],
			['kinshasa', 'antananarivo'],
		])
			expect(isCandidate(city(a!), city(b!), 'land')).toBe(false);
		for (const [a, b] of [
			['washington', 'chicago'],
			['cairo', 'khartoum'],
			['sao-paulo', 'buenos-aires'],
		])
			expect(isCandidate(city(a!), city(b!), 'land')).toBe(true);
	});

	test('a supply line may not cross unexplored map, and may once that ground is revealed', () => {
		const campaign = fresh();
		expect(passage(city('cairo'), city('lagos'), 'land').through as string[]).toContain('khartoum');
		expect(checkEdge(campaign, city('cairo'), city('lagos'), 'land')).toBe('It would cross unexplored map');
		reveal(campaign, passage(city('cairo'), city('lagos'), 'land').through);
		expect(checkEdge(campaign, city('cairo'), city('lagos'), 'land')).toBeNull();
	});

	test('a supply line may not cross another supply line, and may share a city with one', () => {
		const campaign = fresh();
		reveal(
			campaign,
			pack.cities.map(entry => entry.id),
		);
		campaign.edges.push({ a: city('cairo'), b: city('lagos'), kind: 'land' });
		expect(checkEdge(campaign, city('tripoli'), city('khartoum'), 'land')).toBe('It would cross another supply line');
		expect(checkEdge(campaign, city('cairo'), city('khartoum'), 'land')).toBeNull();
	});

	test('a supply line may not end at a haven or pass over another city', () => {
		const campaign = fresh();
		reveal(
			campaign,
			pack.cities.map(entry => entry.id),
		);
		expect(checkEdge(campaign, city('lagos'), city('haven-north-atlantic'), 'land')).toBe('Supply lines join cities');
		expect(checkEdge(campaign, city('cairo'), city('dar-es-salaam'), 'land')).toContain('No land route');
	});

	test('a sea lane may not cross another sea lane', () => {
		const campaign = fresh();
		expect(isCandidate(city('washington'), city('lagos'), 'sea')).toBe(true);
		expect(checkEdge(campaign, city('washington'), city('lagos'), 'sea')).toBe('It would cross another sea lane');
		const crossed = (edge: { a: string; b: string }) =>
			segmentsCross(
				pack.positions[city('washington')]!,
				pack.positions[city('lagos')]!,
				pack.positions[city(edge.a)]!,
				pack.positions[city(edge.b)]!,
			);
		campaign.edges = campaign.edges.filter(edge => !crossed(edge));
		expect(checkEdge(campaign, city('washington'), city('lagos'), 'sea')).toBeNull();
	});

	test('a sea lane may cross one printed red line, and Expeditionary Voyage lifts only that limit', () => {
		const campaign = fresh();
		reveal(
			campaign,
			pack.cities.map(entry => entry.id),
		);
		// Land lines put the two ports on the grid without adding any sea lane to cross.
		campaign.edges.push(
			{ a: city('lagos'), b: city('dar-es-salaam'), kind: 'land' },
			{ a: city('lagos'), b: city('bangkok'), kind: 'land' },
		);
		// Door 65's line runs down the Somali coast, between Dar es Salaam and the Indian Ocean haven.
		expect(passage(city('dar-es-salaam'), city('haven-indian-ocean'), 'sea').redLines).toBe(1);
		expect(checkEdge(campaign, city('dar-es-salaam'), city('haven-indian-ocean'), 'sea')).toBeNull();
		// Bangkok to the Coral Sea crosses door 63's diagonal and door 59's line north of the haven.
		expect(passage(city('bangkok'), city('haven-coral-sea'), 'sea').redLines).toBe(2);
		expect(checkEdge(campaign, city('bangkok'), city('haven-coral-sea'), 'sea')).toBe(
			'A sea lane may cross only one red line',
		);
		expect(checkEdge(campaign, city('bangkok'), city('haven-coral-sea'), 'sea', true)).toBeNull();
	});

	test('a lane round Cape Horn crosses the Drake Passage line printed on the board', () => {
		expect(passage(city('lima'), city('lagos'), 'sea').redLines).toBe(1);
	});

	test('a sea lane may not cross unexplored map either', () => {
		const campaign = fresh();
		campaign.locations[city('antananarivo')]!.revealed = true;
		expect(checkEdge(campaign, city('lagos'), city('antananarivo'), 'sea')).toBe('It would cross unexplored map');
	});

	test('no supply line crosses Central Asia, which no map sticker ever covers', () => {
		const campaign = fresh();
		reveal(
			campaign,
			pack.cities.map(entry => entry.id),
		);
		campaign.edges.push({ a: city('istanbul'), b: city('moscow'), kind: 'land' });
		expect(checkEdge(campaign, city('moscow'), city('delhi'), 'land')).toBe('It would cross unexplored map');
		expect(checkEdge(campaign, city('moscow'), city('tehran'), 'land')).not.toBe('It would cross unexplored map');
	});

	test('the Bay of Bengal stays dark until South East Asia is revealed, as the printed board leaves it', () => {
		const campaign = fresh();
		reveal(
			campaign,
			pack.cities.filter(entry => entry.region !== 'east-asia').map(entry => entry.id),
		);
		campaign.edges.push({ a: city('lagos'), b: city('antananarivo'), kind: 'land' });
		expect(checkEdge(campaign, city('antananarivo'), city('kolkata'), 'sea')).toBe('It would cross unexplored map');
		reveal(campaign, ['jakarta']);
		expect(checkEdge(campaign, city('antananarivo'), city('kolkata'), 'sea')).toBeNull();
	});

	test('every city can still be joined to something', () => {
		for (const entry of pack.cities)
			expect(pack.candidateEdges.some(edge => edge.a === entry.id || edge.b === entry.id)).toBe(true);
	});
});

test('a character cannot take a scar it already carries', () => {
	const actor = late((world, game) => {
		world.campaign.scars = ['smallHand', 'reconExtraCard'];
		character(world, A).slots[0] = { kind: 'scar', id: 'smallHand' };
		game.pending = [{ t: 'scar', seat: A }];
	});
	expect(
		reject(worldOf(actor), phase(actor), { type: 'DECIDE', decide: { d: 'scar', scar: 'smallHand', target: 1 } }),
	).toBe('This character already carries that scar');
	send(actor, { type: 'DECIDE', decide: { d: 'scar', scar: 'reconExtraCard', target: 1 } });
	expect(character(worldOf(actor), A).slots[1]).toEqual({ kind: 'scar', id: 'reconExtraCard' });
});

const epidemicOnTop = (world: World, game: World['game'] & object) => {
	const epidemic = Object.values(world.campaign.playerCards).find(entry => entry.kind === 'epidemic')!.id;
	game.playerDeck.order = [epidemic, ...game.playerDeck.order.filter(id => id !== epidemic)];
	game.playerDeck.piles = [{ size: game.playerDeck.order.length, epidemics: 1 }];
	game.drawsLeft = 2;
};
const improve = (world: World, id: string, improvement: 'wellStocked' | 'lockdown') => {
	const card = world.campaign.infectionCards[infectionCards(world, id)[0]!]!;
	if (card.kind === 'city') card.improvement = improvement;
	return card.id;
};
const onBottom = (game: World['game'] & object, card: CardId) => {
	game.infectionDeck.order = [...game.infectionDeck.order.filter(id => id !== card), card];
	game.infectionDeck.strata = [game.infectionDeck.order.toSorted()];
	game.infectionDiscard = game.infectionDiscard.filter(id => id !== card);
};

test('a draw that cannot be made loses the game', () => {
	const actor = late((_, game) => {
		game.playerDeck.order = game.playerDeck.order.slice(0, 1);
		game.playerDeck.piles = [{ size: 1, epidemics: 0 }];
		game.drawsLeft = 2;
	}, 'playing.draw');
	send(actor, { type: 'DRAW' });
	actor.send({ type: 'DRAW' });
	expect(gameOf(actor).outcome).toEqual({ won: false, reason: 'The Player deck ran out' });
});

test('Cautious Approach and Monitor need 4 Player cards left to reveal', () => {
	const actor = late((world, game) => {
		conjure(world, A, { kind: 'event', event: 'scavenge' });
		game.locations[game.players[A]!.location]!.tower = true;
		game.playerDeck.order = game.playerDeck.order.slice(0, 3);
		game.playerDeck.piles = [{ size: 3, epidemics: 0 }];
	});
	expect(legalPlays(worldOf(actor), 'playing.actions').some(option => option.play.e === 'scavenge')).toBe(false);
	expect(refuses(actor, { a: 'monitor', frequency: 0 })).toBe('Fewer than 4 Player cards are left');
});

test('an Epidemic respects the improvement on the card it strikes with', () => {
	const actor = late((world, game) => {
		epidemicOnTop(world, game);
		onBottom(game, improve(world, 'cairo', 'wellStocked'));
		game.locations[city('cairo')]!.supplies = 3;
	}, 'playing.draw');
	send(actor, { type: 'DRAW' });
	send(actor, { type: 'DECIDE', decide: { d: 'skip' } });
	send(actor, { type: 'DECIDE', decide: { d: 'skip' } });
	expect(gameOf(actor).locations[city('cairo')]!.supplies).toBe(3);
});

test('an Epidemic waits before the reshuffle when a Lockdown card is in the discard pile', () => {
	let card = '' as CardId;
	const actor = late((world, game) => {
		epidemicOnTop(world, game);
		card = improve(world, 'cairo', 'lockdown');
		onBottom(game, card);
		give(world, B, cityCards(world, 'tokyo', 1));
	}, 'playing.draw');
	send(actor, { type: 'DRAW' });
	send(actor, { type: 'DECIDE', decide: { d: 'skip' } });
	send(actor, { type: 'DECIDE', decide: { d: 'skip' } });
	expect(gameOf(actor).pending[0]).toEqual({ t: 'intensify' });
	const seat = gameOf(actor).seats.find(other => gameOf(actor).players[other]!.hand.length > 0)!;
	send(actor, { type: 'LOCKDOWN', card, seat, pay: gameOf(actor).players[seat]!.hand[0]! });
	expect(worldOf(actor).campaign.infectionCards[card]).toBeUndefined();
	send(actor, { type: 'DECIDE', decide: { d: 'skip' } });
	expect(gameOf(actor).pending).toEqual([]);
});

test('no other Event may be played while a drawn card is still being resolved', () => {
	const actor = late((world, game) => {
		conjure(world, A, { kind: 'event', event: 'stockUp' });
		game.pending = [{ t: 'shield', city: city('cairo'), color: 'black' }];
	});
	const card = gameOf(actor).players[A]!.hand.at(-1)!;
	expect(reject(worldOf(actor), phase(actor), { type: 'PLAY', seat: A, card, play: { e: 'stockUp' } })).toBe(
		'Resolve the card that was just drawn first',
	);
});

test('the Carrier scar covers another scar only when no empty slot or ability is left', () => {
	const actor = late((world, game) => {
		if (!world.campaign.rules.includes('carrier')) world.campaign.rules.push('carrier');
		world.campaign.locations[pack.sampleFrom]!.revealed = true;
		game.players[A]!.location = pack.sampleFrom;
		Object.assign(character(world, A), { exposureTrack: ['scar', 'empty', 'skull'], exposure: 0 });
		character(world, A).slots = [
			{ kind: 'scar', id: 'smallHand' },
			{ kind: 'scar', id: 'reconExtraCard' },
			{ kind: 'scar', id: 'lineExtraCube' },
			null,
		];
	});
	act(actor, { a: 'selfInject' });
	const slots = character(worldOf(actor), A).slots;
	expect(slots[3]).toEqual({ kind: 'scar', id: 'carrier' });
	expect(slots.filter(slot => slot?.id === 'carrier')).toHaveLength(2);
	expect(slots.filter(slot => slot?.kind === 'scar' && slot.id !== 'carrier')).toHaveLength(2);
});

test('a city emptied by a fourth Hollow Man is infested at once', () => {
	const world = JSON.parse(JSON.stringify(worldOf(late()))) as World;
	if (!world.campaign.rules.includes('forsaken')) world.campaign.rules.push('forsaken');
	Object.assign(world.campaign.locations[city('cairo')]!, { population: 1, infested: false });
	world.game!.locations[city('cairo')]!.hollow = 3;
	placeHollow(world, city('cairo'), infectionCards(world, 'cairo')[0]!);
	expect(world.campaign.locations[city('cairo')]).toMatchObject({ population: 0, infested: true });
});

test('Monitor keeps only cards it revealed, never an older discard', () => {
	const actor = late((world, game) => {
		game.locations[game.players[A]!.location]!.tower = true;
		const old = cityCards(world, 'london', 1);
		give(world, B, old);
		game.players[B]!.hand = [];
		game.playerDiscard = old;
		const epidemics = Object.values(world.campaign.playerCards)
			.filter(entry => entry.kind === 'epidemic')
			.map(entry => entry.id);
		game.playerDeck.order = [...epidemics.slice(0, 4), ...game.playerDeck.order.filter(id => !epidemics.includes(id))];
		game.playerDeck.piles = [{ size: game.playerDeck.order.length, epidemics: 4 }];
	});
	const frequency = pack.frequencies.findIndex(reward => reward && 'take' in reward);
	act(actor, { a: 'monitor', frequency });
	showReveals(actor);
	expect(gameOf(actor).players[A]!.hand).toEqual([]);
	expect(gameOf(actor).playerDiscard).toContain(cityCards(worldOf(actor), 'london', 1)[0]!);
});

test('the hand limit waits until both cards of the draw are in hand', () => {
	const actor = late((world, game) => {
		give(world, A, [
			...cityCards(world, 'cairo', 2),
			...cityCards(world, 'lagos', 2),
			...cityCards(world, 'london', 2),
			...cityCards(world, 'tripoli', 2),
		]);
		game.drawsLeft = 1;
	}, 'playing.draw');
	const card = gameOf(actor).players[A]!.hand[0]!;
	expect(
		reject(worldOf(actor), phase(actor), { type: 'DECIDE', decide: { d: 'discard', seat: A, cards: [card] } }),
	).toBe('Draw both cards first');
});

test('a game needs 2 to 4 seats, and a haven worker only when no living character is free', () => {
	const save = octoberSave();
	const actor = createGameActor({ seed: 3, save }).start();
	const cast = Object.values(worldOf(actor).campaign.characters).filter(entry => !entry.dead && !entry.worker);
	const start = (seating: { seat: typeof A; character: (typeof cast)[number]['id'] | null }[]) =>
		reject(worldOf(actor), phase(actor), { type: 'START_GAME', seating });
	expect(start([{ seat: A, character: cast[0]!.id }])).toBe('Seat 2 to 4 players');
	expect(
		start([
			{ seat: A, character: cast[0]!.id },
			{ seat: B, character: null },
		]),
	).toBe('A living character is still free');
	expect(
		start([
			{ seat: A, character: cast[0]!.id },
			{ seat: B, character: cast[1]!.id },
		]),
	).toBeNull();
});

test('population is bought in whole steps', () => {
	const actor = late((_, game) => {
		game.outcome = { won: false, reason: 'test' };
		game.upkeep = { units: 5, populationChanges: [], bought: [], done: [] };
	}, 'upkeep');
	const target = [...grid(worldOf(actor).campaign)].find(id => worldOf(actor).campaign.locations[id]!.population < 6)!;
	expect(
		reject(worldOf(actor), phase(actor), {
			type: 'PURCHASE',
			purchase: { t: 'population', city: target, steps: 1.5 },
		}),
	).toBe('Population is bought in whole steps');
});

test('a game result records who played', () => {
	const world = JSON.parse(JSON.stringify(worldOf(late()))) as World;
	const game = world.game!;
	game.outcome = { won: true, reason: 'test' };
	game.upkeep = { units: 0, populationChanges: [], bought: [], done: [] };
	const seated = game.seats.map(seat => game.players[seat]!.character);
	closeGame(world);
	expect(world.campaign.results.at(-1)!.characters).toEqual(seated);
});

const atSample = (slots: Character['slots'], track: Character['exposureTrack']) =>
	late((world, game) => {
		if (!world.campaign.rules.includes('carrier')) world.campaign.rules.push('carrier');
		world.campaign.locations[pack.sampleFrom]!.revealed = true;
		game.players[A]!.location = pack.sampleFrom;
		Object.assign(character(world, A), { slots, exposureTrack: track, exposure: 0 });
	});

test('the Carrier scar covers empty slots before it covers an ability', () => {
	const actor = atSample(
		[{ kind: 'ability', id: 'helmsman' }, null, { kind: 'ability', id: 'foreman' }, null],
		['scar', 'empty', 'empty', 'empty', 'empty', 'empty', 'skull'],
	);
	act(actor, { a: 'selfInject' });
	expect(character(worldOf(actor), A).slots).toEqual([
		{ kind: 'ability', id: 'helmsman' },
		{ kind: 'scar', id: 'carrier' },
		{ kind: 'ability', id: 'foreman' },
		{ kind: 'scar', id: 'carrier' },
	]);
});

test('taking the sample scratches exposure boxes until a scar appears', () => {
	const actor = atSample([null, null, null, null], ['empty', 'empty', 'scar', 'empty', 'empty', 'empty', 'skull']);
	act(actor, { a: 'selfInject' });
	expect(character(worldOf(actor), A)).toMatchObject({ exposure: 3, carrier: true });
});

test('the carrier may pay to enter a city with any card of its colour', () => {
	const actor = late((world, game) => {
		character(world, A).carrier = true;
		game.players[A]!.location = city('tripoli');
		give(world, A, [...cityCards(world, 'tripoli', 1), ...cityCards(world, 'istanbul', 1)]);
	});
	const drives = legalActions(worldOf(actor), A).flatMap(action =>
		action.a === 'drive' && action.to === city('cairo') ? [action.card] : [],
	);
	expect(drives.toSorted()).toEqual([...gameOf(actor).players[A]!.hand].toSorted());
});

describe('counting aids', () => {
	test("a city's player cards are counted where they are: deck, hands or discard", () => {
		let held = 0;
		const actor = late((world, game) => {
			const cards = cityCards(world, 'cairo', 9);
			give(world, A, cards);
			held = cards.length - 1;
			game.playerDiscard.push(game.players[A]!.hand.pop()!);
		});
		const cards = insights(worldOf(actor))!.playerDeck.cities;
		expect(held).toBeGreaterThan(0);
		expect(cards[city('cairo')]).toEqual({ inDeck: 0, inHands: held, discarded: 1 });
	});
});

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
	setUp(actor);
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
		passTurn(actor);
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
		send(actor, { type: 'DECIDE', decide: { d: 'skip' } });
		send(actor, { type: 'DECIDE', decide: { d: 'skip' } });
		send(actor, { type: 'DECIDE', decide: { d: 'skip' } });
		const after = gameOf(actor);
		expect(after.rateIndex).toBe(before.rateIndex + 1);
		expect(after.locations[bottomCity]).toMatchObject({ supplies: 0, plague: 0 });
		expect(after.infectionDiscard).toEqual([]);
		expect(after.infectionDeck.strata[0]).toHaveLength(2);
		expect(after.infectionDeck.order.slice(0, 2).toSorted()).toEqual(after.infectionDeck.strata[0]!);
	});

	test('a Hollow Men card is a flip of its own that leaves no Event window and puts a figure on the next city flipped instead of infecting it, and leaving them costs an exposure', () => {
		let quiet = '' as CardId;
		const actor = january((world, game) => {
			const id = 'gather#900' as CardId;
			world.campaign.infectionCards[id] = { id, kind: 'gather' };
			stackInfection(world, ['cairo']);
			game.infectionDeck.order.unshift(id);
			game.infectionDeck.strata[0]!.push(id);
			game.infectionsLeft = 1;
			quiet = conjure(world, B, { kind: 'event', event: 'quietNight' });
		}, 'playing.infect');
		const play = { type: 'PLAY', seat: B, card: quiet, play: { e: 'quietNight' } } as const;
		expect(reject(worldOf(actor), 'playing.infect', play)).toBeNull();
		send(actor, { type: 'INFECT' });
		expect(gameOf(actor)).toMatchObject({ gathering: true, infectionsLeft: 1 });
		expect(gameOf(actor).locations[city('cairo')]).toMatchObject({ supplies: 2, hollow: 0 });
		expect(reject(worldOf(actor), 'playing.infect', play)).not.toBeNull();
		send(actor, { type: 'INFECT' });
		expect(gameOf(actor)).toMatchObject({ gathering: false, infectionsLeft: 0 });
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
		passTurn(actor);
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
		send(actor, { type: 'FINISH_UPKEEP', player: 'host' as PlayerId, done: true });
		expect(worldOf(actor).campaign).toMatchObject({ month: 1, attempt: 2, rationing: 6 });
		expect(worldOf(actor).campaign.locations[city('cairo')]!.population).toBe(5);
		expect(worldOf(actor).game).toBeNull();
	});

	test('February forces North America open with no explorer reward when it was never reconned', () => {
		const actor = lost();
		send(actor, { type: 'FINISH_UPKEEP', player: 'host' as PlayerId, done: true });
		const seating = Object.values(worldOf(actor).campaign.characters).map((character, index) => ({
			seat: [A, B][index]!,
			character: character.id,
		}));
		send(actor, { type: 'START_GAME', seating });
		setUp(actor);
		const second = structuredClone(worldOf(actor));
		second.game!.outcome = { won: false, reason: 'test' };
		const next = createGameActor({ seed: 1, save: { v: 1, phase: 'over', world: second } }).start();
		send(next, { type: 'CONTINUE' });
		send(next, { type: 'FINISH_UPKEEP', player: 'host' as PlayerId, done: true });
		expect(worldOf(next).campaign.month).toBe(2);
		send(next, { type: 'START_GAME', seating });
		const { campaign } = worldOf(next);
		expect(campaign.forced).toContain('package:1');
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
			{ month: 1, attempt: 1, won: true, gridCities: 9, rationing: 4, characters: [] },
			{ month: 2, attempt: 1, won: false, gridCities: 9, rationing: 2, characters: [] },
			{ month: 2, attempt: 2, won: true, gridCities: 9, rationing: 4, characters: [] },
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
	setUp(actor);
	// A JSON round trip, as a save does: structuredClone would keep the restore copy aliased to the live campaign.
	const world = JSON.parse(JSON.stringify(worldOf(actor))) as World;
	world.game!.locations[city('london')]!.plague = 2;
	world.game!.outcome = { won: false, reason: 'test' };
	Object.values(world.campaign.characters)[0]!.exposure = 3;
	const ended = createGameActor({ seed: 1, save: { v: 1, phase: 'over', world } }).start();
	send(ended, { type: 'CONTINUE' });
	expect(gameOf(ended).upkeep).toEqual({ units: 0, populationChanges: [], bought: [], done: [] });
	send(ended, { type: 'FINISH_UPKEEP', player: 'host' as PlayerId, done: true });
	const after = worldOf(ended).campaign;
	expect(after.locations).toEqual(before.locations);
	expect(after.characters).toEqual(before.characters);
	expect(after).toMatchObject({ month: 0, rationing: before.rationing });
	expect(after.results).toHaveLength(1);
});

test('Resilient Population refuses the same card twice', () => {
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
	const seats = [A, B, C];
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

test('a plain save resumes mid-game in the same phase and keeps playing identically', () => {
	const original = createGameActor({ seed: 11 }).start();
	const rng = { seed: 5 };
	for (let i = 0; i < 60; i++)
		original.send(botCommand(original.getSnapshot().context.world, phaseOf(original.getSnapshot()), rng));
	const state = publicState(original.getSnapshot());
	expect(state.phase.startsWith('playing')).toBe(true);

	const save: Save = parseSave(JSON.parse(JSON.stringify({ v: 1, phase: state.phase, world: state.world })));
	const resumed = createGameActor({ seed: 999, save }).start();
	expect(phaseOf(resumed.getSnapshot())).toBe(state.phase);

	const rngA = { seed: 77 };
	const rngB = { seed: 77 };
	for (let i = 0; i < 80; i++) {
		original.send(botCommand(original.getSnapshot().context.world, phaseOf(original.getSnapshot()), rngA));
		resumed.send(botCommand(resumed.getSnapshot().context.world, phaseOf(resumed.getSnapshot()), rngB));
	}
	expect(resumed.getSnapshot().context.world).toEqual(original.getSnapshot().context.world);
	expect(() => parseSave({ phase: 'lobby' })).toThrow();
	const older = structuredClone(save) as { world: { table: Partial<World['table']> } };
	delete older.world.table.start;
	expect(() => parseSave(older)).toThrow('not a campaign save from this build');
});

describe('scars and the sticker pool', () => {
	const scarred = (world: World, seat: typeof A, id: ScarId) =>
		void (character(world, seat).slots[3] = { kind: 'scar', id });
	/** The turn of seat A ends with one Infection card, so seat B begins a turn. */
	const nextTurn = (edit: (world: World, game: Game) => void) => {
		const actor = late((world, game) => {
			stackInfection(world, ['lagos']);
			game.infectionsLeft = 1;
			edit(world, game);
		}, 'playing.infect');
		send(actor, { type: 'INFECT' });
		passTurn(actor);
		return actor;
	};

	test('a scar a character takes leaves the pool, and a sticker that is bought leaves the shop', () => {
		const actor = late((world, game) => {
			world.campaign.scars = ['smallHand', 'frail'];
			game.pending = [{ t: 'scar', seat: A }];
		});
		send(actor, { type: 'DECIDE', decide: { d: 'scar', scar: 'smallHand', target: 1 } });
		expect(worldOf(actor).campaign.scars).toEqual(['frail']);

		const shop = late(world => {
			world.campaign.month = 10;
			world.game!.outcome = { won: true, reason: 'test' };
			world.campaign.abilitiesForSale = ['architect', 'scout'];
		}, 'over');
		send(shop, { type: 'CONTINUE' });
		const buyer = Object.values(worldOf(shop).campaign.characters)[0]!.id;
		const purchase = { t: 'ability', ability: 'architect', character: buyer, slot: 1 } as const;
		send(shop, { type: 'PURCHASE', purchase });
		expect(worldOf(shop).campaign.abilitiesForSale).toEqual(['scout']);
		const second = Object.values(worldOf(shop).campaign.characters)[1]!.id;
		expect(reject(worldOf(shop), 'upkeep', { type: 'PURCHASE', purchase: { ...purchase, character: second } })).toBe(
			'That ability is not available yet',
		);
	});

	test('Wasteful: Make Supplies also moves a cube from the stockpile to the reserve', () => {
		const actor = late(world => {
			scarred(world, A, 'wasteful');
			world.campaign.rules = world.campaign.rules.filter(rule => rule !== 'labBreakthroughs');
		});
		const before = gameOf(actor);
		act(actor, { a: 'makeSupplies' });
		expect(gameOf(actor).stockpile).toBe(before.stockpile - 2);
		expect(gameOf(actor).reserve).toBe(before.reserve + 1);
	});

	test('Landsick and Squeamish each cost an action at the start of a turn', () => {
		const actor = nextTurn((world, game) => {
			scarred(world, B, 'portBound');
			character(world, B).slots[2] = { kind: 'scar', id: 'plagueShy' };
			game.players[B]!.location = city('chicago');
			game.locations[city('chicago')]!.plague = 1;
		});
		expect(gameOf(actor).active).toBe(B);
		expect(gameOf(actor).actionsLeft).toBe(pack.numbers.actionsPerTurn - 2);
	});

	test('Fixated: a turn that ends on an even hand costs a card', () => {
		const actor = nextTurn(world => {
			scarred(world, A, 'oddHand');
			give(world, A, cityCards(world, 'london', 2));
		});
		expect(gameOf(actor).pending).toContainEqual({ t: 'discard', seat: A, count: 1 });
	});

	test('Rattled: an Epidemic sends the cubes a character carries back to the stockpile', () => {
		const actor = late((world, game) => {
			scarred(world, B, 'rattled');
			game.players[B]!.supplies = 3;
			const epidemic = Object.values(world.campaign.playerCards).find(card => card.kind === 'epidemic')!.id;
			const rest = game.playerDeck.order.filter(id => id !== epidemic);
			game.playerDeck = { order: [epidemic, ...rest], piles: [{ size: rest.length + 1, epidemics: 1 }] };
			game.drawsLeft = 2;
		}, 'playing.draw');
		send(actor, { type: 'DRAW' });
		send(actor, { type: 'DECIDE', decide: { d: 'skip' } });
		expect(gameOf(actor).players[B]!.supplies).toBe(0);
	});

	test('Frail: a character carries at most 3 cubes, and the rest go back to the stockpile', () => {
		const actor = late((world, game) => {
			scarred(world, A, 'frail');
			game.players[A]!.supplies = 3;
		});
		const stockpile = gameOf(actor).stockpile;
		act(actor, { a: 'makeSupplies' });
		expect(gameOf(actor).players[A]!.supplies).toBe(3);
		expect(gameOf(actor).stockpile).toBe(stockpile);
	});

	test('Haunted: leaving a city that holds no cubes costs a card', () => {
		const actor = late((world, game) => {
			scarred(world, A, 'haunted');
			game.players[A]!.location = city('new-york');
			game.locations[city('new-york')]!.supplies = 0;
			give(world, A, cityCards(world, 'london', 1));
		});
		act(actor, { a: 'drive', to: city('washington') });
		expect(gameOf(actor).pending).toEqual([{ t: 'discard', seat: A, count: 1 }]);
	});

	test('Grasping: the last 2 cubes a character carries cannot be delivered', () => {
		const actor = late((world, game) => {
			scarred(world, A, 'grasping');
			game.players[A]!.supplies = 3;
		});
		expect(refuses(actor, { a: 'deliver', count: 2 })).toContain('last 2');
		expect(refuses(actor, { a: 'deliver', count: 1 })).toBeNull();
	});

	test('Exacting: a supply center needs 1 more card', () => {
		const actor = late((world, game) => {
			scarred(world, A, 'buildExtraCard');
			game.players[A]!.location = city('chicago');
			give(world, A, [...cityCards(world, 'new-york', 4), ...cityCards(world, 'washington', 2)]);
		});
		const hand = gameOf(actor).players[A]!.hand;
		expect(refuses(actor, { a: 'buildCenter', cards: hand.slice(0, 5) })).toContain('Needs 6');
		expect(refuses(actor, { a: 'buildCenter', cards: hand })).toBeNull();
	});

	test('Wary: a character carrying cubes will not leave a haven that holds none', () => {
		const actor = late((world, game) => {
			scarred(world, A, 'wary');
			const haven = city('haven-north-atlantic');
			game.players[A]!.location = haven;
			game.players[A]!.supplies = 1;
			game.locations[haven]!.supplies = 0;
		});
		expect(refuses(actor, { a: 'drive', to: city('new-york') })).toContain('haven');
		act(actor, { a: 'deliver', count: 1 });
		expect(refuses(actor, { a: 'drive', to: city('new-york') })).toBeNull();
	});

	test('Careless: the City card that was searched is discarded', () => {
		const actor = late((world, game) => {
			scarred(world, A, 'searchDiscard');
			game.players[A]!.location = city('chicago');
			give(world, A, cityCards(world, 'chicago', 1));
		});
		const card = gameOf(actor).players[A]!.hand[0]!;
		act(actor, { a: 'search', card, box: 0 });
		showReveals(actor);
		expect(gameOf(actor).players[A]!.hand).not.toContain(card);
		expect(gameOf(actor).playerDiscard).toContain(card);
	});
});

describe('card states, improvements and companion audit', () => {
	test('search City cards and Utopia cannot buy City Card Improvements, while a plain copy of the same city can', () => {
		const shop = late(world => {
			world.campaign.month = 8;
			world.game!.outcome = { won: true, reason: 'test' };
			world.campaign.cityImprovementsForSale = ['double', 'wild'];
			world.campaign.infectionImprovementsForSale = ['wellStocked'];
		}, 'over');
		send(shop, { type: 'CONTINUE' });
		const world = worldOf(shop);
		const denverCards = Object.values(world.campaign.playerCards).filter(
			card => card.kind === 'city' && card.city === city('denver'),
		);
		const searchCopy = denverCards.find(card => card.kind === 'city' && card.search.length > 0)!;
		const plainCopy = denverCards.find(card => card.kind === 'city' && card.search.length === 0)!;
		expect(
			reject(world, 'upkeep', {
				type: 'PURCHASE',
				purchase: { t: 'cityImprovement', improvement: 'double', card: searchCopy.id },
			}),
		).toBe('Search cards have no improvement slot');
		expect(
			reject(world, 'upkeep', {
				type: 'PURCHASE',
				purchase: { t: 'cityImprovement', improvement: 'double', card: plainCopy.id },
			}),
		).toBeNull();
		const utopia = Object.values(world.campaign.playerCards).find(
			card => card.kind === 'city' && card.city === city('utopia'),
		)!;
		expect(
			reject(world, 'upkeep', {
				type: 'PURCHASE',
				purchase: { t: 'cityImprovement', improvement: 'double', card: utopia.id },
			}),
		).toBe('Utopia cannot be improved');
	});

	test('tabletopSave holds all unrevealed East Asia and Utopia cards at base state 0 and passes invariants', () => {
		const save = tabletopSave();
		expect(violations(save.world, new Map())).toEqual([]);
		const unrevealed: CityId[] = [
			'jakarta',
			'bangkok',
			'ho-chi-minh-city',
			'manila',
			'hong-kong',
			'shanghai',
			'seoul',
			'tokyo',
			'osaka',
			'utopia',
		] as CityId[];
		for (const id of unrevealed) {
			const playerCards = Object.values(save.world.campaign.playerCards).filter(
				card => card.kind === 'city' && card.city === id,
			);
			const infCards = Object.values(save.world.campaign.infectionCards).filter(
				card => card.kind === 'city' && card.city === id,
			);
			expect(playerCards.length).toBeGreaterThan(0);
			expect(infCards.length).toBeGreaterThan(0);
			for (const card of playerCards) {
				if (card.kind !== 'city') continue;
				expect(card.improvement).toBeNull();
				expect(card.companion).toBeNull();
				expect(card.search.every(box => !box.scratched)).toBe(true);
			}
			for (const card of infCards) {
				if (card.kind !== 'city') continue;
				expect(card.improvement).toBeNull();
			}
		}
	});

	test('Exacting exposes the 6-card buildCenter option in legalActions', () => {
		const actor = late((world, game) => {
			character(world, A).slots[3] = { kind: 'scar', id: 'buildExtraCard' };
			game.players[A]!.location = city('chicago');
			give(world, A, [...cityCards(world, 'new-york', 4), ...cityCards(world, 'washington', 2)]);
		});
		const builds = legalActions(worldOf(actor), A).filter(action => action.a === 'buildCenter');
		expect(builds.length).toBeGreaterThan(0);
		expect(builds[0]!.a === 'buildCenter' && builds[0]!.cards.length).toBe(6);
	});

	test('Cautious Approach played by another player deals kept City cards to the active player', () => {
		let eventCard = '' as CardId;
		let keptCity = '' as CardId;
		let discardedEvent = '' as CardId;
		const actor = late((world, game) => {
			emptyHand(world, A);
			eventCard = conjure(world, B, { kind: 'event', event: 'scavenge' });
			keptCity = cityCards(world, 'london', 1)[0]!;
			const secondCity = cityCards(world, 'paris', 1)[0]!;
			const thirdCity = cityCards(world, 'cairo', 1)[0]!;
			discardedEvent = Object.values(world.campaign.playerCards).find(
				card => card.kind === 'event' && card.id !== eventCard,
			)!.id;
			const top4 = [keptCity, discardedEvent, secondCity, thirdCity];
			game.playerDeck.order = [...top4, ...game.playerDeck.order.filter(id => !top4.includes(id))];
			game.playerDeck.piles = [{ size: game.playerDeck.order.length, epidemics: 0 }];
		});
		send(actor, { type: 'PLAY', seat: B, card: eventCard, play: { e: 'scavenge' } });
		showReveals(actor);
		expect(gameOf(actor).players[A]!.hand).toContain(keptCity);
		expect(gameOf(actor).players[B]!.hand).not.toContain(keptCity);
		expect(gameOf(actor).playerDiscard).toContain(discardedEvent);
	});

	test('Portable Antiviral Lab only plays in actions and lets the Immunologist draw from reserve first', () => {
		let surplusCard = '' as CardId;
		const inDraw = late((world, game) => {
			surplusCard = conjure(world, A, { kind: 'event', event: 'surplus' });
			game.players[A]!.used.push('madeSupplies');
			game.drawsLeft = 2;
		}, 'playing.draw');
		expect(
			reject(worldOf(inDraw), 'playing.draw', { type: 'PLAY', seat: A, card: surplusCard, play: { e: 'surplus' } }),
		).toBe('Play it after you Make Supplies this turn');

		let labCard = '' as CardId;
		const imm = late((world, game) => {
			character(world, A).job = 'immunologist';
			character(world, A).jobScar = null;
			labCard = conjure(world, A, { kind: 'event', event: 'surplus' });
			game.players[A]!.used.push('madeSupplies');
			game.reserve = 2;
			game.stockpile = 5;
			game.players[A]!.supplies = 0;
		});
		send(imm, { type: 'PLAY', seat: A, card: labCard, play: { e: 'surplus' } });
		expect(gameOf(imm).players[A]!.supplies).toBe(3);
		expect(gameOf(imm).reserve).toBe(0);
		expect(gameOf(imm).stockpile).toBe(4);
	});

	test('Careless searching Moscow as the last card in hand clears the empty giveCard decision', () => {
		const actor = late((world, game) => {
			character(world, A).slots[3] = { kind: 'scar', id: 'searchDiscard' };
			game.players[A]!.location = city('moscow');
			give(world, A, cityCards(world, 'moscow', 1));
		});
		const moscow = gameOf(actor).players[A]!.hand[0]!;
		act(actor, { a: 'search', card: moscow, box: 0 });
		showReveals(actor);
		expect(gameOf(actor).players[A]!.hand).toEqual([]);
		expect(gameOf(actor).pending).toEqual([]);
	});

	test('Purge, Purifier and Marksman refuse cities off the grid', () => {
		let purgeCard = '' as CardId;
		let purifierCard = '' as CardId;
		let marksmanCard = '' as CardId;
		const actor = late((world, game) => {
			purgeCard = conjure(world, A, { kind: 'event', event: 'purge' });
			purifierCard = conjure(world, A, { kind: 'companion', companion: 'purifier' });
			marksmanCard = conjure(world, A, { kind: 'companion', companion: 'marksman' });
			world.campaign.edges = world.campaign.edges.filter(
				edge => edge.a !== city('santiago') && edge.b !== city('santiago'),
			);
			game.locations[city('santiago')]!.plague = 2;
			game.locations[city('santiago')]!.hollow = 1;
		});
		expect(
			reject(worldOf(actor), 'playing.actions', {
				type: 'PLAY',
				seat: A,
				card: purgeCard,
				play: { e: 'purge', city: city('santiago') },
			}),
		).toBe('Pick a location on the grid with Plague cubes');
		expect(
			reject(worldOf(actor), 'playing.actions', {
				type: 'PLAY',
				seat: A,
				card: purifierCard,
				play: { e: 'purifier', city: city('santiago') },
			}),
		).toBe('Pick a location on the grid with Plague cubes');
		expect(
			reject(worldOf(actor), 'playing.actions', {
				type: 'PLAY',
				seat: A,
				card: marksmanCard,
				play: { e: 'marksman', city: city('santiago') },
			}),
		).toBe('Pick a location on the grid with Hollow Men');
	});

	test('playable companions discard for reuse across the campaign while unrationed events are permanently destroyed', () => {
		let healer = '' as CardId;
		let unrationed = '' as CardId;
		const actor = late((world, game) => {
			game.players[A]!.location = city('london');
			game.locations[city('london')]!.plague = 2;
			healer = conjure(world, A, { kind: 'companion', companion: 'medic' });
			unrationed = conjure(world, A, { kind: 'event', event: 'purge' });
			const eventCard = world.campaign.playerCards[unrationed];
			if (eventCard?.kind === 'event') eventCard.mode = 'unrationed';
		});
		send(actor, { type: 'PLAY', seat: A, card: healer, play: { e: 'medic' } });
		expect(gameOf(actor).playerDiscard).toContain(healer);
		expect(worldOf(actor).campaign.playerCards[healer]).toBeDefined();

		send(actor, { type: 'PLAY', seat: A, card: unrationed, play: { e: 'purge', city: city('london') } });
		expect(gameOf(actor).playerDiscard).not.toContain(unrationed);
		expect(worldOf(actor).campaign.playerCards[unrationed]).toBeUndefined();
	});
});
