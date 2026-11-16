import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import landTopology from 'world-atlas/land-50m.json';
import { FRAME, project, projectPolygons } from '../src/lib/board/projection.ts';
import type { BoardPoint } from '../src/lib/board/projection.ts';

const CELL = 0.3;
const ROWS_PER_CELL = 6;
// A cell is sea when at least this much of it is water. Half keeps Gibraltar and the Bosporus open and
// Panama and Suez shut.
const WET_SHARE = 0.5;
// A lane keeps this far off any coast where it can, so its tube never sits on the shore.
const CLEARANCE = 0.6;
const HARBOUR = 2.5;
// Straits narrower than a cell that real shipping uses, as [lat, lon] courses. They are cut open by hand.
const STRAITS: [number, number][][] = [
	[
		[39.9, 25.9],
		[40.2, 26.4],
		[40.45, 26.7],
		[40.7, 27.6],
		[40.95, 28.9],
		[41.25, 29.1],
	],
];

type Point = BoardPoint;

const columns = Math.ceil((FRAME.maxX - FRAME.minX) / CELL);
const rows = Math.ceil((FRAME.maxZ - FRAME.minZ) / CELL);
const index = (column: number, row: number) => row * columns + column;
const cellOf = (point: Point) => ({
	column: Math.min(columns - 1, Math.max(0, Math.floor((point.x - FRAME.minX) / CELL))),
	row: Math.min(rows - 1, Math.max(0, Math.floor((point.z - FRAME.minZ) / CELL))),
});
const centre = (column: number, row: number): Point => ({
	x: FRAME.minX + (column + 0.5) * CELL,
	z: FRAME.minZ + (row + 0.5) * CELL,
});

/** Per cell: how much of it is water, 0 to 1. Scanlines over the projected coast, even-odd. */
function rasterize() {
	const water = new Float32Array(columns * rows);
	const topology = landTopology as unknown as Topology;
	const edges: [Point, Point][] = [];
	for (const polygon of projectPolygons(feature(topology, topology.objects['land']!)))
		for (const ring of polygon) ring.forEach((point, i) => edges.push([point, ring[(i + 1) % ring.length]!]));
	const lines = rows * ROWS_PER_CELL;
	const crossings: number[][] = Array.from({ length: lines }, () => []);
	const lineZ = (line: number) => FRAME.minZ + ((line + 0.5) * CELL) / ROWS_PER_CELL;
	for (const [a, b] of edges) {
		if (a.z === b.z) continue;
		const low = Math.max(0, Math.ceil(((Math.min(a.z, b.z) - FRAME.minZ) * ROWS_PER_CELL) / CELL - 0.5));
		const high = Math.min(lines - 1, Math.floor(((Math.max(a.z, b.z) - FRAME.minZ) * ROWS_PER_CELL) / CELL - 0.5));
		for (let line = low; line <= high; line++) {
			const z = lineZ(line);
			if ((z - a.z) * (z - b.z) > 0) continue;
			crossings[line]!.push(a.x + ((z - a.z) / (b.z - a.z)) * (b.x - a.x));
		}
	}
	const share = 1 / (CELL * ROWS_PER_CELL);
	const mark = (row: number, from: number, to: number) => {
		const first = Math.max(0, Math.floor((from - FRAME.minX) / CELL));
		const last = Math.min(columns - 1, Math.floor((to - FRAME.minX) / CELL));
		for (let column = first; column <= last; column++) {
			const left = FRAME.minX + column * CELL;
			const covered = Math.min(to, left + CELL) - Math.max(from, left);
			if (covered > 0) water[index(column, row)]! += covered * share;
		}
	};
	for (let line = 0; line < lines; line++) {
		const row = Math.floor(line / ROWS_PER_CELL);
		const xs = crossings[line]!.sort((p, q) => p - q);
		let x = FRAME.minX;
		for (let i = 0; i + 1 < xs.length; i += 2) {
			if (xs[i]! > x) mark(row, x, xs[i]!);
			x = xs[i + 1]!;
		}
		if (x < FRAME.maxX) mark(row, x, FRAME.maxX);
	}
	return water;
}

