import { cityDef, pack } from "@repo/game";
import type { CardId, CharacterId, CityId, SeatId, World } from "@repo/game";

export const MONTHS = [
  "Prologue",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const monthName = (month: number) => MONTHS[month] ?? `month ${month}`;

const cityIds = new Set<string>(pack.cities.map((city) => city.id));

export const isCity = (value: string): value is CityId => cityIds.has(value);

export const cityName = (world: World, id: CityId) => world.campaign.names[id] ?? cityDef(id).name;

export function seatName(world: World, seat: SeatId): string {
  const player = world.game?.players[seat];
  return player ? (world.campaign.characters[player.character]?.name ?? seat) : seat;
}

export function characterLine(world: World, id: CharacterId): string {
  const character = world.campaign.characters[id]!;
  const job = pack.jobs.find((job) => job.id === character.job);
  const slots = character.slots.flatMap((slot) => (slot ? [`${slot.kind}:${slot.id}`] : []));
  const flags = [
    character.dead ? "DEAD" : null,
    character.worker ? "worker" : null,
    character.carrier ? "carrier" : null,
    character.jobScar ? `job covered by scar ${character.jobScar}` : null,
  ].filter(Boolean);
  return `${character.name} (${id}) · ${job ? job.name : "no job"} · home ${cityName(world, character.home)} · exposure ${character.exposure}/${character.exposureTrack.length} · slots [${slots.join(", ") || "empty"}]${flags.length ? ` · ${flags.join(", ")}` : ""}`;
}

export function cardName(world: World, id: CardId): string {
  const card = world.campaign.playerCards[id];
  if (card) {
    switch (card.kind) {
      case "city": {
        const def = cityDef(card.city);
        const open = card.search.filter((box) => !box.scratched).length;
        const companion = card.companion
          ? ` with companion ${pack.companions.find((entry) => entry.id === card.companion)?.name}`
          : "";
        return `${def.color ?? "haven"} ${cityName(world, card.city)}${card.improvement ? ` +${card.improvement}` : ""}${companion}${open ? ` (${open} search box${open > 1 ? "es" : ""})` : ""}`;
      }
      case "epidemic":
        return "EPIDEMIC";
      case "produce":
        return `Produce Supplies (${card.boxesLeft} uses left)`;
      case "event":
        return `event ${pack.events.find((event) => event.id === card.event)?.name ?? card.event}`;
    }
  }
  const infection = world.campaign.infectionCards[id];
  if (infection) {
    if (infection.kind === "city")
      return `infection ${cityName(world, infection.city)}${infection.improvement ? ` +${infection.improvement}` : ""}`;
    return `infection Hollow Men (${infection.kind})`;
  }
  return id;
}

/** Card ids hold a `#`, which a shell treats as a comment. Keys show it as a dot. */
export const enc = (value: string) => value.replaceAll("#", ".");

/** A value from a command, as a person would read it. */
export function human(world: World, value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => human(world, item)).join(" + ");
  if (typeof value !== "string") return String(value);
  if (isCity(value)) return cityName(world, value);
  if (value in world.campaign.playerCards || value in world.campaign.infectionCards)
    return `[${cardName(world, value as CardId)}]`;
  if (world.game && value in world.game.players) return seatName(world, value as SeatId);
  if (value in world.campaign.characters)
    return world.campaign.characters[value as CharacterId]!.name;
  return value;
}
