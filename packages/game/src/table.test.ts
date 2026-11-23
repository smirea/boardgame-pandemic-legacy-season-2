import { expect, test } from 'bun:test';
import { openings } from './briefing';
import { pack } from './content/pack';
import type { JobId } from './content/types';
import type { CityId, PlayerId } from './ids';
import { createGameActor, reject } from './machine';
import type { Start, World } from './state';
import { tablePlayers, tableStart } from './table';
import { campaignAt } from './scenarios';
import { A, act, B, C, gameOf, late, phase, send, worldOf } from './testkit';

const ann = 'ann' as PlayerId;
const ben = 'ben' as PlayerId;
const HAVEN = pack.cities.find(city => city.kind === 'haven' && !city.lost)!.id as CityId;
const freeJob = (world: World) =>
	pack.jobs.find(job => job.starting && !Object.values(world.campaign.characters).some(c => c.job === job.id))!
		.id as JobId;

function lobby() {
	const actor = createGameActor({ seed: 3 }).start();
	send(actor, { type: 'JOIN', player: ann, name: 'Ann' });
	send(actor, { type: 'JOIN', player: ben, name: 'Ben' });
	return actor;
}

/** Ensures every seated player has claimed or created a character for each seat they hold. */
function pickCharacters(actor: ReturnType<typeof lobby>) {
	const world = worldOf(actor);
	for (const player of tablePlayers(world.table)) {
		const seats = world.table.seats.filter(entry => entry.player === player);
		const name = seats[0]!.name;
		let owned = Object.values(worldOf(actor).campaign.characters).filter(
			character => character.player === player && !character.dead && !character.worker,
		).length;
		for (let n = owned + 1; n <= seats.length; n++) {
			const current = worldOf(actor);
			const spare = Object.values(current.campaign.characters).find(
				character => !character.dead && !character.worker && !character.player,
			);
			if (spare) send(actor, { type: 'CLAIM', player, character: spare.id });
			else
				send(actor, {
					type: 'CREATE_CHARACTER',
					name: n === 1 ? name : `${name} ${n}`,
					job: freeJob(current),
					home: HAVEN,
					player,
				});
			owned++;
		}
	}
}

/** Everyone agrees on the game at month 0, picks characters if needed, then readies to start. */
function begin(actor: ReturnType<typeof lobby>, start: Start) {
	for (const player of tablePlayers(worldOf(actor).table)) send(actor, { type: 'READY', player, start });
	if (phase(actor) !== 'lobby') return;
	pickCharacters(actor);
	for (const player of tablePlayers(worldOf(actor).table)) send(actor, { type: 'READY', player, start });
}

test('the lobby picks the game everyone readies for, requires every player to pick characters, and starts once everyone is ready', () => {
	const actor = lobby();
	send(actor, { type: 'READY', player: ann, start: 'prologue' });
	send(actor, { type: 'READY', player: ben, start: 'month' });
	expect(phase(actor)).toBe('lobby');
	send(actor, { type: 'ADD_SEAT', player: ben });
	expect(worldOf(actor).table.ready).toEqual({});
	send(actor, { type: 'READY', player: ann, start: 'month' });
	send(actor, { type: 'READY', player: ben, start: 'month' });
	expect(phase(actor)).toBe('lobby');
	expect(worldOf(actor).table).toMatchObject({ start: 'month', ready: {} });
	expect(reject(worldOf(actor), 'lobby', { type: 'READY', player: ann, start: 'prologue' })).toBe(
		'The table has chosen its game',
	);
	expect(reject(worldOf(actor), 'lobby', { type: 'READY', player: ann, start: 'month' })).toBe(
		'Pick or create a character first',
	);
	expect(reject(worldOf(actor), 'lobby', { type: 'READY', player: ben, start: 'month' })).toBe(
		'Pick or create a character for each seat first',
	);
	pickCharacters(actor);
	send(actor, { type: 'READY', player: ann, start: 'month' });
	expect(phase(actor)).toBe('lobby');
	send(actor, { type: 'READY', player: ben, start: 'month' });
	expect(phase(actor)).toBe('setup.supply');
	expect(worldOf(actor).table.start).toBeNull();
	const world = worldOf(actor);
	expect(world.campaign.month).toBe(1);
	expect(gameOf(actor).seats).toEqual([A, B, C]);
	const names = gameOf(actor).seats.map(
		seat => world.campaign.characters[gameOf(actor).players[seat]!.character]!.name,
	);
	expect(names).toEqual(['Ann', 'Ben', 'Ben 2']);
});

test('each person is dealt the character they played last, wherever they now sit', () => {
	const actor = lobby();
	begin(actor, 'prologue');
	const world = worldOf(actor);
	const played = { ann: world.game!.players[A]!.character, ben: world.game!.players[B]!.character };
	const swapped = structuredClone(world);
	swapped.game = null;
	swapped.table.seats = [
		{ seat: A, player: ben, name: 'Ben' },
		{ seat: B, player: ann, name: 'Ann' },
	];
	const next = createGameActor({ seed: 4, save: { v: 1, phase: 'lobby', world: swapped } }).start();
	begin(next, 'prologue');
	expect(gameOf(next).players[A]!.character).toBe(played.ben);
	expect(gameOf(next).players[B]!.character).toBe(played.ann);
});

test('taking or leaving a seat during a turn keeps the turn and its undo', () => {
	const actor = late();
	act(actor, { a: 'makeSupplies' });
	send(actor, { type: 'TAKE_SEAT', player: ann, name: 'Ann', seat: A });
	send(actor, { type: 'TAKE_SEAT', player: ben, name: 'Ben', seat: A });
	expect(actor.getSnapshot().context.undo.length).toBe(1);
	send(actor, { type: 'UNDO' });
	expect(worldOf(actor).table.seats).toEqual([{ seat: A, player: ben, name: 'Ben' }]);
	send(actor, { type: 'LEAVE', player: ben });
	expect(worldOf(actor).table.seats).toEqual([]);
});

