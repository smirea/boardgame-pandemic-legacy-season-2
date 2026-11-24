/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { nearestGround } from '@repo/game';
import { partition } from './partition';
import { FRAME } from './projection';
import type { BoardPoint } from './projection';

const bounds = { minX: FRAME.minX - 6, maxX: FRAME.maxX + 6, minZ: FRAME.minZ - 6, maxZ: FRAME.maxZ + 6 };
const { cells } = partition(bounds);
const STEP = 0.43;

function inside(outline: BoardPoint[], point: BoardPoint, slack: number) {
	return outline.every((corner, index) => {
		const next = outline[(index + 1) % outline.length]!;
		const cross = (next.x - corner.x) * (point.z - corner.z) - (next.z - corner.z) * (point.x - corner.x);
		return cross * Math.sign(area(outline)) >= -slack;
	});
}

function area(outline: BoardPoint[]) {
	return outline.reduce((sum, corner, index) => {
		const next = outline[(index + 1) % outline.length]!;
		return sum + corner.x * next.z - next.x * corner.z;
	}, 0);
}

describe('the board draws the rules partition', () => {
	test('every point lies in the cell of the location nearestGround names', () => {
		const byId = new Map(cells.map(cell => [cell.id, cell.outline]));
		let checked = 0;
		for (let x = FRAME.minX; x <= FRAME.maxX; x += STEP) {
			for (let z = FRAME.minZ; z <= FRAME.maxZ; z += STEP) {
				const point = { x, z };
				expect(inside(byId.get(nearestGround(point))!, point, 1e-6)).toBe(true);
				checked++;
			}
		}
		expect(checked).toBeGreaterThan(100_000);
	});
});
