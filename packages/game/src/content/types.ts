import type { BundleId, CityId, RegionId } from '../ids';

export type Color = 'blue' | 'yellow' | 'black' | 'red';
export type EdgeKind = 'land' | 'sea';

export type RegionDef = { id: RegionId; name: string; startsRevealed: boolean };

export type CityDef = {
	id: CityId;
	name: string;
	region: RegionId;
	lat: number;
	lon: number;
	kind: 'city' | 'haven';
	color: Color | null;
	port: boolean;
	population: number;
	/** Copies of the city's Player card: 4 for a starting city, otherwise one per starting population. Infection cards equal the starting population. */
	playerCards: number;
	startsOnGrid: boolean;
	/** Hidden until an unlock reveals it by name, whatever its region. */
	lost?: boolean;
	startsInfested?: boolean;
	/** Opened the first time a pawn arrives. */
	arrival?: BundleId;
	/**
	 * How much more ground the location claims than its nearest-location share, in squared board units:
	 * a point belongs to the location with the least squared distance minus this. Negative claims less.
	 */
	groundWeight?: number;
};

export type EdgeDef = { a: CityId; b: CityId; kind: EdgeKind };

export type ReconRoute = {
	id: string;
	city: CityId;
	color: Color;
	count: number;
	/** Every discarded card must name a different city. */
	unique: boolean;
	opens: BundleId;
	needsCenter: boolean;
	/** Objectives a successful recon of this route advances. */
	counts: ObjectiveId[];
};

export type JobId =
	| 'administrator'
	| 'radioOperator'
	| 'laborer'
	| 'farmer'
	| 'instructor'
	| 'immunologist'
	| 'captain'
	| 'sanitationOfficer'
	| 'scientist'
	| 'vectorControl';

export type AbilityId =
	| 'architect'
	| 'helmsman'
	| 'recordKeeper'
	| 'courier'
	| 'broker'
	| 'scout'
	| 'surveyor'
	| 'lookout'
	| 'navigator'
	| 'saboteur'
	| 'investigator'
	| 'supplier'
	| 'facilitator'
	| 'runner'
	| 'foreman'
	| 'outrider'
	| 'soldier'
	| 'coordinator'
	| 'smuggler';

export type ScarId =
	| 'reconExtraCard'
	| 'lineExtraCube'
	| 'laneExtraCube'
	| 'searchDiscard'
	| 'smallHand'
	| 'wasteful'
	| 'portBound'
	| 'oddHand'
	| 'rattled'
	| 'plagueShy'
	| 'frail'
	| 'haunted'
	| 'grasping'
	| 'buildExtraCard'
	| 'wary'
	| 'carrier';

export type CompanionId =
	| 'builder'
	| 'lineman'
	| 'rigger'
	| 'tracker'
	| 'medic'
	| 'fieldSurgeon'
	| 'purifier'
	| 'shelterWright'
	| 'marksman'
	| 'trader'
	| 'porter';

export type EventId =
	| 'airlift'
	| 'quietNight'
	| 'resilience'
	| 'handout'
	| 'cardSwap'
	| 'spreadOut'
	| 'cleanse'
	| 'forecast'
	| 'cache'
	| 'encore'
	| 'secondWind'
	| 'massInoculation'
	| 'openWaters'
	| 'scavenge'
	| 'safeHouses'
	| 'purge'
	| 'stockUp'
	| 'exile'
	| 'antidote'
	| 'mentor'
	| 'surplus';

export type CityImprovementId = 'double' | 'triple' | 'wild' | 'redWild';
export type InfectionImprovementId = 'wellStocked' | 'lockdown' | 'rebirth' | 'cordon';

export type StructureKind = 'center' | 'tower' | 'shelter';

export type ExposureBox = 'empty' | 'scar' | 'skull';

export type ActionId =
	| 'drive'
	| 'sail'
	| 'charter'
	| 'makeSupplies'
	| 'produce'
	| 'deliver'
	| 'share'
	| 'buildCenter'
	| 'recon'
	| 'establishLine'
	| 'search'
	| 'chartLane'
	| 'shuttle'
	| 'buildTower'
	| 'transmit'
	| 'monitor'
	| 'broadcast'
	| 'buildShelter'
	| 'administratorMove'
	| 'sabotage'
	| 'captainSail'
	| 'selfInject'
	| 'pickUp'
	| 'transfer'
	| 'inoculate'
	| 'salvage'
	| 'destroyInfection'
	| 'broker'
	| 'investigate'
	| 'supply'
	| 'facilitate'
	| 'run'
	| 'strike'
	| 'coordinate'
	| 'smuggle'
	| 'trade'
	| 'carry';

