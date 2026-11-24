import { characterCardIndex, pack } from '@repo/game';
import type { CityId, CompanionId, ExposureBox, InfectionCard, PlayerCard, Seal } from '@repo/game';
import {
	characterCardScans,
	cityImprovementScans,
	cityScans,
	doorScans,
	eventScans,
	hollowScans,
	infectionCityScans,
	infectionImprovementScans,
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

const companionCity: Partial<Record<CompanionId, CityId>> = {};
for (const [city, boxes] of Object.entries(pack.searches)) {
	for (const box of boxes) {
		if (box.result.t === 'companion') companionCity[box.result.companion] = city as CityId;
	}
}

export type CardScan = { card: Scan; sticker?: Scan };

/** Printed scan for any player card (cities, events, epidemics, produce supplies, searches, companions, improvements). */
export function playerCardScan(card: PlayerCard): CardScan | null {
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
	const scan = cityScans[card.city];
	return scan ? { card: scan, sticker } : null;
}

/** Printed scan for any infection card (city cards with optional improvement sticker, or Hollow Men cards). */
export function infectionCardScan(card: InfectionCard): CardScan | null {
	if (card.kind !== 'city') {
		const scan = hollowScans[card.kind];
		return scan ? { card: scan } : null;
	}
	const scan = infectionCityScans[card.city];
	if (!scan) return null;
	const sticker = card.improvement ? infectionImprovementScans[card.improvement] : undefined;
	return { card: scan, sticker };
}

/** Printed scan for a Character card at the given number of scratched exposure boxes (`0..7`). */
export function characterCardScan(exposureTrack: readonly ExposureBox[], exposure: number): Scan | null {
	const idx = characterCardIndex(exposureTrack);
	const entry = idx >= 0 ? characterCardScans[idx] : undefined;
	if (!entry) return null;
	const clamped = Math.max(0, Math.min(entry.states.length, exposure));
	return clamped === 0 ? entry.blank : entry.states[clamped - 1]!;
}

/** True while the user holds the `O` debug hotkey to swap all generated cards with their printed original scans. */
export const originals = $state({ held: false });
