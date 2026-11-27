import { pack } from "./content/pack";
import type { ActionId, RuleId, SearchResult, Seal, Unlock } from "./content/types";
import { sealKey } from "./content/types";
import type { BriefingEntry, BriefingSource, Campaign } from "./state";

/** One line on what each unlockable action does, as a briefing announces it under its New actions heading. */
export const actionBriefs: Partial<Record<ActionId, string>> = {
  recon:
    "Recon. In a marked city with a supply center, discard the cards its route asks for to reveal a region.",
  establishLine:
    "Supply Line. Spend 2 cubes from your character to join your city to a neighbouring one. Lines may not cross each other.",
  search:
    "Search. Holding a city's card while in that city, scratch one of the card's search boxes and take what it finds.",
  shuttle: "Shuttle Flight. Fly between havens and cities with a supply center.",
  buildTower: "Build Tower. Spend 2 cubes from your character to raise a tower in your city.",
  transmit: "Transmit. In a tower city, send a City card of that city's colour to any player.",
  buildShelter:
    "Build Shelter. Discard a card of your city's colour. No one is exposed in or leaving a sheltered city, and it loses no population at game end.",
  inoculate:
    "Inoculate, a free action. Move your city's Player card or Infection card from its discard pile into storage, out of the decks.",
  chartLane:
    "Sea Lane. Spend 2 cubes from your character to join your port to another. A lane may cross one region boundary.",
  monitor:
    "Monitor. In a tower city, tune to a frequency. Four Player cards are discarded and the frequency gives what it holds.",
  broadcast:
    "Broadcast. In a tower city, move a Hollow Man out of a city of that city's colour into a neighbouring location.",
};

export const ruleBriefs: Partial<Record<RuleId, string>> = {
  forsaken:
    "A city at population 0 is forsaken. When one of its Infection cards is flipped it is set aside and another card is flipped in its place, nothing but Drive or Ferry works there, and it becomes infested. Restore at game end brings it back.",
  epidemicScaling: "The number of Epidemics in the deck grows with the number of City cards in it.",
  hollowSetup:
    "The last 3 setup infections place Hollow Men. Running out of Hollow Men figures loses the game.",
  epidemicFromStorage: "An Epidemic strikes a stored Infection card first, if there is one.",
  labBreakthroughs:
    "Each lab found gives its breakthrough. Opal: making supplies at a haven or supply center takes 1 more cube. Jade: an Epidemic removes only 1 cube from the city it strikes. Topaz: when a city would lose a cube to an infection, any player may discard a City card of its colour to keep it.",
  carrier:
    "A new action at Lake Baikal, Take the sample. That character becomes the carrier. The carrier moves only by Drive or Ferry, must discard a City card of the colour of each city they enter, and dies when the game ends.",
};

/** The heading each kind of unlock is grouped under, in a briefing and in the playtest lab's status. */
const HEADING = {
  objectives: "Objectives this game",
  action: "New actions",
  rule: "New rules",
  turningPoint: "Turning point",
  event: "New Event cards",
  epidemicCard: "Epidemic cards",
  ability: "New abilities for sale",
  scar: "New scars",
  owedScar: "Scars owed",
  cityImprovement: "New City card improvements for sale",
  infectionImprovement: "New Infection card improvements for sale",
  permanentStructure: "New at game end",
  job: "New characters",
  lab: "Labs found",
  region: "Infested from the start",
  route: "Recon routes now known",
  edge: "New routes",
  haven: "New havens",
  infest: "Infested cities",
  forsake: "Forsaken cities",
  destroy: "City destroyed",
  frequencyHint: "Monitor frequencies",
  gather: "Hollow Men",
  assemble: "Hollow Men",
  freeAbilityUnits: "Production",
  stockpileBonus: "Stockpile",
  actions: "Right now",
} satisfies Partial<Record<Unlock["t"], string>>;

export type BriefedUnlock = Extract<Unlock, { t: keyof typeof HEADING }>;

const EVENT_HEADING = {
  rationed: "Rationed Events",
  unrationed: "Unrationed Events",
  permanent: HEADING.event,
} as const;

/** The heading an unlock is grouped under. Events group by how they are played, so the Rationed Events stand together. */
export function unlockHeading(unlock: BriefedUnlock): string {
  return unlock.t === "event" ? EVENT_HEADING[unlock.mode] : HEADING[unlock.t];
}

