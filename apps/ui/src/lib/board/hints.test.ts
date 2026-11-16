/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { cityHint, partHint } from './hints.ts';
import type { CityView } from './types.ts';

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
};

const row = (label: string) => cityHint(lagos).rows.find(entry => entry.label === label);

describe('board hints', () => {
	test('a city lists everything in it as label and value', () => {
		expect(cityHint(lagos).rows.map(entry => `${entry.label}: ${entry.value}`)).toEqual([
			'Population: 3',
			'Supply cubes: 0',
			'Plague cubes: 2',
			'Hollow Men: 1',
			'Infected next: 25%',
			'Infection cards: 2 in deck, 1 discarded',
			'Supply center: Temporary',
			'Satellite tower: Permanent',
			'Lab: Found',
			'Port: Sea moves start or end here',
			'Grid: Connected',
		]);
	});

	test('an empty city shows its zero supply cubes as a warning', () => {
		expect(row('Supply cubes')).toEqual({ label: 'Supply cubes', value: '0', tone: 'bad' });
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

	test('a city off the grid says so', () => {
		expect(cityHint({ ...lagos, onGrid: false }).rows.at(-1)).toEqual({
			label: 'Grid',
			value: 'Not connected',
			tone: 'bad',
		});
	});
});
