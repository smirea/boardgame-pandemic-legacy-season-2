/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { cityHint, partHint } from './hints.ts';
import type { CityView } from './types.ts';

const lagos: CityView = {
	name: 'Lagos',
	revealed: true,
	onGrid: true,
	supplies: 7,
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
	odds: 0.25,
};

describe('board hints', () => {
	test('a city lists everything in it, and says which structures last', () => {
		expect(cityHint(lagos)).toEqual({
			title: 'Lagos',
			lines: [
				'Population 3',
				'Port: sea movement may start or end here',
				'7 supply cubes',
				'2 plague cubes',
				'1 Hollow Man',
				'Supply center, temporary',
				'Satellite tower, permanent',
				'Lab found here',
				'25% chance it is infected next',
			],
		});
	});

	test('a building says whether it stays for good', () => {
		expect(partHint({ structure: 'tower', permanent: true }, lagos).lines).toContain(
			'Permanent: printed on the board, it stands in every game.',
		);
		expect(partHint({ structure: 'center', permanent: false }, lagos).lines).toContain(
			'Temporary: removed when this game ends.',
		);
	});

	test('a city off the grid says so', () => {
		expect(cityHint({ ...lagos, onGrid: false }).lines.at(-1)).toMatch(/^Not on the grid/);
	});
});
