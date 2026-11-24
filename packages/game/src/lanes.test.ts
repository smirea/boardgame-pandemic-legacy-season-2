import { expect, test } from "bun:test";
import { pack } from "./content/pack";
import type { EdgeDef } from "./content/types";
import { groundRevealed, passage, routeCourse } from "./helpers";
import { coursesCross, runsOver } from "./lanes";
import { newCampaign } from "./legacy";

const startingEdges = pack.edges;
/** Every sea lane the Legacy deck lays itself when a region opens, which no rule checks for crossings. */
const deckEdges = pack.seals.flatMap((def) =>
  def.unlocks.flatMap((unlock) => (unlock.t === "region" ? (unlock.connect ?? []) : [])),
);
const name = (edge: EdgeDef) => `${edge.a}-${edge.b}`;
const courseOf = (edge: EdgeDef) => routeCourse(edge.a, edge.b, edge.kind);
const pairs = <T>(items: T[]) =>
  items.flatMap((one, index) => items.slice(index + 1).map((other) => [one, other] as const));

test("no two lines the board starts with or the deck lays cross", () => {
  const lines = [...startingEdges, ...deckEdges];
  const crossings = pairs(lines)
    .filter(
      ([one, other]) => one.kind === other.kind && coursesCross(courseOf(one), courseOf(other)),
    )
    .map(([one, other]) => `${name(one)} x ${name(other)}`);
  expect(crossings).toEqual([]);
});

test("no starting line runs over a location it does not join", () => {
  const ends = new Set(startingEdges.flatMap((edge) => [edge.a, edge.b]));
  const over = startingEdges.flatMap((edge) =>
    [...ends]
      .filter((city) => runsOver(courseOf(edge), pack.positions[city]!))
      .map((city) => `${name(edge)} over ${city}`),
  );
  expect(over).toEqual([]);
});

test("no starting line runs over ground the fog hides at the start", () => {
  const campaign = newCampaign(0);
  const hidden = startingEdges.flatMap((edge) =>
    passage(edge.a, edge.b, edge.kind)
      .through.filter((id) => !groundRevealed(campaign, id))
      .map((id) => `${name(edge)} over ${id}`),
  );
  expect(hidden).toEqual([]);
});

test("a line drawn before a rule change took its pair off the candidates still has a course, straight between its ends", () => {
  const riyadh = "riyadh" as EdgeDef["a"];
  const dar = "dar-es-salaam" as EdgeDef["a"];
  expect(
    pack.candidateEdges.some(
      (edge) => name(edge) === `${dar}-${riyadh}` || name(edge) === `${riyadh}-${dar}`,
    ),
  ).toBe(false);
  expect(routeCourse(riyadh, dar, "land")).toEqual([pack.positions[riyadh], pack.positions[dar]]);
});
