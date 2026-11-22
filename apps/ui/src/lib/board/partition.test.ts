/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { nearestGround, regionAt } from '@repo/game';
import { partition } from './partition';
import { FRAME } from './projection';
import type { BoardPoint } from './projection';

const bounds = { minX: FRAME.minX - 6, maxX: FRAME.maxX + 6, minZ: FRAME.minZ - 6, maxZ: FRAME.maxZ + 6 };
const { cells, borders } = partition(bounds);
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

function crosses(a: BoardPoint, b: BoardPoint, c: BoardPoint, d: BoardPoint) {
	const side = (p: BoardPoint, q: BoardPoint, r: BoardPoint) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
	return side(a, b, c) * side(a, b, d) <= 0 && side(c, d, a) * side(c, d, b) <= 0;
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

	test('a region line runs between every pair of neighbouring points that regionAt puts in different regions', () => {
		let changes = 0;
		for (let x = FRAME.minX; x < FRAME.maxX; x += STEP) {
			for (let z = FRAME.minZ; z < FRAME.maxZ; z += STEP) {
				const here = { x, z };
				for (const there of [
					{ x: x + STEP, z },
					{ x, z: z + STEP },
				]) {
					if (regionAt(here) === regionAt(there)) continue;
					changes++;
					expect(borders.some(border => crosses(here, there, border.from, border.to))).toBe(true);
				}
			}
		}
		expect(changes).toBeGreaterThan(100);
	});

	test('each drawn region line has a different region on either side', () => {
		for (const border of borders) {
			const mid = { x: (border.from.x + border.to.x) / 2, z: (border.from.z + border.to.z) / 2 };
			const length = Math.hypot(border.to.x - border.from.x, border.to.z - border.from.z);
			if (length < 1e-3) continue;
			const nx = -(border.to.z - border.from.z) / length;
			const nz = (border.to.x - border.from.x) / length;
			const left = regionAt({ x: mid.x + nx * 0.01, z: mid.z + nz * 0.01 });
			const right = regionAt({ x: mid.x - nx * 0.01, z: mid.z - nz * 0.01 });
			expect(left).not.toBe(right);
		}
	});
});
