import type { BundleId, CityId, RegionId } from '../ids';
import type { CityDef, Color, EdgeDef, EdgeKind, RegionDef } from './types';

type RegionRow = [id: string, name: string, neighbours: string[], revealed?: boolean];

const regionRows: RegionRow[] = [
	['atlantic', 'Atlantic', ['north-america', 'south-america', 'europe', 'africa', 'middle-east'], true],
	['north-america', 'North America', ['atlantic', 'south-america', 'eastern-pacific']],
	['south-america', 'South America', ['atlantic', 'north-america', 'eastern-pacific']],
	['europe', 'Europe', ['atlantic', 'middle-east']],
	['africa', 'Africa', ['atlantic', 'middle-east', 'indian-ocean']],
	['middle-east', 'Middle East and South Asia', ['atlantic', 'europe', 'africa', 'indian-ocean', 'east-asia']],
	['east-asia', 'East Asia', ['middle-east', 'indian-ocean', 'coral-sea', 'utopia']],
	['coral-sea', 'Coral Sea', ['east-asia', 'new-zealand']],
	['new-zealand', 'New Zealand', ['coral-sea']],
	['eastern-pacific', 'Eastern Pacific', ['north-america', 'south-america']],
	['indian-ocean', 'Indian Ocean', ['africa', 'middle-east', 'east-asia']],
	['utopia', 'Utopia', ['east-asia']],
];

/** Flags: `p` port, `g` on the grid at campaign start, `i` infested from the start, `l` lost haven. */
type CityRow = [
	id: string,
	name: string,
	lat: number,
	lon: number,
	color: Color | 'haven',
	population: number,
	playerCards: number,
	flags?: string,
];

