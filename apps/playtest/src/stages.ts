import {
  campaignAt,
  checkEdge,
  cityDef,
  give,
  grid,
  neighbours,
  pack,
  scenarios,
  stackInfection,
} from "@repo/game";
import type { CardId, CityId, Color, JobId, Save, SeatId, World } from "@repo/game";

/**
 * Tour games: staged games that put the table next to the parts of the game a campaign did not
 * reach. A stage only arranges the table once setup is over (pawns, hands, a few cubes, the top of
 * a deck). Everything after that is the players sending real commands to the real engine.
 */

const CAST: [name: string, job: JobId][] = [
  ["Rook", "laborer"],
  ["Wren", "radioOperator"],
  ["Pike", "instructor"],
];

const id = (city: string) => city as CityId;
const seats = ["seat-1", "seat-2", "seat-3"] as SeatId[];

function tourCast(save: Save) {
  const [rook, wren, pike] = Object.values(save.world.campaign.characters);
  rook!.slots[0] = { kind: "ability", id: "saboteur" };
  wren!.slots[0] = { kind: "ability", id: "broker" };
  pike!.slots[0] = { kind: "ability", id: "facilitator" };
  // A veteran whose next exposure is the last.
  rook!.exposure = rook!.exposureTrack.length - 1;
}

/** October for a group that never searched Johannesburg and never reconned the Coral Sea, with a cast of three. */
export function tourOctober(seed?: number): Save {
  const save = campaignAt(10, seed, { unexplored: ["door:59", "door:46"], cast: CAST });
  const { campaign } = save.world;
  tourCast(save);
  const refused = checkEdge(campaign, id("baghdad"), id("riyadh"), "land");
  if (refused) throw new Error(`the tour needs a supply line from Baghdad to Riyadh: ${refused}`);
  campaign.edges.push({ a: id("baghdad"), b: id("riyadh"), kind: "land" });
  campaign.locations[id("jakarta")]!.permanent.push("center");
  return save;
}

/**
 * November with the Plan ahead and a group that has lost almost everyone: one veteran a single
 * exposure from death, and the Scientist and the Vector Control Expert. Nobody is left to step in.
 */
export function tourNovember(seed?: number): Save {
  const save = campaignAt(11, seed, { cast: CAST.slice(2) });
  const characters = Object.values(save.world.campaign.characters);
  const pike = characters[0]!;
  pike.slots[0] = { kind: "ability", id: "facilitator" };
  pike.exposure = pike.exposureTrack.length - 1;
  for (const character of characters.slice(1)) {
    if (character.job === "scientist" || character.job === "vectorControl") continue;
    character.dead = true;
    character.diedAt = character.home;
  }
  return save;
}

/** Where the haven worker of the November game can walk into plague: the first city beside the first haven. */
export const workerTrap = (world: World): CityId => {
  const home = pack.cities.find((city) => city.kind === "haven" && !city.lost)!.id;
  const beside = [...neighbours(world.campaign, home)].find(
    (city) => cityDef(city).kind === "city",
  );
  if (!beside) throw new Error("no city beside the first haven");
  return beside;
};

/**
 * October for a group that has searched almost nowhere. Two characters stand one exposure from a scar,
 * one of them trained as a Lookout, and the sea lane from Osaka to Seoul was never charted.
 */
export function tourSearches(seed?: number): Save {
  const save = campaignAt(10, seed, {
    cast: [
      ["Gale", "laborer"],
      ["Moss", "radioOperator"],
      ["Tarn", "instructor"],
    ],
  });
  const { campaign } = save.world;
  const [, moss, tarn] = Object.values(campaign.characters);
  tarn!.slots[0] = { kind: "ability", id: "lookout" };
  for (const marked of [moss!, tarn!]) marked.exposure = marked.exposureTrack.indexOf("scar");
  campaign.edges = campaign.edges.filter(
    (edge) => ![edge.a, edge.b].every((end) => end === "osaka" || end === "seoul"),
  );
  const refused = checkEdge(campaign, id("osaka"), id("seoul"), "sea");
  if (refused) throw new Error(`the tour needs a free sea lane from Osaka to Seoul: ${refused}`);
  return save;
}