export type RuleId =
	/** Population 0 makes a city forsaken and infested. */
	| 'forsaken'
	/** Epidemic count scales with City cards in the Player deck. */
	| 'epidemicScaling'
	/** The last 3 setup infection cards place Hollow Men. */
	| 'hollowSetup'
	/** Epidemics infect from the stored Infection cards before the bottom of the deck. */
	| 'epidemicFromStorage'
	/** Any player may discard a matching-colour City card to cancel one cube removal. */
	| 'topazShield'
	| 'storage'
	| 'carrier'
	/** An Epidemic's Infect step removes 1 cube instead of all of them. */
	| 'gentleEpidemic';

export type ObjectiveId =
	| 'prologueCenters'
	| 'buildCenters'
	| 'reconRegion'
	| 'reconNewArea'
	| 'connectCities'
	| 'lostHaven'
	| 'searches'
	| 'triangulate'
	| 'reconEastAsia'
	| 'defect'
	| 'plan'
	| 'deliverSample';

export type ObjectiveDef = {
	id: ObjectiveId;
	name: string;
	rule: string;
	target: number;
	mandatory: boolean;
	/** Completed in a lost early attempt, it stays complete in the late attempt. */
	carriesOver: boolean;
	/** Each step is permanent, so partial progress carries over too. */
	stepsCarry?: boolean;
	/** Opened once, the first time the objective completes. */
	reward?: BundleId;
	destroyOnComplete?: boolean;
};

export type SearchResult =
	| { t: 'supplies'; amount: number; from: 'stockpile' | 'reserve' }
	| { t: 'stockpile'; amount: number }
	| { t: 'actions'; amount: number }
	| { t: 'retrieve' }
	| { t: 'quarantineCard' }
	| { t: 'removeHollow'; amount: number }
	| { t: 'freeEdge'; kind: EdgeKind }
	| { t: 'discover'; bundle: BundleId }
	| { t: 'companion'; companion: CompanionId }
	| { t: 'infest' }
	| { t: 'nothing' };

export type SearchBoxDef = { scope: 'land' | 'sea'; result: SearchResult };

/** What a Monitor frequency gives: a bundle to open, or cards kept from the top of the Player discard pile. */
export type FrequencyReward = { bundle: BundleId } | { take: number } | null;

export type TurningPointId = 'firstForsaken' | 'losingStreak';

export type PurchaseId =
	| { t: 'ability'; ability: AbilityId }
	| { t: 'cityImprovement'; improvement: CityImprovementId }
	| { t: 'infectionImprovement'; improvement: InfectionImprovementId }
	| { t: 'population' }
	| { t: 'restore' }
	| { t: 'permanent'; structure: StructureKind };

export type Unlock =
	| { t: 'rule'; rule: RuleId }
	| { t: 'action'; action: ActionId }
	| { t: 'region'; region: RegionId; connect?: EdgeDef[] }
	| { t: 'haven'; city: CityId }
	| { t: 'edge'; edge: EdgeDef }
	| { t: 'route'; route: string }
	| { t: 'objectives'; add?: ObjectiveId[]; remove?: ObjectiveId[] }
	| { t: 'required'; count: number }
	| { t: 'turningPoint'; id: TurningPointId }
	| { t: 'event'; event: EventId; mode: 'rationed' | 'unrationed' | 'permanent'; copies?: number }
	/** Stickers: each unlock adds `copies` of one (1 when left out), and a sticker that is placed is gone. */
	| { t: 'ability'; ability: AbilityId; copies?: number }
	| { t: 'cityImprovement'; improvement: CityImprovementId; copies?: number }
	| { t: 'infectionImprovement'; improvement: InfectionImprovementId; copies?: number }
	| { t: 'permanentStructure'; structure: StructureKind; copies?: number }
	| { t: 'job'; job: JobId; home: CityId }
	| { t: 'gather'; cards: number }
	| { t: 'assemble'; cards: number }
	| { t: 'stockpileBonus'; amount: number }
	| { t: 'freeAbilityUnits'; amount: number }
	| { t: 'lab'; city: CityId }
	| { t: 'infest'; city: CityId }
	| { t: 'forsake'; city: CityId }
	/** A scar the group must place on a character of its choice when the next game begins. */
	| { t: 'owedScar' }
	/** Tells the group which Monitor frequencies open something, the reward for triangulating the signals. */
	| { t: 'frequencyHint' }
	| { t: 'open'; bundle: BundleId }
	/** Forced opening: the explorer's reward is lost and the recon does not count toward an objective. */
	| { t: 'perimeter'; bundle: BundleId; penalty?: Unlock[] };

