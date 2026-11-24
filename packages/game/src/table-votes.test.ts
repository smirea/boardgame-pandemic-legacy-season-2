import { expect, test } from "bun:test";
import { scarCandidates } from "./flow";
import { log } from "./helpers";
import type { PlayerId } from "./ids";
import { createGameActor, parseSave } from "./machine";
import type { GameActor } from "./machine";
import { legalActions } from "./options";
import { newTableBriefing } from "./table";
import type { World } from "./state";
import { publicState } from "./view";
import {
  A,
  act,
  B,
  C,
  character,
  city,
  cityCards,
  gameOf,
  give,
  late,
  phase,
  send,
  showReveals,
  worldOf,
} from "./testkit";

const ann = "ann" as PlayerId;
const ben = "ben" as PlayerId;
const cat = "cat" as PlayerId;

function sit(actor: GameActor, players: [PlayerId, typeof A][]) {
  for (const [player, seat] of players)
    send(actor, { type: "TAKE_SEAT", player, name: player, seat });
}

/** The same game with something about it changed, as a save loaded into a new actor. */
function edited(actor: GameActor, edit: (world: World) => void, at = phase(actor)): GameActor {
  const world = JSON.parse(JSON.stringify(worldOf(actor))) as World;
  edit(world);
  return createGameActor({ seed: 3, save: { v: 1, phase: at, world } }).start();
}

/** A Denver card whose one search box opens a door, in A's hand at Denver. */
const withDoor = () =>
  late((world, game) => {
    const [card] = cityCards(world, "denver");
    (world.campaign.playerCards[card!] as { search: unknown[] }).search = [
      {
        scope: "land",
        result: { t: "discover", seals: [{ t: "door", id: "Z" }] },
        scratched: false,
      },
    ];
    game.players[A]!.location = city("denver");
    give(world, A, [card!]);
  });

test("a move that scratches an exposure box is taken back only by a vote of the table, whatever kind of move it was", () => {
  const actor = late((world, game) => {
    game.locations[game.players[A]!.location]!.hollow = 1;
  });
  sit(actor, [
    [ann, A],
    [ben, B],
  ]);
  const away = legalActions(worldOf(actor), A).find((action) => action.a === "drive")!;
  act(actor, away);
  expect(character(worldOf(actor), A).exposure).toBe(1);
  send(actor, { type: "UNDO", by: ann });
  expect(worldOf(actor).table.undoVote).toMatchObject({ by: ann, votes: {} });
  expect(character(worldOf(actor), A).exposure).toBe(1);
});

test("taking back the move that brought a reading starts the reading over for the table", () => {
  const actor = withDoor();
  sit(actor, [[ann, A]]);
  act(actor, { a: "search", card: gameOf(actor).players[A]!.hand[0]!, box: 0 });
  showReveals(actor);
  expect(worldOf(actor).campaign.briefing.length).toBeGreaterThan(0);
  send(actor, { type: "BRIEFING_STEP" });
  expect(worldOf(actor).table.briefing).not.toEqual(newTableBriefing());
  send(actor, { type: "UNDO", by: ann });
  send(actor, { type: "UNDO_VOTE", player: ann, vote: "yes" });
  expect(worldOf(actor).campaign.briefing).toEqual([]);
  expect(worldOf(actor).table.briefing).toEqual(newTableBriefing());
});

test("a reading the table put away does not come back when a later move is taken back", () => {
  const actor = withDoor();
  act(actor, { a: "search", card: gameOf(actor).players[A]!.hand[0]!, box: 0 });
  showReveals(actor);
  act(actor, { a: "makeSupplies" });
  expect(worldOf(actor).campaign.briefing.length).toBeGreaterThan(0);
  actor.send({ type: "ACK_BRIEFING" });
  send(actor, { type: "UNDO" });
  expect(worldOf(actor).campaign.briefing).toEqual([]);
});

test("a seat taken during a turn stays its player’s when a move is taken back", () => {
  const actor = late();
  act(actor, { a: "makeSupplies" });
  sit(actor, [[ann, A]]);
  expect(character(worldOf(actor), A).player).toBe(ann);
  send(actor, { type: "UNDO", by: ann });
  expect(worldOf(actor).table.seats).toEqual([{ seat: A, player: ann, name: ann }]);
  expect(character(worldOf(actor), A).player).toBe(ann);
});

