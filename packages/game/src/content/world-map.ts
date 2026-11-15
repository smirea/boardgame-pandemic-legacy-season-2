import { buildMap } from './map';

// Provisional until docs/mechanics/data/board.json lands: enough of the world to build the board against.
export const worldMap = buildMap(
	[
		{
			id: 'havens',
			name: 'Havens',
			explored: true,
			affiliation: null,
			cities: [
				['haven-north-atlantic', 'North Atlantic Haven', 38, -42, 0, 'hg'],
				['haven-south-atlantic', 'South Atlantic Haven', -18, -18, 0, 'hg'],
				['haven-mediterranean', 'Mid-Atlantic Haven', 12, -30, 0, 'hg'],
			],
		},
		{
			id: 'atlantic-americas',
			name: 'Atlantic Americas',
			explored: true,
			affiliation: 'blue',
			cities: [
				['new-york', 'New York', 40.71, -74.0, 4, 'cg'],
				['washington', 'Washington', 38.9, -77.04, 3, 'cg'],
				['jacksonville', 'Jacksonville', 30.33, -81.66, 2, 'cg'],
				['sao-paulo', 'São Paulo', -23.55, -46.63, 4, 'cg'],
			],
		},
		{
			id: 'atlantic-europe-africa',
			name: 'Atlantic Europe and Africa',
			explored: true,
			affiliation: 'yellow',
			cities: [
				['london', 'London', 51.5, -0.12, 4, 'cg'],
				['lagos', 'Lagos', 6.52, 3.38, 3, 'cg'],
			],
		},
		{
			id: 'mediterranean',
			name: 'Mediterranean',
			explored: true,
			affiliation: 'black',
			cities: [
				['istanbul', 'Istanbul', 41.01, 28.98, 4, 'cg'],
				['tripoli', 'Tripoli', 32.89, 13.19, 2, 'cg'],
				['cairo', 'Cairo', 30.04, 31.24, 3, 'cg'],
			],
		},
		{
			id: 'north-america-interior',
			name: 'North America Interior',
			affiliation: 'blue',
			cities: [
				['chicago', 'Chicago', 41.88, -87.63, 3],
				['atlanta', 'Atlanta', 33.75, -84.39, 2],
				['denver', 'Denver', 39.74, -104.99, 2],
				['los-angeles', 'Los Angeles', 34.05, -118.24, 3, 'c'],
			],
		},
		{
			id: 'south-america',
			name: 'South America',
			affiliation: 'yellow',
			cities: [
				['bogota', 'Bogotá', 4.71, -74.07, 3],
				['lima', 'Lima', -12.05, -77.04, 2, 'c'],
				['buenos-aires', 'Buenos Aires', -34.6, -58.38, 3, 'c'],
				['santiago', 'Santiago', -33.45, -70.67, 2],
			],
		},
	],
	[
		['haven-north-atlantic', 'new-york', 'sea', true],
		['haven-north-atlantic', 'london', 'sea', true],
		['haven-north-atlantic', 'haven-mediterranean', 'sea', true],
		['haven-mediterranean', 'haven-south-atlantic', 'sea', true],
		['haven-mediterranean', 'lagos', 'sea', true],
		['haven-south-atlantic', 'sao-paulo', 'sea', true],
		['haven-mediterranean', 'jacksonville', 'sea', true],
		['new-york', 'washington', 'land', true],
		['washington', 'jacksonville', 'land', true],
		['london', 'tripoli', 'sea', true],
		['tripoli', 'cairo', 'land', true],
		['cairo', 'istanbul', 'land', true],
		['new-york', 'chicago', 'land'],
		['washington', 'atlanta', 'land'],
		['atlanta', 'chicago', 'land'],
		['chicago', 'denver', 'land'],
		['denver', 'los-angeles', 'land'],
		['sao-paulo', 'buenos-aires', 'land'],
		['sao-paulo', 'bogota', 'land'],
		['bogota', 'lima', 'land'],
		['lima', 'santiago', 'land'],
		['santiago', 'buenos-aires', 'land'],
	],
);
