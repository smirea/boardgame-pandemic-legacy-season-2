import type { CityId, Color, EdgeDef, PlayerCardsAt, StructureKind } from '@repo/game';
import type { CursorTool } from '#lib/session/protocol.ts';
import type { BoardPoint } from './projection';

export type { CursorTool };

export type CityHighlight = 'target' | 'selected' | null;

/**
 * A panel lying over the board, in pixels from the stage's top left. The fitted view may slide the board a little
 * under the side panels on a narrow stage, but never under a firm one.
 */
export type Covered = { x: number; y: number; width: number; height: number; firm?: boolean };

export type CityView = {
	name: string;
	revealed: boolean;
	onGrid: boolean;
	supplies: number;
	plague: number;
	hollow: number;
	population: number;
	/** Marked with an anchor: only ports start or end sea movement. */
	port: boolean;
	/** A haven has no Infection card and no City card: only an outbreak next door reaches it. */
	haven: boolean;
	/** What stands here, with whether it is printed on the board for good or only lasts this game. */
	structures: { kind: StructureKind; permanent: boolean }[];
	infested: boolean;
	forsaken: boolean;
	lab: boolean;
	highlight: CityHighlight;
	/** The city's Infection cards and its chance of being hit in the next Infect step, while a game is played. */
	infection: { odds: number; inDeck: number; discarded: number } | null;
	/** Where the city's player cards are, while a game is played. */
	cards: PlayerCardsAt | null;
};

/** How a pawn made its last move, which decides the vehicle it travels in. */
export type Travel = 'land' | 'sea' | 'air';

export type PawnView = {
	id: string;
	city: CityId;
	color: string;
	name: string;
	active: boolean;
	/** Picked out on the board, as while the pointer rests on the player's seat. */
	lit: boolean;
	/** A click on it picks it, as for an action that moves another player's pawn. */
	pickable: boolean;
	/** Supply cubes the character carries. */
	carried: number;
	travel: Travel;
	/** The way the last move went over the board, city to city, when it kept to a road or the sea. */
	course: BoardPoint[] | null;
};

export type CursorView = { id: string; name: string; color: string; x: number; z: number; tool?: CursorTool };

export type DrawingView = { id: string; color: string; strokes: { id: string; points: BoardPoint[] }[] };

export type PingView = {
	id: string;
	x: number;
	z: number;
	color: string;
	name: string | null;
	createdAt: number;
	duration: number;
};

export type FxKind = 'infect' | 'plague' | 'outbreak' | 'epidemic' | 'connected' | 'build' | 'hollow';

export type Fx = { id: number; city: CityId; kind: FxKind; delay: number };

export type MarkTone = 'ink' | 'good' | 'bad' | 'warn' | 'hollow';

/** What a replay draws over the board to show one step: the paths taken, the cities involved, and what happened at each. */
export type BoardMarks = {
	trails: {
		id: string;
		from: CityId;
		to: CityId;
		color: string;
		travel: Travel;
		course: BoardPoint[] | null;
		fresh: boolean;
	}[];
	rings: { city: CityId; color: string }[];
	flags: { id: string; city: CityId; text: string; tone: MarkTone }[];
};

/**
 * A recon route printed beside its city, pointing into the region it reveals. `ready` when this browser's player can
 * take it now, `blocked` with the engine's reason when they cannot, `idle` when nobody here acts (a replay).
 */
export type ReconBoxView = {
	route: string;
	city: CityId;
	cityName: string;
	name: string;
	color: Color;
	count: number;
	unique: boolean;
	needsCenter: boolean;
	reveals: CityId[];
	state: 'ready' | 'blocked' | 'idle';
	reason: string | null;
};

export type BoardView = {
	cities: Record<CityId, CityView>;
	edges: EdgeDef[];
	/** Candidate lines shown faintly while the player picks where to build one. */
	ghostEdges: EdgeDef[];
	pawns: PawnView[];
	/** Supply cubes left in the stockpile, while a game is played. */
	stockpile: number | null;
	recon: ReconBoxView[];
	cursors: CursorView[];
	drawings?: DrawingView[];
	pings?: PingView[];
	fx: Fx[];
	/** A skull over a city struck by an incident, about to become the plague cube in slot `at`. */
	skull: { key: number; city: CityId; at: number } | null;
	marks?: BoardMarks;
};
