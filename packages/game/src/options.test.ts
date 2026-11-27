import { expect, test } from "bun:test";
import { actionMenu, legalActions } from "./options";
import { A, city, cityCards, give, late, worldOf } from "./testkit";

test("the action menu lists every legal action once, under its kind", () => {
  const actor = late((world, game) =>
    give(world, A, cityCards(world, game.players[A]!.location, 1)),
  );
  const world = worldOf(actor);
  const menu = actionMenu(world, A);
  expect(menu.flatMap((choice) => choice.actions)).toEqual(
    legalActions(world, A).toSorted(
      (x, y) => menu.findIndex((c) => c.a === x.a) - menu.findIndex((c) => c.a === y.a),
    ),
  );
  for (const choice of menu) expect(choice.reason === null).toBe(choice.actions.length > 0);
});

test("Charter Boat offers every held copy of the current port so players can keep a companion copy", () => {
  const actor = late((world, game) => {
    game.players[A]!.location = city("lagos");
    const [first, second] = cityCards(world, "lagos", 2);
    const firstCard = world.campaign.playerCards[first!]!;
    if (firstCard.kind === "city") firstCard.companion = "herbalist";
    give(world, A, [first!, second!]);
  });
  const world = worldOf(actor);
  const charterCards = legalActions(world, A).flatMap((action) =>
    action.a === "charter" && action.to === city("new-york") ? [action.card] : [],
  );
  expect(new Set(charterCards).size).toBe(2);
});

test("when every supply center is placed, Build Supply Center offers moving any existing supply center", () => {
  const actor = late((world, game) => {
    game.pieces.center = 0;
    game.locations[city("cairo")]!.center = true;
    game.locations[city("lagos")]!.center = true;
    game.players[A]!.location = city("london");
    give(world, A, [...cityCards(world, "london", 4), ...cityCards(world, "new-york", 1)]);
  });
  const world = worldOf(actor);
  const moveFroms = new Set(
    legalActions(world, A).flatMap((action) =>
      action.a === "buildCenter" && action.moveFrom ? [action.moveFrom] : [],
    ),
  );
  expect(moveFroms).toContain(city("cairo"));
  expect(moveFroms).toContain(city("lagos"));
});
