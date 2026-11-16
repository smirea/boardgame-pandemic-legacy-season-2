import { expect, test } from 'bun:test';
import { pack } from './content/pack';
import { routeCourse, segmentsCross } from './helpers';
import type { Point } from './helpers';

const startingEdges = pack.edges;
const courseOf = (edge: (typeof startingEdges)[number]) => routeCourse(edge.a, edge.b, edge.kind);
const legs = (course: Point[]) => course.slice(1).map((to, index) => [course[index]!, to] as const);

function distanceToLeg(point: Point, [a, b]: readonly [Point, Point]) {
	const dx = b.x - a.x;
	const dz = b.z - a.z;
	const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz)));
	return Math.hypot(point.x - a.x - t * dx, point.z - a.z - t * dz);
}

test('no two starting lines cross', () => {
	const crossings: string[] = [];
	startingEdges.forEach((one, index) => {
		for (const other of startingEdges.slice(index + 1)) {
			if ([one.a, one.b].some(end => end === other.a || end === other.b)) continue;
			const cross = legs(courseOf(one)).some(leg =>
				legs(courseOf(other)).some(([c, d]) => segmentsCross(leg[0], leg[1], c, d)),
			);
			if (cross) crossings.push(`${one.a}-${one.b} x ${other.a}-${other.b}`);
		}
	});
	expect(crossings).toEqual([]);
});

test('no starting line runs over a location it does not join', () => {
	const ends = new Set(startingEdges.flatMap(edge => [edge.a, edge.b]));
	const over: string[] = [];
	for (const edge of startingEdges)
		for (const city of ends) {
			if (city === edge.a || city === edge.b) continue;
			const at = pack.positions[city]!;
			if (legs(courseOf(edge)).some(leg => distanceToLeg(at, leg) < 2.5)) over.push(`${edge.a}-${edge.b} over ${city}`);
		}
	expect(over).toEqual([]);
});

test('no two starting lines run alongside each other away from the location they share', () => {
	const samples = (course: Point[]) =>
		legs(course).flatMap(([a, b]) => {
			const count = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.3);
			return Array.from({ length: count }, (_, k) => ({
				x: a.x + ((b.x - a.x) * k) / count,
				z: a.z + ((b.z - a.z) * k) / count,
			}));
		});
	const together: string[] = [];
	startingEdges.forEach((one, index) => {
		for (const other of startingEdges.slice(index + 1)) {
			const course = courseOf(one);
			const otherCourse = courseOf(other);
			const ends = [course[0]!, course.at(-1)!, otherCourse[0]!, otherCourse.at(-1)!];
			const alongside = samples(course).filter(
				point =>
					ends.every(end => Math.hypot(point.x - end.x, point.z - end.z) >= 3.2) &&
					legs(otherCourse).some(leg => distanceToLeg(point, leg) < 1.2),
			).length;
			if (alongside * 0.3 > 6) together.push(`${one.a}-${one.b} with ${other.a}-${other.b}`);
		}
	});
	expect(together).toEqual([]);
});
