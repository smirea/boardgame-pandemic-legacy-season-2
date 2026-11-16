import type { CityId } from '@repo/game';
import type { BoardPoint } from './projection';

export type Anchor = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'nn' | 'ss';

export type Rect = { x: number; z: number; halfWidth: number; halfHeight: number };

const HEIGHT_PX = 20;
const MARKER_UNITS = 2.3;
// The far positions come last: a label pushed a step further out still beats one sitting on another.
const ORDER: Anchor[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw', 'nn', 'ss'];

/** Where the label's centre sits relative to the city, in pixels, for a label `width` pixels wide. */
export function anchorOffset(anchor: Anchor, width: number): { x: number; y: number } {
	const side = width / 2 + 14;
	const corner = width / 2 + 4;
	switch (anchor) {
		case 'n':
			return { x: 0, y: -27 };
		case 's':
			return { x: 0, y: 27 };
		case 'e':
			return { x: side, y: 0 };
		case 'w':
			return { x: -side, y: 0 };
		case 'ne':
			return { x: corner, y: -22 };
		case 'nw':
			return { x: -corner, y: -22 };
		case 'se':
			return { x: corner, y: 22 };
		case 'sw':
			return { x: -corner, y: 22 };
		case 'nn':
			return { x: 0, y: -47 };
		case 'ss':
			return { x: 0, y: 47 };
	}
}

/** A label holds the name plus up to three small badges. Sizing for that keeps the layout from shifting as cubes come and go. */
export const labelWidth = (name: string) => name.length * 6.4 + 64;

function overlap(a: Rect, b: Rect): number {
	const width = Math.min(a.x + a.halfWidth, b.x + b.halfWidth) - Math.max(a.x - a.halfWidth, b.x - b.halfWidth);
	const height = Math.min(a.z + a.halfHeight, b.z + b.halfHeight) - Math.max(a.z - a.halfHeight, b.z - b.halfHeight);
	return width > 0 && height > 0 ? width * height : 0;
}

/**
 * Picks a side for every label so that labels cover neither each other nor a city. Crowded cities
 * choose first. `unitsPerPixel` converts label pixels to board units at the current zoom.
 */
export function layoutLabels(
	cities: { id: CityId; name: string; at: BoardPoint }[],
	unitsPerPixel: number,
	blocked: Rect[] = [],
): Map<CityId, Anchor> {
	const markers: (Rect & { id: CityId })[] = cities.map(city => ({
		id: city.id,
		x: city.at.x,
		z: city.at.z,
		halfWidth: MARKER_UNITS,
		halfHeight: MARKER_UNITS,
	}));
	const crowding = (city: (typeof cities)[number]) =>
		cities.filter(other => Math.hypot(other.at.x - city.at.x, other.at.z - city.at.z) < 16).length;
	// A label under a panel is unreadable, while two labels touching are merely tight, so panels weigh more.
	const panels = blocked.map(rect => ({
		...rect,
		halfWidth: rect.halfWidth + 4 * unitsPerPixel,
		halfHeight: rect.halfHeight + 4 * unitsPerPixel,
	}));
	const placed: Rect[] = [];
	const result = new Map<CityId, Anchor>();
	for (const city of cities.toSorted((a, b) => crowding(b) - crowding(a) || a.id.localeCompare(b.id))) {
		const width = labelWidth(city.name);
		let best: { anchor: Anchor; rect: Rect; cost: number } | null = null;
		for (const anchor of ORDER) {
			const offset = anchorOffset(anchor, width);
			const rect: Rect = {
				x: city.at.x + offset.x * unitsPerPixel,
				z: city.at.z + offset.y * unitsPerPixel,
				halfWidth: (width / 2) * unitsPerPixel,
				halfHeight: (HEIGHT_PX / 2) * unitsPerPixel,
			};
			const cost =
				placed.reduce((sum, other) => sum + overlap(rect, other), 0) +
				panels.reduce((sum, panel) => sum + overlap(rect, panel) * 3, 0) +
				markers.reduce((sum, marker) => sum + (marker.id === city.id ? 0 : overlap(rect, marker) * 1.5), 0);
			if (!best || cost < best.cost - 1e-6) best = { anchor, rect, cost };
			if (cost === 0) break;
		}
		placed.push(best!.rect);
		result.set(city.id, best!.anchor);
	}
	return result;
}
