/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { pack, routeCourse } from '@repo/game';
import type { CityId, EdgeDef, SeatId } from '@repo/game';
import { follows, travelOf } from './travel.ts';

const city = (id: string) => id as CityId;
const edge = (a: string, b: string, kind: 'land' | 'sea'): EdgeDef => ({ a: city(a), b: city(b), kind });
const move = (from: string, to: string, by: string) => ({
	t: 'move' as const,
	seat: 'seat-1' as SeatId,
	from: city(from),
	to: city(to),
	by,
	seq: 0,
});
const edges = [
	edge('washington', 'atlanta', 'land'),
	edge('washington', 'haven-mediterranean', 'sea'),
	edge('haven-mediterranean', 'istanbul', 'sea'),
];

describe('the vehicle a pawn travels in', () => {
	test('a drive along a supply line goes by road, along the line', () => {
		const way = travelOf(move('washington', 'atlanta', 'drive'), edges);
		expect(way.travel).toBe('land');
		expect(way.course).toEqual(routeCourse(city('washington'), city('atlanta'), 'land'));
	});

	test('a ferry along a sea lane goes by boat, along the lane', () => {
		const way = travelOf(move('haven-mediterranean', 'washington', 'drive'), edges);
		expect(way.travel).toBe('sea');
		expect(way.course!.at(0)).toEqual(pack.positions[city('haven-mediterranean')]!);
		expect(way.course!.at(-1)).toEqual(pack.positions[city('washington')]!);
	});

	test('a sailing goes by boat along every lane it crosses', () => {
		const way = travelOf(move('washington', 'istanbul', 'sail'), edges);
		expect(way.travel).toBe('sea');
		const first = routeCourse(city('washington'), city('haven-mediterranean'), 'sea');
		const second = routeCourse(city('haven-mediterranean'), city('istanbul'), 'sea');
		expect(way.course).toEqual([...first, ...second.slice(1)]);
	});

	test('a shuttle, an airlift, a runner and the administrator fly', () => {
		for (const by of ['shuttle', 'airlift', 'run', 'administrator'])
			expect(travelOf(move('washington', 'istanbul', by), edges)).toEqual({ travel: 'air', course: null });
	});
});

test('a pawn follows its course from any slot, even far off the centre of a crowded city', () => {
	const course = routeCourse(city('lagos'), city('haven-south-atlantic'), 'sea');
	const lagos = pack.positions[city('lagos')]!;
	const haven = pack.positions[city('haven-south-atlantic')]!;
	expect(follows(course, lagos, haven)).toBe(true);
	expect(follows(course, haven, lagos)).toBe(false);
	expect(follows(course, haven, haven)).toBe(false);
	expect(follows(null, lagos, haven)).toBe(false);
});