export type BriefingSection =
  | { t: "card"; title: string; text: string | null; from: BriefingSource }
  | { t: "group"; heading: string; items: { unlock: BriefedUnlock; text: string }[] };

/** A briefing as it is read: each Legacy card, then what it unlocked grouped by kind. */
export function briefingSections(briefing: BriefingEntry[]): BriefingSection[] {
  const sections: BriefingSection[] = [];
  const groups = new Map<string, Extract<BriefingSection, { t: "group" }>>();
  for (const entry of briefing) {
    if (entry.t === "card") {
      // What a card unlocked stays under that card, so each Rationed Event shows under the card that brought it.
      groups.clear();
      sections.push(entry);
      continue;
    }
    const heading = unlockHeading(entry.unlock);
    let group = groups.get(heading);
    if (!group) {
      group = { t: "group", heading, items: [] };
      groups.set(heading, group);
      sections.push(group);
    }
    group.items.push({ unlock: entry.unlock, text: entry.text });
  }
  return sections;
}

/**
 * One thing opened and what came out of it, the unit the table unpacks one at a time. A door that a Legacy card or a
 * package's report opens is unpacked with it, so `seals` lists the package or door first and then those doors.
 */
export type Opening = {
  title: string;
  text: string | null;
  from: BriefingSource;
  seals: Seal[];
  items: { unlock: BriefedUnlock; text: string }[];
};

const opensFrom = (unlocks: Unlock[]) =>
  unlocks.flatMap((unlock) => (unlock.t === "open" ? [sealKey(unlock.seal)] : []));
function opensOf(from: BriefingSource): string[] {
  if (from.t === "legacy")
    return opensFrom(pack.legacyDeck.find((card) => card.id === from.card)?.unlocks ?? []);
  if (from.t === "seal") {
    const def = pack.seals.find((candidate) => sealKey(candidate.seal) === sealKey(from.seal));
    return opensFrom(def?.unlocks ?? []);
  }
  return [];
}

/** A briefing split into what was opened, in order. Unlocks before any card belong to the month's setup. */
export function openings(briefing: BriefingEntry[]): Opening[] {
  const result: Opening[] = [];
  let opens: string[] = [];
  for (const entry of briefing) {
    const current = result.at(-1);
    if (entry.t === "unlock") {
      if (current) current.items.push({ unlock: entry.unlock, text: entry.text });
      else
        result.push({
          title: "Setup",
          text: null,
          from: { t: "legacy", card: "" },
          seals: [],
          items: [{ unlock: entry.unlock, text: entry.text }],
        });
      continue;
    }
    if (current && entry.from.t === "seal" && opens.includes(sealKey(entry.from.seal))) {
      current.seals.push(entry.from.seal);
      opens.push(...opensOf(entry.from));
      continue;
    }
    result.push({
      title: entry.title,
      text: entry.text,
      from: entry.from,
      seals: entry.from.t === "seal" ? [entry.from.seal] : [],
      items: [],
    });
    opens = opensOf(entry.from);
  }
  return result;
}

/** Everything an opening put into play: its Legacy card's and its seals' contents, then the briefing's own lines. */
export function openingUnlocks(opening: Opening): Unlock[] {
  const from = opening.from;
  const card =
    from.t === "legacy" ? pack.legacyDeck.find((entry) => entry.id === from.card) : undefined;
  const seals = new Set([...(from.t === "seal" ? [from.seal] : []), ...opening.seals].map(sealKey));
  return [
    ...(card?.unlocks ?? []),
    ...pack.seals.filter((def) => seals.has(sealKey(def.seal))).flatMap((def) => def.unlocks),
    // The briefing leaves out what it has nothing to say about, so its lines come after what the cards hold.
    ...opening.items.map((item) => item.unlock),
  ];
}

const MAP_UNLOCKS = new Set<Unlock["t"]>([
  "region",
  "haven",
  "lab",
  "infest",
  "forsake",
  "destroy",
  "edge",
  "route",
]);

/** Whether an opening changes the map, which the table is shown as a step of its own once its story is told. */
export const changesMap = (opening: Opening) =>
  openingUnlocks(opening).some((unlock) => MAP_UNLOCKS.has(unlock.t));

