#!/usr/bin/env bun
/**
 * Converts the three 3D piece meshes from the Tabletop Simulator Workshop mod (`2236267539.json`,
 * "Pandemic Legacy Season 2 (Partially Scripted)") cached OBJ files into normalized binary glTF (.glb)
 * assets under `apps/ui/static/models/`:
 *   - `hollow-man.glb`       (Hollow Men figure)
 *   - `satellite-tower.glb`  (Satellite Tower miniature)
 *   - `research-station.glb` (Supply Center / Research Station & Shelter piece)
 *
 * Each exported mesh is grounded (`minY === 0`), centred horizontally on its base footprint, and scaled
 * to unit height (`1.0`), so board components size each piece directly by its target height in board units.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const TTS_MODELS = join(homedir(), 'Library/Tabletop Simulator/Mods/Models');
const OUT_DIR = new URL('../static/models/', import.meta.url).pathname;

type ModelSpec = {
	name: string;
	file: string;
	/** Expand triangles with flat face normals (crisp edges on low-poly wooden pieces). */
	flat?: boolean;
};

const MODELS: ModelSpec[] = [
	{
		name: 'hollow-man',
		file: 'httpssteamusercontentaakamaihdnetugc787500561500181426A311A0999864587C7F2E1654266F7E0ACC472C9C.obj',
	},
	{
		name: 'satellite-tower',
		file: 'httpssteamusercontentaakamaihdnetugc848441252123116984D6CA6279E186375A7F95E7C24331EC0DEE27A6F.obj',
	},
	{
		name: 'research-station',
		file: 'httpssteamusercontentaakamaihdnetugc862852916842294436F0DC6B79B9E24CEC88BFFEE8DE685E235CD90686.obj',
		flat: true,
	},
];

type Vec3 = [number, number, number];
type Corner = { v: number; vn: number };

const resolveObjIndex = (raw: string, length: number) => {
	const n = Number(raw);
	return n < 0 ? length + n : n - 1;
};

function parseObj(text: string): { positions: Vec3[]; normals: Vec3[]; triangles: [Corner, Corner, Corner][] } {
	const positions: Vec3[] = [];
	const normals: Vec3[] = [];
	const triangles: [Corner, Corner, Corner][] = [];

	for (const rawLine of text.split('\n')) {
		const line = rawLine.trim();
		if (line.startsWith('v ')) {
			const [, x, y, z] = line.split(/\s+/);
			positions.push([Number(x), Number(y), Number(z)]);
		} else if (line.startsWith('vn ')) {
			const [, x, y, z] = line.split(/\s+/);
			normals.push([Number(x), Number(y), Number(z)]);
		} else if (line.startsWith('f ')) {
			const parts = line.split(/\s+/).slice(1);
			if (parts.length < 3) continue;
			const corners: Corner[] = parts.map(token => {
				const [vStr = '', , vnStr = ''] = token.split('/');
				return {
					v: resolveObjIndex(vStr, positions.length),
					vn: vnStr ? resolveObjIndex(vnStr, normals.length) : -1,
				};
			});
			for (let i = 1; i + 1 < corners.length; i++) {
				triangles.push([corners[0]!, corners[i]!, corners[i + 1]!]);
			}
		}
	}

	return { positions, normals, triangles };
}

function faceNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
	const ux = b[0] - a[0];
	const uy = b[1] - a[1];
	const uz = b[2] - a[2];
	const vx = c[0] - a[0];
	const vy = c[1] - a[1];
	const vz = c[2] - a[2];
	const nx = uy * vz - uz * vy;
	const ny = uz * vx - ux * vz;
	const nz = ux * vy - uy * vx;
	const len = Math.hypot(nx, ny, nz) || 1;
	return [nx / len, ny / len, nz / len];
}

function normalizeNormal(n: Vec3): Vec3 {
	const len = Math.hypot(n[0], n[1], n[2]);
	return len > 1e-6 ? [n[0] / len, n[1] / len, n[2] / len] : [0, 1, 0];
}

