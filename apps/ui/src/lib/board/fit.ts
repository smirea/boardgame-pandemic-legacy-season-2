import { PerspectiveCamera, Vector3 } from 'three';
import type { BoardBounds } from './projection';

export const DEFAULT_TILT = 0.3;

/** A region that must also land clear of the panels at the screen's sides, given as fractions of the width. */
export type KeepClear = { bounds: BoardBounds; left: number; right: number };

/**
 * Camera placement that shows all of `bounds` at the given viewport aspect, tilted `tilt` radians off vertical.
 * With `keep`, the camera also backs off until that region sits between the side panels, so no city hides under one.
 */
export function fitBoard(bounds: BoardBounds, aspect: number, fov: number, tilt = DEFAULT_TILT, keep?: KeepClear) {
	const probe = new PerspectiveCamera(fov, aspect, 1, 2000);
	const centreX = (bounds.minX + bounds.maxX) / 2;
	const corners = [
		[bounds.minX, bounds.minZ],
		[bounds.maxX, bounds.minZ],
		[bounds.minX, bounds.maxZ],
		[bounds.maxX, bounds.maxZ],
	] as const;
	const point = new Vector3();

	const place = (distance: number, targetZ: number) => {
		probe.position.set(centreX, distance * Math.cos(tilt), targetZ + distance * Math.sin(tilt));
		probe.lookAt(centreX, 0, targetZ);
		probe.updateMatrixWorld();
		probe.updateProjectionMatrix();
	};
	const edgeY = (z: number) => point.set(centreX, 0, z).project(probe).y;

	// The tilt makes the near edge loom larger than the far edge, so the look-at point is shifted until both margins match.
	const centre = (distance: number) => {
		let low = bounds.minZ;
		let high = bounds.maxZ;
		for (let i = 0; i < 24; i++) {
			const mid = (low + high) / 2;
			place(distance, mid);
			if (edgeY(bounds.minZ) + edgeY(bounds.maxZ) > 0) high = mid;
			else low = mid;
		}
		return (low + high) / 2;
	};
	const kept = keep
		? ([
				[keep.bounds.minX, keep.bounds.minZ],
				[keep.bounds.maxX, keep.bounds.minZ],
				[keep.bounds.minX, keep.bounds.maxZ],
				[keep.bounds.maxX, keep.bounds.maxZ],
			] as const)
		: [];
	const fits = (distance: number) => {
		place(distance, centre(distance));
		const sheet = corners.every(([x, z]) => {
			point.set(x, 0, z).project(probe);
			return Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1;
		});
		return (
			sheet &&
			kept.every(([x, z]) => {
				point.set(x, 0, z).project(probe);
				return point.x >= -1 + 2 * keep!.left && point.x <= 1 - 2 * keep!.right;
			})
		);
	};

	let near = 20;
	let far = 1200;
	for (let i = 0; i < 28; i++) {
		const mid = (near + far) / 2;
		if (fits(mid)) far = mid;
		else near = mid;
	}
	const targetZ = centre(far);
	place(far, targetZ);
	return { position: probe.position.clone(), target: new Vector3(centreX, 0, targetZ), distance: far };
}