/** A package, dossier door, or reward: a named set of unlocks opened as one. */
export type BundleDef = {
	id: BundleId;
	name: string;
	unlocks: Unlock[];
	/** Granted only when the bundle is opened by the players, not forced. */
	reward?: Unlock[];
};

export type LegacyCardDef = {
	id: string;
	month: number;
	/** Where reading halts after this card. `pause` resumes at game end, `stop` at the next month's setup. */
	halt?: 'pause' | 'stop';
	title: string;
	text: string;
	unlocks: Unlock[];
	/** Only applies when the month was lost or won, for cards read at game end. */
	when?: 'won' | 'lost';
};

export type JobDef = { id: JobId; name: string; text: string; starting: boolean };
export type AbilityDef = { id: AbilityId; name: string; text: string; cost: number };
export type ScarDef = { id: ScarId; name: string; text: string; slots: number };
export type CompanionDef = { id: CompanionId; name: string; text: string; spent: boolean };
export type EventDef = { id: EventId; name: string; text: string };
export type CityImprovementDef = { id: CityImprovementId; name: string; text: string; cost: number };
export type InfectionImprovementDef = { id: InfectionImprovementId; name: string; text: string; cost: number };

export type ContentPack = {
	regions: RegionDef[];
	cities: CityDef[];
	edges: EdgeDef[];
	/** Pairs players may join with a drawn supply line or sea lane, precomputed from geography. */
	candidateEdges: EdgeDef[];
	positions: Record<CityId, { x: number; z: number }>;
	/** The course each line takes on the board, keyed `${kind}:${edgeKey}`, from the lesser id's end. */
	routeCourses: Record<string, [number, number][]>;
	reconRoutes: ReconRoute[];
	searches: Record<CityId, SearchBoxDef[]>;
	jobs: JobDef[];
	abilities: AbilityDef[];
	scars: ScarDef[];
	companions: CompanionDef[];
	events: EventDef[];
	/**
	 * The hidden layout under each Character card's scratch-off boxes, box 1 first, ending at the box that
	 * kills. A campaign has this many Character cards and no more.
	 */
	characterCards: ExposureBox[][];
	cityImprovements: CityImprovementDef[];
	infectionImprovements: InfectionImprovementDef[];
	objectives: ObjectiveDef[];
	bundles: BundleDef[];
	legacyDeck: LegacyCardDef[];
	/** What each of the ten Monitor frequencies opens. */
	frequencies: FrequencyReward[];
	startingEvents: EventId[];
	/** The ability stickers in the box when the campaign begins, one of each. */
	startingAbilities: AbilityId[];
	sampleFrom: CityId;
	sampleTo: CityId;
	numbers: {
		actionsPerTurn: number;
		handLimit: number;
		setupInfections: number;
		infectionRates: number[];
		incidentLimit: number;
		maxPlaguePerCity: number;
		maxHollowPerCity: number;
		supplyByMonth: number[];
		requiredByMonth: number[];
		pieces: { center: number; tower: number; shelter: number; hollow: number };
		produceCards: number;
		produceBoxes: number;
		characterSlots: number;
		/** How many portraits a character can wear, `/portraits/survivor-<n>.webp` in the UI. */
		portraits: number;
		exposureBoxes: number;
		storageCap: number;
		rebirthPopulation: number;
		startingRationing: number;
		epidemicTable: { maxCityCards: number; epidemics: number }[];
		productionTable: { maxCities: number; units: number }[];
		dealByPlayers: Record<number, number>;
		costs: {
			center: number;
			line: number;
			lane: number;
			tower: number;
			population: number;
			restore: number;
			permanent: Record<StructureKind, number>;
		};
	};
};