test('a player plays the character they claimed, one per seat they hold, and nobody takes another player’s', () => {
	const actor = lobby();
	begin(actor, 'prologue');
	const lobbyAgain = structuredClone(worldOf(actor));
	lobbyAgain.game = null;
	const next = createGameActor({ seed: 5, save: { v: 1, phase: 'lobby', world: lobbyAgain } }).start();
	const [annChar, benChar] = [A, B].map(seat => worldOf(actor).game!.players[seat]!.character);
	expect(reject(worldOf(next), 'lobby', { type: 'CLAIM', player: ann, character: benChar! })).toBe(
		'Another player has that character',
	);
	send(next, { type: 'CREATE_CHARACTER', name: 'Ann Two', job: freeJob(worldOf(next)), home: HAVEN, player: ann });
	const created = Object.values(worldOf(next).campaign.characters).find(entry => entry.name === 'Ann Two')!;
	expect(worldOf(next).campaign.characters[annChar!]!.player).toBeNull();
	begin(next, 'month');
	expect(gameOf(next).players[A]!.character).toBe(created.id);
	expect(gameOf(next).players[B]!.character).toBe(benChar!);
});

test('loading a mid-campaign lobby starts at the lobby before moving to character select', () => {
	const actor = createGameActor({ seed: 7, save: campaignAt(8, 7) }).start();
	send(actor, { type: 'JOIN', player: ann, name: 'Ann' });
	send(actor, { type: 'JOIN', player: ben, name: 'Ben' });
	expect(phase(actor)).toBe('lobby');
	expect(tableStart(worldOf(actor))).toBeNull();
	send(actor, { type: 'READY', player: ann, start: 'month' });
	send(actor, { type: 'READY', player: ben, start: 'month' });
	expect(phase(actor)).toBe('lobby');
	expect(tableStart(worldOf(actor))).toBe('month');
	expect(reject(worldOf(actor), 'lobby', { type: 'READY', player: ann, start: 'month' })).toBe(
		'Pick or create a character first',
	);
	pickCharacters(actor);
	send(actor, { type: 'READY', player: ann, start: 'month' });
	send(actor, { type: 'READY', player: ben, start: 'month' });
	expect(phase(actor)).toBe('setup.supply');
});

test('returning players resume their previous seats and characters in a known game', () => {
	const actor = lobby();
	send(actor, { type: 'ADD_SEAT', player: ben });
	begin(actor, 'month');
	const before = worldOf(actor);
	const expected = {
		[A]: before.game!.players[A]!.character,
		[B]: before.game!.players[B]!.character,
		[C]: before.game!.players[C]!.character,
	};
	const saved = structuredClone(before);
	saved.game = null;
	saved.table.seats = [];
	saved.table.ready = {};
	saved.table.start = null;
	const resumed = createGameActor({ seed: 6, save: { v: 1, phase: 'lobby', world: saved } }).start();
	// Joining out of order still returns each player to the exact seat(s) they held.
	send(resumed, { type: 'JOIN', player: ben, name: 'Ben' });
	expect(worldOf(resumed).table.seats.map(entry => entry.seat)).toEqual([B, C]);
	send(resumed, { type: 'JOIN', player: ann, name: 'Ann' });
	expect(worldOf(resumed).table.seats).toEqual([
		{ seat: A, player: ann, name: 'Ann' },
		{ seat: B, player: ben, name: 'Ben' },
		{ seat: C, player: ben, name: 'Ben' },
	]);
	begin(resumed, 'month');
	expect(gameOf(resumed).players[A]!.character).toBe(expected[A]);
	expect(gameOf(resumed).players[B]!.character).toBe(expected[B]);
	expect(gameOf(resumed).players[C]!.character).toBe(expected[C]);
});

test('a Legacy briefing is drawn and flipped step by step, and stows only once every seated player agrees', () => {
	const actor = lobby();
	begin(actor, 'month');
	const total = openings(worldOf(actor).campaign.briefing).length;
	expect(total).toBeGreaterThan(1);
	expect(reject(worldOf(actor), phase(actor), { type: 'BRIEFING_READY', player: ann, ready: true })).toBe(
		'Draw and flip every card first',
	);
	for (let i = 0; i < total; i++) {
		send(actor, { type: 'BRIEFING_STEP' });
		expect(worldOf(actor).table.briefing).toMatchObject({ drawn: i + 1, flipped: false, stowing: false });
		send(actor, { type: 'BRIEFING_STEP' });
		expect(worldOf(actor).table.briefing).toMatchObject({ drawn: i + 1, flipped: true, stowing: false });
	}
	expect(reject(worldOf(actor), phase(actor), { type: 'BRIEFING_STEP' })).toBe('Everything is already drawn');
	send(actor, { type: 'BRIEFING_READY', player: ann, ready: true });
	expect(worldOf(actor).table.briefing).toMatchObject({ ready: [ann], stowing: false });
	send(actor, { type: 'BRIEFING_READY', player: ben, ready: true });
	expect(worldOf(actor).table.briefing.stowing).toBe(true);
	send(actor, { type: 'ACK_BRIEFING' });
	expect(worldOf(actor).campaign.briefing).toEqual([]);
	expect(worldOf(actor).table.briefing).toEqual({ drawn: 0, flipped: false, ready: [], stowing: false });
});
