import type { CityId } from '@repo/game';
import type { BoardPoint } from './projection';

/** Where a city's printed name is centred, relative to the city, and whether a leader line ties it back: any name not straight above or below its city gets one. */
export type Placement = { x: number; z: number; leader: boolean };

type Rect = { x: number; z: number; halfWidth: number; halfHeight: number };

/** Cap height of a printed name, in board units. */
export const NAME_SIZE = 2.7;
/** The disc's reach, which a leader line starts from. */
export const DISC_REACH = 2.2;

type Slot = { offset: (width: number) => { x: number; z: number }; cost: number; leader?: boolean };

// The pieces around a city have fixed places (cubes east, plague west, buildings on the corners, Hollow Men
// south), so a name beside the city clears them. Names may still run under pieces, as on a printed board.
const SLOTS: Slot[] = [
	{ offset: () => ({ x: 0, z: 3.6 }), cost: 0 },
	{ offset: () => ({ x: 0, z: -4.2 }), cost: 0.6 },
	{ offset: width => ({ x: 1.2 + width / 2, z: 3.8 }), cost: 1, leader: true },
	{ offset: width => ({ x: -1.2 - width / 2, z: 3.8 }), cost: 1, leader: true },
	{ offset: width => ({ x: 1.2 + width / 2, z: -4.2 }), cost: 1.5, leader: true },
	{ offset: width => ({ x: -1.2 - width / 2, z: -4.2 }), cost: 1.5, leader: true },
	{ offset: width => ({ x: 4.4 + width / 2, z: 0.3 }), cost: 2, leader: true },
	{ offset: width => ({ x: -5.2 - width / 2, z: 0.3 }), cost: 2, leader: true },
	{ offset: () => ({ x: 0, z: 6.2 }), cost: 5, leader: true },
	{ offset: () => ({ x: 0, z: -6.8 }), cost: 5, leader: true },
];

function overlap(a: Rect, b: Rect): number {
	const width = Math.min(a.x + a.halfWidth, b.x + b.halfWidth) - Math.max(a.x - a.halfWidth, b.x - b.halfWidth);
	const height = Math.min(a.z + a.halfHeight, b.z + b.halfHeight) - Math.max(a.z - a.halfHeight, b.z - b.halfHeight);
	return width > 0 && height > 0 ? width * height : 0;
}

/** How far a point lies from a rectangle's nearest edge. */
function reach(rect: Rect, point: BoardPoint) {
	const dx = Math.max(0, Math.abs(point.x - rect.x) - rect.halfWidth);
	const dz = Math.max(0, Math.abs(point.z - rect.z) - rect.halfHeight);
	return Math.hypot(dx, dz);
}

/**
 * Places every printed name so that it covers neither another name nor another city's disc, and so that no
 * name sits nearer some other city than its own. A name that has to stand off gets a leader line. Crowded
 * cities choose first, then a few passes let early choices give way to later ones.
 */
export function layoutLabels(cities: { id: CityId; width: number; at: BoardPoint }[]): Map<CityId, Placement> {
	const crowding = (city: (typeof cities)[number]) =>
		cities.filter(other => Math.hypot(other.at.x - city.at.x, other.at.z - city.at.z) < 16).length;
	const order = cities.toSorted((a, b) => crowding(b) - crowding(a) || a.id.localeCompare(b.id));
	const rectOf = (city: (typeof cities)[number], slot: Slot): Rect => {
		const offset = slot.offset(city.width);
		return {
			x: city.at.x + offset.x,
			z: city.at.z + offset.z,
			halfWidth: city.width / 2,
			halfHeight: NAME_SIZE * 0.55,
		};
	};
	const chosen = new Map<CityId, { slot: Slot; rect: Rect }>();
	const cost = (city: (typeof cities)[number], slot: Slot, rect: Rect) => {
		let total = slot.cost;
		for (const [id, other] of chosen) if (id !== city.id) total += overlap(rect, other.rect) * 5;
		const own = reach(rect, city.at);
		for (const other of cities) {
			if (other.id === city.id) continue;
			const disc = { x: other.at.x, z: other.at.z, halfWidth: DISC_REACH, halfHeight: DISC_REACH };
			total += overlap(rect, disc) * 4;
			// A name nearer another city than its own reads as that city's.
			const theirs = reach(rect, other.at);
			if (theirs < own + 2) total += (own + 2 - theirs) * 6;
		}
		return total;
	};
	for (let pass = 0; pass < 4; pass++) {
		for (const city of order) {
			let best: { slot: Slot; rect: Rect; cost: number } | null = null;
			for (const slot of SLOTS) {
				const rect = rectOf(city, slot);
				const value = cost(city, slot, rect);
				if (!best || value < best.cost - 1e-6) best = { slot, rect, cost: value };
			}
			chosen.set(city.id, best!);
		}
	}
	return new Map(
		cities.map(city => {
			const { slot, rect } = chosen.get(city.id)!;
			return [city.id, { x: rect.x - city.at.x, z: rect.z - city.at.z, leader: slot.leader ?? false }];
		}),
	);
}
