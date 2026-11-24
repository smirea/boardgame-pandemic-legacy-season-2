import { pack, sealKey, unlockHeading } from "@repo/game";
import type { BriefedUnlock, DossierSlot, DossierView, Seal } from "@repo/game";
import { unlockName } from "../unboxPieces.ts";

/** The five things a package or door can hold, which is how the Box sorts and colours what came out of it. */
export type BoxKind = "rules" | "cards" | "people" | "map" | "upkeep";

export const BOX_KINDS: { id: BoxKind; label: string; color: string }[] = [
  { id: "rules", label: "Rules and actions", color: "#b07d16" },
  { id: "cards", label: "Cards", color: "#2f64a3" },
  { id: "people", label: "Characters", color: "#7a559c" },
  { id: "map", label: "The map", color: "#2f8f74" },
  { id: "upkeep", label: "Game end", color: "#bc5a27" },
];

export const kindColor = (kind: BoxKind) => BOX_KINDS.find((entry) => entry.id === kind)!.color;

const KIND: Record<BriefedUnlock["t"], BoxKind> = {
  objectives: "rules",
  action: "rules",
  rule: "rules",
  turningPoint: "rules",
  frequencyHint: "rules",
  actions: "rules",
  event: "cards",
  epidemicCard: "cards",
  gather: "cards",
  assemble: "cards",
  ability: "people",
  scar: "people",
  owedScar: "people",
  job: "people",
  lab: "map",
  region: "map",
  route: "map",
  edge: "map",
  haven: "map",
  infest: "map",
  forsake: "map",
  destroy: "map",
  cityImprovement: "upkeep",
  infectionImprovement: "upkeep",
  permanentStructure: "upkeep",
  freeAbilityUnits: "upkeep",
  stockpileBonus: "upkeep",
};

/** One thing a package or door held. */
export type BoxItem = {
  key: string;
  /** The seal it came out of. */
  from: string;
  kind: BoxKind;
  /** The heading a briefing announces it under, such as "New actions". */
  heading: string;
  unlock: BriefedUnlock;
  name: string | null;
  text: string;
  /** The text without the piece's own name in front, for where the name stands above it already. */
  words: string;
};

/** What a piece is called. A card has a name here too, where the Unboxing leaves it to the card's own face. */
function nameOf(unlock: BriefedUnlock): string | null {
  switch (unlock.t) {
    case "event":
      return pack.events.find((entry) => entry.id === unlock.event)!.name;
    case "gather":
      return `${unlock.cards} Gather cards`;
    case "assemble":
      return `${unlock.cards} Assemble cards`;
    case "epidemicCard":
      return "Epidemic";
    default:
      return unlockName(unlock);
  }
}

function wordsOf(name: string | null, text: string): string {
  if (!name || text.slice(0, name.length).toLowerCase() !== name.toLowerCase()) return text;
  const rest = text.slice(name.length);
  if (!/^[.,] ./.test(rest)) return text;
  return rest[2]!.toUpperCase() + rest.slice(3);
}

/** A package or door as the Box shows it. */
export type BoxSlot = {
  /** `package:3` or `door:13`, which is how everything here refers to it. */
  key: string;
  seal: Seal;
  /** "Package 3" or "Door 13". */
  label: string;
  open: boolean;
  forced: boolean;
  name: string | null;
  items: BoxItem[];
  /** The kinds of thing it held, in the Box's order. */
  kinds: BoxKind[];
  /** The seals it opened in turn, and the one that opened it, when another seal did. */
  opens: string[];
  openedBy: string | null;
  /** The dossier sheet a door is on, from 1. */
  sheet: number | null;
};

export type BoxContents = {
  packages: BoxSlot[];
  sheets: BoxSlot[][];
  slot: (key: string) => BoxSlot | undefined;
  /** Everything every open package and door held, in the order of the index. */
  items: BoxItem[];
};

function slotOf(seal: Seal, slot: DossierSlot<number | string>, sheet: number | null): BoxSlot {
  const key = sealKey(seal);
  const items = slot.items.map((item, index): BoxItem => {
    const name = nameOf(item.unlock);
    return {
      key: `${key}/${index}`,
      from: key,
      kind: KIND[item.unlock.t],
      heading: unlockHeading(item.unlock),
      unlock: item.unlock,
      name,
      text: item.text,
      words: wordsOf(name, item.text),
    };
  });
  return {
    key,
    seal,
    label: `${seal.t === "package" ? "Package" : "Door"} ${seal.id}`,
    open: slot.open,
    forced: slot.forced,
    name: slot.name,
    items,
    kinds: BOX_KINDS.map((entry) => entry.id).filter((kind) =>
      items.some((item) => item.kind === kind),
    ),
    opens: slot.opens.map(sealKey),
    openedBy: null,
    sheet,
  };
}

/** The engine's view of the box, with every piece sorted by kind and every seal linked to the ones it opened. */
export function boxContents(view: DossierView): BoxContents {
  const packages = view.packages.map((slot) => slotOf({ t: "package", id: slot.id }, slot, null));
  const sheets = view.sheets.map((sheet, index) =>
    sheet.map((slot) => slotOf({ t: "door", id: slot.id }, slot, index + 1)),
  );
  const all = [...packages, ...sheets.flat()];
  const byKey = new Map(all.map((slot) => [slot.key, slot]));
  for (const slot of all) for (const opened of slot.opens) byKey.get(opened)!.openedBy ??= slot.key;
  return {
    packages,
    sheets,
    slot: (key) => byKey.get(key),
    items: all.flatMap((slot) => slot.items),
  };
}

/** Items gathered under their headings, the headings of one kind together, in the Box's order of kinds. */
export function byHeading(
  items: BoxItem[],
): { heading: string; kind: BoxKind; items: BoxItem[] }[] {
  const groups = new Map<string, { heading: string; kind: BoxKind; items: BoxItem[] }>();
  for (const item of items) {
    const group = groups.get(item.heading) ?? { heading: item.heading, kind: item.kind, items: [] };
    group.items.push(item);
    groups.set(item.heading, group);
  }
  const order = BOX_KINDS.map((entry) => entry.id);
  return [...groups.values()].toSorted((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}
