import { expect, test } from 'bun:test';
import { actionMenu, legalActions } from './options';
import { A, B, cityCards, give, late, worldOf } from './testkit';

test('the action menu lists every legal action once, under its kind', () => {
	const actor = late((world, game) => give(world, A, cityCards(world, game.players[A]!.location, 1)));
	const world = worldOf(actor);
	const menu = actionMenu(world, A);
	expect(menu.flatMap(choice => choice.actions)).toEqual(
		legalActions(world, A).toSorted((x, y) => menu.findIndex(c => c.a === x.a) - menu.findIndex(c => c.a === y.a)),
	);
	for (const choice of menu) expect(choice.reason === null).toBe(choice.actions.length > 0);
});

test('an action the character cannot take now says why', () => {
	const menu = actionMenu(worldOf(late()), A);
	expect(menu.find(choice => choice.a === 'sail')?.reason).toBe('Needs a City card in hand');
	expect(menu.find(choice => choice.a === 'deliver')?.reason).toBe('Carry supply cubes first');
});

test('with no actions left, only free actions stay open', () => {
	const menu = actionMenu(worldOf(late((_, game) => void (game.actionsLeft = 0))), A);
	expect(menu.find(choice => choice.a === 'shuttle')?.reason).toBe('No actions left');
	expect(menu.find(choice => choice.a === 'pickUp')?.actions.length).toBeGreaterThan(0);
});

test('on another player turn every action names whose turn it is', () => {
	const menu = actionMenu(worldOf(late()), B);
	expect(menu.length).toBeGreaterThan(0);
	expect(menu.every(choice => choice.reason === 'Not your turn')).toBe(true);
});
