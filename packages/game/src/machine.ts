import { produce } from 'immer';
import { and, assign, createActor, setup } from 'xstate';
import type { SnapshotFrom } from 'xstate';
import type { Action } from './actions';
import { actionReveals, applyAction, checkAction } from './actions';
import { pack } from './content/pack';
import type { JobId, ObjectiveId } from './content/types';
import {
	checkWin,
	createGame,
	drawPlayerCard,
	endTurn,
	infectStep,
	isOver,
	openingInfectStep,
	setupInfection,
	setupPlayerDeck,
	startDrawStep,
	startInfectStep,
} from './flow';
import { cityDef, discardFromHand, grid, hasEdge, isForsaken, log, overLimit, SEAT_IDS, tableSeating } from './helpers';
import { edgeKey } from './ids';
import type { CardId, CharacterId, CityId, PlayerId, SeatId } from './ids';
import type { Purchase } from './legacy';
import {
	applyPurchase,
	checkPurchase,
	checkRefund,
	closeGame,
	createCharacter,
	newCampaign,
	readLegacy,
	refundPurchase,
	resolveGameEnd,
} from './legacy';
import type { Decide, Play } from './plays';
import { applyDecide, applyPlay, autoResolve, checkDecide, checkPlay, playReveals } from './plays';
import type { UndoSubject, World } from './state';
import type { TableCommand } from './table';
import {
	applyTable,
	claimCharacter,
	dealTable,
	newTable,
	newTableBriefing,
	readyStart,
	rejectTable,
	tablePlayers,
	tableStart,
} from './table';

export type Seating = { seat: SeatId; character: CharacterId | null };

export type Command =
	/** Makes a character, taken by `player` for the next game when one is named. */
	| { type: 'CREATE_CHARACTER'; name: string; job: JobId; home: CityId; portrait?: number; player?: PlayerId }
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
	/** The player whose turn it is passes it on, once every Infection card of the turn is flipped. */
	| { type: 'END_TURN'; seat: SeatId }
	| { type: 'PLAY'; seat: SeatId; card: CardId; play: Play }
	| { type: 'DECIDE'; decide: Decide }
	/** Destroying a Lockdown card costs whoever does it a Player card from their hand. */
	| { type: 'LOCKDOWN'; card: CardId; seat: SeatId; pay: CardId }
	/** The group's call that an objective cannot be completed any more, so the rest decide the game. */
	| { type: 'WAIVE_OBJECTIVE'; objective: ObjectiveId }
	| { type: 'UNDO'; by?: PlayerId }
	| { type: 'CONTINUE' }
	| { type: 'PURCHASE'; purchase: Purchase }
	/** Gives back the purchase at this place in the spending step's list. */
	| { type: 'REFUND'; index: number }
	/** A player's vote that the table is done spending. The game closes once everyone at the table has voted. */
	| { type: 'FINISH_UPKEEP'; player: PlayerId; done: boolean }
	| TableCommand;

export type Phase =
	| 'lobby'
	| 'setup.supply'
	| 'setup.infect'
	| 'setup.events'
	| 'playing.actions'
	| 'playing.draw'
	| 'playing.infect'
	| 'over'
	| 'upkeep'
	| 'finished';

