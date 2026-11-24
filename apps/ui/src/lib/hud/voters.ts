import { SEAT_IDS, tablePlayers } from '@repo/game';
import type { PlayerId, Table } from '@repo/game';
import { seatColor } from './labels.svelte.ts';

export type Voter = { player: PlayerId; name: string; color: string; voted: boolean };

/** Everyone at the table in seat order, each in the colour of the first seat they took, and whether they agreed. */
export function tableVoters(table: Table, voted: (player: PlayerId) => boolean): Voter[] {
	return tablePlayers(table).map(player => {
		const seat = table.seats.find(entry => entry.player === player)!;
		return { player, name: seat.name, color: seatColor(seat.seat), voted: voted(player) };
	});
}

/** The names of those still to agree, with this browser's player as "you". */
export const waitingOn = (voters: Voter[], player: PlayerId) =>
	voters.filter(voter => !voter.voted).map(voter => (voter.player === player ? 'you' : voter.name));
