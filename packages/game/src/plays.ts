import { addEdge, checkEdge, finishSearch } from "./actions";
import { pack } from "./content/pack";
import type { AbilityId, Color, ScarId } from "./content/types";
import { restackTop } from "./decks";
import {
  arrive,
  canTakeScar,
  epidemicIncrease,
  expose,
  epidemicInfect,
  freeCharacters,
  guardCards,
  hasScar,
  intensify,
  movePawn,
  scarCandidates,
  scarTargets,
  settleCarried,
} from "./flow";
import {
  cardLabel,
  characterOf,
  cityDef,
  discardFromHand,
  grid,
  handLimit,
  has,
  log,
  player,
  removeFromHand,
  isColor,
} from "./helpers";
import type { CardId, CharacterId, CityId, SeatId } from "./ids";
import { createCharacter } from "./legacy";
import type { Phase } from "./machine";
import { revealDone, revealPick, startReveal, stepReveal } from "./reveal";
import type { Decision, Game, World } from "./state";

const isGridCity = (onGrid: ReadonlySet<CityId>, city: CityId) =>
  onGrid.has(city) && cityDef(city).kind === "city";

/** Event and companion cards, playable by anyone at any time during a game. */
export type Play =
  | { e: "airlift"; pawn: SeatId; to: CityId }
  | { e: "oneQuietNight" }
  | { e: "resilientPopulation"; cards: CardId[] }
  | { e: "teamBravo"; cities: CityId[] }
  | { e: "dataTransfer"; a: SeatId; cardA: CardId; b: SeatId; cardB: CardId }
  | { e: "dispersal"; from: CityId; to: CityId[] }
  | { e: "drasticMeasures"; cities: CityId[] }
  /** The top Infection cards, top first, in the order they go back. */
  | { e: "extendedForecast"; order: CardId[] }
  | { e: "hiddenStockpile"; city: CityId }
  /** Takes a Rationed Event from the discard pile and plays it at once, as `played`. */
  | { e: "itWorkedTheFirstTime"; card: CardId; played: Play }
  | { e: "extendedTime" }
  | { e: "inoculationUnit"; cards: CardId[] }
  | { e: "expeditionaryVoyage"; to: CityId }
  | { e: "cautiousApproach" }
  | { e: "biodomePrototype"; cities: CityId[] }
  | { e: "decontaminationKit"; city: CityId }
  | { e: "strategicReserves" }
  | { e: "relocation"; cards: CardId[] }
  | { e: "topazExperimentalVaccine" }
  | { e: "renewal"; seat: SeatId; ability: AbilityId; slot: number }
  | { e: "portableAntiviralLab" }
  | { e: "herbalist" }
  | { e: "containmentSpecialist"; city: CityId }
  | { e: "builder"; city: CityId }
  | { e: "localResistance"; city: CityId }
  | { e: "riotControl" }
  | { e: "informant" }
  | { e: "mobileShelters"; cities: CityId[] };

const ok = null;

/** Events whose printed text permits playing them between Step 2 (Infect) and Step 3 (Intensify) of an Epidemic. */
const EPIDEMIC_INTENSIFY_EVENTS = new Set<Play["e"]>(["resilientPopulation", "inoculationUnit", "relocation"]);

/** The Utopia Infection cards in the discard pile, which Riot Control and the Informant set aside. */
const utopiaDiscards = (world: World) =>
  world.game!.infectionDiscard.filter((id) => {
    const card = world.campaign.infectionCards[id];
    return card?.kind === "city" && card.city === "utopia";
  });
const HANDOUT = 2;
const SPREAD_OUT = 3;
const CLEANSE = 2;
const FORECAST = 8;
const CACHE = 6;
const SECOND_WIND = 3;
const MASS_INOCULATION = 3;
const STOCK_UP = 8;
const EXILE = 3;
const MENTOR_COST = 2;
const SURPLUS = 3;

/** How many times each entry appears, for plays that may name one city twice. */
function tally<T>(items: readonly T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
}

/** Whether playing this card reveals hidden deck information, so undoing it requires a consensus vote. */
export function playReveals(play: Play): boolean {
  if (play.e === "extendedForecast" || play.e === "cautiousApproach") return true;
  if (play.e === "itWorkedTheFirstTime") return playReveals(play.played);
  return false;
}

/** The top of the Infection deck that Extended Forecast rearranges. */
export function forecastCards(game: Game): CardId[] {
  return game.infectionDeck.order.slice(0, FORECAST);
}

function sameCityDiscards(world: World, cards: readonly CardId[], max: number): boolean {
  const { campaign, game } = world as { campaign: World["campaign"]; game: Game };
  const cities = new Set(
    cards.map((target) => {
      const infection = campaign.infectionCards[target];
      return game.infectionDiscard.includes(target) && infection?.kind === "city"
        ? infection.city
        : null;
    }),
  );
  return (
    cards.length >= 1 &&
    cards.length <= max &&
    new Set(cards).size === cards.length &&
    cities.size === 1 &&
    !cities.has(null)
  );
}

