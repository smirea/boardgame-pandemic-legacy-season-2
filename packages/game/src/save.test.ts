import { expect, test } from 'bun:test';
import { botCommand } from './bot';
import { createGameActor, parseSave, phaseOf } from './machine';
import type { Save } from './machine';
import { publicState } from './view';

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
});
