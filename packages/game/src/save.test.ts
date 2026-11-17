import { expect, test } from 'bun:test';
import { botCommand } from './bot';
import { pack } from './content/pack';
import type { EdgeDef } from './content/types';
import { edge, retiredStartingEdges } from './content/world';
import { edgeKey } from './ids';
import { city } from './testkit';
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

test('a campaign begun on a board with the retired starting lanes loads with today’s, keeping the lanes players built', () => {
	const actor = createGameActor({ seed: 11 }).start();
	const rng = { seed: 5 };
	for (let i = 0; i < 40; i++)
		actor.send(botCommand(actor.getSnapshot().context.world, phaseOf(actor.getSnapshot()), rng));
	const state = publicState(actor.getSnapshot());
	const built = edge('new-york', 'chicago', 'land');
	const oldBoard = [
		...pack.edges.filter(lane => edgeKey(lane.a, lane.b) !== edgeKey(city('tripoli'), city('istanbul'))),
		...retiredStartingEdges,
		built,
	];
	const written = JSON.parse(JSON.stringify({ v: 1, phase: state.phase, world: state.world }));
	written.world.campaign.edges = oldBoard;

	const save = parseSave(written);
	const keys = (lanes: EdgeDef[]) => lanes.map(lane => `${lane.kind}:${edgeKey(lane.a, lane.b)}`).toSorted();
	expect(keys(save.world.campaign.edges)).toEqual(keys([...pack.edges, built]));

	const resumed = createGameActor({ seed: 999, save }).start();
	for (let i = 0; i < 40; i++)
		resumed.send(botCommand(resumed.getSnapshot().context.world, phaseOf(resumed.getSnapshot()), rng));
	expect(phaseOf(resumed.getSnapshot())).not.toBe('lobby');
});

test('a campaign begun on today’s board keeps a lane players built that an older board started with', () => {
	const actor = createGameActor({ seed: 11 }).start();
	const state = publicState(actor.getSnapshot());
	const built = retiredStartingEdges[0]!;
	const written = JSON.parse(JSON.stringify({ v: 1, phase: state.phase, world: state.world }));
	written.world.campaign.edges = [...pack.edges, built];
	expect(parseSave(written).world.campaign.edges).toEqual([...pack.edges, built]);
});
