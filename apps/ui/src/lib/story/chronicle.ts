import { newCampaign, pack, sealKey } from "@repo/game";
import type { Campaign, LegacyCardDef, Seal } from "@repo/game";
import { ENDING_TIERS, STORY_SCENES } from "./script.ts";
import type { SetPieceId } from "./script.ts";

export type ChronicleChoices = {
  naRecon: "reconned" | "raided";
  forsakenCity: boolean;
  searchedAtlanta: boolean;
  saRecon: "feb" | "mar" | "raided";
  foundOpal: boolean;
  pacificHaven: "early" | "may_report";
  europeRecon: "reconned" | "frankfurt_destroyed";
  africaRecon: "reconned" | "raided";
  foundJade: boolean;
  meRecon: "reconned" | "raided";
  triangulated: boolean;
  searchedMumbai: boolean;
  indianHaven: "early" | "sep_report";
  asiaRecon: "reconned" | "raided";
  searchedShanghai: boolean;
  hollowDefect: "october" | "november_cost";
  utopiaBreach: "plan" | "uprising";
  sampleDelivered: boolean;
  scoreBand: "851+" | "701-850" | "551-700" | "401-550" | "400-";
};

export const HEROIC_CHOICES: ChronicleChoices = {
  naRecon: "reconned",
  forsakenCity: false,
  searchedAtlanta: true,
  saRecon: "mar",
  foundOpal: true,
  pacificHaven: "early",
  europeRecon: "reconned",
  africaRecon: "reconned",
  foundJade: true,
  meRecon: "reconned",
  triangulated: true,
  searchedMumbai: true,
  indianHaven: "early",
  asiaRecon: "reconned",
  searchedShanghai: true,
  hollowDefect: "october",
  utopiaBreach: "plan",
  sampleDelivered: true,
  scoreBand: "851+",
};

export const DARKEST_CHOICES: ChronicleChoices = {
  naRecon: "raided",
  forsakenCity: true,
  searchedAtlanta: true,
  saRecon: "raided",
  foundOpal: false,
  pacificHaven: "may_report",
  europeRecon: "frankfurt_destroyed",
  africaRecon: "raided",
  foundJade: false,
  meRecon: "raided",
  triangulated: false,
  searchedMumbai: true,
  indianHaven: "sep_report",
  asiaRecon: "raided",
  searchedShanghai: true,
  hollowDefect: "november_cost",
  utopiaBreach: "uprising",
  sampleDelivered: false,
  scoreBand: "400-",
};

export type DecisionOption = {
  label: string;
  detail: string;
  tone: "good" | "warn" | "danger" | "neutral";
  apply: Partial<ChronicleChoices>;
  active: (choices: ChronicleChoices) => boolean;
};

export type ChronicleDecision = {
  id: string;
  prompt: string;
  context: string;
  options: DecisionOption[];
};

export type ChronicleAudioState = {
  month: number;
  incidents: number;
  epidemics: number;
  hollowPresent: boolean;
  inoculationSafe: boolean;
  wearingOff: boolean;
};

export type ChronicleStep = {
  id: string;
  month: number;
  monthLabel: string;
  act: string;
  kind: "story" | "card" | "seal" | "decision" | "ending";
  title: string;
  subtitle?: string;
  summary: string;
  /** Real `pack.legacyDeck` card IDs rendered with `<LegacyCard />` on this step. */
  cardIds?: string[];
  /** Real package crates / dossier doors opened on this step. */
  seals?: Seal[];
  /** Key into `STORY_SCENES` for voiced narrative theater playback. */
  sceneId?: string;
  setPiece?: SetPieceId;
  /** Branching inflection point choices editable in-place (with full forward/reverse support). */
  decisions?: ChronicleDecision[];
  /** Highlighted consequence badges active on this step. */
  consequences?: { label: string; tone: "good" | "warn" | "danger" | "neutral" }[];
  /** Final Reckoning verbatim tier block (only on final ending step). */
  endingText?: { delivered: boolean; bracket: string; text: string };
  /** Synthetic campaign state UP TO this step so Legacy cards render exact scratches & rules. */
  campaign: Campaign;
  audio: ChronicleAudioState;
};

const cardMap = new Map<string, LegacyCardDef>(pack.legacyDeck.map((c) => [c.id, c]));

export function legacyCard(id: string): LegacyCardDef | null {
  return cardMap.get(id) ?? null;
}

function makeCampaign(mutator: (c: Campaign) => void): Campaign {
  const c = newCampaign(1);
  mutator(c);
  return c;
}

function addOpened(c: Campaign, ...seals: Seal[]) {
  for (const s of seals) {
    const k = sealKey(s);
    if (!c.opened.includes(k)) c.opened.push(k);
  }
}

function addForced(c: Campaign, ...seals: Seal[]) {
  for (const s of seals) {
    const k = sealKey(s);
    if (!c.opened.includes(k)) c.opened.push(k);
    if (!c.forced.includes(k)) c.forced.push(k);
  }
}

const pkg = (id: number): Seal => ({ t: "package", id });
const door = (id: string): Seal => ({ t: "door", id });

const SCORE_BAND_INDEX: Record<ChronicleChoices["scoreBand"], number> = {
  "851+": 0,
  "701-850": 1,
  "551-700": 2,
  "401-550": 3,
  "400-": 4,
};

/**
 * Builds the complete ordered Legacy Deck Story Mode timeline for the current set of branching choices.
 * Changing any choice at any inflection point deterministically recalculates downstream cards,
 * scratched perimeter reports, opened packages/doors, and endings.
 */
