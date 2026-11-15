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
	5: ['europe', 'find-eastern-pacific'],
	6: ['africa', 'jade'],
	7: ['middle-east', 'find-indian-ocean', 'arrive-indian-ocean'],
	9: ['east-asia', 'coral-sea'],
	10: ['new-zealand', 'defection'],
	11: ['utopia'],
};

const PERMANENT_CENTERS = ['johannesburg', 'cairo', 'washington', 'shanghai', 'kolkata'];

/**
 * A campaign that won every month and stands in the December lobby: every region explored, the
 * documented routes drawn, and Utopia open. Lake Baikal still has to be connected in play.
 */
export function decemberSave(seed = 12): Save {
	const world: World = { campaign: newCampaign(seed), game: null };
	const campaign = world.campaign;
	const havens = pack.cities.filter(city => city.kind === 'haven' && !city.lost).map(city => city.id);
	CAST.forEach(([name, job], index) => createCharacter(campaign, { name, job, home: havens[index % havens.length]! }));

	for (let month = 1; month <= 11; month++) {
		campaign.month = month;
		readLegacy(world, 'setup');
		for (const bundle of EXPLORED[month] ?? []) openBundle(world, bundle as BundleId, false);
		readLegacy(world, 'gameEnd', true);
		campaign.results.push({
			month,
			attempt: 1,
			won: true,
			gridCities: gridCityCount(campaign),
			rationing: campaign.rationing,
		});
	}
	campaign.month = 12;
	campaign.attempt = 1;
	campaign.briefing = [];

	const sample = pack.sampleFrom;
	for (const edge of documentedEdges) {
		if (edge.a === sample || edge.b === sample || hasEdge(campaign, edge.a, edge.b)) continue;
		campaign.edges.push({ ...edge });
	}
	for (const city of PERMANENT_CENTERS) campaign.locations[city as CityId]!.permanent.push('center');
	const [ada, bo, cy] = Object.values(campaign.characters);
	ada!.slots[0] = { kind: 'ability', id: 'helmsman' };
	bo!.slots[0] = { kind: 'ability', id: 'recordKeeper' };
	cy!.slots[0] = { kind: 'ability', id: 'courier' };
	return { v: 1, phase: 'lobby', world };
}

export const scenarios = { december: decemberSave };