function removePlague(game: Game, city: CityId, amount: number) {
  const location = game.locations[city]!;
  location.plague -= Math.min(amount, location.plague);
}

/** `phase` is the step of the turn the card would be played in, which a few events depend on. */
export function checkPlay(
  world: World,
  seat: SeatId,
  card: CardId,
  play: Play,
  phase: Phase,
): string | null {
  const { campaign, game } = world;
  if (!game || game.outcome) return "No game in progress";
  const held = campaign.playerCards[card];
  const owner = game.players[seat];
  if (!owner?.hand.includes(card) || !held) return "You do not hold that card";
  const id = held.kind === "event" ? held.event : held.kind === "city" ? held.companion : null;
  if (id !== play.e) return "That card does not do that";
  // No Event may be played between drawing a card and resolving it, or between the two Player draws,
  // except cards whose printed text explicitly permits an Epidemic step window.
  const unresolved = game.pending[0]?.t;
  if (unresolved === "shield" || unresolved === "brokenLink")
    return "Resolve the card that was just drawn first";
  if (unresolved === "guard") return "Choose how the Soldier gets past the Hollow Men first";
  if (unresolved === "scarVote") return "Choose who takes the scar first";
  if (unresolved === "reveal" || unresolved === "search")
    return "Let the table see what was turned over first";
  if (unresolved === "workerReturn")
    return "Choose which haven the haven worker returns to first";
  if (unresolved === "awardCard") return "Choose who receives the new card first";
  // A designer ruling: a Gather card and the city it gathers in are one draw, with no Event window between them.
  if (game.gathering) return "Flip the card the Hollow Men gather in first";
  if (unresolved === "epidemicDrawn" && play.e !== "topazExperimentalVaccine")
    return "Only TOPAZ Experimental Vaccine can be played before an Epidemic strikes";
  if (unresolved === "epidemicInfect")
    return "Finish Step 2 of the Epidemic before playing Events";
  if (unresolved === "intensify" && !EPIDEMIC_INTENSIFY_EVENTS.has(play.e))
    return "Only Resilient Population, Inoculation Unit, or Relocation may be played between Step 2 and Step 3 of an Epidemic";
  if (phase === "playing.draw" && game.drawsLeft === 1 && !unresolved)
    return "Draw your second Player card before playing Events";
  const onGrid = grid(campaign);
  const onMap = (city: CityId) => campaign.locations[city]?.revealed === true;
  const here = owner.location;
  switch (play.e) {
    case "airlift": {
      if (
        !game.players[play.pawn] ||
        !onMap(play.to) ||
        player(game, play.pawn).location === play.to
      )
        return "Pick a pawn and a different location";
      return characterOf(world, play.pawn).carrier ? "The carrier cannot be moved" : ok;
    }
    case "oneQuietNight":
      return game.skipInfection ? "The next Infect step is already skipped" : ok;
    case "resilientPopulation":
      return sameCityDiscards(world, play.cards, 2)
        ? ok
        : "Pick 1 or 2 discarded Infection cards of one city";
    case "teamBravo":
      if (play.cities.length < 1 || play.cities.length > HANDOUT)
        return `Pick 1 to ${HANDOUT} locations`;
      if (!play.cities.every(onMap)) return "Pick locations on the map";
      return game.stockpile >= play.cities.length
        ? ok
        : "The stockpile does not hold that many cubes";
    case "dispersal": {
      const from = game.locations[play.from];
      if (cityDef(play.from).kind !== "haven" || !onGrid.has(play.from) || !from)
        return "Pick a haven on the grid";
      if (play.to.length < 1 || play.to.length > SPREAD_OUT) return `Move 1 to ${SPREAD_OUT} cubes`;
      if (!play.to.every((city) => onGrid.has(city) && city !== play.from))
        return "Pick other locations on the grid";
      return from.supplies >= play.to.length ? ok : "The haven does not hold that many cubes";
    }
    case "drasticMeasures": {
      if (play.cities.length < 1 || play.cities.length > CLEANSE)
        return `Remove 1 to ${CLEANSE} Plague cubes`;
      const counts = tally(play.cities);
      return [...counts].every(
        ([city, count]) => onGrid.has(city) && (game.locations[city]?.plague ?? 0) >= count,
      )
        ? ok
        : "Pick Plague cubes on the grid";
    }
    case "extendedForecast": {
      const top = forecastCards(game);
      if (top.length === 0) return "The Infection deck is empty";
      const same = play.order.length === top.length && new Set(play.order).size === top.length;
      return same && play.order.every((id) => top.includes(id))
        ? ok
        : "Put back exactly the top Infection cards";
    }
    case "hiddenStockpile": {
      if (game.reserve === 0) return "The reserve is empty";
      const pawned = game.seats.some((other) => player(game, other).location === play.city);
      return pawned ? ok : "Pick a location with a pawn";
    }
    case "itWorkedTheFirstTime": {
      const target = campaign.playerCards[play.card];
      return game.playerDiscard.includes(play.card) &&
        target?.kind === "event" &&
        target.mode === "rationed" &&
        target.event !== "itWorkedTheFirstTime"
        ? checkPlay(
            {
              ...world,
              game: {
                ...game,
                // The It Worked the First Time card is already played, so the event it takes cannot be aimed at it.
                players: {
                  ...game.players,
                  [seat]: {
                    ...owner,
                    hand: [...owner.hand.filter((id) => id !== card), play.card],
                  },
                },
                playerDiscard: game.playerDiscard.filter((id) => id !== play.card),
              },
            },
            seat,
            play.card,
            play.played,
            phase,
          )
        : "Pick another Rationed Event from the Player discard pile";
    }
    case "extendedTime":
      return phase === "playing.actions" ? ok : "Extended Time is played during the action step";
    case "inoculationUnit": {
      if (!campaign.rules.includes("storage")) return "Package 6 is not open yet";
      const cards = play.cards;
      if (
        cards.length < 1 ||
        cards.length > MASS_INOCULATION ||
        new Set(cards).size !== cards.length
      )
        return `Pick 1 to ${MASS_INOCULATION} cards`;
      if (!cards.every((target) => game.infectionDiscard.includes(target)))
        return "Pick cards from the Infection discard pile";
      return campaign.stored.infection.length + cards.length <= pack.numbers.storageCap
        ? ok
        : "Storage is full";
    }
    case "cautiousApproach":
      return game.playerDeck.order.length >= 4 ? ok : "Fewer than 4 Player cards are left";
    case "expeditionaryVoyage":
      return checkEdge(campaign, player(game, game.active).location, play.to, "sea", true);
    case "biodomePrototype": {
      const onGrid = grid(campaign);
      const fresh = play.cities.every(
        (city) => game.locations[city] && !game.locations[city].shelter && isGridCity(onGrid, city),
      );
      const count = play.cities.length;
      return count >= 1 &&
        count <= 3 &&
        new Set(play.cities).size === count &&
        fresh &&
        game.pieces.shelter >= count
        ? ok
        : "Pick up to 3 cities on the grid without a shelter";
    }
    case "decontaminationKit":
    case "containmentSpecialist":
      return onGrid.has(play.city) && (game.locations[play.city]?.plague ?? 0) > 0
        ? ok
        : "Pick a location on the grid with Plague cubes";
    case "strategicReserves":
      return game.reserve > 0 ? ok : "The reserve is empty, so there is nothing to move";
    case "relocation":
      return sameCityDiscards(world, play.cards, EXILE)
        ? ok
        : `Pick 1 to ${EXILE} discarded Infection cards of one city`;
    case "topazExperimentalVaccine":
      return unresolved === "epidemicDrawn" ? ok : "Play it when an Epidemic is drawn";
    case "renewal": {
      if (!game.players[play.seat]) return "Pick a character in this game";
      const character = characterOf(world, play.seat);
      const ability = pack.abilities.find((entry) => entry.id === play.ability);
      if (!ability || !campaign.abilitiesForSale.includes(play.ability))
        return "That ability is not in the box";
      if (ability.cost > MENTOR_COST) return `Pick an ability that costs ${MENTOR_COST} or less`;
      if (character.slots.some((slot) => slot?.id === play.ability))
        return "The character already has it";
      const slot = character.slots[play.slot];
      if (slot === undefined) return "Pick a slot on the card";
      const coverable = slot === null || (slot.kind === "scar" && slot.id !== "carrier");
      return coverable ? ok : "Pick an empty slot or a scar";
    }
    case "dataTransfer": {
      const first = game.players[play.a];
      const second = game.players[play.b];
      return first &&
        second &&
        play.a !== play.b &&
        first.hand.includes(play.cardA) &&
        second.hand.includes(play.cardB) &&
        play.cardA !== card &&
        play.cardB !== card
        ? ok
        : "Pick one card from each of two players";
    }
    case "portableAntiviralLab":
      if (
        phase !== "playing.actions" ||
        seat !== game.active ||
        !player(game, seat).used.includes("madeSupplies")
      )
        return "Play it after you Make Supplies this turn";
      return game.stockpile > 0 || (has(world, seat, "immunologist") && game.reserve > 0)
        ? ok
        : "No cubes left to take";
    case "herbalist":
      return game.locations[here]!.plague > 0 ? ok : "No Plague cubes in your location";
    case "builder":
      return game.locations[play.city] &&
        !game.locations[play.city].shelter &&
        isGridCity(onGrid, play.city) &&
        game.pieces.shelter > 0
        ? ok
        : "Pick a city on the grid without a shelter";
    case "localResistance":
      return onGrid.has(play.city) && (game.locations[play.city]?.hollow ?? 0) > 0
        ? ok
        : "Pick a location on the grid with Hollow Men";
    case "riotControl":
    case "informant":
      return utopiaDiscards(world).length > 0
        ? ok
        : "No Utopia Infection cards in the discard pile";
    case "mobileShelters": {
      const fresh = play.cities.every(
        (city) => grid(campaign).has(city) && !game.locations[city]!.shelter,
      );
      const count = play.cities.length;
      return count >= 1 &&
        count <= 2 &&
        new Set(play.cities).size === count &&
        fresh &&
        game.pieces.shelter >= count
        ? ok
        : "Pick up to 2 grid locations without a shelter";
    }
  }
}

