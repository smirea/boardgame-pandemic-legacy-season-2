import type { CityId } from '@repo/game';
import type { BoardPoint } from './projection';

/** Where a city's printed name sits: under it by default, above it, or a step further out either way. */
export type Anchor = 's' | 'n' | 'ss' | 'nn';

type Rect = { x: number; z: number; halfWidth: number; halfHeight: number };

/** Cap height of a printed name, in board units. */
export const NAME_SIZE = 2.4;
// The far positions come last: a name pushed a step further out still beats one printed over another.
const ORDER: Anchor[] = ['s', 'n', 'ss', 'nn'];
const OFFSET: Record<Anchor, number> = { s: 3.7, n: -4.4, ss: 5.9, nn: -6.6 };
const MARKER = 2.2;

/** How far the name's centre sits south of the city, in board units. */
export const anchorOffset = (anchor: Anchor) => OFFSET[anchor];

function overlap(a: Rect, b: Rect): number {
	const width = Math.min(a.x + a.halfWidth, b.x + b.halfWidth) - Math.max(a.x - a.halfWidth, b.x - b.halfWidth);
	const height = Math.min(a.z + a.halfHeight, b.z + b.halfHeight) - Math.max(a.z - a.halfHeight, b.z - b.halfHeight);
	return width > 0 && height > 0 ? width * height : 0;
}

/**
 * Picks a side for every printed name so that names cover neither each other nor another city's disc.
 * Pieces may stand on a name, the way they would on a printed board. Crowded cities choose first.
 */
export function layoutLabels(cities: { id: CityId; width: number; at: BoardPoint }[]): Map<CityId, Anchor> {
	const discs = cities.map(city => ({
		id: city.id,
		x: city.at.x,
		z: city.at.z,
		halfWidth: MARKER,
		halfHeight: MARKER,
	}));
	const crowding = (city: (typeof cities)[number]) =>
		cities.filter(other => Math.hypot(other.at.x - city.at.x, other.at.z - city.at.z) < 16).length;
	const placed: Rect[] = [];
	const result = new Map<CityId, Anchor>();
	for (const city of cities.toSorted((a, b) => crowding(b) - crowding(a) || a.id.localeCompare(b.id))) {
		let best: { anchor: Anchor; rect: Rect; cost: number } | null = null;
		for (const anchor of ORDER) {
			const rect: Rect = {
				x: city.at.x,
				z: city.at.z + OFFSET[anchor],
				halfWidth: city.width / 2,
				halfHeight: NAME_SIZE / 2,
			};
			const cost =
				placed.reduce((sum, other) => sum + overlap(rect, other), 0) +
				discs.reduce((sum, disc) => sum + (disc.id === city.id ? 0 : overlap(rect, disc) * 1.5), 0);
			if (!best || cost < best.cost - 1e-6) best = { anchor, rect, cost };
			if (cost === 0) break;
		}
		placed.push(best!.rect);
		result.set(city.id, best!.anchor);
	}
	return result;
}
