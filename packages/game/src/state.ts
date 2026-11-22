import type { Action } from './actions';
import type { BriefedUnlock } from './briefing';
import type { Play } from './plays';
import type {
	AbilityId,
	ActionId,
	CityImprovementId,
	Color,
	CompanionId,
	ExposureBox,
	EdgeDef,
	EventId,
	InfectionImprovementId,
	JobId,
	LegacyCardDef,
	ObjectiveId,
	RuleId,
	ScarId,
	Seal,
	SealKey,
	SearchResult,
	StructureKind,
	TurningPointId,
} from './content/types';
import type { PiledDeck, StratifiedDeck } from './decks';
import type { CardId, CharacterId, CityId, PlayerId, RegionId, SeatId } from './ids';
import type { Purchase } from './legacy';
import type { RngState } from './rng';

export type SearchBox = { scope: 'land' | 'sea'; result: SearchResult; scratched: boolean };

export type PlayerCard =
	| {
			id: CardId;
			kind: 'city';
			city: CityId;
			improvement: CityImprovementId | null;
			search: SearchBox[];
			/** A companion found by searching lives on the City card and works while the card is held. */
			companion: CompanionId | null;
	  }
	| { id: CardId; kind: 'epidemic' }
	| { id: CardId; kind: 'produce'; boxesLeft: number }
	| { id: CardId; kind: 'event'; event: EventId; mode: 'rationed' | 'unrationed' | 'permanent' };

export type InfectionCard =
	| { id: CardId; kind: 'city'; city: CityId; improvement: InfectionImprovementId | null }
	| { id: CardId; kind: 'gather' }
	| { id: CardId; kind: 'assemble' };

export type Slot = { kind: 'ability'; id: AbilityId } | { kind: 'scar'; id: ScarId } | null;

export type { ExposureBox };

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
/** What a briefing card came out of: a Legacy card read, a bundle opened (with its package and doors), or a turning point. */
export type BriefingSource = { t: 'legacy'; card: string } | { t: 'seal'; seal: Seal } | { t: 'turningPoint' };

export type BriefingEntry =
	| { t: 'card'; title: string; text: string | null; from: BriefingSource }
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
	legacyHalt: { kind: NonNullable<LegacyCardDef['halt']>; month: number } | null;
	/** Legacy cards revealed since the players last acknowledged, shown as a briefing. */
	briefing: BriefingEntry[];
	/** Packages and dossier doors opened so far, in the order they were opened. */
	opened: SealKey[];
	/** The ones a perimeter report forced open. */
	forced: SealKey[];
	routes: string[];
	regions: RegionId[];
	locations: Record<CityId, CampaignLocation>;
	edges: EdgeDef[];
	/** Names the group gave to havens, over the defaults. */
	names: Partial<Record<CityId, string>>;
	characters: Record<CharacterId, Character>;
	/** The Character cards nobody has used yet, next one first. A card may come with boxes already scratched. */
	characterCards: { track: ExposureBox[]; exposure: number }[];
	playerCards: Record<CardId, PlayerCard>;
	infectionCards: Record<CardId, InfectionCard>;
	stored: { player: CardId[]; infection: CardId[] };
	objectives: ObjectiveId[];
	required: number;
	carriedProgress: Partial<Record<ObjectiveId, number>>;
	turningPoints: TurningPointId[];
	/** The stickers the group has not placed yet, one entry for each sticker, so an id may repeat. */
	abilitiesForSale: AbilityId[];
	cityImprovementsForSale: CityImprovementId[];
	infectionImprovementsForSale: InfectionImprovementId[];
	permanentForSale: StructureKind[];
	/** The scar stickers nobody carries yet. */
	scars: ScarId[];
	jobsFound: { job: JobId; home: CityId }[];
	stockpileBonus: number;
	freeAbilityUnits: number;
	frequenciesUsed: number[];
	/** The Legacy cards' scratch-off boxes scratched so far that nothing else records, as `<code>:<n>`. */
	scratched: string[];
	planRecons: string[];
	/** Self-Infect doses used. Pearl has 4 for the whole campaign, and a dose ending in a skull is used too. */
	dosesUsed: number;
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
	| { t: 'freeEdge'; seat: SeatId; kind: 'land' | 'sea'; ignoreRedLines: boolean }
	| { t: 'removeHollow'; seat: SeatId; amount: number }
	| { t: 'quarantineCard'; seat: SeatId }
	| { t: 'giveCard'; seat: SeatId }
	/** Any player may discard a card to end the Infect step early. */
	| { t: 'cordon' }
	/** An Epidemic was drawn and has not struck yet. Held open for Antidote or the player to start the Epidemic. */
	| { t: 'epidemicDrawn' }
	/** Step 1 (Increase) is done; waiting for Step 2 (draw the bottom or stored Infection card). */
	| { t: 'epidemicInfect' }
	/** Step 2 (Infect) is done; waiting for Step 3 (Intensify) and any discard-pile Events or Lockdown. */
	| { t: 'intensify' }
	/** Any player may discard a card of this colour to stop the pending cube removal. */
	| { t: 'shield'; city: CityId; color: Color };

