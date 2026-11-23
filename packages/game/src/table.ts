import { openings } from './briefing';
import { pack } from './content/pack';
import { SEAT_IDS } from './helpers';
import type { CharacterId, PlayerId, SeatId } from './ids';
import type { CharacterDraft, Start, Table, TableBriefing, UndoVoteChoice, World } from './state';

export type TableCommand =
	/** Sits a person down in the lobby, or renames them wherever they sit. */
	| { type: 'JOIN'; player: PlayerId; name: string }
	/** Another seat for someone already at the table, for a second character played on the same screen. */
	| { type: 'ADD_SEAT'; player: PlayerId }
	/** Sits a person in a seat of the game under way, displacing whoever held it. */
	| { type: 'TAKE_SEAT'; player: PlayerId; name: string; seat: SeatId }
	/** Gets up from one seat, or from every seat when none is named. */
	| { type: 'LEAVE'; player: PlayerId; seat?: SeatId }
	| { type: 'READY'; player: PlayerId; start: Start | null }
	/** Takes a character for the next game, or lets go of the ones taken when none is named. */
	| { type: 'CLAIM'; player: PlayerId; character: CharacterId | null }
	/** Draws the next Legacy card / package / door onto the table, or flips/opens the one just drawn. */
	| { type: 'BRIEFING_STEP' }
	/** Votes Done once everything in the current Legacy briefing has been drawn and opened. */
	| { type: 'BRIEFING_READY'; player: PlayerId; ready: boolean }
	/** Votes on whether to allow undoing an action that revealed hidden information. */
	| { type: 'UNDO_VOTE'; player: PlayerId; vote: UndoVoteChoice | null }
	/** Withdraws an active undo vote. */
	| { type: 'CANCEL_UNDO_VOTE'; player: PlayerId }
	/** Changes the new character the table is making together. */
	| { type: 'DRAFT'; set: Partial<CharacterDraft> };

export const newDraft = (): CharacterDraft => ({ name: '', portrait: null, job: null, home: null });
export const newTableBriefing = (): TableBriefing => ({ drawn: 0, flipped: false, ready: [], stowing: false });
export const newTable = (): Table => ({
	seats: [],
	ready: {},
	start: null,
	briefing: newTableBriefing(),
	undoVote: null,
	draft: newDraft(),
});

/** The game the lobby is choosing characters for, set once everyone readies in the lobby. */
export const tableStart = (world: World): Start | null => world.table.start;

const bySeat = (a: { seat: SeatId }, b: { seat: SeatId }) => SEAT_IDS.indexOf(a.seat) - SEAT_IDS.indexOf(b.seat);
const freeSeat = (table: Table) => SEAT_IDS.find(seat => !table.seats.some(entry => entry.seat === seat));
const seated = (table: Table, player: PlayerId) => table.seats.some(entry => entry.player === player);
const claimedCount = (world: World, player: PlayerId) =>
	Object.values(world.campaign.characters).filter(
		character => character.player === player && !character.dead && !character.worker,
	).length;
const badName = (name: string) =>
	name.trim().length === 0 || name.length > 24 ? 'Names run from 1 to 24 characters' : null;

/** The people at the table, each once, in seat order. */
export const tablePlayers = (table: Table): PlayerId[] => [
	...new Set(table.seats.toSorted(bySeat).map(entry => entry.player)),
];

