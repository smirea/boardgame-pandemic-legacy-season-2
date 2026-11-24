<!-- What the table is told in passing: lines at the top of the board, and the stamp and flash of an Epidemic. -->
<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import type { Banner, Toast } from "./announcements.svelte.ts";

  type Props = {
    toasts: Toast[];
    banner: Banner | null;
    /** A replay has no Epidemic card landing in the middle of the table, so the stamp says it. */
    spectator: boolean;
  };

  let { toasts, banner, spectator }: Props = $props();
</script>

<div class="toasts">
  {#each toasts as entry (entry.id)}
    <div class={entry.tone} in:fly={{ y: -16, duration: 220 }} out:fade={{ duration: 300 }}>
      {entry.text}
    </div>
  {/each}
</div>

<!-- A player's Epidemic card lands in the middle of the table and says all of this itself. -->
{#if banner && (spectator || banner.title !== "Epidemic")}
  {#key banner.id}
    <div class="banner" out:fade={{ duration: 450 }}>
      <strong>{banner.title}</strong>
      <span>{banner.text}</span>
    </div>
  {/key}
{/if}

{#if banner}
  {#key banner.id}<div class="flash" out:fade={{ duration: 200 }}></div>{/key}
{/if}

<style>
  .toasts {
    position: absolute;
    top: 5.6rem;
    left: 50%;
    z-index: 50;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    transform: translateX(-50%);
    pointer-events: none;
  }

  .toasts div {
    padding: 0.3rem 0.8rem;
    border: 1px solid var(--line);
    border-radius: 2px;
    background: var(--panel-solid);
    font-size: 0.82rem;
  }

  .toasts .good {
    border-color: var(--good);
    color: var(--good);
  }

  .toasts .bad {
    border-color: var(--danger);
    color: var(--danger);
  }

  /* The epidemic lands like a quarantine stamp across the chart: it overshoots, settles, and bleeds. */
  /* Above the Epidemic's panel, which opens under it in the middle of the table. */
  .banner {
    position: absolute;
    top: 6%;
    left: 50%;
    z-index: 45;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    padding: 0.7rem 2.6rem 0.8rem;
    border: 3px double rgb(176 48 28 / 0.9);
    background: rgb(28 12 8 / 0.82);
    color: #e46a4c;
    translate: -50% 0;
    rotate: -3deg;
    pointer-events: none;
    animation: stamp 520ms cubic-bezier(0.2, 1.4, 0.4, 1) both;
  }

  .banner strong {
    font-family: var(--font-display);
    font-size: 3rem;
    font-weight: 400;
    line-height: 1;
    letter-spacing: 0.04em;
  }

  .banner span {
    color: var(--ink);
    font-size: 0.9rem;
  }

  @keyframes stamp {
    from {
      opacity: 0;
      scale: 1.7;
    }
    60% {
      opacity: 1;
    }
    to {
      scale: 1;
    }
  }

  .flash {
    position: absolute;
    inset: 0;
    z-index: 43;
    box-shadow: inset 0 0 10rem 2rem rgb(140 28 18 / 0.6);
    animation: flash 1.6s ease-out forwards;
    pointer-events: none;
  }

  @keyframes flash {
    0% {
      opacity: 0;
    }
    12% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
</style>
