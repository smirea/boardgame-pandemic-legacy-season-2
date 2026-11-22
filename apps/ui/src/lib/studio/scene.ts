import { parseSave } from '@repo/game';
import type { Action, CardId, CityId, Save, SeatId } from '@repo/game';

/**
 * One click on the way to a half-chosen action, in the order it was made. The half-chosen action itself (lit cities,
 * the chooser's rows) is closures over the rules, so a scene keeps the clicks and the game screen makes them again.
 */
export type UiStep =
	/** One kind of action started from the Actions panel, from the ring round the city clicked before, or from a hand card's tag. */
	| { t: 'start'; a: Action['a']; via: 'panel' | 'ring' | { card: CardId } }
	| { t: 'city'; city: CityId }
	| { t: 'pawn'; seat: SeatId }
	/** A row of the open chooser, by its place in the unfiltered list. In a chooser that takes several, it ticks or unticks the row. */
	| { t: 'option'; index: number }
	| { t: 'recon'; route: string }
	| { t: 'play'; seat: SeatId; card: CardId }
	| { t: 'lockdown'; card: CardId }
	| { t: 'closeChooser' };

/** Where the board's camera stands and what it looks at, in board units. */
export type CameraPose = { position: [number, number, number]; target: [number, number, number] };

export type Announcement = { text: string; tone: string };

/** Everything the game screen shows that the game state does not decide: what `Game.svelte`'s `ui()` writes down. */
export type GameUi = {
	/** The camera after a drag or zoom, or null for the fitted view. */
	camera: CameraPose | null;
	/** The seat whose hand the dock shows, or null to follow the turn. */
	viewing: SeatId | null;
	menu: boolean;
	box: boolean;
	deck: boolean;
	hotkeys?: boolean;
	scanner?: boolean;
	/** The clicks that led to the half-chosen action on screen. */
	steps: UiStep[];
	/** What is typed in the chooser's filter. */
	filter: string;
	toasts: Announcement[];
	banner: { title: string; text: string } | null;
	/** The log line of the search whose result is up. */
	search?: number | null;
	/** State kept by the panels inside the screen, by the name each registers under `keep` (`hud/viewState.ts`). */
	parts: Record<string, unknown>;
};

/** The game screen's own state, with what the page round it holds: scrolled lists and the pointer. */
export type SceneUi = GameUi & {
	/** Scrolled elements, by their path of child indexes from the page's body. */
	scroll: { path: number[]; top: number; left: number }[];
	/** Where the pointer rests, in pixels from the page's top left. What it hovers follows from it. */
	pointer: { x: number; y: number } | null;
};

/** A screen of the game: enough to draw it again exactly, and to play on from it. */
export type StudioScene = {
	v: 1;
	/** The size of the screen the game is drawn on, in CSS pixels. */
	viewport: { width: number; height: number };
	/** The id this browser sits at the table as, so the lobby and the character screen read the same. */
	player: string;
	save: Save;
	ui: SceneUi;
};

export const VIEWPORTS = [
	{ name: 'MacBook Air 13"', width: 1280, height: 720 },
	{ name: 'MacBook Air 13" tall', width: 1440, height: 810 },
	{ name: 'MacBook Pro 14"', width: 1512, height: 870 },
	{ name: 'MacBook Pro 16"', width: 1728, height: 1000 },
	{ name: 'Full HD', width: 1920, height: 1080 },
] as const;

export const restingUi = (): SceneUi => ({
	camera: null,
	viewing: null,
	menu: false,
	box: false,
	deck: false,
	hotkeys: false,
	scanner: false,
	steps: [],
	filter: '',
	toasts: [],
	banner: null,
	parts: {},
	scroll: [],
	pointer: null,
});

/** A scene from a save, with the screen at rest unless `ui` says otherwise. */
export function sceneOf(
	save: Save,
	options: { ui?: Partial<SceneUi>; viewport?: StudioScene['viewport']; player?: string } = {},
): StudioScene {
	return {
		v: 1,
		viewport: options.viewport ?? { width: VIEWPORTS[1].width, height: VIEWPORTS[1].height },
		player: options.player ?? 'studio',
		save,
		ui: { ...restingUi(), ...options.ui },
	};
}

/** Checks a scene read from a file or typed by hand. A partial `ui` is filled in with the screen at rest. */
export function parseScene(raw: unknown): StudioScene {
	const value = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
	if (!value || typeof value !== 'object') throw new Error('A scene is an object');
	const scene = value as Partial<StudioScene>;
	if (scene.v !== 1) throw new Error(`Scene version ${String(scene.v)} is not one this build reads`);
	const { viewport, player, ui } = scene;
	if (!viewport || !(viewport.width > 0) || !(viewport.height > 0)) throw new Error('A scene needs a viewport size');
	if (typeof player !== 'string' || !player) throw new Error('A scene names the player id it was taken as');
	if (ui !== undefined && (ui === null || typeof ui !== 'object')) throw new Error("A scene's ui is an object");
	return {
		v: 1,
		viewport: { width: viewport.width, height: viewport.height },
		player,
		save: parseSave(scene.save),
		ui: { ...restingUi(), ...ui },
	};
}
