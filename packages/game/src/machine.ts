import { produce } from 'immer';
import { assign, createActor, setup } from 'xstate';
import type { SnapshotFrom } from 'xstate';
import type { Action } from './actions';
import { actionReveals, applyAction, checkAction } from './actions';
import { pack } from './content/pack';
import { retiredStartingEdges } from './content/world';
import type { JobId, ObjectiveId } from './content/types';
import {
	checkWin,
	createGame,
	drawPlayerCard,
	endTurn,
	infectStep,
	isOver,
	setupInfection,
	setupPlayerDeck,
	startDrawStep,
	startInfectStep,
} from './flow';
import { cityDef, grid, hasEdge, isForsaken, log, overLimit, SEAT_IDS, tableSeating } from './helpers';
import { edgeKey } from './ids';
import type { CardId, CharacterId, CityId, SeatId } from './ids';
import type { Purchase } from './legacy';
import {
	applyPurchase,
	checkPurchase,
	closeGame,
	createCharacter,
	newCampaign,
	readLegacy,
	resolveGameEnd,
} from './legacy';
import type { Decide, Play } from './plays';
import { applyDecide, applyPlay, autoResolve, checkDecide, checkPlay } from './plays';
import type { World } from './state';

export type Seating = { seat: SeatId; character: CharacterId | null };

export type Command =
	| { type: 'CREATE_CHARACTER'; name: string; job: JobId; home: CityId }
	| { type: 'SET_RATIONING'; value: number }
	| { type: 'RENAME_HAVEN'; city: CityId; name: string }
	/** Leaves the prologue, which may be played any number of times, and starts January. */
	| { type: 'BEGIN_CAMPAIGN' }
	/** Puts a character or a haven worker in a seat for the next game, or empties the seat. Every player sees the same seats. */
	| { type: 'SEAT'; seat: SeatId; choice: CharacterId | 'worker' | null }
	| { type: 'START_GAME'; seating: Seating[] }
	| { type: 'ACK_BRIEFING' }
	| { type: 'PLACE_SUPPLY'; city: CityId; count: number }
	| { type: 'AUTO_SUPPLY' }
	| { type: 'CONFIRM_SUPPLY' }
	| { type: 'PICK_EVENTS'; cards: CardId[] }
	| { type: 'CONFIRM_EVENTS' }
	| { type: 'ACTION'; seat: SeatId; action: Action }
	| { type: 'END_ACTIONS'; seat: SeatId }
	| { type: 'DRAW' }
	| { type: 'INFECT' }
	| { type: 'PLAY'; seat: SeatId; card: CardId; play: Play }
	| { type: 'DECIDE'; decide: Decide }
	| { type: 'LOCKDOWN'; card: CardId }
	/** The group's call that an objective cannot be completed any more, so the rest decide the game. */
	| { type: 'WAIVE_OBJECTIVE'; objective: ObjectiveId }
	| { type: 'UNDO' }
	| { type: 'CONTINUE' }
	| { type: 'PURCHASE'; purchase: Purchase }
	| { type: 'FINISH_UPKEEP' };

export type Phase =
	| 'lobby'
	| 'setup.supply'
	| 'setup.events'
	| 'playing.actions'
	| 'playing.draw'
	| 'playing.infect'
	| 'over'
	| 'upkeep'
	| 'finished';

type Context = { world: World; undo: World[] };
type Of<T extends Command['type']> = Extract<Command, { type: T }>;

const blocked = (world: World) => world.game!.pending.length > 0 || overLimit(world).length > 0;

function rationedEvents(world: World): CardId[] {
	return Object.values(world.campaign.playerCards)
		.filter(
			card => card.kind === 'event' && card.mode === 'rationed' && !world.campaign.stored.player.includes(card.id),
		)
		.map(card => card.id);
}

const eventsToPick = (world: World) => Math.min(world.campaign.rationing, rationedEvents(world).length);

