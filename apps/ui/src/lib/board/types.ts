import type { CityId, EdgeDef, PlayerCardsAt, StructureKind } from '@repo/game';
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
	/** Marked with an anchor: only ports start or end sea movement. */
	port: boolean;
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
	/** Supply cubes the character carries. */
	carried: number;
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
	/** Supply cubes left in the stockpile, while a game is played. */
	stockpile: number | null;
	cursors: CursorView[];
	fx: Fx[];
	marks?: BoardMarks;
};
