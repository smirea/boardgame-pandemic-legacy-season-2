import { pack } from "./content/pack";
import { freeCharacters, scarCandidates } from "./flow";
import type { CharacterId, PlayerId, SeatId } from "./ids";
import { checkRefund } from "./legacy";
import type { Command, Phase } from "./machine";
import { legalActions, legalDecides, legalPlays, legalPurchases } from "./options";
import type { RngState } from "./rng";
import { nextFloat, pick } from "./rng";
import type { World } from "./state";
import { tablePlayers } from "./table";

const PROGRESS = new Set([
  "recon",
  "buildCenter",
  "search",
  "establishLine",
  "chartLane",
  "buildTower",
  "buildShelter",
  "monitor",
  "broadcast",
  "transmit",
  "produce",
  "deliver",
  "sabotage",
]);

/** A random legal command for the current phase. It plays badly on purpose: the point is coverage. */
export function botCommand(world: World, phase: Phase, rng: RngState, seats = 2): Command {
  const { campaign, game } = world;
  switch (phase) {
    case "lobby": {
      const living = Object.values(campaign.characters).filter(
        (character) => !character.dead && !character.worker,
      );
      const job = pack.jobs.find(
        (candidate) =>
          candidate.starting &&
          !Object.values(campaign.characters).some((character) => character.job === candidate.id),
      );
      if (living.length < seats && job) {
        const home = pick(
          rng,
          pack.cities.filter((city) => city.kind === "haven" && !city.lost),
        ).id;
        return { type: "CREATE_CHARACTER", name: job.name, job: job.id, home };
      }
      if (campaign.month === 0 && campaign.results.length > 0) return { type: "BEGIN_CAMPAIGN" };
      const seating = Array.from({ length: seats }, (_, index) => ({
        seat: `seat-${index + 1}` as SeatId,
        character: (living[index]?.id ?? null) as CharacterId | null,
      }));
      return { type: "START_GAME", seating };
    }
    case "setup.supply":
      return game!.stockpile > 0 ? { type: "AUTO_SUPPLY" } : { type: "CONFIRM_SUPPLY" };
    case "setup.infect":
      return { type: "INFECT" };
    case "setup.events":
      return { type: "CONFIRM_EVENTS" };
    case "playing.actions":
    case "playing.draw":
    case "playing.infect": {
      const owed = game!.pending[0];
      if (owed?.t === "scarVote") {
        // Everyone at the table votes for the same character, the first who can take it.
        const waiting = tablePlayers(world.table).find((player) => !owed.votes[player]);
        return {
          type: "SCAR_VOTE",
          player: waiting ?? ("bot" as PlayerId),
          seat: scarCandidates(world, owed)[0]!,
        };
      }
      const decides = legalDecides(world);
      if (decides.length) {
        const preferred = decides.filter((decide) => decide.d !== "skip");
        return { type: "DECIDE", decide: pick(rng, preferred.length ? preferred : decides) };
      }
      if (game!.pending[0]?.t === "replace")
        return {
          type: "DECIDE",
          decide: { d: "replace", character: freeCharacters(world)[0]?.id ?? null },
        };
      if (nextFloat(rng) < 0.04) {
        const plays = legalPlays(world, phase);
        if (plays.length) return { type: "PLAY", ...pick(rng, plays) };
      }
      if (phase === "playing.draw") return { type: "DRAW" };
      if (phase === "playing.infect")
        return game!.infectionsLeft > 0
          ? { type: "INFECT" }
          : { type: "END_TURN", seat: game!.active };
      const actions = legalActions(world, game!.active).filter(
        (action) => action.a !== "selfInject" || nextFloat(rng) < 0.3,
      );
      const paid = actions.filter(
        (action) =>
          !["pickUp", "transfer", "inoculate", "salvage", "destroyInfection"].includes(action.a),
      );
      if (game!.actionsLeft === 0 || actions.length === 0 || nextFloat(rng) < 0.03)
        return { type: "END_ACTIONS", seat: game!.active };
      const progress = paid.filter((action) => PROGRESS.has(action.a));
      if (progress.length && nextFloat(rng) < 0.8)
        return { type: "ACTION", seat: game!.active, action: pick(rng, progress) };
      const pool = nextFloat(rng) < 0.85 && paid.length ? paid : actions;
      return { type: "ACTION", seat: game!.active, action: pick(rng, pool) };
    }
    case "over": {
      const waiting = tablePlayers(world.table).find((player) => !game!.ended.includes(player));
      return { type: "CONTINUE", player: waiting ?? ("bot" as PlayerId), done: true };
    }
    case "upkeep": {
      const options = legalPurchases(world);
      const upkeep = game!.upkeep!;
      const refunds = upkeep.bought.flatMap((_, index) =>
        checkRefund(world, index) === null ? [index] : [],
      );
      if (refunds.length && nextFloat(rng) < 0.05)
        return { type: "REFUND", index: pick(rng, refunds) };
      if (options.length && nextFloat(rng) < 0.9)
        return { type: "PURCHASE", purchase: pick(rng, options) };
      const waiting = tablePlayers(world.table).find((player) => !upkeep.done.includes(player));
      return { type: "FINISH_UPKEEP", player: waiting ?? ("bot" as PlayerId), done: true };
    }
    case "finished":
      throw new Error("the campaign is over");
  }
}
