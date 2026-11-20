import { pack } from '@repo/game';
import type { Character, JobId } from '@repo/game';

export type Trait = { kind: 'job' | 'ability' | 'scar'; job?: JobId; name: string; text: string; struck?: boolean };

export const TRAIT_KIND = { job: 'Occupation', ability: 'Ability', scar: 'Scar' } as const;

/** The character card, one line each: the job, then every ability and scar written on it. */
export function characterTraits(character: Character): Trait[] {
	const lines: Trait[] = [];
	const job = pack.jobs.find(candidate => candidate.id === character.job);
	if (job) lines.push({ kind: 'job', job: job.id, name: job.name, text: job.text, struck: character.jobScar !== null });
	if (character.jobScar) {
		const scar = pack.scars.find(candidate => candidate.id === character.jobScar);
		if (scar) lines.push({ kind: 'scar', name: scar.name, text: scar.text });
	}
	for (const slot of character.slots) {
		if (!slot) continue;
		const def =
			slot.kind === 'ability'
				? pack.abilities.find(ability => ability.id === slot.id)
				: pack.scars.find(scar => scar.id === slot.id);
		if (def) lines.push({ kind: slot.kind, name: def.name, text: def.text });
	}
	return lines;
}
