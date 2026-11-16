import type { CityId, EdgeDef } from '@repo/game';
import type { BoardPoint } from './projection';

export type CityHighlight = 'target' | 'selected' | null;

export type CityView = {
	name: string;
	revealed: boolean;
	onGrid: boolean;
	supplies: number;
	plague: number;
	hollow: number;
	population: number;
	center: boolean;
	tower: boolean;
	shelter: boolean;
	infested: boolean;
	forsaken: boolean;
	lab: boolean;
	highlight: CityHighlight;
	/** Chance of being hit in the next Infect step, when it is worth showing. */
	odds: number | null;
};

/** How a pawn made its last move, which decides the vehicle it travels in. */
export type Travel = 'land' | 'sea' | 'air';

export type PawnView = {
	id: string;
	city: CityId;
	color: string;
	name: string;
	active: boolean;
	travel: Travel;
	/** The way the last move went over the board, city to city, when it kept to a road or the sea. */
	course: BoardPoint[] | null;
};

export type CursorView = { id: string; name: string; color: string; x: number; z: number };

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

export type BoardView = {
	cities: Record<CityId, CityView>;
	edges: EdgeDef[];
	/** Candidate lines shown faintly while the player picks where to build one. */
	ghostEdges: EdgeDef[];
	pawns: PawnView[];
	cursors: CursorView[];
	fx: Fx[];
	marks?: BoardMarks;
};
