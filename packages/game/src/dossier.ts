import { pack } from './content/pack';
import { sealKey } from './content/types';
import type { DoorId, Seal, SealDef, TurningPointId } from './content/types';
import { actionBriefs, ruleBriefs, unlockText } from './briefing';
import { newCampaign } from './legacy';
import type { Campaign } from './state';

/**
 * A package or door as the table sees it. What it holds is named and worded only once it is open, so nothing
 * sealed leaks.
 */
export type DossierSlot<Id> = {
	id: Id;
	open: boolean;
	forced: boolean;
	name: string | null;
	contents: string[];
};

export type DossierView = {
	packages: DossierSlot<number>[];
	sheets: DossierSlot<DoorId>[][];
};

function contents(campaign: Campaign, def: SealDef, forced: boolean): string[] {
	const unlocks = [...def.unlocks, ...(forced ? [] : (def.reward ?? []))];
	const doors = unlocks.flatMap(unlock => (unlock.t === 'open' ? [String(unlock.seal.id)] : []));
	return [
		...unlocks.flatMap(unlock => {
			const text = unlockText(campaign, unlock);
			return text ? [text] : [];
		}),
		...(doors.length ? [`Opened door${doors.length > 1 ? 's' : ''} ${doors.join(', ')}.`] : []),
	];
}

function slot<Id extends number | DoorId>(campaign: Campaign, seal: Seal & { id: Id }): DossierSlot<Id> {
	const key = sealKey(seal);
	const open = campaign.opened.includes(key);
	const def = pack.seals.find(candidate => sealKey(candidate.seal) === key)!;
	return {
		id: seal.id,
		open,
		forced: campaign.forced.includes(key),
		name: open ? def.name : null,
		contents: open ? contents(campaign, def, campaign.forced.includes(key)) : [],
	};
}

export function dossierView(campaign: Campaign): DossierView {
	return {
		packages: pack.dossier.packages.map(id => slot(campaign, { t: 'package', id })),
		sheets: pack.dossier.sheets.map(sheet => sheet.map(id => slot(campaign, { t: 'door', id }))),
	};
}

const TURNING_POINTS: Record<TurningPointId, string> = {
	firstForsaken: 'Watching for the first city at population 0.',
	losingStreak: 'Watching for four games lost in a row.',
	defection: 'Watching for a game that ends with Hollow Men in three different havens.',
};

/** What the group's rulebook holds by now: the rules in force, the actions unlocked and the turning points waiting. */
export function rulebook(campaign: Campaign) {
	const start = new Set(newCampaign(0).actions);
	return {
		rules: campaign.rules.map(rule => ({ id: rule, text: ruleBriefs[rule] ?? rule })),
		actions: campaign.actions
			.filter(action => !start.has(action))
			.map(action => ({ id: action, text: actionBriefs[action] ?? action })),
		turningPoints: campaign.turningPoints.map(id => ({ id, text: TURNING_POINTS[id] })),
	};
}

const count = <T extends string>(ids: T[]) => {
	const counts = new Map<T, number>();
	for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
	return [...counts];
};

/** The stickers still in the box for the group to buy or be given, each with how many are left. */
export function stickerStock(campaign: Campaign) {
	const named = <T extends { id: string; name: string; text: string }>(list: T[], [id, left]: [string, number]) => {
		const def = list.find(entry => entry.id === id)!;
		return { id, name: def.name, text: def.text, left };
	};
	return {
		abilities: count(campaign.abilitiesForSale).map(entry => named(pack.abilities, entry)),
		scars: count(campaign.scars).map(entry => named(pack.scars, entry)),
		cityImprovements: count(campaign.cityImprovementsForSale).map(entry => named(pack.cityImprovements, entry)),
		infectionImprovements: count(campaign.infectionImprovementsForSale).map(entry =>
			named(pack.infectionImprovements, entry),
		),
		permanent: count(campaign.permanentForSale),
		jobsWaiting: campaign.jobsFound.map(found => pack.jobs.find(job => job.id === found.job)!.name),
	};
}