const named = <T extends { id: string; name: string; text: string }>(list: T[], id: string) => {
  const found = list.find((entry) => entry.id === id)!;
  return `${found.name}. ${found.text}`;
};

/** Adds an unlock to the briefing, worded for its heading, when it is something the table should hear about. */
export function briefUnlock(campaign: Campaign, unlock: Unlock) {
  if (!(unlock.t in HEADING)) return;
  const text = unlockLine(campaign, unlock as BriefedUnlock);
  if (text !== null) campaign.briefing.push({ t: "unlock", unlock: unlock as BriefedUnlock, text });
}

/** What an unlock means, worded as a briefing words it, or null for one the table does not hear about. */
export function unlockText(campaign: Campaign, unlock: Unlock): string | null {
  return unlock.t in HEADING ? unlockLine(campaign, unlock as BriefedUnlock) : null;
}

function unlockLine(campaign: Campaign, unlock: BriefedUnlock): string | null {
  switch (unlock.t) {
    case "event": {
      const mode =
        unlock.mode === "rationed"
          ? "Rationed"
          : unlock.mode === "unrationed"
            ? "Unrationed"
            : "permanent";
      const owned = Object.values(campaign.playerCards).some(
        (card) => card.kind === "event" && card.event === unlock.event,
      );
      const where =
        unlock.mode === "rationed"
          ? "It joins the Rationed Events the group picks from at each setup, starting next game."
          : "It is in the Player deck from the next game on.";
      const event = pack.events.find((entry) => entry.id === unlock.event)!;
      const article = mode === "Unrationed" ? "an" : "a";
      return `${event.name}, ${owned ? `another copy of ${article} ${mode} Event` : `${article} ${mode} Event`}. ${where} When played it reads: ${event.text}`;
    }
    case "ability":
      return named(pack.abilities, unlock.ability);
    case "scar":
      return `${named(pack.scars, unlock.scar)} A character can be given this scar from now on.`;
    case "cityImprovement":
      return named(pack.cityImprovements, unlock.improvement);
    case "infectionImprovement":
      return named(pack.infectionImprovements, unlock.improvement);
    case "job":
      return `${named(pack.jobs, unlock.job)} A character with a job nobody had before has joined the roster. That text describes the job, not a new rule for everyone.`;
    case "lab":
      return `${pack.cities.find((entry) => entry.id === unlock.city)!.name}. Every lab found counts toward the final score.`;
    case "action":
      return actionBriefs[unlock.action] ?? null;
    case "region": {
      const infested = pack.cities
        .filter((city) => city.region === unlock.region && city.startsInfested)
        .map((city) => city.name);
      return infested.length
        ? `${infested.join(", ")}. A character who begins a turn in one of them is exposed.`
        : null;
    }
    case "objectives": {
      // The briefing shows the objective cards themselves; the text is for readers without them.
      const kept = campaign.objectives.filter((id) => !unlock.remove?.includes(id));
      const now = [...kept, ...(unlock.add ?? []).filter((id) => !kept.includes(id))];
      return now.map((id) => pack.objectives.find((entry) => entry.id === id)!.name).join(", ");
    }
    case "rule":
      return ruleBriefs[unlock.rule] ?? null;
    case "route": {
      const route = pack.reconRoutes.find((entry) => entry.id === unlock.route);
      if (!route) return null;
      const city = pack.cities.find((entry) => entry.id === route.city)!.name;
      return `At ${city}, discard ${route.count} ${route.color} cards${route.unique ? " of different cities" : ""}${route.needsCenter ? ". The city needs a supply center" : ""}.`;
    }
    case "haven": {
      const reached = pack.seals.some(
        (def) =>
          def.unlocks.includes(unlock) &&
          def.unlocks.some(
            (other) =>
              other.t === "region" &&
              other.connect?.some((edge) => edge.a === unlock.city || edge.b === unlock.city),
          ),
      );
      const name = pack.cities.find((entry) => entry.id === unlock.city)!.name;
      return reached
        ? `${name} is now on the map, and a line already reaches it.`
        : `${name} is now on the map. It is not on the grid until a line reaches it.`;
    }
    case "frequencyHint": {
      const worth = pack.frequencies.flatMap((reward, index) =>
        reward && "seal" in reward ? [pack.frequencyLabels[index]!] : [],
      );
      const pairs = pack.frequencies.flatMap((reward, index) =>
        reward && "take" in reward && reward.take > 1 ? [pack.frequencyLabels[index]!] : [],
      );
      return `The bearings cross on ${worth.length} Monitor frequencies that open a door: ${worth.join(", ")}. ${pairs.join(", ")} returns 2 cards from the discard pile, and the others return 1.`;
    }
    case "gather":
      return `${unlock.cards} Gather cards join the Infection cards. They start each game in the discard pile and enter the deck with the first Epidemic. When one is flipped, the next city flipped gets a Hollow Man and is not infected. Leaving a location that holds Hollow Men exposes a character.`;
    case "assemble":
      return `${unlock.cards} Assemble cards join the Infection cards. They work as Gather cards do.`;
    case "freeAbilityUnits":
      return `${unlock.amount} free production units for character abilities. Spend them now, before the supplies go out: what is left then is lost.`;
    case "stockpileBonus":
      return `The stockpile grows by ${unlock.amount} cubes now and at every later setup.`;
    case "actions":
      return `${unlock.amount} extra actions for the player whose turn it is.`;
    case "permanentStructure":
      return `A ${unlock.structure} can be made permanent, so it starts every later game already built.`;
    case "epidemicCard":
      return "Another Epidemic card joins the box for future games.";
    case "turningPoint": {
      const TEXT = {
        firstForsaken: "At Game End, if any revealed city is at population 0, open doors A and 12.",
        losingStreak:
          "After 4 games lost in a row, up to 10 extra reserve cubes join the stockpile for 3 games.",
        defection: "At Game End, if a Hollow Man stands on 3 different havens, open door 17.",
      } as const;
      return unlock.over ? "Turning point resolved and removed from play." : TEXT[unlock.id];
    }
    case "owedScar":
      return "One character must take a scar when the next game begins.";
    case "destroy": {
      const name = pack.cities.find((entry) => entry.id === unlock.city)!.name;
      return `${name} is permanently destroyed: removed from the map along with its routes and cards.`;
    }
    case "edge": {
      const a = pack.cities.find((entry) => entry.id === unlock.edge.a)!.name;
      const b = pack.cities.find((entry) => entry.id === unlock.edge.b)!.name;
      return `A ${unlock.edge.kind === "sea" ? "sea lane" : "supply line"} now joins ${a} and ${b}.`;
    }
    case "infest": {
      const name = pack.cities.find((entry) => entry.id === unlock.city)!.name;
      return `${name} is now infested. Characters starting a turn there are exposed.`;
    }
    case "forsake": {
      const name = pack.cities.find((entry) => entry.id === unlock.city)!.name;
      return `${name} is forsaken and infested.`;
    }
  }
}

