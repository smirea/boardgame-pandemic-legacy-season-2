import type { BriefedUnlock } from './briefing';
import type {
	AbilityId,
	ActionId,
	CityImprovementId,
	Color,
	CompanionId,
	EdgeDef,
	EventId,
	InfectionImprovementId,
	JobId,
	ObjectiveId,
	RuleId,
	ScarId,
	SearchResult,
	StructureKind,
	TurningPointId,
} from './content/types';
import type { PiledDeck, StratifiedDeck } from './decks';
import type { BundleId, CardId, CharacterId, CityId, PlayerId, RegionId, SeatId } from './ids';
import type { RngState } from './rng';

export type SearchBox = { scope: 'land' | 'sea'; result: SearchResult; scratched: boolean };

export type PlayerCard =
	| { id: CardId; kind: 'city'; city: CityId; improvement: CityImprovementId | null; search: SearchBox[] }
	| { id: CardId; kind: 'epidemic' }
	| { id: CardId; kind: 'produce'; boxesLeft: number }
	| { id: CardId; kind: 'event'; event: EventId; mode: 'rationed' | 'unrationed' | 'permanent' }
	| { id: CardId; kind: 'companion'; companion: CompanionId };

export type InfectionCard =
	| { id: CardId; kind: 'city'; city: CityId; improvement: InfectionImprovementId | null }
	| { id: CardId; kind: 'gather' }
	| { id: CardId; kind: 'assemble' };

export type Slot = { kind: 'ability'; id: AbilityId } | { kind: 'scar'; id: ScarId } | null;

export type ExposureBox = 'empty' | 'scar' | 'skull';

export type Character = {
	id: CharacterId;
	name: string;
	job: JobId | null;
	/** The scar covering the job, which switches the job off and applies the scar. */
	jobScar: ScarId | null;
	home: CityId;
	/** Which of the pack's portraits the character wears. */
	portrait: number;
	slots: Slot[];
	/** The hidden scratch-off layout. Peers only ever see the first `exposure` boxes. */
	exposureTrack: ExposureBox[];
	exposure: number;
	dead: boolean;
	diedAt: CityId | null;
	worker: boolean;
	carrier: boolean;
	/** The person who played the character last, so the table deals it back to them. */
	player: PlayerId | null;
};

export type CampaignLocation = {
	population: number;
	infested: boolean;
	revealed: boolean;
	permanent: StructureKind[];
	lab: boolean;
};

export type GameResult = {
	month: number;
	attempt: 1 | 2;
	won: boolean;
	gridCities: number;
	rationing: number;
	/** Who played, in seat order. */
	characters: CharacterId[];
};

/** A Legacy card or opened bundle as read, or one thing it unlocked, worded for its heading (`briefingSections`). */
export type BriefingEntry =
	| { t: 'card'; title: string; text: string | null }
	| { t: 'unlock'; unlock: BriefedUnlock; text: string };

/** Everything that survives from one game to the next. */
export type Campaign = {
	rng: RngState;
	/** 0 is the prologue. */
	month: number;
	attempt: 1 | 2;
	rationing: number;
	results: GameResult[];
	rules: RuleId[];
	actions: ActionId[];
	legacyIndex: number;
	legacyHalt: { kind: 'pause' | 'stop'; month: number } | null;
	/** Legacy cards revealed since the players last acknowledged, shown as a briefing. */
	briefing: BriefingEntry[];
	opened: BundleId[];
	forced: BundleId[];
	routes: string[];
	regions: RegionId[];
	locations: Record<CityId, CampaignLocation>;
	edges: EdgeDef[];
	/** Names the group gave to havens, over the defaults. */
	names: Partial<Record<CityId, string>>;
	characters: Record<CharacterId, Character>;
	playerCards: Record<CardId, PlayerCard>;
	infectionCards: Record<CardId, InfectionCard>;
	stored: { player: CardId[]; infection: CardId[] };
	objectives: ObjectiveId[];
	required: number;
	carriedProgress: Partial<Record<ObjectiveId, number>>;
	turningPoints: TurningPointId[];
	abilitiesForSale: AbilityId[];
	cityImprovementsForSale: CityImprovementId[];
	infectionImprovementsForSale: InfectionImprovementId[];
	permanentForSale: StructureKind[];
	scars: ScarId[];
	jobsFound: { job: JobId; home: CityId }[];
	stockpileBonus: number;
	freeAbilityUnits: number;
	frequenciesUsed: number[];
	planRecons: string[];
	sampleDelivered: boolean;
	losingStreakBonusGames: number;
	owedScars: number;
	nextCardId: number;
	/** Who the table has put in which seat for the next game. A null character is a haven worker. */
	seating: { seat: SeatId; character: CharacterId | null }[];
};

export type GameLocation = {
	supplies: number;
	plague: number;
	hollow: number;
	center: boolean;
	tower: boolean;
	shelter: boolean;
};