function buildGeometry(spec: ModelSpec) {
	const raw = readFileSync(join(TTS_MODELS, spec.file), 'utf8');
	const { positions, normals, triangles } = parseObj(raw);
	if (!triangles.length) throw new Error(`${spec.name}: no triangles parsed`);

	const used = new Set<number>();
	for (const tri of triangles) {
		used.add(tri[0].v);
		used.add(tri[1].v);
		used.add(tri[2].v);
	}

	let minY = Infinity;
	let maxY = -Infinity;
	for (const idx of used) {
		const y = positions[idx]![1];
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;
	}
	const height = maxY - minY;
	if (height <= 0) throw new Error(`${spec.name}: degenerate height`);

	// Centre horizontally on the base footprint (bottom 15% of height) so pedestals sit squarely on stickers.
	const baseCutoff = minY + height * 0.15;
	let baseMinX = Infinity;
	let baseMaxX = -Infinity;
	let baseMinZ = Infinity;
	let baseMaxZ = -Infinity;
	for (const idx of used) {
		const [x, y, z] = positions[idx]!;
		if (y > baseCutoff) continue;
		if (x < baseMinX) baseMinX = x;
		if (x > baseMaxX) baseMaxX = x;
		if (z < baseMinZ) baseMinZ = z;
		if (z > baseMaxZ) baseMaxZ = z;
	}
	const cx = (baseMinX + baseMaxX) / 2;
	const cz = (baseMinZ + baseMaxZ) / 2;
	const scale = 1 / height;

	const transform = (p: Vec3): Vec3 => [(p[0] - cx) * scale, (p[1] - minY) * scale, (p[2] - cz) * scale];

	const outPositions: number[] = [];
	const outNormals: number[] = [];
	const outIndices: number[] = [];

	if (spec.flat) {
		let vertex = 0;
		for (const [c0, c1, c2] of triangles) {
			const a = transform(positions[c0.v]!);
			const b = transform(positions[c1.v]!);
			const c = transform(positions[c2.v]!);
			const n = faceNormal(a, b, c);
			outPositions.push(...a, ...b, ...c);
			outNormals.push(...n, ...n, ...n);
			outIndices.push(vertex, vertex + 1, vertex + 2);
			vertex += 3;
		}
	} else {
		const map = new Map<string, number>();
		const fallbackNormals = new Map<number, Vec3>();
		for (const [c0, c1, c2] of triangles) {
			const a = transform(positions[c0.v]!);
			const b = transform(positions[c1.v]!);
			const c = transform(positions[c2.v]!);
			const fn = faceNormal(a, b, c);
			for (const corner of [c0, c1, c2]) {
				const key = `${corner.v}/${corner.vn}`;
				let idx = map.get(key);
				if (idx === undefined) {
					idx = outPositions.length / 3;
					map.set(key, idx);
					const p = transform(positions[corner.v]!);
					outPositions.push(...p);
					const rawN = corner.vn >= 0 ? normals[corner.vn] : undefined;
					const n = rawN ? normalizeNormal(rawN) : [0, 0, 0];
					outNormals.push(n[0]!, n[1]!, n[2]!);
					if (!rawN) fallbackNormals.set(idx, [0, 0, 0]);
				}
				const acc = fallbackNormals.get(idx);
				if (acc) {
					acc[0] += fn[0];
					acc[1] += fn[1];
					acc[2] += fn[2];
				}
				outIndices.push(idx);
			}
		}
		for (const [idx, acc] of fallbackNormals) {
			const n = normalizeNormal(acc);
			outNormals[idx * 3] = n[0];
			outNormals[idx * 3 + 1] = n[1];
			outNormals[idx * 3 + 2] = n[2];
		}
	}

	const vertexCount = outPositions.length / 3;
	const posMin: Vec3 = [Infinity, Infinity, Infinity];
	const posMax: Vec3 = [-Infinity, -Infinity, -Infinity];
	for (let i = 0; i < outPositions.length; i += 3) {
		for (let axis = 0; axis < 3; axis++) {
			const val = outPositions[i + axis]!;
			if (val < posMin[axis]!) posMin[axis] = val;
			if (val > posMax[axis]!) posMax[axis] = val;
		}
	}

	return {
		positions: new Float32Array(outPositions),
		normals: new Float32Array(outNormals),
		indices: vertexCount <= 65535 ? new Uint16Array(outIndices) : new Uint32Array(outIndices),
		posMin,
		posMax,
		vertexCount,
		triangleCount: outIndices.length / 3,
	};
}