/** Null when the command is legal in this phase, otherwise the reason shown to the player. */
export function reject(world: World, phase: Phase, command: Command): string | null {
	const { campaign, game } = world;
	const inPhase = (...phases: Phase[]) => (phases.includes(phase) ? null : 'Not available right now');
	switch (command.type) {
		case 'CREATE_CHARACTER': {
			const job = pack.jobs.find(candidate => candidate.id === command.job);
			const home = pack.cities.find(candidate => candidate.id === command.home);
			if (!job?.starting) return 'Pick a starting job';
			if (Object.values(campaign.characters).some(character => character.job === command.job))
				return 'That job is taken';
			if (home?.kind !== 'haven' || home.lost) return 'Pick a starting haven as home';
			return command.name.trim() ? inPhase('lobby') : 'Give the character a name';
		}
		case 'SET_RATIONING':
			return Number.isInteger(command.value) && command.value >= 0 && command.value <= 10
				? inPhase('lobby')
				: 'Rationing runs from 0 to 10';
		case 'RENAME_HAVEN': {
			const haven = pack.cities.find(candidate => candidate.id === command.city);
			if (haven?.kind !== 'haven' || !campaign.locations[command.city]?.revealed) return 'Pick a haven on the board';
			return command.name.trim().length > 0 && command.name.length <= 24
				? inPhase('lobby')
				: 'Names run from 1 to 24 characters';
		}
		case 'BEGIN_CAMPAIGN':
			return campaign.month === 0 ? inPhase('lobby') : 'The campaign has already begun';
		case 'SEAT': {
			if (!SEAT_IDS.includes(command.seat)) return 'No such seat';
			const character = command.choice && command.choice !== 'worker' ? campaign.characters[command.choice] : undefined;
			if (command.choice && command.choice !== 'worker' && (!character || character.dead || character.worker))
				return 'Pick a living character';
			return inPhase('lobby');
		}
		case 'START_GAME': {
			const picked = command.seating.map(entry => entry.character).filter(id => id !== null);
			if (command.seating.length < 2 || command.seating.length > 4) return 'Seat 2 to 4 players';
			if (
				new Set(command.seating.map(entry => entry.seat)).size !== command.seating.length ||
				new Set(picked).size !== picked.length
			)
				return 'Each seat needs its own character';
			const alive = picked.every(
				id => campaign.characters[id] && !campaign.characters[id].dead && !campaign.characters[id].worker,
			);
			if (!alive) return 'Pick living characters';
			// A haven worker fills a seat only when every living character is already playing.
			const spare = Object.values(campaign.characters).some(
				character => !character.dead && !character.worker && !picked.includes(character.id),
			);
			if (spare && command.seating.some(entry => entry.character === null)) return 'A living character is still free';
			return inPhase('lobby');
		}
		case 'ACK_BRIEFING':
			return null;
		case 'PLACE_SUPPLY': {
			if (!game || !grid(campaign).has(command.city) || !Number.isInteger(command.count) || command.count === 0)
				return 'Pick a location on the grid';
			const fits =
				command.count > 0 ? command.count <= game.stockpile : -command.count <= game.locations[command.city]!.supplies;
			if (fits) return inPhase('setup.supply');
			return command.count > 0
				? `Only ${game.stockpile} cube${game.stockpile === 1 ? ' is' : 's are'} left to place`
				: 'That location does not hold that many cubes';
		}
		case 'AUTO_SUPPLY':
			return inPhase('setup.supply');
		case 'CONFIRM_SUPPLY':
			return game?.stockpile === 0 ? inPhase('setup.supply') : 'Place every cube first';
		case 'PICK_EVENTS': {
			const available = rationedEvents(world);
			const valid =
				new Set(command.cards).size === command.cards.length && command.cards.every(card => available.includes(card));
			return valid && command.cards.length === eventsToPick(world)
				? inPhase('setup.events')
				: `Pick ${eventsToPick(world)} Rationed Events`;
		}
		case 'CONFIRM_EVENTS':
			return inPhase('setup.events');
		case 'ACTION':
			return inPhase('playing.actions') ?? checkAction(world, command.seat, command.action);
		case 'END_ACTIONS':
			if (command.seat !== game?.active) return 'Not your turn';
			return blocked(world) ? 'Resolve the pending choice first' : inPhase('playing.actions');
		case 'DRAW':
			// The hand limit waits until both cards are drawn, so only a pending choice holds up the second draw.
			return game!.pending.length > 0 || game!.drawsLeft === 0
				? 'Resolve the pending choice first'
				: inPhase('playing.draw');
		case 'INFECT':
			return blocked(world) || game!.infectionsLeft === 0
				? 'Resolve the pending choice first'
				: inPhase('playing.infect');
		case 'PLAY':
			return (
				inPhase('playing.actions', 'playing.draw', 'playing.infect') ??
				checkPlay(world, command.seat, command.card, command.play, phase)
			);
		case 'DECIDE':
			return inPhase('playing.actions', 'playing.draw', 'playing.infect') ?? checkDecide(world, command.decide);
		case 'LOCKDOWN': {
			const card = campaign.infectionCards[command.card];
			const armed =
				game?.infectionDiscard.includes(command.card) && card?.kind === 'city' && card.improvement === 'lockdown';
			return armed ? inPhase('playing.actions', 'playing.draw', 'playing.infect') : 'That card cannot be destroyed';
		}
		case 'WAIVE_OBJECTIVE': {
			const live =
				campaign.objectives.includes(command.objective) &&
				!game?.completed.includes(command.objective) &&
				!game?.waived.includes(command.objective);
			if (!live) return 'That objective is not open';
			return campaign.objectives.length - game!.waived.length > 1
				? inPhase('playing.actions', 'playing.draw', 'playing.infect')
				: 'The last objective cannot be waived';
		}
		case 'UNDO':
			return inPhase('playing.actions');
		case 'CONTINUE':
			return inPhase('over');
		case 'PURCHASE':
			return inPhase('upkeep', 'setup.supply') ?? checkPurchase(world, command.purchase);
		case 'FINISH_UPKEEP':
			return inPhase('upkeep');
	}
}

