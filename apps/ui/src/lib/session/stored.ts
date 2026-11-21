import { gameIndexOf, parseRecord, parseSave } from '@repo/game';
import type { GameRecord, Save } from '@repo/game';
import { createPeerId, peerId } from '@repo/net';
import { LS } from '../storage';

/** The id this browser keeps across reloads, which is who it is at the table. */
export function storedId() {
	const existing = LS.get('playerId');
	if (existing) return peerId(existing);
	const created = createPeerId();
	LS.set({ playerId: created });
	return created;
}

// A save from an older build is dropped for a new campaign: the game keeps no backwards compatibility.
export function storedSave(): Save | null {
	const raw = LS.get('save');
	if (!raw) return null;
	try {
		return parseSave(raw);
	} catch (error) {
		console.warn('Starting a new campaign:', error);
		LS.delete('save');
		LS.delete('record');
		return null;
	}
}

/** The recording kept from an earlier page load, if it is of the game the save is in. */
export function storedRecord(save: Save | null): GameRecord | null {
	const raw = LS.get('record');
	if (!raw || !save) return null;
	try {
		const record = parseRecord(raw);
		return gameIndexOf(record.initial) === save.world.campaign.results.length ? record : null;
	} catch {
		return null;
	}
}

export const storedName = () => LS.get('name', '').trim() || 'Player';