const water = rasterize();
const wet = Uint8Array.from(water, share => (share >= WET_SHARE ? 1 : 0));
for (const strait of STRAITS) {
	const course = strait.map(([lat, lon]) => project(lat, lon));
	for (let i = 1; i < course.length; i++) {
		const a = course[i - 1]!;
		const b = course[i]!;
		const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (CELL / 3));
		for (let s = 0; s <= steps; s++) {
			const { column, row } = cellOf({ x: a.x + ((b.x - a.x) * s) / steps, z: a.z + ((b.z - a.z) * s) / steps });
			wet[index(column, row)] = 1;
		}
	}
}
/** Whether the point is sea: more than half its cell is water, or it lies in a strait cut open by hand. */
export const isWater = (point: Point) => wet[index(cellOf(point).column, cellOf(point).row)] === 1;
const dry = Uint8Array.from(water, share => (share < 0.98 ? 1 : 0));

/** Distance from each cell to the nearest cell with any land in it, in board units (chamfer). */
const shore = (() => {
	const distance = new Float32Array(columns * rows).fill(Number.POSITIVE_INFINITY);
	for (let i = 0; i < distance.length; i++) if (dry[i]) distance[i] = 0;
	const pass = (order: 1 | -1) => {
		const steps: [number, number, number][] =
			order === 1
				? [
						[-1, 0, 1],
						[0, -1, 1],
						[-1, -1, Math.SQRT2],
						[1, -1, Math.SQRT2],
					]
				: [
						[1, 0, 1],
						[0, 1, 1],
						[1, 1, Math.SQRT2],
						[-1, 1, Math.SQRT2],
					];
		for (let r = 0; r < rows; r++) {
			const row = order === 1 ? r : rows - 1 - r;
			for (let c = 0; c < columns; c++) {
				const column = order === 1 ? c : columns - 1 - c;
				let best = distance[index(column, row)]!;
				for (const [dc, dr, cost] of steps) {
					const nc = column + dc;
					const nr = row + dr;
					if (nc < 0 || nr < 0 || nc >= columns || nr >= rows) continue;
					best = Math.min(best, distance[index(nc, nr)]! + cost * CELL);
				}
				distance[index(column, row)] = best;
			}
		}
	};
	pass(1);
	pass(-1);
	return distance;
})();

class Heap {
	#items: [number, number][] = [];
	get size() {
		return this.#items.length;
	}
	push(key: number, value: number) {
		const items = this.#items;
		items.push([key, value]);
		let i = items.length - 1;
		while (i > 0) {
			const parent = (i - 1) >> 1;
			if (items[parent]![0] <= key) break;
			[items[parent], items[i]] = [items[i]!, items[parent]!];
			i = parent;
		}
	}
	pop(): number {
		const items = this.#items;
		const top = items[0]![1];
		const last = items.pop()!;
		if (items.length) {
			items[0] = last;
			let i = 0;
			for (;;) {
				const left = i * 2 + 1;
				const right = left + 1;
				let smallest = i;
				if (left < items.length && items[left]![0] < items[smallest]![0]) smallest = left;
				if (right < items.length && items[right]![0] < items[smallest]![0]) smallest = right;
				if (smallest === i) break;
				[items[smallest], items[i]] = [items[i]!, items[smallest]!];
				i = smallest;
			}
		}
		return top;
	}
}

const NEIGHBOURS: [number, number, number][] = [
	[1, 0, 1],
	[-1, 0, 1],
	[0, 1, 1],
	[0, -1, 1],
	[1, 1, Math.SQRT2],
	[1, -1, Math.SQRT2],
	[-1, 1, Math.SQRT2],
	[-1, -1, Math.SQRT2],
];

/**
 * How much ground a lane may cross to leave a port: just enough to reach the nearest sea. Ports are
 * nudged off their true spot for legibility, which can leave one inland, but no further than that, or a
 * port between two seas (Cairo) would sail into both.
 */
const reaches = new Map<string, number>();
function reach(port: Point) {
	const key = `${port.x},${port.z}`;
	const known = reaches.get(key);
	if (known !== undefined) return known;
	let nearest = Number.POSITIVE_INFINITY;
	for (let i = 0; i < wet.length; i++) {
		if (!wet[i]) continue;
		const at = centre(i % columns, Math.floor(i / columns));
		nearest = Math.min(nearest, Math.hypot(at.x - port.x, at.z - port.z));
	}
	reaches.set(key, nearest + CELL);
	return nearest + CELL;
}

