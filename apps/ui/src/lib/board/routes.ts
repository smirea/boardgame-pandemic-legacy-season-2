import type { EdgeDef } from '@repo/game';
import { edgeKey } from '@repo/game';
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

/**
 * A route leaves each city at its rim, bows sideways by a per-route amount so parallel routes fan out,
 * and arcs above the board so it never cuts through land.
 */
export function routeCurve(route: EdgeDef, a: BoardPoint, b: BoardPoint) {
	const dx = b.x - a.x;
	const dz = b.z - a.z;
	const length = Math.hypot(dx, dz);
	const ux = dx / length;
	const uz = dz / length;
	const bow = (hash(edgeKey(route.a, route.b)) - 0.5) * length * (route.kind === 'sea' ? 0.3 : 0.14);
	const peak = Math.min(4.5, 0.5 + length * (route.kind === 'sea' ? 0.07 : 0.035));
	const inset = Math.min(CITY_RADIUS, length / 3);
	const span = length - inset * 2;
	const points: Vector3[] = [];
	const steps = Math.max(8, Math.ceil(length / 2));
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const along = inset + span * t;
		const lift = Math.sin(Math.PI * t);
		points.push(
			new Vector3(a.x + ux * along - uz * bow * lift, CITY_TOP - 0.2 + peak * lift, a.z + uz * along + ux * bow * lift),
		);
	}
	return new CatmullRomCurve3(points);
}
