import { geoNaturalEarth1, geoPath, geoStream } from "d3-geo";
import type { GeoPermissibleObjects } from "d3-geo";

const PROJECTION_WIDTH = 220;
export const LAND_HEIGHT = 0.3;
const SOUTH_CUTOFF_LAT = -57;
const NORTH_CUTOFF_LAT = 76;

const projection = (() => {
  const fitted = geoNaturalEarth1().rotate([-11, 0]).fitWidth(PROJECTION_WIDTH, { type: "Sphere" });
  const [, southY] = fitted([0, SOUTH_CUTOFF_LAT])!;
  const [, northY] = fitted([0, NORTH_CUTOFF_LAT])!;
  const midY = (southY + northY) / 2;
  return fitted
    .translate([fitted.translate()[0] - PROJECTION_WIDTH / 2, fitted.translate()[1] - midY])
    .clipExtent([
      [-PROJECTION_WIDTH / 2, northY - midY],
      [PROJECTION_WIDTH / 2, southY - midY],
    ]);
})();

export type BoardPoint = { x: number; z: number };

export type BoardBounds = { minX: number; maxX: number; minZ: number; maxZ: number };

/** The rectangle the projection clips the world to. The chart's frame is drawn on it, which hides the cut through the far north. */
export const FRAME: BoardBounds = (() => {
  const [[minX, minZ], [maxX, maxZ]] = projection.clipExtent()!;
  return { minX, maxX, minZ, maxZ };
})();

/** SVG path data for any geometry in board units. */
export const boardPath = geoPath(projection);

/** Board space: x east, z south, matching three.js ground-plane axes. */
export function project(lat: number, lon: number): BoardPoint {
  const [x, y] = projection([lon, lat])!;
  return { x, z: y };
}

export type Ring = BoardPoint[];

/** Runs geometry through the projection's clipping so antimeridian and extent cuts come out as closed rings. */
export function projectPolygons(geometry: GeoPermissibleObjects): Ring[][] {
  const polygons: Ring[][] = [];
  let polygon: Ring[] = [];
  let ring: Ring = [];
  geoStream(
    geometry,
    projection.stream({
      point: (x, y) => ring.push({ x, z: y }),
      lineStart: () => (ring = []),
      lineEnd: () => {
        if (ring.length >= 3) polygon.push(ring);
      },
      polygonStart: () => (polygon = []),
      polygonEnd: () => {
        if (polygon.length) polygons.push(polygon);
      },
      sphere: () => {},
    }),
  );
  return polygons;
}

const MIN_CITY_SPACING = 7.5;

/**
 * Real coordinates put dense areas on top of each other at board scale, so cities are nudged apart
 * while staying anchored to where they really are.
 */
export function layoutCities<Id extends string>(
  cities: readonly { id: Id; lat: number; lon: number }[],
): Record<Id, BoardPoint> {
  const anchors = cities.map((city) => project(city.lat, city.lon));
  const points = anchors.map((point) => ({ ...point }));
  for (let pass = 0; pass < 400; pass++) {
    let moved = false;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i]!;
        const b = points[j]!;
        let dx = b.x - a.x;
        let dz = b.z - a.z;
        let distance = Math.hypot(dx, dz);
        if (distance >= MIN_CITY_SPACING) continue;
        if (distance < 1e-6) {
          dx = Math.cos(i * 2.399);
          dz = Math.sin(i * 2.399);
          distance = 1;
        }
        const push = (MIN_CITY_SPACING - distance) / 2 / distance;
        a.x -= dx * push;
        a.z -= dz * push;
        b.x += dx * push;
        b.z += dz * push;
        moved = true;
      }
    }
    for (let i = 0; i < points.length; i++) {
      points[i]!.x += (anchors[i]!.x - points[i]!.x) * 0.02;
      points[i]!.z += (anchors[i]!.z - points[i]!.z) * 0.02;
    }
    if (!moved) break;
  }
  const round = (value: number) => Math.round(value * 100) / 100;
  return Object.fromEntries(
    cities.map((city, index) => [
      city.id,
      { x: round(points[index]!.x), z: round(points[index]!.z) },
    ]),
  ) as Record<Id, BoardPoint>;
}
