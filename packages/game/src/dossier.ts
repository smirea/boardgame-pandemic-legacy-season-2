import { pack } from './content/pack';
import { sealKey } from './content/types';
import type { DoorId, Seal, SealDef } from './content/types';
import { unlockText } from './briefing';
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
