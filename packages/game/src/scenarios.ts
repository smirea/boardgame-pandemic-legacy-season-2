import { pack } from "./content/pack";
import type { JobId, Seal, SealKey } from "./content/types";
import { sealKey } from "./content/types";
import { documentedEdges } from "./content/world";
import { gridCityCount, hasEdge } from "./helpers";
import type { CityId } from "./ids";
import { applyUnlock, createCharacter, newCampaign, openSeal, readCard, readLegacy } from "./legacy";
import type { Save } from "./machine";
import type { World } from "./state";
import { newTable } from "./table";
import canonical from "./canonical-save.json";
import { parseSave } from "./machine";

const CAST: [name: string, job: JobId][] = [
  ["Ada", "administrator"],
  ["Bo", "farmer"],
  ["Cy", "instructor"],
  ["Di", "laborer"],
  ["Eve", "radioOperator"],
];

/** What a group that explored on schedule would have opened, by the month they opened it. */
const pkg = (id: number): Seal => ({ t: "package", id });
const door = (id: string): Seal => ({ t: "door", id });
/** A lab the group found by searching its city. */
const lab = (city: string) => ({ lab: city as CityId });
const EXPLORED: Record<number, (Seal | { lab: CityId })[]> = {
  1: [pkg(1)],
  3: [pkg(5), lab("buenos-aires"), door("18"), door("20")],
  4: [door("60"), pkg(6)],
  5: [pkg(4)],
  6: [pkg(7), lab("johannesburg"), door("46")],
  7: [pkg(2), door("65"), door("11")],
  9: [pkg(3), door("59")],
  10: [door("19"), door("17")],
  11: [pkg(8)],
};

const PERMANENT: [city: string, structure: "center" | "tower" | "shelter"][] = [
  ["johannesburg", "center"],
  ["cairo", "center"],
  ["washington", "center"],
  ["shanghai", "center"],
  ["kolkata", "center"],
  ["tripoli", "tower"],
];

/**
 * A campaign that won every month before `month` and stands in that month's lobby: regions explored
 * on schedule, the documented routes drawn between revealed locations, a few permanent structures.
 * The sample lab at Lake Baikal is never pre-connected, so December still has to reach it in play.
 * `unexplored` names bundles this group never opened, and `cast` replaces the usual five characters.
 */
export function campaignAt(
  month: number,
  seed = 12,
  {
    unexplored = [],
    cast = CAST,
  }: { unexplored?: SealKey[]; cast?: [name: string, job: JobId][] } = {},
): Save {
  const world: World = { campaign: newCampaign(seed), game: null, table: newTable() };
  const campaign = world.campaign;
  const havens = pack.cities
    .filter((city) => city.kind === "haven" && !city.lost)
    .map((city) => city.id);
  cast.forEach(([name, job], index) =>
    createCharacter(campaign, { name, job, home: havens[index % havens.length]! }),
  );

  for (let played = 1; played < month; played++) {
    campaign.month = played;
    readLegacy(world, "setup");
    for (const found of EXPLORED[played] ?? []) {
      if ("lab" in found) applyUnlock(world, { t: "lab", city: found.lab });
      else if (!unexplored.includes(sealKey(found))) openSeal(world, found, false);
    }
    readLegacy(world, "gameEnd", true);
    campaign.results.push({
      month: played,
      attempt: 1,
      won: true,
      gridCities: gridCityCount(campaign),
      rationing: campaign.rationing,
      characters: [],
      chronicle: null,
    });
  }
  campaign.month = month;
  campaign.attempt = 1;
  campaign.briefing = [];

  const revealed = (city: CityId) => campaign.locations[city]!.revealed;
  for (const edge of documentedEdges) {
    const reachesSample = edge.a === pack.sampleFrom || edge.b === pack.sampleFrom;
    if (
      reachesSample ||
      !revealed(edge.a) ||
      !revealed(edge.b) ||
      hasEdge(campaign, edge.a, edge.b)
    )
      continue;
    campaign.edges.push({ ...edge });
  }
  for (const [city, structure] of PERMANENT) {
    if (revealed(city as CityId)) campaign.locations[city as CityId]!.permanent.push(structure);
  }
  if (cast === CAST) {
    const [ada, bo, cy] = Object.values(campaign.characters);
    ada!.slots[0] = { kind: "ability", id: "helmsman" };
    bo!.slots[0] = { kind: "ability", id: "recordKeeper" };
    cy!.slots[0] = { kind: "ability", id: "courier" };
  }
  return { v: 1, phase: "lobby", world };
}

/**
 * The campaign as it stands when the Legacy deck is read from card `index`: the months before won as `campaignAt`
 * plays them, the cards of its month before `index` already read, and the reading from `index` to the next halt
 * waiting on the table to be unpacked. The two Prologue cards are in play from the start and never read.
 */
export function readingFrom(index: number): Save {
  const card = pack.legacyDeck[index];
  if (!card || card.month === 0) throw new Error(`No Legacy reading starts at card ${index}`);
  const save = campaignAt(card.month);
  const { world } = save;
  const campaign = world.campaign;
  if (campaign.legacyIndex > index)
    throw new Error(`Card ${card.id} was read before its month's lobby`);
  while (campaign.legacyIndex < index) readCard(world, pack.legacyDeck[campaign.legacyIndex]!);
  campaign.briefing = [];
  campaign.legacyHalt = null;
  readLegacy(world, "setup");
  return save;
}

/** Our own group's campaign at the September lobby, as the deployed game exported it. */
export const canonicalSave = () => parseSave(structuredClone(canonical));

/** The saves the game's menu can load. `campaignAt` is for tests and tools, which need a month of their choosing. */
export const scenarios = { canonical: canonicalSave };