export const labScenarios = {
  ...scenarios,
  october: (seed?: number) => campaignAt(10, seed),
  "tour-october": tourOctober,
  "tour-november": tourNovember,
  "tour-searches": tourSearches,
};

function cardsOf(world: World, cities: string[]): CardId[] {
  return cities.map((city) => {
    const card = Object.values(world.campaign.playerCards).find(
      (held) => held.kind === "city" && held.city === city,
    );
    if (!card) throw new Error(`no Player card for ${city}`);
    return card.id;
  });
}

/** City cards of one colour, each naming a different city, that the stage has not handed out. */
function spare(world: World, color: Color, count: number, taken: Set<CardId>): CardId[] {
  const cities = new Set<CityId>();
  const found: CardId[] = [];
  for (const card of Object.values(world.campaign.playerCards)) {
    if (
      card.kind !== "city" ||
      cityDef(card.city).color !== color ||
      taken.has(card.id) ||
      cities.has(card.city)
    )
      continue;
    cities.add(card.city);
    found.push(card.id);
    if (found.length === count) break;
  }
  if (found.length < count) throw new Error(`the deck has too few ${color} cards for the stage`);
  for (const card of found) taken.add(card);
  return found;
}

function deal(world: World, hands: CardId[][]) {
  const game = world.game!;
  for (const seat of game.seats) game.playerDiscard.push(...game.players[seat]!.hand.splice(0));
  hands.forEach((hand, index) => give(world, seats[index]!, hand));
}

function calm(world: World, cities: string[]) {
  const game = world.game!;
  for (const city of cities) {
    const location = game.locations[id(city)]!;
    game.pieces.hollow += location.hollow;
    Object.assign(location, { plague: 0, hollow: 0 });
  }
}

/** Leaves a city bare with `cubes` plague cubes on it. Each cube added counts as the incident that would have put it there. */
function plagued(world: World, city: CityId, cubes: number) {
  const game = world.game!;
  const location = game.locations[city]!;
  game.stockpile += location.supplies;
  game.pieces.hollow += location.hollow;
  game.incidents += Math.max(0, cubes - location.plague);
  Object.assign(location, {
    supplies: 0,
    plague: Math.max(cubes, location.plague),
    hollow: 0,
    shelter: false,
  });
}

function supplied(world: World, cities: CityId[], atLeast: number) {
  const game = world.game!;
  for (const city of cities) {
    const location = game.locations[city]!;
    const short = Math.min(Math.max(0, atLeast - location.supplies), game.reserve);
    location.supplies += short;
    game.reserve -= short;
  }
}

/** Tops every city on the grid up to `atLeast` cubes from the reserve, so the table can spend its turns on the tour. */
function wellSupplied(world: World, atLeast: number, except: string[]) {
  const cities = [...grid(world.campaign)].filter(
    (city) => cityDef(city).kind === "city" && !except.includes(city),
  );
  supplied(world, cities, atLeast);
}

function hollow(world: World, city: string) {
  const game = world.game!;
  const location = game.locations[id(city)]!;
  if (location.hollow > 0) return;
  if (game.pieces.hollow === 0) throw new Error("no Hollow Man piece left for the stage");
  location.hollow = 1;
  game.pieces.hollow -= 1;
}

function discarded(world: World, card: CardId) {
  const game = world.game!;
  give(world, seats[0]!, [card]);
  game.players[seats[0]!]!.hand = game.players[seats[0]!]!.hand.filter((held) => held !== card);
  game.playerDiscard.push(card);
}

/**
 * Takes the Epidemics out of the Player deck and leaves at most `count` cards in it. A tour game is
 * about the rare parts of the game, and a campaign has already played Epidemics many times over.
 */
