/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import type { SeatId } from '@repo/game';
import { placeSeats } from './seats.ts';

const seats = ['s1', 's2', 's3', 's4'] as SeatId[];
const layout = (places: Map<string, SeatId>) =>
	Object.fromEntries([...places].map(([place, seat]): [string, string] => [place, seat]));

describe('placeSeats', () => {
	test('this browser sits bottom right and turn order runs clockwise from there', () => {
		expect(layout(placeSeats(seats, 's3' as SeatId))).toEqual({ br: 's3', bl: 's4', tl: 's1', tr: 's2' });
	});

	test('without a seat of its own, the first player sits bottom right', () => {
		expect(layout(placeSeats(seats.slice(0, 3), undefined))).toEqual({ br: 's1', bl: 's2', tl: 's3' });
	});
});
