import { actionIds, grid, gridCityCount, isOpen, pack, sealKey, violations } from "@repo/game";
import type { Command, ObjectiveId, PublicState, World } from "@repo/game";
import timeline from "../../../docs/mechanics/data/legacy-timeline.json";
import { monthName } from "./names.ts";

/** The research timeline names objectives its own way. This is the only hand-kept link between it and the engine. */
const TIMELINE_OBJECTIVES: Record<string, ObjectiveId> = {
  "build-3-supply-centers": "buildCenters",
  "recon-north-america": "reconRegion",
  "recon-1-unknown-region": "reconNewArea",
  "connect-2-new-cities": "connectCities",
  "complete-2-searches": "searches",
  "access-a-lost-haven": "lostHaven",
  "triangulate-signals": "triangulate",
  "recon-east-asia": "reconEastAsia",
  "get-hollow-men-to-defect": "defect",
  "complete-the-plan": "plan",
  "deliver-the-sample": "deliverSample",
};

type Check = { name: string; expected: string; actual: string; ok: boolean };

type Snapshot = {
  rules: string[];
  actions: string[];
  objectives: string[];
  required: number;
  regions: string[];
  gridCities: number;
  rationing: number;
  abilitiesForSale: string[];
  improvementsForSale: string[];
  permanentForSale: string[];
  scars: string[];
  turningPoints: string[];
  events: string[];
  characters: string[];
};

export type GameRecord = {
  index: number;
  month: number;
  attempt: 1 | 2;
  supplies: number | null;
  setup: Snapshot;
  legacy: { id: string; title: string; at: "setup" | "gameEnd"; cardMonth: number }[];
  opened: { bundle: string; forced: boolean }[];
  completed: string[];
  jobs: string[];
  checks: Check[];
  outcome: {
    won: boolean;
    reason: string;
    turns: number;
    incidents: number;
    epidemics: number;
  } | null;
  bought: string[];
};

export type Audit = {
  exercised: Record<string, number>;
  games: GameRecord[];
  problems: { game: number; at: string; text: string }[];
  /** The last log entry counted, per game. */
  seq: Record<number, number>;
  cubeTotals: [number, number][];
};

export const newAudit = (): Audit => ({
  exercised: {},
  games: [],
  problems: [],
  seq: {},
  cubeTotals: [],
});

function snapshot(world: World): Snapshot {
  const { campaign } = world;
  return {
    rules: [...campaign.rules],
    actions: [...campaign.actions],
    objectives: [...campaign.objectives],
    required: campaign.required,
    regions: [...campaign.regions],
    gridCities: gridCityCount(campaign),
    rationing: campaign.rationing,
    abilitiesForSale: [...campaign.abilitiesForSale],
    improvementsForSale: [
      ...campaign.cityImprovementsForSale,
      ...campaign.infectionImprovementsForSale,
    ],
    permanentForSale: [...campaign.permanentForSale],
    scars: [...campaign.scars],
    turningPoints: [...campaign.turningPoints],
    events: Object.values(campaign.playerCards).flatMap((card) =>
      card.kind === "event" ? [`${card.event}:${card.mode}`] : [],
    ),
    characters: Object.values(campaign.characters).map(
      (character) => `${character.name}:${character.job ?? "none"}${character.dead ? ":dead" : ""}`,
    ),
  };
}

const bump = (audit: Audit, key: string) =>
  void (audit.exercised[key] = (audit.exercised[key] ?? 0) + 1);

