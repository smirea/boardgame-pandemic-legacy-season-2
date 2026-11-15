import type { CityId, EdgeDef } from '@repo/game';

export type CityHighlight = 'target' | 'selected' | null;

export type CityView = {
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

export type PawnView = { id: string; city: CityId; color: string; name: string; active: boolean };

export type CursorView = { id: string; name: string; color: string; x: number; z: number };

export type FxKind = 'infect' | 'plague' | 'outbreak' | 'epidemic' | 'connected' | 'build' | 'hollow';

export type Fx = { id: number; city: CityId; kind: FxKind; delay: number };

export type BoardView = {
	cities: Record<CityId, CityView>;
	edges: EdgeDef[];
	/** Candidate lines shown faintly while the player picks where to build one. */
	ghostEdges: EdgeDef[];
	pawns: PawnView[];
	cursors: CursorView[];
	fx: Fx[];
};
