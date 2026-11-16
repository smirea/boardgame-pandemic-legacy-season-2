import { geoGraticule } from 'd3-geo';
import type { GeoPermissibleObjects } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import landTopology from 'world-atlas/land-50m.json';
import coarseTopology from 'world-atlas/land-110m.json';
import { boardPath, FRAME, project } from './projection';
import type { BoardBounds, BoardPoint } from './projection';

/**
 * The board is a printed chart: one canvas for the charted world and one for the same sheet with the
 * ink gone, which shows through wherever a region is still unknown. Both share the paper and the wear,
 * so the two blend without a seam.
 */

const PIXELS = 4096;
const INK = '52 39 27';
const SEA_INK = '36 72 106';
const RULE_INK = '139 74 51';

type Ctx = CanvasRenderingContext2D;

function random(seed: number) {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = seed;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function sheet(width: number, height: number) {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	return { canvas, ctx: canvas.getContext('2d')! };
}

function blot(ctx: Ctx, x: number, y: number, radius: number, rgb: string, alpha: number) {
	const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
	gradient.addColorStop(0, `rgb(${rgb} / ${alpha})`);
	gradient.addColorStop(1, `rgb(${rgb} / 0)`);
	ctx.fillStyle = gradient;
	ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

/** A closed outline that wanders around a circle, for stains. */
function wobble(x: number, y: number, radius: number, rand: () => number) {
	const path = new Path2D();
	const phases = [rand() * 6.28, rand() * 6.28, rand() * 6.28];
	for (let i = 0; i <= 64; i++) {
		const a = (i / 64) * Math.PI * 2;
		const r =
			radius *
			(1 +
				0.12 * Math.sin(a * 2 + phases[0]!) +
				0.07 * Math.sin(a * 5 + phases[1]!) +
				0.04 * Math.sin(a * 11 + phases[2]!));
		if (i === 0) path.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
		else path.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
	}
	path.closePath();
	return path;
}

/** The sheet's torn outline: a ragged inset of the rectangle with a bite out of two edges. */
function tornEdge(width: number, height: number, rand: () => number) {
	const inset = width * 0.0042;
	const phases = Array.from({ length: 6 }, () => rand() * 100);
	const bites = [
		{ at: 0.18 + rand() * 0.1, depth: inset * 3.5, span: 0.035 },
		{ at: 0.62 + rand() * 0.1, depth: inset * 2.2, span: 0.05 },
	];
	const ragged = (t: number, side: number) =>
		inset *
			(1.1 +
				0.6 * Math.sin(t * 23 + phases[side]!) +
				0.3 * Math.sin(t * 71 + phases[side]! * 2) +
				0.15 * Math.sin(t * 197 + phases[side]! * 3) +
				0.12 * (rand() - 0.5)) +
		(side === 2 || side === 1
			? bites.reduce(
					(sum, bite, index) =>
						sum + (index === side - 1 ? Math.max(0, 1 - Math.abs(t - bite.at) / bite.span) * bite.depth : 0),
					0,
				)
			: 0);
	const path = new Path2D();
	const step = 6;
	for (let x = 0; x <= width; x += step) {
		const y = ragged(x / width, 0);
		if (x === 0) path.moveTo(x + inset, y);
		else path.lineTo(x, y);
	}
	for (let y = 0; y <= height; y += step) path.lineTo(width - ragged(y / height, 1), y);
	for (let x = width; x >= 0; x -= step) path.lineTo(x, height - ragged(x / width, 2));
	for (let y = height; y >= 0; y -= step) path.lineTo(ragged(y / height, 3), y);
	path.closePath();
	return path;
}

function paper(width: number, height: number) {
	const rand = random(11);
	const { canvas, ctx } = sheet(width, height);
	ctx.fillStyle = '#d6c7a5';
	ctx.fillRect(0, 0, width, height);
	for (let i = 0; i < 170; i++) {
		const dark = rand() < 0.55;
		blot(
			ctx,
			rand() * width,
			rand() * height,
			(0.04 + rand() * 0.2) * width,
			dark ? '118 86 48' : '250 244 226',
			dark ? 0.02 + rand() * 0.06 : 0.03 + rand() * 0.07,
		);
	}
	const grain = sheet(512, 512);
	const pixels = grain.ctx.createImageData(512, 512);
	for (let i = 0; i < pixels.data.length; i += 4) {
		const value = 214 + rand() * 41;
		pixels.data[i] = value;
		pixels.data[i + 1] = value - 3;
		pixels.data[i + 2] = value - 9;
		pixels.data[i + 3] = 255;
	}
	grain.ctx.putImageData(pixels, 0, 0);
	ctx.globalCompositeOperation = 'multiply';
	ctx.globalAlpha = 0.45;
	ctx.fillStyle = ctx.createPattern(grain.canvas, 'repeat')!;
	ctx.fillRect(0, 0, width, height);
	ctx.globalAlpha = 1;
	ctx.globalCompositeOperation = 'source-over';
	for (let i = 0; i < 3200; i++) {
		const x = rand() * width;
		const y = rand() * height;
		const angle = rand() * Math.PI;
		const length = 4 + rand() * 12;
		ctx.strokeStyle =
			rand() < 0.5 ? `rgb(110 82 50 / ${0.05 + rand() * 0.08})` : `rgb(250 245 230 / ${0.08 + rand() * 0.1})`;
		ctx.lineWidth = 0.6 + rand() * 0.6;
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.quadraticCurveTo(
			x + Math.cos(angle) * length * 0.5 + (rand() - 0.5) * 3,
			y + Math.sin(angle) * length * 0.5 + (rand() - 0.5) * 3,
			x + Math.cos(angle) * length,
			y + Math.sin(angle) * length,
		);
		ctx.stroke();
	}
	return canvas;
}

/** Folds, tide marks, foxing and a scorched torn edge. Drawn with a fixed seed so both sheets age the same. */
function wear(ctx: Ctx, width: number, height: number) {
	const rand = random(29);
	for (const [index, x] of [width / 4, width / 2, (width * 3) / 4].entries()) {
		const shade = ctx.createLinearGradient(x - 60, 0, x + 60, 0);
		const dark = index % 2 === 0 ? 0 : 1;
		shade.addColorStop(0, 'rgb(90 64 36 / 0)');
		shade.addColorStop(0.5 - dark * 0.02, `rgb(90 64 36 / ${0.04 + 0.03 * dark})`);
		shade.addColorStop(0.52, 'rgb(255 250 236 / 0.07)');
		shade.addColorStop(1, 'rgb(255 250 236 / 0)');
		ctx.fillStyle = shade;
		ctx.fillRect(x - 60, 0, 120, height);
	}
	const fold = ctx.createLinearGradient(0, height / 2 - 50, 0, height / 2 + 50);
	fold.addColorStop(0, 'rgb(90 64 36 / 0)');
	fold.addColorStop(0.49, 'rgb(90 64 36 / 0.06)');
	fold.addColorStop(0.52, 'rgb(255 250 236 / 0.07)');
	fold.addColorStop(1, 'rgb(255 250 236 / 0)');
	ctx.fillStyle = fold;
	ctx.fillRect(0, height / 2 - 50, width, 100);
	const crease = (from: BoardPoint, to: BoardPoint) => {
		for (const [rgb, alpha, offset] of [
			['80 58 34', 0.16, 0],
			['255 250 236', 0.24, 2],
		] as const) {
			ctx.strokeStyle = `rgb(${rgb} / ${alpha})`;
			ctx.lineWidth = 1.4;
			ctx.beginPath();
			const steps = 60;
			for (let i = 0; i <= steps; i++) {
				const t = i / steps;
				const jitter = (rand() - 0.5) * 1.6;
				const x = from.x + (to.x - from.x) * t + (from.x === to.x ? jitter + offset : 0);
				const y = from.z + (to.z - from.z) * t + (from.z === to.z ? jitter + offset : 0);
				if (i === 0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			}
			ctx.stroke();
		}
	};
	for (const x of [width / 4, width / 2, (width * 3) / 4]) {
		crease({ x, z: 0 }, { x, z: height });
		blot(ctx, x, height / 2, 46, '246 238 220', 0.22);
	}
	crease({ x: 0, z: height / 2 }, { x: width, z: height / 2 });

	ctx.save();
	ctx.filter = 'blur(2.5px)';
	for (let i = 0; i < 6; i++) {
		const x = rand() * width;
		const y = rand() * height;
		const stain = wobble(x, y, 70 + rand() * 230, rand);
		ctx.fillStyle = `rgb(160 118 62 / ${0.04 + rand() * 0.04})`;
		ctx.fill(stain);
		ctx.strokeStyle = `rgb(128 86 42 / ${0.16 + rand() * 0.12})`;
		ctx.lineWidth = 2.5 + rand() * 2;
		ctx.stroke(stain);
	}
	const ring = wobble(width * 0.86, height * 0.2, 78, rand);
	ctx.strokeStyle = 'rgb(110 70 35 / 0.2)';
	ctx.lineWidth = 7;
	ctx.setLineDash([380, 60]);
	ctx.stroke(ring);
	ctx.setLineDash([]);
	ctx.restore();

	for (let cluster = 0; cluster < 30; cluster++) {
		const cx = rand() * width;
		const cy = rand() * height;
		const count = 6 + Math.floor(rand() * 22);
		for (let i = 0; i < count; i++) {
			blot(ctx, cx + (rand() - 0.5) * 90, cy + (rand() - 0.5) * 90, 1.5 + rand() * 6, '140 92 48', 0.12 + rand() * 0.3);
		}
	}

	const burn = Math.min(width, height) * 0.06;
	for (const [x0, y0, x1, y1] of [
		[0, 0, burn, 0],
		[width, 0, width - burn, 0],
		[0, 0, 0, burn],
		[0, height, 0, height - burn],
	] as const) {
		const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
		gradient.addColorStop(0, 'rgb(84 58 30 / 0.26)');
		gradient.addColorStop(1, 'rgb(84 58 30 / 0)');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, width, height);
	}

	const edge = tornEdge(width, height, rand);
	ctx.save();
	ctx.filter = 'blur(5px)';
	ctx.strokeStyle = 'rgb(74 48 24 / 0.38)';
	ctx.lineWidth = 16;
	ctx.stroke(edge);
	ctx.restore();
	ctx.globalCompositeOperation = 'destination-in';
	ctx.fillStyle = '#000';
	ctx.fill(edge);
	ctx.globalCompositeOperation = 'source-over';
}

export type Chart = {
	/** The charted world. */
	known: HTMLCanvasElement;
	/** The same sheet with the ink faded to a dotted guess, shown over regions nobody has reached yet. */
	unknown: HTMLCanvasElement;
};

const charts = new Map<string, Chart>();

/** Drawing the chart takes a noticeable moment, so a board that mounts again reuses the sheets. */
export function drawChart(bounds: BoardBounds): Chart {
	const key = `${bounds.minX}:${bounds.maxX}:${bounds.minZ}:${bounds.maxZ}`;
	const cached = charts.get(key);
	if (cached) return cached;
	const chart = paintChart(bounds);
	charts.set(key, chart);
	return chart;
}

function paintChart(bounds: BoardBounds): Chart {
	const width = PIXELS;
	const scale = width / (bounds.maxX - bounds.minX);
	const height = Math.round((bounds.maxZ - bounds.minZ) * scale);
	const px = (pixels: number) => pixels / scale;
	const toBoard = (ctx: Ctx) => ctx.setTransform(scale, 0, 0, scale, -bounds.minX * scale, -bounds.minZ * scale);

	const outline = (data: unknown) => {
		const topology = data as Topology;
		return new Path2D(boardPath(feature(topology, topology.objects['land']!)) ?? '');
	};
	const land = outline(landTopology);
	// Wide strokes only need the general shape of a coast, and the coarse outline is many times faster to stroke.
	const coarse = outline(coarseTopology);
	const sphere = new Path2D(boardPath({ type: 'Sphere' }) ?? '');
	const sea = new Path2D();
	sea.addPath(sphere);
	sea.addPath(land);
	const line = (geometry: GeoPermissibleObjects) => new Path2D(boardPath(geometry) ?? '');
	const parallel = (lat: number) =>
		line({ type: 'LineString', coordinates: Array.from({ length: 361 }, (_, i) => [i - 180, lat]) });

	const base = paper(width, height);

	const ink = sheet(width, height).ctx;
	toBoard(ink);
	ink.lineJoin = 'round';

	ink.save();
	ink.clip(sea, 'evenodd');
	// A survey grid ruled across open water only, finer than the graticule.
	ink.strokeStyle = `rgb(${SEA_INK} / 0.12)`;
	ink.lineWidth = px(0.8);
	ink.stroke(line(geoGraticule().step([5, 5])()));
	// Water-lining: rings that follow the coast out to sea, fading with distance, as engravers did it.
	const rings = sheet(width, height).ctx;
	toBoard(rings);
	rings.lineJoin = 'round';
	const gap = 0.62;
	const thickness = px(1.5);
	for (let ring = 6; ring >= 1; ring--) {
		rings.globalCompositeOperation = 'source-over';
		rings.strokeStyle = `rgb(${SEA_INK} / ${0.42 - ring * 0.06})`;
		rings.lineWidth = 2 * ring * gap + thickness;
		rings.stroke(coarse);
		rings.globalCompositeOperation = 'destination-out';
		rings.lineWidth = 2 * ring * gap - thickness;
		rings.stroke(coarse);
	}
	ink.setTransform(1, 0, 0, 1, 0, 0);
	ink.drawImage(rings.canvas, 0, 0);
	toBoard(ink);
	ink.restore();

	ink.save();
	ink.clip(land);
	ink.fillStyle = 'rgb(176 132 74 / 0.1)';
	ink.fill(land);
	for (const [widthUnits, alpha] of [
		[2.2, 0.1],
		[0.9, 0.12],
	] as const) {
		ink.strokeStyle = `rgb(150 100 48 / ${alpha})`;
		ink.lineWidth = widthUnits;
		ink.stroke(coarse);
	}
	ink.restore();

	ink.save();
	ink.clip(sphere);
	ink.strokeStyle = `rgb(${RULE_INK} / 0.3)`;
	ink.lineWidth = px(1.1);
	ink.stroke(line(geoGraticule().step([15, 15])()));
	ink.strokeStyle = `rgb(${RULE_INK} / 0.5)`;
	ink.lineWidth = px(1.6);
	ink.stroke(parallel(0));
	ink.setLineDash([px(12), px(7)]);
	ink.lineWidth = px(1.2);
	ink.strokeStyle = `rgb(${RULE_INK} / 0.42)`;
	for (const lat of [23.44, -23.44, 66.56]) ink.stroke(parallel(lat));
	ink.setLineDash([]);
	ink.restore();

	ink.strokeStyle = `rgb(${INK} / 0.9)`;
	ink.lineWidth = px(1.9);
	ink.stroke(land);
	compass(ink, project(-43, -132), 5.2, px);

	ink.setTransform(1, 0, 0, 1, 0, 0);
	const abrasion = random(53);
	ink.globalCompositeOperation = 'destination-out';
	for (let i = 0; i < 80; i++) {
		blot(ink, abrasion() * width, abrasion() * height, 30 + abrasion() * 170, '0 0 0', 0.2 + abrasion() * 0.4);
	}
	ink.globalCompositeOperation = 'source-over';
	const faint = sheet(width, height).ctx;
	toBoard(faint);
	faint.save();
	faint.clip(sphere);
	faint.strokeStyle = `rgb(${INK} / 0.3)`;
	faint.lineWidth = px(1.6);
	faint.beginPath();
	for (let x = bounds.minX - (bounds.maxZ - bounds.minZ); x < bounds.maxX; x += px(14)) {
		faint.moveTo(x, bounds.minZ);
		faint.lineTo(x + (bounds.maxZ - bounds.minZ), bounds.maxZ);
	}
	faint.stroke();
	faint.restore();
	faint.setLineDash([px(2.5), px(6)]);
	faint.strokeStyle = `rgb(${INK} / 0.4)`;
	faint.lineWidth = px(1.5);
	faint.stroke(land);
	faint.setLineDash([]);

	// Hand-tinted water: a faded blue wash, laid on heavier along the coasts the way colourists finished a print.
	const water = (ctx: Ctx, strength: number) => {
		toBoard(ctx);
		ctx.save();
		ctx.clip(sea, 'evenodd');
		ctx.fillStyle = `rgb(95 150 195 / ${0.55 * strength})`;
		ctx.fill(sphere);
		ctx.lineJoin = 'round';
		for (const [widthUnits, alpha] of [
			[3.4, 0.16],
			[1.7, 0.16],
			[0.8, 0.14],
		] as const) {
			ctx.strokeStyle = `rgb(52 104 152 / ${alpha * strength})`;
			ctx.lineWidth = widthUnits;
			ctx.stroke(coarse);
		}
		ctx.restore();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
	};

	const finish = (layer: CanvasRenderingContext2D, wash: number, bleach = 0) => {
		const { canvas, ctx } = sheet(width, height);
		ctx.drawImage(base, 0, 0);
		water(ctx, wash);
		if (bleach) {
			ctx.fillStyle = `rgb(248 242 226 / ${bleach})`;
			ctx.fillRect(0, 0, width, height);
		}
		ctx.globalCompositeOperation = 'multiply';
		ctx.drawImage(layer.canvas, 0, 0);
		ctx.globalCompositeOperation = 'source-over';
		toBoard(ctx);
		frame(ctx, sphere, px);
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		wear(ctx, width, height);
		return canvas;
	};
	return { known: finish(ink, 1), unknown: finish(faint, 0.55, 0.3) };
}

/** The neatline around the world, with a ruled border marking every ten degrees. */
function frame(ctx: Ctx, sphere: Path2D, px: (pixels: number) => number) {
	ctx.strokeStyle = `rgb(${INK} / 0.85)`;
	ctx.lineWidth = px(2.6);
	ctx.stroke(sphere);
	const band = px(16);
	const outer = { minX: FRAME.minX - band, maxX: FRAME.maxX + band, minZ: FRAME.minZ - band, maxZ: FRAME.maxZ + band };
	ctx.fillStyle = `rgb(${INK} / 0.78)`;
	const north = project(76, 0).z;
	const south = project(-57, 0).z;
	for (let lon = -180; lon < 180; lon += 10) {
		if ((lon / 10) % 2 === 0) continue;
		for (const [lat, z] of [
			[76, north - band],
			[-57, south],
		] as const) {
			const a = Math.max(FRAME.minX, Math.min(FRAME.maxX, project(lat, lon).x));
			const b = Math.max(FRAME.minX, Math.min(FRAME.maxX, project(lat, lon + 10).x));
			if (b > a) ctx.fillRect(a, z, b - a, band);
		}
	}
	for (let lat = -50; lat < 80; lat += 10) {
		if ((lat / 10) % 2 === 0) continue;
		const top = Math.max(FRAME.minZ, project(Math.min(lat + 10, 76), 0).z);
		const bottom = Math.min(FRAME.maxZ, project(lat, 0).z);
		if (bottom <= top) continue;
		ctx.fillRect(outer.minX, top, band, bottom - top);
		ctx.fillRect(FRAME.maxX, top, band, bottom - top);
	}
	ctx.strokeStyle = `rgb(${INK} / 0.85)`;
	ctx.lineWidth = px(1.2);
	ctx.strokeRect(FRAME.minX, FRAME.minZ, FRAME.maxX - FRAME.minX, FRAME.maxZ - FRAME.minZ);
	ctx.lineWidth = px(3);
	ctx.strokeRect(outer.minX, outer.minZ, outer.maxX - outer.minX, outer.maxZ - outer.minZ);
}

/** A plain eight-point rose: long cardinal points, short diagonals, each split into an inked and a bare half. */
function compass(ctx: Ctx, at: BoardPoint, radius: number, px: (pixels: number) => number) {
	ctx.save();
	ctx.translate(at.x, at.z);
	ctx.strokeStyle = `rgb(${INK} / 0.8)`;
	ctx.fillStyle = `rgb(${INK} / 0.8)`;
	ctx.lineWidth = px(1.1);
	ctx.beginPath();
	ctx.arc(0, 0, radius * 0.92, 0, Math.PI * 2);
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(0, 0, radius * 0.84, 0, Math.PI * 2);
	ctx.stroke();
	for (let i = 0; i < 64; i++) {
		const a = (i / 64) * Math.PI * 2;
		const inner = radius * (i % 8 === 0 ? 0.76 : 0.8);
		ctx.beginPath();
		ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
		ctx.lineTo(Math.cos(a) * radius * 0.84, Math.sin(a) * radius * 0.84);
		ctx.stroke();
	}
	for (let i = 0; i < 8; i++) {
		const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
		const length = radius * (i % 2 === 0 ? 1.12 : 0.62);
		const waist = radius * 0.13;
		const tip = { x: Math.cos(a) * length, y: Math.sin(a) * length };
		const left = { x: Math.cos(a - Math.PI / 2) * waist, y: Math.sin(a - Math.PI / 2) * waist };
		const right = { x: -left.x, y: -left.y };
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(left.x, left.y);
		ctx.lineTo(tip.x, tip.y);
		ctx.closePath();
		ctx.fill();
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(right.x, right.y);
		ctx.lineTo(tip.x, tip.y);
		ctx.closePath();
		ctx.stroke();
	}
	ctx.beginPath();
	ctx.arc(0, 0, radius * 0.07, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

export type FogSource = { at: BoardPoint; cover: number };

/**
 * How much of the unknown sheet shows at each point of the board. Every hidden city fades the ink
 * around it, and so does the line between two hidden cities of the same region, so a region reads as
 * one blank patch. A fixed noise field makes the edge ragged, and as a city's cover falls the patch
 * wears away from the edges in.
 */
export class FogMask {
	readonly canvas: HTMLCanvasElement;
	#ctx: Ctx;
	#noise: Float32Array;
	#field: Float32Array;
	#image: ImageData;
	#scale: number;

	constructor(
		readonly bounds: BoardBounds,
		readonly width = 1024,
	) {
		this.#scale = width / (bounds.maxX - bounds.minX);
		const height = Math.round((bounds.maxZ - bounds.minZ) * this.#scale);
		const { canvas, ctx } = sheet(width, height);
		this.canvas = canvas;
		this.#ctx = ctx;
		this.#image = ctx.createImageData(width, height);
		this.#field = new Float32Array(width * height);
		this.#noise = valueNoise(width, height, random(71));
	}

	draw(points: FogSource[], links: [FogSource, FogSource][], radius = 15) {
		const field = this.#field;
		field.fill(0);
		const { width, height } = this.canvas;
		const scale = this.#scale;
		const { minX, minZ } = this.bounds;
		const stamp = (a: BoardPoint, b: BoardPoint, cover: number) => {
			if (cover <= 0.001) return;
			const reach = radius * scale;
			const x0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - minX) * scale - reach));
			const x1 = Math.min(width - 1, Math.ceil((Math.max(a.x, b.x) - minX) * scale + reach));
			const y0 = Math.max(0, Math.floor((Math.min(a.z, b.z) - minZ) * scale - reach));
			const y1 = Math.min(height - 1, Math.ceil((Math.max(a.z, b.z) - minZ) * scale + reach));
			const dx = b.x - a.x;
			const dz = b.z - a.z;
			const lengthSq = dx * dx + dz * dz;
			for (let y = y0; y <= y1; y++) {
				const z = minZ + y / scale;
				for (let x = x0; x <= x1; x++) {
					const px = minX + x / scale;
					const t = lengthSq ? Math.max(0, Math.min(1, ((px - a.x) * dx + (z - a.z) * dz) / lengthSq)) : 0;
					const distance = Math.hypot(px - (a.x + dx * t), z - (a.z + dz * t));
					const near = 1 - distance / radius;
					if (near <= 0) continue;
					const value = cover * near * near * (3 - 2 * near);
					const index = y * width + x;
					if (value > field[index]!) field[index] = value;
				}
			}
		};
		for (const point of points) stamp(point.at, point.at, point.cover);
		for (const [a, b] of links) stamp(a.at, b.at, Math.min(a.cover, b.cover));
		const data = this.#image.data;
		for (let i = 0; i < field.length; i++) {
			const alpha = Math.max(0, Math.min(1, (field[i]! + 0.5 * (this.#noise[i]! - 0.5) - 0.2) * 4));
			const value = alpha * 255;
			data[i * 4] = value;
			data[i * 4 + 1] = value;
			data[i * 4 + 2] = value;
			data[i * 4 + 3] = 255;
		}
		this.#ctx.putImageData(this.#image, 0, 0);
	}
}

function valueNoise(width: number, height: number, rand: () => number) {
	const out = new Float32Array(width * height);
	for (const [cell, weight] of [
		[72, 0.5],
		[26, 0.3],
		[9, 0.2],
	] as const) {
		const columns = Math.ceil(width / cell) + 2;
		const rows = Math.ceil(height / cell) + 2;
		const grid = Float32Array.from({ length: columns * rows }, () => rand());
		for (let y = 0; y < height; y++) {
			const gy = y / cell;
			const row = Math.floor(gy);
			const fy = gy - row;
			const sy = fy * fy * (3 - 2 * fy);
			for (let x = 0; x < width; x++) {
				const gx = x / cell;
				const column = Math.floor(gx);
				const fx = gx - column;
				const sx = fx * fx * (3 - 2 * fx);
				const top = grid[row * columns + column]! * (1 - sx) + grid[row * columns + column + 1]! * sx;
				const bottom = grid[(row + 1) * columns + column]! * (1 - sx) + grid[(row + 1) * columns + column + 1]! * sx;
				out[y * width + x]! += (top * (1 - sy) + bottom * sy) * weight;
			}
		}
	}
	return out;
}
