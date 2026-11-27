<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import type { World } from "@repo/game";
  import { fly } from "svelte/transition";
  import { seatName, seatColor } from "./labels.svelte.ts";

  type Props = {
    /** The moment of the game the board shows. */
    world: World;
    progress: number;
    onstop: () => void;
  };

  let { world, progress, onstop }: Props = $props();

  const game = $derived(world.game);
  const active = $derived(game && game.turn > 0 ? game.active : null);
</script>

<!-- What the board is showing while it plays the game back, and the way out of it. -->
<div
  class="lapse"
  role="status"
  aria-label="The game played back"
  data-testid="time-lapse"
  transition:fly={{ y: 24, duration: 260 }}
  {@attach feedback("Time-lapse", () => ({ progress, turn: game?.turn }))}
>
  <span class="title">The game, played back</span>
  {#if game}
    <span class="turn">
      {#if active}
        <i style:background={seatColor(active)}></i>{seatName(world, active)} · turn {game.turn}
      {:else}
        Setting up
      {/if}
    </span>
    <span class="count" aria-label={`${game.incidents} incidents`}>◆ {game.incidents}</span>
    <span class="count" aria-label={`${game.epidemics} Epidemics`}>☣ {game.epidemics}</span>
  {/if}
  <button onclick={onstop} data-testid="time-lapse-stop">Skip <kbd>Esc</kbd></button>
  <span class="bar" aria-hidden="true"><i style:scale={`${progress} 1`}></i></span>
</div>

<style>
  .lapse {
    position: absolute;
    /* Over the foot of the map, clear of the bar the dock shows once a game is over. */
    bottom: 5.6rem;
    left: 50%;
    z-index: calc(var(--z-show) + 5);
    display: flex;
    align-items: center;
    gap: 1.1rem;
    padding: 0.5rem 0.6rem 0.65rem 1rem;
    border: 1px solid var(--line);
    border-radius: 3px;
    background: rgb(16 13 10 / 0.92);
    color: var(--paper);
    box-shadow: 0 0.6rem 1.6rem rgb(0 0 0 / 0.5);
    font-size: 0.9rem;
    white-space: nowrap;
    translate: -50% 0;
    overflow: hidden;
  }

  .title {
    font-family: var(--font-display);
    font-size: 1.2rem;
  }

  .turn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 9rem;
  }

  .turn i {
    display: block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 50%;
  }

  .count {
    min-width: 2.4rem;
    opacity: 0.85;
  }

  button {
    padding: 0.2rem 0.7rem;
    border: 1px solid var(--line);
    border-radius: 2px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  kbd {
    margin-left: 0.3rem;
    font: inherit;
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .bar {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 3px;
    background: rgb(243 230 214 / 0.15);
  }

  .bar i {
    display: block;
    height: 100%;
    background: #e3b23c;
    transform-origin: 0 50%;
    transition: scale 120ms linear;
  }
</style>
