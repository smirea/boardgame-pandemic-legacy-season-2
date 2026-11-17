/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { pack } from '@repo/game';
import type { CardId, PlayerCard } from '@repo/game';
import { sortHand } from './handOrder.ts';

const cities = (color: string) => pack.cities.filter(city => city.color === color && city.kind === 'city');
const city = (id: string, color: string, index: number): PlayerCard => ({
	id: id as CardId,
	kind: 'city',
	city: cities(color)[index]!.id,
	improvement: null,
	search: [],
});
const name = (card: PlayerCard) =>
	card.kind === 'city' ? pack.cities.find(entry => entry.id === card.city)!.name : card.kind;

test('a hand reads city cards by colour then name, then events, Produce Supplies, companions and epidemics', () => {
	const [blueA, blueB] = cities('blue')
		.slice(0, 2)
		.map(entry => entry.name)
		.toSorted();
	const hand: PlayerCard[] = [
		{ id: 'p' as CardId, kind: 'produce', boxesLeft: 2 },
		city('r', 'red', 0),
		{ id: 'e' as CardId, kind: 'event', event: 'quietNight', mode: 'rationed' },
		city('b1', 'blue', 0),
		{ id: 'x' as CardId, kind: 'epidemic' },
		city('y', 'yellow', 0),
		city('b2', 'blue', 1),
		{ id: 'm' as CardId, kind: 'companion', companion: 'medic' },
	];
	const sorted = sortHand(hand, name);
	expect(sorted.map(card => card.kind)).toEqual([
		'city',
		'city',
		'city',
		'city',
		'event',
		'produce',
		'companion',
		'epidemic',
	]);
	expect(sorted.slice(0, 2).map(name)).toEqual([blueA, blueB]);
	expect(sorted.slice(2, 4).map(card => String(card.id))).toEqual(['y', 'r']);
	expect(sortHand(hand.toReversed(), name)).toEqual(sorted);
});
