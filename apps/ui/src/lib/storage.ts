import type { SeatId } from '@repo/game';
import { LocalStorage } from './createLocalStorage';
import { debugIdFromSearch } from './debugId';
import type { Mode } from './session/session.svelte.ts';

export const DEBUG_ID = typeof location === 'undefined' ? null : debugIdFromSearch(location.search);
const namespace = `legacy${DEBUG_ID ? `-DEBUG_ID=${DEBUG_ID}` : ''}`;

export const LS = new LocalStorage<{
	playerId: string | null;
	name: string;
	passphrase: string;
	/** The mode to resume after a reload, cleared when the player leaves. */
	mode: Mode | null;
	mySeats: SeatId[];
	/** The host's campaign save: plain `{ phase, world }` JSON. */
	save: unknown;
	debugSnapshot: unknown;
}>({
	namespace,
	getDefaults: () => ({
		playerId: null,
		name: '',
		passphrase: '',
		mode: null,
		mySeats: [],
		save: null,
		debugSnapshot: null,
	}),
});
