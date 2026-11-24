import { PerspectiveCamera, Vector3 } from "three";
import type { BoardBounds } from "./projection";

export const DEFAULT_TILT = 0.3;

/** A region that must also land clear of the panels at the screen's edges, given as fractions of the width or height. */
export type KeepClear = {
  bounds: BoardBounds;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

/**
 * Camera placement that shows all of `bounds` at the given viewport aspect, tilted `tilt` radians off vertical.
 * With `keep`, the camera also backs off until that region sits clear of the panels, so no city hides under one.
 */
export function fitBoard(
  bounds: BoardBounds,
  aspect: number,
  fov: number,
  tilt = DEFAULT_TILT,
  keep?: KeepClear,
) {
  const probe = new PerspectiveCamera(fov, aspect, 1, 2000);
  const centreX = (bounds.minX + bounds.maxX) / 2;
  const corners = [
    [bounds.minX, bounds.minZ],
    [bounds.maxX, bounds.minZ],
    [bounds.minX, bounds.maxZ],
    [bounds.maxX, bounds.maxZ],
  ] as const;
  const point = new Vector3();

  // Panels wider on one side than the other move the camera sideways, so the board sits in the middle of the room
  // left between them rather than backing off from both sides.
  let shiftX = 0;
  const place = (distance: number, targetZ: number) => {
    probe.position.set(
      centreX + shiftX,
      distance * Math.cos(tilt),
      targetZ + distance * Math.sin(tilt),
    );
    probe.lookAt(centreX + shiftX, 0, targetZ);
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
  const halfWidth = (distance: number) => distance * Math.tan((fov * Math.PI) / 360) * aspect;
  const fits = (distance: number) => {
    shiftX = 0;
    const targetZ = centre(distance);
    place(distance, targetZ);
    if (keep && keep.left !== keep.right)
      for (let i = 0; i < 4; i++) {
        const xs = kept.map(([x, z]) => point.set(x, 0, z).project(probe).x);
        const middle = (Math.min(...xs) + Math.max(...xs)) / 2;
        shiftX += (middle - (keep.left - keep.right)) * halfWidth(distance);
        place(distance, targetZ);
      }
    const sheet = corners.every(([x, z]) => {
      point.set(x, 0, z).project(probe);
      return Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1;
    });
    return (
      sheet &&
      kept.every(([x, z]) => {
        point.set(x, 0, z).project(probe);
        return (
          point.x >= -1 + 2 * keep!.left &&
          point.x <= 1 - 2 * keep!.right &&
          point.y >= -1 + 2 * keep!.bottom &&
          point.y <= 1 - 2 * keep!.top
        );
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
  fits(far);
  return {
    position: probe.position.clone(),
    target: new Vector3(centreX + shiftX, 0, probe.position.z - far * Math.sin(tilt)),
    distance: far,
  };
}

/**
 * A close camera on one board point that lands it at `spot`, a place on the screen given as fractions of the width
 * and height from the top left, so a panel over the middle of the board can leave it in view.
 */
export function focusBoard(
  at: { x: number; z: number },
  spot: { x: number; y: number },
  aspect: number,
  fov: number,
  distance: number,
  tilt = DEFAULT_TILT,
) {
  const probe = new PerspectiveCamera(fov, aspect, 1, 2000);
  const target = new Vector3(at.x, 0, at.z);
  const point = new Vector3();
  const want = { x: spot.x * 2 - 1, y: 1 - spot.y * 2 };
  const project = (x: number, z: number) => {
    probe.position.set(x, distance * Math.cos(tilt), z + distance * Math.sin(tilt));
    probe.lookAt(x, 0, z);
    probe.updateMatrixWorld();
    probe.updateProjectionMatrix();
    return point.set(at.x, 0, at.z).project(probe);
  };
  // Moving the look-at point moves the city across the screen nearly linearly, so a few Newton steps land it.
  for (let i = 0; i < 6; i++) {
    const now = project(target.x, target.z).clone();
    const stepX = project(target.x + 1, target.z).x - now.x;
    const stepZ = project(target.x, target.z + 1).y - now.y;
    target.x += (want.x - now.x) / stepX;
    target.z += (want.y - now.y) / stepZ;
  }
  project(target.x, target.z);
  return { position: probe.position.clone(), target, distance };
}