/** What a played event was aimed at, for the log. */
/** "Istanbul ×2, Cairo": a city named once, with how many times it was picked. */
function cityTally(cities: CityId[]): string {
  return [...tally(cities)]
    .map(([city, count]) => (count > 1 ? `${cityDef(city).name} ×${count}` : cityDef(city).name))
    .join(", ");
}

export function playDetail(world: World, play: Play): string {
  const { campaign } = world;
  const who = (seat: SeatId) => characterOf(world, seat).name;
  const card = (id: CardId) => {
    const held = campaign.playerCards[id];
    if (held?.kind === "city") return cityDef(held.city).name;
    if (held?.kind === "event") return pack.events.find((entry) => entry.id === held.event)!.name;
    const infection = campaign.infectionCards[id];
    return infection?.kind === "city" ? cityDef(infection.city).name : (held?.kind ?? "a card");
  };
  switch (play.e) {
    case "airlift":
      return `${who(play.pawn)} to ${cityDef(play.to).name}`;
    case "dataTransfer":
      return `${who(play.a)} gives ${card(play.cardA)}, ${who(play.b)} gives ${card(play.cardB)}`;
    case "resilientPopulation":
    case "inoculationUnit":
    case "relocation":
      return play.cards.map(card).join(", ");
    case "itWorkedTheFirstTime": {
      const then = playDetail(world, play.played);
      return then ? `${card(play.card)}: ${then}` : card(play.card);
    }
    case "expeditionaryVoyage":
      return `${cityDef(world.game!.players[world.game!.active]!.location).name} to ${cityDef(play.to).name}`;
    case "biodomePrototype":
    case "mobileShelters":
    case "teamBravo":
    case "drasticMeasures":
      return cityTally(play.cities);
    case "dispersal":
      return `${cityDef(play.from).name} to ${cityTally(play.to)}`;
    case "renewal":
      return `${who(play.seat)} learns ${pack.abilities.find((entry) => entry.id === play.ability)!.name}`;
    case "hiddenStockpile":
    case "decontaminationKit":
    case "containmentSpecialist":
    case "builder":
    case "localResistance":
      return cityDef(play.city).name;
    default:
      return "";
  }
}