export type UndoEntry = { world: World; seat: SeatId; subject: UndoSubject; reveals: boolean };
type Context = { world: World; undo: UndoEntry[] };
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
		case 'JOIN':
		case 'ADD_SEAT':
		case 'TAKE_SEAT':
		case 'LEAVE':
		case 'READY':
		case 'CLAIM':
		case 'BRIEFING_STEP':
		case 'BRIEFING_READY':
			return phase === 'finished' &&
				command.type !== 'LEAVE' &&
				command.type !== 'BRIEFING_STEP' &&
				command.type !== 'BRIEFING_READY'
				? 'The campaign is over'
				: rejectTable(world, phase === 'lobby', command);
		case 'UNDO_VOTE':
		case 'CANCEL_UNDO_VOTE':
			return inPhase('playing.actions') ?? rejectTable(world, false, command);
		case 'CREATE_CHARACTER': {
			const job = pack.jobs.find(candidate => candidate.id === command.job);
			const home = pack.cities.find(candidate => candidate.id === command.home);
			const found = campaign.jobsFound.find(entry => entry.job === command.job);
			if (!job || (!job.starting && !found)) return 'Pick a starting job or one the group has found';
			if (campaign.characterCards.length === 0) return 'Every Character card is in use';
			if (Object.values(campaign.characters).some(character => character.job === command.job))
				return 'That job is taken';
			if (found && !job.starting) {
				if (command.home !== found.home) return `${job.name} lives at ${cityDef(found.home).name}`;
			} else if (home?.kind !== 'haven' || home.lost) return 'Pick a starting haven as home';
			if (
				command.portrait !== undefined &&
				!(Number.isInteger(command.portrait) && command.portrait >= 0 && command.portrait < pack.numbers.portraits)
			)
				return 'Pick one of the portraits';
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
			if (world.table.undoVote) return 'Finish the undo vote first';
			return inPhase('playing.actions') ?? checkAction(world, command.seat, command.action);
		case 'END_ACTIONS':
			if (world.table.undoVote) return 'Finish the undo vote first';
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
				: inPhase('playing.infect', 'setup.infect');
		case 'END_TURN':
			if (command.seat !== game?.active) return 'Not your turn';
			if (game.infectionsLeft > 0) return 'Flip the Infection cards first';
			return blocked(world) ? 'Resolve the pending choice first' : inPhase('playing.infect');
		case 'PLAY':
			if (world.table.undoVote) return 'Finish the undo vote first';
			return (
				inPhase('playing.actions', 'playing.draw', 'playing.infect') ??
				checkPlay(world, command.seat, command.card, command.play, phase)
			);
		case 'DECIDE':
			if (world.table.undoVote) return 'Finish the undo vote first';
			return inPhase('playing.actions', 'playing.draw', 'playing.infect') ?? checkDecide(world, command.decide);
		case 'LOCKDOWN': {
			if (world.table.undoVote) return 'Finish the undo vote first';
			const card = campaign.infectionCards[command.card];
			const armed =
				game?.infectionDiscard.includes(command.card) && card?.kind === 'city' && card.improvement === 'lockdown';
			if (!armed) return 'That card cannot be destroyed';
			if (!game?.players[command.seat]?.hand.includes(command.pay)) return 'Discard a Player card from that hand';
			return inPhase('playing.actions', 'playing.draw', 'playing.infect');
		}
		case 'WAIVE_OBJECTIVE': {
			if (world.table.undoVote) return 'Finish the undo vote first';
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
			return world.table.undoVote ? 'An undo vote is already open' : inPhase('playing.actions');
		case 'CONTINUE':
			return inPhase('over');
		case 'PURCHASE':
			return inPhase('upkeep', 'setup.supply') ?? checkPurchase(world, command.purchase);
		case 'REFUND':
			return inPhase('upkeep') ?? checkRefund(world, command.index);
		case 'FINISH_UPKEEP':
			if (world.table.seats.length > 0 && !tablePlayers(world.table).includes(command.player)) return 'Sit down first';
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
		PLAY: { guard: { type: 'legal', params: phase }, actions: { type: 'play', params: phase } },
		DECIDE: { guard: { type: 'legal', params: phase }, actions: 'decide' },
		LOCKDOWN: { guard: { type: 'legal', params: phase }, actions: { type: 'lockdown', params: phase } },
		WAIVE_OBJECTIVE: { guard: { type: 'legal', params: phase }, actions: { type: 'waive', params: phase } },
	}) as const;

/** Who sits where can change in any phase: a newcomer takes an open seat, anyone gets up. */
const seatEvents = (phase: Phase) =>
	({
		JOIN: { guard: { type: 'legal', params: phase }, actions: 'table' },
		TAKE_SEAT: { guard: { type: 'legal', params: phase }, actions: 'table' },
		LEAVE: { guard: { type: 'legal', params: phase }, actions: 'table' },
	}) as const;

