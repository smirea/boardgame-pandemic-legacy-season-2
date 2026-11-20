import { pack } from '@repo/game';
import type { BriefingSource, EventId, ObjectiveId, Seal } from '@repo/game';
import type { Attachment } from 'svelte/attachments';
import { doorScans, eventScans, legacyScans, packageScans } from './scans.generated.ts';
import type { Scan } from './scans.generated.ts';

export type { Scan };

/** Served by the Bun server from `docs/assets`. */
export const scanUrl = (src: string) => `/api/scans/${src}`;

/** The printed Legacy card, with its back when the back says when to read it. */
export function legacyScan(code: string): Scan[] {
	const scan = legacyScans[code];
	if (!scan) return [];
	const kind = pack.legacyDeck.find(card => card.id === code)?.kind;
	return kind === 'stop' || kind === 'pause' ? [scan, { title: `${code}, back`, src: scan.back! }] : [scan];
}

export const sealScans = (seal: Seal): Scan[] =>
	(seal.t === 'package' ? packageScans[seal.id] : doorScans[seal.id]) ?? [];

/** The Legacy card that put an objective in play. */
export function objectiveScan(id: ObjectiveId): Scan[] {
	if (id === 'prologueCenters') return legacyScan('00-02');
	const card = pack.legacyDeck.find(entry =>
		entry.unlocks.some(unlock => unlock.t === 'objectives' && unlock.add?.includes(id)),
	);
	return card ? legacyScan(card.id) : [];
}

/** What a briefing card came out of, as printed. */
export function sourceScans(from: BriefingSource): Scan[] {
	if (from.t === 'seal') return sealScans(from.seal);
	if (from.t === 'turningPoint') return legacyScan('02-06');
	return from.card ? legacyScan(from.card) : [];
}

export const eventScan = (id: EventId): Scan[] => (eventScans[id] ? [eventScans[id]] : []);

type Peek = { scans: Scan[]; anchor: DOMRect; label: string };

/** What the pointer rests on, shown at the side by `ScanPeek.svelte`. */
export const peek = $state<{ current: Peek | null }>({ current: null });

/**
 * Shows the original printed component beside the element while the pointer or focus rests on it. `scans` is read
 * when the pointer arrives, so it follows the state.
 */
export function scan(scans: () => Scan[], label = ''): Attachment<HTMLElement> {
	return element => {
		const show = () => {
			const list = scans();
			if (list.length) peek.current = { scans: list, anchor: element.getBoundingClientRect(), label };
		};
		const hide = () => {
			if (peek.current?.anchor && peek.current.label === label) peek.current = null;
		};
		element.addEventListener('pointerenter', show);
		element.addEventListener('pointerleave', hide);
		element.addEventListener('focusin', show);
		element.addEventListener('focusout', hide);
		return () => {
			element.removeEventListener('pointerenter', show);
			element.removeEventListener('pointerleave', hide);
			element.removeEventListener('focusin', show);
			element.removeEventListener('focusout', hide);
			hide();
		};
	};
}
