import type { CityId, RegionId, UnchartedId } from "../ids";

export type Color = "blue" | "yellow" | "black" | "red";
export type EdgeKind = "land" | "sea";

export type RegionDef = { id: RegionId; name: string; startsRevealed: boolean };

export type CityDef = {
  id: CityId;
  name: string;
  region: RegionId;
  lat: number;
  lon: number;
  kind: "city" | "haven";
  color: Color | null;
  port: boolean;
  population: number;
  /** Copies of the city's Player card: 4 for a starting city, otherwise one per starting population. Infection cards equal the starting population. */
  playerCards: number;
  startsOnGrid: boolean;
  /** Hidden until an unlock reveals it by name, whatever its region. */
  lost?: boolean;
  startsInfested?: boolean;
  /** Never drawn for infection: the map sticker brings no Infection cards. */
  noInfectionCards?: boolean;
  /** Opened the first time a pawn arrives. */
  arrival?: Seal;
  /** An arrival counts only once this is open: Lake Baikal's Pearl lab waits for Package 8. */
  arrivalAfter?: Seal;
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
  /** What the recon opens, or null for a step of the Plan, which only counts toward it. */
  opens: Seal | null;
  needsCenter: boolean;
  /** Objectives a successful recon of this route advances. */
  counts: ObjectiveId[];
};

export type JobId =
  | "administrator"
  | "radioOperator"
  | "laborer"
  | "farmer"
  | "instructor"
  | "immunologist"
  | "captain"
  | "sanitationOfficer"
  | "scientist"
  | "vectorControl";

export type AbilityId =
  | "architect"
  | "helmsman"
  | "recordKeeper"
  | "courier"
  | "broker"
  | "scout"
  | "lookout"
  | "navigator"
  | "saboteur"
  | "investigator"
  | "supplier"
  | "facilitator"
  | "runner"
  | "foreman"
  | "outrider"
  | "soldier"
  | "misinformationSpecialist"
  | "rehabNurse"
  | "coordinator"
  | "smuggler";

export type ScarId =
  | "reconExtraCard"
  | "lineExtraCube"
  | "laneExtraCube"
  | "searchDiscard"
  | "smallHand"
  | "wasteful"
  | "portBound"
  | "oddHand"
  | "rattled"
  | "plagueShy"
  | "frail"
  | "haunted"
  | "grasping"
  | "buildExtraCard"
  | "wary"
  | "susceptible"
  | "fearOfNeedles"
  | "fearOfFlying"
  | "carrier";

export type CompanionId =
  | "builder"
  | "lineman"
  | "rigger"
  | "tracker"
  | "medic"
  | "fieldSurgeon"
  | "purifier"
  | "shelterWright"
  | "marksman"
  | "trader"
  | "porter"
  | "quartermaster"
  | "doubleAgent"
  | "informant";

export type EventId =
  | "airlift"
  | "quietNight"
  | "resilience"
  | "handout"
  | "cardSwap"
  | "spreadOut"
  | "cleanse"
  | "forecast"
  | "cache"
  | "encore"
  | "secondWind"
  | "massInoculation"
  | "openWaters"
  | "scavenge"
  | "safeHouses"
  | "purge"
  | "stockUp"
  | "exile"
  | "antidote"
  | "mentor"
  | "surplus"
  | "riotControl"
  | "mobileShelters";

export type CityImprovementId = "double" | "triple" | "wild" | "redWild";
export type InfectionImprovementId = "wellStocked" | "lockdown" | "rebirth" | "cordon";

export type StructureKind = "center" | "tower" | "shelter";

export type ExposureBox = "empty" | "scar" | "skull";

export type ActionId =
  | "drive"
  | "sail"
  | "charter"
  | "makeSupplies"
  | "produce"
  | "deliver"
  | "share"
  | "buildCenter"
  | "recon"
  | "establishLine"
  | "search"
  | "chartLane"
  | "shuttle"
  | "buildTower"
  | "transmit"
  | "monitor"
  | "broadcast"
  | "buildShelter"
  | "administratorMove"
  | "sabotage"
  | "captainSail"
  | "selfInject"
  | "pickUp"
  | "transfer"
  | "inoculate"
  | "salvage"
  | "destroyInfection"
  | "broker"
  | "investigate"
  | "supply"
  | "facilitate"
  | "run"
  | "misinform"
  | "rehab"
  | "coordinate"
  | "smuggle"
  | "trade"
  | "carry";

