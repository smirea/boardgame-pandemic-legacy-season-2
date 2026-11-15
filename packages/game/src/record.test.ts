import { describe, expect, test } from 'bun:test';
import { botCommand } from './bot';
import { createGameActor } from './machine';
import type { GameRecord } from './record';
import { applyPatches, diff, framesOf, gameIndexOf, parseRecord, recordStep, startRecord } from './record';
import type { PublicState } from './view';
import { publicState } from './view';

/** Records a bot's games the way the host does: one recording per game, the lobby before it included. */
function recordGames(seed: number, games: number) {
	const actor = createGameActor({ seed }).start();
	const rng = { seed: seed + 1 };
	const records: GameRecord[] = [];
	const states: PublicState[][] = [];
	let before = publicState(actor.getSnapshot());
	let record = startRecord(before, 0);
	let seen = [before];
	for (let at = 1; records.length < games; at++) {
		const command = botCommand(before.world, before.phase, rng, 3);
		actor.send(command);
		const after = publicState(actor.getSnapshot());
		if (recordStep(record, before, after, { at, by: 'bot', command })) seen.push(after);
		if (gameIndexOf(after) !== gameIndexOf(record.initial)) {
			records.push(record);
			states.push(seen);
			record = startRecord(after, at);
			seen = [after];
		}
		before = after;
	}
	return { records, states };
}

describe('game recordings', () => {
	test('a recording plays back every state exactly, after a trip through JSON', () => {
		const { records, states } = recordGames(7, 3);
		for (const [index, record] of records.entries()) {
			const frames = framesOf(parseRecord(JSON.parse(JSON.stringify(record))));
			expect(frames).toHaveLength(states[index]!.length);
			for (const [step, frame] of frames.entries()) expect(frame).toEqual(states[index]![step]!);
		}
	});

	test('a recording is named for the game it holds and ends when that game closes', () => {
		const { records } = recordGames(7, 3);
		expect(records.map(record => record.id.slice(0, 3))).toEqual(['g00', 'g01', 'g02']);
		for (const record of records) {
			expect(record.steps.at(-1)!.command).toEqual({ type: 'FINISH_UPKEEP' });
			expect(record.steps.some(step => step.command?.type === 'START_GAME')).toBe(true);
		}
	});

	test('steps stay small: a long log scrolling off its front is one patch, not hundreds', () => {
		const { records } = recordGames(11, 4);
		const steps = records.flatMap(record => record.steps);
		const bytes = steps.map(step => JSON.stringify(step.patch).length).toSorted((a, b) => a - b);
		expect(bytes[Math.floor(bytes.length / 2)]!).toBeLessThan(2_000);
		const before = { log: Array.from({ length: 400 }, (_, seq) => ({ seq })) };
		const after = { log: [...before.log.slice(1), { seq: 400 }] };
		expect(diff(before, after)).toEqual([
			{ p: ['log'], shift: 1 },
			{ p: ['log', 399], v: { seq: 400 } },
		]);
	});

	test('patches cover sets, deletions, growth and shrinkage without touching the original', () => {
		const before = { a: 1, gone: true, list: [1, 2, 3, 4], nested: { keep: 'x', deep: [{ id: 1 }] } };
		const after = { a: 2, list: [1, 9], nested: { keep: 'x', deep: [{ id: 1 }, { id: 2 }] }, added: null };
		const frozen = JSON.stringify(before);
		expect(applyPatches<unknown>(before, diff(before, after))).toEqual(after);
		expect(JSON.stringify(before)).toBe(frozen);
		expect(applyPatches(before, diff(before, after)).nested.keep).toBe('x');
	});

	test('a file that is not a recording is refused', () => {
		expect(() => parseRecord({ v: 1, phase: 'lobby', world: {} })).toThrow('not a game recording');
	});
});