export type LogEntry = { seq: number } & (
	| { t: 'turn'; seat: SeatId }
	| { t: 'action'; seat: SeatId; action: ActionId; detail: string; cost: number }
	| { t: 'move'; seat: SeatId; from: CityId; to: CityId; by: string }
	| { t: 'draw'; seat: SeatId; card: CardId }
	| { t: 'epidemic'; city: CityId | null; card: CardId | null; rate: number; removed: number }
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
	| { t: 'unlock'; seal: SealKey; forced: boolean }
	| { t: 'objective'; objective: ObjectiveId }
	| { t: 'search'; seat: SeatId; city: CityId; card: CardId; box: number; result: SearchResult['t'] }
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
	/** Supply cubes a package brought into the game after setup. */
	cubesAdded: number;
	outcome: { won: boolean; reason: string } | null;
	log: LogEntry[];
	nextSeq: number;
	/** Game-end bookkeeping the upkeep screen works through. */
	upkeep: Upkeep | null;
	/** The campaign as it stood before a prologue game, put back when that game closes. */
	prologueRestore: Campaign | null;
};

/** What moved a location's population at game end: plague or Hollow Men took 1, a supply center gave 1. */
export type PopulationReason = 'plague' | 'hollow' | 'center';

/** One purchase of the spending step, with what it took from each budget so it can be given back exactly. */
export type Bought = { purchase: Purchase; units: number; free: number };

export type Upkeep = {
	units: number;
	populationChanges: { city: CityId; delta: number; reason: PopulationReason }[];
	/** Every purchase of this step, oldest first. */
	bought: Bought[];
	/** Who at the table is done spending. Any purchase or refund clears it, since the table agreed to what it saw. */
	done: PlayerId[];
};

/** Which game the lobby is getting ready for: the practice prologue, or the campaign's month. */
export type Start = 'prologue' | 'month';

/**
 * Interactive Legacy deck / package unboxing progress on the table, synced across all players.
 */
export type TableBriefing = {
	/** How many steps of `openings(campaign.briefing)` have been drawn onto the table. */
	drawn: number;
	/** Whether the most recently drawn card, package or door has been flipped or opened. */
	flipped: boolean;
	/** Players who clicked Done once everything is drawn and opened. */
	ready: PlayerId[];
	/** True once everyone agreed on Done, while clients play the put-away sequence before `ACK_BRIEFING`. */
	stowing: boolean;
};

export type UndoVoteChoice = 'yes' | 'no';

export type UndoSubject =
	| { kind: 'action'; action: Action['a'] }
	| { kind: 'play'; play: Play['e'] }
	| { kind: 'lockdown' }
	| { kind: 'waive' };

export type TableUndoVote = {
	/** The seat whose revealing move is being undone. */
	seat: SeatId;
	/** What kind of move is being undone. */
	subject: UndoSubject;
	/** The player who requested the undo, if initiated by a seated player. */
	by: PlayerId | null;
	/** Each seated player's vote. Full consensus of 'yes' is required to allow the undo. */
	votes: Partial<Record<PlayerId, UndoVoteChoice>>;
};

/**
 * The people at the table, apart from the campaign: a prologue that rolls the campaign back leaves
 * them seated, and undo leaves them alone. One person may hold several seats.
 */
export type Table = {
	seats: { seat: SeatId; player: PlayerId; name: string }[];
	/** Who in the lobby is ready, and for which game. */
	ready: Partial<Record<PlayerId, Start>>;
	/** The game everyone agreed on in the lobby, after which the lobby moves on to choosing characters. */
	start: Start | null;
	briefing: TableBriefing;
	/** Active consensus vote to undo an action that revealed hidden information. */
	undoVote: TableUndoVote | null;
};

export type World = { campaign: Campaign; game: Game | null; table: Table };