export function applyPlay(world: World, seat: SeatId, card: CardId, play: Play) {
  resolvePlay(world, seat, card, play);
  settleCarried(world);
}

function resolvePlay(world: World, seat: SeatId, card: CardId, play: Play) {
  const { campaign, game } = world as { campaign: World["campaign"]; game: Game };
  const held = campaign.playerCards[card]!;
  const owner = player(game, seat);
  removeFromHand(game, seat, card);
  const destroyed = held.kind === "event" && held.mode === "unrationed";
  if (destroyed) delete campaign.playerCards[card];
  else game.playerDiscard.push(card);
  if (held.kind === "event")
    log(game, { t: "event", seat, event: held.event, detail: playDetail(world, play) });
  if (held.kind === "city" && held.companion) {
    const companion = held.companion;
    const name = pack.companions.find((entry) => entry.id === companion)!.name;
    const where = playDetail(world, play) || cityDef(owner.location).name;
    log(game, { t: "note", text: `${characterOf(world, seat).name} played ${name}: ${where}` });
  }

  switch (play.e) {
    case "airlift":
      movePawn(world, play.pawn, play.to, "airlift");
      return;
    case "oneQuietNight":
      // Played before the first flip of an Infect step, it skips that step. Any other time it waits for the next one.
      if (
        game.infectionsLeft > 0 &&
        game.infectionsLeft === pack.numbers.infectionRates[game.rateIndex]
      )
        game.infectionsLeft = 0;
      else game.skipInfection = true;
      return;
    case "resilientPopulation":
      for (const target of play.cards) {
        game.infectionDiscard.splice(game.infectionDiscard.indexOf(target), 1);
        game.gameEndArea.push(target);
      }
      if (game.pending[0]?.t === "intensify") {
        game.pending.shift();
        intensify(world);
      }
      return;
    case "teamBravo":
      for (const city of play.cities) {
        game.stockpile -= 1;
        game.locations[city]!.supplies += 1;
      }
      return;
    case "dispersal":
      for (const city of play.to) {
        game.locations[play.from]!.supplies -= 1;
        game.locations[city]!.supplies += 1;
      }
      return;
    case "drasticMeasures":
      for (const city of play.cities) removePlague(game, city, 1);
      return;
    case "extendedForecast":
      restackTop(game.infectionDeck, play.order);
      return;
    case "hiddenStockpile": {
      const amount = Math.min(CACHE, game.reserve);
      game.reserve -= amount;
      game.locations[play.city]!.supplies += amount;
      return;
    }
    case "itWorkedTheFirstTime":
      game.playerDiscard.splice(game.playerDiscard.indexOf(play.card), 1);
      owner.hand.push(play.card);
      return resolvePlay(world, seat, play.card, play.played);
    case "extendedTime":
      game.actionsLeft += SECOND_WIND;
      return;
    case "inoculationUnit":
      for (const target of play.cards) {
        game.infectionDiscard.splice(game.infectionDiscard.indexOf(target), 1);
        campaign.stored.infection.push(target);
      }
      if (game.pending[0]?.t === "intensify" && game.infectionDiscard.length === 0) {
        game.pending.shift();
        intensify(world);
      }
      return;
    case "relocation":
      for (const target of play.cards) {
        game.infectionDiscard.splice(game.infectionDiscard.indexOf(target), 1);
        delete campaign.infectionCards[target];
      }
      return;
    case "topazExperimentalVaccine":
      game.pending.shift();
      log(game, { t: "note", text: "The Epidemic was discarded with no effect" });
      return;
    case "renewal": {
      const character = characterOf(world, play.seat);
      campaign.abilitiesForSale.splice(campaign.abilitiesForSale.indexOf(play.ability), 1);
      character.slots[play.slot] = { kind: "ability", id: play.ability };
      return;
    }
    case "cautiousApproach":
      startReveal(game, game.active, { t: "cautiousApproach" });
      return;
    case "expeditionaryVoyage":
      addEdge(world, player(game, game.active).location, play.to, "sea", true);
      return;
    case "riotControl":
    case "informant":
      for (const target of utopiaDiscards(world).slice(0, 4)) {
        game.infectionDiscard.splice(game.infectionDiscard.indexOf(target), 1);
        game.gameEndArea.push(target);
      }
      return;
    case "mobileShelters":
    case "biodomePrototype":
      for (const city of play.cities) {
        game.locations[city]!.shelter = true;
        game.pieces.shelter -= 1;
        log(game, { t: "structure", city, structure: "shelter" });
      }
      return;
    case "decontaminationKit":
    case "containmentSpecialist":
      removePlague(game, play.city, pack.numbers.maxPlaguePerCity);
      return;
    case "strategicReserves": {
      const amount = Math.min(STOCK_UP, game.reserve);
      game.reserve -= amount;
      game.stockpile += amount;
      return;
    }
    case "dataTransfer":
      removeFromHand(game, play.a, play.cardA);
      removeFromHand(game, play.b, play.cardB);
      player(game, play.a).hand.push(play.cardB);
      player(game, play.b).hand.push(play.cardA);
      return;
    case "portableAntiviralLab": {
      let remaining = SURPLUS;
      if (has(world, seat, "immunologist") && game.reserve > 0) {
        const fromReserve = Math.min(remaining, game.reserve);
        game.reserve -= fromReserve;
        owner.supplies += fromReserve;
        remaining -= fromReserve;
      }
      const fromStockpile = Math.min(remaining, game.stockpile);
      game.stockpile -= fromStockpile;
      owner.supplies += fromStockpile;
      return;
    }
    case "herbalist":
      removePlague(game, owner.location, 1);
      return;
    case "builder":
      game.locations[play.city]!.shelter = true;
      game.pieces.shelter -= 1;
      log(game, { t: "structure", city: play.city, structure: "shelter" });
      return;
    case "localResistance":
      game.locations[play.city]!.hollow -= 1;
      game.pieces.hollow += 1;
      return;
  }
}

