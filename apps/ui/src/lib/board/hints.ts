import type { StructureKind } from '@repo/game';
import type { CityView, ReconBoxView } from './types';

export type HintTone = 'bad' | 'good' | null;

/** One line of a hint: a label and its value, set in two aligned columns. */
export type HintRow = { label: string; value: string; tone?: HintTone };

/** A piece, card or printed mark drawn as a small glyph, the way the table shows it. */
export type Glyph =
	| 'port'
	| StructureKind
	| 'supplies'
	| 'plague'
	| 'hollow'
	| 'card'
	| 'infection'
	| 'epidemic'
	| 'event'
	| 'scar'
	| 'package'
	| 'door'
	| 'objective'
	| 'lab'
	| 'haven';

export type HintCount = { glyph: 'supplies' | 'plague' | 'hollow'; count: number; tone?: HintTone };

/**
 * What a hover over the board explains: a heading, aligned rows of facts, and a sentence or two of rules.
 * A city's heading also carries what marks it (port, buildings) before its name and its cubes after it.
 */
export type HintText = { title: string; marks?: Glyph[]; counts?: HintCount[]; rows: HintRow[]; notes: string[] };

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
	const marks: Glyph[] = [...(city.port ? ['port' as const] : []), ...city.structures.map(entry => entry.kind)];
	const counts: HintCount[] = [{ glyph: 'supplies', count: city.supplies, tone: city.supplies === 0 ? 'bad' : null }];
	if (city.plague) counts.push({ glyph: 'plague', count: city.plague, tone: 'bad' });
	if (city.hollow) counts.push({ glyph: 'hollow', count: city.hollow, tone: 'bad' });
	const rows: HintRow[] = [];
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
	if (city.cards)
		rows.push({
			label: 'Player cards',
			value: `${city.cards.inDeck} in deck, ${city.cards.inHands} in hand, ${city.cards.discarded} discarded`,
		});
	if (city.lab) rows.push({ label: 'Lab', value: 'Found', tone: 'good' });
	if (city.infested) rows.push({ label: 'Infested', value: 'Yes', tone: 'bad' });
	if (city.forsaken) rows.push({ label: 'Forsaken', value: 'Yes', tone: 'bad' });
	return { title: city.name, marks, counts, rows, notes: [] };
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

/** The pile of supply cubes not yet on the board. */
export function stockpileHint(count: number): HintText {
	return {
		title: 'Stockpile',
		marks: ['supplies'],
		rows: [{ label: 'Supply cubes left', value: String(count), tone: count === 0 ? 'bad' : null }],
		notes: ['Cubes placed on cities or taken by players come from here, and cubes removed come back.'],
	};
}

/** What a recon box prints: the region it reveals, what it costs, where it is taken, and why it cannot be now. */
export function reconHint(box: ReconBoxView): { title: string; cost: string; where: string; status: string | null } {
	const cards = `${box.count} ${box.color} card${box.count === 1 ? '' : 's'}`;
	return {
		title: box.name,
		cost: box.unique ? `${cards}, each a different city` : `Any ${cards}`,
		where: box.needsCenter ? `At ${box.cityName}, with a supply center` : `At ${box.cityName}`,
		status: box.state === 'ready' ? 'Click to recon' : box.reason,
	};
}
