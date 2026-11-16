import { describe, expect, test } from 'bun:test';
import { botCommand, createGameActor, publicState, reject, scenarios } from '@repo/game';
import type { CharacterId } from '@repo/game';
import { newAudit, observe, renderParity, untouched } from './audit.ts';
import { composite, heldUnplayable, optionsFor, seatOf } from './commands.ts';
import type { Who } from './commands.ts';
import { renderBoard, renderOptions, renderStatus } from './render.ts';

const players: Who[] = ['vex', 'sol', 'kit'].map((id, index) => ({
	index,
	id,
	name: id,
	seat: seatOf(index),
	lead: index === 0,
}));

/** Plays through the lab's own option lists, the way the playtesters do, with the bot covering the lobby and setup. */
function play(seed: number, months: number) {
	const actor = createGameActor({ seed }).start();
	const audit = newAudit();
	let random = seed;
	const pick = <T>(items: T[]) => items[(random = (random * 48271) % 2147483647) % items.length]!;
	const rng = { seed: seed * 31 + 7 };
	let previous = publicState(actor.getSnapshot());
	let sent = 0;
	while (previous.phase !== 'finished' && previous.world.campaign.month <= months) {
		const state = previous;
		const picks = Object.values(state.world.campaign.characters)
			.filter(character => !character.dead && !character.worker)
			.slice(0, 3)
			.map(character => character.id as CharacterId | null);
		const offered = players.map(who => optionsFor(state, who, picks));
		for (const options of offered) {
			const keys = options.map(option => option.key);
			expect(keys.filter((key, index) => keys.indexOf(key) !== index)).toEqual([]);
			for (const option of options) expect(reject(state.world, state.phase, option.command)).toBeNull();
		}
		const inPlay = state.phase.startsWith('playing') || state.phase === 'upkeep' || state.phase === 'over';
		const pool = offered.flat().filter(option => option.key !== 'undo');
		const turn = pool.filter(option => ['end', 'draw', 'infect', 'continue', 'finish-upkeep'].includes(option.key));
		const command =
			inPlay && pool.length
				? (turn.length && (pool.length === turn.length || pick([0, 1, 2]) === 0) ? pick(turn) : pick(pool)).command
				: botCommand(state.world, state.phase, rng, 3);
		actor.send(command);
		const next = publicState(actor.getSnapshot());
		observe(audit, state, next, command);
		previous = next;
		if (++sent > 60_000) throw new Error(`stuck in ${next.phase}, month ${next.world.campaign.month}`);
	}
	return { audit, state: previous };
}

describe('the lab plays the engine through its own option lists', () => {
	test('keys are unique, every listed option is legal, and the audit follows the campaign', () => {
		const { audit, state } = play(11, 4);
		expect(audit.games.length).toBeGreaterThanOrEqual(4);
		expect(audit.games.every(game => game.month === 0 || game.checks.length === 4)).toBe(true);
		expect(audit.problems.filter(problem => problem.text.startsWith('invariant'))).toEqual([]);
		expect(audit.problems.filter(problem => problem.text.startsWith('schedule'))).toEqual([]);
		const months = audit.games.flatMap(game => game.legacy.map(card => card.cardMonth));
		expect(new Set(months)).toEqual(new Set([1, 2, 3, 4]));
		expect(untouched(audit, state.world).done).toBeGreaterThan(30);
		expect(renderParity(audit, state.world, [])).toContain('## Legacy deck schedule');
	}, 120_000);

	test('the text views render at every phase without throwing', () => {
		const actor = createGameActor({ seed: 5 }).start();
		const rng = { seed: 99 };
		const phases = new Set<string>();
		for (let step = 0; step < 4000 && phases.size < 8; step++) {
			const state = publicState(actor.getSnapshot());
			if (!phases.has(state.phase)) {
				phases.add(state.phase);
				expect(renderStatus(state, players[1]!).length).toBeGreaterThan(20);
				expect(renderBoard(state.world).length).toBeGreaterThan(20);
				expect(typeof renderOptions(optionsFor(state, players[0]!, [null, null, null]))).toBe('string');
			}
			actor.send(botCommand(state.world, state.phase, rng, 3));
		}
		expect(phases.size).toBe(8);
	}, 120_000);
});

describe('choices with several targets', () => {
	test('a key with targets joined by + becomes one command, and a key it cannot build is refused', () => {
		const play = (city: string) =>
			({
				key: `play:safeHouses.9:${city}`,
				group: 'play safeHouses',
				desc: '',
				command: { type: 'PLAY', seat: seatOf(0), card: 'safeHouses#9', play: { e: 'safeHouses', cities: [city] } },
			}) as never;
		const options = [play('cairo'), play('lagos'), play('london')];
		expect(composite(options, 'play:safeHouses.9:cairo+london')).toEqual({
			type: 'PLAY',
			seat: seatOf(0),
			card: 'safeHouses#9',
			play: { e: 'safeHouses', cities: ['cairo', 'london'] },
		} as never);
		expect(composite(options, 'play:safeHouses.9:cairo+paris')).toBeNull();
		expect(composite(options, 'play:safeHouses.9:cairo')).toBeNull();
	});
});

describe('cards in hand that cannot be played', () => {
	test('a Supply Drop held with an empty reserve is listed with the reason', () => {
		const actor = createGameActor({ seed: 5, save: scenarios.october(5) }).start();
		const seating = Object.values(actor.getSnapshot().context.world.campaign.characters)
			.slice(0, 3)
			.map((character, index) => ({ seat: seatOf(index), character: character.id }));
		actor.send({ type: 'START_GAME', seating });
		for (const type of ['ACK_BRIEFING', 'AUTO_SUPPLY', 'CONFIRM_SUPPLY', 'CONFIRM_EVENTS'] as const)
			actor.send({ type });
		const state = structuredClone(publicState(actor.getSnapshot()));
		const { campaign } = state.world;
		const game = state.world.game!;
		const seat = seatOf(0);
		expect(heldUnplayable(state, seat)).toEqual([]);
		const drop = Object.values(campaign.playerCards).find(
			card => card.kind === 'event' && card.event === 'supplyDrop',
		)!;
		for (const player of Object.values(game.players)) player.hand = player.hand.filter(card => card !== drop.id);
		game.playerDeck.order = game.playerDeck.order.filter(card => card !== drop.id);
		game.players[seat]!.hand.push(drop.id);
		game.reserve = 0;
		expect(heldUnplayable(state, seat)).toEqual([
			'In your hand but not playable right now: Supply Drop (The reserve is empty, so there is nothing to drop).',
		]);
		game.reserve = 4;
		expect(heldUnplayable(state, seat)).toEqual([]);
	});
});