export const gameMachine = setup({
	types: {
		context: {} as Context,
		events: {} as Command,
		input: {} as { seed: number } | { world: World },
	},
	guards: {
		legal: ({ context, event }: Args, phase: Phase) => reject(context.world, phase, event) === null,
		allReady: ({ context, event }: Args) =>
			reject(context.world, 'lobby', event) === null && readyStart(context.world.table, event as Of<'READY'>) !== null,
		gameChosen: ({ context }: Args) => tableStart(context.world) !== null,
		canUndo: ({ context }: Args) => context.undo.length > 0 && context.world.table.undoVote === null,
		undoNeedsVote: ({ context }: Args) =>
			Boolean(context.undo.at(-1)?.reveals) && tablePlayers(context.world.table).length > 0,
		undoVoteApproved: ({ context, event }: Args) => {
			if (reject(context.world, 'playing.actions', event) !== null) return false;
			const vote = event as Of<'UNDO_VOTE'>;
			if (vote.vote !== 'yes' || !context.world.table.undoVote || context.undo.length === 0) return false;
			const nextVotes: NonNullable<World['table']['undoVote']>['votes'] = {
				...context.world.table.undoVote.votes,
				[vote.player]: 'yes',
			};
			const players = tablePlayers(context.world.table);
			return players.length > 0 && players.every(player => nextVotes[player] === 'yes');
		},
		leaveApprovesUndo: ({ context, event }: Args) => {
			if (reject(context.world, 'playing.actions', event) !== null) return false;
			const vote = context.world.table.undoVote;
			if (!vote || context.undo.length === 0) return false;
			const leave = event as Of<'LEAVE'>;
			const remainingSeats = context.world.table.seats.filter(
				entry => entry.player !== leave.player || (leave.seat !== undefined && entry.seat !== leave.seat),
			);
			const remainingPlayers = [...new Set(remainingSeats.map(entry => entry.player))];
			return remainingPlayers.length > 0 && remainingPlayers.every(player => vote.votes[player] === 'yes');
		},
		over: ({ context }: Args) => isOver(context.world),
		drawsDone: ({ context }: Args) =>
			!isOver(context.world) && context.world.game!.drawsLeft === 0 && !blocked(context.world),
		openingDone: ({ context }: Args) =>
			!isOver(context.world) && context.world.game!.infectionsLeft === 0 && !blocked(context.world),
		upkeepAgreed: ({ context, event }: Args) => {
			if (reject(context.world, 'upkeep', event) !== null) return false;
			const vote = event as Of<'FINISH_UPKEEP'>;
			const done = context.world.game!.upkeep!.done;
			const players = tablePlayers(context.world.table);
			// With nobody seated (the bot, the tests) a single vote decides.
			if (players.length === 0) return vote.done;
			return players.every(player => (player === vote.player ? vote.done : done.includes(player)));
		},
		campaignEnding: ({ context }: Args) => {
			const { campaign, game } = context.world;
			return campaign.month === 12 && (campaign.attempt === 2 || game?.outcome?.won === true);
		},
	},
	actions: {
		createCharacter: assign(
			change((world, event) => {
				const { campaign } = world;
				const { player, ...input } = event as Of<'CREATE_CHARACTER'>;
				const created = createCharacter(campaign, input);
				if (player && world.table.seats.some(entry => entry.player === player))
					claimCharacter(world, player, created.id);
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
		claim: assign(
			change((world, event) => {
				const { player, character } = event as Of<'CLAIM'>;
				claimCharacter(world, player, character);
			}),
		),
		chooseStart: assign(({ context, event }: Args) => ({
			world: produce(context.world, draft => {
				draft.table.start = (event as Of<'READY'>).start;
				draft.table.ready = {};
			}),
		})),
		table: assign(({ context, event }: Args) => ({
			world: produce(context.world, draft => applyTable(draft, event as TableCommand)),
		})),
		startTable: assign(
			change((world, event) => {
				if (tableStart(world) === 'month' && world.campaign.month === 0) world.campaign.month = 1;
				world.table.ready = {};
				world.table.start = null;
				readLegacy(world, 'setup');
				const seating = dealTable(world);
				world.campaign.seating = seating;
				createGame(world, seating);
			}),
		),
		ackBriefing: assign(({ context }: Args) => ({
			world: produce(context.world, draft => {
				draft.campaign.briefing = [];
				draft.table.briefing = newTableBriefing();
			}),
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
				// August's free units are spent before the supplies go out, or not at all.
				world.campaign.freeAbilityUnits = 0;
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
				undo: [
					...context.undo,
					{ world: context.world, seat, subject: { kind: 'action', action: action.a }, reveals: actionReveals(action) },
				],
			};
		}),
		startUndoVote: assign(({ context, event }: Args) => {
			const top = context.undo.at(-1)!;
			const by = (event as Of<'UNDO'>).by ?? null;
			return {
				world: produce(context.world, draft => {
					draft.table.undoVote = { seat: top.seat, subject: top.subject, by, votes: {} };
				}),
			};
		}),
		// Who sits where is not part of a move, so taking one back leaves the table as it is.
		undo: assign(({ context }: Args) => ({
			world: { ...context.undo.at(-1)!.world, table: { ...context.world.table, undoVote: null } },
			undo: context.undo.slice(0, -1),
		})),
		leaveAndUndo: assign(({ context, event }: Args) => {
			const updated = produce(context.world, draft => applyTable(draft, event as TableCommand));
			return {
				world: { ...context.undo.at(-1)!.world, table: { ...updated.table, undoVote: null } },
				undo: context.undo.slice(0, -1),
			};
		}),
		startDraw: assign(change(startDrawStep)),
		draw: assign(change(drawPlayerCard)),
		startInfect: assign(change(startInfectStep)),
		openingInfect: assign(change(openingInfectStep)),
		infect: assign(change(infectStep)),
		endTurn: assign(change(endTurn)),
		play: assign(({ context, event }: Args, phase: Phase) => {
			const { seat, card, play } = event as Of<'PLAY'>;
			return {
				world: produce(context.world, draft => {
					applyPlay(draft, seat, card, play);
					autoResolve(draft);
				}),
				undo:
					phase === 'playing.actions'
						? [
								...context.undo,
								{ world: context.world, seat, subject: { kind: 'play', play: play.e }, reveals: playReveals(play) },
							]
						: [],
			};
		}),
		decide: assign(({ context, event }: Args) => ({
			world: produce(context.world, draft => {
				applyDecide(draft, (event as Of<'DECIDE'>).decide);
				autoResolve(draft);
			}),
			undo: context.undo,
		})),
		lockdown: assign(({ context, event }: Args, phase: Phase) => {
			const { card, seat, pay } = event as Of<'LOCKDOWN'>;
			return {
				world: produce(context.world, draft => {
					discardFromHand(draft.game!, seat, pay);
					const destroyed = draft.campaign.infectionCards[card]!;
					draft.game!.infectionDiscard.splice(draft.game!.infectionDiscard.indexOf(card), 1);
					delete draft.campaign.infectionCards[card];
					if (destroyed.kind === 'city')
						log(draft.game!, {
							t: 'note',
							text: `Lockdown destroyed an Infection card of ${cityDef(destroyed.city).name} for good`,
						});
					autoResolve(draft);
				}),
				undo:
					phase === 'playing.actions'
						? [...context.undo, { world: context.world, seat, subject: { kind: 'lockdown' }, reveals: false }]
						: [],
			};
		}),
		waive: assign(({ context, event }: Args, phase: Phase) => ({
			world: produce(context.world, draft => {
				draft.game!.waived.push((event as Of<'WAIVE_OBJECTIVE'>).objective);
				checkWin(draft);
				autoResolve(draft);
			}),
			undo:
				phase === 'playing.actions'
					? [
							...context.undo,
							{ world: context.world, seat: context.world.game!.active, subject: { kind: 'waive' }, reveals: false },
						]
					: [],
		})),
		resolveGameEnd: assign(change(resolveGameEnd)),
		purchase: assign(change((world, event) => applyPurchase(world, (event as Of<'PURCHASE'>).purchase))),
		refund: assign(change((world, event) => refundPurchase(world, (event as Of<'REFUND'>).index))),
		voteUpkeep: assign(
			change((world, event) => {
				const vote = event as Of<'FINISH_UPKEEP'>;
				const upkeep = world.game!.upkeep!;
				upkeep.done = vote.done
					? [...new Set([...upkeep.done, vote.player])]
					: upkeep.done.filter(player => player !== vote.player);
			}),
		),
		closeGame: assign(change(closeGame)),
	},
}).createMachine({
	id: 'game',
	context: ({ input }) => ({
		world: 'world' in input ? input.world : { campaign: newCampaign(input.seed), game: null, table: newTable() },
		undo: [],
	}),
	initial: 'lobby',
	on: {
		ACK_BRIEFING: { actions: 'ackBriefing' },
		BRIEFING_STEP: { guard: { type: 'legal', params: 'lobby' }, actions: 'table' },
		BRIEFING_READY: { guard: { type: 'legal', params: 'lobby' }, actions: 'table' },
	},
	states: {
		lobby: {
			on: {
				CREATE_CHARACTER: { guard: { type: 'legal', params: 'lobby' }, actions: 'createCharacter' },
				SET_RATIONING: { guard: { type: 'legal', params: 'lobby' }, actions: 'setRationing' },
				BEGIN_CAMPAIGN: { guard: { type: 'legal', params: 'lobby' }, actions: 'beginCampaign' },
				RENAME_HAVEN: { guard: { type: 'legal', params: 'lobby' }, actions: 'renameHaven' },
				SEAT: { guard: { type: 'legal', params: 'lobby' }, actions: 'seat' },
				START_GAME: { guard: { type: 'legal', params: 'lobby' }, target: 'setup', actions: 'startGame' },
				...seatEvents('lobby'),
				ADD_SEAT: { guard: { type: 'legal', params: 'lobby' }, actions: 'table' },
				CLAIM: { guard: { type: 'legal', params: 'lobby' }, actions: 'claim' },
				READY: [
					{ guard: and(['allReady', 'gameChosen']), target: 'setup', actions: 'startTable' },
					{ guard: 'allReady', actions: 'chooseStart' },
					{ guard: { type: 'legal', params: 'lobby' }, actions: 'table' },
				],
			},
		},
		setup: {
			initial: 'supply',
			always: { guard: 'over', target: 'over' },
			states: {
				supply: {
					on: {
						...seatEvents('setup.supply'),
						PLACE_SUPPLY: { guard: { type: 'legal', params: 'setup.supply' }, actions: 'placeSupply' },
						AUTO_SUPPLY: { guard: { type: 'legal', params: 'setup.supply' }, actions: 'autoSupply' },
						PURCHASE: { guard: { type: 'legal', params: 'setup.supply' }, actions: 'purchase' },
						CONFIRM_SUPPLY: {
							guard: { type: 'legal', params: 'setup.supply' },
							target: 'infect',
							actions: 'confirmSupply',
						},
					},
				},
				// The cards that open a game are flipped one command at a time, by anyone at the table.
				infect: {
					always: { guard: 'openingDone', target: 'events' },
					on: {
						...seatEvents('setup.infect'),
						INFECT: { guard: { type: 'legal', params: 'setup.infect' }, actions: 'openingInfect' },
					},
				},
				events: {
					on: {
						...seatEvents('setup.events'),
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
						...seatEvents('playing.actions'),
						LEAVE: [
							{ guard: 'leaveApprovesUndo', actions: 'leaveAndUndo' },
							{ guard: { type: 'legal', params: 'playing.actions' }, actions: 'table' },
						],
						ACTION: { guard: { type: 'legal', params: 'playing.actions' }, actions: 'act' },
						UNDO: [
							{ guard: and(['canUndo', 'undoNeedsVote']), actions: 'startUndoVote' },
							{ guard: 'canUndo', actions: 'undo' },
						],
						UNDO_VOTE: [
							{ guard: 'undoVoteApproved', actions: 'undo' },
							{ guard: { type: 'legal', params: 'playing.actions' }, actions: 'table' },
						],
						CANCEL_UNDO_VOTE: { guard: { type: 'legal', params: 'playing.actions' }, actions: 'table' },
						END_ACTIONS: { guard: { type: 'legal', params: 'playing.actions' }, target: 'draw', actions: 'startDraw' },
					},
				},
				draw: {
					always: { guard: 'drawsDone', target: 'infect', actions: 'startInfect' },
					on: {
						...anyStep('playing.draw'),
						...seatEvents('playing.draw'),
						DRAW: { guard: { type: 'legal', params: 'playing.draw' }, actions: 'draw' },
					},
				},
				// The turn stays with its player after the last card, for an Event or a look at the board, until they pass it on.
				infect: {
					on: {
						...anyStep('playing.infect'),
						...seatEvents('playing.infect'),
						INFECT: { guard: { type: 'legal', params: 'playing.infect' }, actions: 'infect' },
						END_TURN: { guard: { type: 'legal', params: 'playing.infect' }, target: 'actions', actions: 'endTurn' },
					},
				},
			},
		},
		over: { on: { ...seatEvents('over'), CONTINUE: { target: 'upkeep', actions: 'resolveGameEnd' } } },
		upkeep: {
			on: {
				...seatEvents('upkeep'),
				PURCHASE: { guard: { type: 'legal', params: 'upkeep' }, actions: 'purchase' },
				REFUND: { guard: { type: 'legal', params: 'upkeep' }, actions: 'refund' },
				FINISH_UPKEEP: [
					{ guard: and(['upkeepAgreed', 'campaignEnding']), target: 'finished', actions: 'closeGame' },
					{ guard: 'upkeepAgreed', target: 'lobby', actions: 'closeGame' },
					{ guard: { type: 'legal', params: 'upkeep' }, actions: 'voteUpkeep' },
				],
			},
		},
		finished: { on: { LEAVE: { guard: { type: 'legal', params: 'finished' }, actions: 'table' } } },
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
export function createGameActor(options: { seed: number; save?: Save | null; undo?: UndoEntry[] }) {
	const input = { seed: options.seed };
	if (!options.save) return createActor(gameMachine, { input });
	const snapshot = gameMachine.resolveState({
		value: phaseValue(options.save.phase) as never,
		context: { world: options.save.world, undo: options.undo ?? [] },
	});
	return createActor(gameMachine, { snapshot, input });
}

export type GameActor = ReturnType<typeof createGameActor>;

/**
 * Reads a save. The game is in development, so a save from an older build, one whose campaign or table
 * lacks a field today's has, is refused rather than upgraded.
 */
const freshCharacter = createCharacter(newCampaign(0), { name: '', job: null, home: '' as CityId });

export function parseSave(raw: unknown): Save {
	const save = raw as Partial<Save> | null;
	const lacks = (written: object | undefined, fresh: object) =>
		!written || Object.keys(fresh).some(key => !(key in written));
	if (
		save?.v !== 1 ||
		typeof save.phase !== 'string' ||
		lacks(save.world?.campaign, newCampaign(0)) ||
		save.world!.campaign.briefing.some(entry => typeof entry !== 'object') ||
		lacks(save.world?.table, newTable()) ||
		Object.values(save.world!.campaign.characters ?? {}).some(character => lacks(character, freshCharacter))
	)
		throw new Error('That is not a campaign save from this build');
	return save as Save;
}

/**
 * For debugging only, so a long playtest survives a change to the state's shape: what an older save lacks is
 * filled with today's fresh value. Players' saves still go through `parseSave` alone and are refused.
 */
export function fillSave(raw: unknown): Save {
	const save = structuredClone(raw) as Save;
	const fill = (written: object | undefined, fresh: object) => {
		if (!written) return;
		for (const [key, value] of Object.entries(fresh))
			if (!(key in written)) (written as Record<string, unknown>)[key] = structuredClone(value);
	};
	fill(save?.world?.campaign, newCampaign(0));
	fill(save?.world?.table, newTable());
	for (const character of Object.values(save?.world?.campaign?.characters ?? {})) fill(character, freshCharacter);
	return parseSave(save);
}
