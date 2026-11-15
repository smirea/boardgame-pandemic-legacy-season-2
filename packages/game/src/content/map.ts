import type { CityId, RegionId, RouteId } from '../ids';
import { routeId } from '../ids';

export type Affiliation = 'blue' | 'yellow' | 'black';
export type RouteKind = 'land' | 'sea';

export type RegionDef = {
	id: RegionId;
	name: string;
	/** Explored regions show their cities and candidate routes. The rest are fogged until reconned. */
	startsExplored: boolean;
};

export type CityDef = {
	id: CityId;
	name: string;
	region: RegionId;
	lat: number;
	lon: number;
	kind: 'city' | 'haven';
	affiliation: Affiliation | null;
	coastal: boolean;
	population: number;
	startsOnGrid: boolean;
};

export type RouteDef = {
	id: RouteId;
	a: CityId;
	b: CityId;
	kind: RouteKind;
	startsEstablished: boolean;
};

export type MapDef = {
	regions: RegionDef[];
	cities: CityDef[];
	routes: RouteDef[];
};

export type CityRow = [
	id: string,
	name: string,
	lat: number,
	lon: number,
	population: number,
	/** `c` coastal, `h` haven, `g` on the grid at campaign start. */
	flags?: string,
];

export type RegionRows = {
	id: string;
	name: string;
	explored?: boolean;
	affiliation: Affiliation | null;
	cities: CityRow[];
};

export type RouteRow = [a: string, b: string, kind: RouteKind, established?: boolean];

export function buildMap(regions: RegionRows[], routes: RouteRow[]): MapDef {
	const cities: CityDef[] = regions.flatMap(region =>
		region.cities.map(([id, name, lat, lon, population, flags = '']) => ({
			id: id as CityId,
			name,
			region: region.id as RegionId,
			lat,
			lon,
			kind: flags.includes('h') ? ('haven' as const) : ('city' as const),
			affiliation: flags.includes('h') ? null : region.affiliation,
			coastal: flags.includes('c') || flags.includes('h'),
			population,
			startsOnGrid: flags.includes('g'),
		})),
	);
	const known = new Set<string>();
	for (const city of cities) {
		if (known.has(city.id)) throw new Error(`duplicate city ${city.id}`);
		known.add(city.id);
	}
	const seen = new Set<RouteId>();
	const routeDefs = routes.map(([a, b, kind, established = false]) => {
		for (const end of [a, b]) if (!known.has(end)) throw new Error(`route references unknown city ${end}`);
		const id = routeId(a as CityId, b as CityId);
		if (seen.has(id)) throw new Error(`duplicate route ${id}`);
		seen.add(id);
		return { id, a: a as CityId, b: b as CityId, kind, startsEstablished: established };
	});
	return {
		regions: regions.map(region => ({
			id: region.id as RegionId,
			name: region.name,
			startsExplored: region.explored ?? false,
		})),
		cities,
		routes: routeDefs,
	};
}