export type Player = {
	seat: SeatId;
	character: CharacterId;
	location: CityId;
	hand: CardId[];
	supplies: number;
	/** Once-per-turn abilities already spent this turn. */
	used: string[];
};

export type Decision =
	| { t: 'discard'; seat: SeatId; count: number }
	/** A null seat means the group chooses which character takes it. */
	| { t: 'scar'; seat: SeatId | null }
	| { t: 'replace'; seat: SeatId }
	| { t: 'retrieve'; seat: SeatId; filter: 'any' | 'city' }
	| { t: 'freeEdge'; seat: SeatId; kind: 'land' | 'sea'; ignoreRegions: boolean }
	| { t: 'removeHollow'; seat: SeatId; amount: number }
	| { t: 'quarantineCard'; seat: SeatId }
	/** Any player may discard a card to end the Infect step early. */
	| { t: 'cordon' }
	/** An Epidemic has struck and its discard pile is about to go back on the deck. Held open for a player with Resilience. */
	| { t: 'intensify' }
	/** Any player may discard a card of this colour to stop the pending cube removal. */
	| { t: 'shield'; city: CityId; color: Color };

export type LogEntry = { seq: number } & (
	| { t: 'turn'; seat: SeatId }
	| { t: 'action'; seat: SeatId; action: ActionId; detail: string }
	| { t: 'move'; seat: SeatId; from: CityId; to: CityId; by: string }
	| { t: 'draw'; seat: SeatId; card: CardId }
	| { t: 'epidemic'; city: CityId | null; rate: number; removed: number }
	| {
			t: 'infect';
			city: CityId;
			card: CardId;
			effect: 'supply' | 'plague' | 'outbreak' | 'hollow' | 'skipped' | 'blocked';
	  }
	| { t: 'outbreak'; city: CityId }
	| { t: 'incident'; city: CityId; total: number }
	| { t: 'exposure'; seat: SeatId; result: 'empty' | 'scar' | 'skull' | 'worker' }
	| { t: 'death'; seat: SeatId; character: CharacterId; at: CityId }
	| { t: 'event'; seat: SeatId; event: EventId; detail: string }
	| { t: 'edge'; a: CityId; b: CityId; kind: 'land' | 'sea' }
	| { t: 'connected'; city: CityId }
	| { t: 'structure'; city: CityId; structure: StructureKind }
	| { t: 'reveal'; region: RegionId }
	| { t: 'unlock'; bundle: BundleId; forced: boolean }
	| { t: 'objective'; objective: ObjectiveId }
	| { t: 'search'; seat: SeatId; city: CityId; result: SearchResult['t'] }
	| { t: 'note'; text: string }
	| { t: 'end'; won: boolean; reason: string }
);

export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type LogInput = DistributiveOmit<LogEntry, 'seq'>;

/** Everything that is cleared between games. */
export type Game = {
	seats: SeatId[];
	players: Record<SeatId, Player>;
	active: SeatId;
	turn: number;
	actionsLeft: number;
	drawsLeft: number;
	infectionsLeft: number;
	locations: Record<CityId, GameLocation>;
	stockpile: number;
	reserve: number;
	pieces: { center: number; tower: number; shelter: number; hollow: number };
	playerDeck: PiledDeck;
	playerDiscard: CardId[];
	infectionDeck: StratifiedDeck;
	infectionDiscard: CardId[];
	gameEndArea: CardId[];
	rateIndex: number;
	incidents: number;
	epidemics: number;
	progress: Partial<Record<ObjectiveId, number>>;
	completed: ObjectiveId[];
	/** Objectives the group has judged impossible this game. They no longer count toward the win. */
	waived: ObjectiveId[];
	pending: Decision[];
	skipInfection: boolean;
	pickedEvents: CardId[];
	centersBuilt: number;
	searches: number;
	connectedThisGame: CityId[];
	outcome: { won: boolean; reason: string } | null;
	log: LogEntry[];
	nextSeq: number;
	/** Game-end bookkeeping the upkeep screen works through. */
	upkeep: { units: number; populationChanges: { city: CityId; delta: number }[] } | null;
	/** The campaign as it stood before a prologue game, put back when that game closes. */
	prologueRestore: Campaign | null;
};

/** Which game the lobby is getting ready for: the practice prologue, or the campaign's month. */
export type Start = 'prologue' | 'month';

/**
 * The people at the table, apart from the campaign: a prologue that rolls the campaign back leaves
 * them seated, and undo leaves them alone. One person may hold several seats.
 */
export type Table = {
	seats: { seat: SeatId; player: PlayerId; name: string }[];
	/** Who in the lobby is ready, and for which game. */
	ready: Partial<Record<PlayerId, Start>>;
	/** The game everyone at month 0 agreed on, after which the lobby moves on to choosing characters. */
	start: Start | null;
};

export type World = { campaign: Campaign; game: Game | null; table: Table };
