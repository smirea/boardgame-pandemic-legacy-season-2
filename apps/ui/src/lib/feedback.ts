import type { FeedbackEngine } from "@stefan.inc/feedback-engine/svelte";
import { MONTHS } from "./hud/labels.svelte.ts";

let engine: Promise<FeedbackEngine> | undefined;

const ROLES = { solo: "solo", host: "hosting", join: "joined" } as const;

/** One line naming the game on screen, such as `campaign, hosting, 3p, November, playing.actions, turn 4`. */
function gameSetup(): Record<string, string> {
  const debug = window.DEBUG;
  const state = debug?.getState();
  if (!debug || !state) return {};
  const { campaign, table, game } = state.world;
  const players = new Set(table.seats.map((entry) => entry.player)).size;
  return {
    "Game Setup": [
      "campaign",
      ROLES[debug.connection().mode],
      `${players}p`,
      game && game.seats.length !== players && `${game.seats.length} characters`,
      MONTHS[campaign.month] ?? `month ${campaign.month}`,
      campaign.attempt === 2 && "second attempt",
      state.phase,
      game && state.phase.startsWith("playing") && `turn ${game.turn}`,
    ]
      .filter(Boolean)
      .join(", "),
  };
}

/**
 * Alt+Meta+click anything to open the feedback editor on it, in every build. The import is dynamic, so the editor
 * loads after the page and never delays the first frame. ProcrastiMate posts open `/feedback` on ProcrastiMate's own
 * origin using whoever is signed in there, with no token or proxy. Every export but the image carries the save and the
 * recording at the moment of the capture, in the formats the Menu's import and `/replay` open.
 */
export function startFeedback(): () => void {
  const started = import("@stefan.inc/feedback-engine/svelte").then(({ setupFeedbackEngine }) => {
    const feedback = setupFeedbackEngine({
      app: "Pandemic Legacy S2",
      pinned: ["ProcrastiMate"],
      procrastimate: { projects: ["a/bg-pandemic-2"] },
      metadata: gameSetup,
      files: [
        { name: "save.json", data: () => window.DEBUG?.getSave() },
        { name: "recording.json", data: () => window.DEBUG?.fetchRecord() },
      ],
    });
    feedback.context("Connection", () => window.DEBUG?.connection() ?? null);
    feedback.context("Game", () => {
      const state = window.DEBUG?.getState();
      if (!state) return null;
      const { campaign, game } = state.world;
      return {
        phase: state.phase,
        month: campaign.month,
        attempt: campaign.attempt,
        turn: game?.turn,
        active: game?.active,
        actionsLeft: game?.actionsLeft,
        epidemics: game?.epidemics,
        incidents: game?.incidents,
        pending: game?.pending.map((decision) => decision.t),
      };
    });
    return feedback;
  });
  engine = started;
  return () => {
    if (engine === started) engine = undefined;
    void started.then((feedback) => feedback.destroy());
  };
}

export async function presentFeedback() {
  if (!engine)
    throw new Error("Feedback is not started: startFeedback() runs from the root layout");
  await (await engine).present();
}
