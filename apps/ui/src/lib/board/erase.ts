import type { Stroke } from '#lib/session/protocol.ts';
import type { BoardPoint } from './projection';

const MIN_FRAGMENT_LENGTH = 0.15;
const EPS = 1e-6;

function dist(a: BoardPoint, b: BoardPoint): number {
	return Math.hypot(b.x - a.x, b.z - a.z);
}

function strokeLength(points: BoardPoint[]): number {
	let sum = 0;
	for (let i = 1; i < points.length; i++) sum += dist(points[i - 1]!, points[i]!);
	return sum;
}

function appendUnique(points: BoardPoint[], point: BoardPoint) {
	const last = points[points.length - 1];
	if (!last || dist(last, point) > 1e-4) points.push(point);
}

/**
 * Intersects segment `a -> b` with the closed disc `(center, radius)` and returns the sub-segments that lie
 * OUTSIDE the disc, in order along `a -> b`. `clipped` is true when any part of the segment was removed.
 */
function subtractDiscFromSegment(
	a: BoardPoint,
	b: BoardPoint,
	center: BoardPoint,
	radius: number,
): { kept: [BoardPoint, BoardPoint][]; clipped: boolean } {
	const dx = b.x - a.x;
	const dz = b.z - a.z;
	const fx = a.x - center.x;
	const fz = a.z - center.z;
	const aa = dx * dx + dz * dz;
	const r2 = radius * radius;

	if (aa < 1e-10) {
		const inside = fx * fx + fz * fz <= r2;
		return inside ? { kept: [], clipped: true } : { kept: [[a, b]], clipped: false };
	}

	const bb = 2 * (fx * dx + fz * dz);
	const cc = fx * fx + fz * fz - r2;
	const disc = bb * bb - 4 * aa * cc;

	if (disc <= 0) return { kept: [[a, b]], clipped: false };

	const sqrtD = Math.sqrt(disc);
	const t1 = (-bb - sqrtD) / (2 * aa);
	const t2 = (-bb + sqrtD) / (2 * aa);

	if (t2 <= EPS || t1 >= 1 - EPS) return { kept: [[a, b]], clipped: false };

	const at = (t: number): BoardPoint => ({ x: a.x + dx * t, z: a.z + dz * t });
	const kept: [BoardPoint, BoardPoint][] = [];
	if (t1 > EPS) kept.push([a, at(t1)]);
	if (t2 < 1 - EPS) kept.push([at(t2), b]);
	return { kept, clipped: true };
}

/**
 * Erases the parts of `strokes` falling inside the disc `(center, radius)`.
 * Untouched strokes keep their original object reference and id; split or trimmed strokes get fresh ids.
 */
export function eraseStrokesAt(
	strokes: Stroke[],
	center: BoardPoint,
	radius: number,
	nextId: () => string,
): { strokes: Stroke[]; changed: boolean } {
	let changed = false;
	const out: Stroke[] = [];

	for (const stroke of strokes) {
		if (stroke.points.length === 0) {
			changed = true;
			continue;
		}
		if (stroke.points.length === 1) {
			if (dist(stroke.points[0]!, center) <= radius) {
				changed = true;
			} else {
				out.push(stroke);
			}
			continue;
		}

		let strokeChanged = false;
		const pieces: BoardPoint[][] = [];
		let current: BoardPoint[] = [];

		for (let i = 1; i < stroke.points.length; i++) {
			const a = stroke.points[i - 1]!;
			const b = stroke.points[i]!;
			const { kept, clipped } = subtractDiscFromSegment(a, b, center, radius);
			if (!clipped) {
				appendUnique(current, a);
				appendUnique(current, b);
				continue;
			}
			strokeChanged = true;
			if (kept.length === 0) {
				if (current.length >= 2) pieces.push(current);
				current = [];
			} else if (kept.length === 1) {
				const [s, e] = kept[0]!;
				const continuesFromA = dist(s, a) <= 1e-3;
				if (continuesFromA) {
					appendUnique(current, s);
					appendUnique(current, e);
					if (current.length >= 2) pieces.push(current);
					current = [];
				} else {
					if (current.length >= 2) pieces.push(current);
					current = [s, e];
				}
			} else {
				const [firstStart, firstEnd] = kept[0]!;
				const [secondStart, secondEnd] = kept[1]!;
				appendUnique(current, firstStart);
				appendUnique(current, firstEnd);
				if (current.length >= 2) pieces.push(current);
				current = [secondStart, secondEnd];
			}
		}
		if (current.length >= 2) pieces.push(current);

		if (!strokeChanged) {
			out.push(stroke);
			continue;
		}

		changed = true;
		for (const piece of pieces) {
			if (strokeLength(piece) >= MIN_FRAGMENT_LENGTH) {
				out.push({ id: nextId(), points: piece });
			}
		}
	}

	return { strokes: changed ? out : strokes, changed };
}

/**
 * Erases along the drag segment from `from` to `to` so fast eraser swipes never skip over strokes.
 */
export function eraseStrokesAlong(
	strokes: Stroke[],
	from: BoardPoint | null,
	to: BoardPoint,
	radius: number,
	nextId: () => string,
): { strokes: Stroke[]; changed: boolean } {
	if (!from) return eraseStrokesAt(strokes, to, radius, nextId);
	const span = dist(from, to);
	const step = Math.max(0.25, radius * 0.45);
	const count = Math.max(1, Math.ceil(span / step));
	let current = strokes;
	let anyChanged = false;
	for (let i = 1; i <= count; i++) {
		const t = i / count;
		const center = { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t };
		const result = eraseStrokesAt(current, center, radius, nextId);
		if (result.changed) {
			anyChanged = true;
			current = result.strokes;
		}
	}
	return { strokes: current, changed: anyChanged };
}
