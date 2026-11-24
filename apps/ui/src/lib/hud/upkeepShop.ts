import { legalPurchases, pack, purchaseCost, reject } from "@repo/game";
import type { CharacterId, CityId, Purchase, World } from "@repo/game";
import { cityName } from "./labels.svelte.ts";

export type ShopTarget = {
  key: string;
  label: string;
  /** What the target is now, beside its name: a population, or the card's colour. */
  city: CityId | null;
  character: CharacterId | null;
  purchase: Purchase;
};

/** One thing for sale: an ability, an upgrade, a population step. Its targets are where the engine lets it go now. */
export type ShopItem = {
  key: string;
  name: string;
  text: string;
  cost: number;
  /** How many of it are left to buy, when the box holds a limited number. */
  left: number | null;
  targets: ShopTarget[];
  /** Why nothing can be bought, when no target is legal. */
  reason: string | null;
};

export type SectionId =
  | "abilities"
  | "cityCards"
  | "infectionCards"
  | "population"
  | "restore"
  | "permanent";
export type ShopSection = { id: SectionId; title: string; blurb: string; items: ShopItem[] };

const STRUCTURE = { center: "supply center", tower: "tower", shelter: "shelter" } as const;

const byKey = (purchase: Purchase) => JSON.stringify(purchase);

const count = <T>(list: T[], value: T) => list.filter((entry) => entry === value).length;

/** The short name of what a purchase buys, for the list of allocations. */
export function purchaseName(purchase: Purchase): string {
  switch (purchase.t) {
    case "ability":
      return pack.abilities.find((entry) => entry.id === purchase.ability)!.name;
    case "cityImprovement":
      return pack.cityImprovements.find((entry) => entry.id === purchase.improvement)!.name;
    case "infectionImprovement":
      return pack.infectionImprovements.find((entry) => entry.id === purchase.improvement)!.name;
    case "population":
      return `Population +${purchase.steps}`;
    case "restore":
      return "Restored";
    case "permanent":
      return `Permanent ${STRUCTURE[purchase.structure]}`;
  }
}

/** Where a purchase went, for the list of allocations. */
export function purchaseTarget(world: World, purchase: Purchase): string {
  switch (purchase.t) {
    case "ability":
      return world.campaign.characters[purchase.character]!.name;
    case "cityImprovement": {
      const card = world.campaign.playerCards[purchase.card];
      return card?.kind === "city" ? `${cityName(card.city)} City card` : "City card";
    }
    case "infectionImprovement": {
      const card = world.campaign.infectionCards[purchase.card];
      return card?.kind === "city" ? `${cityName(card.city)} Infection card` : "Infection card";
    }
    case "population":
    case "restore":
    case "permanent":
      return cityName(purchase.city);
  }
}

/**
 * Everything the spending step can buy, grouped the way the box keeps it. Legality comes from the engine: every target
 * is a purchase `legalPurchases` lists, and an item with none says why through `reject`.
 */
