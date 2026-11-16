import { pack } from './content/pack';
import type { JobId } from './content/types';
import { documentedEdges } from './content/world';
import { gridCityCount, hasEdge } from './helpers';
import type { BundleId, CityId } from './ids';
import { createCharacter, newCampaign, openBundle, readLegacy } from './legacy';
import type { Save } from './machine';
import type { World } from './state';

const CAST: [name: string, job: JobId][] = [
	['Ada', 'administrator'],
	['Bo', 'farmer'],
	['Cy', 'instructor'],
	['Di', 'laborer'],
	['Eve', 'radioOperator'],
];

/** What a group that explored on schedule would have opened, by the month they opened it. */
const EXPLORED: Record<number, string[]> = {
	1: ['north-america'],
	3: ['south-america', 'opal'],
	4: ['find-eastern-pacific'],
	5: ['europe'],
	6: ['africa', 'jade'],
	7: ['middle-east', 'find-indian-ocean', 'arrive-indian-ocean'],
	9: ['east-asia', 'coral-sea'],
	10: ['new-zealand', 'defection'],
	11: ['utopia'],
};

const PERMANENT: [city: string, structure: 'center' | 'tower' | 'shelter'][] = [
	['johannesburg', 'center'],
	['cairo', 'center'],
	['washington', 'center'],
	['shanghai', 'center'],
	['kolkata', 'center'],
	['tripoli', 'tower'],
];

/**
 * A campaign that won every month before `month` and stands in that month's lobby: regions explored
 * on schedule, the documented routes drawn between revealed locations, a few permanent structures.
 * The sample lab at Lake Baikal is never pre-connected, so December still has to reach it in play.
 */
export function campaignAt(month: number, seed = 12): Save {
	const world: World = { campaign: newCampaign(seed), game: null };
	const campaign = world.campaign;
	const havens = pack.cities.filter(city => city.kind === 'haven' && !city.lost).map(city => city.id);
	CAST.forEach(([name, job], index) => createCharacter(campaign, { name, job, home: havens[index % havens.length]! }));

	for (let played = 1; played < month; played++) {
		campaign.month = played;
		readLegacy(world, 'setup');
		for (const bundle of EXPLORED[played] ?? []) openBundle(world, bundle as BundleId, false);
		readLegacy(world, 'gameEnd', true);
		campaign.results.push({
			month: played,
			attempt: 1,
			won: true,
			gridCities: gridCityCount(campaign),
			rationing: campaign.rationing,
			characters: [],
		});
	}
	campaign.month = month;
	campaign.attempt = 1;
	campaign.briefing = [];

	const revealed = (city: CityId) => campaign.locations[city]!.revealed;
	for (const edge of documentedEdges) {
		const reachesSample = edge.a === pack.sampleFrom || edge.b === pack.sampleFrom;
		if (reachesSample || !revealed(edge.a) || !revealed(edge.b) || hasEdge(campaign, edge.a, edge.b)) continue;
		campaign.edges.push({ ...edge });
	}
	for (const [city, structure] of PERMANENT) {
		if (revealed(city as CityId)) campaign.locations[city as CityId]!.permanent.push(structure);
	}
	const [ada, bo, cy] = Object.values(campaign.characters);
	ada!.slots[0] = { kind: 'ability', id: 'helmsman' };
	bo!.slots[0] = { kind: 'ability', id: 'recordKeeper' };
	cy!.slots[0] = { kind: 'ability', id: 'courier' };
	return { v: 1, phase: 'lobby', world };
}

export const octoberSave = (seed?: number) => campaignAt(10, seed);
export const decemberSave = (seed?: number) => campaignAt(12, seed);

export const scenarios = { october: octoberSave, december: decemberSave };
