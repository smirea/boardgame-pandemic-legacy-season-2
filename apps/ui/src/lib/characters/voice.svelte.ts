import type { Character } from "@repo/game";
import { untrack } from "svelte";
import { setMusicDuck } from "#lib/audio/engine.ts";
import { audioSettings } from "#lib/audio/settings.svelte.ts";
import { voicePlayer } from "#lib/story/voice.svelte.ts";
import { characterFigureKey, characterVoiceKey } from "./personas.ts";
import type { CharacterLineKind, FigureKey } from "./personas.ts";
import { characterVoiceManifest } from "./voices.generated.ts";

export type CharacterPlayOptions = {
  priority?: "ui" | "game" | "death";
  /** Whether to cut off a currently playing character line. Defaults true for ui/death, false for routine game chatter. */
  interrupt?: boolean;
  /** Audition mode: bypasses cooldowns/dedupe and stops any active story voice track. */
  force?: boolean;
  /** Suppresses playback if this exact figure+kind started within the local-click dedupe window. */
  dedupe?: boolean;
  /** Override per-(figure, kind) cooldown in milliseconds for gameplay chatter. */
  cooldownMs?: number;
  /** Called when audio ends, or on the next microtask if playback cannot start. */
  onEnd?: () => void;
};

const LOCAL_DEDUPE_MS = 800;
const GAME_GLOBAL_GAP_MS = 900;
const DEFAULT_COOLDOWN_MS: Record<CharacterLineKind, number> = {
  punchline: 1400,
  scar: 8000,
  upgrade: 1200,
  thanks: 3500,
  greet: 4500,
  leave: 4500,
  danger: 6000,
  companion: 3500,
  death: 0,
};

class CharacterVoicePlayer {
  playing = $state<{ figure: FigureKey; kind: CharacterLineKind } | null>(null);
  busy = $state(false);

  private el: HTMLAudioElement | null = null;
  private token = 0;
  private active = false;
  private ducked = false;
  private idleCallbacks: (() => void)[] = [];
  private lastKey = "";
  private lastKeyAt = 0;
  private lastGameAt = 0;
  private cooldowns = new Map<string, number>();
  private hushed = false;

  constructor() {
    audioSettings.subscribe(() => this.syncVolume());
    voicePlayer.onStart(() => {
      if (this.active) this.stop();
    });
  }

  /** While hushed nothing is spoken and a line under way stops, as if the voices were turned off. */
  hush(on: boolean) {
    this.hushed = on;
    if (on) this.stop();
  }

  hasAudio(figure: FigureKey, kind: CharacterLineKind): boolean {
    return characterVoiceKey(figure, kind) in characterVoiceManifest;
  }

  private syncVolume() {
    if (!this.el) return;
    if (audioSettings.muted || !audioSettings.voiceEnabled) {
      this.stop();
      return;
    }
    this.el.volume = Math.max(0, Math.min(1, audioSettings.master * audioSettings.voice));
  }

  playFor(
    character: Pick<Character, "portrait" | "job" | "worker">,
    kind: CharacterLineKind,
    opts?: CharacterPlayOptions,
  ): boolean {
    return this.play(characterFigureKey(character), kind, opts);
  }

  play(figure: FigureKey, kind: CharacterLineKind, opts: CharacterPlayOptions = {}): boolean {
    return untrack(() => {
      const priority = opts.priority ?? "game";
      const force = opts.force ?? false;
      const interrupt = opts.interrupt ?? (priority !== "game" || force);
      const key = characterVoiceKey(figure, kind);
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();

      const bail = () => {
        if (opts.onEnd) queueMicrotask(opts.onEnd);
        return false;
      };

      if (typeof window === "undefined") return bail();
      if (this.hushed || audioSettings.muted || !audioSettings.voiceEnabled) return bail();
      const entry = characterVoiceManifest[key];
      if (!entry) return bail();

      if (!force && opts.dedupe && this.lastKey === key && now - this.lastKeyAt < LOCAL_DEDUPE_MS) {
        return bail();
      }

      if (force) {
        voicePlayer.stop();
      } else if (priority !== "death" && (voicePlayer.busy || this.ducked)) {
        // Nothing but another death talks over the story or over a character's last words.
        return bail();
      }

      if (!force && priority === "game") {
        const perKeyMs = opts.cooldownMs ?? DEFAULT_COOLDOWN_MS[kind];
        const prev = this.cooldowns.get(key) ?? -Infinity;
        if (now - prev < perKeyMs) return bail();
        if (!interrupt && now - this.lastGameAt < GAME_GLOBAL_GAP_MS) return bail();
      }

      this.stop();
      this.lastKey = key;
      this.lastKeyAt = now;
      this.cooldowns.set(key, now);
      if (priority === "game") this.lastGameAt = now;

      const run = ++this.token;
      const audio = new Audio(entry.src);
      audio.volume = Math.max(0, Math.min(1, audioSettings.master * audioSettings.voice));
      audio.preload = "auto";
      this.el = audio;
      this.active = true;
      this.playing = { figure, kind };
      this.busy = true;

      if (priority === "death") {
        this.ducked = true;
        setMusicDuck(true, 0.32);
      }

      const finish = () => {
        if (this.token !== run) return;
        this.active = false;
        this.playing = null;
        this.busy = false;
        if (this.ducked) {
          this.ducked = false;
          if (!voicePlayer.busy) setMusicDuck(false);
        }
        opts.onEnd?.();
        this.flushIdle();
      };
      audio.addEventListener("ended", finish, { once: true });
      audio.addEventListener("error", finish, { once: true });
      void audio.play().catch(finish);
      return true;
    });
  }

  /** Runs `fn` right away if silent, or as soon as the currently playing character clip ends. */
  whenIdle(fn: () => void) {
    untrack(() => {
      if (!this.active) fn();
      else this.idleCallbacks.push(fn);
    });
  }

  private flushIdle() {
    if (!this.idleCallbacks.length) return;
    const queued = this.idleCallbacks.splice(0);
    for (const fn of queued) fn();
  }

  stop() {
    untrack(() => {
      this.token++;
      if (this.el) {
        try {
          this.el.pause();
          this.el.currentTime = 0;
        } catch {
          // Already stopped.
        }
        this.el = null;
      }
      if (this.active) {
        this.active = false;
        this.playing = null;
        this.busy = false;
        if (this.ducked) {
          this.ducked = false;
          if (!voicePlayer.busy) setMusicDuck(false);
        }
      }
      this.idleCallbacks.length = 0;
    });
  }
}

export const characterVoice = new CharacterVoicePlayer();

/**
 * Silences the characters and the cast on the radio while a replay runs faster than it was played: a line would
 * still be speaking about a moment the board left behind, and the next would cut it off. Their words still show.
 */
export function hushVoices(on: boolean) {
  characterVoice.hush(on);
  voicePlayer.hush(on);
}
