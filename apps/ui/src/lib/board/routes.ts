import type { EdgeDef } from '@repo/game';
import { edgeKey, pack, regionAt } from '@repo/game';
import { CatmullRomCurve3, Vector3 } from 'three';
import type { BoardPoint } from './projection';
import { LAND_HEIGHT } from './projection';

export const CITY_RADIUS = 1.9;
export const CITY_TOP = LAND_HEIGHT + 0.5;

function hash(text: string) {
	let h = 2166136261;
	for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
	return (h >>> 0) / 4294967295;
}

const SAMPLES = 64;

/** Where a route runs on the ground at `t`, bowed sideways by `bow` board units at its middle. */
function groundAt(a: BoardPoint, b: BoardPoint, bow: number, t: number): BoardPoint {
	const length = Math.hypot(b.x - a.x, b.z - a.z);
	const ux = (b.x - a.x) / length;
	const uz = (b.z - a.z) / length;
	const lift = Math.sin(Math.PI * t);
	return { x: a.x + (b.x - a.x) * t - uz * bow * lift, z: a.z + (b.z - a.z) * t + ux * bow * lift };
}

function crosses(a: BoardPoint, b: BoardPoint, c: BoardPoint, d: BoardPoint) {
	const side = (p: BoardPoint, q: BoardPoint, r: BoardPoint) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
	return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

/** What a drawn route visibly passes: the regions in order, and which other sea lanes it crosses. */
function footprint(route: EdgeDef, bow: number, lanes: EdgeDef[]) {
	const a = pack.positions[route.a]!;
	const b = pack.positions[route.b]!;
	const regions: string[] = [];
	const crossed = new Set<string>();
	let previous = groundAt(a, b, bow, 0);
	for (let step = 0; step <= SAMPLES; step++) {
		const point = groundAt(a, b, bow, step / SAMPLES);
		const region = regionAt(point);
		if (regions.at(-1) !== region) regions.push(region);
		for (const lane of lanes) {
			if (lane.a === route.a || lane.a === route.b || lane.b === route.a || lane.b === route.b) continue;
			if (crosses(previous, point, pack.positions[lane.a]!, pack.positions[lane.b]!))
				crossed.add(edgeKey(lane.a, lane.b));
		}
		previous = point;
	}
	return `${regions.join('>')}|${[...crossed].sort().join(',')}`;
}

/**
 * How far a route may bow sideways. Supply lines never bow: the rules test the straight segment. A sea
 * lane bows a little so parallel lanes fan out, but only as far as it still visibly crosses exactly the
 * region lines and lanes that its straight chord does, since the chord is what the rules count.
 */
export function routeBow(route: EdgeDef, lanes: EdgeDef[]): number {
	if (route.kind !== 'sea') return 0;
	const a = pack.positions[route.a]!;
	const b = pack.positions[route.b]!;
	const length = Math.hypot(b.x - a.x, b.z - a.z);
	const preferred = (hash(edgeKey(route.a, route.b)) - 0.5) * length * 0.16;
	const chord = footprint(route, 0, lanes);
	return [preferred, preferred / 2, preferred / 4].find(bow => footprint(route, bow, lanes) === chord) ?? 0;
}

/**
 * A route leaves each city at its rim. Supply lines lie flat and straight on the chart; sea lanes take
 * their allowed bow and a shallow lift, low enough that the camera's tilt does not carry them visibly off course.
 */
export function routeCurve(route: EdgeDef, a: BoardPoint, b: BoardPoint, bow = 0) {
	const length = Math.hypot(b.x - a.x, b.z - a.z);
	const inset = Math.min(CITY_RADIUS, length / 3) / length;
	const peak = route.kind === 'sea' ? Math.min(0.9, 0.2 + length * 0.015) : 0;
	const points: Vector3[] = [];
	const steps = Math.max(8, Math.ceil(length / 2));
	for (let i = 0; i <= steps; i++) {
		const t = inset + (1 - 2 * inset) * (i / steps);
		const ground = groundAt(a, b, bow, t);
		points.push(new Vector3(ground.x, CITY_TOP - 0.25 + peak * Math.sin(Math.PI * t), ground.z));
	}
	return new CatmullRomCurve3(points);
}
