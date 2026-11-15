import { PerspectiveCamera, Vector3 } from 'three';
import type { BoardBounds } from './projection';

export const DEFAULT_TILT = 0.3;

/** Camera placement that shows all of `bounds` at the given viewport aspect, tilted `tilt` radians off vertical. */
export function fitBoard(bounds: BoardBounds, aspect: number, fov: number, tilt = DEFAULT_TILT) {
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
	const fits = (distance: number) => {
		place(distance, centre(distance));
		return corners.every(([x, z]) => {
			point.set(x, 0, z).project(probe);
			return Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1;
		});
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