/** Answers to the choice at the front of the pending queue, or a hand-limit discard. */
export type Decide =
  | { d: "discard"; seat: SeatId; cards: CardId[] }
  /** `seat` names the character when the group is choosing who takes the scar. */
  | { d: "scar"; scar: ScarId; target: number | "job"; seat?: SeatId }
  | { d: "replace"; character: CharacterId | null }
  | { d: "workerReturn"; to: CityId }
  | { d: "retrieve"; card: CardId }
  | { d: "freeEdge"; to: CityId }
  /** One Hollow Man at a time: the choice stays open while some of its amount is left, until it is skipped. */
  | { d: "removeHollow"; city: CityId }
  | { d: "quarantineCard"; card: CardId }
  | { d: "giveCard"; card: CardId; to: SeatId }
  | { d: "awardCard"; to: SeatId }
  | { d: "shield"; seat: SeatId; card: CardId }
  | { d: "brokenLink"; seat: SeatId; card: CardId }
  /** The City card a Soldier discards to leave Hollow Men. Skipping the choice is being exposed instead. */
  | { d: "guard"; seat: SeatId; card: CardId }
  /** Turns over the next card of a reveal, or puts them all away once every one is face up (with `keep` when Monitor chooses). */
  | { d: "reveal"; keep?: CardId[] }
  /** The table has seen the search: what it found happens. */
  | { d: "search" }
  | { d: "skip" };

