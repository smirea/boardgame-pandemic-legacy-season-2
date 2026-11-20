import { pack } from './content/pack';
import type { JobId, Seal, SealKey } from './content/types';
import { sealKey } from './content/types';
import { documentedEdges } from './content/world';
import { gridCityCount, hasEdge } from './helpers';
import type { CityId } from './ids';
import { createCharacter, newCampaign, openSeal, readLegacy } from './legacy';
import type { Save } from './machine';
import type { World } from './state';
import { newTable } from './table';
import { tabletopSave } from './tabletop';

const CAST: [name: string, job: JobId][] = [
	['Ada', 'administrator'],
	['Bo', 'farmer'],
	['Cy', 'instructor'],
	['Di', 'laborer'],
	['Eve', 'radioOperator'],
];

/** What a group that explored on schedule would have opened, by the month they opened it. */
const pkg = (id: number): Seal => ({ t: 'package', id });
const door = (id: string): Seal => ({ t: 'door', id });
const EXPLORED: Record<number, Seal[]> = {
	1: [pkg(1)],
	3: [pkg(5), door('20')],
	4: [door('60'), pkg(6)],
	5: [pkg(4)],
	6: [pkg(7), door('46')],
	7: [pkg(2), door('65'), door('11')],
	9: [pkg(3), door('59')],
	10: [door('19'), door('17')],
	11: [pkg(8)],
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
 * `unexplored` names bundles this group never opened, and `cast` replaces the usual five characters.
 */
export function campaignAt(
	month: number,
	seed = 12,
	{ unexplored = [], cast = CAST }: { unexplored?: SealKey[]; cast?: [name: string, job: JobId][] } = {},
): Save {
	const world: World = { campaign: newCampaign(seed), game: null, table: newTable() };
	const campaign = world.campaign;
	const havens = pack.cities.filter(city => city.kind === 'haven' && !city.lost).map(city => city.id);
	cast.forEach(([name, job], index) => createCharacter(campaign, { name, job, home: havens[index % havens.length]! }));

	for (let played = 1; played < month; played++) {
		campaign.month = played;
		readLegacy(world, 'setup');
		for (const seal of EXPLORED[played] ?? []) if (!unexplored.includes(sealKey(seal))) openSeal(world, seal, false);
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
	if (cast === CAST) {
		const [ada, bo, cy] = Object.values(campaign.characters);
		ada!.slots[0] = { kind: 'ability', id: 'helmsman' };
		bo!.slots[0] = { kind: 'ability', id: 'recordKeeper' };
		cy!.slots[0] = { kind: 'ability', id: 'courier' };
	}
	return { v: 1, phase: 'lobby', world };
}

export const octoberSave = (seed?: number) => campaignAt(10, seed);
export const decemberSave = (seed?: number) => campaignAt(12, seed);

export const scenarios = { october: octoberSave, december: decemberSave, tabletop: tabletopSave };
