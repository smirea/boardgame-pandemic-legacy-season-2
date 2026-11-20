import { pack } from './content/pack';
import type { DoorId } from './content/types';
import type { Campaign } from './state';

/** A door or package as the table sees it. What it opened is named only once it is open, so nothing sealed leaks. */
export type DossierSlot<Id> = { id: Id; open: boolean; opened: string | null };

export type DossierView = {
	packages: DossierSlot<number>[];
	sheets: DossierSlot<DoorId>[][];
};

const holders = [...pack.bundles, ...pack.legacyDeck];
const doorHolder = (door: DoorId) => holders.find(holder => holder.doors?.includes(door));
const packageHolder = (id: number) => pack.bundles.find(bundle => bundle.package === id);
const label = (holder: (typeof holders)[number] | undefined) =>
	!holder ? null : 'name' in holder ? holder.name : holder.title;

export function dossierView(campaign: Campaign): DossierView {
	return {
		packages: pack.dossier.packages.map(id => {
			const open = campaign.packages.includes(id);
			return { id, open, opened: open ? label(packageHolder(id)) : null };
		}),
		sheets: pack.dossier.sheets.map(sheet =>
			sheet.map(id => {
				const open = campaign.doors.includes(id);
				return { id, open, opened: open ? label(doorHolder(id)) : null };
			}),
		),
	};
}
