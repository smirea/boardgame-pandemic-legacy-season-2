import { botCommand, campaignAt, createGameActor, phaseOf } from "@repo/game";
import type { Save } from "@repo/game";

/* What the measuring scripts share: the game they stand a browser on, and the window they open it in. */

/**
 * A game of `month` standing at a player's action step with its briefing read, which is where a table spends its
 * time. The bot plays the campaign's lobby and the setup up to there.
 */
export function actionSave(month: number): Save {
  const rng = { seed: 7 };
  const actor = createGameActor({ seed: 12, save: campaignAt(month) });
  actor.start();
  for (let step = 0; step < 400; step++) {
    const snapshot = actor.getSnapshot();
    const phase = phaseOf(snapshot);
    const world = snapshot.context.world;
    const idle = phase === "playing.actions" && world.game!.pending.length === 0;
    if (idle && world.campaign.briefing.length === 0) return { v: 1, phase, world };
    actor.send(idle ? { type: "ACK_BRIEFING" } : botCommand(world, phase, rng, 4));
  }
  throw new Error(`month ${month} never reached an action step`);
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Chromium flags for a real, GPU-backed window that keeps drawing whatever covers it: a window another one hides
 * stops drawing, which would read as an idle game.
 */
export const WINDOW_ARGS = [
  "--ignore-gpu-blocklist",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-features=CalculateNativeWinOcclusion",
];
