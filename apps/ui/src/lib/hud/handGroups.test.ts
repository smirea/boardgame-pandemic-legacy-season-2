/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { pack } from '@repo/game';
import type { CardId, PlayerCard } from '@repo/game';
import { handGroups } from './handGroups.ts';

let next = 0;
const id = () => `c${next++}` as CardId;
const cityOf = (color: string) => pack.cities.find(city => city.color === color && city.kind === 'city')!;
const otherCityOf = (color: string) => pack.cities.filter(city => city.color === color && city.kind === 'city')[1]!;
const city = (
	color: string,
	extra: Partial<Extract<PlayerCard, { kind: 'city' }>> = {},
	which = cityOf,
): PlayerCard => ({
	id: id(),
	kind: 'city',
	city: which(color).id,
	improvement: null,
	search: [],
	...extra,
});
const event = (name: Extract<PlayerCard, { kind: 'event' }>['event']): PlayerCard => ({
	id: id(),
	kind: 'event',
	event: name,
	mode: 'rationed',
});
const name = (card: PlayerCard) =>
	card.kind === 'city'
		? pack.cities.find(c => c.id === card.city)!.name
		: card.kind === 'event'
			? card.event
			: card.kind;

describe('handGroups', () => {
	test('plain city cards stack by colour, with every card named in the tooltip', () => {
		const groups = handGroups([city('blue'), city('yellow'), city('blue'), city('blue', {}, otherCityOf)], name);
		expect(groups.map(group => [group.key, group.cards.length])).toEqual([
			['color:blue', 3],
			['color:yellow', 1],
		]);
		expect(groups[0]!.title).toBe(`3 blue city cards: ${cityOf('blue').name} ×2, ${otherCityOf('blue').name}`);
	});

	test('a city card with an improvement or search boxes, and each companion, stands alone', () => {
		const improved = city('blue', { improvement: 'double' });
		const searched = city('blue', {
			search: [{ scope: 'land', result: { t: 'actions', amount: 1 }, scratched: false }],
		});
		const companions: PlayerCard[] = [
			{ id: id(), kind: 'companion', companion: 'medic' },
			{ id: id(), kind: 'companion', companion: 'medic' },
		];
		const groups = handGroups([improved, city('blue'), searched, ...companions], name);
		expect(groups.map(group => group.cards.length)).toEqual([1, 1, 1, 1, 1]);
		expect(groups[0]!.key).toBe('color:blue');
		expect(groups.find(group => group.key === `card:${improved.id}`)!.mark).toBe('×2');
		expect(groups.find(group => group.key === `card:${searched.id}`)!.icon).toBeDefined();
	});

	test('the same event stacks; different events, and Produce Supplies with different boxes, do not', () => {
		const groups = handGroups(
			[
				event('supplyDrop'),
				event('quietNight'),
				event('supplyDrop'),
				{ id: id(), kind: 'produce', boxesLeft: 3 },
				{ id: id(), kind: 'produce', boxesLeft: 2 },
				city('red'),
			],
			name,
		);
		expect(groups.map(group => [group.key, group.cards.length])).toEqual([
			['color:red', 1],
			['produce:2', 1],
			['produce:3', 1],
			['event:quietNight:rationed', 1],
			['event:supplyDrop:rationed', 2],
		]);
		expect(groups.every(group => group.tone)).toBe(true);
	});
});
