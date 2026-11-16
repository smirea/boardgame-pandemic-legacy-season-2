#!/usr/bin/env bun
// Builds packages/game/src/content/geometry.generated.ts: board positions for every location, the
// pairs players may join with a supply line or sea lane, and the course each of those lines takes on
// the board. The rules test that course and the board draws it. Rerun after editing content/world.ts.
import { layoutCities } from '../src/lib/board/projection.ts';
import { edgeKey } from '../../../packages/game/src/ids.ts';
import { cities, documentedEdges, startingEdges } from '../../../packages/game/src/content/world.ts';
// Water is read from the same coastline the board draws, so a line the rules call dry looks dry.
import { isWater, seaCourse } from './waterways.ts';

const MAX_LAND_LENGTH = 46;
const MAX_SEA_LENGTH = 66;
// A lane that has to sail far around a coast to reach its port is not a lane anyone would chart.
const MAX_DETOUR = 1.45;
// A supply line may not cross water. The tolerance covers lakes, rivers and the coarseness of the coastline data.
const MAX_WATER_SHARE = 0.08;
const MAX_WATER_RUN = 1;
// Cities are nudged apart for legibility, which can leave a coastal city just offshore.
const COAST_MARGIN = 2;
const CLEARANCE = 3.2;
// How far a line bows sideways at its middle, as a share of its length. Lines take the largest bow that
// keeps them legal, so most arch gently and a few run straight.
const LAND_BOW = 0.06;
const SEA_BOW = 0.1;

const positions = layoutCities(cities);

type Point = { x: number; z: number };

function hash(text: string) {
	let h = 2166136261;
	for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
	return (h >>> 0) / 4294967295;
}

/** A line from `a` to `b` bowed sideways by `bow` board units at its middle, sampled densely enough to draw. */
function arch(a: Point, b: Point, bow: number): Point[] {
	const length = Math.hypot(b.x - a.x, b.z - a.z);
	const steps = bow === 0 ? 1 : Math.max(8, Math.ceil(length / 1.5));
	const ux = (b.x - a.x) / length;
	const uz = (b.z - a.z) / length;
	return Array.from({ length: steps + 1 }, (_, i) => {
		const t = i / steps;
		const lift = Math.sin(Math.PI * t) * bow;
		return { x: a.x + (b.x - a.x) * t - uz * lift, z: a.z + (b.z - a.z) * t + ux * lift };
	});
}

/** The arches a line may take, most bowed first. Which side it bows to is fixed per pair, so it never flickers. */
function arches(aId: string, bId: string, share: number): Point[][] {
	const a = positions[aId as keyof typeof positions];
	const b = positions[bId as keyof typeof positions];
	const length = Math.hypot(b.x - a.x, b.z - a.z);
	const bow = (hash(edgeKey(aId as never, bId as never)) < 0.5 ? -1 : 1) * share * length;
	return [bow, bow / 2, -bow / 2, 0].map(amount => arch(a, b, amount));
}

/** Ramer-Douglas-Peucker: drops points the line would pass within `tolerance` of anyway. */
function simplify(path: Point[], tolerance: number): Point[] {
	if (path.length < 3) return path;
	const a = path[0]!;
	const b = path.at(-1)!;
	const span = Math.hypot(b.x - a.x, b.z - a.z) || 1;
	let farthest = 0;
	let at = 0;
	for (let i = 1; i < path.length - 1; i++) {
		const p = path[i]!;
		const distance = Math.abs((b.x - a.x) * (a.z - p.z) - (a.x - p.x) * (b.z - a.z)) / span;
		if (distance > farthest) {
			farthest = distance;
			at = i;
		}
	}
	if (farthest <= tolerance) return [a, b];
	return [...simplify(path.slice(0, at + 1), tolerance).slice(0, -1), ...simplify(path.slice(at), tolerance)];
}

function length(path: Point[]) {
	let sum = 0;
	for (let i = 1; i < path.length; i++) sum += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.z - path[i - 1]!.z);
	return sum;
}

