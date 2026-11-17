import { segmentsCross } from './helpers';
import type { Point } from './helpers';

/**
 * When lines printed on the board read as tangled. `gen-geometry.ts` lays the starting lanes out so
 * none of this holds, and `board.test.ts` checks the generated board against the same measures.
 */

/** How near a line may pass a location it does not join. */
const LOCATION_CLEARANCE = 2.5;
/** Two lines closer than this read as one. */
const ALONGSIDE = 1.2;
/** Near the location they share, lines have to come together, so only this far from it do they count. */
const AWAY_FROM_ENDS = 3.2;
/** How much of one line may lie alongside another before it reads as running with it. */
const MAX_ALONGSIDE_LENGTH = 6;
const SAMPLE = 0.3;

const legs = (course: Point[]) => course.slice(1).map((to, index) => [course[index]!, to] as const);

function distanceToLeg(point: Point, [a, b]: readonly [Point, Point]) {
	const dx = b.x - a.x;
	const dz = b.z - a.z;
	const span = dx * dx + dz * dz;
	const t = span ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / span)) : 0;
	return Math.hypot(point.x - a.x - t * dx, point.z - a.z - t * dz);
}

const sameEnd = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.z - q.z) < 1e-6;

/** Whether two courses cross away from a location they share. */
export function coursesCross(one: Point[], other: Point[]) {
	const ends = [one[0]!, one.at(-1)!];
	if (ends.some(end => sameEnd(end, other[0]!) || sameEnd(end, other.at(-1)!))) return false;
	return legs(one).some(([a, b]) => legs(other).some(([c, d]) => segmentsCross(a, b, c, d)));
}

/** Whether one course runs alongside the other for a stretch, away from the ends of both. */
export function runAlongside(one: Point[], other: Point[]) {
	const ends = [one[0]!, one.at(-1)!, other[0]!, other.at(-1)!];
	const otherLegs = legs(other);
	let together = 0;
	for (const [a, b] of legs(one)) {
		const count = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / SAMPLE);
		for (let k = 0; k < count; k++) {
			const point = { x: a.x + ((b.x - a.x) * k) / count, z: a.z + ((b.z - a.z) * k) / count };
			if (ends.some(end => Math.hypot(point.x - end.x, point.z - end.z) < AWAY_FROM_ENDS)) continue;
			if (otherLegs.some(leg => distanceToLeg(point, leg) < ALONGSIDE)) together += SAMPLE;
		}
	}
	return together > MAX_ALONGSIDE_LENGTH;
}

/** Whether a course runs over a location that is not one of its ends. */
export function runsOver(course: Point[], location: Point) {
	if (sameEnd(location, course[0]!) || sameEnd(location, course.at(-1)!)) return false;
	return legs(course).some(leg => distanceToLeg(location, leg) < LOCATION_CLEARANCE);
}