export function rejectTable(world: World, lobby: boolean, command: TableCommand): string | null {
	const { table, game, campaign } = world;
	switch (command.type) {
		case 'JOIN':
			if (badName(command.name)) return badName(command.name);
			if (seated(table, command.player)) return null;
			if (!lobby) return 'Pick a seat';
			return freeSeat(table) ? null : 'The table is full';
		case 'ADD_SEAT':
			if (!lobby) return 'Not available right now';
			if (!seated(table, command.player)) return 'Sit down first';
			return freeSeat(table) ? null : 'The table is full';
		case 'TAKE_SEAT':
			if (badName(command.name)) return badName(command.name);
			if (lobby || !game?.seats.includes(command.seat)) return 'No such seat in this game';
			return table.seats.some(entry => entry.seat === command.seat && entry.player === command.player)
				? 'You already sit there'
				: null;
		case 'LEAVE':
			return table.seats.some(
				entry => entry.player === command.player && (command.seat === undefined || entry.seat === command.seat),
			)
				? null
				: 'Not in that seat';
		case 'READY': {
			if (!lobby) return 'Not available right now';
			if (!seated(table, command.player)) return 'Sit down first';
			if (command.start === 'prologue' && campaign.month !== 0) return 'The prologue is over';
			if (command.start && tableStart(world)) {
				if (command.start !== tableStart(world)) return 'The table has chosen its game';
				const needed = table.seats.filter(entry => entry.player === command.player).length;
				if (claimedCount(world, command.player) < needed)
					return needed === 1 ? 'Pick or create a character first' : 'Pick or create a character for each seat first';
			}
			return null;
		}
		case 'CLAIM': {
			if (!lobby) return 'Characters are chosen before a game';
			if (!seated(table, command.player)) return 'Sit down first';
			if (command.character === null) return null;
			const character = campaign.characters[command.character];
			if (!character || character.dead || character.worker) return 'Pick a living character';
			const holder = claimant(world, command.character);
			return holder && holder !== command.player ? 'Another player has that character' : null;
		}
		case 'BRIEFING_STEP': {
			const total = openings(campaign.briefing).length;
			if (total === 0 || table.briefing.stowing) return 'Nothing to draw';
			return table.briefing.drawn >= total && table.briefing.flipped ? 'Everything is already drawn' : null;
		}
		case 'BRIEFING_READY': {
			const total = openings(campaign.briefing).length;
			if (total === 0 || table.briefing.stowing) return 'Nothing to confirm';
			if (table.briefing.drawn < total || !table.briefing.flipped) return 'Draw and flip every card first';
			if (table.seats.length > 0 && !seated(table, command.player)) return 'Sit down first';
			return null;
		}
		case 'UNDO_VOTE': {
			if (!table.undoVote) return 'No undo vote is open';
			if (!seated(table, command.player)) return 'Sit down first';
			return null;
		}
		case 'DRAFT': {
			if (!lobby) return 'Characters are made before a game';
			const { name, portrait, job, home } = command.set;
			if (name !== undefined && name.length > 24) return 'Names run from 1 to 24 characters';
			if (
				portrait !== undefined &&
				portrait !== null &&
				!(Number.isInteger(portrait) && portrait >= 0 && portrait < pack.numbers.portraits)
			)
				return 'Pick one of the portraits';
			if (job && !pack.jobs.some(candidate => candidate.id === job)) return 'No such job';
			if (home && pack.cities.find(candidate => candidate.id === home)?.kind !== 'haven') return 'Pick a haven';
			return null;
		}
		case 'CANCEL_UNDO_VOTE': {
			if (!table.undoVote) return 'No undo vote is open';
			if (table.undoVote.by && table.undoVote.by !== command.player)
				return 'Only the player who asked to undo can withdraw it';
			return null;
		}
	}
}

/** Who at the table has the character for the next game. Someone who has left the table holds nothing. */
export function claimant(world: World, character: CharacterId): PlayerId | null {
	const player = world.campaign.characters[character]?.player ?? null;
	return player && seated(world.table, player) ? player : null;
}

/**
 * Gives the character to the player. A player keeps one character per seat they hold, so taking one
 * more lets go of the one they took first.
 */
export function claimCharacter(world: World, player: PlayerId, id: CharacterId | null) {
	const { campaign, table } = world;
	const held = () =>
		Object.values(campaign.characters).filter(
			character => character.player === player && !character.dead && !character.worker,
		);
	if (id === null) {
		for (const character of held()) character.player = null;
	} else {
		campaign.characters[id]!.player = player;
		const seats = table.seats.filter(entry => entry.player === player).length;
		for (const extra of held()
			.filter(character => character.id !== id)
			.slice(0, Math.max(0, held().length - seats)))
			extra.player = null;
	}
	table.ready = {};
}

