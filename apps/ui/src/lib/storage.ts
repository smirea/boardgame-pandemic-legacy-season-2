import { LocalStorage } from './createLocalStorage';
import { debugIdFromSearch } from './debugId';
import type { ImportRow } from '@repo/tts';
import type { Mode } from './session/session.svelte.ts';

export const DEBUG_ID = typeof location === 'undefined' ? null : debugIdFromSearch(location.search);
const namespace = `legacy${DEBUG_ID ? `-DEBUG_ID=${DEBUG_ID}` : ''}`;

export const LS = new LocalStorage<{
	playerId: string | null;
	name: string;
	passphrase: string;
	/** The mode to resume after a reload, cleared when the player leaves. */
	mode: Mode | null;
	/** The host's campaign save: plain `{ phase, world }` JSON. */
	save: unknown;
	debugSnapshot: unknown;
	/** The host's recording of the game in progress, played back at `/replay`. */
	record: unknown;
	replay: { speed: number; panel: boolean; bubbles: boolean };
	/** What the last Tabletop Simulator import settled, shown at `/import`. */
	tableImport: { name: string; date: string; at: number; rows: ImportRow[] } | null;
}>({
	namespace,
	getDefaults: () => ({
		playerId: null,
		name: '',
		passphrase: '',
		mode: null,
		save: null,
		debugSnapshot: null,
		record: null,
		replay: { speed: 1, panel: true, bubbles: true },
		tableImport: null,
	}),
});
