import { pack } from '@repo/game';
import type { Character, CityId, JobId, ScarId } from '@repo/game';
import { cityName, MONTHS } from './labels.svelte.ts';

export type Trait = {
	kind: 'job' | 'ability' | 'scar';
	job?: JobId;
	name: string;
	text: string;
	struck?: boolean;
	/** Where and when a scar was taken, such as "Lagos, March". */
	taken?: string;
};

/** Where and when something happened to a character, as the card writes it. */
export const placed = (at: CityId | null, month: number) =>
	[at && cityName(at), MONTHS[month]].filter(Boolean).join(', ');

const takenOf = (character: Character, scar: ScarId) => {
	// A recording from before scars kept their place plays back as written, with no such record.
	const record = character.scarred?.[scar];
	return record ? placed(record.at, record.month) : undefined;
};

export const TRAIT_KIND = { job: 'Occupation', ability: 'Ability', scar: 'Scar' } as const;

/** The character card, one line each: the job, then every ability and scar written on it. */
export function characterTraits(character: Character): Trait[] {
	const lines: Trait[] = [];
	const job = pack.jobs.find(candidate => candidate.id === character.job);
	if (job) lines.push({ kind: 'job', job: job.id, name: job.name, text: job.text, struck: character.jobScar !== null });
	if (character.jobScar) {
		const scar = pack.scars.find(candidate => candidate.id === character.jobScar);
		if (scar) lines.push({ kind: 'scar', name: scar.name, text: scar.text, taken: takenOf(character, scar.id) });
	}
	// A scar printed across two slots, such as Carrier, is one sticker: it is listed once.
	const spanning = new Set<string>();
	for (const slot of character.slots) {
		if (!slot) continue;
		if (slot.kind === 'scar' && (pack.scars.find(scar => scar.id === slot.id)?.slots ?? 1) > 1) {
			if (spanning.has(slot.id)) continue;
			spanning.add(slot.id);
		}
		const def =
			slot.kind === 'ability'
				? pack.abilities.find(ability => ability.id === slot.id)
				: pack.scars.find(scar => scar.id === slot.id);
		if (def)
			lines.push({
				kind: slot.kind,
				name: def.name,
				text: def.text,
				taken: slot.kind === 'scar' ? takenOf(character, slot.id) : undefined,
			});
	}
	return lines;
}