/** Applies a legal table command. Any change to who sits where in the lobby asks everyone to ready again. */
export function applyTable(world: World, command: TableCommand) {
	const { table, campaign, game } = world;
	const named = (player: PlayerId) => table.seats.find(entry => entry.player === player)!.name;
	switch (command.type) {
		case 'JOIN': {
			const name = command.name.trim();
			if (seated(table, command.player)) {
				for (const entry of table.seats) if (entry.player === command.player) entry.name = name;
				return;
			}
			const owned = Object.values(campaign.characters).filter(
				character => character.player === command.player && !character.dead && !character.worker,
			);
			const desired: SeatId[] = [];
			for (const entry of campaign.seating) {
				if (
					entry.character &&
					owned.some(character => character.id === entry.character) &&
					!table.seats.some(taken => taken.seat === entry.seat) &&
					!desired.includes(entry.seat)
				)
					desired.push(entry.seat);
			}
			for (const seat of desired) table.seats.push({ seat, player: command.player, name });
			const needed = Math.max(1, owned.length) - desired.length;
			for (let index = 0; index < needed; index++) {
				const seat = freeSeat(table);
				if (!seat) break;
				table.seats.push({ seat, player: command.player, name });
			}
			break;
		}
		case 'ADD_SEAT':
			table.seats.push({ seat: freeSeat(table)!, player: command.player, name: named(command.player) });
			break;
		case 'TAKE_SEAT': {
			table.seats = table.seats.filter(entry => entry.seat !== command.seat);
			table.seats.push({ seat: command.seat, player: command.player, name: command.name.trim() });
			const character = game?.players[command.seat]?.character;
			if (character && campaign.characters[character] && !campaign.characters[character]!.worker)
				campaign.characters[character]!.player = command.player;
			break;
		}
		case 'LEAVE':
			table.seats = table.seats.filter(
				entry => entry.player !== command.player || (command.seat !== undefined && entry.seat !== command.seat),
			);
			table.briefing.ready = table.briefing.ready.filter(player => player !== command.player);
			if (
				!table.briefing.stowing &&
				table.briefing.ready.length > 0 &&
				tablePlayers(table).length > 0 &&
				tablePlayers(table).every(player => table.briefing.ready.includes(player))
			)
				table.briefing.stowing = true;
			if (table.undoVote) {
				delete table.undoVote.votes[command.player];
				if (tablePlayers(table).length === 0) table.undoVote = null;
			}
			break;
		case 'READY':
			if (command.start) table.ready[command.player] = command.start;
			else delete table.ready[command.player];
			return;
		case 'BRIEFING_STEP': {
			const state = table.briefing;
			if (state.drawn === 0 || state.flipped) {
				state.drawn += 1;
				state.flipped = false;
			} else {
				state.flipped = true;
			}
			state.ready = [];
			return;
		}
		case 'BRIEFING_READY': {
			const state = table.briefing;
			state.ready = command.ready
				? [...new Set([...state.ready, command.player])]
				: state.ready.filter(player => player !== command.player);
			const players = tablePlayers(table);
			if (players.length === 0 ? command.ready : players.every(player => state.ready.includes(player)))
				state.stowing = true;
			return;
		}
		case 'UNDO_VOTE': {
			const vote = table.undoVote;
			if (!vote) return;
			if (command.vote) vote.votes[command.player] = command.vote;
			else delete vote.votes[command.player];
			const players = tablePlayers(table);
			if (players.length > 0 && players.every(player => vote.votes[player] !== undefined)) {
				if (!players.every(player => vote.votes[player] === 'yes')) table.undoVote = null;
			}
			return;
		}
		case 'CANCEL_UNDO_VOTE':
			table.undoVote = null;
			return;
		case 'DRAFT':
			Object.assign(table.draft, command.set);
			return;
	}
	table.seats.sort(bySeat);
	table.ready = {};
}

/** The game a READY would start: the one everyone at a table of two or more is then ready for. */
export function readyStart(table: Table, command: Extract<TableCommand, { type: 'READY' }>): Start | null {
	if (!command.start || table.seats.length < 2) return null;
	const ready: Table['ready'] = { ...table.ready, [command.player]: command.start };
	return tablePlayers(table).every(player => ready[player] === command.start) ? command.start : null;
}

/**
 * Gives every seat one of the living characters its player picked, matching the seat they played it in last when
 * possible. Never assigns an unpicked character or invents a plain one.
 */
export function dealTable(world: World): { seat: SeatId; character: CharacterId }[] {
	const { campaign, table } = world;
	const seats = table.seats.toSorted(bySeat);
	const living = Object.values(campaign.characters).filter(character => !character.dead && !character.worker);
	const dealt = new Map<SeatId, CharacterId>();
	const taken = () => new Set(dealt.values());
	for (const entry of seats) {
		const last = campaign.seating.find(item => item.seat === entry.seat)?.character;
		const exact =
			last &&
			living.find(
				character => character.id === last && character.player === entry.player && !taken().has(character.id),
			);
		if (exact) dealt.set(entry.seat, exact.id);
	}
	for (const entry of seats) {
		if (dealt.has(entry.seat)) continue;
		const own = living.find(character => character.player === entry.player && !taken().has(character.id));
		if (!own) throw new Error(`Player ${entry.name} has not picked a character for ${entry.seat}`);
		dealt.set(entry.seat, own.id);
	}
	return seats.map(entry => ({ seat: entry.seat, character: dealt.get(entry.seat)! }));
}