const PASSED: Partial<Record<string, string>> = {
  retrieve: "no card taken back from the discard pile",
  freeEdge: "no free line drawn",
  removeHollow: "no Hollow Men removed",
  quarantineCard: "no Infection card quarantined",
  giveCard: "no card given",
  brokenLink: "Broken Link was not used",
};

const OPTIONAL = new Set([
  "retrieve",
  "freeEdge",
  "removeHollow",
  "quarantineCard",
  "giveCard",
  "shield",
  "brokenLink",
  "guard",
  "intensify",
  "epidemicInfect",
  "epidemicDrawn",
]);

export function checkDecide(world: World, decide: Decide): string | null {
  const { campaign, game } = world;
  if (!game || game.outcome) return "No game in progress";
  const pending = game.pending[0];
  if (decide.d === "discard") {
    const owner = game.players[decide.seat];
    if (
      !owner ||
      !decide.cards.length ||
      new Set(decide.cards).size !== decide.cards.length ||
      !decide.cards.every((card) => owner.hand.includes(card))
    )
      return "Pick cards from that hand";
    const forced = pending?.t === "discard" && pending.seat === decide.seat ? pending.count : 0;
    // The hand limit is applied after both cards of the draw, since the second may change what is worth keeping.
    if (!forced && game.drawsLeft > 0) return "Draw both cards first";
    const excess = Math.max(0, owner.hand.length - handLimit(world, decide.seat));
    return decide.cards.length <= Math.max(forced, excess)
      ? ok
      : "That is more than you need to discard";
  }
  if (!pending) return "Nothing to decide";
  if (decide.d === "skip") return OPTIONAL.has(pending.t) ? ok : "This choice cannot be skipped";
  if (decide.d !== pending.t) return "A different choice is pending";
  switch (decide.d) {
    case "scar": {
      const seat = (pending as { seat: SeatId | null }).seat ?? decide.seat;
      if (!seat || !game.players[seat]) return "Pick who takes the scar";
      const character = characterOf(world, seat);
      if (!campaign.scars.includes(decide.scar) || decide.scar === "carrier")
        return "That scar is not available";
      if (hasScar(character, decide.scar)) return "This character already carries that scar";
      return scarTargets(character).includes(decide.target) ? ok : "A scar cannot go there";
    }
    case "replace": {
      const free = freeCharacters(world);
      if (decide.character === null)
        return free.length === 0 ? ok : "A living character is still free";
      return free.some((character) => character.id === decide.character)
        ? ok
        : "That character is not free";
    }
    case "workerReturn":
      return cityDef(decide.to).kind === "haven" && grid(campaign).has(decide.to)
        ? ok
        : "Pick a haven on the grid";
    case "retrieve": {
      const card = campaign.playerCards[decide.card];
      return game.playerDiscard.includes(decide.card) && card && card.kind !== "epidemic"
        ? ok
        : "Pick a card from the Player discard pile";
    }
    case "freeEdge": {
      const seat = (pending as { seat: SeatId }).seat;
      const kind = (pending as { kind: "land" | "sea" }).kind;
      return checkEdge(
        campaign,
        player(game, seat).location,
        decide.to,
        kind,
        (pending as { ignoreRedLines: boolean }).ignoreRedLines,
      );
    }
    case "removeHollow":
      return (game.locations[decide.city]?.hollow ?? 0) > 0 ? ok : "Pick a Hollow Man on the board";
    case "quarantineCard":
      return game.infectionDiscard.includes(decide.card)
        ? ok
        : "Pick a card from the Infection discard pile";
    case "giveCard": {
      const from = (pending as { seat: SeatId }).seat;
      if (!player(game, from).hand.includes(decide.card)) return "Pick a card from your hand";
      return decide.to !== from && game.seats.includes(decide.to) ? ok : "Pick another player";
    }
    case "awardCard":
      return game.seats.includes(decide.to) ? ok : "Pick a player";
    case "brokenLink":
      return game.players[decide.seat]?.hand.includes(decide.card)
        ? ok
        : "Discard a card from a hand";
    case "guard":
      return decide.seat === (pending as { seat: SeatId }).seat &&
        guardCards(world, decide.seat).includes(decide.card)
        ? ok
        : "Discard a City card of your location's colour";
    case "reveal": {
      const reveal = pending as Extract<Decision, { t: "reveal" }>;
      if (!revealDone(game, reveal))
        return decide.keep === undefined ? ok : "Turn over every card first";
      const { eligible, take } = revealPick(world, reveal);
      if (take === 0 || eligible.length <= take) {
        if (decide.keep === undefined) return ok;
        const same =
          decide.keep.length === take &&
          new Set(decide.keep).size === take &&
          decide.keep.every((id) => eligible.includes(id));
        return same ? ok : "Those cards cannot be kept";
      }
      if (!decide.keep || decide.keep.length !== take)
        return `Pick ${take} card${take === 1 ? "" : "s"} to keep`;
      if (
        new Set(decide.keep).size !== take ||
        !decide.keep.every((id) => eligible.includes(id))
      )
        return "Pick non-Epidemic cards from the ones turned over";
      return ok;
    }
    case "search":
      return ok;
    case "shield": {
      const card = campaign.playerCards[decide.card];
      const color = (pending as { color: string }).color;
      return game.players[decide.seat]?.hand.includes(decide.card) &&
        card?.kind === "city" &&
        isColor(card, color as Color)
        ? ok
        : "Discard a City card of the city's colour";
    }
  }
}