function tourDeck(world: World, count: number) {
  const deck = world.game!.playerDeck;
  deck.order = deck.order
    .filter((card) => world.campaign.playerCards[card]?.kind !== "epidemic")
    .slice(0, count);
  deck.piles = [{ size: deck.order.length, epidemics: 0 }];
}

function stageOctober(world: World) {
  const game = world.game!;
  const taken = new Set<CardId>();
  const pick = (cities: string[]) => {
    const cards = cardsOf(world, cities);
    for (const card of cards) taken.add(card);
    return cards;
  };
  const towns = {
    rook: pick(["bangkok", "manila", "seoul", "tokyo", "ho-chi-minh-city", "osaka"]),
    wren: pick(["riyadh", "baghdad", "johannesburg", "tehran"]),
    pike: pick(["delhi", "new-mumbai"]),
  };
  const brokered = pick(["istanbul"])[0]!;
  deal(world, [towns.rook, towns.wren, towns.pike]);
  discarded(world, brokered);
  game.players[seats[0]!]!.location = id("jakarta");
  game.players[seats[1]!]!.location = id("riyadh");
  game.players[seats[2]!]!.location = id("delhi");
  calm(world, [
    "jakarta",
    "kolkata",
    "new-mumbai",
    "ho-chi-minh-city",
    "riyadh",
    "cairo",
    "johannesburg",
    "delhi",
    "tehran",
  ]);
  // One city on the brink, drawn first: the first Infect step is an outbreak.
  plagued(world, id("hong-kong"), 3);
  supplied(world, [...neighbours(world.campaign, id("hong-kong"))], 2);
  stackInfection(world, ["hong-kong"]);
  plagued(world, id("baghdad"), 1);
  hollow(world, "osaka");
  hollow(world, "tokyo");
  wellSupplied(world, 3, ["hong-kong", "baghdad"]);
  tourDeck(world, 30);
  game.pending = [];
}

function stageNovember(world: World) {
  const game = world.game!;
  const taken = new Set<CardId>();
  const red = cardsOf(world, ["bangkok", "manila", "hong-kong", "seoul", "tokyo"]);
  for (const card of red) taken.add(card);
  const black = spare(world, "black", 4, taken);
  const yellow = spare(world, "yellow", 4, taken);
  const blue = spare(world, "blue", 3, taken);
  deal(world, [[...red, ...black.slice(0, 1)], [...yellow, ...blue], black.slice(1)]);
  for (const seat of game.seats) game.players[seat]!.location = id("shanghai");
  calm(world, ["shanghai", "seoul"]);
  // Shanghai's own Infection card lies in the discard pile for the Scientist, and a supplied yellow city is drawn first for the Topaz shield.
  const shanghai = Object.values(world.campaign.infectionCards).find(
    (card) => card.kind === "city" && card.city === "shanghai",
  );
  const guarded = pack.cities.find(
    (city) =>
      city.color === "yellow" &&
      world.campaign.locations[city.id]!.population > 0 &&
      Object.values(world.campaign.infectionCards).some(
        (card) => card.kind === "city" && card.city === city.id,
      ) &&
      game.infectionDeck.order.some((card) => {
        const held = world.campaign.infectionCards[card]!;
        return held.kind === "city" && held.city === city.id;
      }),
  );
  if (!shanghai || !guarded)
    throw new Error("the November stage needs Shanghai and a yellow city in the Infection deck");
  supplied(world, [guarded.id], 2);
  stackInfection(world, [guarded.id]);
  game.infectionDeck.order = game.infectionDeck.order.filter((card) => card !== shanghai.id);
  game.infectionDeck.strata = game.infectionDeck.strata
    .map((stratum) => stratum.filter((card) => card !== shanghai.id))
    .filter((stratum) => stratum.length);
  if (!game.infectionDiscard.includes(shanghai.id)) game.infectionDiscard.push(shanghai.id);
  plagued(world, workerTrap(world), 1);
  wellSupplied(world, 3, [workerTrap(world)]);
  tourDeck(world, 40);
  game.pending = [];
}

