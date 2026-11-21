import type { EventId, Seal } from '@repo/game';
import { doorScans, eventScans, packageScans } from './scans.generated.ts';
import type { Scan } from './scans.generated.ts';

export type { Scan };

/** Served by the Bun server from `docs/assets`. */
export const scanUrl = (src: string) => `/api/scans/${src}`;

export const sealScans = (seal: Seal): Scan[] =>
	(seal.t === 'package' ? packageScans[seal.id] : doorScans[seal.id]) ?? [];

export const eventScan = (id: EventId): Scan[] => (eventScans[id] ? [eventScans[id]] : []);

/** True while the user holds the `O` debug hotkey to swap all generated cards with their printed original scans. */
export const originals = $state({ held: false });
