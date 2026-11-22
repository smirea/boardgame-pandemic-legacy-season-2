import { pack } from '@repo/game';
import type { CityId, CompanionId, EventId, PlayerCard, Seal } from '@repo/game';
import {
	cityImprovementScans,
	cityScans,
	doorScans,
	eventScans,
	legacyScans,
	packageScans,
	produceScans,
	searchCityScans,
} from './scans.generated.ts';
import type { Scan } from './scans.generated.ts';

export type { Scan };

/** Served by the Bun server from `docs/assets`. */
export const scanUrl = (src: string) => `/api/scans/${src}`;

export const sealScans = (seal: Seal): Scan[] =>
	(seal.t === 'package' ? packageScans[seal.id] : doorScans[seal.id]) ?? [];

export const eventScan = (id: EventId): Scan[] => (eventScans[id] ? [eventScans[id]] : []);

const companionCity: Partial<Record<CompanionId, CityId>> = {};
for (const [city, boxes] of Object.entries(pack.searches)) {
	for (const box of boxes) {
		if (box.result.t === 'companion') companionCity[box.result.companion] = city as CityId;
	}
}

export type PlayerCardScan = { card: Scan; sticker?: Scan };

/** Printed scan for any non-standard player card (events, epidemics, produce supplies, searches, companions, improvements). */
export function playerCardScan(card: PlayerCard): PlayerCardScan | null {
	if (card.kind === 'event') {
		const scan = eventScans[card.event];
		return scan ? { card: scan } : null;
	}
	if (card.kind === 'epidemic') {
		const scan = legacyScans['03-07'];
		return scan ? { card: scan } : null;
	}
	if (card.kind === 'produce') {
		const n = Math.min(3, Math.max(1, card.boxesLeft));
		const scan = produceScans[n];
		return scan ? { card: scan } : null;
	}
	const sticker = card.improvement ? cityImprovementScans[card.improvement] : undefined;
	if (card.search.length > 0) {
		const states = searchCityScans[card.city];
		if (states?.length) {
			const land = card.search.some(box => box.scope === 'land' && box.scratched);
			const sea = card.search.some(box => box.scope === 'sea' && box.scratched);
			const scan = states[(land ? 1 : 0) | (sea ? 2 : 0)] ?? states[0];
			if (scan) return { card: scan, sticker };
		}
	}
	if (card.companion) {
		const city = companionCity[card.companion];
		const scan = city ? searchCityScans[city]?.[1] : undefined;
		if (scan) return { card: scan, sticker };
	}
	if (sticker) {
		const scan = cityScans[card.city];
		if (scan) return { card: scan, sticker };
	}
	return null;
}

/** True while the user holds the `O` debug hotkey to swap all generated cards with their printed original scans. */
export const originals = $state({ held: false });