type Args = { context: Context; event: Command };

const change =
	(recipe: (world: World, event: Command) => void) =>
	({ context, event }: Args): Context => ({
		world: produce(context.world, draft => {
			recipe(draft, event);
			autoResolve(draft);
		}),
		undo: [],
	});

/** Cubes go where infection can strike: cities in proportion to how many Infection cards name them. Havens get none. */
function autoSupply(world: World) {
	const game = world.game!;
	const onGrid = grid(world.campaign);
	const stored = new Set(world.campaign.stored.infection);
	const weight = new Map<CityId, number>();
	for (const card of Object.values(world.campaign.infectionCards)) {
		if (card.kind === 'city' && onGrid.has(card.city) && !stored.has(card.id) && !isForsaken(world.campaign, card.city))
			weight.set(card.city, (weight.get(card.city) ?? 0) + 1);
	}
	// With every city forsaken nothing can be infected, and the cubes still have to go somewhere.
	if (weight.size === 0) for (const location of onGrid) weight.set(location, 1);
	const targets = [...weight.keys()].sort((a, b) => weight.get(b)! - weight.get(a)! || a.localeCompare(b));
	// Each pass gives a cube to every city still below its share, so the first cube everywhere comes before any second.
	for (let level = 1; game.stockpile > 0; level++) {
		for (const city of targets) {
			if (game.stockpile === 0) break;
			if (game.locations[city]!.supplies < Math.min(level, weight.get(city)! + level - 1)) {
				game.locations[city]!.supplies += 1;
				game.stockpile -= 1;
			}
		}
	}
}

/** Commands open in every step of a turn. Each step passes its own phase, because a few of them depend on it. */
const anyStep = (phase: Phase) =>
	({
		PLAY: { guard: { type: 'legal', params: phase }, actions: 'play' },
		DECIDE: { guard: { type: 'legal', params: phase }, actions: 'decide' },
		LOCKDOWN: { guard: { type: 'legal', params: phase }, actions: 'lockdown' },
		WAIVE_OBJECTIVE: { guard: { type: 'legal', params: phase }, actions: 'waive' },
	}) as const;

