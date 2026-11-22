import { fillSave } from '@repo/game';
import type { Command, GameRecord, PublicState } from '@repo/game';
import type { ConnectionStatus } from '@repo/net';
import { LS } from '../storage';
import type { GameSession, Mode } from './session.svelte.ts';

/** Saves fill the browser's storage quickly, so only this many checkpoints are kept. */
const CHECKPOINTS = 12;

export type DebugApi = {
	getState: () => PublicState | null;
	saveState: () => void;
	loadState: (state?: unknown) => void;
	setState: (state: unknown) => void;
	/** Keeps the campaign as it stands under `name`, to return to with `restore`. Only the newest few are kept. */
	checkpoint: (name: string) => string[];
	restore: (name: string) => void;
	/**
	 * Restores a checkpoint written by an older build, filling whatever it lacks with fresh values. For playtests
	 * that outlive a change to the state. The page drops an older save as it loads, so name a checkpoint.
	 */
	upgrade: (name?: string) => void;
	checkpoints: () => string[];
	/** Sends a command the way a click would. Returns why this client would refuse it, or null once it is sent. */
	send: (command: Command) => string | null;
	connection: () => {
		mode: Mode;
		status: ConnectionStatus;
		peers: number;
		notice: string | null;
		fatal: string | null;
	};
	/** What is drawn on the map and pointed at, as this browser holds it: strokes and their points by player, and pings. */
	sketch: () => { strokes: Record<string, number>; points: number; pings: number };
	getRecord: () => GameRecord | null;
	/** The recording as the Menu saves it: the host's own, which a peer asks the host for. */
	fetchRecord: () => Promise<string | null>;
	/** Renames this player at the table, as the lobby's name field does. */
	setName: (name: string) => void;
};

declare global {
	interface Window {
		DEBUG?: DebugApi;
	}
}

/** Console helpers for reproducing a live state, per the game framework convention. */
export function createDebugApi(session: GameSession): DebugApi {
	const checkpoints = () => LS.get('checkpoints') ?? [];
	return {
		getState: () => session.state,
		saveState: () => LS.set({ debugSnapshot: session.save() }),
		loadState: state => session.importSave(state ?? LS.get('debugSnapshot')),
		setState: state => session.importSave(state),
		checkpoint: name => {
			const kept = [...checkpoints().filter(entry => entry.name !== name), { name, save: session.save() }].slice(
				-CHECKPOINTS,
			);
			LS.set({ checkpoints: kept });
			return kept.map(entry => entry.name);
		},
		restore: name => {
			const found = checkpoints().find(entry => entry.name === name);
			if (!found) throw new Error(`No checkpoint named ${name}`);
			session.importSave(found.save);
		},
		upgrade: name => {
			const found = name ? checkpoints().find(entry => entry.name === name)?.save : LS.get('save');
			if (!found) throw new Error(name ? `No checkpoint named ${name}` : 'No save to upgrade');
			session.importSave(fillSave(found));
		},
		checkpoints: () => checkpoints().map(entry => entry.name),
		send: command => {
			const reason = session.explain(command);
			if (!reason) session.send(command);
			return reason;
		},
		connection: () => ({
			mode: session.mode,
			status: session.status,
			peers: session.peers.filter(peer => peer.connected).length,
			notice: session.notice?.text ?? null,
			fatal: session.fatal,
		}),
		sketch: () => ({
			strokes: Object.fromEntries(
				Object.entries(session.drawings).map(([player, strokes]) => [player, strokes.length]),
			),
			points: Object.values(session.drawings)
				.flat()
				.reduce((total, stroke) => total + stroke.points.length, 0),
			pings: session.pings.length,
		}),
		getRecord: () => session.record,
		fetchRecord: () => session.exportRecord(),
		setName: name => session.rename(name),
	};
}