/** Points every `step` board units along a polyline, with how far along each one is. */
function walk(path: Point[], step: number) {
	const total = length(path);
	const points: { at: Point; along: number }[] = [];
	let segment = 1;
	let start = 0;
	for (let along = 0; along <= total; along += step) {
		let span = Math.hypot(path[segment]!.x - path[segment - 1]!.x, path[segment]!.z - path[segment - 1]!.z);
		while (along > start + span && segment < path.length - 1) {
			start += span;
			segment++;
			span = Math.hypot(path[segment]!.x - path[segment - 1]!.x, path[segment]!.z - path[segment - 1]!.z);
		}
		const a = path[segment - 1]!;
		const b = path[segment]!;
		const t = span ? Math.min(1, (along - start) / span) : 0;
		points.push({ at: { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, along });
	}
	return { points, total };
}

/** How much of the line is over water, and the longest unbroken stretch of it, away from both ends. */
function water(path: Point[]) {
	const { points, total } = walk(path, 0.25);
	let counted = 0;
	let wet = 0;
	let run = 0;
	let longest = 0;
	for (const { at, along } of points) {
		if (along < COAST_MARGIN || total - along < COAST_MARGIN) continue;
		counted++;
		if (!isWater(at)) {
			run = 0;
		} else {
			wet++;
			run += 0.25;
			longest = Math.max(longest, run);
		}
	}
	return { share: counted ? wet / counted : 0, run: longest };
}

/** Whether the path runs within `CLEARANCE` of a city other than its two ends, away from those ends. */
function passesNearAnotherCity(aId: string, bId: string, path: Point[]) {
	return cities.some(city => {
		if (city.id === aId || city.id === bId) return false;
		const p = positions[city.id];
		for (let i = 1; i < path.length; i++) {
			const a = path[i - 1]!;
			const b = path[i]!;
			const span = (b.x - a.x) ** 2 + (b.z - a.z) ** 2;
			const t = span ? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / span)) : 0;
			const x = a.x + (b.x - a.x) * t;
			const z = a.z + (b.z - a.z) * t;
			const fromEnds = Math.min(
				Math.hypot(x - path[0]!.x, z - path[0]!.z),
				Math.hypot(x - path.at(-1)!.x, z - path.at(-1)!.z),
			);
			if (fromEnds > CLEARANCE && Math.hypot(p.x - x, p.z - z) < CLEARANCE) return true;
		}
		return false;
	});
}

const candidates = new Map<string, { a: string; b: string; kind: 'land' | 'sea' }>();
const courses = new Map<string, Point[]>();
const routeKey = (kind: string, a: string, b: string) => `${kind}:${edgeKey(a as never, b as never)}`;

/** The first arch of a supply line that keeps off water and clear of other cities. */
function landCourse(a: string, b: string): Point[] | null {
	return (
		arches(a, b, LAND_BOW).find(path => {
			const over = water(path);
			return over.share <= MAX_WATER_SHARE && over.run <= MAX_WATER_RUN && !passesNearAnotherCity(a, b, path);
		}) ?? null
	);
}

// Documented campaigns drew on an abstract map, so a documented supply line still has to be dry here.
// The Legacy deck may still lay one of those; it is drawn as its least wet arch.
const wetDocumented: string[] = [];
for (const edge of [...startingEdges, ...documentedEdges]) {
	const key = routeKey(edge.kind, edge.a, edge.b);
	if (edge.kind === 'sea') {
		candidates.set(key, edge);
		continue;
	}
	const course = landCourse(edge.a, edge.b);
	if (course) {
		candidates.set(key, edge);
		courses.set(key, course);
	} else {
		wetDocumented.push(`${edge.a}-${edge.b}`);
		courses.set(key, arches(edge.a, edge.b, LAND_BOW).toSorted((x, y) => water(x).share - water(y).share)[0]!);
	}
}

