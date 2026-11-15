import { pack } from '@repo/game';
import type { CityId, Color } from '@repo/game';
import { geoGraticule10, geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import landTopology from 'world-atlas/land-50m.json';

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
	coordinates: string;
};

const topology = landTopology as unknown as Topology;
const land = feature(topology, topology.objects['land']!);
const graticule = geoGraticule10();
const cache = new Map<CityId, MapArt>();

const degrees = (value: number, positive: string, negative: string) =>
	`${Math.abs(value).toFixed(1)}°${value >= 0 ? positive : negative}`;

/**
 * The picture on every city card: the map around the city with a pin on it. It is drawn from the
 * same land data as the board, so a new city gets its card art for free.
 */
export function mapArt(id: CityId): MapArt {
	const cached = cache.get(id);
	if (cached) return cached;
	const city = pack.cities.find(candidate => candidate.id === id);
	if (!city) throw new Error(`unknown city ${id}`);
	const projection = geoMercator()
		.center([city.lon, city.lat])
		.scale(ART_WIDTH / ((SPAN * Math.PI) / 180))
		.translate([ART_WIDTH / 2, ART_HEIGHT * 0.56])
		.clipExtent([
			[0, 0],
			[ART_WIDTH, ART_HEIGHT],
		]);
	const path = geoPath(projection);
	const [x, y] = projection([city.lon, city.lat])!;
	const neighbours = pack.cities.flatMap(other => {
		if (other.id === id || other.lost) return [];
		const point = projection([other.lon, other.lat]);
		if (!point || point[0] < 2 || point[0] > ART_WIDTH - 2 || point[1] < 2 || point[1] > ART_HEIGHT - 2) return [];
		return [{ x: point[0], y: point[1], color: other.color }];
	});
	const art: MapArt = {
		land: path(land) ?? '',
		graticule: path(graticule) ?? '',
		pin: { x, y },
		neighbours,
		coordinates: `${degrees(city.lat, 'N', 'S')} ${degrees(city.lon, 'E', 'W')}`,
	};
	cache.set(id, art);
	return art;
}