export function buildChronicle(choices: ChronicleChoices): ChronicleStep[] {
  const steps: ChronicleStep[] = [];

  // Running cumulative state so every step snapshots an accurate Campaign & Audio profile.
  const opened: Seal[] = [];
  const forced: Seal[] = [];
  const scratched: string[] = [];
  const rules: Campaign["rules"] = [];
  const turningPoints: Campaign["turningPoints"] = [];
  let frequenciesUsed: number[] = [];
  let planRecons: string[] = [];
  let sampleDelivered = false;
  let hollowPresent = false;
  let inoculationSafe = false;
  let wearingOff = false;
  let epidemics = 0;
  let incidents = 0;
  let legacyIndex = 0;

  const snapshotCampaign = (month: number): Campaign =>
    makeCampaign((c) => {
      c.month = month;
      c.legacyIndex = legacyIndex;
      addOpened(c, ...opened);
      addForced(c, ...forced);
      c.scratched = [...scratched];
      c.rules = [...rules];
      c.turningPoints = [...turningPoints];
      c.frequenciesUsed = [...frequenciesUsed];
      c.planRecons = [...planRecons];
      c.sampleDelivered = sampleDelivered;
    });

  const push = (
    month: number,
    monthLabel: string,
    data: Omit<ChronicleStep, "month" | "monthLabel" | "campaign" | "audio">,
  ) => {
    if (data.cardIds?.length) {
      const last = data.cardIds.at(-1)!;
      const idx = pack.legacyDeck.findIndex((c) => c.id === last);
      if (idx >= 0) legacyIndex = Math.max(legacyIndex, idx + 1);
    }
    steps.push({
      month,
      monthLabel,
      ...data,
      campaign: snapshotCampaign(month),
      audio: {
        month,
        incidents,
        epidemics,
        hollowPresent,
        inoculationSafe,
        wearingOff,
      },
    });
  };

  // === ACT 0 · PRELUDE ===
  push(0, "Prelude", {
    id: "prelude",
    act: "Act 0 · Year 71 of the Fall",
    kind: "story",
    title: "The World Almost Ended 71 Years Ago",
    subtitle: "Rulebook Opening · Instructions for a Better Life on the Havens",
    summary:
      "Seventy-one years after the plague ended the old world, the Haven leadership vanishes at their annual summit. Command falls to a handful of volunteers.",
    sceneId: "prelude",
  });

  // === PROLOGUE ===
  push(0, "Prologue", {
    id: "prologue-deck",
    act: "Prologue · First Supply Runs",
    kind: "card",
    title: "Prologue & Opening Objective",
    subtitle: "Legacy Cards 00-01 · 00-02",
    summary:
      "Cover up, sail out to the nine surviving coastal cities on the Atlantic grid, and restore three supply centers before the campaign begins in earnest.",
    cardIds: ["00-01", "00-02"],
    sceneId: "00-01",
  });

  // === JANUARY ===
  turningPoints.push("firstForsaken");
  push(1, "Jan", {
    id: "jan-opening",
    act: "January · Year 71",
    kind: "card",
    title: "Opening the Legacy Deck",
    subtitle: "Legacy Cards 01-01 to 01-06",
    summary:
      'Priorities: find the missing leaders and find more supplies. The October Year 70 archive warns that leadership voted to initiate "the protocol we hoped would never come."',
    cardIds: ["01-01", "01-02", "01-03", "01-04", "01-05", "01-06"],
    sceneId: "01-01",
  });

  push(1, "Jan", {
    id: "jan-archive",
    act: "January · From the Archives",
    kind: "card",
    title: "October 15, Year 70 — The Fatalistic Protocol",
    subtitle: "Archive Dispatch · 01-02",
    summary:
      "Dr. Tomas Renn uncovers the hidden Haven leadership dispatch declaring stockpile projections fatalistic—and voting to initiate a secret protocol.",
    cardIds: ["01-02"],
    sceneId: "01-02",
  });

  push(1, "Jan", {
    id: "jan-pause",
    act: "January · Mid-Month",
    kind: "card",
    title: "First Rationed Events Enter the Reserve",
    subtitle: "Legacy Cards 01-07 to 01-11",
    summary:
      "Data Transfer, Dispersal, Drastic Measures, and Extended Forecast join the Rationed Events pool after January’s first game.",
    cardIds: ["01-07", "01-08", "01-09", "01-10", "01-11"],
  });

  // INFLECTION POINT 1 — January Recon & Turning Point
  push(1, "Jan", {
    id: "decision-jan",
    act: "Inflection Point · End of January",
    kind: "decision",
    title: "North America Recon & First Casualties",
    subtitle: "Decides Package 1, February’s Perimeter Report, and Turning Point #1",
    summary:
      "Choose whether your crew reconned North America in time, uncovered the CDC ruins in Atlanta, or let a city drop to population 0.",
    decisions: [
      {
        id: "naRecon",
        prompt: "Did the crew Recon North America before February?",
        context: "February’s Perimeter Report (02-01) checks whether Door 66 is already open.",
        options: [
          {
            label: "Reconned North America",
            detail: "Open Package 1 cleanly, save Decontamination Kit, and keep 02-01 unscratched.",
            tone: "good",
            apply: { naRecon: "reconned" },
            active: (c) => c.naRecon === "reconned",
          },
          {
            label: "Failed to Recon — Hollow Men Raid",
            detail:
              "02-01 scratches open in February; Package 1 is forced open and Decontamination Kit is destroyed.",
            tone: "danger",
            apply: { naRecon: "raided" },
            active: (c) => c.naRecon === "raided",
          },
        ],
      },
      {
        id: "forsakenCity",
        prompt: "Turning Point #1: Did any city fall to population 0?",
        context:
          "Card 01-06 permanently transforms zero-population cities into Forsaken Cities (Doors A & 12).",
        options: [
          {
            label: "Held every city above 0",
            detail: "Doors A & 12 stay sealed for now.",
            tone: "good",
            apply: { forsakenCity: false },
            active: (c) => !c.forsakenCity,
          },
          {
            label: "A city went dark (Forsaken)",
            detail: "Trigger Doors A & 12 and the Forsaken Cities set-piece.",
            tone: "danger",
            apply: { forsakenCity: true },
            active: (c) => c.forsakenCity,
          },
        ],
      },
      {
        id: "searchedAtlanta",
        prompt: "Did the crew search Atlanta (CDC Ruins)?",
        context:
          "Optional field search revealing what originally ended COdA and loosed the plague.",
        options: [
          {
            label: "Searched Atlanta",
            detail: "Trigger Dr. Tomas Renn’s CDC field report scene.",
            tone: "neutral",
            apply: { searchedAtlanta: true },
            active: (c) => c.searchedAtlanta,
          },
          {
            label: "Skipped Atlanta search",
            detail: "Move straight on to February.",
            tone: "neutral",
            apply: { searchedAtlanta: false },
            active: (c) => !c.searchedAtlanta,
          },
        ],
      },
    ],
  });

  if (choices.naRecon === "reconned") {
    opened.push(pkg(1), door("66"));
    push(1, "Jan", {
      id: "pkg-1-clean",
      act: "Package 1 · North America",
      kind: "seal",
      title: "North America Reconned — Package 1 Opened",
      subtitle: "Recon Report P1-01 · Door 66 · Decontamination Kit Saved",
      summary:
        "Kai’s scouts push inland across North America where the back-to-back pandemics began, securing Package 1 before the Hollow Men arrive.",
      seals: [pkg(1), door("66")],
      sceneId: "pkg:1",
      consequences: [
        { label: "North America mapped", tone: "good" },
        { label: "Decontamination Kit saved", tone: "good" },
      ],
    });
  }

  if (choices.searchedAtlanta) {
    push(1, "Jan", {
      id: "search-atlanta",
      act: "Field Search · Atlanta",
      kind: "story",
      title: "Ruins of the CDC",
      subtitle: "Atlanta City Card · Search Box Revealed",
      summary:
        "A group blew up the CDC, destroying the COdA virus—but unleashing the unstoppable plague that broke civilization.",
      sceneId: "search:atlanta:land",
    });
  }

  if (choices.forsakenCity) {
    incidents = Math.max(incidents, 2);
    opened.push(door("A"), door("12"));
    rules.push("forsaken");
    push(1, "Jan", {
      id: "door-a-forsaken",
      act: "Turning Point #1 · Triggered",
      kind: "seal",
      title: "Forsaken Cities — A City Goes Dark",
      subtitle: "Doors A & 12 Torn Open",
      summary:
        "Population hits zero. The last lamps on the coast blink out; the city becomes permanently forsaken and infested.",
      seals: [door("A"), door("12")],
      sceneId: "door:A",
      setPiece: "forsakenCities",
      consequences: [{ label: "Forsaken Cities rule active", tone: "danger" }],
    });
  }

  // === FEBRUARY ===
  if (choices.naRecon === "raided") {
    incidents = Math.max(incidents, 2);
    forced.push(pkg(1));
    opened.push(door("66"));
    push(2, "Feb", {
      id: "feb-02-01-raided",
      act: "February · Perimeter Report (BREACHED)",
      kind: "card",
      title: "North America Raided by Hollow Men",
      subtitle: "Legacy Card 02-01 · Package 1 Forced Open",
      summary:
        "Door 66 was still sealed—02-01 scratches open. Hollow Men beat the Havens inland, forcing Package 1 open and destroying the Decontamination Kit.",
      cardIds: ["02-01"],
      seals: [pkg(1)],
      sceneId: "02-01",
      consequences: [
        { label: "02-01 scratched", tone: "danger" },
        { label: "Decontamination Kit destroyed", tone: "danger" },
      ],
    });
  } else {
    push(2, "Feb", {
      id: "feb-02-01-clear",
      act: "February · Perimeter Report (CLEAR)",
      kind: "card",
      title: "Perimeter Report — North America Secured",
      subtitle: "Legacy Card 02-01 · Box Remains Unscratched",
      summary:
        "Because North America was reconned in January (Door 66 already open), the Hollow Men raid is averted and 02-01 stays clean.",
      cardIds: ["02-01"],
      consequences: [{ label: "Raid averted — 02-01 unscratched", tone: "good" }],
    });
  }

  turningPoints.push("losingStreak");
  push(2, "Feb", {
    id: "feb-deck",
    act: "February · Year 71",
    kind: "card",
    title: "The Raids Expand & Frontier Haven Archives",
    subtitle: "Legacy Cards 02-02 to 02-10",
    summary:
      "Hollow Men push toward South America hunting the cure labs. The Year 40 archive reveals how mainland distrust helped breach the frontier havens.",
    cardIds: ["02-02", "02-03", "02-04", "02-05", "02-06", "02-07", "02-08", "02-09", "02-10"],
    sceneId: "02-02",
  });

  // INFLECTION POINT 2 — South America & OPAL Lab
  push(2, "Feb", {
    id: "decision-sa",
    act: "Inflection Point · South America & Southern Labs",
    kind: "decision",
    title: "Race to South America & OPAL Laboratory",
    subtitle: "Decides March 03-01 warning, April 04-01 raid, Package 5, and OPAL Lab",
    summary:
      "Choose when the crew enters South America—and whether you search Buenos Aires to recruit the Immunologist from OPAL Lab.",
    decisions: [
      {
        id: "saRecon",
        prompt: "When did the crew Recon South America?",
        context: "Checks Door 67 in March (03-01 warning) and April (04-01 Hollow Men raid).",
        options: [
          {
            label: "Reconned in February (Early)",
            detail: "Package 5 opens immediately; both 03-01 and 04-01 stay clean.",
            tone: "good",
            apply: { saRecon: "feb" },
            active: (c) => c.saRecon === "feb",
          },
          {
            label: "Reconned in March (After Warning)",
            detail:
              "03-01 scratches a warning in March, then Package 5 opens cleanly before April’s raid.",
            tone: "warn",
            apply: { saRecon: "mar" },
            active: (c) => c.saRecon === "mar",
          },
          {
            label: "Missed Both — April Raid",
            detail: "03-01 warns AND 04-01 forces Package 5 open; Strategic Reserves is destroyed.",
            tone: "danger",
            apply: { saRecon: "raided" },
            active: (c) => c.saRecon === "raided",
          },
        ],
      },
      {
        id: "foundOpal",
        prompt: "Did you search Buenos Aires (OPAL Laboratory)?",
        context:
          "Unlocks Doors 18 & 20: Dr. Amaya Okafor / OPAL Immunologist joins and points toward PEARL at Lake Baikal.",
        options: [
          {
            label: "Found OPAL Lab",
            detail: "Recruit the Immunologist (Doors 18 & 20) and uncover Lake Baikal.",
            tone: "good",
            apply: { foundOpal: true },
            active: (c) => c.foundOpal,
          },
          {
            label: "Did not search Buenos Aires",
            detail: "Leave OPAL Lab undiscovered for now.",
            tone: "neutral",
            apply: { foundOpal: false },
            active: (c) => !c.foundOpal,
          },
        ],
      },
    ],
  });

  if (choices.saRecon === "feb") {
    opened.push(pkg(5), door("67"));
    push(2, "Feb", {
      id: "pkg-5-feb",
      act: "Package 5 · South America",
      kind: "seal",
      title: "South America Reconned Early — Package 5",
      subtitle: "Recon Report P5-01 · Door 67 · Strategic Reserves Saved",
      summary: "Dr. Tomas Renn follows rumors of the three Southern Hemisphere cure laboratories.",
      seals: [pkg(5), door("67")],
      sceneId: "pkg:5",
      consequences: [{ label: "Strategic Reserves saved", tone: "good" }],
    });
  }

  // === MARCH ===
  if (choices.saRecon !== "feb") {
    scratched.push("03-01:1");
    push(3, "Mar", {
      id: "mar-03-01-warn",
      act: "March · Perimeter Report (WARNING)",
      kind: "card",
      title: "South America Still Unexplored",
      subtitle: "Legacy Card 03-01 · Warning Scratched",
      summary:
        "Door 67 is still sealed. Scouts urgently warn to Recon South America before Hollow Men sabotage the labs.",
      cardIds: ["03-01"],
      sceneId: "03-01",
      consequences: [{ label: "03-01 warning scratched", tone: "warn" }],
    });
  } else {
    push(3, "Mar", {
      id: "mar-03-01-clear",
      act: "March · Perimeter Report (CLEAR)",
      kind: "card",
      title: "Perimeter Report — South America Already Open",
      subtitle: "Legacy Card 03-01 · Box Remains Unscratched",
      summary:
        "South America was already reconned in February, so March’s perimeter warning stays sealed.",
      cardIds: ["03-01"],
    });
  }

  push(3, "Mar", {
    id: "mar-deck",
    act: "March · Year 71",
    kind: "card",
    title: "The Fifty-Year Limit & PEARL’s Silence",
    subtitle: "Legacy Cards 03-02 to 03-05",
    summary:
      "Neither the four labs nor the havens’ supplies were ever designed to last past fifty years. PEARL was on the brink of a cure when it went dark.",
    cardIds: ["03-02", "03-03", "03-04", "03-05"],
    sceneId: "03-02",
  });

  epidemics = 5;
  incidents = Math.max(incidents, 3);
  opened.push(door("K"), door("24"), door("47"), door("E"));
  push(3, "Mar", {
    id: "mar-epidemics",
    act: "March Game End · Major Escalation",
    kind: "card",
    title: "The Plague Surges — 5 Epidemics Enter the Deck",
    subtitle: "Legacy Cards 03-06 to 03-11 · Doors K, 24, 47, E",
    summary:
      "Five Epidemic cards slide into the Player deck, sea-lane charting unlocks, and new character scars enter circulation.",
    cardIds: ["03-06", "03-07", "03-08", "03-09", "03-10", "03-11"],
    seals: [door("K"), door("24"), door("47"), door("E")],
    sceneId: "03-06",
    setPiece: "epidemicsArrive",
    consequences: [{ label: "5 Epidemics added to Player deck", tone: "danger" }],
  });

  if (choices.saRecon === "mar") {
    opened.push(pkg(5), door("67"));
    push(3, "Mar", {
      id: "pkg-5-mar",
      act: "Package 5 · South America",
      kind: "seal",
      title: "South America Reconned in March — Package 5",
      subtitle: "Recon Report P5-01 · Door 67 · Strategic Reserves Saved",
      summary: "Just ahead of April’s raid, the crew opens South America and secures Package 5.",
      seals: [pkg(5), door("67")],
      sceneId: "pkg:5",
      consequences: [{ label: "Strategic Reserves saved", tone: "good" }],
    });
  }

  if (choices.foundOpal) {
    opened.push(door("18"), door("20"));
    rules.push("labBreakthroughs");
    push(3, "Mar", {
      id: "opal-lab",
      act: "Buenos Aires · OPAL Laboratory",
      kind: "seal",
      title: "OPAL Lab Found — The Immunologist Joins",
      subtitle: "Doors 18 & 20 · First Lead on PEARL at Lake Baikal",
      summary:
        "Continuing her grandfather’s work, Dr. Amaya Okafor brings OPAL’s breakthrough and reveals where PEARL stood: Lake Baikal.",
      seals: [door("18"), door("20")],
      sceneId: "door:18",
      consequences: [
        { label: "OPAL Lab breakthrough active", tone: "good" },
        { label: "Lake Baikal named as PEARL site", tone: "neutral" },
      ],
    });
  }

  // === APRIL ===
  if (choices.saRecon === "raided") {
    incidents = Math.max(incidents, 4);
    forced.push(pkg(5));
    opened.push(door("67"));
    push(4, "Apr", {
      id: "apr-04-01-raided",
      act: "April · Perimeter Report (BREACHED)",
      kind: "card",
      title: "South America Raided by Hollow Men",
      subtitle: "Legacy Card 04-01 · Package 5 Forced Open",
      summary:
        "Door 67 was still sealed. Hollow Men pillage South America—Package 5 opens without Strategic Reserves.",
      cardIds: ["04-01"],
      seals: [pkg(5)],
      sceneId: "04-01",
      consequences: [{ label: "Strategic Reserves destroyed", tone: "danger" }],
    });
  } else {
    push(4, "Apr", {
      id: "apr-04-01-clear",
      act: "April · Perimeter Report (CLEAR)",
      kind: "card",
      title: "Perimeter Report — South America Held",
      subtitle: "Legacy Card 04-01 · Box Remains Unscratched",
      summary: "Door 67 is open, keeping April’s Perimeter Report intact and unscratched.",
      cardIds: ["04-01"],
    });
  }

  opened.push(door("42"));
  push(4, "Apr", {
    id: "apr-deck",
    act: "April · Year 71",
    kind: "card",
    title: "The Torn Coordinates — Lost Havens & Four Labs",
    subtitle: "Legacy Cards 04-02 · 04-03",
    summary:
      "Year 42 records Pacific Haven and Indian Haven falling silent—pinned with torn handwritten coordinates for JADE, OPAL, TOPAZ, and half a line for PEARL.",
    cardIds: ["04-02", "04-03"],
    seals: [door("42")],
    sceneId: "04-02",
  });

  // INFLECTION POINT 3 — Pacific Lost Haven & Europe / Frankfurt
  push(4, "Apr", {
    id: "decision-apr",
    act: "Inflection Point · Pacific Haven & Fate of Frankfurt",
    kind: "decision",
    title: "Ghost Haven Discovery & Europe Recon",
    subtitle: "Decides Package 6 timing and whether Frankfurt survives June",
    summary:
      "Choose whether you located the Eastern Pacific ghost haven via coastal sea search—and whether you reach Europe before June’s Hollow Men terror.",
    decisions: [
      {
        id: "pacificHaven",
        prompt: "When did the crew locate the Eastern Pacific Lost Haven?",
        context: "Controls May 05-01 Perimeter Report and when Package 6 Inoculation unlocks.",
        options: [
          {
            label: "Found Early via Sea Search (LA / SF / Lima)",
            detail: "Unlock Package 6 & Inoculation early; May 05-01 stays clean.",
            tone: "good",
            apply: { pacificHaven: "early" },
            active: (c) => c.pacificHaven === "early",
          },
          {
            label: "Found in May via Old Haven Records (05-01)",
            detail: "May 05-01 scratches open and reveals Door 60 → Package 6.",
            tone: "warn",
            apply: { pacificHaven: "may_report" },
            active: (c) => c.pacificHaven === "may_report",
          },
        ],
      },
      {
        id: "europeRecon",
        prompt: "Will the crew Recon Europe before June?",
        context:
          "One of the biggest permanent map scars in Season 2: failing to recon Europe destroys Frankfurt forever (Door 21).",
        options: [
          {
            label: "Reconned Europe in Time — Save Frankfurt",
            detail:
              "Open Package 4 cleanly, keep Relocation, and keep Frankfurt standing on the map.",
            tone: "good",
            apply: { europeRecon: "reconned" },
            active: (c) => c.europeRecon === "reconned",
          },
          {
            label: "Failed to Recon — Reign of Terror Destroys Frankfurt",
            detail:
              "June 06-01 forces Package 4 open AND opens Door 21: Frankfurt is permanently obliterated!",
            tone: "danger",
            apply: { europeRecon: "frankfurt_destroyed" },
            active: (c) => c.europeRecon === "frankfurt_destroyed",
          },
        ],
      },
    ],
  });

  if (choices.pacificHaven === "early") {
    opened.push(door("60"), pkg(6));
    rules.push("storage");
    inoculationSafe = true;
    push(4, "Apr", {
      id: "pkg-6-early",
      act: "Package 6 · Eastern Pacific Lost Haven",
      kind: "seal",
      title: "The Ghost Haven & Inoculation Breakthrough",
      subtitle: "Door 60 · Package 6 · Produce Supplies + Inoculation Storage",
      summary:
        "A silent mirror of your own home floats empty in the Pacific—holding experimental medicine to inoculate cities inside Package 6 and 15 fresh supply cubes.",
      seals: [door("60"), pkg(6)],
      sceneId: "pkg:6",
      setPiece: "ghostHaven",
      consequences: [
        { label: "Package 6 Inoculation active", tone: "good" },
        { label: "Produce Supplies unlocked", tone: "good" },
      ],
    });
  }

  // === MAY ===
  if (choices.pacificHaven === "may_report") {
    forced.push(door("60"));
    opened.push(pkg(6));
    rules.push("storage");
    inoculationSafe = true;
    push(5, "May", {
      id: "may-05-01-report",
      act: "May · Perimeter Report (DISCOVERY)",
      kind: "card",
      title: "Records of a Fallen Haven → Package 6",
      subtitle: "Legacy Card 05-01 · Door 60 & Package 6 Opened",
      summary:
        "Twenty-five-year-old records pinpoint the fallen Pacific haven and its experimental inoculation technology.",
      cardIds: ["05-01"],
      seals: [door("60"), pkg(6)],
      sceneId: "pkg:6",
      setPiece: "ghostHaven",
      consequences: [{ label: "Package 6 Inoculation active", tone: "good" }],
    });
  } else {
    push(5, "May", {
      id: "may-05-01-clear",
      act: "May · Perimeter Report (CLEAR)",
      kind: "card",
      title: "Perimeter Report — Ghost Haven Already Found",
      subtitle: "Legacy Card 05-01 · Box Remains Unscratched",
      summary: "Door 60 was already open from your coastal sea search.",
      cardIds: ["05-01"],
    });
  }

  opened.push(door("31"), door("36"));
  push(5, "May", {
    id: "may-betrayal",
    act: "May · The Betrayal",
    kind: "card",
    title: "Why We Are Still Here — The November 5 Exodus",
    subtitle: "Legacy Cards 05-02 · 05-03 · November 5, Year 70",
    summary:
      'The missing Haven leaders were never ambushed. They made a list of the "best and brightest," took the soldiers and gear, and marched away toward Utopia—leaving everyone else behind to die.',
    cardIds: ["05-02", "05-03"],
    seals: [door("31"), door("36")],
    sceneId: "05-02",
    setPiece: "betrayal",
    consequences: [{ label: "Haven leadership betrayal revealed", tone: "danger" }],
  });

  if (choices.europeRecon === "reconned") {
    opened.push(pkg(4), door("64"));
    push(5, "May", {
      id: "pkg-4-clean",
      act: "Package 4 · Europe",
      kind: "seal",
      title: "Europe Reconned — Wings Over the Old Continent",
      subtitle: "Recon Report P4-01 · Door 64 · Frankfurt Spared",
      summary:
        "Kai’s crew discovers functioning aircraft on old European airfields, enabling air-shuttle runways between supply centers and havens.",
      seals: [pkg(4), door("64")],
      sceneId: "pkg:4",
      consequences: [
        { label: "Frankfurt survives intact", tone: "good" },
        { label: "Relocation saved", tone: "good" },
      ],
    });
  }

  // === JUNE ===
  if (choices.europeRecon === "frankfurt_destroyed") {
    incidents = Math.max(incidents, 5);
    forced.push(pkg(4));
    opened.push(door("64"), door("21"));
    push(6, "Jun", {
      id: "jun-06-01-frankfurt",
      act: "June · Catastrophe (DOOR 21)",
      kind: "card",
      title: "Reign of Terror — Frankfurt Destroyed Forever",
      subtitle: "Legacy Card 06-01 · Package 4 Forced & Door 21 Torn Open",
      summary:
        "Europe was left unguarded too long. Hollow Men burn Frankfurt off the map—destroying every Frankfurt Player & Infection card permanently.",
      cardIds: ["06-01"],
      seals: [pkg(4), door("21")],
      sceneId: "door:21",
      setPiece: "frankfurtDestroyed",
      consequences: [
        { label: "Frankfurt permanently obliterated", tone: "danger" },
        { label: "Relocation destroyed", tone: "danger" },
      ],
    });
  } else {
    push(6, "Jun", {
      id: "jun-06-01-clear",
      act: "June · Perimeter Report (CLEAR)",
      kind: "card",
      title: "Perimeter Report — Europe Held, Frankfurt Safe",
      subtitle: "Legacy Card 06-01 · Box Remains Unscratched",
      summary: "Door 64 is already open—Frankfurt is spared from the Hollow Men reign of terror.",
      cardIds: ["06-01"],
      consequences: [{ label: "Door 21 never opens — Frankfurt safe", tone: "good" }],
    });
  }

  opened.push(door("44"), door("49"));
  push(6, "Jun", {
    id: "jun-deck",
    act: "June · Year 71",
    kind: "card",
    title: 'Utopia, "Violent Souls" & New Volunteers',
    subtitle: "Legacy Cards 06-02 to 06-05 · Doors 44 & 49",
    summary:
      'Year 14 archives reveal Military Director Yona naming the "Hollow Men." At month’s end, the Sanitation Officer and Captain volunteer to join the crew.',
    cardIds: ["06-02", "06-03", "06-04", "06-05"],
    seals: [door("44"), door("49")],
    sceneId: "06-02",
  });

  // INFLECTION POINT 4 — Africa & JADE Lab
  push(6, "Jun", {
    id: "decision-africa",
    act: "Inflection Point · Africa & JADE Production Lab",
    kind: "decision",
    title: "Africa Recon & Johannesburg Search",
    subtitle: "Decides Package 7, July 07-01 raid, and JADE Lab recruitment",
    summary:
      "Choose whether the crew opens Africa before July and finds the surviving JADE scientist in Johannesburg.",
    decisions: [
      {
        id: "africaRecon",
        prompt: "Did the crew Recon Africa before July?",
        context: "July’s Perimeter Report (07-01) checks Door 57.",
        options: [
          {
            label: "Reconned Africa Cleanly",
            detail: "Open Package 7, save TOPAZ Experimental Vaccine, and unlock Satellite Towers.",
            tone: "good",
            apply: { africaRecon: "reconned" },
            active: (c) => c.africaRecon === "reconned",
          },
          {
            label: "Missed Africa — July Raid",
            detail:
              "07-01 scratches open; Package 7 is forced open and TOPAZ Experimental Vaccine is lost.",
            tone: "danger",
            apply: { africaRecon: "raided" },
            active: (c) => c.africaRecon === "raided",
          },
        ],
      },
      {
        id: "foundJade",
        prompt: "Did you search Johannesburg (JADE Laboratory)?",
        context: "Reveals the working cure mass-production facility needed for December’s finale.",
        options: [
          {
            label: "Found JADE Lab (Door 46)",
            detail: "Recruit the Scientist and confirm JADE can mass-produce PEARL’s cure.",
            tone: "good",
            apply: { foundJade: true },
            active: (c) => c.foundJade,
          },
          {
            label: "Skipped Johannesburg search",
            detail: "Keep moving toward the Middle East.",
            tone: "neutral",
            apply: { foundJade: false },
            active: (c) => !c.foundJade,
          },
        ],
      },
    ],
  });

  if (choices.africaRecon === "reconned") {
    opened.push(pkg(7), door("57"));
    push(6, "Jun", {
      id: "pkg-7-clean",
      act: "Package 7 · Africa",
      kind: "seal",
      title: "Africa Reconned — Towers Across the Brink",
      subtitle: "Recon Report P7-01 · Door 57 · TOPAZ Vaccine Saved",
      summary:
        "Vermin carry plague through abandoned southern routes, but old satellite towers still stand ready to broadcast across the grid.",
      seals: [pkg(7), door("57")],
      sceneId: "pkg:7",
      consequences: [{ label: "TOPAZ Experimental Vaccine saved", tone: "good" }],
    });
  }

  if (choices.foundJade) {
    opened.push(door("46"));
    push(6, "Jun", {
      id: "jade-lab",
      act: "Johannesburg · JADE Laboratory",
      kind: "seal",
      title: "JADE Production Facility Discovered",
      subtitle: "Johannesburg Search · Door 46",
      summary:
        "A second-generation scientist keeps JADE’s mass-production equipment alive: bring a supply center and the PEARL sample, and humanity can be cured.",
      seals: [door("46")],
      sceneId: "door:46",
    });
  }

  // === JULY ===
  if (choices.africaRecon === "raided") {
    forced.push(pkg(7));
    opened.push(door("57"));
    push(7, "Jul", {
      id: "jul-07-01-raided",
      act: "July · Perimeter Report (BREACHED)",
      kind: "card",
      title: "Africa Raided by Hollow Men",
      subtitle: "Legacy Card 07-01 · Package 7 Forced Open",
      summary:
        "Hollow Men hit Africa first; Package 7 opens with the TOPAZ Experimental Vaccine destroyed.",
      cardIds: ["07-01"],
      seals: [pkg(7)],
      sceneId: "07-01",
      consequences: [{ label: "TOPAZ Experimental Vaccine destroyed", tone: "danger" }],
    });
  } else {
    push(7, "Jul", {
      id: "jul-07-01-clear",
      act: "July · Perimeter Report (CLEAR)",
      kind: "card",
      title: "Perimeter Report — Africa Secured",
      subtitle: "Legacy Card 07-01 · Box Remains Unscratched",
      summary: "Door 57 is already open; Africa’s raid is prevented.",
      cardIds: ["07-01"],
    });
  }

  push(7, "Jul", {
    id: "jul-deck",
    act: "July · Year 71",
    kind: "card",
    title: "Signals in the Static — Are Hollow Men Taking Orders?",
    subtitle: "Legacy Cards 07-02 · 07-03",
    summary:
      "Satellite towers pick up coded transmissions. Mara wonders if forsaking cities makes them the monsters the world thinks they are; Year 38’s archivist dreams of walking on dirt again.",
    cardIds: ["07-02", "07-03"],
    sceneId: "07-02",
  });

  // INFLECTION POINT 5 — Middle East, Hollow Men & Signal Triangulation
  push(7, "Jul", {
    id: "decision-me",
    act: "Inflection Point · Middle East & Hollow Men",
    kind: "decision",
    title: "Middle East Recon, Triangulation & New Mumbai",
    subtitle: "Decides Package 2 timing, Signal Triangulation (Door 35), and New Mumbai encounter",
    summary:
      "Choose whether the crew enters the Middle East cleanly, triangulates the Hollow Men frequencies, and witnesses the quiet Hollow Man in New Mumbai.",
    decisions: [
      {
        id: "meRecon",
        prompt: "Did the crew Recon the Middle East before August?",
        context: "August’s Perimeter Report (08-01) checks Door 62.",
        options: [
          {
            label: "Reconned Middle East Cleanly",
            detail:
              "Open Package 2 cleanly, save Renewal, and face the Hollow Men on your own terms.",
            tone: "good",
            apply: { meRecon: "reconned" },
            active: (c) => c.meRecon === "reconned",
          },
          {
            label: "Missed Middle East — August Raid",
            detail: "08-01 forces Package 2 open and destroys Renewal.",
            tone: "danger",
            apply: { meRecon: "raided" },
            active: (c) => c.meRecon === "raided",
          },
        ],
      },
      {
        id: "triangulated",
        prompt: "Did you complete Triangulate Signals (Blue + Yellow + Black towers)?",
        context:
          "Opens Door 35, revealing the exact Hollow Men broadcast frequencies: 9.2, 9.31, and 11.88.",
        options: [
          {
            label: "Triangulated Signals (Door 35)",
            detail: "Identify frequencies 9.2, 9.31, and 11.88 to decode patrol routes in August.",
            tone: "good",
            apply: { triangulated: true },
            active: (c) => c.triangulated,
          },
          {
            label: "Skipped Triangulation",
            detail: "Sweep frequencies blind when the scanner activates.",
            tone: "warn",
            apply: { triangulated: false },
            active: (c) => !c.triangulated,
          },
        ],
      },
      {
        id: "searchedMumbai",
        prompt: "Did you search New Mumbai?",
        context:
          "One of the most haunting quiet clues in Season 2 about who the Hollow Men really are.",
        options: [
          {
            label: "Searched New Mumbai",
            detail: "Witness the Hollow Man sketching a family by the water, crying silently.",
            tone: "neutral",
            apply: { searchedMumbai: true },
            active: (c) => c.searchedMumbai,
          },
          {
            label: "Skipped New Mumbai",
            detail: "Move straight on to August.",
            tone: "neutral",
            apply: { searchedMumbai: false },
            active: (c) => !c.searchedMumbai,
          },
        ],
      },
    ],
  });

  if (choices.meRecon === "reconned") {
    hollowPresent = true;
    incidents = Math.max(incidents, 4);
    opened.push(pkg(2), door("62"));
    push(7, "Jul", {
      id: "pkg-2-clean",
      act: "Package 2 · Middle East & South Asia",
      kind: "seal",
      title: "The Hollow Men Arrive on the Board",
      subtitle: "Recon Report P2-01 · Door 62 · Renewal Saved",
      summary:
        "Locals whisper that Hollow Men release plague rats into cities. Hollow Men figures and Gather cards enter play for the first time.",
      seals: [pkg(2), door("62")],
      sceneId: "pkg:2",
      setPiece: "hollowMenArrive",
      consequences: [
        { label: "Hollow Men figures enter play", tone: "danger" },
        { label: "Renewal saved", tone: "good" },
      ],
    });
  }

  if (choices.triangulated) {
    opened.push(door("35"));
    push(7, "Jul", {
      id: "door-35-triangulate",
      act: "Signals Triangulated · Door 35",
      kind: "seal",
      title: "Frequencies 9.2, 9.31, and 11.88 Identified",
      subtitle: "Door 35 · What You Hear",
      summary:
        "Kai locks onto three active Hollow Men bands—ready to crack as soon as the towers finish calibrating in August.",
      seals: [door("35")],
      sceneId: "door:35",
    });
  }

  if (choices.searchedMumbai) {
    push(7, "Jul", {
      id: "search-mumbai",
      act: "Field Search · New Mumbai",
      kind: "story",
      title: "Down Near the Water",
      subtitle: "New Mumbai City Card · Search Box Revealed",
      summary:
        "A Hollow Man sits alone by the harbor sketching a mother, children, and himself—crying silently.",
      sceneId: "search:new-mumbai:land",
    });
  }

  // === AUGUST ===
  if (choices.meRecon === "raided") {
    hollowPresent = true;
    incidents = Math.max(incidents, 5);
    forced.push(pkg(2));
    opened.push(door("62"));
    push(8, "Aug", {
      id: "aug-08-01-raided",
      act: "August · Perimeter Report (BREACHED)",
      kind: "card",
      title: "Middle East Raided — Hollow Men Surge",
      subtitle: "Legacy Card 08-01 · Package 2 Forced Open",
      summary:
        "Door 62 was still sealed. Package 2 opens without Renewal, unleashing Hollow Men across the board.",
      cardIds: ["08-01"],
      seals: [pkg(2)],
      sceneId: "pkg:2",
      setPiece: "hollowMenArrive",
      consequences: [
        { label: "Renewal destroyed", tone: "danger" },
        { label: "Hollow Men enter play", tone: "danger" },
      ],
    });
  } else {
    push(8, "Aug", {
      id: "aug-08-01-clear",
      act: "August · Perimeter Report (CLEAR)",
      kind: "card",
      title: "Perimeter Report — Middle East Already Mapped",
      subtitle: "Legacy Card 08-01 · Box Remains Unscratched",
      summary: "Door 62 is open; August’s raid is avoided.",
      cardIds: ["08-01"],
    });
  }

  opened.push(door("M"), door("25"), door("29"), door("48"));
  if (choices.triangulated) {
    frequenciesUsed = [0, 2, 7];
    opened.push(door("52"), door("43"));
  }
  push(8, "Aug", {
    id: "aug-deck",
    act: "August · Frequency Scanner Online",
    kind: "card",
    title: "Listening to the Frequencies & PEARL’s Bacteriophage",
    subtitle: "Legacy Cards 08-02 to 08-05 · Monitor Action Unlocked",
    summary:
      "The Frequency Scanner activates. Year 48’s archive reveals PEARL’s final broadcast before vanishing: they had found the bacteriophage cure in sediment cores.",
    cardIds: ["08-02", "08-03", "08-04", "08-05"],
    seals: [door("M"), door("25")],
    sceneId: "08-02",
  });

  if (choices.triangulated) {
    push(8, "Aug", {
      id: "door-52-decoded",
      act: "Frequency 9.2 Decoded · Door 52",
      kind: "seal",
      title: "Patrol Routes Into East Asia Decoded",
      subtitle: "Doors 52 & 43 · Secret Kolkata Route Unlocked",
      summary:
        "Monitoring frequency 9.2 reveals Hollow Men patrol gaps into East Asia (5 unique black cards from a Kolkata supply center), and 11.88 yields the Decryption Key.",
      seals: [door("52"), door("43")],
      sceneId: "door:52",
    });
  }

  // INFLECTION POINT 6 — Indian Ocean Lost Haven
  push(8, "Aug", {
    id: "decision-indian",
    act: "Inflection Point · Indian Ocean Lost Haven",
    kind: "decision",
    title: "The Second Lost Haven",
    subtitle: "Decides September 09-01 Perimeter Report & Door 11",
    summary:
      "Choose whether the crew located the Indian Ocean haven via sea search or September’s perimeter report.",
    decisions: [
      {
        id: "indianHaven",
        prompt: "When did the crew find the Indian Ocean Lost Haven?",
        context:
          "September 09-01 checks Door 65; arriving opens Door 11 (+15 supply cubes every month!).",
        options: [
          {
            label: "Found Early via Sea Search (Door 65 → Door 11)",
            detail: "Secure the hidden supply room early; September 09-01 stays unscratched.",
            tone: "good",
            apply: { indianHaven: "early" },
            active: (c) => c.indianHaven === "early",
          },
          {
            label: "Located by Scouts in September (09-01)",
            detail: "September 09-01 scratches open to reveal Door 65.",
            tone: "warn",
            apply: { indianHaven: "sep_report" },
            active: (c) => c.indianHaven === "sep_report",
          },
        ],
      },
    ],
  });

  if (choices.indianHaven === "early") {
    opened.push(door("65"), door("11"));
    push(8, "Aug", {
      id: "door-11-early",
      act: "Indian Ocean Lost Haven · Door 11",
      kind: "seal",
      title: "Renewed Hope — Locked Supply Hold Found",
      subtitle: "Doors 65 & 11 · +15 Supply Cubes Permanently",
      summary:
        "Inside the silent Indian Ocean haven waits an untouched storage hold—giving the crew hope for the final stretch.",
      seals: [door("65"), door("11")],
      sceneId: "door:11",
      consequences: [{ label: "+15 Supply cubes permanently", tone: "good" }],
    });
  }

  // === SEPTEMBER ===
  if (choices.indianHaven === "sep_report") {
    forced.push(door("65"));
    opened.push(door("11"));
    push(9, "Sep", {
      id: "sep-09-01",
      act: "September · Perimeter Report",
      kind: "card",
      title: "Another Lost Haven Sighted",
      subtitle: "Legacy Card 09-01 · Door 65 Scratched Open",
      summary: "Scouts finally sight the lost Indian Ocean haven; Door 65 opens on the map.",
      cardIds: ["09-01"],
      seals: [door("65")],
      sceneId: "09-01",
    });
  } else {
    push(9, "Sep", {
      id: "sep-09-01-clear",
      act: "September · Perimeter Report (CLEAR)",
      kind: "card",
      title: "Perimeter Report — Indian Haven Already Found",
      subtitle: "Legacy Card 09-01 · Box Remains Unscratched",
      summary: "Door 65 is already open from your earlier sea search.",
      cardIds: ["09-01"],
    });
  }

  push(9, "Sep", {
    id: "sep-journal",
    act: "September · Year 71",
    kind: "card",
    title: "Tendrils of Despair — Is Utopia Holding PEARL Hostage?",
    subtitle: "Legacy Card 09-02 · Archive April 15, Year 44",
    summary:
      'The year is running out and PEARL is humanity’s last chance. Year 44’s archivist asks: "Is someone so depraved that they would let us all die?"',
    cardIds: ["09-02"],
    sceneId: "09-02",
  });

  // SEPTEMBER 09-03 — THE SIGNATURE "2-IT'S WEARING OFF" SET-PIECE!
  inoculationSafe = false;
  wearingOff = true;
  incidents = Math.max(incidents, 6);
  opened.push(door("R"), door("55"), door("D"), door("Y"), door("U"), door("33"));
  rules.push("epidemicFromStorage", "hollowSetup");
  push(9, "Sep", {
    id: "sep-wearing-off",
    act: "September · CRITICAL CRISIS",
    kind: "card",
    title: "2-It's Wearing Off — Every Epidemic Card Overwritten",
    subtitle: "Legacy Cards 09-03 to 09-06 · Doors R, 55, D, Y, U",
    summary:
      'Inoculation collapses! Pull all 5 Epidemic cards from the Player deck and slap the "2-It\'s wearing off" sticker over Step 2—every Epidemic now drags inoculated cities straight back out of Package 6!',
    cardIds: ["09-03", "09-04", "09-05", "09-06"],
    seals: [door("R"), door("55"), door("D"), door("Y"), door("U")],
    sceneId: "09-03",
    setPiece: "wearingOff",
    consequences: [
      { label: "All 5 Epidemics taped: 2-It's wearing off", tone: "danger" },
      { label: "Hollow Men hit setup cities", tone: "danger" },
    ],
  });

  // INFLECTION POINT 7 — East Asia & Shanghai Massacre
  push(9, "Sep", {
    id: "decision-asia",
    act: "Inflection Point · East Asia & Outside Utopia’s Walls",
    kind: "decision",
    title: "East Asia Recon & Shanghai Search",
    subtitle: "Decides Package 3, October 10-01 scar, and the fate of the Haven leaders",
    summary:
      "Choose whether you slip past the patrols into East Asia before October—and whether you search Shanghai right outside Utopia’s gates.",
    decisions: [
      {
        id: "asiaRecon",
        prompt: "Did the crew Recon East Asia in September?",
        context:
          "October 10-01 checks Doors 56 & 63. Failing forces Package 3 open and scars a character.",
        options: [
          {
            label: "Reconned East Asia Cleanly",
            detail: "Open Package 3, save Biodome Prototype, and avoid October’s forced scar.",
            tone: "good",
            apply: { asiaRecon: "reconned" },
            active: (c) => c.asiaRecon === "reconned",
          },
          {
            label: "Desperate Strike in October (10-01)",
            detail:
              "Package 3 forced open, Biodome Prototype destroyed, and 1 crew member takes a scar.",
            tone: "danger",
            apply: { asiaRecon: "raided" },
            active: (c) => c.asiaRecon === "raided",
          },
        ],
      },
      {
        id: "searchedShanghai",
        prompt: "Did the crew search Shanghai?",
        context:
          "Finally answers what happened to the Haven leaders who abandoned everyone in November Year 70.",
        options: [
          {
            label: "Searched Shanghai (The Massacre)",
            detail:
              "Find the Haven leaders shot unburied outside Utopia’s walls. Triggers Shanghai Massacre set-piece.",
            tone: "danger",
            apply: { searchedShanghai: true },
            active: (c) => c.searchedShanghai,
          },
          {
            label: "Skipped Shanghai search",
            detail: "Leave the Haven leaders’ fate unconfirmed.",
            tone: "neutral",
            apply: { searchedShanghai: false },
            active: (c) => !c.searchedShanghai,
          },
        ],
      },
    ],
  });

  if (choices.asiaRecon === "reconned") {
    opened.push(pkg(3), door("56"), door("63"));
    push(9, "Sep", {
      id: "pkg-3-clean",
      act: "Package 3 · East Asia",
      kind: "seal",
      title: "The Walled City of Utopia",
      subtitle: "Recon Report P3-01 · Doors 56 & 63 · Biodome Saved",
      summary:
        "Instead of thriving cities, East Asia huddles in shelters beneath the shadow of walled-off Utopia—the true origin of every November wave of Hollow Men.",
      seals: [pkg(3), door("56"), door("63")],
      sceneId: "pkg:3",
      consequences: [{ label: "Biodome Prototype saved", tone: "good" }],
    });
  }

  if (choices.searchedShanghai) {
    push(9, "Sep", {
      id: "search-shanghai",
      act: "Field Search · Shanghai",
      kind: "story",
      title: "Outside the Walls of Utopia",
      subtitle: "Shanghai City Card · Search Box Revealed",
      summary:
        "We found the Haven leaders. Dead. Unburied. Shot outside the walls of Utopia where they petitioned to get in. Utopia accepts no outsiders. Utopia leaves no survivors.",
      sceneId: "search:shanghai:land",
      setPiece: "shanghaiMassacre",
      consequences: [{ label: "Haven leaders confirmed executed", tone: "danger" }],
    });
  }

  // === OCTOBER ===
  if (choices.asiaRecon === "raided") {
    forced.push(pkg(3));
    opened.push(door("56"), door("63"));
    push(10, "Oct", {
      id: "oct-10-01-raided",
      act: "October · Perimeter Report (COSTLY STRIKE)",
      kind: "card",
      title: "Desperate Strike Into Asia",
      subtitle: "Legacy Card 10-01 · Package 3 Forced & Crew Scarred",
      summary:
        "A desperate push cracks East Asia at great cost: Biodome Prototype is lost and one character takes a scar.",
      cardIds: ["10-01"],
      seals: [pkg(3)],
      sceneId: "10-01",
      consequences: [
        { label: "Biodome Prototype destroyed", tone: "danger" },
        { label: "1 character scarred", tone: "danger" },
      ],
    });
  } else {
    push(10, "Oct", {
      id: "oct-10-01-clear",
      act: "October · Perimeter Report (CLEAR)",
      kind: "card",
      title: "Perimeter Report — East Asia Already Reached",
      subtitle: "Legacy Card 10-01 · Box Remains Unscratched",
      summary: "Doors 56 & 63 are open; no desperate strike or forced scar needed.",
      cardIds: ["10-01"],
    });
  }

  opened.push(door("P"), door("37"), door("28"), door("45"));
  turningPoints.push("defection");
  push(10, "Oct", {
    id: "oct-deck",
    act: "October · Turning Their Signal Against Them",
    kind: "card",
    title: "Broadcast Misinformation & Year 1’s Cry in the Dark",
    subtitle: "Legacy Cards 10-02 to 10-07 · Doors P & 37",
    summary:
      "Hijack the satellite network to lure Hollow Men onto three havens and break Utopia’s conditioning. Year 1’s first-generation archive remembers children crying for the homes they left behind.",
    cardIds: ["10-02", "10-03", "10-04", "10-05", "10-06", "10-07"],
    seals: [door("P"), door("37")],
    sceneId: "10-02",
  });

  // INFLECTION POINT 8 — Hollow Men Defection
  push(10, "Oct", {
    id: "decision-defect",
    act: "Inflection Point · Hollow Men Defection",
    kind: "decision",
    title: "Can You Break Utopia’s Conditioning?",
    subtitle: "Decides Door 17 timing & November 11-01 two-scar penalty",
    summary: "Choose whether the crew lured Hollow Men onto three different havens during October.",
    decisions: [
      {
        id: "hollowDefect",
        prompt: "Did Hollow Men defect cleanly in October?",
        context: "Opens Door 17 — the stunning revelation of who the Faded really are.",
        options: [
          {
            label: "Turned Cleanly in October (Turning Point #3)",
            detail: "Open Door 17 without penalty; November 11-01 stays unscratched.",
            tone: "good",
            apply: { hollowDefect: "october" },
            active: (c) => c.hollowDefect === "october",
          },
          {
            label: "Turned at Great Cost in November (11-01)",
            detail: "November 11-01 forces Door 17 open and inflicts scars on TWO crew members.",
            tone: "danger",
            apply: { hollowDefect: "november_cost" },
            active: (c) => c.hollowDefect === "november_cost",
          },
        ],
      },
    ],
  });

  if (choices.hollowDefect === "october") {
    opened.push(door("17"), door("58"));
    push(10, "Oct", {
      id: "door-17-clean",
      act: "Turning Point #3 · THE TWIST",
      kind: "seal",
      title: "An Exchange of Secrets — We Are the Faded",
      subtitle: "Door 17 & Door 58 · Vey Defects",
      summary:
        "Face to face with a defected Hollow Man named Vey, the truth comes out: the haven dwellers ARE the Faded from COdA—quarantined at sea, cured in mind but forever pale-skinned, hated by the world they kept alive for 70 years.",
      seals: [door("17"), door("58")],
      sceneId: "door:17",
      setPiece: "fadedTruth",
      consequences: [{ label: "The Faded truth revealed · Vey joins", tone: "good" }],
    });
  }

  // === NOVEMBER ===
  if (choices.hollowDefect === "november_cost") {
    forced.push(door("17"));
    opened.push(door("58"));
    push(11, "Nov", {
      id: "nov-11-01-cost",
      act: "November · Intelligence Report (GREAT COST)",
      kind: "card",
      title: "Turned at Great Cost — Door 17 Forced Open",
      subtitle: "Legacy Card 11-01 · Two Characters Scarred",
      summary:
        "Defection succeeds only after bloody fighting: two characters take scars as Vey reveals the Faded truth.",
      cardIds: ["11-01"],
      seals: [door("17"), door("58")],
      sceneId: "door:17",
      setPiece: "fadedTruth",
      consequences: [{ label: "2 characters scarred", tone: "danger" }],
    });
  } else {
    push(11, "Nov", {
      id: "nov-11-01-clear",
      act: "November · Intelligence Report (CLEAR)",
      kind: "card",
      title: "Intelligence Report — Hollow Men Already Turned",
      subtitle: "Legacy Card 11-01 · Box Remains Unscratched",
      summary: "Door 17 is already open from October; your crew avoids the double scar.",
      cardIds: ["11-01"],
    });
  }

  planRecons =
    choices.utopiaBreach === "plan"
      ? ["hidden:plan-red", "hidden:plan-black", "hidden:plan-yellow", "hidden:plan-blue"]
      : ["hidden:plan-red", "hidden:plan-blue"];
  push(11, "Nov", {
    id: "nov-deck",
    act: "November · The Plan",
    kind: "card",
    title: "Our Prison Became Humanity’s Last Hope",
    subtitle: "Legacy Cards 11-02 to 11-05 · Four Steps to Breach Utopia",
    summary:
      "Year 10’s archive celebrates COdA’s vaccine turning a floating prison into humanity’s lifeline. With Vey’s insider intelligence, The Plan maps four strikes from Shanghai to crack Utopia open.",
    cardIds: ["11-02", "11-03", "11-04", "11-05"],
    sceneId: "11-02",
  });

  // INFLECTION POINT 9 — Breaching Utopia
  push(11, "Nov", {
    id: "decision-utopia",
    act: "Inflection Point · Breaching Utopia",
    kind: "decision",
    title: "Did The Plan Crack Utopia’s Gates?",
    subtitle: "Decides Package 8 & December 12-01 Hollow Men Uprising",
    summary: "Choose whether the crew completed all four boxes of The Plan in November.",
    decisions: [
      {
        id: "utopiaBreach",
        prompt: "Did you complete all 4 steps of The Plan in November?",
        context:
          "Completing The Plan opens Package 8 cleanly; failing triggers the December Hollow Men uprising.",
        options: [
          {
            label: "Completed The Plan (Package 8 Clean)",
            detail: "Breach Utopia in November, save Riot Control, and keep December 12-01 clean.",
            tone: "good",
            apply: { utopiaBreach: "plan" },
            active: (c) => c.utopiaBreach === "plan",
          },
          {
            label: "Plan Incomplete — Hollow Men Rise Up (12-01)",
            detail:
              "In December, the newly expelled Hollow Men revolt and tear open Utopia’s gates (Riot Control lost).",
            tone: "warn",
            apply: { utopiaBreach: "uprising" },
            active: (c) => c.utopiaBreach === "uprising",
          },
        ],
      },
    ],
  });

  if (choices.utopiaBreach === "plan") {
    opened.push(pkg(8));
    push(11, "Nov", {
      id: "pkg-8-plan",
      act: "Package 8 · Inside Utopia",
      kind: "seal",
      title: "Hell on Earth — Utopia’s True Mission",
      subtitle: "Recon Report P8-01 · Package 8 · Riot Control Saved",
      summary:
        "Utopia is no sanctuary. For thirty years they held PEARL’s cure at gunpoint while sending their own exiled sons out every November to exterminate the Faded and inherit an empty earth.",
      seals: [pkg(8)],
      sceneId: "pkg:8",
      setPiece: "utopiaHell",
      consequences: [
        { label: "Utopia & Lake Baikal exposed", tone: "danger" },
        { label: "8 Utopia Infection cards added", tone: "danger" },
      ],
    });
  }

  // === DECEMBER ===
  if (choices.utopiaBreach === "uprising") {
    forced.push(pkg(8));
    push(12, "Dec", {
      id: "dec-12-01-uprising",
      act: "December · Perimeter Report (UPRISING)",
      kind: "card",
      title: "The Hollow Men Rise Up Against Utopia",
      subtitle: "Legacy Card 12-01 · Package 8 Forced Open",
      summary:
        "The November wave of Hollow Men revolts against their creators and blows Utopia’s gates wide open—Riot Control is lost in the chaos, and Hell on Earth is exposed.",
      cardIds: ["12-01"],
      seals: [pkg(8)],
      sceneId: "pkg:8",
      setPiece: "utopiaHell",
      consequences: [
        { label: "Hollow Men uprising breaches Utopia", tone: "warn" },
        { label: "Riot Control destroyed", tone: "danger" },
      ],
    });
  } else {
    push(12, "Dec", {
      id: "dec-12-01-clear",
      act: "December · Perimeter Report (CLEAR)",
      kind: "card",
      title: "Perimeter Report — Utopia Already Breached",
      subtitle: "Legacy Card 12-01 · Box Remains Unscratched",
      summary: "The Plan already cracked Utopia open in November.",
      cardIds: ["12-01"],
    });
  }

  incidents = 7;
  push(12, "Dec", {
    id: "dec-deck",
    act: "December · The Final Month",
    kind: "card",
    title: "Not With a Bang, But With a Whimper",
    subtitle: "Legacy Cards 12-02 · 12-03 · 12-04",
    summary:
      'December Year 70’s final leader note sneers "not with a bang, but with a whimper" as they march to Utopia—unaware they walked to their deaths. One last objective remains: Deliver the Sample.',
    cardIds: ["12-02", "12-03", "12-04"],
    sceneId: "12-02",
  });

  opened.push(door("22"), door("Q"), door("38"), door("27"), door("32"));
  rules.push("carrier");
  push(12, "Dec", {
    id: "door-22-pearl",
    act: "Lake Baikal · PEARL Laboratory",
    kind: "seal",
    title: "The Carrier Sacrifice — Four Doses Only",
    subtitle: "Doors 22, Q, 38, 27, 32 · Self-Infect Action Unlocked",
    summary:
      "Utopia patrols make carrying vials impossible. One hero must inject a lethal dose of the bacteriophage into their own bloodstream and sprint from Siberia to Johannesburg before the dose kills them.",
    seals: [door("22"), door("Q"), door("38")],
    sceneId: "door:22",
    setPiece: "selfInfect",
    consequences: [{ label: "Self-Infect (4 doses max) unlocked", tone: "warn" }],
  });

  // INFLECTION POINT 10 — THE FINAL RECKONING!
  push(12, "Finale", {
    id: "decision-finale",
    act: "Final Inflection Point · Fate of Humanity",
    kind: "decision",
    title: "Did the Carrier Reach Johannesburg?",
    subtitle:
      'Branches between 12-07 ("We Are Here to Stay") and 12-06 ("Please Remember Us") across all 10 score endings',
    summary:
      "Pick whether the Carrier delivered the PEARL sample to JADE—and slide across every Final Reckoning score bracket to read all 10 verbatim endings.",
    decisions: [
      {
        id: "sampleDelivered",
        prompt: "Was the PEARL sample delivered to JADE in Johannesburg?",
        context:
          "Determines whether the Faded survive alongside humanity—or perish leaving only Utopia behind.",
        options: [
          {
            label: "YES — Sample Delivered (12-07: We Are Here to Stay)",
            detail:
              "Cure production begins within days. Faded and non-Faded inherit the earth together.",
            tone: "good",
            apply: { sampleDelivered: true },
            active: (c) => c.sampleDelivered,
          },
          {
            label: "NO — Sample Lost (12-06: Please Remember Us)",
            detail:
              "The Faded will vanish from the havens. Only Utopia’s uninfected humans remain.",
            tone: "danger",
            apply: { sampleDelivered: false },
            active: (c) => !c.sampleDelivered,
          },
        ],
      },
      {
        id: "scoreBand",
        prompt: "Final Reckoning Score Bracket",
        context:
          "Every combination of delivery × score bracket unlocks a distinct printed ending epilogue.",
        options: [
          {
            label: "851 and above",
            detail: "Triumphant rebirth — highest Legacy score tier.",
            tone: "good",
            apply: { scoreBand: "851+" },
            active: (c) => c.scoreBand === "851+",
          },
          {
            label: "701–850",
            detail: "Civilization rekindled across surviving regions.",
            tone: "good",
            apply: { scoreBand: "701-850" },
            active: (c) => c.scoreBand === "701-850",
          },
          {
            label: "551–700",
            detail: "Hard-won recovery after heavy losses.",
            tone: "neutral",
            apply: { scoreBand: "551-700" },
            active: (c) => c.scoreBand === "551-700",
          },
          {
            label: "401–550",
            detail: "Near collapse — rioting and fragile hope.",
            tone: "warn",
            apply: { scoreBand: "401-550" },
            active: (c) => c.scoreBand === "401-550",
          },
          {
            label: "400 and below",
            detail: "A final note found in the ruins of North Atlantic Haven.",
            tone: "danger",
            apply: { scoreBand: "400-" },
            active: (c) => c.scoreBand === "400-",
          },
        ],
      },
    ],
  });

  sampleDelivered = choices.sampleDelivered;
  const tierIndex = SCORE_BAND_INDEX[choices.scoreBand];
  const tierData = ENDING_TIERS[choices.sampleDelivered ? "delivered" : "failed"][tierIndex]!;
  const tierCardId = choices.sampleDelivered
    ? tierIndex <= 1
      ? "12-11"
      : "12-12"
    : tierIndex <= 1
      ? "12-09"
      : "12-10";

  push(12, "Finale", {
    id: "finale-outcome",
    act: choices.sampleDelivered
      ? "Final Reckoning · Sample Delivered"
      : "Final Reckoning · Sample Not Delivered",
    kind: "ending",
    title: choices.sampleDelivered ? "We Are Here to Stay" : "Please Remember Us",
    subtitle: `Legacy Cards 12-05 · ${choices.sampleDelivered ? "12-07" : "12-06"} · 12-08 · ${tierCardId} · 12-13`,
    summary: tierData.text,
    cardIds: ["12-05", choices.sampleDelivered ? "12-07" : "12-06", "12-08", tierCardId, "12-13"],
    sceneId: choices.sampleDelivered ? "12-07" : "12-06",
    setPiece: "finalReckoning",
    endingText: {
      delivered: choices.sampleDelivered,
      bracket: tierData.label,
      text: tierData.text,
    },
    consequences: [
      {
        label: choices.sampleDelivered
          ? "Faded survive & cure produced"
          : "Faded perish · Utopia remains",
        tone: choices.sampleDelivered ? "good" : "danger",
      },
      {
        label: `Score tier: ${tierData.label}`,
        tone: tierIndex <= 1 ? "good" : tierIndex >= 3 ? "danger" : "neutral",
      },
    ],
  });

  return steps;
}

