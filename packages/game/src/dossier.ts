import { pack } from './content/pack';
import { sealKey } from './content/types';
import type { DoorId, RuleId, Seal, SealDef, TurningPointId } from './content/types';
import { INFESTED_STICKERS } from './helpers';
import { unlockText } from './briefing';
import { RULEBOOK, RULE_STICKERS } from './content/rulebook';
import type { RuleBlock, RuleGate, RuleText, StickerSlot } from './content/rulebook';
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

/** What the box still holds for a rule that uses up a supply: doses of the sample, Infested stickers. */
function ruleCount(campaign: Campaign, rule: RuleId): string {
	if (rule === 'carrier')
		return ` Doses left: ${pack.numbers.selfInfectDoses - campaign.dosesUsed} of ${pack.numbers.selfInfectDoses}.`;
	if (rule === 'forsaken') {
		const used = pack.cities.filter(city => !city.startsInfested && campaign.locations[city.id]!.infested).length;
		return ` Infested stickers left: ${Math.max(0, INFESTED_STICKERS - used)} of ${INFESTED_STICKERS}.`;
	}
	return '';
}

export type RulebookBlock = (RuleText & { sticker?: StickerSlot }) | { t: 'slot'; sticker: StickerSlot };
export type RulebookSection = { id: string; title: string; blocks: RulebookBlock[] };
export type RulebookChapter = { id: string; title: string; sections: RulebookSection[] };

function gateOpen(campaign: Campaign, gate: RuleGate): boolean {
	return gate.t === 'prologue' ? campaign.month === 0 : campaign.opened.includes(sealKey(gate.seal));
}

const stickerPlaced = (campaign: Campaign, slot: StickerSlot) => campaign.opened.includes(sealKey(RULE_STICKERS[slot]));

function shownBlocks(campaign: Campaign, blocks: RuleBlock[]): RulebookBlock[] {
	const shown: RulebookBlock[] = [];
	for (const { sticker, replacedBy, when, count, ...text } of blocks) {
		if (when && !gateOpen(campaign, when)) continue;
		if (replacedBy && stickerPlaced(campaign, replacedBy)) continue;
		if (sticker && !stickerPlaced(campaign, sticker)) {
			const last = shown.at(-1);
			if (!(last?.t === 'slot' && last.sticker === sticker)) shown.push({ t: 'slot', sticker });
			continue;
		}
		const counted = count && text.t === 'p' ? { ...text, text: text.text + ruleCount(campaign, count) } : text;
		shown.push(sticker ? { ...counted, sticker } : counted);
	}
	return shown;
}

/** What waits in the Game End area: the turning points still to trigger and the relief still owed. */
function waiting(campaign: Campaign): RulebookSection | null {
	const blocks: RulebookBlock[] = [
		...campaign.turningPoints.map(id => ({ t: 'p' as const, text: TURNING_POINTS[id] })),
		...(campaign.losingStreakBonusGames > 0
			? [
					{
						t: 'p' as const,
						text: `Give Us the Tools: up to 10 reserve cubes join the stockpile at setup, ${campaign.losingStreakBonusGames} more ${campaign.losingStreakBonusGames === 1 ? 'game' : 'games'}.`,
					},
				]
			: []),
	];
	return blocks.length ? { id: 'turning-points', title: 'Turning points waiting', blocks } : null;
}

/**
 * The group's rulebook as it reads by now: the printed rules with every rule sticker the campaign has placed, the
 * printed text those stickers cover taken out, the slots still empty, and the rules each opened package or door
 * brought. Nothing still sealed is in it.
 */
export function rulebook(campaign: Campaign): RulebookChapter[] {
	return RULEBOOK.map(chapter => {
		const sections = chapter.sections
			.filter(section => !section.when || gateOpen(campaign, section.when))
			.map(section => ({ id: section.id, title: section.title, blocks: shownBlocks(campaign, section.blocks) }))
			.filter(section => section.blocks.length > 0);
		const extra = chapter.id === 'game-end' ? waiting(campaign) : null;
		return { id: chapter.id, title: chapter.title, sections: extra ? [...sections, extra] : sections };
	});
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