function stageSearches(world: World) {
  const game = world.game!;
  deal(world, [
    cardsOf(world, ["denver", "mexico-city", "lima", "santiago", "bogota"]),
    cardsOf(world, ["dar-es-salaam", "st-petersburg"]),
    cardsOf(world, ["shanghai", "osaka", "jakarta"]),
  ]);
  // The Seoul card lies in the discard pile, which is where a Lookout searches from.
  discarded(world, cardsOf(world, ["seoul"])[0]!);
  game.players[seats[0]!]!.location = id("denver");
  game.players[seats[1]!]!.location = id("dar-es-salaam");
  game.players[seats[2]!]!.location = id("shanghai");
  calm(world, [
    "denver",
    "los-angeles",
    "mexico-city",
    "haven-eastern-pacific",
    "lima",
    "santiago",
    "dar-es-salaam",
    "johannesburg",
    "haven-north-atlantic",
    "london",
    "st-petersburg",
    "shanghai",
    "osaka",
    "seoul",
    "ho-chi-minh-city",
    "kolkata",
    "jakarta",
  ]);
  // Seat 1 goes first, so the two marked characters begin their first turn where the stage put them.
  game.active = seats[0]!;
  game.actionsLeft = pack.numbers.actionsPerTurn;
  wellSupplied(world, 3, []);
  tourDeck(world, 40);
  game.pending = [];
}

const PLAN_COLOURS: Color[] = ["red", "yellow", "blue", "black"];

/** The Plan recons this campaign has not made yet. Finished steps carry over to a second attempt. */
const planLeft = (world: World) =>
  PLAN_COLOURS.filter((color) => !world.campaign.planRecons.includes(`hidden:plan-${color}`));

/** A second attempt at November: only the Plan steps that are still open are dealt, and nothing else is arranged. */
function stagePlanFinish(world: World) {
  const game = world.game!;
  const taken = new Set<CardId>();
  const left = planLeft(world);
  const red = left.includes("red")
    ? cardsOf(world, ["bangkok", "manila", "hong-kong", "seoul", "tokyo"])
    : [];
  for (const card of red) taken.add(card);
  const cards = (color: Color, count: number) =>
    left.includes(color) ? spare(world, color, count, taken) : [];
  deal(world, [red, [...cards("yellow", 3), ...cards("blue", 3)], cards("black", 4)]);
  for (const seat of game.seats) game.players[seat]!.location = id("shanghai");
  calm(world, ["shanghai"]);
  tourDeck(world, 40);
  game.pending = [];
}

type Stage = {
  /** Arranges the table. It is given a copy of the world on the first action step of the game. */
  apply: (world: World) => void;
  summary: string;
  /** What the brief tells the whole table, then each seat in order. */
  table: string[];
  seats: string[][];
};

