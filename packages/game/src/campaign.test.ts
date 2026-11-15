import { describe, expect, test } from 'bun:test';
import { createActor } from 'xstate';
import { botCommand } from './bot';
import { pack } from './content/pack';
import { grid } from './helpers';
import { gameMachine, phaseOf, reject } from './machine';
import type { World } from './state';

/** Rules that must hold after every single command, whatever the bot did. */
function violations(world: World): string[] {
	const { campaign, game } = world;
	const problems: string[] = [];
	for (const [id, record] of Object.entries(campaign.locations)) {
		if (record.population < 0 || record.population > 8) problems.push(`population of ${id} is ${record.population}`);
	}
	if (!game) return problems;
	const cubes =
		Object.values(game.locations).reduce((sum, location) => sum + location.supplies, 0) +
		Object.values(game.players).reduce((sum, player) => sum + player.supplies, 0);
	if (game.stockpile < 0 || game.reserve < 0 || cubes < 0) problems.push('a cube pool went negative');
	const plague = Object.values(game.locations).reduce((sum, location) => sum + location.plague, 0);
	if (plague > game.incidents) problems.push(`${plague} plague cubes but only ${game.incidents} incidents`);
	for (const [id, location] of Object.entries(game.locations)) {
		if (location.plague > 3 || location.plague < 0) problems.push(`${id} holds ${location.plague} plague cubes`);
		if (location.hollow > 3 || location.hollow < 0) problems.push(`${id} holds ${location.hollow} Hollow Men`);
		if (location.supplies < 0) problems.push(`${id} holds ${location.supplies} cubes`);
	}
	if (Object.values(game.pieces).some(count => count < 0)) problems.push('a piece supply went negative');
	const everywhere = [
		...game.playerDeck.order,
		...game.playerDiscard,
		...Object.values(game.players).flatMap(player => player.hand),
	];
	if (new Set(everywhere).size !== everywhere.length) problems.push('a Player card exists in two places');
	const infection = [
		...game.infectionDeck.order,
		...game.infectionDiscard,
		...game.gameEndArea.filter(id => id in campaign.infectionCards),
	];
	if (new Set(infection).size !== infection.length) problems.push('an Infection card exists in two places');
	if (game.infectionDeck.strata.flat().length !== game.infectionDeck.order.length)
		problems.push('infection strata drifted from the deck');
	if (game.playerDeck.piles.reduce((sum, pile) => sum + pile.size, 0) !== game.playerDeck.order.length)
		problems.push('player piles drifted from the deck');
	const onGrid = grid(campaign);
	for (const player of Object.values(game.players)) {
		if (!campaign.locations[player.location]?.revealed) problems.push(`a pawn stands on unrevealed ${player.location}`);
		if (player.supplies < 0) problems.push('a character holds negative cubes');
	}
	if (game.incidents > pack.numbers.incidentLimit) problems.push('incidents ran past the limit');
	if (onGrid.size < 12) problems.push('the grid shrank');
	return problems;
}

function playCampaign(seed: number, seats: number) {
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
		const problems = violations(after.context.world);
		if (problems.length) throw new Error(`seed ${seed}, after ${JSON.stringify(command)}: ${problems.join('; ')}`);
		if (++commands > 400_000) {
			const { campaign } = after.context.world;
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