export const gameMachine = setup({
	types: {
		context: {} as Context,
		events: {} as Command,
		input: {} as { seed: number } | { world: World },
	},
	guards: {
		legal: ({ context, event }: Args, phase: Phase) => reject(context.world, phase, event) === null,
		canUndo: ({ context }: Args) => context.undo.length > 0,
		over: ({ context }: Args) => isOver(context.world),
		drawsDone: ({ context }: Args) =>
			!isOver(context.world) && context.world.game!.drawsLeft === 0 && !blocked(context.world),
		infectionsDone: ({ context }: Args) =>
			!isOver(context.world) && context.world.game!.infectionsLeft === 0 && !blocked(context.world),
		campaignEnding: ({ context }: Args) => {
			const { campaign, game } = context.world;
			return campaign.month === 12 && (campaign.attempt === 2 || game?.outcome?.won === true);
		},
	},
	actions: {
		createCharacter: assign(
			change((world, event) => {
				const { campaign } = world;
				const created = createCharacter(campaign, event as Of<'CREATE_CHARACTER'>);
				// A new character takes the first empty seat, so a new group is seated as it is created.
				const taken = tableSeating(campaign);
				const free = SEAT_IDS.find(seat => !taken.some(entry => entry.seat === seat));
				if (free) campaign.seating = [...taken, { seat: free, character: created.id }];
			}),
		),
		seat: assign(
			change((world, event) => {
				const { seat, choice } = event as Of<'SEAT'>;
				const character = choice === 'worker' ? null : choice;
				const others = tableSeating(world.campaign).filter(
					entry => entry.seat !== seat && (character === null || entry.character !== character),
				);
				world.campaign.seating = choice === null ? others : [...others, { seat, character }];
			}),
		),
		setRationing: assign(
			change((world, event) => void (world.campaign.rationing = (event as Of<'SET_RATIONING'>).value)),
		),
		renameHaven: assign(
			change((world, event) => {
				const { city, name } = event as Of<'RENAME_HAVEN'>;
				world.campaign.names[city] = name.trim();
			}),
		),
		beginCampaign: assign(change(world => void (world.campaign.month = 1))),
		ackBriefing: assign(({ context }: Args) => ({
			world: produce(context.world, draft => void (draft.campaign.briefing = [])),
		})),
		startGame: assign(
			change((world, event) => {
				const home = pack.cities.find(candidate => candidate.kind === 'haven' && !candidate.lost)!.id;
				readLegacy(world, 'setup');
				world.campaign.seating = (event as Of<'START_GAME'>).seating.map(entry => ({ ...entry }));
				const seating = (event as Of<'START_GAME'>).seating.map(({ seat, character }) => ({
					seat,
					character:
						character ?? createCharacter(world.campaign, { name: 'Haven worker', job: null, home, worker: true }).id,
				}));
				createGame(world, seating);
			}),
		),
		placeSupply: assign(
			change((world, event) => {
				const { city, count } = event as Of<'PLACE_SUPPLY'>;
				world.game!.locations[city]!.supplies += count;
				world.game!.stockpile -= count;
			}),
		),
		autoSupply: assign(change(autoSupply)),
		confirmSupply: assign(
			change(world => {
				setupInfection(world);
				world.game!.pickedEvents = rationedEvents(world).slice(0, eventsToPick(world));
			}),
		),
		pickEvents: assign(change((world, event) => void (world.game!.pickedEvents = (event as Of<'PICK_EVENTS'>).cards))),
		confirmEvents: assign(change(setupPlayerDeck)),
		act: assign(({ context, event }: Args) => {
			const { seat, action } = event as Of<'ACTION'>;
			return {
				world: produce(context.world, draft => {
					applyAction(draft, seat, action);
					autoResolve(draft);
				}),
				undo: actionReveals(action) ? [] : [...context.undo, context.world],
			};
		}),
		undo: assign(({ context }: Args) => ({ world: context.undo.at(-1)!, undo: context.undo.slice(0, -1) })),
		startDraw: assign(change(startDrawStep)),
		draw: assign(change(drawPlayerCard)),
		startInfect: assign(change(startInfectStep)),
		infect: assign(change(infectStep)),
		endTurn: assign(change(endTurn)),
		play: assign(
			change((world, event) => {
				const { seat, card, play } = event as Of<'PLAY'>;
				applyPlay(world, seat, card, play);
			}),
		),
		decide: assign(change((world, event) => applyDecide(world, (event as Of<'DECIDE'>).decide))),
		lockdown: assign(
			change((world, event) => {
				const { card } = event as Of<'LOCKDOWN'>;
				const destroyed = world.campaign.infectionCards[card]!;
				world.game!.infectionDiscard.splice(world.game!.infectionDiscard.indexOf(card), 1);
				delete world.campaign.infectionCards[card];
				if (destroyed.kind === 'city')
					log(world.game!, {
						t: 'note',
						text: `Lockdown destroyed an Infection card of ${cityDef(destroyed.city).name} for good`,
					});
			}),
		),
		waive: assign(
			change((world, event) => {
				world.game!.waived.push((event as Of<'WAIVE_OBJECTIVE'>).objective);
				checkWin(world);
			}),
		),
		resolveGameEnd: assign(change(resolveGameEnd)),
		purchase: assign(change((world, event) => applyPurchase(world, (event as Of<'PURCHASE'>).purchase))),
		closeGame: assign(change(closeGame)),
	},
}).createMachine({
	id: 'game',
	context: ({ input }) => ({
		world: 'world' in input ? input.world : { campaign: newCampaign(input.seed), game: null },
		undo: [],
	}),
	initial: 'lobby',
	on: { ACK_BRIEFING: { actions: 'ackBriefing' } },
	states: {
		lobby: {
			on: {
				CREATE_CHARACTER: { guard: { type: 'legal', params: 'lobby' }, actions: 'createCharacter' },
				SET_RATIONING: { guard: { type: 'legal', params: 'lobby' }, actions: 'setRationing' },
				BEGIN_CAMPAIGN: { guard: { type: 'legal', params: 'lobby' }, actions: 'beginCampaign' },
				RENAME_HAVEN: { guard: { type: 'legal', params: 'lobby' }, actions: 'renameHaven' },
				SEAT: { guard: { type: 'legal', params: 'lobby' }, actions: 'seat' },
				START_GAME: { guard: { type: 'legal', params: 'lobby' }, target: 'setup', actions: 'startGame' },
			},
		},
		setup: {
			initial: 'supply',
			always: { guard: 'over', target: 'over' },
			states: {
				supply: {
					on: {
						PLACE_SUPPLY: { guard: { type: 'legal', params: 'setup.supply' }, actions: 'placeSupply' },
						AUTO_SUPPLY: { guard: { type: 'legal', params: 'setup.supply' }, actions: 'autoSupply' },
						PURCHASE: { guard: { type: 'legal', params: 'setup.supply' }, actions: 'purchase' },
						CONFIRM_SUPPLY: {
							guard: { type: 'legal', params: 'setup.supply' },
							target: 'events',
							actions: 'confirmSupply',
						},
					},
				},
				events: {
					on: {
						PICK_EVENTS: { guard: { type: 'legal', params: 'setup.events' }, actions: 'pickEvents' },
						CONFIRM_EVENTS: {
							guard: { type: 'legal', params: 'setup.events' },
							target: '#game.playing',
							actions: 'confirmEvents',
						},
					},
				},
			},
		},
		playing: {
			initial: 'actions',
			always: { guard: 'over', target: 'over' },
			states: {
				actions: {
					on: {
						...anyStep('playing.actions'),
						ACTION: { guard: { type: 'legal', params: 'playing.actions' }, actions: 'act' },
						UNDO: { guard: 'canUndo', actions: 'undo' },
						END_ACTIONS: { guard: { type: 'legal', params: 'playing.actions' }, target: 'draw', actions: 'startDraw' },
					},
				},
				draw: {
					always: { guard: 'drawsDone', target: 'infect', actions: 'startInfect' },
					on: {
						...anyStep('playing.draw'),
						DRAW: { guard: { type: 'legal', params: 'playing.draw' }, actions: 'draw' },
					},
				},
				infect: {
					always: { guard: 'infectionsDone', target: 'actions', actions: 'endTurn' },
					on: {
						...anyStep('playing.infect'),
						INFECT: { guard: { type: 'legal', params: 'playing.infect' }, actions: 'infect' },
					},
				},
			},
		},
		over: { on: { CONTINUE: { target: 'upkeep', actions: 'resolveGameEnd' } } },
		upkeep: {
			on: {
				PURCHASE: { guard: { type: 'legal', params: 'upkeep' }, actions: 'purchase' },
				FINISH_UPKEEP: [
					{ guard: 'campaignEnding', target: 'finished', actions: 'closeGame' },
					{ target: 'lobby', actions: 'closeGame' },
				],
			},
		},
		finished: {},
	},
});