const october: Stage = {
  apply: stageOctober,
  summary:
    "The lab arranged the table: pawns at Jakarta, Riyadh and Delhi, a chosen hand for each seat, Hong Kong at 3 plague and drawn first, 1 plague in Baghdad, Hollow Men in Osaka and Tokyo, plague and Hollow Men cleared from the cities on your routes, cities topped up toward 3 cubes for as long as the reserve lasted, and a Player deck of 30 cards with no Epidemics.",
  table: [
    "This is a **tour game**. A campaign already ran the whole year. This game exists to play the parts that campaign never reached, so finishing your list below matters more than winning. Keep the game going until every list is done.",
    "Pick these characters in the lobby: seat 1 takes **Rook**, seat 2 takes **Wren**, seat 3 takes **Pike**. Do not create or pick anyone else.",
    "When the first action step starts, the lab rearranges the table once: it moves the pawns, deals each of you a chosen hand, and sets a few cubes. `wait` shows a chat line starting TABLE STAGED when that has happened. Run `status` and `options` again after it. Do not act before it.",
    "The Player deck is cut to 30 cards with no Epidemics, so the game ends within about four rounds. Never discard a card your list still needs.",
    "Many cities here are infested: a pawn that starts its turn in one is exposed. That is expected.",
  ],
  seats: [
    [
      "You are Rook, at Jakarta, with the Saboteur ability. Rook is one exposure from death. Dying is on your list, but last.",
      "First, as the lead or not, send `waive buildCenters` once. It is a plain command for `play`, not a `do` key. It exercises waiving an objective.",
      "Turn 1: Recon at Jakarta with the Bangkok and Manila cards. Drive or ferry to the haven that appears. Recon there with the Seoul and Tokyo cards. Use Sabotage: discard the Osaka card to remove the Hollow Man in Osaka.",
      "Turn 2: go to Ho Chi Minh City (Jakarta, Kolkata, Ho Chi Minh City) and Search there with its card. A companion joins that City card: discard the card to place a shelter, at once, anywhere.",
      "Turn 3: drive to Osaka, which is infested, and end your turn there. Rook dies at the start of your next turn. A choice appears: take any free character.",
    ],
    [
      "You are Wren, at Riyadh, with the Broker ability.",
      "Turn 1: Search at Riyadh with its card. It gives a free supply line: answer the choice by picking a city to connect. Drive to Baghdad. Search there with its card. A companion joins that City card: discard the card to remove 1 plague cube from where you stand, right there, Baghdad has one. Use Broker: discard the Tehran card to take the Istanbul card from the discard pile.",
      "Turn 2: drive to Cairo, Shuttle to Johannesburg, and Search there with its card.",
      "Then: help wherever the game needs it.",
    ],
    [
      "You are Pike, at Delhi.",
      "Turn 1: Search at Delhi with its card. A companion joins that City card: discard the card to remove a Hollow Man in Tokyo. Drive to Tehran, then Kolkata, then New Mumbai.",
      "Turn 2: Search at New Mumbai with its card, land box. A companion joins that City card that clears a city of plague: discard the card on Hong Kong, but only after Hong Kong has had its outbreak in the first Infect step.",
      "Then: help wherever the game needs it.",
    ],
  ],
};

const november: Stage = {
  apply: stageNovember,
  summary:
    "The lab arranged the table: all pawns at Shanghai, hands holding the cards for the four Plan recons, Shanghai's Infection card in the discard pile, a supplied yellow city drawn first, 1 plague in New York, plague and Hollow Men cleared from the cities on your routes, cities topped up toward 3 cubes for as long as the reserve lasted, and a Player deck of 40 cards with no Epidemics.",
  table: [
    "This is a **tour game**. A campaign already ran the whole year. This game exists to play the parts that campaign never reached, so finishing your list below matters more than a fast win. The fourth Plan recon at Shanghai wins the game. **Do not make the red recon until every other list is done**, because it ends the game.",
    "Pick these characters in the lobby: seat 1 takes the **Scientist**, seat 2 takes the **Vector Control Expert**, seat 3 takes **Pike**. Everyone else in this group is dead.",
    "When the first action step starts, the lab rearranges the table once: it moves every pawn to Shanghai, deals each of you a chosen hand, and sets a few cubes. `wait` shows a chat line starting TABLE STAGED when that has happened. Run `status` and `options` again after it. Do not act before it.",
    "The Player deck has 40 cards and no Epidemics. Never discard a card your list still needs: when you are over the hand limit, discard what you drew.",
    "Shanghai is infested: a pawn that starts its turn there is exposed until the shelter is built.",
  ],
  seats: [
    [
      "You are the Scientist, at Shanghai, holding 5 red cards and 1 black card.",
      "Turn 1: use the Scientist's free action to destroy Shanghai's Infection card in the discard pile. Keep all your cards: Pike takes your black card with Facilitate.",
      "After that, keep the board supplied and wait. Hold the red recon (5 red cards at Shanghai) until Pike has died, the haven worker that replaces Pike has been exposed, and the other two lists are done. Then make it. It wins the game.",
    ],
    [
      "You are the Vector Control Expert, at Shanghai, holding 4 yellow cards and 3 blue cards.",
      "After the first Infect step a choice appears: a yellow city lost a cube, and the Topaz shield lets one player discard a yellow card to keep it. Answer it by discarding one yellow card. If it comes up again, skip it: you need the other three.",
      "Your first turn: Build a Shelter at Shanghai, which needs no card for your job. Recon at Shanghai with 3 yellow cards (the yellow Plan step). Recon at Shanghai with 3 blue cards (the blue Plan step).",
      "Then: keep the board supplied.",
    ],
    [
      "You are Pike, at Shanghai, with the Facilitator ability, holding 3 black cards. Pike is one exposure from death, and dying is on your list.",
      "Your first turn: Facilitate to take the black card from the Scientist. Recon at Shanghai with 4 black cards (the black Plan step). Drive to Osaka, which is infested, and end your turn there.",
      "Pike dies at the start of your next turn. A choice appears: nobody is free, so the seat becomes a haven worker at the North Atlantic haven.",
      "As the haven worker: go to New York, which has plague, and end a turn there. The worker is exposed at the start of the next turn. Say so in chat: that is the signal for the red recon.",
    ],
  ],
};

