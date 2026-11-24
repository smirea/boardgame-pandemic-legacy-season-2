import { pack } from "@repo/game";
import type { CityId, Color } from "@repo/game";
import { geoBounds, geoGraticule10, geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import landTopology from "world-atlas/land-50m.json";

export const ART_WIDTH = 120;
export const ART_HEIGHT = 78;
/** Degrees of longitude a card shows from edge to edge. */
const SPAN = 46;

export type MapArt = {
  land: string;
  graticule: string;
  pin: { x: number; y: number };
  /** Other locations inside the frame, so a card reads as a place on the board and not a lone dot. */
  neighbours: { x: number; y: number; color: Color | null }[];
};

const topology = landTopology as unknown as Topology;
const graticule = geoGraticule10();
const cache = new Map<CityId, MapArt>();

/** Degrees a card's frame can reach from its city, with room to spare: most of the world's coast is nowhere near it. */
const REACH = { lon: SPAN, lat: 40 };
/** One polygon of the land: its rings of [longitude, latitude] points, and the box they lie in. */
type Landmass = {
  rings: number[][][];
  west: number;
  east: number;
  south: number;
  north: number;
};
const landmasses: Landmass[] = (
  feature(topology, topology.objects["land"]!) as unknown as {
    features: { geometry: { coordinates: number[][][][] } }[];
  }
).features.flatMap(({ geometry }) =>
  geometry.coordinates.map((rings) => {
    const [[west, south], [east, north]] = geoBounds({ type: "Polygon", coordinates: rings });
    return { rings, west, east, south, north };
  }),
);
/** True when the landmass comes within reach of the point. One that crosses the antimeridian has `west > east`. */
const near = (mass: Landmass, lon: number, lat: number) => {
  if (mass.north < lat - REACH.lat || mass.south > lat + REACH.lat) return false;
  const span = (mass.east - mass.west + 360) % 360;
  const fromWest = ((lon - mass.west + 540) % 360) - 180;
  return fromWest > -REACH.lon && fromWest < span + REACH.lon;
};

/**
 * The picture on every city card: the map around the city with a pin on it. It is drawn from the
 * same land data as the board, so a new city gets its card art for free.
 */
export function mapArt(id: CityId): MapArt {
  const cached = cache.get(id);
  if (cached) return cached;
  const city = pack.cities.find((candidate) => candidate.id === id);
  if (!city) throw new Error(`unknown city ${id}`);
  const projection = geoMercator()
    .center([city.lon, city.lat])
    .scale(ART_WIDTH / ((SPAN * Math.PI) / 180))
    .translate([ART_WIDTH / 2, ART_HEIGHT * 0.56])
    .clipExtent([
      [0, 0],
      [ART_WIDTH, ART_HEIGHT],
    ]);
  // A card is a few hundred pixels wide, so a tenth of a unit of its 120 is finer than it can show.
  const path = geoPath(projection).digits(1);
  const land = {
    type: "MultiPolygon" as const,
    coordinates: landmasses
      .filter((mass) => near(mass, city.lon, city.lat))
      .map((mass) => mass.rings),
  };
  const [x, y] = projection([city.lon, city.lat])!;
  const neighbours = pack.cities.flatMap((other) => {
    if (other.id === id || other.lost) return [];
    const point = projection([other.lon, other.lat]);
    if (
      !point ||
      point[0] < 2 ||
      point[0] > ART_WIDTH - 2 ||
      point[1] < 2 ||
      point[1] > ART_HEIGHT - 2
    )
      return [];
    return [{ x: point[0], y: point[1], color: other.color }];
  });
  const art: MapArt = {
    land: path(land) ?? "",
    graticule: path(graticule) ?? "",
    pin: { x, y },
    neighbours,
  };
  cache.set(id, art);
  return art;
}

// Each city's art takes a few milliseconds to draw, which a hand of cards dealt at once would spend in one frame.
// So the page draws them all while it has nothing else to do, one city per idle moment.
if (typeof requestIdleCallback === "function") {
  const waiting = pack.cities.map((city) => city.id);
  const warm = () => {
    const id = waiting.pop();
    if (!id) return;
    mapArt(id);
    requestIdleCallback(warm);
  };
  requestIdleCallback(warm);
}
