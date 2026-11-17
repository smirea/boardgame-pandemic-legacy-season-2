import { expect, test } from 'bun:test';
import { actionMenu, legalActions } from './options';
import { A, cityCards, give, late, worldOf } from './testkit';

test('the action menu lists every legal action once, under its kind', () => {
	const actor = late((world, game) => give(world, A, cityCards(world, game.players[A]!.location, 1)));
	const world = worldOf(actor);
	const menu = actionMenu(world, A);
	expect(menu.flatMap(choice => choice.actions)).toEqual(
		legalActions(world, A).toSorted((x, y) => menu.findIndex(c => c.a === x.a) - menu.findIndex(c => c.a === y.a)),
	);
	for (const choice of menu) expect(choice.reason === null).toBe(choice.actions.length > 0);
});
