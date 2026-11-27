<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import { fly } from "svelte/transition";
  import type { Bark } from "./barks.ts";
  import { CAST } from "./cast.ts";

  let { line }: { line: Bark } = $props();

  const speaker = $derived(CAST[line.speaker]);
</script>

<!-- A voice from the havens over the board. It takes no clicks and covers nothing anyone needs to reach. -->
<div
  class="radio"
  style:--accent={speaker.accent}
  role="status"
  data-testid="radio-line"
  data-bark={line.id}
  in:fly={{ y: -14, duration: 260 }}
  out:fly={{ y: -10, duration: 320 }}
  {@attach feedback("Radio line", () => line)}
>
  {#if speaker.image}
    <img src={speaker.image} alt="" />
  {/if}
  <div class="words">
    <span class="who">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M3.2 4.2a6 6 0 0 0 0 7.6M12.8 4.2a6 6 0 0 1 0 7.6M5.6 6a3 3 0 0 0 0 4M10.4 6a3 3 0 0 1 0 4"
        />
        <circle cx="8" cy="8" r="1.1" />
      </svg>
      {speaker.name}
    </span>
    <p>{line.text}</p>
  </div>
</div>

<style>
  .radio {
    position: absolute;
    top: 7.6rem;
    left: 50%;
    z-index: calc(var(--z-show) + 6);
    display: flex;
    align-items: center;
    gap: 0.7rem;
    max-width: min(34rem, 60%);
    padding: 0.45rem 1rem 0.5rem 0.5rem;
    border: 1px solid color-mix(in srgb, var(--accent) 60%, transparent);
    border-left: 4px solid var(--accent);
    border-radius: 3px;
    background: rgb(16 13 10 / 0.9);
    color: var(--paper);
    box-shadow: 0 0.6rem 1.6rem rgb(0 0 0 / 0.5);
    translate: -50% 0;
    pointer-events: none;
  }

  img {
    flex: none;
    width: 2.9rem;
    height: 2.9rem;
    border-radius: 3px;
    object-fit: cover;
    object-position: center 22%;
  }

  .words {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }

  .who {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--accent);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  svg {
    width: 0.95rem;
    height: 0.95rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.3;
    stroke-linecap: round;
  }

  circle {
    fill: currentColor;
    stroke: none;
  }

  p {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.3;
  }
</style>