const cityRows: Record<string, CityRow[]> = {
	atlantic: [
		['haven-north-atlantic', 'North Atlantic Haven', 45, -40, 'haven', 3, 0, 'pg'],
		['haven-mediterranean', 'Mediterranean Haven', 38.5, 4, 'haven', 3, 0, 'pg'],
		['haven-south-atlantic', 'South Atlantic Haven', 3, -25, 'haven', 3, 0, 'pg'],
		['new-york', 'New York', 40.71, -74.01, 'blue', 3, 4, 'pg'],
		['washington', 'Washington', 38.91, -77.04, 'blue', 3, 4, 'pg'],
		['jacksonville', 'Jacksonville', 30.33, -81.66, 'yellow', 3, 4, 'pg'],
		['sao-paulo', 'São Paulo', -23.55, -46.63, 'yellow', 3, 4, 'pg'],
		['london', 'London', 51.51, -0.13, 'blue', 3, 4, 'pg'],
		['istanbul', 'Istanbul', 41.01, 28.98, 'black', 3, 4, 'pg'],
		['tripoli', 'Tripoli', 32.89, 13.19, 'black', 3, 4, 'pg'],
		['cairo', 'Cairo', 30.04, 31.24, 'black', 3, 4, 'pg'],
		['lagos', 'Lagos', 6.52, 3.38, 'yellow', 3, 4, 'pg'],
	],
	'north-america': [
		['chicago', 'Chicago', 41.88, -87.63, 'blue', 2, 2],
		['san-francisco', 'San Francisco', 37.77, -122.42, 'blue', 2, 2, 'p'],
		['denver', 'Denver', 39.74, -104.99, 'blue', 2, 2],
		['atlanta', 'Atlanta', 33.75, -84.39, 'blue', 1, 2],
		['los-angeles', 'Los Angeles', 34.05, -118.24, 'yellow', 1, 2, 'p'],
		['mexico-city', 'Mexico City', 19.43, -99.13, 'yellow', 1, 2],
	],
	'south-america': [
		['bogota', 'Bogotá', 4.71, -74.07, 'yellow', 2, 2],
		['lima', 'Lima', -12.05, -77.04, 'yellow', 2, 2, 'p'],
		['santiago', 'Santiago', -33.45, -70.67, 'yellow', 1, 2],
		['buenos-aires', 'Buenos Aires', -34.6, -58.38, 'yellow', 2, 2, 'p'],
	],
	europe: [
		['paris', 'Paris', 48.86, 2.35, 'blue', 2, 2],
		['frankfurt', 'Frankfurt', 50.11, 8.68, 'blue', 2, 2],
		['st-petersburg', 'St. Petersburg', 59.93, 30.34, 'blue', 1, 2, 'p'],
		['moscow', 'Moscow', 55.76, 37.62, 'black', 1, 2],
	],
	africa: [
		['kinshasa', 'Kinshasa', -4.44, 15.27, 'yellow', 1, 2, 'i'],
		['khartoum', 'Khartoum', 15.5, 32.56, 'yellow', 1, 2, 'i'],
		['dar-es-salaam', 'Dar es Salaam', -6.79, 39.21, 'yellow', 2, 2, 'pi'],
		['antananarivo', 'Antananarivo', -18.88, 47.51, 'black', 2, 2, 'p'],
		['johannesburg', 'Johannesburg', -26.2, 28.05, 'blue', 2, 2],
	],
	'middle-east': [
		['baghdad', 'Baghdad', 33.31, 44.36, 'black', 2, 2, 'i'],
		['riyadh', 'Riyadh', 24.71, 46.68, 'black', 2, 2],
		['tehran', 'Tehran', 35.69, 51.39, 'black', 1, 2],
		['delhi', 'Delhi', 28.61, 77.21, 'black', 1, 2, 'i'],
		['new-mumbai', 'New Mumbai', 19.03, 73.03, 'black', 2, 2, 'pi'],
		['kolkata', 'Kolkata', 22.57, 88.36, 'black', 1, 2, 'pi'],
	],
	'east-asia': [
		['jakarta', 'Jakarta', -6.21, 106.85, 'red', 1, 1, 'p'],
		['bangkok', 'Bangkok', 13.76, 100.5, 'red', 1, 2, 'p'],
		['ho-chi-minh-city', 'Ho Chi Minh City', 10.82, 106.63, 'red', 1, 2, 'p'],
		['manila', 'Manila', 14.6, 120.98, 'red', 1, 2, 'pi'],
		['hong-kong', 'Hong Kong', 22.32, 114.17, 'red', 1, 2, 'p'],
		['shanghai', 'Shanghai', 31.23, 121.47, 'red', 1, 2, 'pi'],
		['seoul', 'Seoul', 37.57, 126.98, 'red', 1, 2, 'p'],
		['tokyo', 'Tokyo', 35.68, 139.69, 'red', 1, 2, 'pi'],
		['osaka', 'Osaka', 34.69, 135.5, 'red', 1, 2, 'pi'],
	],
	'coral-sea': [['haven-coral-sea', 'Coral Sea Haven', -18, 155, 'haven', 2, 0, 'pl']],
	'new-zealand': [['wellington', 'Wellington', -41.29, 174.78, 'blue', 2, 2, 'p']],
	'eastern-pacific': [['haven-eastern-pacific', 'Eastern Pacific Haven', -2, -92, 'haven', 2, 0, 'pl']],
	'indian-ocean': [['haven-indian-ocean', 'Indian Ocean Haven', -5, 55, 'haven', 2, 0, 'pl']],
	utopia: [
		['utopia', 'Utopia', 40, 103, 'red', 8, 2, 'i'],
		['lake-baikal', 'Lake Baikal', 53.5, 108, 'black', 1, 1, 'l'],
	],
};

const arrivals: Record<string, string> = {
	'haven-eastern-pacific': 'arrive-eastern-pacific',
	'haven-indian-ocean': 'arrive-indian-ocean',
	'lake-baikal': 'arrive-pearl',
};

export const regions: RegionDef[] = regionRows.map(([id, name, neighbours, revealed = false]) => ({
	id: id as RegionId,
	name,
	neighbours: neighbours as RegionId[],
	startsRevealed: revealed,
}));