export function storySceneFor(step: ChronicleStep) {
  return step.sceneId ? (STORY_SCENES[step.sceneId] ?? null) : null;
}

export type WorldSummaryChip = {
  label: string;
  value: string;
  tone: "good" | "warn" | "danger" | "neutral";
  jumpToStepId: string;
};

/** Compact world-state chips that let the user see current timeline consequences and jump back to change any decision. */
export function worldSummary(choices: ChronicleChoices): WorldSummaryChip[] {
  return [
    {
      label: "North America",
      value: choices.naRecon === "reconned" ? "Reconned" : "Raided (02-01)",
      tone: choices.naRecon === "reconned" ? "good" : "danger",
      jumpToStepId: "decision-jan",
    },
    {
      label: "South America",
      value:
        choices.saRecon === "feb" ? "Feb" : choices.saRecon === "mar" ? "Mar" : "Raided (04-01)",
      tone: choices.saRecon === "raided" ? "danger" : choices.saRecon === "mar" ? "warn" : "good",
      jumpToStepId: "decision-sa",
    },
    {
      label: "Frankfurt",
      value: choices.europeRecon === "reconned" ? "Intact" : "Destroyed (Door 21)",
      tone: choices.europeRecon === "reconned" ? "good" : "danger",
      jumpToStepId: "decision-apr",
    },
    {
      label: "Africa",
      value: choices.africaRecon === "reconned" ? "Reconned" : "Raided (07-01)",
      tone: choices.africaRecon === "reconned" ? "good" : "danger",
      jumpToStepId: "decision-africa",
    },
    {
      label: "Middle East",
      value: choices.meRecon === "reconned" ? "Reconned" : "Raided (08-01)",
      tone: choices.meRecon === "reconned" ? "good" : "danger",
      jumpToStepId: "decision-me",
    },
    {
      label: "East Asia",
      value: choices.asiaRecon === "reconned" ? "Reconned" : "Costly Strike",
      tone: choices.asiaRecon === "reconned" ? "good" : "danger",
      jumpToStepId: "decision-asia",
    },
    {
      label: "Hollow Men",
      value: choices.hollowDefect === "october" ? "Defected Clean" : "Costly (2 Scars)",
      tone: choices.hollowDefect === "october" ? "good" : "danger",
      jumpToStepId: "decision-defect",
    },
    {
      label: "Utopia",
      value: choices.utopiaBreach === "plan" ? "Plan Complete" : "Hollow Uprising",
      tone: choices.utopiaBreach === "plan" ? "good" : "warn",
      jumpToStepId: "decision-utopia",
    },
    {
      label: "PEARL Sample",
      value: choices.sampleDelivered
        ? `Delivered (${choices.scoreBand})`
        : `Lost (${choices.scoreBand})`,
      tone: choices.sampleDelivered ? "good" : "danger",
      jumpToStepId: "decision-finale",
    },
  ];
}
