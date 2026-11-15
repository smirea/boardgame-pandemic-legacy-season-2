import type { CityId, MapDef, RegionId, RouteId } from '@repo/game';

export type CityHighlight = 'reachable' | 'selected' | null;

export type CityView = {
	supplies: number;
	plague: number;
	population: number;
	onGrid: boolean;
	supplyCenter: boolean;
	highlight: CityHighlight;
};

export type PawnView = { id: string; city: CityId; color: string; name: string; active: boolean };

export type CursorView = { id: string; name: string; color: string; x: number; z: number };

export type BoardView = {
	map: MapDef;
	explored: ReadonlySet<RegionId>;
	established: ReadonlySet<RouteId>;
	cities: Record<CityId, CityView>;
	pawns: PawnView[];
	cursors: CursorView[];
};