function setupChecks(world: World, supplies: number): Check[] {
  const { campaign } = world;
  const month = timeline.months.find((entry) => entry.month === campaign.month);
  if (!month) return [];
  const actual = [...campaign.objectives].sort();
  // A one-time optional objective stays in play for a group that has not completed it. The research group had.
  const lingering = actual.filter((id) => {
    const objective = pack.objectives.find((candidate) => candidate.id === id);
    return objective?.reward && !objective.mandatory;
  });
  // The reverse also holds: one this group completed early has left play, while the research group still had it.
  const retired = (id: string) => {
    const objective = pack.objectives.find((candidate) => candidate.id === id);
    return Boolean(objective?.reward && !objective.mandatory && isOpen(campaign, objective.reward));
  };
  const expected = [
    ...new Set([
      ...month.objectives
        .map((objective) => TIMELINE_OBJECTIVES[objective.id] ?? `?${objective.id}`)
        .filter((id) => !retired(id)),
      ...lingering,
    ]),
  ].sort();
  const mandatoryExpected = month.objectives
    .filter((objective) => objective.mandatory)
    .map((objective) => TIMELINE_OBJECTIVES[objective.id])
    .sort();
  const mandatoryActual = actual
    .filter((id) => pack.objectives.find((objective) => objective.id === id)?.mandatory)
    .sort();
  const projected = (
    timeline.meta.constantTables.projectedSupplies as Record<string, number | null>
  )[String(campaign.month)];
  return [
    {
      name: "objectives required to win",
      expected: String(month.objectivesRequiredToWin),
      actual: String(campaign.required),
      ok: month.objectivesRequiredToWin === campaign.required,
    },
    {
      name: "objectives in play",
      expected: expected.join(", "),
      actual: actual.join(", "),
      ok: expected.join() === actual.join(),
    },
    {
      name: "mandatory objectives",
      expected: mandatoryExpected.join(", "),
      actual: mandatoryActual.join(", "),
      ok: mandatoryExpected.join() === mandatoryActual.join(),
    },
    {
      name: "supply cubes at setup (projected supplies plus campaign bonuses)",
      expected: `${projected} + bonus ${campaign.stockpileBonus}${campaign.losingStreakBonusGames > 0 ? " + 10 relief" : ""}`,
      actual: String(supplies),
      ok: supplies >= (projected ?? 0),
    },
  ];
}

