import { describe, expect, test } from 'bun:test';
import { createActor } from 'xstate';
import { botCommand } from './bot';
import { pack } from './content/pack';
import { violations } from './invariants';
import { gameMachine, phaseOf, reject } from './machine';

function playCampaign(seed: number, seats: number) {
	const cubeTotals = new Map<number, number>();
	const actor = createActor(gameMachine, { input: { seed } }).start();
	const rng = { seed: seed * 7919 + 1 };
	let commands = 0;
	let stalled = 0;
	const actionsSeen = new Set<string>();
	while (phaseOf(actor.getSnapshot()) !== 'finished') {
		const before = actor.getSnapshot();
		const command = botCommand(before.context.world, phaseOf(before), rng, seats);
		const reason = reject(before.context.world, phaseOf(before), command);
		if (reason) throw new Error(`bot produced an illegal ${command.type}: ${reason}`);
		actor.send(command);
		if (command.type === 'ACTION') actionsSeen.add(command.action.a);
		const after = actor.getSnapshot();
		stalled = after.context.world === before.context.world ? stalled + 1 : 0;
		if (stalled > 50) throw new Error(`stalled in ${phaseOf(after)} after ${JSON.stringify(command)}`);
		const { campaign } = after.context.world;
		// The calendar in the top bar shows the board's printed count, so the Legacy cards must arrive at the same one.
		if (
			after.context.world.game &&
			phaseOf(after).startsWith('playing') &&
			campaign.required !== pack.numbers.requiredByMonth[campaign.month]
		)
			throw new Error(
				`month ${campaign.month} requires ${campaign.required}, the board prints ${pack.numbers.requiredByMonth[campaign.month]}`,
			);
		const problems = violations(after.context.world, cubeTotals);
		if (problems.length) throw new Error(`seed ${seed}, after ${JSON.stringify(command)}: ${problems.join('; ')}`);
		if (++commands > 400_000) {
			throw new Error(
				`campaign did not finish: month ${campaign.month}, ${campaign.results.length} games, phase ${phaseOf(after)}`,
			);
		}
	}
	return { campaign: actor.getSnapshot().context.world.campaign, commands, actionsSeen };
}

describe('full campaigns under a random bot', () => {
	const runs = Number(process.env.CAMPAIGNS ?? 12);

	test(`${runs} campaigns finish with every invariant intact`, () => {
		const actions = new Set<string>();
		const months = new Set<number>();
		let wins = 0;
		for (let seed = 1; seed <= runs; seed++) {
			const { campaign, actionsSeen } = playCampaign(seed, 2 + (seed % 3));
			expect(campaign.month).toBe(13);
			expect(campaign.results.filter(result => result.month === 12).length).toBeGreaterThanOrEqual(1);
			for (const action of actionsSeen) actions.add(action);
			for (const result of campaign.results) months.add(result.month);
			wins += campaign.results.filter(result => result.won).length;
		}
		console.log(`actions exercised: ${[...actions].sort().join(', ')}`);
		console.log(`games won: ${wins}`);
		expect(months.size).toBe(13);
	}, 600_000);
});
