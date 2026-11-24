import { cityDef, pack } from "@repo/game";
import type { Campaign, CardId } from "@repo/game";
import { cityColor } from "#lib/board/CityMarker.svelte";
import { sortHand } from "./handOrder.ts";
import { cardColor } from "./PlayerCard.svelte";
import { HOLLOW_COLOR } from "./rich.ts";
import type { Rich } from "./rich.ts";

/** What a card kept in Package 6 is called. */
export function storedLabel(campaign: Campaign, id: CardId): string {
  const cityName = (city: Parameters<typeof cityDef>[0]) =>
    campaign.names[city] ?? cityDef(city).name;
  const player = campaign.playerCards[id];
  if (player) {
    if (player.kind === "city") return cityName(player.city);
    if (player.kind === "event")
      return pack.events.find((event) => event.id === player.event)?.name ?? player.event;
    return player.kind === "produce" ? "Produce Supplies" : "Epidemic";
  }
  const infection = campaign.infectionCards[id];
  if (infection) {
    if (infection.kind === "city") return cityName(infection.city);
    return infection.kind === "gather" ? "Hollow Men Gather" : "Hollow Men Assemble";
  }
  return String(id);
}

const counted = (name: string, count: number) => `${name}${count > 1 ? ` ×${count}` : ""}`;

/** The Player cards in Package 6 as one line in a hand's order, each card once with how many of it there are. */
export function storedPlayerLine(campaign: Campaign): Rich {
  const cards = sortHand(
    campaign.stored.player.flatMap((id) => campaign.playerCards[id] ?? []),
    (card) => storedLabel(campaign, card.id),
  );
  const groups = new Map<string, { card: (typeof cards)[number]; count: number }>();
  for (const card of cards) {
    const key =
      card.kind === "city"
        ? `city:${card.city}`
        : card.kind === "event"
          ? `event:${card.event}`
          : card.kind;
    const hit = groups.get(key);
    if (hit) hit.count += 1;
    else groups.set(key, { card, count: 1 });
  }
  return [...groups.values()].flatMap(({ card, count }, index) => [
    ...(index ? [", "] : []),
    {
      glyph:
        card.kind === "epidemic"
          ? ("epidemic" as const)
          : card.kind === "event"
            ? ("event" as const)
            : ("card" as const),
      color: cardColor(card),
      text: counted(storedLabel(campaign, card.id), count),
    },
  ]);
}

/** The Infection cards in Package 6 as one line, the cities with the most copies first. */
export function storedInfectionLine(campaign: Campaign): Rich {
  const counts = new Map<string, { color: string; name: string; count: number }>();
  for (const id of campaign.stored.infection) {
    const card = campaign.infectionCards[id];
    if (!card) continue;
    const key = card.kind === "city" ? `city:${card.city}` : card.kind;
    const hit = counts.get(key);
    if (hit) hit.count += 1;
    else
      counts.set(key, {
        color: card.kind === "city" ? cityColor(card.city) : HOLLOW_COLOR,
        name: storedLabel(campaign, id),
        count: 1,
      });
  }
  return [...counts.values()]
    .toSorted((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .flatMap(({ color, name, count }, index) => [
      ...(index ? [", "] : []),
      { glyph: "infection" as const, color, text: counted(name, count) },
    ]);
}
