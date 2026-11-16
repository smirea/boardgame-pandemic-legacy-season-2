import type { SeatId } from '@repo/game';

export type Place = 'tl' | 'tr' | 'bl' | 'br';

// Going round the table clockwise from the bottom right: along the bottom, up the left, along the top.
const CLOCKWISE: Place[] = ['br', 'bl', 'tl', 'tr'];

/** Seats each player in a corner, in turn order clockwise, with `anchor` at the bottom right. */
export function placeSeats(seats: SeatId[], anchor: SeatId | undefined): Map<Place, SeatId> {
	const start = Math.max(0, anchor ? seats.indexOf(anchor) : 0);
	return new Map(
		seats.slice(0, CLOCKWISE.length).map((_, index) => [CLOCKWISE[index]!, seats[(start + index) % seats.length]!]),
	);
}