const sealName = (seal: Seal) => (seal.t === "door" ? `door ${seal.id}` : `package ${seal.id}`);

/** What a scratched search box found, short enough to stay printed on the City card. */
export function searchFind(result: SearchResult): string {
  switch (result.t) {
    case "supplies":
      return `${result.amount} cubes here from the ${result.from}`;
    case "stockpile":
      return `${result.amount} cubes to the stockpile`;
    case "actions":
      return `${result.amount} extra action${result.amount === 1 ? "" : "s"}`;
    case "retrieve":
      return "Take a card from the discard";
    case "giveCard":
      return "Give a card to a player";
    case "quarantineCard":
      return "Set an Infection card aside";
    case "removeHollow":
      return `Remove ${result.amount} Hollow Men`;
    case "freeEdge":
      return result.kind === "sea" ? "A free sea lane" : "A free supply line";
    case "discover": {
      const opens = `Open ${result.seals.map(sealName).join(" and ")}`;
      if (result.lab) return `Lab found. ${opens}`;
      return result.orAction ? `${opens}, or 1 action` : opens;
    }
    case "companion":
      return `Companion: ${pack.companions.find((companion) => companion.id === result.companion)!.name}`;
    case "infest":
      return result.opens ? `Infested. Open ${sealName(result.opens)}` : "Infested";
    case "nothing":
      return "Nothing";
  }
}