/** Folds one state change into the audit. `command` is what caused it, when the lab sent it. */
export function observe(
  audit: Audit,
  previous: PublicState | null,
  next: PublicState,
  command: Command | null,
) {
  const { world, phase } = next;
  const { campaign, game } = world;
  const index = campaign.results.length;
  const stamp = `${monthName(campaign.month)}#${campaign.attempt} ${phase}${game ? ` turn ${game.turn}` : ""}`;

  if (command) {
    bump(audit, `command:${command.type}`);
    if (command.type === "ACTION") bump(audit, `action:${command.action.a}`);
    if (command.type === "PLAY") bump(audit, `play:${command.play.e}`);
    if (command.type === "DECIDE") bump(audit, `decide:${command.decide.d}`);
    if (command.type === "DECIDE" && command.decide.d === "scar")
      bump(audit, `scar:${command.decide.scar}`);
    if (command.type === "ACTION" && command.action.a === "selfInject") bump(audit, "scar:carrier");
    if (command.type === "DECIDE" && command.decide.d === "freeEdge") {
      const before = previous?.world.campaign.edges.length ?? campaign.edges.length;
      for (const edge of campaign.edges.slice(before)) bump(audit, `freeEdge:${edge.kind}`);
    }
    if (command.type === "PURCHASE") {
      const purchase = command.purchase;
      bump(audit, `purchase:${purchase.t}`);
      const what =
        purchase.t === "ability"
          ? `ability:${purchase.ability}`
          : purchase.t === "cityImprovement" || purchase.t === "infectionImprovement"
            ? `improvement:${purchase.improvement}`
            : purchase.t === "permanent"
              ? `permanent:${purchase.structure}`
              : purchase.t;
      bump(audit, `bought:${what}`);
      audit.games.at(-1)?.bought.push(what);
    }
  }

  const map = new Map(audit.cubeTotals);
  for (const text of violations(world, map))
    audit.problems.push({ game: index, at: stamp, text: `invariant: ${text}` });
  audit.cubeTotals = [...map];

  let record = audit.games.find((entry) => entry.index === index);
  if (game && !record && phase !== "lobby") {
    const cubes =
      game.stockpile +
      Object.values(game.locations).reduce((sum, location) => sum + location.supplies, 0) +
      Object.values(game.players).reduce((sum, player) => sum + player.supplies, 0);
    record = {
      index,
      month: campaign.month,
      attempt: campaign.attempt,
      supplies: cubes,
      setup: snapshot(world),
      legacy: [],
      opened: [],
      completed: [],
      jobs: game.seats.map(
        (seat) => campaign.characters[game.players[seat]!.character]?.job ?? "none",
      ),
      checks: setupChecks(world, cubes),
      outcome: null,
      bought: [],
    };
    audit.games.push(record);
    for (const job of record.jobs) bump(audit, `job:${job}`);
    for (const seat of game.seats)
      for (const slot of campaign.characters[game.players[seat]!.character]?.slots ?? [])
        if (slot) bump(audit, `${slot.kind}InPlay:${slot.id}`);
    for (const check of record.checks)
      if (!check.ok)
        audit.problems.push({
          game: index,
          at: stamp,
          text: `parity: ${check.name}: research says ${check.expected}, engine has ${check.actual}`,
        });
  }

  const before = previous?.world.campaign.legacyIndex ?? campaign.legacyIndex;
  for (let at = before; at < campaign.legacyIndex; at++) {
    const card = pack.legacyDeck[at]!;
    const when = game?.outcome ? "gameEnd" : "setup";
    bump(audit, `legacy:${card.id}`);
    const target = record ?? audit.games.at(-1);
    target?.legacy.push({ id: card.id, title: card.title, at: when, cardMonth: card.month });
    if (card.month !== campaign.month)
      audit.problems.push({
        game: index,
        at: stamp,
        text: `schedule: Legacy card ${card.id} "${card.title}" belongs to ${monthName(card.month)} but was read in ${monthName(campaign.month)}`,
      });
  }
  const opened = new Set(previous?.world.campaign.opened ?? campaign.opened);
  for (const key of campaign.opened) {
    if (opened.has(key)) continue;
    const forced = campaign.forced.includes(key);
    bump(audit, key);
    if (forced) bump(audit, "forcedOpening");
    (record ?? audit.games.at(-1))?.opened.push({ bundle: key, forced });
  }
  const planned = new Set(previous?.world.campaign.planRecons ?? campaign.planRecons);
  for (const step of campaign.planRecons) if (!planned.has(step)) bump(audit, `plan:${step}`);
  for (const rule of campaign.rules)
    if (!previous?.world.campaign.rules.includes(rule)) bump(audit, `rule:${rule}`);
  if (previous)
    for (const card of Object.values(campaign.playerCards))
      if (card.kind === "city" && card.companion) {
        const before = previous.world.campaign.playerCards[card.id];
        if (before?.kind === "city" && !before.companion)
          bump(audit, `found:companion:${card.companion}`);
      }
  // A turning point leaves the list at the moment it resolves.
  for (const point of previous?.world.campaign.turningPoints ?? []) {
    if (campaign.turningPoints.includes(point)) continue;
    bump(audit, `turningPoint:${point}`);
    (record ?? audit.games.at(-1))?.opened.push({
      bundle: `turning point ${point}`,
      forced: false,
    });
  }

  if (game && record) {
    const from = audit.seq[index] ?? -1;
    for (const entry of game.log) {
      if (entry.seq <= from) continue;
      bump(audit, `log:${entry.t}`);
      if (entry.t === "infect") bump(audit, `infect:${entry.effect}`);
      if (entry.t === "exposure") bump(audit, `exposure:${entry.result}`);
      if (entry.t === "search") bump(audit, `search:${entry.result}`);
      if (entry.t === "structure") bump(audit, `structure:${entry.structure}`);
      if (entry.t === "objective") {
        bump(audit, `objective:${entry.objective}`);
        record.completed.push(entry.objective);
      }
      audit.seq[index] = entry.seq;
    }
    if (game.outcome && !record.outcome) {
      record.outcome = {
        won: game.outcome.won,
        reason: game.outcome.reason,
        turns: game.turn,
        incidents: game.incidents,
        epidemics: game.epidemics,
      };
      bump(audit, game.outcome.won ? "game:won" : "game:lost");
    }
  }
}