const planFinish = (world: World): Stage => {
  const left = planLeft(world);
  const holders = [
    left.includes("red") ? "Seat 1 holds 5 red cards." : "",
    left.includes("yellow") ? "Seat 2 holds 3 yellow cards." : "",
    left.includes("blue") ? "Seat 2 holds 3 blue cards." : "",
    left.includes("black") ? "Seat 3 holds 4 black cards." : "",
  ].filter(Boolean);
  const recon = (color: Color, count: number) =>
    left.includes(color)
      ? [`Recon at Shanghai with your ${count} ${color} cards (the ${color} Plan step).`]
      : [];
  return {
    apply: stagePlanFinish,
    summary: `The lab arranged the table: all pawns at Shanghai and the cards for the Plan steps still open (${left.join(", ")}) dealt out. Player deck of 40 cards with no Epidemics.`,
    table: [
      `This is a **tour game**, the second attempt at November. The Plan steps made in the first attempt carry over. Still open: **${left.join(", ")}**. The recon that completes the Plan wins the game, so this game is short.`,
      "Pick these characters in the lobby: seat 1 takes the **Scientist**, seat 2 takes the **Vector Control Expert**. Pike died last game, so seat 3 creates a new character with any open starting job (`chars` lists them) and picks it.",
      "When the first action step starts, the lab rearranges the table once: it moves every pawn to Shanghai and deals the cards for the open Plan steps. `wait` shows a chat line starting TABLE STAGED when that has happened. Run `status` and `options` again after it. Do not act before it.",
      `${holders.join(" ")} Never discard them.`,
    ],
    seats: [
      ["You are the Scientist, at Shanghai.", ...recon("red", 5)],
      [
        "You are the Vector Control Expert, at Shanghai.",
        ...recon("yellow", 3),
        ...recon("blue", 3),
      ],
      ["You play a new character, at Shanghai.", ...recon("black", 4)],
    ].map((lines) =>
      lines.length > 1
        ? lines
        : [
            ...lines,
            "Nothing is left on your list. Keep the board alive until the Plan is complete.",
          ],
    ),
  };
};