export const cities: CityDef[] = Object.entries(cityRows).flatMap(([region, rows]) =>
	rows.map(([id, name, lat, lon, color, population, playerCards, flags = '']) => ({
		id: id as CityId,
		name,
		region: region as RegionId,
		lat,
		lon,
		kind: color === 'haven' ? ('haven' as const) : ('city' as const),
		color: color === 'haven' ? null : color,
		port: flags.includes('p'),
		population,
		playerCards,
		startsOnGrid: flags.includes('g'),
		...(flags.includes('l') ? { lost: true } : {}),
		...(flags.includes('i') ? { startsInfested: true } : {}),
		...(arrivals[id] ? { arrival: arrivals[id] as BundleId } : {}),
	})),
);

export const edge = (a: string, b: string, kind: EdgeKind): EdgeDef => ({ a: a as CityId, b: b as CityId, kind });

export const startingEdges: EdgeDef[] = [
	['new-york', 'washington'],
	['washington', 'jacksonville'],
	['new-york', 'haven-north-atlantic'],
	['london', 'haven-north-atlantic'],
	['haven-north-atlantic', 'haven-south-atlantic'],
	['haven-north-atlantic', 'haven-mediterranean'],
	['washington', 'haven-mediterranean'],
	['jacksonville', 'haven-south-atlantic'],
	['washington', 'haven-south-atlantic'],
	['london', 'haven-mediterranean'],
	['haven-mediterranean', 'tripoli'],
	['haven-mediterranean', 'istanbul'],
	['istanbul', 'cairo'],
	['tripoli', 'cairo'],
	['haven-mediterranean', 'haven-south-atlantic'],
	['haven-south-atlantic', 'lagos'],
	['haven-south-atlantic', 'sao-paulo'],
	['lagos', 'sao-paulo'],
].map(([a, b]) => edge(a!, b!, 'sea'));

/** Routes that documented campaigns drew. They seed the candidate list alongside the geographic scan. */
export const documentedEdges: EdgeDef[] = [
	...(
		[
			['chicago', 'new-york'],
			['buenos-aires', 'sao-paulo'],
			['paris', 'london'],
			['kinshasa', 'lagos'],
			['baghdad', 'cairo'],
			['jacksonville', 'atlanta'],
			['chicago', 'denver'],
			['denver', 'los-angeles'],
			['los-angeles', 'san-francisco'],
			['los-angeles', 'mexico-city'],
			['sao-paulo', 'lima'],
			['lima', 'bogota'],
			['istanbul', 'frankfurt'],
			['frankfurt', 'moscow'],
			['moscow', 'tehran'],
			['tehran', 'delhi'],
			['tehran', 'kolkata'],
			['baghdad', 'new-mumbai'],
			['new-mumbai', 'kolkata'],
			['cairo', 'khartoum'],
			['kinshasa', 'johannesburg'],
			['johannesburg', 'dar-es-salaam'],
			['kolkata', 'ho-chi-minh-city'],
			['ho-chi-minh-city', 'hong-kong'],
			['seoul', 'shanghai'],
			['shanghai', 'utopia'],
			['utopia', 'lake-baikal'],
		] as const
	).map(([a, b]) => edge(a, b, 'land')),
	...(
		[
			['jakarta', 'kolkata'],
			['jakarta', 'haven-coral-sea'],
			['haven-coral-sea', 'wellington'],
			['lima', 'haven-eastern-pacific'],
			['los-angeles', 'haven-eastern-pacific'],
			['london', 'st-petersburg'],
			['new-mumbai', 'haven-indian-ocean'],
			['dar-es-salaam', 'haven-indian-ocean'],
			['lagos', 'antananarivo'],
			['antananarivo', 'haven-indian-ocean'],
			['hong-kong', 'manila'],
			['ho-chi-minh-city', 'seoul'],
			['ho-chi-minh-city', 'tokyo'],
			['ho-chi-minh-city', 'osaka'],
			['jakarta', 'bangkok'],
			['osaka', 'seoul'],
			['osaka', 'shanghai'],
		] as const
	).map(([a, b]) => edge(a, b, 'sea')),
];