/** Everything the engine can do, so the report can say what no game has touched yet. */
export function universe(world: World): { key: string; live: boolean }[] {
  const { campaign } = world;
  const unlockedAction = (id: string) => campaign.actions.includes(id as never);
  const eventsOwned = new Set(
    Object.values(campaign.playerCards).flatMap((card) =>
      card.kind === "event" ? [card.event] : [],
    ),
  );
  const baseActions = new Set([
    "drive",
    "sail",
    "charter",
    "makeSupplies",
    "produce",
    "deliver",
    "share",
    "buildCenter",
    "pickUp",
    "transfer",
  ]);
  return [
    ...actionIds.map((id) => ({
      key: `action:${id}`,
      live: baseActions.has(id) || unlockedAction(id),
    })),
    ...pack.events.map((event) => ({ key: `play:${event.id}`, live: eventsOwned.has(event.id) })),
    ...pack.companions
      .filter((companion) => companion.spent)
      .map((companion) => ({ key: `play:${companion.id}`, live: false })),
    ...[
      "discard",
      "scar",
      "replace",
      "retrieve",
      "freeEdge",
      "removeHollow",
      "quarantineCard",
      "giveCard",
      "shield",
      "brokenLink",
      "guard",
      "reveal",
      "search",
      "skip",
    ].map((key) => ({ key: `decide:${key}`, live: true })),
    ...[
      "ability",
      "cityImprovement",
      "infectionImprovement",
      "population",
      "restore",
      "permanent",
    ].map((key) => ({
      key: `purchase:${key}`,
      live: true,
    })),
    ...pack.abilities.map((ability) => ({
      key: `bought:ability:${ability.id}`,
      live: campaign.abilitiesForSale.includes(ability.id),
    })),
    ...[...pack.cityImprovements, ...pack.infectionImprovements].map((item) => ({
      key: `bought:improvement:${item.id}`,
      live: [
        ...campaign.cityImprovementsForSale,
        ...campaign.infectionImprovementsForSale,
      ].includes(item.id as never),
    })),
    ...pack.jobs.map((job) => ({
      key: `job:${job.id}`,
      live: job.starting || campaign.jobsFound.some((found) => found.job === job.id),
    })),
    // The four summit doors have no trigger anywhere in the game.
    ...pack.seals.map((def) => ({ key: sealKey(def.seal), live: def.name !== "Summit" })),
    ...pack.reconRoutes
      .filter((route) => !route.opens)
      .map((route) => ({ key: `plan:${route.id}`, live: true })),
    ...pack.companions.map((companion) => ({ key: `found:companion:${companion.id}`, live: true })),
    ...pack.scars.map((scar) => ({
      key: `scar:${scar.id}`,
      live: campaign.scars.includes(scar.id),
    })),
    ...pack.abilities.map((ability) => ({
      key: `abilityInPlay:${ability.id}`,
      live: campaign.abilitiesForSale.includes(ability.id),
    })),
    ...[
      ...new Set(Object.values(pack.searches).flatMap((boxes) => boxes.map((box) => box.result.t))),
    ].map((result) => ({
      key: `search:${result}`,
      live: campaign.actions.includes("search"),
    })),
    ...["land", "sea"].map((kind) => ({
      key: `freeEdge:${kind}`,
      live: campaign.actions.includes("search"),
    })),
    // The Prologue cards are in play from the start and the end marker is never drawn, so neither is read in play.
    ...pack.legacyDeck
      .filter((card) => card.month > 0 && card.kind !== "end")
      .map((card) => ({ key: `legacy:${card.id}`, live: card.month <= campaign.month })),
    ...pack.objectives
      .filter((objective) => objective.id !== "prologueCenters")
      .map((objective) => ({
        key: `objective:${objective.id}`,
        live: campaign.objectives.includes(objective.id),
      })),
    ...["supply", "plague", "outbreak", "hollow", "skipped", "blocked"].map((key) => ({
      key: `infect:${key}`,
      live: true,
    })),
    ...["empty", "scar", "skull", "worker"].map((key) => ({ key: `exposure:${key}`, live: true })),
    ...["epidemic", "death", "edge", "connected", "reveal"].map((key) => ({
      key: `log:${key}`,
      live: true,
    })),
    ...["LOCKDOWN", "WAIVE_OBJECTIVE", "UNDO", "RENAME_HAVEN"].map((key) => ({
      key: `command:${key}`,
      live: true,
    })),
    ...["firstForsaken", "losingStreak"].map((key) => ({
      key: `turningPoint:${key}`,
      live: campaign.month >= 2,
    })),
  ];
}

export function untouched(audit: Audit, world: World) {
  const all = universe(world);
  return {
    live: all
      .filter((entry) => entry.live && !audit.exercised[entry.key])
      .map((entry) => entry.key),
    locked: all
      .filter((entry) => !entry.live && !audit.exercised[entry.key])
      .map((entry) => entry.key),
    total: all.length,
    done: all.filter((entry) => audit.exercised[entry.key]).length,
  };
}