for (let i = 0; i < cities.length; i++) {
	for (let j = i + 1; j < cities.length; j++) {
		const a = cities[i]!;
		const b = cities[j]!;
		const from = positions[a.id];
		const to = positions[b.id];
		const chord = Math.hypot(to.x - from.x, to.z - from.z);
		const landKey = routeKey('land', a.id, b.id);
		if (a.kind === 'city' && b.kind === 'city' && chord <= MAX_LAND_LENGTH && !courses.has(landKey)) {
			const course = landCourse(a.id, b.id);
			if (course) {
				candidates.set(landKey, { a: a.id, b: b.id, kind: 'land' });
				courses.set(landKey, course);
			}
		}
		const seaKey = routeKey('sea', a.id, b.id);
		const listed = candidates.has(seaKey);
		if (!a.port || !b.port || (!listed && chord > MAX_SEA_LENGTH)) continue;
		const course = seaCourse(from, to, arches(a.id, b.id, SEA_BOW));
		if (!course) {
			if (listed) throw new Error(`no water joins ${a.id} and ${b.id}`);
			continue;
		}
		const fits =
			course.length <= MAX_SEA_LENGTH &&
			course.length <= chord * MAX_DETOUR &&
			!passesNearAnotherCity(a.id, b.id, course.path);
		if (!listed && !fits) continue;
		candidates.set(seaKey, { a: a.id, b: b.id, kind: 'sea' });
		courses.set(seaKey, course.path);
	}
}

// The sample site is reached only through Utopia, which is what makes the Plan matter.
for (const [key, edge] of candidates) {
	const other = edge.a === 'lake-baikal' ? edge.b : edge.b === 'lake-baikal' ? edge.a : null;
	if (other && other !== 'utopia') candidates.delete(key);
}
for (const key of courses.keys()) {
	const [kind, pair] = key.split(':') as ['land' | 'sea', string];
	const [a, b] = pair.split('~') as [string, string];
	const laidByTheDeck = wetDocumented.includes(`${a}-${b}`) || wetDocumented.includes(`${b}-${a}`);
	if (!candidates.has(key) && !(kind === 'land' && laidByTheDeck)) courses.delete(key);
}

// Every city must still be reachable by some line, or a rule change here could strand it for a whole campaign.
for (const city of cities) {
	if (![...candidates.values()].some(edge => edge.a === city.id || edge.b === city.id))
		throw new Error(`${city.id} has no possible connection`);
}

const sorted = [...candidates.values()].sort((x, y) => `${x.kind}${x.a}${x.b}`.localeCompare(`${y.kind}${y.a}${y.b}`));
const output = `// Generated by scripts/gen-geometry.ts. Do not edit by hand.
import type { CityId } from '../ids';
import type { EdgeDef } from './types';

export const positions = ${JSON.stringify(positions, null, '\t')} as Record<CityId, { x: number; z: number }>;

export const candidateEdges = ${JSON.stringify(sorted)} as EdgeDef[];

/**
 * The course each line takes on the board, keyed by kind and \`edgeKey\`, from the lesser id's end to
 * the other's. The rules test this course and the board draws it.
 */
export const routeCourses: Record<string, [number, number][]> = ${JSON.stringify(
	Object.fromEntries(
		[...courses]
			.sort(([x], [y]) => x.localeCompare(y))
			.map(([key, path]) => {
				const first = positions[key.split(':')[1]!.split('~')[0] as keyof typeof positions];
				const forward = Math.hypot(path[0]!.x - first.x, path[0]!.z - first.z) < 1e-6;
				const round = (value: number) => Math.round(value * 100) / 100;
				const course = simplify(forward ? path : path.toReversed(), 0.02);
				return [key, course.map(point => [round(point.x), round(point.z)])];
			}),
	),
)};
`;
await Bun.write(new URL('../../../packages/game/src/content/geometry.generated.ts', import.meta.url), output);
console.log(`documented supply lines left out for crossing water: ${wetDocumented.join(', ') || 'none'}`);
console.log(
	`positions: ${cities.length}, land candidates: ${sorted.filter(edge => edge.kind === 'land').length}, sea candidates: ${sorted.filter(edge => edge.kind === 'sea').length}`,
);
