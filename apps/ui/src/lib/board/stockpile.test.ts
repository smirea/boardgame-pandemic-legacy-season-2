/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import type { CityId } from '@repo/game';
import { PILE, supplyMoves } from './stockpile.ts';
import type { SupplySnapshot } from './stockpile.ts';

const cairo = 'cairo' as CityId;
const lagos = 'lagos' as CityId;
const at = (stockpile: number, cities: SupplySnapshot['cities'], carried = 0): SupplySnapshot => ({
	stockpile,
	cities,
	pawns: [{ id: 'seat-1', city: cairo, carried }],
});

describe('the stockpile', () => {
	test('holds a whole month of cubes, and every cube rests on the layer below', () => {
		expect(PILE.length).toBeGreaterThanOrEqual(60);
		for (const [index, slot] of PILE.entries()) {
			if (slot.y < 0.5) continue;
			const below = PILE.slice(0, index).filter(
				other => Math.abs(other.y - (slot.y - 0.7)) < 0.01 && Math.hypot(other.x - slot.x, other.z - slot.z) < 0.7,
			);
			expect(below.length).toBe(4);
		}
	});

	test('cubes placed from it fly to their cities, and cubes removed fly back', () => {
		expect(supplyMoves(at(10, { [cairo]: 0 }), at(7, { [cairo]: 2, [lagos]: 1 }))).toEqual([
			{ from: { kind: 'pile' }, to: { kind: 'city', city: cairo } },
			{ from: { kind: 'pile' }, to: { kind: 'city', city: cairo } },
			{ from: { kind: 'pile' }, to: { kind: 'city', city: lagos } },
		]);
		expect(supplyMoves(at(7, { [cairo]: 2 }), at(8, { [cairo]: 1 }))).toEqual([
			{ from: { kind: 'city', city: cairo }, to: { kind: 'pile' } },
		]);
	});

	test('a cube a player takes or drops travels with the pawn', () => {
		expect(supplyMoves(at(5, {}), at(4, {}, 1))).toEqual([
			{ from: { kind: 'pile' }, to: { kind: 'pawn', pawn: 'seat-1', city: cairo } },
		]);
		expect(supplyMoves(at(4, { [cairo]: 0 }, 1), at(4, { [cairo]: 1 }, 0))).toEqual([
			{ from: { kind: 'pawn', pawn: 'seat-1', city: cairo }, to: { kind: 'city', city: cairo } },
		]);
	});

	test('a cube that leaves the board, or arrives from off it, does not fly', () => {
		expect(supplyMoves(at(5, { [cairo]: 2 }), at(5, { [cairo]: 0 }))).toEqual([]);
		expect(supplyMoves(at(5, {}), at(9, {}))).toEqual([]);
	});
});
