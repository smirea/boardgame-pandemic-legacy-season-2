import { segmentsCross } from './helpers';
import type { Point } from './helpers';

/**
 * When lines printed on the board read as tangled. `gen-geometry.ts` lays the starting lanes out so
 * none of this holds, and `lanes.test.ts` checks the generated board against the same measures.
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

/** Where two segments cross, or null when they do not. */
function crossing(a: Point, b: Point, c: Point, d: Point): Point | null {
	if (!segmentsCross(a, b, c, d)) return null;
	const denominator = (b.x - a.x) * (d.z - c.z) - (b.z - a.z) * (d.x - c.x);
	const t = ((c.x - a.x) * (d.z - c.z) - (c.z - a.z) * (d.x - c.x)) / denominator;
	return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}

/**
 * Whether two courses cross anywhere but near a location they share. Lanes into a port up a strait (Istanbul past
 * the Dardanelles) meet in the strait, not at the disc's rim, so they may cross as far out as they may run together.
 */
export function coursesCross(one: Point[], other: Point[]) {
	const shared = [one[0]!, one.at(-1)!].filter(end => sameEnd(end, other[0]!) || sameEnd(end, other.at(-1)!));
	return legs(one).some(([a, b]) =>
		legs(other).some(([c, d]) => {
			const at = crossing(a, b, c, d);
			return at !== null && shared.every(end => Math.hypot(at.x - end.x, at.z - end.z) >= AWAY_FROM_ENDS);
		}),
	);
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
