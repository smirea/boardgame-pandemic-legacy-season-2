import { pack } from "@repo/game";
import type { LogEntry, Phase, World } from "@repo/game";
import { barkFor, BARKS, type Bark, type BarkMoment } from "./barks.ts";
import { voicePlayer } from "./voice.svelte.ts";
import { entriesSince } from "#lib/hud/logWatch.ts";

/** A line stays up this long when nothing is heard: the voice is off, or the browser has not been clicked yet. */
const READ_MS = 4200;
/** Turns between two lines that are not urgent, so the radio stays an event. */
const QUIET_TURNS = 3;
/** With this many Player cards left or fewer, the game is nearly out of time. */
const LOW_DECK = 6;
/** More log entries than this at once is a jump, which nobody lived through. */
const MOST_ENTRIES = 12;

type Seen = { seq: number; stockpile: number; deck: number; ended: boolean };

/**
 * The cast on the radio, answering what this table did: the first city lost, the stockpile running dry, the last
 * incident before the end. It reads the log, so every browser picks the same line at the same moment, and it keeps
 * to itself: one line at a time, never over the story or a reading, and a few turns between lines that can wait.
 */
export class Radio {
  line = $state.raw<(Bark & { key: number }) | null>(null);

  private seen: Seen | null = null;
  private played = -1;
  private said = new Set<BarkMoment>();
  private lastTurn = -99;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private waiting: { moment: BarkMoment; pick: number; key: number } | null = null;

  /**
   * `quiet` while something else has the table's ears: the story, a reading, a card being shown. `busy` while the
   * board is still showing what just happened, such as an incident's skull: the line waits for the picture.
   */
  observe(world: World, phase: Phase, live: boolean, quiet: boolean, busy: boolean) {
    const game = world.game;
    if (!game) {
      this.seen = null;
      return this.stop();
    }
    const now: Seen = {
      seq: game.log.at(-1)?.seq ?? -1,
      stockpile: game.stockpile,
      deck: game.playerDeck.order.length,
      ended: game.outcome !== null,
    };
    const before = this.seen;
    this.seen = now;
    // A new game forgets what the last one heard.
    if (this.played !== world.campaign.results.length) {
      this.played = world.campaign.results.length;
      this.said.clear();
      this.lastTurn = -99;
    }
    if (!before || !live || now.seq < before.seq) {
      this.waiting = null;
      return;
    }
    const fresh = entriesSince(game.log, before.seq);
    // Setting a game up empties the stockpile and builds the deck on purpose: nothing there is news.
    const inPlay = phase.startsWith("playing") || phase === "over";
    const moment =
      fresh.length > MOST_ENTRIES || !inPlay ? null : this.moment(world, fresh, before, now);
    // What the table is told about is the latest thing, unless what already waits cannot wait.
    if (moment && !(this.waiting && BARKS[this.waiting.moment].urgent && !BARKS[moment].urgent))
      this.waiting = { moment, pick: now.seq + world.campaign.results.length, key: now.seq };
    if (!this.waiting || busy) return;
    const { moment: due, pick, key } = this.waiting;
    const def = BARKS[due];
    // A line that cannot wait still never talks over the story or a reading: it is said once they are done.
    if (def.urgent && quiet) return;
    this.waiting = null;
    if (def.once && this.said.has(due)) return;
    if (
      !def.urgent &&
      (quiet || this.line || voicePlayer.busy || game.turn - this.lastTurn < QUIET_TURNS)
    )
      return;
    this.said.add(due);
    this.lastTurn = game.turn;
    this.say(barkFor(due, pick), key);
  }

  /** Says a line outside the game's own moments, such as the words over a death. */
  say(bark: Bark, key: number) {
    this.clear();
    this.line = { ...bark, key };
    const done = () => {
      if (this.line?.key === key) this.line = null;
    };
    // A line cut off, by the story starting or the voices being turned off, leaves with its voice.
    const spoken = voicePlayer.play(bark.id, () => (this.timer = setTimeout(done, 500)), done);
    if (!spoken) this.timer = setTimeout(done, READ_MS);
  }

  stop() {
    this.clear();
    if (this.line) voicePlayer.stop();
    this.line = null;
    this.waiting = null;
  }

  private clear() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** The most pressing thing that just happened, if any of it is worth a word. */
  private moment(world: World, fresh: LogEntry[], before: Seen, now: Seen): BarkMoment | null {
    const game = world.game!;
    const has = (t: LogEntry["t"]) => fresh.some((entry) => entry.t === t);
    const incidents = fresh.filter((entry) => entry.t === "incident");
    if (now.ended && !before.ended) return game.outcome!.won ? "won" : "lost";
    if (now.ended) return null;
    if (incidents.length && game.incidents === pack.numbers.incidentLimit - 1) return "brink";
    if (incidents.some((entry) => entry.t === "incident" && entry.total === 1))
      return "firstIncident";
    if (has("outbreak")) return "outbreak";
    if (fresh.some((entry) => entry.t === "infect" && entry.effect === "hollow")) return "hollow";
    if (has("objective")) return "objective";
    if (before.stockpile > 0 && now.stockpile === 0) return "stockpileDry";
    if (before.deck > LOW_DECK && now.deck <= LOW_DECK && now.deck > 0) return "lowDeck";
    if (has("connected")) return "connected";
    return null;
  }
}
