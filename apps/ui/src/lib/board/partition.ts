import { cityDef, pack } from "@repo/game";
import type { GroundId } from "@repo/game";
import type { BoardBounds, BoardPoint } from "./projection";

/**
 * The board's partition drawn exactly: the ground that `nearestGround` assigns to each location or uncharted ground is
 * its cell of the power diagram over `pack.positions`, `pack.uncharted` and each location's `groundWeight`, whose edges
 * are straight, so the cells are cut with half-planes rather than sampled.
 * `partition.test.ts` checks them against `nearestGround` itself.
 */

/** A cell's outline. `next` is the location across the edge that leaves each corner, or null on the bounds. */
type Ring = { at: BoardPoint; next: GroundId | null }[];

export type Cell = { id: GroundId; outline: BoardPoint[] };

type Site = { at: BoardPoint; weight: number };
const sites: [GroundId, Site][] = [
  ...(Object.entries(pack.positions) as [GroundId, BoardPoint][]).map(
    ([id, at]) => [id, { at, weight: cityDef(id as never).groundWeight ?? 0 }] as [GroundId, Site],
  ),
  ...pack.uncharted.map((patch) => [patch.id, { at: patch.at, weight: 0 }] as [GroundId, Site]),
];
/** Keeps the part of `ring` that belongs to `site` rather than to `other`; the new edge faces `otherId`. */
function clip(
  ring: Ring,
  { at: site, weight }: Site,
  { at: other, weight: otherWeight }: Site,
  otherId: GroundId,
): Ring {
  const nx = other.x - site.x;
  const nz = other.z - site.z;
  const limit =
    (other.x ** 2 + other.z ** 2 - site.x ** 2 - site.z ** 2 + weight - otherWeight) / 2;
  const side = (point: BoardPoint) => point.x * nx + point.z * nz - limit;
  const cross = (a: BoardPoint, b: BoardPoint) => {
    const t = side(a) / (side(a) - side(b));
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
  };
  const out: Ring = [];
  ring.forEach((corner, index) => {
    const following = ring[(index + 1) % ring.length]!;
    const inside = side(corner.at) <= 0;
    const nextInside = side(following.at) <= 0;
    if (inside) {
      out.push(corner);
      if (!nextInside) out.push({ at: cross(corner.at, following.at), next: otherId });
    } else if (nextInside) {
      out.push({ at: cross(corner.at, following.at), next: corner.next });
    }
  });
  return out;
}

function rings(bounds: BoardBounds): Map<GroundId, Ring> {
  const result = new Map<GroundId, Ring>();
  for (const [id, site] of sites) {
    let ring: Ring = [
      { at: { x: bounds.minX, z: bounds.minZ }, next: null },
      { at: { x: bounds.maxX, z: bounds.minZ }, next: null },
      { at: { x: bounds.maxX, z: bounds.maxZ }, next: null },
      { at: { x: bounds.minX, z: bounds.maxZ }, next: null },
    ];
    for (const [otherId, other] of sites) {
      if (otherId !== id && ring.length) ring = clip(ring, site, other, otherId);
    }
    result.set(id, ring);
  }
  return result;
}

const cache = new Map<string, { cells: Cell[] }>();

/** Every location's ground. */
export function partition(bounds: BoardBounds) {
  const key = `${bounds.minX}:${bounds.maxX}:${bounds.minZ}:${bounds.maxZ}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const cells: Cell[] = [...rings(bounds)].map(([id, ring]) => ({
    id,
    outline: ring.map((corner) => corner.at),
  }));
  const found = { cells };
  cache.set(key, found);
  return found;
}