/** An undo vote on a search, asked for by Cat, with Ann for it and Ben against. */
function splitVote() {
  const actor = withDoor();
  sit(actor, [
    [ann, A],
    [ben, B],
    [cat, C],
  ]);
  act(actor, { a: "search", card: gameOf(actor).players[A]!.hand[0]!, box: 0 });
  showReveals(actor);
  actor.send({ type: "ACK_BRIEFING" });
  send(actor, { type: "UNDO", by: cat });
  send(actor, { type: "UNDO_VOTE", player: ann, vote: "yes" });
  return actor;
}

test("an undo vote ends when the only player it still waits for gets up", () => {
  const actor = splitVote();
  send(actor, { type: "UNDO_VOTE", player: ben, vote: "no" });
  expect(worldOf(actor).table.undoVote).not.toBeNull();
  send(actor, { type: "LEAVE", player: cat });
  expect(worldOf(actor).table.undoVote).toBeNull();
  expect(publicState(actor.getSnapshot()).canUndo).toBe(true);
});

test("anyone still at the table may withdraw an undo vote once whoever asked for it has left", () => {
  const actor = splitVote();
  send(actor, { type: "LEAVE", player: cat });
  expect(worldOf(actor).table.undoVote).toMatchObject({ by: null });
  send(actor, { type: "CANCEL_UNDO_VOTE", player: ben });
  expect(worldOf(actor).table.undoVote).toBeNull();
});

test("the table goes to game end when the only player who had not agreed gets up", () => {
  const over = edited(
    late(),
    (world) => {
      world.game!.outcome = { won: false, reason: "test" };
      world.table.seats = [
        { seat: A, player: ann, name: "Ann" },
        { seat: B, player: ben, name: "Ben" },
      ];
    },
    "over",
  );
  send(over, { type: "CONTINUE", player: ann, done: true });
  expect(phase(over)).toBe("over");
  send(over, { type: "LEAVE", player: ben });
  expect(phase(over)).toBe("upkeep");
});

test("the table leaves game end for the lobby when the only player not yet done gets up", () => {
  const over = edited(
    late(),
    (world) => {
      world.game!.outcome = { won: false, reason: "test" };
      world.table.seats = [
        { seat: A, player: ann, name: "Ann" },
        { seat: B, player: ben, name: "Ben" },
      ];
    },
    "over",
  );
  send(over, { type: "CONTINUE", player: ann, done: true });
  send(over, { type: "CONTINUE", player: ben, done: true });
  send(over, { type: "FINISH_UPKEEP", player: ann, done: true });
  expect(phase(over)).toBe("upkeep");
  send(over, { type: "LEAVE", player: ben });
  expect(phase(over)).toBe("lobby");
});

test("a scar vote is settled when the only player who voted otherwise gets up", () => {
  const voting = edited(late(), (world) => {
    world.game!.pending = [{ t: "scarVote", votes: { [ann]: A, [ben]: B }, not: [] }];
    world.table.seats = [
      { seat: A, player: ann, name: "Ann" },
      { seat: B, player: ben, name: "Ben" },
    ];
  });
  send(voting, { type: "LEAVE", player: ben });
  expect(gameOf(voting).pending[0]).toEqual({ t: "scar", seat: A, at: null });
});

test("a scar the Legacy deck owes cannot be voted onto a character who has died", () => {
  const world = JSON.parse(JSON.stringify(worldOf(late()))) as World;
  expect(scarCandidates(world, { not: [] })).toEqual([A, B, C]);
  character(world, B).dead = true;
  expect(scarCandidates(world, { not: [] })).toEqual([A, C]);
});

test("a save of a game dealt before a field was added is refused, not loaded to fail at the first command", () => {
  const save = JSON.parse(
    JSON.stringify({ v: 1, phase: "playing.actions", world: worldOf(late()) }),
  );
  expect(() => parseSave(structuredClone(save))).not.toThrow();
  delete save.world.game.ended;
  expect(() => parseSave(save)).toThrow("That is not a campaign save from this build");
});

test("what the logbook is written from stays in the log of a game of any length", () => {
  const game = JSON.parse(JSON.stringify(gameOf(late()))) as World["game"] & object;
  game.log = [];
  log(game, { t: "structure", city: city("cairo"), structure: "center" });
  for (let turn = 0; turn < 900; turn++) log(game, { t: "turn", seat: A });
  expect(game.log.length).toBe(400);
  expect(game.log[0]).toMatchObject({ t: "structure", city: "cairo" });
  expect(game.log.at(-1)!.seq).toBe(game.nextSeq - 1);
});
