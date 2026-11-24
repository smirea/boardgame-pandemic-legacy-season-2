import { pack } from "./content/pack";
import { openingInfectionsLeft } from "./flow";
import {
  cityDef,
  grid,
  groundRevealed,
  isForsaken,
  nearestGround,
  reconned,
  sealDef,
  unlocksBehind,
} from "./helpers";
import type { Point } from "./helpers";
import type { CardId, CityId } from "./ids";
import { AWAY_FROM_ROUTE, type Action } from "./actions";
import type { DoorId, ReconRoute, Seal } from "./content/types";
import { isOpen } from "./legacy";
import type { Campaign } from "./state";
import type { GameSnapshot, Phase } from "./machine";
import { phaseOf, reject } from "./machine";
import { legalActions } from "./options";
import { drawsUntilEpidemicCertain, epidemicOdds, expectedDraws, infectOdds } from "./odds";
import type { PlayerCard, World } from "./state";
import type { Color } from "./content/types";

export type PublicState = { phase: Phase; world: World; canUndo: boolean };

/**
 * What every screen renders and what the host broadcasts. It is the whole state: this is a game for
 * a trusted group, so hidden information (deck order, unscratched boxes) is hidden by the UI, and
 * every player holds enough to export a save.
 */
export function publicState(snapshot: GameSnapshot): PublicState {
  return {
    phase: phaseOf(snapshot),
    world: snapshot.context.world,
    canUndo: snapshot.context.undo.length > 0 && snapshot.context.world.table.undoVote === null,
  };
}

export type PlayerDeckKind = Color | "haven" | Exclude<PlayerCard["kind"], "city">;

export type PlayerCardsAt = { inDeck: number; inHands: number; discarded: number };

export type Insights = {
  playerDeck: {
    cards: number;
    turnsLeft: number;
    epidemicsLeft: number;
    epidemicsDrawn: number;
    /** Chance that the next 2-card draw holds an epidemic. */
    epidemicNextDraw: number;
    /** Draws until the next epidemic must have appeared, or null when none remain. */
    epidemicWithin: number | null;
    /** City cards by region colour (havens have none), every other card by its kind. */
    byKind: Partial<Record<PlayerDeckKind, number>>;
    /** Where each city's player cards are: still in the deck, in someone's hand, or discarded. */
    cities: Record<CityId, PlayerCardsAt>;
  };
  infection: {
    /** True until the cards that open a game are all flipped: the odds describe those flips, not a turn's Infect step. */
    opening: boolean;
    rate: number;
    nextRate: number;
    deck: number;
    /** Chance each city is infected at least once in the next Infect step. */
    odds: Record<CityId, number>;
    /** Chance each city gets at least one Hollow Man in the next Infect step, or null before Hollow Men are in play. */
    hollow: Record<CityId, number> | null;
    expected: Record<CityId, number>;
    /** Top stratum first: the cards known to be in each layer of the deck, `cards` sorted so it never tells their order. */
    strata: { size: number; cities: Record<CityId, number>; cards: CardId[] }[];
    discard: Record<CityId, number>;
    /** Infection cards set aside in the Game End area, out of play until the game ends. */
    gameEnd: Record<CityId, number>;
    /** Cities that would take a Plague cube or outbreak if hit now, with their odds. */
    atRisk: { city: CityId; odds: number; outbreak: boolean }[];
  };
  incidentsLeft: number;
};

function playerCardsByCity(world: World): Record<CityId, PlayerCardsAt> {
  const game = world.game!;
  const counts: Record<string, PlayerCardsAt> = {};
  const tally = (cards: CardId[], where: keyof PlayerCardsAt) => {
    for (const id of cards) {
      const card = world.campaign.playerCards[id];
      if (card?.kind !== "city") continue;
      const at = (counts[card.city] ??= { inDeck: 0, inHands: 0, discarded: 0 });
      at[where]++;
    }
  };
  tally(game.playerDeck.order, "inDeck");
  for (const seat of game.seats) tally(game.players[seat]!.hand, "inHands");
  tally(game.playerDiscard, "discarded");
  return counts as Record<CityId, PlayerCardsAt>;
}

const cityOfInfection = (world: World, card: CardId): CityId | "hollow" => {
  const found = world.campaign.infectionCards[card];
  return found?.kind === "city" ? found.city : "hollow";
};

function countCities(world: World, cards: CardId[]): Record<CityId, number> {
  const counts: Record<string, number> = {};
  for (const card of cards) {
    const city = cityOfInfection(world, card);
    counts[city] = (counts[city] ?? 0) + 1;
  }
  return counts as Record<CityId, number>;
}

