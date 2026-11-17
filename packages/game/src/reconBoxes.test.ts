import { describe, expect, test } from 'bun:test';
import { createGameActor } from './machine';
import { campaignAt } from './scenarios';
import { A, act, B, city, cityCards, give, late, worldOf } from './testkit';
import { reconBoxes } from './view';

const PLAN = 'hidden:plan-blue';

const atShanghai = (cards: boolean) =>
	late((world, game) => {
		world.campaign.routes.push(PLAN);
		game.players[A]!.location = city(cards ? 'shanghai' : 'tokyo');
		if (cards)
			give(world, A, [...cityCards(world, 'london'), ...cityCards(world, 'new-york'), ...cityCards(world, 'paris')]);
	});

describe('reconBoxes', () => {
	test('a known route offers its legal recons, and taking one removes its box', () => {
		const actor = atShanghai(true);
		const box = reconBoxes(worldOf(actor), 'playing.actions').find(entry => entry.route.id === PLAN)!;
		expect(box.reason).toBeNull();
		expect(box.name).toBe('Plan step: blue');
		expect(box.actions.length).toBeGreaterThan(0);
		act(actor, box.actions[0]!);
		expect(reconBoxes(worldOf(actor), 'playing.actions').some(entry => entry.route.id === PLAN)).toBe(false);
	});

	test('a route that cannot be taken says why, in the engine’s words', () => {
		const box = reconBoxes(worldOf(atShanghai(false)), 'playing.actions').find(entry => entry.route.id === PLAN)!;
		expect(box.actions).toEqual([]);
		expect(box.reason).toBe("Stand in the route's city");
		const elsewhere = reconBoxes(worldOf(atShanghai(true)), 'playing.draw').find(entry => entry.route.id === PLAN)!;
		expect(elsewhere.reason).toBe('Not available right now');
	});

	test('January offers the routes printed on its board, each pointing at the region it reveals', () => {
		const actor = createGameActor({ seed: 3, save: campaignAt(1) }).start();
		actor.send({
			type: 'START_GAME',
			seating: Object.values(worldOf(actor).campaign.characters)
				.slice(0, 2)
				.map((entry, index) => ({ seat: [A, B][index]!, character: entry.id })),
		});
		for (const type of ['ACK_BRIEFING', 'AUTO_SUPPLY', 'CONFIRM_SUPPLY', 'CONFIRM_EVENTS'] as const)
			actor.send({ type });
		const boxes = reconBoxes(worldOf(actor), 'playing.actions');
		expect(boxes.map(box => box.route.id)).toEqual([
			'north-america',
			'south-america',
			'europe',
			'africa',
			'middle-east',
		]);
		for (const box of boxes) {
			expect(box.reveals.length).toBeGreaterThan(0);
			expect(box.reason).toBeTruthy();
		}
	});
});
