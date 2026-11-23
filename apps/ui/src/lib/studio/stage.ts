import type { Command, PublicState, Save } from '@repo/game';
import type { sceneOf, StudioScene } from './scene.ts';
import type { Shot, ShotFile } from './shots.ts';

/**
 * What the stage page (`/debug/studio/stage`, the real game on one client) offers the studio page that frames it,
 * as `window.STAGE`. The studio's own `window.STUDIO` passes most of it on.
 */
export type StageApi = {
	/** Resolves once the game is on screen and at rest. */
	ready: () => Promise<void>;
	/**
	 * Takes every passing transition and animation to its end and waits for the board to stop, so the screen shows
	 * where the last command leaves it. A capture does this first. False when the screen was still moving after 4 seconds.
	 */
	settle: () => Promise<boolean>;
	/** The screen as it stands, with the pointer where it is pinned or else where it rests. */
	scene: () => StudioScene;
	/**
	 * Replaces the game with a scene's and puts its screen back. Returns what could not be put back. The page that
	 * frames the stage sets its size first: use `STUDIO.load`.
	 */
	load: (scene: StudioScene) => Promise<string[]>;
	/** The scene with a picture of it. */
	capture: () => Promise<{ scene: StudioScene; image: Blob }>;
	state: () => PublicState;
	/** Sends a command as a click would. Returns why the rules refuse it, or null once it is sent. */
	send: (command: Command) => string | null;
	/** Plays up to `steps` random legal commands, stopping early when the game ends. Returns the commands sent. */
	bot: (steps?: number) => Command[];
	/** Holds a pointer at a point of the page, shown whenever the real one is off the stage. Null lets go. */
	pin: (point: { x: number; y: number } | null) => void;
	pinned: () => { x: number; y: number } | null;
	/** Where the real pointer rests on the stage, or null while it is elsewhere. */
	pointer: () => { x: number; y: number } | null;
	/** The game states passed through since the page opened, oldest first, and which one is on screen. */
	history: () => { saves: Save[]; at: number };
	/** Goes to a state in the history, with the screen at rest. */
	rewind: (at: number) => Promise<void>;
};

/**
 * Sent on the stage's window with every change to the game state or the pin, so the studio redraws its controls.
 * An event rather than a callback on `STAGE`: a hot reload swaps the stage's page for a new one in the same window.
 */
export const STAGE_CHANGED = 'studio:change';

/**
 * The studio page's handle (`/debug/studio`, as `window.STUDIO`): everything its controls do, for an agent driving
 * the page. A scene is plain JSON, so one can be written by hand, loaded, played on from and captured.
 */
export type StudioApi = Pick<StageApi, 'scene' | 'state' | 'send' | 'bot' | 'pin' | 'history' | 'rewind' | 'settle'> & {
	/** Resolves once the stage's game is on screen and at rest. */
	ready: () => Promise<void>;
	/** Sizes the stage to the scene's viewport, loads it and waits for it to rest. Returns what could not be put back. */
	load: (scene: StudioScene) => Promise<string[]>;
	/** Captures the stage and keeps the shot in this browser's database, newest first in the carousel. */
	capture: (name?: string) => Promise<Shot>;
	shots: () => Shot[];
	remove: (ids: string[]) => Promise<void>;
	/** The shots as one JSON file's content, pictures included: all of them, or the ones named. */
	export: (ids?: string[]) => Promise<ShotFile>;
	/** Adds the shots of an exported file. A shot already here, by id, is replaced. */
	import: (file: unknown) => Promise<Shot[]>;
	setViewport: (width: number, height: number) => Promise<void>;
	/** Builds a scene from a save, with the screen at rest unless told otherwise. */
	sceneOf: typeof sceneOf;
	/** The saves the game's menu can load: `canonical()`. */
	scenarios: Record<string, () => Save>;
};

declare global {
	interface Window {
		STUDIO?: StudioApi;
		STAGE?: StageApi;
	}
}