const near = (point: Point, port: Point, radius: number) => Math.hypot(point.x - port.x, point.z - port.z) <= radius;

/** A* over water from one port to another. Cells near a coast cost more, so the lane keeps to open sea. */
function search(a: Point, b: Point, reachA: number, reachB: number): number[] | null {
	const passable = (i: number) => {
		if (wet[i]) return true;
		const at = centre(i % columns, Math.floor(i / columns));
		return near(at, a, reachA) || near(at, b, reachB);
	};
	const weight = (i: number) => 1 + 2.5 * Math.max(0, 1 - shore[i]! / 2);
	const start = cellOf(a);
	const goal = cellOf(b);
	const startIndex = index(start.column, start.row);
	const goalIndex = index(goal.column, goal.row);
	const cost = new Map<number, number>([[startIndex, 0]]);
	const previous = new Map<number, number>();
	const heap = new Heap();
	heap.push(0, startIndex);
	const closed = new Set<number>();
	while (heap.size) {
		const current = heap.pop();
		if (current === goalIndex) {
			const path = [current];
			while (previous.has(path.at(-1)!)) path.push(previous.get(path.at(-1)!)!);
			return path.reverse();
		}
		if (closed.has(current)) continue;
		closed.add(current);
		const column = current % columns;
		const row = Math.floor(current / columns);
		for (const [dc, dr, step] of NEIGHBOURS) {
			const nc = column + dc;
			const nr = row + dr;
			if (nc < 0 || nr < 0 || nc >= columns || nr >= rows) continue;
			const next = index(nc, nr);
			if (closed.has(next) || !passable(next)) continue;
			const total = cost.get(current)! + step * CELL * weight(next);
			if (total >= (cost.get(next) ?? Number.POSITIVE_INFINITY)) continue;
			cost.set(next, total);
			previous.set(next, current);
			heap.push(total + Math.hypot(nc - goal.column, nr - goal.row) * CELL, next);
		}
	}
	return null;
}

function length(path: Point[]) {
	let sum = 0;
	for (let i = 1; i < path.length; i++) sum += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.z - path[i - 1]!.z);
	return sum;
}

/** Whether every point along the polyline is open sea, a cell the search itself went through, or a port's reach. */
function sails(path: Point[], allowed: (point: Point) => boolean) {
	for (let i = 1; i < path.length; i++) {
		const a = path[i - 1]!;
		const b = path[i]!;
		const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (CELL / 3)));
		for (let s = 0; s <= steps; s++) {
			const t = s / steps;
			if (!allowed({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })) return false;
		}
	}
	return true;
}

const rounded = (path: Point[]) =>
	path.map(point => ({ x: Math.round(point.x * 100) / 100, z: Math.round(point.z * 100) / 100 }));

/** Open sea well off any coast, or the ground a lane may cross to leave either port. */
function openSea(a: Point, b: Point) {
	const reachA = reach(a);
	const reachB = reach(b);
	return (point: Point) => {
		if (near(point, a, reachA) || near(point, b, reachB)) return true;
		const i = index(cellOf(point).column, cellOf(point).row);
		if (!wet[i]) return false;
		// Leaving harbour, a lane has to pass close to the coast it starts from.
		return shore[i]! >= CLEARANCE || near(point, a, reachA + HARBOUR) || near(point, b, reachB + HARBOUR);
	};
}

/**
 * Over water from rim to rim, as straight as the coasts allow: the corners of the shortest way, and a
 * test for whether a line between them is still at sea.
 */
function waterway(a: Point, b: Point): { corners: Point[]; water: (point: Point) => boolean } | null {
	const reachA = reach(a);
	const reachB = reach(b);
	const cells = search(a, b, reachA, reachB);
	if (!cells) return null;
	const visited = new Set(cells);
	const open = openSea(a, b);
	const allowed = (point: Point) => open(point) || visited.has(index(cellOf(point).column, cellOf(point).row));
	const raw = [a, ...cells.slice(1, -1).map(i => centre(i % columns, Math.floor(i / columns))), b];
	// String pulling: from each corner, run straight to the furthest later point still in open water.
	const corners = [raw[0]!];
	let from = 0;
	while (from < raw.length - 1) {
		let to = raw.length - 1;
		while (to > from + 1 && !sails([raw[from]!, raw[to]!], allowed)) to--;
		corners.push(raw[to]!);
		from = to;
	}
	return { corners, water: point => allowed(point) || isWater(point) };
}

