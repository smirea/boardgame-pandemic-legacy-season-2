import { pack, sealKey, unlockHeading } from "@repo/game";
import type {
  BriefedUnlock,
  LegacyCardDef,
  LegacyCardKind,
  Opening,
  RuleId,
  Seal,
  TurningPointId,
} from "@repo/game";
import { ACTION_NAMES } from "./labels.svelte.ts";

export type StowClass = "trash" | "infectionDeck" | "playerDeck" | "map" | "box" | "mechanic";
export const STOW_ORDER: StowClass[] = [
  "trash",
  "infectionDeck",
  "playerDeck",
  "map",
  "box",
  "mechanic",
];

/** Where a piece flies when the table puts the reading away: its class sets the order, `put` the `data-dest` marks to try. */
export type Stow = { cls: StowClass; put: string };

/** One thing a reading puts on the table, shown once. `tip` is what it means, read on hover. */
export type Piece =
  | { t: "card"; key: string; card: LegacyCardDef; tip: string; stow: Stow }
  | { t: "seal"; key: string; seal: Seal; tip: string; stow: Stow }
  | { t: "note"; key: string; title: string; text: string | null; tip: string; stow: Stow }
  | {
      t: "unlock";
      key: string;
      unlock: BriefedUnlock;
      name: string | null;
      tip: string;
      stow: Stow;
    };

export type Placed = { heading: string; piece: Piece };

function stowOf(unlock: BriefedUnlock): Stow {
  const to = (cls: StowClass, ...put: string[]): Stow => ({ cls, put: put.join(" ") });
  switch (unlock.t) {
    case "gather":
    case "assemble":
      return to("infectionDeck", "infectionDeck", "box");
    case "event":
      if (unlock.now?.[0] === "hand") return to("playerDeck", "hand", "playerDeck", "box");
      if (unlock.mode === "rationed") return to("box", "box");
      return to("playerDeck", "playerDeck", "box");
    case "epidemicCard":
      return to("playerDeck", "playerDeck", "box");
    case "lab":
    case "region":
    case "route":
    case "edge":
    case "haven":
    case "stockpileBonus":
    case "destroy":
    case "infest":
    case "forsake":
      return to("map", "map");
    case "action":
    case "actions":
      return to("mechanic", "actions", "box");
    case "frequencyHint":
      return to("mechanic", "scanner", "box");
    case "freeAbilityUnits":
      return to("mechanic", "hand", "box");
    case "turningPoint":
      return to("mechanic", "campaignStatus", "box");
    case "owedScar":
      return to("mechanic", "box");
    case "rule":
      if (unlock.rule === "storage" || unlock.rule === "epidemicFromStorage")
        return to("mechanic", "storage", "box");
      if (unlock.rule === "hollowSetup") return to("mechanic", "hollow", "infectionDeck", "box");
      return to("mechanic", "campaignStatus", "box");
    default:
      return to("box", "box");
  }
}

function cardStowOf(card: LegacyCardDef): Stow {
  switch (card.kind) {
    case "scanner":
      return { cls: "mechanic", put: "scanner box" };
    case "plan":
    case "objective":
      return { cls: "mechanic", put: "objectives box" };
    case "turningPoint":
      return { cls: "mechanic", put: "campaignStatus box" };
    case "epidemic":
      return { cls: "playerDeck", put: "playerDeck box" };
    case "event":
      return { cls: "box", put: "playerDeck box" };
    case "archive":
      return { cls: "box", put: "legacyDeck box" };
    default:
      return { cls: "trash", put: "trash" };
  }
}

const CARD_HEADING: Partial<Record<LegacyCardKind, string>> = {
  objective: "Objective cards",
  plan: "Objective cards",
  archive: "Journal entries",
  scanner: "Frequency Scanner",
};

/** The unlock a Legacy card is the piece for: an Event card is the event it adds, so the table shows it once. */
const CARD_IS: Partial<Record<LegacyCardKind, BriefedUnlock["t"]>> = {
  event: "event",
  epidemic: "epidemicCard",
  turningPoint: "turningPoint",
};

const RULE_NAME: Record<RuleId, string> = {
  forsaken: "Forsaken cities",
  epidemicScaling: "More Epidemics",
  hollowSetup: "Hollow Men at setup",
  epidemicFromStorage: "It’s wearing off",
  storage: "Package 6",
  carrier: "The carrier",
  labBreakthroughs: "Lab breakthroughs",
};

const TURNING_POINT_NAME: Record<TurningPointId, string> = {
  firstForsaken: "Forsaken Cities",
  losingStreak: "Give Us the Tools",
  defection: "Hollow Men Have Defected",
};

