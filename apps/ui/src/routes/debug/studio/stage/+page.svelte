<script lang="ts">
  import { botCommand, parseSave } from "@repo/game";
  import type { Command, Save } from "@repo/game";
  import Crash from "#lib/hud/Crash.svelte";
  import Game from "#lib/hud/Game.svelte";
  import { GameSession } from "#lib/session/session.svelte.ts";
  import { capturePage } from "#lib/studio/capture.ts";
  import {
    liftPointer,
    placedPointer,
    placePointer,
    readScroll,
    settled,
    writeScroll,
  } from "#lib/studio/dom.ts";
  import type { StudioScene } from "#lib/studio/scene.ts";
  import { STAGE_CHANGED } from "#lib/studio/stage.ts";
  import type { StageApi } from "#lib/studio/stage.ts";
  import { LS } from "#lib/storage.ts";
  import { onDestroy, tick, untrack } from "svelte";

  type Point = { x: number; y: number };
  const HISTORY = 200;

  // The game's own menu loads a save by storing it and reloading the page. Here it replaces the game in place,
  // and the campaign this browser keeps is never touched.
  class StageSession extends GameSession {
    override importSave(raw: unknown) {
      start(parseSave(typeof raw === "string" ? JSON.parse(raw) : raw), player);
    }
    override newCampaign() {
      start(null, player);
    }
  }

  let session = $state.raw<GameSession>();
  let game = $state<Game>();
  let player = "studio";
  let debug: Window["DEBUG"];
  // Each state passed through, as the JSON of its save, so nothing later can change one.
  let saves: string[] = [];
  let at = -1;
  // Set when a state from the history is opened, so it takes its own place again rather than a new one at the end.
  let reopening: number | null = null;
  let pinned: Point | null = null;
  let pointer: Point | null = null;
  const rng = { seed: Date.now() | 0 };
  const changed = () => window.dispatchEvent(new CustomEvent(STAGE_CHANGED));

  function start(save: Save | null, as: string) {
    liftPointer();
    session?.close();
    player = as;
    session = new StageSession({ mode: "solo", secret: "", save, player });
    debug = session.debugApi();
    window.DEBUG = debug;
  }

  $effect(() => {
    if (!session?.state) return;
    const save = session.exportSave();
    untrack(() => {
      if (reopening !== null) {
        saves[reopening] = save;
        at = reopening;
        reopening = null;
      } else if (saves[at] !== save) {
        saves = [...saves.slice(0, at + 1), save].slice(-HISTORY);
        at = saves.length - 1;
      }
      LS.set({ studio: { save: JSON.parse(save) as unknown, player } });
      changed();
    });
  });

  // A scene is taken and put back with every passing animation at its end, so the two show the same thing.
  const rest = (limit?: number) =>
    settled(() => JSON.stringify(game?.cameraNow() ?? null), { limit, hurry: true });

  function scene(): StudioScene {
    if (!session || !game) throw new Error("The stage has no game on screen yet");
    return {
      v: 1,
      viewport: { width: innerWidth, height: innerHeight },
      player,
      save: JSON.parse(session.exportSave()) as Save,
      ui: { ...game.ui(), scroll: readScroll(), pointer: pinned ?? pointer },
    };
  }

  function pin(point: Point | null) {
    pinned = point;
    if (point) placePointer(point);
    else liftPointer();
    changed();
  }

  const api: StageApi = {
    ready: async () => {
      while (!game) await new Promise((resolve) => setTimeout(resolve, 30));
      await settled(() => JSON.stringify(game?.cameraNow() ?? null));
    },
    settle: () => rest(),
    scene,
    load: async (next) => {
      pinned = null;
      start(next.save, next.player);
      await tick();
      const problems = await game!.applyUi(next.ui);
      if (!(await rest())) problems.push("The screen was still moving after 4 seconds");
      problems.push(...writeScroll(next.ui.scroll));
      if (next.ui.pointer) {
        pin(next.ui.pointer);
        await rest(1500);
      }
      return problems;
    },
    capture: async () => {
      await rest();
      const taken = scene();
      return { scene: taken, image: await capturePage(taken.ui.pointer) };
    },
    state: () => session!.state!,
    send: (command) => {
      const reason = session!.explain(command);
      if (!reason) session!.send(command);
      return reason;
    },
    bot: (steps = 1) => {
      const sent: Command[] = [];
      for (let step = 0; step < steps; step++) {
        const state = session!.state!;
        if (state.phase === "finished") break;
        const command = botCommand(state.world, state.phase, rng);
        if (session!.explain(command)) break;
        session!.send(command);
        sent.push(command);
      }
      return sent;
    },
    pin,
    pinned: () => pinned,
    pointer: () => pointer,
    history: () => ({ saves: saves.map((save) => JSON.parse(save) as Save), at }),
    rewind: async (to) => {
      const save = saves[to];
      if (!save) throw new Error(`The history has no state ${to}: it holds ${saves.length}`);
      pinned = null;
      reopening = to;
      start(JSON.parse(save) as Save, player);
      await tick();
      await rest();
    },
  };
  window.STAGE = api;

  const resumed = LS.get("studio") as { save: unknown; player: string } | null;
  try {
    start(resumed ? parseSave(resumed.save) : null, resumed?.player ?? "studio");
  } catch (error) {
    // A save from an older build: the game keeps no backwards compatibility.
    console.warn("Starting the stage from a new campaign:", error);
    start(null, "studio");
  }

  onDestroy(() => {
    liftPointer();
    session?.close();
    // A hot reload makes the next page before it ends this one, so only this page's own handles are taken away.
    if (window.STAGE === api) delete window.STAGE;
    if (window.DEBUG === debug) delete window.DEBUG;
  });

  // The real pointer takes over from a placed one the moment it moves, and a pinned one comes back when it leaves.
  function moved(event: PointerEvent) {
    if (!event.isTrusted) return;
    pointer = { x: Math.round(event.clientX), y: Math.round(event.clientY) };
    if (placedPointer()) liftPointer();
  }
  function left(event: MouseEvent) {
    if (!event.isTrusted) return;
    pointer = null;
    if (pinned) placePointer(pinned);
  }
</script>

<svelte:head>
  <title>Legacy: studio stage</title>
</svelte:head>

<svelte:window onpointermovecapture={moved} />
<svelte:document onmouseleave={left} />

{#if session?.state}
  {#key session}
    <svelte:boundary>
      <Game bind:this={game} session={session!} />
      {#snippet failed(error)}
        <Crash {error} session={session!} />
      {/snippet}
    </svelte:boundary>
  {/key}
{/if}