export type GameSnapshot = SnapshotFrom<typeof gameMachine>;

export function phaseOf(snapshot: GameSnapshot): Phase {
	const value = snapshot.value;
	if (typeof value === 'string') return value as Phase;
	const [parent, child] = Object.entries(value)[0]!;
	return `${parent}.${child as string}` as Phase;
}

export type Save = { v: 1; phase: Phase; world: World };

function phaseValue(phase: Phase) {
	const [parent, child] = phase.split('.');
	return child ? { [parent!]: child } : parent!;
}

/** Starts a new campaign from a seed, or resumes one from a plain `{ phase, world }` save. */
export function createGameActor(options: { seed: number; save?: Save | null }) {
	const input = { seed: options.seed };
	if (!options.save) return createActor(gameMachine, { input });
	const snapshot = gameMachine.resolveState({
		value: phaseValue(options.save.phase) as never,
		context: { world: options.save.world, undo: [] },
	});
	return createActor(gameMachine, { snapshot, input });
}

export type GameActor = ReturnType<typeof createGameActor>;

const GAME_DEFAULTS = {
	waived: [],
	pending: [],
	pickedEvents: [],
	connectedThisGame: [],
	gameEndArea: [],
	centersBuilt: 0,
	searches: 0,
	skipInfection: false,
	upkeep: null,
	prologueRestore: null,
} satisfies Partial<NonNullable<World['game']>>;

