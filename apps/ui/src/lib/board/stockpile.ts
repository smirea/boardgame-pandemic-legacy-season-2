import type { CityId } from '@repo/game';
import type { BoardPoint } from './projection';

/**
 * Where the stockpile stands: open South Atlantic, south-east of São Paulo. The pile and its title fit in a box
 * 10 wide, from 3.5 north of the spot to 6 south, and all of it is sea in a region revealed from the first game,
 * 3.7 clear of the course of every line the campaign may ever draw and 17 from any city, so nothing is ever built
 * over it and the fog never hides it.
 */
export const STOCKPILE: BoardPoint = { x: -18, z: 29 };
/** How far the pile and its title reach from the spot, for the fitted view to keep them in frame. */
export const STOCKPILE_REACH = { x: 5, north: 3.5, south: 6 };
/** Where the title is printed, below the pile. */
export const STOCKPILE_TITLE_Z = 4.3;

export const CUBE = 0.7;
const SLOT = 0.86;

/** A cube's place in the pile, relative to the spot: centre height `y` above the board, and a small turn. */
export type PileSlot = { x: number; y: number; z: number; turn: number };

// A stepped pyramid, each layer sitting on the gaps of the one below. Cubes fill in order of distance from the
// middle, weighted by height so a cube only lands on cubes already there: the pile grows as a mound and shrinks
// from its top and edges.
export const PILE: PileSlot[] = (() => {
	const slots: (PileSlot & { key: number })[] = [];
	for (let layer = 0, columns = 6, rows = 5; columns > 0 && rows > 0; layer++, columns--, rows--) {
		for (let column = 0; column < columns; column++)
			for (let row = 0; row < rows; row++) {
				const x = (column - (columns - 1) / 2) * SLOT;
				const z = (row - (rows - 1) / 2) * SLOT;
				const seed = Math.sin((layer + 1) * 12.9898 + column * 78.233 + row * 37.719) * 43758.5453;
				const jitter = seed - Math.floor(seed);
				slots.push({
					x: x + (jitter - 0.5) * 0.08,
					y: CUBE / 2 + layer * CUBE,
					z: z + (jitter - 0.5) * 0.06,
					turn: (jitter - 0.5) * 0.5,
					key: Math.hypot(x, z * 1.1) + layer * 0.9,
				});
			}
	}
	return slots
		.sort((a, b) => a.key - b.key)
		.map(({ x, y, z, turn }) => ({ x, y, z, turn }));
})();

/** What holds supply cubes on the board. */
export type Holder = { kind: 'pile' } | { kind: 'city'; city: CityId } | { kind: 'pawn'; pawn: string; city: CityId };

export type SupplySnapshot = {
	stockpile: number;
	cities: Partial<Record<CityId, number>>;
	pawns: { id: string; city: CityId; carried: number }[];
};

/**
 * The cubes that moved between two moments, each from where it left to where it arrived. What left is paired with
 * what arrived in order, the stockpile first. A cube that left for nowhere on the board, such as one returned to the
 * reserve, flies nowhere, and one that arrived from nowhere just appears.
 */
export function supplyMoves(before: SupplySnapshot, after: SupplySnapshot): { from: Holder; to: Holder }[] {
	const left: Holder[] = [];
	const arrived: Holder[] = [];
	const tally = (holder: Holder, delta: number) => {
		for (let step = 0; step < Math.abs(delta); step++) (delta < 0 ? left : arrived).push(holder);
	};
	tally({ kind: 'pile' }, after.stockpile - before.stockpile);
	const cities = new Set([...Object.keys(before.cities), ...Object.keys(after.cities)] as CityId[]);
	for (const city of cities) tally({ kind: 'city', city }, (after.cities[city] ?? 0) - (before.cities[city] ?? 0));
	for (const pawn of after.pawns) {
		const was = before.pawns.find(entry => entry.id === pawn.id);
		if (was) tally({ kind: 'pawn', pawn: pawn.id, city: pawn.city }, pawn.carried - was.carried);
	}
	return left.slice(0, arrived.length).map((from, index) => ({ from, to: arrived[index]! }));
}