export type RuleId =
  /** Population 0 makes a city forsaken and infested. */
  | "forsaken"
  /** Epidemic count scales with City cards in the Player deck. */
  | "epidemicScaling"
  /** The last 3 setup infection cards place Hollow Men. */
  | "hollowSetup"
  /** Epidemics infect from the stored Infection cards before the bottom of the deck. */
  | "epidemicFromStorage"
  | "storage"
  | "carrier"
  /** Each lab found gives its breakthrough (`breakthrough`). */
  | "labBreakthroughs";

export type ObjectiveId =
  | "prologueCenters"
  | "buildCenters"
  | "reconRegion"
  | "reconNewArea"
  | "connectCities"
  | "lostHaven"
  | "searches"
  | "triangulate"
  | "reconEastAsia"
  | "defect"
  | "plan"
  | "deliverSample";

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
  /** A recon of one named region: once that region is reconned, the card counts as complete. */
  doneIfReconned?: true;
  /** Opened once, the first time the objective completes. */
  reward?: Seal;
  destroyOnComplete?: boolean;
};

export type SearchResult =
  | { t: "supplies"; amount: number; from: "stockpile" | "reserve" }
  | { t: "stockpile"; amount: number }
  | { t: "actions"; amount: number }
  | { t: "retrieve" }
  /** Give a card from hand to any other player. */
  | { t: "giveCard" }
  | { t: "quarantineCard" }
  | { t: "removeHollow"; amount: number }
  | { t: "freeEdge"; kind: EdgeKind }
  /**
   * Opens each door or package still sealed, and marks a lab when one is named. A lost haven's lead, already
   * followed, gives 1 action instead (`orAction`).
   */
  | { t: "discover"; seals: Seal[]; lab?: CityId; orAction?: true }
  | { t: "companion"; companion: CompanionId }
  /** Marks the city infested, and opens a door when one is named. */
  | { t: "infest"; opens?: Seal }
  | { t: "nothing" };

export type SearchBoxDef = { scope: "land" | "sea"; result: SearchResult };

/** What a Monitor frequency gives: a door to open, or up to `take` cards kept from the top of the Player discard pile. */
export type FrequencyReward = { seal: Seal } | { take: number } | null;

export type TurningPointId = "firstForsaken" | "losingStreak" | "defection";

export type PurchaseId =
  | { t: "ability"; ability: AbilityId }
  | { t: "cityImprovement"; improvement: CityImprovementId }
  | { t: "infectionImprovement"; improvement: InfectionImprovementId }
  | { t: "population" }
  | { t: "restore" }
  | { t: "permanent"; structure: StructureKind };

export type Unlock =
  | { t: "rule"; rule: RuleId }
  | { t: "action"; action: ActionId }
  | { t: "region"; region: RegionId; connect?: EdgeDef[] }
  | { t: "haven"; city: CityId }
  | { t: "edge"; edge: EdgeDef }
  | { t: "route"; route: string }
  | { t: "objectives"; add?: ObjectiveId[]; remove?: ObjectiveId[] }
  | { t: "required"; count: number }
  /** Puts a turning point in play, or with `over` resolves one. */
  | { t: "turningPoint"; id: TurningPointId; over?: true }
  | {
      t: "event";
      event: EventId;
      mode: "rationed" | "unrationed" | "permanent";
      copies?: number;
      /** Where each new copy goes in a game under way: the opener's hand or the Player discard pile. */
      now?: ("hand" | "discard")[];
    }
  /** Stickers: each unlock adds `copies` of one (1 when left out), and a sticker that is placed is gone. */
  | { t: "ability"; ability: AbilityId; copies?: number }
  | { t: "scar"; scar: ScarId; copies?: number }
  | { t: "cityImprovement"; improvement: CityImprovementId; copies?: number }
  | { t: "infectionImprovement"; improvement: InfectionImprovementId; copies?: number }
  | { t: "permanentStructure"; structure: StructureKind; copies?: number }
  | { t: "job"; job: JobId; home: CityId }
  | { t: "gather"; cards: number }
  | { t: "assemble"; cards: number }
  /** `fresh` cubes are new to the game; otherwise this game's share comes out of the reserve. */
  | { t: "stockpileBonus"; amount: number; fresh?: true }
  /** One more Epidemic card in the box. How many go in the Player deck is the epidemic table's to say. */
  | { t: "epidemicCard" }
  /** Extra actions for the active player, now. */
  | { t: "actions"; amount: number }
  | { t: "freeAbilityUnits"; amount: number }
  | { t: "lab"; city: CityId }
  | { t: "infest"; city: CityId }
  | { t: "forsake"; city: CityId }
  /** The city is gone: covered on the map, its cards and lines destroyed, its ground closed to every line. */
  | { t: "destroy"; city: CityId }
  /** A scar the group must place on a character of its choice when the next game begins. */
  | { t: "owedScar" }
  /** Tells the group which Monitor frequencies open something, the reward for triangulating the signals. */
  | { t: "frequencyHint" }
  /** Opens a door or package, when it is still sealed. */
  | { t: "open"; seal: Seal }
  /** A Legacy card's scratch-off box (`<code>:<n>`) that is scratched only when `unlessOpen` is still sealed. */
  | { t: "scratch"; box: string; unlessOpen: Seal }
  /** Forced opening, when still sealed: the explorer's reward is lost and nothing counts toward an objective. */
  | { t: "perimeter"; seal: Seal; penalty?: Unlock[] };