export function shopOf(world: World): ShopSection[] {
  const { campaign } = world;
  const legal = legalPurchases(world);
  const budget = world.game?.upkeep?.units ?? 0;
  const why = (probe: Purchase | null, cost: number) => {
    if (probe) return reject(world, "upkeep", { type: "PURCHASE", purchase: probe }) ?? null;
    return cost > budget ? "Not enough production units" : "Nothing can take it now";
  };
  const item = (
    key: string,
    name: string,
    text: string,
    cost: number,
    left: number | null,
    targets: ShopTarget[],
    probe: Purchase | null,
  ): ShopItem => ({
    key,
    name,
    text,
    cost,
    left,
    targets,
    reason: targets.length ? null : why(probe, cost),
  });

  const living = Object.values(campaign.characters).filter(
    (character) => !character.dead && !character.worker,
  );
  const abilities = [...new Set(campaign.abilitiesForSale)].map((id) => {
    const def = pack.abilities.find((entry) => entry.id === id)!;
    const targets = living.flatMap((character): ShopTarget[] => {
      const purchase = legal.find(
        (entry) =>
          entry.t === "ability" && entry.ability === id && entry.character === character.id,
      );
      return purchase
        ? [
            {
              key: byKey(purchase),
              label: character.name,
              city: null,
              character: character.id,
              purchase,
            },
          ]
        : [];
    });
    const slot = living[0]?.slots.indexOf(null) ?? -1;
    const probe: Purchase | null =
      living[0] && slot >= 0 ? { t: "ability", ability: id, character: living[0].id, slot } : null;
    return item(
      id,
      def.name,
      def.text,
      def.cost,
      count(campaign.abilitiesForSale, id),
      targets,
      probe,
    );
  });

  const cardItems = (kind: "cityImprovement" | "infectionImprovement") => {
    const forSale =
      kind === "cityImprovement"
        ? campaign.cityImprovementsForSale
        : campaign.infectionImprovementsForSale;
    const defs = kind === "cityImprovement" ? pack.cityImprovements : pack.infectionImprovements;
    const cards = kind === "cityImprovement" ? campaign.playerCards : campaign.infectionCards;
    return [...new Set<string>(forSale)].map((id) => {
      const def = defs.find((entry) => entry.id === id)!;
      const seen = new Set<CityId>();
      const targets: ShopTarget[] = [];
      for (const purchase of legal) {
        if (purchase.t !== kind || purchase.improvement !== id) continue;
        const card = cards[purchase.card];
        if (card?.kind !== "city" || seen.has(card.city)) continue;
        seen.add(card.city);
        targets.push({
          key: byKey(purchase),
          label: cityName(card.city),
          city: card.city,
          character: null,
          purchase,
        });
      }
      return item(
        id,
        def.name,
        def.text,
        def.cost,
        count<string>(forSale, id),
        targets.toSorted((a, b) => a.label.localeCompare(b.label)),
        null,
      );
    });
  };

  const cities = (t: "population" | "restore") =>
    legal
      .filter((purchase) => purchase.t === t)
      .map((purchase): ShopTarget => ({
        key: byKey(purchase),
        label: cityName((purchase as { city: CityId }).city),
        city: (purchase as { city: CityId }).city,
        character: null,
        purchase,
      }))
      .toSorted((a, b) => a.label.localeCompare(b.label));

  const population = item(
    "population",
    "Population +1",
    "Raise a location by one, up to 8. A forsaken city is restored first.",
    purchaseCost({ t: "population", city: pack.cities[0]!.id, steps: 1 }),
    null,
    cities("population"),
    null,
  );
  const forsaken = pack.cities.some(
    (city) =>
      city.kind === "city" &&
      campaign.locations[city.id]?.revealed &&
      campaign.locations[city.id]!.population === 0,
  );
  const restore = item(
    "restore",
    "Restore a forsaken city",
    "Back to population 1. It stays infested.",
    purchaseCost({ t: "restore", city: pack.cities[0]!.id }),
    null,
    cities("restore"),
    null,
  );
  if (!restore.targets.length && !forsaken) restore.reason = "No city is forsaken";

  const permanent = [...new Set(campaign.permanentForSale)].map((structure) => {
    const targets = legal
      .filter((purchase) => purchase.t === "permanent" && purchase.structure === structure)
      .map((purchase): ShopTarget => ({
        key: byKey(purchase),
        label: cityName((purchase as { city: CityId }).city),
        city: (purchase as { city: CityId }).city,
        character: null,
        purchase,
      }))
      .toSorted((a, b) => a.label.localeCompare(b.label));
    const cost = pack.numbers.costs.permanent[structure];
    const shop = item(
      structure,
      `Permanent ${STRUCTURE[structure]}`,
      "Stands at the start of every later game.",
      cost,
      count(campaign.permanentForSale, structure),
      targets,
      null,
    );
    if (shop.reason && cost <= budget)
      shop.reason = `No ${STRUCTURE[structure]} standing can be made permanent`;
    return shop;
  });

  const sections: ShopSection[] = [
    {
      id: "abilities",
      title: "Abilities",
      blurb: "An ability fills an empty slot on a character card.",
      items: abilities,
    },
    {
      id: "cityCards",
      title: "City cards",
      blurb: "An upgrade sticks to every copy of a city’s Player card.",
      items: cardItems("cityImprovement"),
    },
    {
      id: "infectionCards",
      title: "Infection cards",
      blurb: "An upgrade sticks to a city’s Infection card.",
      items: cardItems("infectionImprovement"),
    },
    {
      id: "population",
      title: "Population",
      blurb: "Grow a location on the grid.",
      items: [population],
    },
    { id: "restore", title: "Forsaken cities", blurb: "Bring a city at 0 back.", items: [restore] },
    {
      id: "permanent",
      title: "Permanent structures",
      blurb: "A structure standing now stays for every later game.",
      items: permanent,
    },
  ];
  return sections.filter((section) => section.items.length > 0);
}