export function applyDecide(world: World, decide: Decide) {
  const { campaign, game } = world as { campaign: World["campaign"]; game: Game };
  const pending = game.pending[0];
  if (decide.d === "discard") {
    log(game, {
      t: "note",
      text: `${characterOf(world, decide.seat).name} discarded ${decide.cards.map((card) => cardLabel(campaign, card)).join(", ")}`,
    });
    for (const card of decide.cards) discardFromHand(game, decide.seat, card);
    if (pending?.t === "discard" && pending.seat === decide.seat) {
      pending.count -= decide.cards.length;
      if (pending.count <= 0 || player(game, decide.seat).hand.length === 0) game.pending.shift();
    }
    return;
  }
  if (decide.d === "reveal" && pending?.t === "reveal")
    return stepReveal(world, pending, decide.keep);
  if (decide.d === "removeHollow" && pending?.t === "removeHollow") {
    game.locations[decide.city]!.hollow -= 1;
    game.pieces.hollow += 1;
    log(game, { t: "note", text: `A Hollow Man was removed from ${cityDef(decide.city).name}` });
    pending.amount -= 1;
    if (pending.amount <= 0) game.pending.shift();
    return;
  }
  game.pending.shift();
  if (
    decide.d === "skip" &&
    pending &&
    pending.t !== "intensify" &&
    pending.t !== "epidemicInfect" &&
    pending.t !== "epidemicDrawn"
  )
    log(game, {
      t: "note",
      text:
        pending.t === "shield"
          ? `Nobody discarded a card to keep the cube in ${cityDef(pending.city).name}`
          : pending.t === "guard"
            ? `${characterOf(world, pending.seat).name} kept their cards and faced the Hollow Men`
            : `The choice was passed: ${PASSED[pending.t] ?? pending.t}`,
    });
  if (decide.d === "skip" && pending?.t === "guard") {
    const from = player(game, pending.seat).location;
    expose(world, pending.seat);
    if (!characterOf(world, pending.seat).dead && player(game, pending.seat).location === from)
      arrive(world, pending.seat, pending.to, pending.by);
    return;
  }
  if (decide.d === "skip" && pending?.t === "intensify") intensify(world);
  if (decide.d === "skip" && pending?.t === "epidemicInfect") epidemicInfect(world);
  if (decide.d === "skip" && pending?.t === "epidemicDrawn") epidemicIncrease(world);
  if (decide.d === "skip" || !pending) return;
  const seat =
    ("seat" in pending ? pending.seat : null) ??
    ("seat" in decide ? decide.seat : null) ??
    game.active;
  switch (decide.d) {
    case "scar": {
      const character = characterOf(world, seat);
      campaign.scars.splice(campaign.scars.indexOf(decide.scar), 1);
      if (decide.target === "job") character.jobScar = decide.scar;
      else character.slots[decide.target] = { kind: "scar", id: decide.scar };
      const { at } = pending as Extract<Decision, { t: "scar" }>;
      character.scarred[decide.scar] = { at, month: campaign.month };
      log(game, { t: "scar", seat, character: character.id, scar: decide.scar, at });
      return;
    }
    case "replace": {
      const current = player(game, seat);
      const next =
        decide.character ??
        createCharacter(campaign, {
          name: "Haven worker",
          job: null,
          home: pack.cities.find((city) => city.kind === "haven" && !city.lost)!.id,
          worker: true,
        }).id;
      current.character = next;
      current.location = campaign.characters[next]!.home;
      if (decide.character === null) game.pending.unshift({ t: "workerReturn", seat });
      return;
    }
    case "workerReturn": {
      const current = player(game, seat);
      current.location = decide.to;
      characterOf(world, seat).home = decide.to;
      log(game, {
        t: "note",
        text: `${characterOf(world, seat).name} returned to ${cityDef(decide.to).name}`,
      });
      return;
    }
    case "retrieve": {
      game.playerDiscard.splice(game.playerDiscard.indexOf(decide.card), 1);
      player(game, seat).hand.push(decide.card);
      const taken = campaign.playerCards[decide.card]!;
      log(game, {
        t: "note",
        text: `Took ${taken.kind === "city" ? cityDef(taken.city).name : `a ${taken.kind} card`} from the discard pile`,
      });
      return;
    }
    case "freeEdge":
      addEdge(
        world,
        player(game, seat).location,
        decide.to,
        (pending as { kind: "land" | "sea" }).kind,
        true,
      );
      return;
    case "giveCard": {
      player(game, seat).hand = player(game, seat).hand.filter((card) => card !== decide.card);
      player(game, decide.to).hand.push(decide.card);
      log(game, {
        t: "note",
        text: `${cardLabel(campaign, decide.card)} was given to another player`,
      });
      return;
    }
    case "awardCard": {
      const { card } = pending as Extract<Decision, { t: "awardCard" }>;
      player(game, decide.to).hand.push(card);
      log(game, {
        t: "note",
        text: `${characterOf(world, decide.to).name} took ${cardLabel(campaign, card)}`,
      });
      return;
    }
    case "quarantineCard": {
      game.infectionDiscard.splice(game.infectionDiscard.indexOf(decide.card), 1);
      game.gameEndArea.push(decide.card);
      const aside = campaign.infectionCards[decide.card]!;
      if (aside.kind === "city")
        log(game, {
          t: "note",
          text: `An Infection card of ${cityDef(aside.city).name} was set aside until the game ends`,
        });
      return;
    }
    case "brokenLink":
      discardFromHand(game, decide.seat, decide.card);
      game.infectionsLeft = 0;
      log(game, {
        t: "note",
        text: `${characterOf(world, decide.seat).name} discarded a card for Broken Link: the rest of this Infect step is called off`,
      });
      return;
    case "search": {
      const { card, box } = pending as Extract<Decision, { t: "search" }>;
      return finishSearch(world, seat, card, box);
    }
    case "guard": {
      const { to, by } = pending as Extract<Decision, { t: "guard" }>;
      discardFromHand(game, decide.seat, decide.card);
      log(game, {
        t: "note",
        text: `${characterOf(world, decide.seat).name} discarded ${cardLabel(campaign, decide.card)} to slip past the Hollow Men`,
      });
      arrive(world, decide.seat, to, by);
      return;
    }
    case "shield": {
      const city = (pending as { city: CityId }).city;
      discardFromHand(game, decide.seat, decide.card);
      game.locations[city]!.supplies += 1;
      game.stockpile -= 1;
      log(game, {
        t: "note",
        text: `${characterOf(world, decide.seat).name} discarded a card to keep the cube in ${cityDef(city).name}`,
      });
      return;
    }
  }
}

/** A pending scar or replacement the engine can settle without asking, because there is nothing to choose. */
export function autoResolve(world: World) {
  const game = world.game;
  if (!game) return;
  for (;;) {
    const pending = game.pending[0];
    if (!pending) return;
    const scarFor = pending.t === "scar" ? (pending.seat ? [pending.seat] : game.seats) : [];
    if (
      pending.t === "scar" &&
      !scarFor.some((seat) => canTakeScar(world, characterOf(world, seat)))
    )
      game.pending.shift();
    else if (pending.t === "scarVote" && scarCandidates(world, pending).length === 0)
      game.pending.shift();
    else if (pending.t === "discard" && player(game, pending.seat).hand.length === 0)
      game.pending.shift();
    else if (pending.t === "giveCard" && player(game, pending.seat).hand.length === 0)
      game.pending.shift();
    else if (pending.t === "awardCard" && !(pending.card in world.campaign.playerCards))
      game.pending.shift();
    else if (
      pending.t === "removeHollow" &&
      !Object.values(game.locations).some((location) => location.hollow > 0)
    )
      game.pending.shift();
    else return;
  }
}