const cityName = (id: string) => pack.cities.find((city) => city.id === id)?.name ?? id;
const nameIn = (list: { id: string; name: string }[], id: string) =>
  list.find((entry) => entry.id === id)?.name ?? id;
const plus = (amount: number, what: string) => `+${amount} ${what}`;

/** The few words a piece that is no card carries under it; a card names itself. */
export function unlockName(unlock: BriefedUnlock): string | null {
  switch (unlock.t) {
    case "rule":
      return RULE_NAME[unlock.rule];
    case "action":
      return ACTION_NAMES[unlock.action];
    case "region":
      return nameIn(pack.regions, unlock.region);
    case "haven":
    case "lab":
    case "infest":
    case "forsake":
    case "destroy":
      return cityName(unlock.city);
    case "route": {
      const route = pack.reconRoutes.find((entry) => entry.id === unlock.route);
      return route ? cityName(route.city) : null;
    }
    case "edge":
      return `${cityName(unlock.edge.a)} – ${cityName(unlock.edge.b)}`;
    case "turningPoint":
      return TURNING_POINT_NAME[unlock.id];
    case "ability":
      return nameIn(pack.abilities, unlock.ability);
    case "scar":
      return nameIn(pack.scars, unlock.scar);
    case "job":
      return nameIn(pack.jobs, unlock.job);
    case "cityImprovement":
      return nameIn(pack.cityImprovements, unlock.improvement);
    case "infectionImprovement":
      return nameIn(pack.infectionImprovements, unlock.improvement);
    case "permanentStructure":
      return `Permanent ${unlock.structure}`;
    case "stockpileBonus":
      return plus(unlock.amount, "cubes");
    case "actions":
      return plus(unlock.amount, "actions");
    case "freeAbilityUnits":
      return plus(unlock.amount, "units");
    case "frequencyHint":
      return "Frequencies";
    case "owedScar":
      return "Scar owed";
    default:
      return null;
  }
}

export function legacyCardOf(opening: Opening): LegacyCardDef | null {
  if (opening.from.t === "legacy") {
    const id = opening.from.card;
    return pack.legacyDeck.find((card) => card.id === id) ?? null;
  }
  if (opening.from.t === "turningPoint")
    return pack.legacyDeck.find((card) => card.id === "02-06") ?? null;
  return null;
}

const sentence = (title: string, text: string | null) =>
  text ? `${title}${/[.!?]$/.test(title) ? "" : "."} ${text}` : title;

const sealName = (seal: Seal) => (seal.t === "package" ? `Package ${seal.id}` : `Door ${seal.id}`);

/**
 * Everything an opening puts on the table, each once and under its heading: the Legacy card, then its seals, then
 * what came out. The first is what the table opens: the card, else the package or door, else a note of the opening.
 */
export function piecesOf(opening: Opening, at: number): Placed[] {
  const placed: Placed[] = [];
  const items = opening.items.filter((item) => item.unlock.t !== "objectives");
  const card = legacyCardOf(opening);
  let same = -1;
  if (card) {
    const is = CARD_IS[card.kind];
    same = is ? items.findIndex((item) => item.unlock.t === is) : -1;
    const twin = items[same];
    placed.push({
      heading: twin ? unlockHeading(twin.unlock) : (CARD_HEADING[card.kind] ?? "Legacy cards"),
      piece: {
        t: "card",
        key: `${at}:card`,
        card,
        tip: twin?.text ?? sentence(opening.title, opening.text),
        stow: twin ? stowOf(twin.unlock) : cardStowOf(card),
      },
    });
  }
  if (!card && !opening.seals.length)
    placed.push({
      heading: "Notes",
      piece: {
        t: "note",
        key: `${at}:note`,
        title: opening.title,
        text: opening.text,
        tip: sentence(opening.title, opening.text),
        stow: { cls: "trash", put: "trash" },
      },
    });
  for (const seal of opening.seals)
    placed.push({
      heading: "Packages & doors",
      piece: {
        t: "seal",
        key: `${at}:${sealKey(seal)}`,
        seal,
        tip: sealName(seal),
        stow: { cls: "trash", put: "trash" },
      },
    });
  items.forEach((item, index) => {
    if (index === same) return;
    placed.push({
      heading: unlockHeading(item.unlock),
      piece: {
        t: "unlock",
        key: `${at}:${index}`,
        unlock: item.unlock,
        name: unlockName(item.unlock),
        tip: item.text,
        stow: stowOf(item.unlock),
      },
    });
  });
  return placed;
}
