import type { Action } from "./actions";
import { pack } from "./content/pack";
import { sealKey } from "./content/types";
import type { CardId, CityId, SeatId } from "./ids";
import type { Command, GameActor, Phase, Save } from "./machine";
import { paddedTrack } from "./legacy";
import { createGameActor, phaseOf, reject } from "./machine";
import { legalDecides } from "./options";
import { campaignAt } from "./scenarios";
import type { Game, World } from "./state";

export const A = "seat-1" as SeatId;
export const B = "seat-2" as SeatId;
export const C = "seat-3" as SeatId;
export const city = (id: string) => id as CityId;

export const worldOf = (actor: GameActor) => actor.getSnapshot().context.world;
export const gameOf = (actor: GameActor) => worldOf(actor).game!;
export const phase = (actor: GameActor) => phaseOf(actor.getSnapshot());

export function send(actor: GameActor, command: Command) {
  const reason = reject(worldOf(actor), phase(actor), command);
  if (reason) throw new Error(`${command.type} rejected: ${reason}`);
  actor.send(command);
}

/** Takes a game just started through setup to its first action step: supplies spread, the opening cards flipped, hands dealt. */
export function setUp(actor: GameActor) {
  if (worldOf(actor).campaign.briefing.length) actor.send({ type: "ACK_BRIEFING" });
  send(actor, { type: "AUTO_SUPPLY" });
  send(actor, { type: "CONFIRM_SUPPLY" });
  while (phase(actor) === "setup.infect") send(actor, { type: "INFECT" });
  send(actor, { type: "CONFIRM_EVENTS" });
}

/** The player whose turn it is passes it on, as they do once the last Infection card is flipped. */
export const passTurn = (actor: GameActor) =>
  send(actor, { type: "END_TURN", seat: gameOf(actor).active });

export const act = (actor: GameActor, action: Action, seat = A) =>
  send(actor, { type: "ACTION", seat, action });
/** Turns over every card a Monitor or Cautious Approach reveals and lets a scratched search take effect. */
export function showReveals(actor: GameActor) {
  for (
    let pending = gameOf(actor).pending[0];
    pending?.t === "reveal" || pending?.t === "search";
  ) {
    const decide = legalDecides(worldOf(actor)).find((entry) => entry.d === pending.t);
    if (!decide) throw new Error(`No legal decide for pending ${pending.t}`);
    send(actor, { type: "DECIDE", decide });
    pending = gameOf(actor).pending[0];
  }
}
export const refuses = (actor: GameActor, action: Action, seat = A) =>
  reject(worldOf(actor), phase(actor), { type: "ACTION", seat, action });
export const character = (world: World, seat: SeatId) =>
  world.campaign.characters[world.game!.players[seat]!.character]!;

export function cityCards(world: World, id: string, count = 1): CardId[] {
  return Object.values(world.campaign.playerCards)
    .filter((card) => card.kind === "city" && card.city === id)
    .slice(0, count)
    .map((card) => card.id);
}

export function infectionCards(world: World, id: string, count = 1): CardId[] {
  return Object.values(world.campaign.infectionCards)
    .filter((card) => card.kind === "city" && card.city === id)
    .slice(0, count)
    .map((card) => card.id);
}

/** Moves cards into a hand from wherever they are, so no card ever exists twice. */
export function give(world: World, seat: SeatId, cards: CardId[]) {
  const game = world.game!;
  const taken = new Set(cards);
  for (const player of Object.values(game.players))
    player.hand = player.hand.filter((card) => !taken.has(card));
  game.playerDeck.order = game.playerDeck.order.filter((card) => !taken.has(card));
  game.playerDeck.piles = [
    {
      size: game.playerDeck.order.length,
      epidemics: game.playerDeck.order.filter(
        (card) => world.campaign.playerCards[card]?.kind === "epidemic",
      ).length,
    },
  ];
  game.playerDiscard = game.playerDiscard.filter((card) => !taken.has(card));
  game.players[seat]!.hand.push(...cards);
}

export function emptyHand(world: World, seat: SeatId) {
  world.game!.playerDiscard.push(...world.game!.players[seat]!.hand.splice(0));
}

