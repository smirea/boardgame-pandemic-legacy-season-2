import { pack } from './content/pack';
import { SEAT_IDS } from './helpers';
import type { CharacterId, PlayerId, SeatId } from './ids';
import { createCharacter } from './legacy';
import type { Start, Table, World } from './state';

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
	| { type: 'CLAIM'; player: PlayerId; character: CharacterId | null };

export const newTable = (): Table => ({ seats: [], ready: {}, start: null });

/** The game the lobby is choosing characters for. Only month 0 has a choice, made by everyone readying for one. */
export const tableStart = (world: World): Start | null => (world.campaign.month > 0 ? 'month' : world.table.start);

const bySeat = (a: { seat: SeatId }, b: { seat: SeatId }) => SEAT_IDS.indexOf(a.seat) - SEAT_IDS.indexOf(b.seat);
const freeSeat = (table: Table) => SEAT_IDS.find(seat => !table.seats.some(entry => entry.seat === seat));
const seated = (table: Table, player: PlayerId) => table.seats.some(entry => entry.player === player);
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
		case 'READY':
			if (!lobby) return 'Not available right now';
			if (!seated(table, command.player)) return 'Sit down first';
			if (command.start === 'prologue' && campaign.month !== 0) return 'The prologue is over';
			return command.start && tableStart(world) && command.start !== tableStart(world)
				? 'The table has chosen its game'
				: null;
		case 'CLAIM': {
			if (!lobby) return 'Characters are chosen before a game';
			if (!seated(table, command.player)) return 'Sit down first';
			if (command.character === null) return null;
			const character = campaign.characters[command.character];
			if (!character || character.dead || character.worker) return 'Pick a living character';
			const holder = claimant(world, command.character);
			return holder && holder !== command.player ? 'Another player has that character' : null;
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
export function applyTable(table: Table, command: TableCommand) {
	const named = (player: PlayerId) => table.seats.find(entry => entry.player === player)!.name;
	switch (command.type) {
		case 'JOIN':
			if (seated(table, command.player)) {
				for (const entry of table.seats) if (entry.player === command.player) entry.name = command.name.trim();
				return;
			}
			table.seats.push({ seat: freeSeat(table)!, player: command.player, name: command.name.trim() });
			break;
		case 'ADD_SEAT':
			table.seats.push({ seat: freeSeat(table)!, player: command.player, name: named(command.player) });
			break;
		case 'TAKE_SEAT':
			table.seats = table.seats.filter(entry => entry.seat !== command.seat);
			table.seats.push({ seat: command.seat, player: command.player, name: command.name.trim() });
			break;
		case 'LEAVE':
			table.seats = table.seats.filter(
				entry => entry.player !== command.player || (command.seat !== undefined && entry.seat !== command.seat),
			);
			break;
		case 'READY':
			if (command.start) table.ready[command.player] = command.start;
			else delete table.ready[command.player];
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
 * Gives every seat a character: the one its player played last, else a living one nobody at the
 * table plays, else a new one named after the player. A haven worker takes the seat only when no
 * starting job is left to make a character with.
 */
export function dealTable(world: World): { seat: SeatId; character: CharacterId }[] {
	const { campaign, table } = world;
	const seats = table.seats.toSorted(bySeat);
	const present = new Set(seats.map(entry => entry.player));
	const living = Object.values(campaign.characters).filter(character => !character.dead && !character.worker);
	const dealt = new Map<SeatId, CharacterId>();
	const taken = () => new Set(dealt.values());
	for (const entry of seats) {
		const own = living.find(character => character.player === entry.player && !taken().has(character.id));
		if (own) dealt.set(entry.seat, own.id);
	}
	const home = pack.cities.find(city => city.kind === 'haven' && !city.lost)!.id;
	for (const entry of seats) {
		if (dealt.has(entry.seat)) continue;
		const spare = living.find(
			character => !taken().has(character.id) && !(character.player && present.has(character.player)),
		);
		if (spare) {
			dealt.set(entry.seat, spare.id);
			continue;
		}
		const job = pack.jobs.find(
			candidate =>
				candidate.starting && !Object.values(campaign.characters).some(character => character.job === candidate.id),
		);
		const names = new Set(living.map(character => character.name));
		let name = entry.name;
		for (let n = 2; names.has(name); n++) name = `${entry.name} ${n}`;
		const created = job
			? createCharacter(campaign, { name, job: job.id, home })
			: createCharacter(campaign, { name: 'Haven worker', job: null, home, worker: true });
		if (!created.worker) living.push(created);
		dealt.set(entry.seat, created.id);
	}
	for (const entry of seats) campaign.characters[dealt.get(entry.seat)!]!.player = entry.player;
	return seats.map(entry => ({ seat: entry.seat, character: dealt.get(entry.seat)! }));
}
