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

/** A lasting condition of a city, named and explained first, right under the heading. */
export type HintEffect = { name: string; text: string; tone: HintTone };

/**
 * What a hover over the board explains: a heading, aligned rows of facts, and a sentence or two of rules.
 * A city's heading also carries what marks it (port, buildings) before its name and its cubes after it.
 */
export type HintText = {
	title: string;
	marks?: Glyph[];
	counts?: HintCount[];
	effects?: HintEffect[];
	rows: HintRow[];
	notes: string[];
};

export type Part =
	| 'city'
	| 'supplies'
	| 'plague'
	| 'hollow'
	| 'lab'
	| { structure: StructureKind; permanent: boolean; placed: boolean };

/** Names a part, so that leaving one piece cannot clear the hint the next piece has just set. */
export const partKey = (part: Part) => (typeof part === 'string' ? part : part.structure);

export const STRUCTURE_NAME: Record<StructureKind, string> = {
	center: 'Supply center',
	tower: 'Satellite tower',
	shelter: 'Shelter',
};

const percent = (odds: number) => `${Math.round(odds * 100)}%`;

function structureValue(entry: { permanent: boolean; placed: boolean }, inGame: boolean): string {
	if (entry.permanent && entry.placed) return 'Permanent';
	if (entry.permanent) return inGame ? 'Permanent sticker (piece moved)' : 'Permanent (placed on game start)';
	return 'This game';
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const SHELTERED = 'Its Shelter keeps characters here from exposure and the city from losing population.';

/** What sets this city apart, worst first, each with what it does here. */
function cityEffects(city: CityView): HintEffect[] {
	const sheltered = city.structures.some(entry => entry.kind === 'shelter' && entry.placed);
	const effects: HintEffect[] = [];
	if (city.forsaken)
		effects.push({
			name: 'Forsaken',
			text: 'Population 0. Its Infection cards are set aside when flipped, and only Drive or Ferry works here.',
			tone: 'bad',
		});
	if (city.infested)
		effects.push({
			name: 'Infested',
			text: `For good. ${sheltered ? SHELTERED : 'A character who starts a turn here is exposed.'}`,
			tone: 'bad',
		});
	if (city.plague)
		effects.push({
			name: 'Infected',
			text: `${plural(city.plague, 'plague cube', 'plague cubes')}. ${sheltered ? SHELTERED : 'A character who starts a turn here is exposed, and it loses 1 population at Game End.'}`,
			tone: 'bad',
		});
	if (city.hollow)
		effects.push({
			name: 'Hollowed',
			text: `${plural(city.hollow, 'Hollow Man', 'Hollow Men')}. ${sheltered ? SHELTERED : 'A character who leaves is exposed, and it loses 1 population at Game End.'}`,
			tone: 'bad',
		});
	if (city.inoculated)
		effects.push({
			name: 'Inoculated',
			text: `Every Infection card of ${city.name} is in storage, so the Infection deck cannot infect it.${city.storageLeaks ? ' An Epidemic may still pull one back out.' : ''}`,
			tone: 'good',
		});
	return effects;
}

/** Everything at one city, for a hover over its disc. */
export function cityHint(city: CityView): HintText {
	const marks: Glyph[] = [
		...(city.haven ? ['haven' as const] : []),
		...(city.port ? ['port' as const] : []),
		...city.structures.map(entry => entry.kind),
		...(city.lab ? ['lab' as const] : []),
	];
	const counts: HintCount[] = [];
	if (city.inGame || city.supplies > 0)
		counts.push({ glyph: 'supplies', count: city.supplies, tone: city.supplies === 0 ? 'bad' : null });
	if (city.plague) counts.push({ glyph: 'plague', count: city.plague, tone: 'bad' });
	if (city.hollow) counts.push({ glyph: 'hollow', count: city.hollow, tone: 'bad' });
	const rows: HintRow[] = [];
	if (city.infection)
		rows.push({
			label: 'Infected next',
			value: percent(city.infection.odds),
			tone: city.infection.odds > 0 && city.supplies === 0 ? 'bad' : null,
		});
	if (city.stock) {
		const piles = city.infection
			? [`${city.infection.inDeck} in deck`, `${city.infection.discarded} discarded`]
			: [`${city.stock.inPlay} in the Infection deck`];
		if (city.stock.stored) piles.push(`${city.stock.stored} inoculated`);
		rows.push({ label: 'Infection cards', value: piles.join(', '), tone: city.inoculated ? 'good' : null });
	}
	if (city.cards)
		rows.push({
			label: 'Player cards',
			value: `${city.cards.inDeck} in deck, ${city.cards.inHands} in hand, ${city.cards.discarded} discarded`,
		});
	if (!city.onGrid) rows.push({ label: 'Grid', value: 'Off the grid', tone: 'bad' });
	if (city.haven) rows.push({ label: 'Port', value: 'Haven (sea access)', tone: 'good' });
	else if (city.port) rows.push({ label: 'Port', value: 'Sea access' });
	for (const entry of city.structures)
		rows.push({
			label: STRUCTURE_NAME[entry.kind],
			value: structureValue(entry, city.inGame),
			tone: entry.placed || !city.inGame ? 'good' : null,
		});
	if (city.labInfo) {
		rows.push({
			label: city.labInfo.name,
			value: city.labInfo.active ? 'Breakthrough active' : 'Found (permanent)',
			tone: 'good',
		});
		if (city.labInfo.doses)
			rows.push({
				label: 'Sample doses',
				value: `${city.labInfo.doses.left} of ${city.labInfo.doses.total} left`,
				tone: city.labInfo.doses.left === 0 ? 'bad' : 'good',
			});
	} else if (city.lab) rows.push({ label: 'Lab', value: 'Found (permanent)', tone: 'good' });
	const notes = [
		...(city.haven ? ['No Infection card names a haven. An outbreak in a neighbouring city still strikes it.'] : []),
		...(city.labInfo?.effect ? [`${city.labInfo.name}: ${city.labInfo.effect}`] : []),
	];
	return { title: city.name, marks, counts, effects: cityEffects(city), rows, notes };
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
	if (part === 'lab') {
		const rows: HintRow[] = [here];
		if (city.labInfo?.active) rows.push({ label: 'Status', value: 'Breakthrough active', tone: 'good' });
		if (city.labInfo?.doses)
			rows.push({
				label: 'Sample doses',
				value: `${city.labInfo.doses.left} of ${city.labInfo.doses.total} left`,
				tone: city.labInfo.doses.left === 0 ? 'bad' : 'good',
			});
		const notes = [
			...(city.labInfo?.effect ? [city.labInfo.effect] : []),
			'Every lab found counts toward the final score.',
		];
		return { title: city.labInfo?.name ?? 'Lab', rows, notes };
	}
	const note = part.permanent
		? part.placed
			? 'Marked with a permanent sticker on the board and placed automatically on game start.'
			: city.inGame
				? 'Marked with a permanent sticker, though its piece was moved elsewhere this game.'
				: 'Permanent map sticker: its piece is placed here on game start.'
		: 'Built this game; removed when this game ends.';
	return {
		title: STRUCTURE_NAME[part.structure],
		rows: [here, { label: 'Status', value: structureValue(part, city.inGame) }],
		notes: [note],
	};
}

/** The pile of supply cubes not yet on the board. */
export function stockpileHint(count: number, reserve?: number | null): HintText {
	const rows: HintRow[] = [{ label: 'Supply cubes left', value: String(count), tone: count === 0 ? 'bad' : null }];
	if (reserve != null)
		rows.push({ label: 'Reserve cubes', value: String(reserve), tone: reserve === 0 ? 'bad' : null });
	return {
		title: 'Stockpile',
		marks: ['supplies'],
		rows,
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
