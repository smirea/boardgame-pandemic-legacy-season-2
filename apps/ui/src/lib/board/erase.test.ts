import { describe, expect, test } from 'bun:test';
import type { Stroke } from '#lib/session/protocol.ts';
import { eraseStrokesAlong, eraseStrokesAt } from './erase';

let seq = 0;
const nextId = () => `cut-${++seq}`;

describe('map drawing eraser', () => {
	test('erasing through the middle of a stroke splits it into two clean segments around the disc', () => {
		const stroke: Stroke = {
			id: 's1',
			points: [
				{ x: 0, z: 0 },
				{ x: 10, z: 0 },
			],
		};
		const result = eraseStrokesAt([stroke], { x: 5, z: 0 }, 1.5, nextId);
		expect(result.changed).toBe(true);
		expect(result.strokes).toHaveLength(2);
		expect(result.strokes[0]!.points[0]).toEqual({ x: 0, z: 0 });
		expect(result.strokes[0]!.points[1]!.x).toBeCloseTo(3.5, 4);
		expect(result.strokes[1]!.points[0]!.x).toBeCloseTo(6.5, 4);
		expect(result.strokes[1]!.points[1]).toEqual({ x: 10, z: 0 });
	});

	test('erasing an endpoint trims only the covered end and leaves the rest intact', () => {
		const stroke: Stroke = {
			id: 's2',
			points: [
				{ x: 0, z: 0 },
				{ x: 5, z: 0 },
				{ x: 10, z: 0 },
			],
		};
		const result = eraseStrokesAt([stroke], { x: 10, z: 0 }, 2, nextId);
		expect(result.changed).toBe(true);
		expect(result.strokes).toHaveLength(1);
		expect(result.strokes[0]!.points[0]).toEqual({ x: 0, z: 0 });
		expect(result.strokes[0]!.points.at(-1)!.x).toBeCloseTo(8, 4);
	});

	test('erasing away from a stroke preserves the original stroke reference unchanged', () => {
		const untouched: Stroke = {
			id: 'keep',
			points: [
				{ x: 0, z: 0 },
				{ x: 5, z: 0 },
			],
		};
		const result = eraseStrokesAt([untouched], { x: 20, z: 20 }, 2, nextId);
		expect(result.changed).toBe(false);
		expect(result.strokes[0]).toBe(untouched);
	});

	test('erasing a single-point dot removes it when inside the radius', () => {
		const dot: Stroke = { id: 'dot', points: [{ x: 3, z: 4 }] };
		expect(eraseStrokesAt([dot], { x: 3.5, z: 4 }, 1, nextId).strokes).toHaveLength(0);
		expect(eraseStrokesAt([dot], { x: 10, z: 4 }, 1, nextId).strokes).toHaveLength(1);
	});

	test('a fast eraser swipe across a stroke still cuts it cleanly', () => {
		const vertical: Stroke = {
			id: 'v1',
			points: [
				{ x: 5, z: 0 },
				{ x: 5, z: 10 },
			],
		};
		const result = eraseStrokesAlong([vertical], { x: 0, z: 5 }, { x: 10, z: 5 }, 1, nextId);
		expect(result.changed).toBe(true);
		expect(result.strokes).toHaveLength(2);
		expect(result.strokes[0]!.points.at(-1)!.z).toBeCloseTo(4, 1);
		expect(result.strokes[1]!.points[0]!.z).toBeCloseTo(6, 1);
	});
});
