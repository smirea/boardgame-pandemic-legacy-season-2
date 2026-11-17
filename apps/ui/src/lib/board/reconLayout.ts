import type { BoardPoint } from './projection';

export type ReconRect = { x: number; z: number; width: number; depth: number };

/** Room left between a box and its own city, and around anything else printed on the board. */
const GAP = 4;
const MARGIN = 2.5;
const TURNS = [0, 20, -20, 40, -40, 60, -60, 90, -90, 120, -120, 150, -150, 180];
const REACHES = [GAP, GAP + 3, GAP + 7];

const overlaps = (a: ReconRect, b: ReconRect) =>
	Math.abs(a.x - b.x) * 2 < a.width + b.width && Math.abs(a.z - b.z) * 2 < a.depth + b.depth;

/**
 * Where each recon box is printed: beside its city, reaching toward what it reveals (north when it reveals nothing),
 * turned aside as little as it takes to keep clear of the cities and names already on the board and of each other.
 * `size` is a box's footprint in board units at the current zoom, since a box keeps one size on screen.
 */
export function placeReconBoxes(
	boxes: { route: string; from: BoardPoint; toward: BoardPoint | null }[],
	taken: BoardPoint[],
	size: { width: number; depth: number },
): Map<string, ReconRect> {
	const placed = new Map<string, ReconRect>();
	const clear = (rect: ReconRect) => {
		const padded = { ...rect, width: rect.width + MARGIN * 2, depth: rect.depth + MARGIN * 2 };
		return (
			taken.every(point => !overlaps(padded, { ...point, width: 0, depth: 0 })) &&
			[...placed.values()].every(other => !overlaps(padded, other))
		);
	};
	for (const box of boxes) {
		const dx = box.toward ? box.toward.x - box.from.x : 0;
		const dz = box.toward ? box.toward.z - box.from.z : -1;
		const heading = Math.atan2(dz, dx);
		const at = (turn: number, reach: number): ReconRect => {
			const angle = heading + (turn * Math.PI) / 180;
			const ux = Math.cos(angle);
			const uz = Math.sin(angle);
			// From the city's centre to the box's nearest edge along the heading, then on to the box's centre.
			const span = reach + (Math.abs(ux) * size.width) / 2 + (Math.abs(uz) * size.depth) / 2;
			return { x: box.from.x + ux * span, z: box.from.z + uz * span, ...size };
		};
		let choice: ReconRect | null = null;
		for (const turn of TURNS) {
			choice = REACHES.map(reach => at(turn, reach)).find(clear) ?? null;
			if (choice) break;
		}
		placed.set(box.route, choice ?? at(0, GAP));
	}
	return placed;
}