/** A door in the dossier, named by the number or letter printed on it. */
export type DoorId = string;

/** Where the original keeps sealed content: a numbered package or a tear-off dossier door. */
export type Seal = { t: "package"; id: number } | { t: "door"; id: DoorId };
export type SealKey = `package:${number}` | `door:${string}`;
export const sealKey = (seal: Seal): SealKey => `${seal.t}:${seal.id}` as SealKey;

/** The packages and the dossier sheets, laid out as the box has them. */
export type DossierDef = { packages: number[]; sheets: DoorId[][] };

/** What a package or door holds. Opening it applies its unlocks, which may open further doors. */
export type SealDef = {
  seal: Seal;
  name: string;
  unlocks: Unlock[];
  /** Granted only when the players open it, not when a perimeter report forces it. */
  reward?: Unlock[];
};

export type LegacyCardKind =
  | "prologue"
  | "stop"
  | "pause"
  | "archive"
  | "priorities"
  | "objective"
  | "turningPoint"
  | "event"
  | "epidemic"
  | "scanner"
  | "plan"
  | "ending"
  | "reckoning"
  | "end";

export type LegacyCardDef = {
  /** The code printed on the card, such as `06-04`. */
  id: string;
  month: number;
  kind: LegacyCardKind;
  /**
   * Where reading halts after this card. `pause` resumes at game end, `stop` at the next month's setup, and
   * `finale` at the end of the last December game: a win, or the second game lost.
   */
  halt?: "pause" | "stop" | "finale";
  title: string;
  text: string;
  unlocks: Unlock[];
  /** Only applies when the sample was, or was not, delivered. */
  when?: "delivered" | "notDelivered";
};

export type JobDef = { id: JobId; name: string; text: string; starting: boolean };
export type AbilityDef = { id: AbilityId; name: string; text: string; cost: number };
export type ScarDef = { id: ScarId; name: string; text: string; slots: number };
export type CompanionDef = { id: CompanionId; name: string; text: string; spent: boolean };
export type EventDef = { id: EventId; name: string; text: string };
export type CityImprovementDef = {
  id: CityImprovementId;
  name: string;
  text: string;
  cost: number;
};
export type InfectionImprovementDef = {
  id: InfectionImprovementId;
  name: string;
  text: string;
  cost: number;
};

export type ContentPack = {
  regions: RegionDef[];
  cities: CityDef[];
  edges: EdgeDef[];
  /** Pairs players may join with a drawn supply line or sea lane, precomputed from geography. */
  candidateEdges: EdgeDef[];
  positions: Record<CityId, { x: number; z: number }>;
  /** The course each line takes on the board, keyed `${kind}:${edgeKey}`, from the lesser id's end. */
  routeCourses: Record<string, [number, number][]>;
  /** The red region lines printed on the board, in board units. A sea lane may cross at most one. */
  redLines: [number, number][][];
  /** Ocean the printed board leaves dark, owning ground in the partition. `revealedWith` is the location that uncovers it, if any. */
  uncharted: { id: UnchartedId; at: { x: number; z: number }; revealedWith: CityId | null }[];
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
  seals: SealDef[];
  legacyDeck: LegacyCardDef[];
  dossier: DossierDef;
  /** What each of the ten Monitor frequencies opens. */
  frequencies: FrequencyReward[];
  /** The scanner's printed frequency for each box, in the same order. */
  frequencyLabels: string[];
  startingEvents: EventId[];
  /** The ability stickers in the box when the campaign begins, one of each. */
  startingAbilities: AbilityId[];
  startingScars: ScarId[];
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
    /** The System-Wide Production boxes printed on each Produce Supplies card, one entry per card. */
    produceBoxes: number[];
    characterSlots: number;
    /** How many portraits a character can wear, `/figures/survivor-<n>.webp` in the UI. */
    portraits: number;
    exposureBoxes: number;
    selfInfectDoses: number;
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