export type Issue = {
  at: string;
  agent: string;
  severity: string;
  text: string;
  month: number;
  attempt: number;
  phase: string;
  turn: number | null;
};

export function renderParity(audit: Audit, world: World, issues: Issue[]): string {
  const { campaign } = world;
  const lines = [
    "# Campaign parity report",
    "",
    `Now at ${monthName(campaign.month)}, attempt ${campaign.attempt}. Games played: ${audit.games.filter((game) => game.outcome).length}. Legacy cards read: ${campaign.legacyIndex}/${pack.legacyDeck.length}. Grid cities: ${gridCityCount(campaign)} of ${[...grid(campaign)].length} locations.`,
    "",
    "## Games",
    "",
  ];
  for (const game of audit.games) {
    const research = timeline.months.find((entry) => entry.month === game.month);
    lines.push(
      `### ${monthName(game.month)}, attempt ${game.attempt}: ${game.outcome ? (game.outcome.won ? "WON" : "LOST") : "in progress"}`,
      "",
      game.outcome
        ? `- Result: ${game.outcome.reason}. ${game.outcome.turns} turns, ${game.outcome.incidents} incidents, ${game.outcome.epidemics} epidemics.`
        : "- Result: not finished.",
      `- Jobs at the table: ${game.jobs.join(", ")}.`,
      `- Legacy cards read: ${game.legacy.map((card) => `${card.id} "${card.title}" (${card.at})`).join("; ") || "none"}.`,
      `- Opened: ${game.opened.map((entry) => `${entry.bundle}${entry.forced ? " (forced)" : ""}`).join(", ") || "nothing"}.`,
      `- Objectives completed: ${game.completed.join(", ") || "none"} of ${game.setup.objectives.join(", ")} (need ${game.setup.required}).`,
      `- Setup: ${game.supplies} cubes, rationing ${game.setup.rationing}, ${game.setup.gridCities} grid cities, rules [${game.setup.rules.join(", ")}], actions [${game.setup.actions.join(", ")}].`,
      `- Bought: ${game.bought.join(", ") || "nothing"}.`,
      "- Checks against the research timeline:",
      ...game.checks.map(
        (check) =>
          `  - ${check.ok ? "ok" : "DIFF"}: ${check.name}: research ${check.expected} / engine ${check.actual}`,
      ),
      ...(research
        ? [
            "- Research notes for this month:",
            ...research.setupChanges.map((text) => `  - ${text}`),
          ]
        : []),
      "",
    );
  }
  lines.push("## Legacy deck schedule", "");
  for (const card of pack.legacyDeck) {
    const read = audit.games.flatMap((game) =>
      game.legacy.filter((entry) => entry.id === card.id).map((entry) => ({ game, entry })),
    )[0];
    lines.push(
      `- ${card.id} ${monthName(card.month)} "${card.title}": ${read ? `read in ${monthName(read.game.month)} attempt ${read.game.attempt} at ${read.entry.at}${read.game.month === card.month ? "" : " WRONG MONTH"}` : "not read yet"}`,
    );
  }
  const left = untouched(audit, world);
  lines.push(
    "",
    "## Mechanics exercised",
    "",
    `${left.done} of ${left.total} tracked mechanics have happened at least once.`,
    "",
    `Available now but never used: ${left.live.join(", ") || "none"}.`,
    "",
    `Not unlocked or not reachable yet: ${left.locked.join(", ") || "none"}.`,
    "",
    "Counts:",
    "",
    ...Object.entries(audit.exercised)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => `- ${key}: ${count}`),
    "",
    "## Problems the lab detected",
    "",
    ...(audit.problems.length
      ? audit.problems.map((problem) => `- game ${problem.game}, ${problem.at}: ${problem.text}`)
      : ["None."]),
    "",
    "## Issues the players reported",
    "",
    ...(issues.length
      ? issues.map(
          (issue) =>
            `- [${issue.severity}] ${issue.agent}, ${monthName(issue.month)}#${issue.attempt} ${issue.phase}${issue.turn === null ? "" : ` turn ${issue.turn}`}: ${issue.text}`,
        )
      : ["None."]),
    "",
  );
  return lines.join("\n");
}