const searches: Stage = {
  apply: stageSearches,
  summary:
    "The lab arranged the table: pawns at Denver, Dar es Salaam and Shanghai, a chosen hand for each seat, the Seoul card in the discard pile, seat 1 to move first, plague and Hollow Men cleared from the cities on your routes, cities topped up toward 3 cubes for as long as the reserve lasted, and a Player deck of 40 cards with no Epidemics.",
  table: [
    "This is a **tour game**. A campaign already ran the whole year. This game exists to play the searches, companions and scars that campaign never reached, so finishing your list below matters more than winning. Keep the game going until every list is done.",
    "Pick these characters in the lobby: seat 1 takes **Gale**, seat 2 takes **Moss**, seat 3 takes **Tarn**. Do not create or pick anyone else.",
    "When the first action step starts, the lab rearranges the table once: it moves the pawns, deals each of you a chosen hand, and makes seat 1 the first to move. `wait` shows a chat line starting TABLE STAGED when that has happened. Run `status` and `options` again after it. Do not act before it.",
    "A search does not use up the city card, so keep every card your list names. A companion found by a search joins the City card you searched with. Some are not played: they change a cost while you hold that card. `report` it if a cost does not change the way your list says.",
    "Never discard a City card that carries a companion unless your list says to play it.",
  ],
  seats: [
    [
      "You are Gale, at Denver, holding the Denver, Mexico City, Lima, Santiago and Bogotá cards.",
      "Turn 1: Search at Denver. The Lineman joins your hand. Drive to Los Angeles, then Mexico City. Search at Mexico City. The Builder joins your hand.",
      "Turn 2: Make supplies once. Establish a supply line from Mexico City to Denver. With the Lineman it costs 1 cube, not 2. Drive to Los Angeles, then Farwater.",
      "Turn 3: drive to Lima and Search there. The Tracker joins your hand: from now on your searches cost no action. You are now one card over the hand limit: discard the Denver card. Drive to Bogotá and Search there. It should cost no action. Then Build a supply center at Bogotá with 4 yellow cards (Mexico City, Lima, Santiago, Bogotá). With the Builder it takes 4 cards, not 5.",
      "Whenever you are over the hand limit, discard what you drew. Never discard a City card that carries a companion, or a yellow card.",
    ],
    [
      "You are Moss, at Dar es Salaam, which is infested. Moss is one exposure from a scar.",
      "At the start of your first turn Moss is exposed and a scar choice appears. Take the scar named **Injured** (supply lines cost 1 more cube), in any empty slot.",
      "Turn 1: Search at Dar es Salaam. The Field Surgeon joins your hand. End your turn still in Dar es Salaam.",
      "Turn 2: you start in an infested city again. With the Field Surgeon in hand you should not be exposed. `report` it if you are. Then drive to Johannesburg, Shuttle to Northwatch, drive to London, drive to St. Petersburg.",
      "Turn 3: Search at St. Petersburg with its first box. The Rigger joins your hand. Make supplies once. Build a tower there. With the Rigger it costs 1 cube, not 2.",
    ],
    [
      "You are Tarn, at Shanghai, which is infested, with the Lookout ability. Tarn is one exposure from a scar.",
      "At the start of your first turn Tarn is exposed and a scar choice appears. Take the scar named **Burdened** (hand limit 1 lower). Put it in an empty slot, not on the Lookout: a scar covers what is in its slot.",
      "Turn 1: Search at Shanghai. Drive to Osaka. Search at Osaka. It gives a free sea lane: answer the choice by picking Seoul. Drive to Seoul.",
      "Turn 2: use the Lookout. The Seoul card is in the discard pile, not your hand: Search at Seoul with it. Then drive to Ho Chi Minh City, Kolkata, Jakarta.",
      "Turn 3: Search at Jakarta.",
    ],
  ],
};

/** The stage for the game about to be played, by name. A stage may depend on how far the campaign has come. */
export const stages: Record<string, (world: World) => Stage> = {
  "tour-october": () => october,
  "tour-november": (world) =>
    planLeft(world).length === PLAN_COLOURS.length ? november : planFinish(world),
  "tour-searches": () => searches,
};
