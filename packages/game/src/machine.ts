import { produce } from 'immer';
import { assign, createActor, setup } from 'xstate';
import type { SnapshotFrom } from 'xstate';
import type { Action } from './actions';
import { actionReveals, applyAction, checkAction } from './actions';
import { pack } from './content/pack';
import type { JobId } from './content/types';
import {
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
import { grid, overLimit } from './helpers';
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
	/** Leaves the prologue, which may be played any number of times, and starts January. */
	| { type: 'BEGIN_CAMPAIGN' }
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
		case 'BEGIN_CAMPAIGN':
			return campaign.month === 0 ? inPhase('lobby') : 'The campaign has already begun';
		case 'START_GAME': {
			const picked = command.seating.map(entry => entry.character).filter(id => id !== null);
			if (command.seating.length < 1 || command.seating.length > 4) return 'Seat 1 to 4 players';
			if (
				new Set(command.seating.map(entry => entry.seat)).size !== command.seating.length ||
				new Set(picked).size !== picked.length
			)
				return 'Each seat needs its own character';
			const alive = picked.every(
				id => campaign.characters[id] && !campaign.characters[id].dead && !campaign.characters[id].worker,
			);
			return alive ? inPhase('lobby') : 'Pick living characters';
		}
		case 'ACK_BRIEFING':
			return null;
		case 'PLACE_SUPPLY': {
			if (!game || !grid(campaign).has(command.city) || !Number.isInteger(command.count) || command.count === 0)
				return 'Pick a location on the grid';
			const fits =
				command.count > 0 ? command.count <= game.stockpile : -command.count <= game.locations[command.city]!.supplies;
			return fits ? inPhase('setup.supply') : 'Not that many cubes';
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
			return blocked(world) || game!.drawsLeft === 0 ? 'Resolve the pending choice first' : inPhase('playing.draw');
		case 'INFECT':
			return blocked(world) || game!.infectionsLeft === 0
				? 'Resolve the pending choice first'
				: inPhase('playing.infect');
		case 'PLAY':
			return (
				inPhase('playing.actions', 'playing.draw', 'playing.infect') ??
				checkPlay(world, command.seat, command.card, command.play)
			);
		case 'DECIDE':
			return inPhase('playing.actions', 'playing.draw', 'playing.infect') ?? checkDecide(world, command.decide);
		case 'LOCKDOWN': {
			const card = campaign.infectionCards[command.card];
			const armed =
				game?.infectionDiscard.includes(command.card) && card?.kind === 'city' && card.improvement === 'lockdown';
			return armed ? inPhase('playing.actions', 'playing.draw', 'playing.infect') : 'That card cannot be destroyed';
		}
		case 'UNDO':
			return inPhase('playing.actions');
		case 'CONTINUE':
			return inPhase('over');
		case 'PURCHASE':
			return inPhase('upkeep') ?? checkPurchase(world, command.purchase);
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

function autoSupply(world: World) {
	const game = world.game!;
	const targets = [...grid(world.campaign)].sort(
		(a, b) => world.campaign.locations[b]!.population - world.campaign.locations[a]!.population || a.localeCompare(b),
	);
	for (let index = 0; game.stockpile > 0; index++) {
		game.locations[targets[index % targets.length]!]!.supplies += 1;
		game.stockpile -= 1;
	}
}

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
			change((world, event) => void createCharacter(world.campaign, event as Of<'CREATE_CHARACTER'>)),
		),
		setRationing: assign(
			change((world, event) => void (world.campaign.rationing = (event as Of<'SET_RATIONING'>).value)),
		),
		beginCampaign: assign(change(world => void (world.campaign.month = 1))),
		ackBriefing: assign(({ context }: Args) => ({
			world: produce(context.world, draft => void (draft.campaign.briefing = [])),
		})),
		startGame: assign(
			change((world, event) => {
				const home = pack.cities.find(candidate => candidate.kind === 'haven' && !candidate.lost)!.id;
				readLegacy(world, 'setup');
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
				world.game!.infectionDiscard.splice(world.game!.infectionDiscard.indexOf(card), 1);
				delete world.campaign.infectionCards[card];
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
			on: {
				PLAY: { guard: { type: 'legal', params: 'playing.actions' }, actions: 'play' },
				DECIDE: { guard: { type: 'legal', params: 'playing.actions' }, actions: 'decide' },
				LOCKDOWN: { guard: { type: 'legal', params: 'playing.actions' }, actions: 'lockdown' },
			},
			states: {
				actions: {
					on: {
						ACTION: { guard: { type: 'legal', params: 'playing.actions' }, actions: 'act' },
						UNDO: { guard: 'canUndo', actions: 'undo' },
						END_ACTIONS: { guard: { type: 'legal', params: 'playing.actions' }, target: 'draw', actions: 'startDraw' },
					},
				},
				draw: {
					always: { guard: 'drawsDone', target: 'infect', actions: 'startInfect' },
					on: { DRAW: { guard: { type: 'legal', params: 'playing.draw' }, actions: 'draw' } },
				},
				infect: {
					always: { guard: 'infectionsDone', target: 'actions', actions: 'endTurn' },
					on: { INFECT: { guard: { type: 'legal', params: 'playing.infect' }, actions: 'infect' } },
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

export function parseSave(raw: unknown): Save {
	const save = raw as Partial<Save> | null;
	if (save?.v !== 1 || typeof save.phase !== 'string' || !save.world?.campaign)
		throw new Error('That is not a campaign save');
	return save as Save;
}