function pad4(n: number) {
	return (n + 3) & ~3;
}

function encodeGlb(name: string, geom: ReturnType<typeof buildGeometry>): Uint8Array {
	const idxBytes = new Uint8Array(geom.indices.buffer, geom.indices.byteOffset, geom.indices.byteLength);
	const posBytes = new Uint8Array(geom.positions.buffer, geom.positions.byteOffset, geom.positions.byteLength);
	const normBytes = new Uint8Array(geom.normals.buffer, geom.normals.byteOffset, geom.normals.byteLength);

	const idxOffset = 0;
	const posOffset = pad4(idxBytes.byteLength);
	const normOffset = posOffset + pad4(posBytes.byteLength);
	const binLength = normOffset + pad4(normBytes.byteLength);

	const bin = new Uint8Array(binLength);
	bin.set(idxBytes, idxOffset);
	bin.set(posBytes, posOffset);
	bin.set(normBytes, normOffset);

	const gltf = {
		asset: { version: '2.0', generator: 'import-tts-models.ts' },
		scene: 0,
		scenes: [{ nodes: [0] }],
		nodes: [{ mesh: 0, name }],
		meshes: [
			{
				name,
				primitives: [
					{
						attributes: { POSITION: 1, NORMAL: 2 },
						indices: 0,
						mode: 4,
					},
				],
			},
		],
		buffers: [{ byteLength: binLength }],
		bufferViews: [
			{ buffer: 0, byteOffset: idxOffset, byteLength: idxBytes.byteLength, target: 34963 },
			{ buffer: 0, byteOffset: posOffset, byteLength: posBytes.byteLength, target: 34962 },
			{ buffer: 0, byteOffset: normOffset, byteLength: normBytes.byteLength, target: 34962 },
		],
		accessors: [
			{
				bufferView: 0,
				componentType: geom.indices instanceof Uint16Array ? 5123 : 5125,
				count: geom.indices.length,
				type: 'SCALAR',
			},
			{
				bufferView: 1,
				componentType: 5126,
				count: geom.vertexCount,
				type: 'VEC3',
				min: geom.posMin,
				max: geom.posMax,
			},
			{
				bufferView: 2,
				componentType: 5126,
				count: geom.vertexCount,
				type: 'VEC3',
			},
		],
	};

	const rawJson = new TextEncoder().encode(JSON.stringify(gltf));
	const jsonLength = pad4(rawJson.byteLength);
	const jsonChunk = new Uint8Array(jsonLength);
	jsonChunk.set(rawJson);
	jsonChunk.fill(0x20, rawJson.byteLength);

	const totalLength = 12 + 8 + jsonLength + 8 + binLength;
	const glb = new Uint8Array(totalLength);
	const view = new DataView(glb.buffer);

	view.setUint32(0, 0x46546c67, true);
	view.setUint32(4, 2, true);
	view.setUint32(8, totalLength, true);

	view.setUint32(12, jsonLength, true);
	view.setUint32(16, 0x4e4f534a, true);
	glb.set(jsonChunk, 20);

	const binHeader = 20 + jsonLength;
	view.setUint32(binHeader, binLength, true);
	view.setUint32(binHeader + 4, 0x004e4942, true);
	glb.set(bin, binHeader + 8);

	return glb;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const spec of MODELS) {
	const geom = buildGeometry(spec);
	const glb = encodeGlb(spec.name, geom);
	const outPath = join(OUT_DIR, `${spec.name}.glb`);
	writeFileSync(outPath, glb);
	console.log(
		`${spec.name}.glb: ${(glb.byteLength / 1024).toFixed(1)} KiB (${geom.vertexCount} verts, ${geom.triangleCount} tris, ` +
			`size=[${geom.posMax.map((m, i) => (m - geom.posMin[i]!).toFixed(2)).join(', ')}])`,
	);
}