/** Puts a new Event or companion card straight into a hand. */
export function conjure(
  world: World,
  seat: SeatId,
  card: { kind: "event"; event: string } | { kind: "companion"; companion: string },
): CardId {
  const id = `test#${world.campaign.nextCardId++}` as CardId;
  world.campaign.playerCards[id] = (
    card.kind === "event"
      ? { id, kind: "event", event: card.event, mode: "rationed" }
      : {
          id,
          kind: "city",
          city: "cairo",
          improvement: null,
          search: [],
          companion: card.companion,
        }
  ) as never;
  world.game!.players[seat]!.hand.push(id);
  return id;
}

/** Puts the named cities' Infection cards on top of the deck, in order, with everything else below. */
export function stackInfection(world: World, cities: string[]) {
  const game = world.game!;
  const cards = cities.map(
    (id, index) =>
      infectionCards(world, id, 9)[cities.slice(0, index).filter((other) => other === id).length]!,
  );
  const rest = [...game.infectionDeck.order, ...game.infectionDiscard].filter(
    (card) => !cards.includes(card),
  );
  game.infectionDiscard = [];
  game.infectionDeck = {
    order: [...cards, ...rest],
    strata: [cards.toSorted(), rest.toSorted()].filter((stratum) => stratum.length),
  };
}

/**
 * A three-player December game on its first action step: every region explored, every action
 * unlocked, calm board. Seats A, B, C are Ada (administrator), Bo (farmer), Cy (instructor).
 * Every character holds the same Character card, so a first exposure never asks for a scar.
 */
export function late(
  edit?: (world: World, game: Game) => void,
  at: Phase = "playing.actions",
  lobby: Save = campaignAt(12),
): GameActor {
  const actor = createGameActor({ seed: 21, save: lobby }).start();
  const seats = [A, B, C];
  actor.send({
    type: "START_GAME",
    seating: Object.values(worldOf(actor).campaign.characters)
      .slice(0, 3)
      .map((entry, index) => ({ seat: seats[index]!, character: entry.id })),
  });
  setUp(actor);
  const world = JSON.parse(JSON.stringify(worldOf(actor))) as World;
  const game = world.game!;
  game.active = A;
  game.actionsLeft = 4;
  game.pending = [];
  game.incidents = 0;
  game.stockpile = 20;
  for (const location of Object.values(game.locations))
    Object.assign(location, { supplies: 2, plague: 0, hollow: 0 });
  for (const seat of seats) emptyHand(world, seat);
  for (const entry of Object.values(world.campaign.characters))
    if (!entry.worker)
      entry.exposureTrack = paddedTrack(["empty", "scar", "empty", "scar", "empty", "skull"]);
  edit?.(world, game);
  return createGameActor({ seed: 1, save: { v: 1, phase: at, world } }).start();
}

/**
 * A game on its first action step with seat A standing in `city`, holding its card with the `scope` search box still
 * covered, so searching it plays as the table would see it. It is the first month the city is on the map with what the
 * box opens still sealed (a perimeter report forces some seals open in time), and December when no month has both.
 */
export function searchAt(at: CityId, scope: "land" | "sea"): { save: Save; card: CardId; box: number } {
  const def = pack.searches[at]?.find((entry) => entry.scope === scope);
  if (!def) throw new Error(`${at} has no ${scope} search box`);
  const seals = def.result.t === "discover" ? def.result.seals : [];
  const unexplored = seals.map(sealKey);
  const lobby =
    Array.from({ length: 12 }, (_, index) => campaignAt(index + 1, 12, { unexplored })).find(
      ({ world }) =>
        world.campaign.locations[at]?.revealed &&
        seals.every((seal) => !world.campaign.opened.includes(sealKey(seal))),
    ) ?? campaignAt(12, 12, { unexplored });
  let held: { card: CardId; box: number } | null = null;
  const actor = late(
    (world, game) => {
      const card = Object.values(world.campaign.playerCards).find(
        (entry) => entry.kind === "city" && entry.city === at && entry.search.length > 0,
      );
      if (!card || card.kind !== "city") throw new Error(`No searchable ${at} card`);
      const box = card.search.findIndex((entry) => entry.scope === scope);
      card.search[box]!.scratched = false;
      card.companion = null;
      game.players[A]!.location = at;
      give(world, A, [card.id]);
      held = { card: card.id, box };
    },
    "playing.actions",
    lobby,
  );
  const world = structuredClone(worldOf(actor)) as World;
  return { save: { v: 1, phase: "playing.actions", world }, ...held! };
}