export function insights(world: World): Insights | null {
  const game = world.game;
  if (!game) return null;
  const rates = pack.numbers.infectionRates;
  // Before the opening infection the deck is not built yet, but its contents are known: every card of a city on the grid.
  const unbuilt =
    game.infectionDeck.order.length === 0 && game.infectionDiscard.length === 0 && game.turn === 0;
  const opening = unbuilt || (game.turn === 0 && game.infectionsLeft > 0);
  const onGridNow = grid(world.campaign);
  const stored = new Set(world.campaign.stored.infection);
  const openingDeck = Object.values(world.campaign.infectionCards)
    .filter((card) => card.kind === "city" && onGridNow.has(card.city) && !stored.has(card.id))
    .map((card) => card.id);
  // A forsaken city's card is set aside when it comes up and another is flipped, so it takes no share of the odds.
  const infects = (card: CardId) => {
    const found = world.campaign.infectionCards[card];
    return found?.kind !== "city" || !isForsaken(world.campaign, found.city);
  };
  const layers = unbuilt ? [openingDeck] : game.infectionDeck.strata;
  const strata = layers.map((stratum) => stratum.filter(infects));
  const hollowSetup = world.campaign.rules.includes("hollowSetup");
  const setupHollows = hollowSetup ? 3 : 0;
  const rate = unbuilt
    ? pack.numbers.setupInfections - setupHollows
    : opening
      ? openingInfectionsLeft(world)
      : rates[game.rateIndex]!;
  const hollows = !opening
    ? 0
    : unbuilt
      ? setupHollows
      : Math.min(setupHollows, game.infectionsLeft);
  const keyOf = (card: CardId) => cityOfInfection(world, card);
  const flips = infectOdds(
    strata,
    { infects: rate, hollows, gathering: game.gathering },
    (card) => {
      const key = keyOf(card);
      return key === "hollow" ? null : key;
    },
  );
  const odds = Object.fromEntries(flips.infect) as Record<CityId, number>;
  const expected = Object.fromEntries(expectedDraws(strata, rate, keyOf)) as Record<CityId, number>;
  const byKind: Partial<Record<PlayerDeckKind, number>> = {};
  for (const id of game.playerDeck.order) {
    const card = world.campaign.playerCards[id]!;
    const key = card.kind === "city" ? (cityDef(card.city).color ?? "haven") : card.kind;
    byKind[key] = (byKind[key] ?? 0) + 1;
  }
  const epidemicsLeft = game.playerDeck.piles.reduce((sum, pile) => sum + pile.epidemics, 0);
  const atRisk = (Object.entries(odds) as [CityId, number][])
    .filter(([city, chance]) => chance > 0 && game.locations[city]!.supplies === 0)
    .map(([city, chance]) => ({
      city: city as CityId,
      odds: chance,
      outbreak: game.locations[city as CityId]!.plague >= pack.numbers.maxPlaguePerCity,
    }))
    .sort((a, b) => b.odds - a.odds);
  return {
    playerDeck: {
      cards: game.playerDeck.order.length,
      turnsLeft: Math.floor(game.playerDeck.order.length / 2),
      epidemicsLeft,
      epidemicsDrawn: game.epidemics,
      epidemicNextDraw: epidemicOdds(game.playerDeck.piles, 2),
      epidemicWithin: drawsUntilEpidemicCertain(game.playerDeck.piles),
      byKind,
      cities: playerCardsByCity(world),
    },
    infection: {
      opening,
      rate,
      nextRate: rates[Math.min(game.rateIndex + 1, rates.length - 1)]!,
      deck: game.infectionDeck.order.length,
      odds,
      hollow: hollowInPlay(world.campaign)
        ? (Object.fromEntries(flips.hollow) as Record<CityId, number>)
        : null,
      expected,
      strata: layers.map((stratum) => ({
        size: stratum.length,
        cities: countCities(world, stratum),
        cards: stratum.toSorted(),
      })),
      discard: countCities(world, game.infectionDiscard),
      gameEnd: countCities(
        world,
        game.gameEndArea.filter((id) => id in world.campaign.infectionCards),
      ),
      atRisk,
    },
    incidentsLeft: pack.numbers.incidentLimit - game.incidents,
  };
}

/** Whether the campaign has unlocked Hollow Men: Gather cards among the Infection cards, or Hollow Men at setup. */
export const hollowInPlay = (campaign: Campaign): boolean =>
  campaign.rules.includes("hollowSetup") ||
  Object.values(campaign.infectionCards).some(
    (card) => card.kind === "gather" || card.kind === "assemble",
  );

export const onGrid = (world: World): CityId[] => [...grid(world.campaign)];

/**
 * Where each city's Infection cards are across the campaign: still in play (the Infection deck and its discard pile)
 * or inoculated into storage. A city is fully inoculated once it has stored cards and none left in play.
 */
export function inoculation(
  world: World,
): Partial<Record<CityId, { inPlay: number; stored: number }>> {
  const stored = new Set(world.campaign.stored.infection);
  const counts: Partial<Record<CityId, { inPlay: number; stored: number }>> = {};
  for (const card of Object.values(world.campaign.infectionCards)) {
    if (card.kind !== "city") continue;
    const entry = (counts[card.city] ??= { inPlay: 0, stored: 0 });
    if (stored.has(card.id)) entry.stored++;
    else entry.inPlay++;
  }
  return counts;
}

