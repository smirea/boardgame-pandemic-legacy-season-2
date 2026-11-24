import { ExtrudeGeometry, Path, Shape } from "three";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import landTopology from "world-atlas/land-50m.json";
import { LAND_HEIGHT, projectPolygons } from "./projection";
import type { BoardBounds, Ring } from "./projection";

const MIN_ISLAND_AREA = 0.35;

function signedArea(ring: Ring) {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    sum += a.x * b.z - b.x * a.z;
  }
  return sum / 2;
}

function toPath<T extends Path>(path: T, ring: Ring): T {
  // Shapes live in the XY plane and get rotated onto the ground, so north (negative z) becomes positive y.
  path.moveTo(ring[0]!.x, -ring[0]!.z);
  for (let i = 1; i < ring.length; i++) path.lineTo(ring[i]!.x, -ring[i]!.z);
  path.closePath();
  return path;
}

export function buildLandGeometry() {
  const topology = landTopology as unknown as Topology;
  const land = feature(topology, topology.objects["land"]!);
  const shapes: Shape[] = [];
  for (const polygon of projectPolygons(land)) {
    const areas = polygon.map(signedArea);
    const outerIndex = areas.reduce(
      (best, area, index) => (Math.abs(area) > Math.abs(areas[best]!) ? index : best),
      0,
    );
    const outerSign = Math.sign(areas[outerIndex]!);
    let mainShape: Shape | null = null;
    polygon.forEach((ring, index) => {
      const area = areas[index]!;
      if (Math.abs(area) < MIN_ISLAND_AREA) return;
      if (Math.sign(area) === outerSign) {
        const shape = toPath(new Shape(), ring);
        shapes.push(shape);
        if (index === outerIndex) mainShape = shape;
      } else if (mainShape) {
        mainShape.holes.push(toPath(new Path(), ring));
      }
    });
  }
  const geometry = new ExtrudeGeometry(shapes, {
    depth: LAND_HEIGHT,
    bevelEnabled: true,
    bevelSize: 0.06,
    bevelThickness: 0.05,
    bevelSegments: 1,
    curveSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeBoundingBox();
  return geometry;
}

/** Points the land's texture coordinates at the chart sheet, so the raised land shows the chart printed under it. */
export function mapToSheet(geometry: ExtrudeGeometry, bounds: BoardBounds) {
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < position.count; i++) {
    uv.setXY(
      i,
      (position.getX(i) - bounds.minX) / (bounds.maxX - bounds.minX),
      1 - (position.getZ(i) - bounds.minZ) / (bounds.maxZ - bounds.minZ),
    );
  }
  uv.needsUpdate = true;
}