/**
 * Reads a save and fills in whatever the game has gained since it was written, so a campaign begun
 * on an older build keeps loading. A field the save lacks takes the value a new campaign starts with.
 */
export function parseSave(raw: unknown): Save {
	const save = raw as Partial<Save> | null;
	if (save?.v !== 1 || typeof save.phase !== 'string' || !save.world?.campaign)
		throw new Error('That is not a campaign save');
	const fresh = newCampaign(0);
	const campaign = { ...fresh, ...save.world.campaign };
	campaign.results = campaign.results.map(result => ({ ...result, characters: result.characters ?? [] }));
	campaign.locations = { ...fresh.locations, ...campaign.locations };
	// No rule removes a lane, so a campaign that lacks one of today's starting lanes began on an older board.
	const missing = pack.edges.filter(edge => !hasEdge(campaign, edge.a, edge.b));
	if (missing.length) {
		const retired = new Set(retiredStartingEdges.map(edge => edgeKey(edge.a, edge.b)));
		// Today's lanes go first, so a lane drawn later stays at the end of the list, where a step's new lanes are read.
		campaign.edges = [
			...missing.map(edge => ({ ...edge })),
			...campaign.edges.filter(edge => !(edge.kind === 'sea' && retired.has(edgeKey(edge.a, edge.b)))),
		];
	}
	campaign.characters = Object.fromEntries(
		Object.entries(campaign.characters).map(([id, character]) => [id, Object.assign({ jobScar: null }, character)]),
	);
	const saved = save.world.game;
	const game = saved ? { ...GAME_DEFAULTS, ...saved, locations: { ...blankLocations(), ...saved.locations } } : null;
	return { v: 1, phase: save.phase, world: { campaign, game } };
}

function blankLocations() {
	return Object.fromEntries(
		pack.cities.map(city => [
			city.id,
			{ supplies: 0, plague: 0, hollow: 0, center: false, tower: false, shelter: false },
		]),
	);
}