/**
 * A smooth curve through `points`: one cubic per stretch, with each handle along the direction through
 * its point and `reach` of a third of the stretch long, so the curve never kinks at a point.
 */
function spline(points: Point[], reach: number): Point[] {
	const direction = (i: number) => {
		const before = points[Math.max(0, i - 1)]!;
		const after = points[Math.min(points.length - 1, i + 1)]!;
		const span = Math.hypot(after.x - before.x, after.z - before.z) || 1;
		return { x: (after.x - before.x) / span, z: (after.z - before.z) / span };
	};
	const out: Point[] = [points[0]!];
	for (let i = 0; i + 1 < points.length; i++) {
		const a = points[i]!;
		const b = points[i + 1]!;
		const span = Math.hypot(b.x - a.x, b.z - a.z);
		const handle = (span / 3) * reach;
		const p = { x: a.x + direction(i).x * handle, z: a.z + direction(i).z * handle };
		const q = { x: b.x - direction(i + 1).x * handle, z: b.z - direction(i + 1).z * handle };
		out.push(...bezier(a, p, q, b, Math.max(6, Math.ceil(span / 1.2))).slice(1));
	}
	return out;
}

function bezier(a: Point, p: Point, q: Point, b: Point, steps: number): Point[] {
	return Array.from({ length: steps + 1 }, (_, i) => {
		const t = i / steps;
		const u = 1 - t;
		return {
			x: u * u * u * a.x + 3 * u * u * t * p.x + 3 * u * t * t * q.x + t * t * t * b.x,
			z: u * u * u * a.z + 3 * u * u * t * p.z + 3 * u * t * t * q.z + t * t * t * b.z,
		};
	});
}

/** Cubic Béziers from `a` to `b` whose handles swing out to either side, shortest first. */
function sweeps(a: Point, b: Point): Point[][] {
	const chord = Math.hypot(b.x - a.x, b.z - a.z);
	const nx = -(b.z - a.z) / chord;
	const nz = (b.x - a.x) / chord;
	const steps = Math.max(12, Math.ceil(chord / 1.2));
	const handle = (along: number, out: number) => ({
		x: a.x + (b.x - a.x) * along + nx * out * chord,
		z: a.z + (b.z - a.z) * along + nz * out * chord,
	});
	const curves: Point[][] = [];
	for (const along of [0.2, 0.35, 0.5])
		for (const back of [0.5, 0.65, 0.8])
			for (let first = -12; first <= 12; first++)
				for (let second = -12; second <= 12; second++)
					curves.push(bezier(a, handle(along, first * 0.08), handle(back, second * 0.08), b, steps));
	return curves
		.map(curve => ({ curve, length: length(curve) }))
		.sort((x, y) => x.length - y.length)
		.map(({ curve }) => curve);
}

/**
 * The course a sea lane sails between two ports: the first of the `arches` that keeps to open sea, or
 * else the shortest smooth curve that keeps to the sea, either one Bézier sweep or a curve through the
 * corners of the way around the coasts. Null when no water joins them.
 */
export function seaCourse(a: Point, b: Point, arches: Point[][]): { path: Point[]; length: number } | null {
	const open = openSea(a, b);
	const way = waterway(a, b);
	if (!way) return null;
	const curves = sweeps(a, b);
	const smooth = [0.75, 0.5, 0.25].map(reach => spline(way.corners, reach)).find(curve => sails(curve, way.water));
	const options = [
		curves.find(curve => sails(curve, open)),
		curves.find(curve => sails(curve, way.water)),
		smooth ?? way.corners,
	].filter(curve => curve !== undefined);
	const path = arches.find(arch => sails(arch, open)) ?? options.toSorted((x, y) => length(x) - length(y))[0]!;
	const course = rounded(path);
	return { path: course, length: length(course) };
}
