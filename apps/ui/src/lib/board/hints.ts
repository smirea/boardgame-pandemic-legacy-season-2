import type { StructureKind } from '@repo/game';
import type { CityView } from './types';

/** What a hover over the board explains: a heading and a few short lines. */
export type HintText = { title: string; lines: string[] };

export type Part = 'city' | 'supplies' | 'plague' | 'hollow' | 'lab' | { structure: StructureKind; permanent: boolean };

/** Names a part, so that leaving one piece cannot clear the hint the next piece has just set. */
export const partKey = (part: Part) => (typeof part === 'string' ? part : part.structure);

export const STRUCTURE_NAME: Record<StructureKind, string> = {
	center: 'Supply center',
	tower: 'Satellite tower',
	shelter: 'Shelter',
};

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

const lasting = (permanent: boolean) =>
	permanent ? 'Permanent: printed on the board, it stands in every game.' : 'Temporary: removed when this game ends.';

function structureLine(kind: StructureKind, permanent: boolean) {
	return `${STRUCTURE_NAME[kind]}, ${permanent ? 'permanent' : 'temporary'}`;
}

/** Everything at one city, for a hover over its disc. */
export function cityHint(city: CityView): HintText {
	const lines = [`Population ${city.population}`];
	lines.push(city.supplies ? plural(city.supplies, 'supply cube') : 'No supply cubes');
	if (city.plague) lines.push(plural(city.plague, 'plague cube'));
	if (city.hollow) lines.push(plural(city.hollow, 'Hollow Man', 'Hollow Men'));
	for (const structure of city.structures) lines.push(structureLine(structure.kind, structure.permanent));
	if (city.lab) lines.push('Lab found here');
	if (city.odds !== null) lines.push(`${Math.round(city.odds * 100)}% chance it is infected next`);
	if (city.infested) lines.push('Infested');
	if (city.forsaken) lines.push('Forsaken');
	if (!city.onGrid) lines.push('Not on the grid: no supply line or sea lane links it to a haven');
	return { title: city.name, lines };
}

/** One piece or printed mark beside a city. */
export function partHint(part: Part, city: CityView): HintText {
	if (part === 'city') return cityHint(city);
	if (part === 'supplies')
		return {
			title: plural(city.supplies, 'supply cube'),
			lines: [`In ${city.name}. An infection here removes one instead of placing a plague cube.`],
		};
	if (part === 'plague')
		return {
			title: plural(city.plague, 'plague cube'),
			lines: [
				`In ${city.name}. Each one was an incident: an infection with no supply cube to stop it.`,
				'A character starting a turn here gains exposure.',
			],
		};
	if (part === 'hollow') return { title: plural(city.hollow, 'Hollow Man', 'Hollow Men'), lines: [`In ${city.name}.`] };
	if (part === 'lab')
		return { title: 'Lab', lines: [`Found in ${city.name}. Every lab found counts toward the final score.`] };
	return { title: STRUCTURE_NAME[part.structure], lines: [`In ${city.name}.`, lasting(part.permanent)] };
}
