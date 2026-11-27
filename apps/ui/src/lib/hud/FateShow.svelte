<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import { fade, scale } from "svelte/transition";
  import { backOut } from "svelte/easing";
  import CharacterSheet from "./characters/CharacterSheet.svelte";
  import type { FateScene } from "./fateShow.svelte.ts";
  import { placed } from "./traits.ts";

  type Props = {
    scene: FateScene;
    color: string;
    /** What the Chronicler says over a death. */
    epitaph: string;
  };

  let { scene, color, epitaph }: Props = $props();

  function verdictOf(result: "empty" | "scar" | "skull", name: string) {
    switch (result) {
      case "empty":
        return { title: "Nothing", text: "The box is empty." };
      case "scar":
        return { title: "A scar", text: `${name} carries this scar for good.` };
      case "skull":
        return { title: "Dead", text: `The plague claims ${name}.` };
    }
  }
  const side = $derived(
    document.querySelector(`.place[data-seat="${scene.who.seat}"]`)?.matches(".tr, .br")
      ? "right"
      : "left",
  );
</script>

<!--
	The table stops to watch what happens to one of its own, on the character's own card. It takes no clicks: the scar
	is chosen and the seat refilled on the screens that follow.
-->
<div
  class="fate {scene.t}"
  class:bad={scene.t === "scratch" && scene.stage === "open" && scene.result !== "empty"}
  style:--seat={color}
  role="status"
  data-testid="fate-show"
  data-scene={scene.t}
  data-stage={scene.t === "scratch" ? scene.stage : undefined}
  transition:fade={{ duration: 260 }}
  {@attach feedback("Fate", () => ({ ...scene, who: scene.who.name }))}
>
  {#if scene.t === "scratch"}
    {@const verdict = verdictOf(scene.result, scene.who.name)}
    <div class="stack" in:scale={{ start: 0.85, duration: 380, easing: backOut }}>
      <span class="kicker">Exposed</span>
      <div class="card">
        <CharacterSheet
          character={scene.who.character}
          tone="mine"
          {color}
          {side}
          showJournal={false}
          label="Exposed character"
          exposure={{
            boxes: scene.track.map((box) => (box === "hidden" ? "sealed" : box)),
            now: scene.box,
            stage: scene.stage,
          }}
        />
      </div>
      <p class="verdict" class:shown={scene.stage === "open"} data-testid="fate-verdict">
        <b>{verdict.title}</b>
        <span>{verdict.text}</span>
      </p>
    </div>
  {:else}
    <div class="stack obituary" in:scale={{ start: 0.9, duration: 700 }}>
      <span class="kicker">In memory</span>
      <div class="card">
        <CharacterSheet
          character={scene.who.character}
          tone="dead"
          {color}
          {side}
          showJournal={false}
          label="Fallen character"
        >
          {#snippet base()}<span class="where">Died in {placed(scene.at, scene.month)}</span
            >{/snippet}
        </CharacterSheet>
      </div>
      <p class="life"><b>{scene.games}</b> {scene.games === 1 ? "game" : "games"} played</p>
      <p class="epitaph">{epitaph}</p>
    </div>
  {/if}
</div>

<style>
  .fate {
    position: absolute;
    inset: 0;
    z-index: calc(var(--z-show) + 4);
    display: grid;
    place-items: center;
    background: radial-gradient(ellipse at 50% 46%, rgb(18 13 9 / 0.78), rgb(8 6 4 / 0.9));
    pointer-events: none;
    transition: background 500ms ease;
  }

  .stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.7rem;
  }

  .card {
    width: min(44rem, 62vw, calc(68vh * 1.2));
    aspect-ratio: 1.2;
  }

  .life {
    margin: 0;
    color: var(--paper);
    font-size: 0.95rem;
    opacity: 0.85;
  }

  .fate.bad,
  .fate.memorial {
    background: radial-gradient(ellipse at 50% 46%, rgb(58 12 8 / 0.82), rgb(8 4 3 / 0.94));
  }

  .kicker {
    padding: 0.12rem 0.8rem;
    border-radius: 2px;
    background: var(--danger);
    color: #fff4ea;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .verdict {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    margin: 0;
    opacity: 0;
    translate: 0 0.4rem;
    transition:
      opacity 240ms ease,
      translate 240ms ease;
  }

  .verdict.shown {
    opacity: 1;
    translate: 0 0;
  }

  .verdict b {
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 400;
    line-height: 1.1;
  }

  .bad .verdict b {
    color: #ff7a5c;
  }

  .verdict span {
    font-size: 0.95rem;
    opacity: 0.8;
  }

  .obituary .kicker {
    background: rgb(243 230 214 / 0.16);
    color: var(--paper);
  }

  .where {
    font-size: 1.1rem;
    color: #ff9a80;
  }

  .epitaph {
    max-width: 38rem;
    margin: 0;
    color: var(--paper);
    text-align: center;
    padding-top: 0.7rem;
    border-top: 1px solid rgb(243 230 214 / 0.2);
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-style: italic;
    line-height: 1.35;
  }
</style>
