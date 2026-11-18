import { expect, test } from 'bun:test';
import { pack } from './content/pack';
import type { JobId } from './content/types';
import type { CityId, PlayerId } from './ids';
import { createGameActor, reject } from './machine';
import type { Start, World } from './state';
import { tablePlayers } from './table';
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

/** Everyone agrees on the game at month 0, then readies again once they have chosen characters. */
function begin(actor: ReturnType<typeof lobby>, start: Start) {
	for (let round = 0; round < 2 && phase(actor) === 'lobby'; round++)
		for (const player of tablePlayers(worldOf(actor).table)) send(actor, { type: 'READY', player, start });
}

test('the lobby picks the game everyone readies for, then starts it once everyone is ready with characters', () => {
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
