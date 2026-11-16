import type { StructureKind } from '@repo/game';
import type { CityView } from './types';

export type HintTone = 'bad' | 'good' | null;

/** One line of a hint: a label and its value, set in two aligned columns. */
export type HintRow = { label: string; value: string; tone?: HintTone };

/** What a hover over the board explains: a heading, aligned rows of facts, and a sentence or two of rules. */
export type HintText = { title: string; rows: HintRow[]; notes: string[] };

export type Part = 'city' | 'supplies' | 'plague' | 'hollow' | 'lab' | { structure: StructureKind; permanent: boolean };

/** Names a part, so that leaving one piece cannot clear the hint the next piece has just set. */
export const partKey = (part: Part) => (typeof part === 'string' ? part : part.structure);

export const STRUCTURE_NAME: Record<StructureKind, string> = {
	center: 'Supply center',
	tower: 'Satellite tower',
	shelter: 'Shelter',
};

const percent = (odds: number) => `${Math.round(odds * 100)}%`;

/** Everything at one city, for a hover over its disc. */
export function cityHint(city: CityView): HintText {
	const rows: HintRow[] = [
		{ label: 'Population', value: String(city.population) },
		{ label: 'Supply cubes', value: String(city.supplies), tone: city.supplies === 0 ? 'bad' : null },
		{ label: 'Plague cubes', value: String(city.plague), tone: city.plague > 0 ? 'bad' : null },
	];
	if (city.hollow) rows.push({ label: 'Hollow Men', value: String(city.hollow), tone: 'bad' });
	if (city.infection) {
		rows.push({
			label: 'Infected next',
			value: percent(city.infection.odds),
			tone: city.infection.odds > 0 && city.supplies === 0 ? 'bad' : null,
		});
		rows.push({
			label: 'Infection cards',
			value: `${city.infection.inDeck} in deck, ${city.infection.discarded} discarded`,
		});
	}
	for (const structure of city.structures)
		rows.push({ label: STRUCTURE_NAME[structure.kind], value: structure.permanent ? 'Permanent' : 'Temporary' });
	if (city.lab) rows.push({ label: 'Lab', value: 'Found', tone: 'good' });
	if (city.port) rows.push({ label: 'Port', value: 'Sea moves start or end here' });
	rows.push({ label: 'Grid', value: city.onGrid ? 'Connected' : 'Not connected', tone: city.onGrid ? null : 'bad' });
	if (city.infested) rows.push({ label: 'Infested', value: 'Yes', tone: 'bad' });
	if (city.forsaken) rows.push({ label: 'Forsaken', value: 'Yes', tone: 'bad' });
	return { title: city.name, rows, notes: [] };
}

/** One piece or printed mark beside a city. */
export function partHint(part: Part, city: CityView): HintText {
	if (part === 'city') return cityHint(city);
	const here = { label: 'City', value: city.name };
	if (part === 'supplies')
		return {
			title: 'Supply cubes',
			rows: [{ label: 'Count', value: String(city.supplies) }, here],
			notes: ['An infection here removes one instead of placing a plague cube.'],
		};
	if (part === 'plague')
		return {
			title: 'Plague cubes',
			rows: [{ label: 'Count', value: String(city.plague), tone: 'bad' }, here],
			notes: [
				'Each one was an incident: an infection with no supply cube to stop it.',
				'A character starting a turn here gains exposure.',
			],
		};
	if (part === 'hollow')
		return {
			title: 'Hollow Men',
			rows: [{ label: 'Count', value: String(city.hollow), tone: 'bad' }, here],
			notes: [],
		};
	if (part === 'lab') return { title: 'Lab', rows: [here], notes: ['Every lab found counts toward the final score.'] };
	return {
		title: STRUCTURE_NAME[part.structure],
		rows: [here, { label: 'Lasts', value: part.permanent ? 'Permanent' : 'This game only' }],
		notes: [part.permanent ? 'Printed on the board, it stands in every game.' : 'Removed when this game ends.'],
	};
}