/** A recon route still to be taken, as the board prints it beside its city. */
export type ReconBox = {
  route: ReconRoute;
  /** The region the recon reveals, or the package's name when it reveals none. */
  name: string;
  /** The locations it reveals, so the box can point at them. */
  reveals: CityId[];
  /** Every legal recon of this route for the active player, one per payment. Empty when it cannot be taken now. */
  actions: Extract<Action, { a: "recon" }>[];
  /**
   * Why it cannot be taken now, from the engine, or null when it can or when the only reason is where the player
   * stands: the box already prints its city, so it does not say so twice.
   */
  reason: string | null;
};

const unlessAway = (reason: string | null) => (reason === AWAY_FROM_ROUTE ? null : reason);

/** Each recon route the players know and have not yet taken, at a city they can see. */
export function reconBoxes(world: World, phase: Phase): ReconBox[] {
  const { campaign, game } = world;
  if (!game) return [];
  const here = game.players[game.active]!.location;
  // Listing every legal action is costly, and a route can only be taken from its own city.
  const legal =
    phase === "playing.actions" && pack.reconRoutes.some((route) => route.city === here)
      ? legalActions(world, game.active)
      : [];
  return pack.reconRoutes.flatMap((route) => {
    if (!campaign.routes.includes(route.id) || reconned(campaign, route)) return [];
    if (!campaign.locations[route.city]?.revealed) return [];
    const inside = route.opens ? unlocksBehind(route.opens) : [];
    const regions = inside.flatMap((unlock) => (unlock.t === "region" ? [unlock.region] : []));
    const havens = new Set(inside.flatMap((unlock) => (unlock.t === "haven" ? [unlock.city] : [])));
    const actions = legal.filter(
      (action): action is ReconBox["actions"][number] =>
        action.a === "recon" && action.route === route.id,
    );
    const probe: Action = { a: "recon", route: route.id, cards: [] };
    return [
      {
        route,
        name: regions.length
          ? pack.regions.find((region) => region.id === regions[0])!.name
          : route.opens
            ? sealDef(route.opens).name
            : `The Plan · ${route.color[0]!.toUpperCase()}${route.color.slice(1)}`,
        reveals: pack.cities
          .filter((city) => (regions.includes(city.region) && !city.lost) || havens.has(city.id))
          .filter((city) => !campaign.locations[city.id]?.revealed)
          .map((city) => city.id),
        actions,
        reason: actions.length
          ? null
          : unlessAway(reject(world, phase, { type: "ACTION", seat: game.active, action: probe })),
      },
    ];
  });
}

/** Rules text the map stickers print on the board, standing beside `city` while it still applies. */
/**
 * Rules text printed on the board while it still applies. It stands beside `city`, or beside `line`, the first red
 * line players can see, of which they may see only stretches.
 */
export type MapNote = { id: string; text: string } & (
  | { city: CityId; line?: never }
  | { line: Point[]; city?: never }
);

const door = (id: DoorId): Seal => ({ t: "door", id });
const box = (id: number): Seal => ({ t: "package", id });

/**
 * The words the map stickers print on the board, each while it still applies: which first arrival opens what, the
 * haven in ruins, the wall around Utopia, and the recon out of Kolkata nobody knows yet. Recon costs live on the
 * recon boxes.
 */
export function mapNotes(campaign: Campaign): MapNote[] {
  const open = (seal: Seal) => isOpen(campaign, seal);
  const revealed = (city: string) => campaign.locations[city as CityId]?.revealed === true;
  const notes: MapNote[] = [];
  const note = (id: string, city: string, text: string) =>
    notes.push({ id, city: city as CityId, text });
  if (open(door("53")) && !open(door("52")))
    note("kolkata-recon", "kolkata", "You do not yet know how to Recon out of Kolkata.");
  if (!revealed("utopia")) {
    if (open(door("58")))
      note("utopia-plan", "utopia", "If you are able to execute the Plan, open Package 8.");
    else if (open(door("56")))
      note("utopia-wall", "utopia", "You cannot access Utopia until the Hollow Men defect.");
  }
  if (revealed("lake-baikal") && open(box(8)) && !open(door("22")))
    note("baikal-arrival", "lake-baikal", "Open door 22 the first time you move to Lake Baikal.");
  if (revealed("haven-indian-ocean") && !open(door("11")))
    note(
      "indian-ocean-arrival",
      "haven-indian-ocean",
      "Open door 11 the first time you move here.",
    );
  if (revealed("haven-eastern-pacific") && !open(box(6)))
    note(
      "eastern-pacific-arrival",
      "haven-eastern-pacific",
      "Open Package 6 the first time you move here.",
    );
  if (revealed("haven-coral-sea"))
    note("coral-sea-ruins", "haven-coral-sea", "This haven is in ruins.");
  const line = pack.redLines
    .map((corners) => corners.map(([x, z]) => ({ x, z })))
    .find((points) => points.some((point) => groundRevealed(campaign, nearestGround(point))));
  if (line)
    notes.push({
      id: "red-lines",
      line,
      text: "A sea lane cannot cross more than one red region line.",
    });
  return notes;
}
