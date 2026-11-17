/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { placeReconBoxes } from './reconLayout.ts';
import type { ReconRect } from './reconLayout.ts';

const size = { width: 20, depth: 10 };
const contains = (rect: ReconRect, point: { x: number; z: number }) =>
	Math.abs(rect.x - point.x) * 2 < rect.width && Math.abs(rect.z - point.z) * 2 < rect.depth;

describe('placeReconBoxes', () => {
	test('a box reaches from its city toward what it reveals, clear of the city', () => {
		const from = { x: 0, z: 0 };
		const rect = placeReconBoxes([{ route: 'r', from, toward: { x: 50, z: 0 } }], [from], size).get('r')!;
		expect(rect.x).toBeGreaterThan(size.width / 2);
		expect(rect.z).toBe(0);
		expect(contains(rect, from)).toBe(false);
	});

	test('a box turns aside rather than cover another city, and two boxes never overlap', () => {
		const from = { x: 0, z: 0 };
		const blocker = { x: 20, z: 0 };
		const placed = placeReconBoxes(
			[
				{ route: 'a', from, toward: { x: 50, z: 0 } },
				{ route: 'b', from, toward: null },
			],
			[from, blocker],
			size,
		);
		const a = placed.get('a')!;
		const b = placed.get('b')!;
		expect(contains(a, blocker)).toBe(false);
		expect(Math.abs(a.x - b.x) * 2 >= size.width || Math.abs(a.z - b.z) * 2 >= size.depth).toBe(true);
		expect(b.z).toBeLessThan(0);
	});
});
