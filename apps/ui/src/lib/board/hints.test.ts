/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import type { CityId } from '@repo/game';
import { cityHint, partHint, reconHint, stockpileHint } from './hints.ts';
import type { CityView, ReconBoxView } from './types.ts';

const lagos: CityView = {
	name: 'Lagos',
	revealed: true,
	onGrid: true,
	supplies: 0,
	plague: 2,
	hollow: 1,
	population: 3,
	port: true,
	structures: [
		{ kind: 'center', permanent: false },
		{ kind: 'tower', permanent: true },
	],
	infested: false,
	forsaken: false,
	lab: true,
	highlight: null,
	infection: { odds: 0.25, inDeck: 2, discarded: 1 },
	cards: { inDeck: 1, inHands: 1, discarded: 0 },
};

describe('board hints', () => {
	test('a city lists its cards and conditions as label and value', () => {
		expect(cityHint(lagos).rows.map(entry => `${entry.label}: ${entry.value}`)).toEqual([
			'Infected next: 25%',
			'Infection cards: 2 in deck, 1 discarded',
			'Player cards: 1 in deck, 1 in hand, 0 discarded',
			'Lab: Found',
		]);
	});

	test("a city's heading carries its port and buildings before the name and its cubes after it", () => {
		expect(cityHint(lagos).marks).toEqual(['port', 'center', 'tower']);
		expect(cityHint(lagos).counts).toEqual([
			{ glyph: 'supplies', count: 0, tone: 'bad' },
			{ glyph: 'plague', count: 2, tone: 'bad' },
			{ glyph: 'hollow', count: 1, tone: 'bad' },
		]);
	});

	test('a quiet city shows only its supply cubes', () => {
		expect(cityHint({ ...lagos, supplies: 3, plague: 0, hollow: 0, port: false, structures: [] })).toMatchObject({
			marks: [],
			counts: [{ glyph: 'supplies', count: 3, tone: null }],
		});
	});

	test('a building says whether it stays for good', () => {
		expect(partHint({ structure: 'tower', permanent: true }, lagos).notes).toEqual([
			'Printed on the board, it stands in every game.',
		]);
		expect(partHint({ structure: 'center', permanent: false }, lagos).rows).toContainEqual({
			label: 'Lasts',
			value: 'This game only',
		});
	});
});

test('the stockpile says how many cubes are left', () => {
	expect(stockpileHint(19).rows).toEqual([{ label: 'Supply cubes left', value: '19', tone: null }]);
	expect(stockpileHint(0).rows[0]!.tone).toBe('bad');
});

describe('reconHint', () => {
	const box: ReconBoxView = {
		route: 'europe',
		city: 'london' as CityId,
		cityName: 'London',
		name: 'Europe',
		color: 'blue',
		count: 4,
		unique: true,
		needsCenter: true,
		reveals: [],
		state: 'blocked',
		reason: "Stand in the route's city",
	};

	test('prints the cost, the place, and why it cannot be taken now', () => {
		expect(reconHint(box)).toEqual({
			title: 'Europe',
			cost: '4 blue cards, each a different city',
			where: 'At London, with a supply center',
			status: "Stand in the route's city",
		});
	});

	test('a box that can be taken invites the click, and one any card pays says so', () => {
		const ready = reconHint({ ...box, unique: false, needsCenter: false, state: 'ready', reason: null });
		expect(ready.cost).toBe('Any 4 blue cards');
		expect(ready.where).toBe('At London');
		expect(ready.status).toBe('Click to recon');
	});
});
