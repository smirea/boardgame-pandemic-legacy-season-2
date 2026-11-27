<!--
	Whatever covers the table: a dark field over the board with one thing standing on it. It is a dialog to a screen
	reader, steps off the table while the top bar's Show board is on, and, given `onclose`, closes on Escape (the
	last one opened first) and, with `clickaway`, on a click beside what it holds.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { closeOnEscape } from "./covers.ts";

  /**
   * How it stands. `cover` centres its content on a dark field. `table` is the field alone, for a screen that lays
   * the whole table out itself, and `reveal` centres on it. `beside` shows its content at the top with the board
   * live under it. `open` has no field at all. `box`, `scar` and `undo` are covers that stand over the ones before
   * them. `upkeep` is the spending sheet, which steps into the right column when `aside`.
   */
  type Kind = "cover" | "table" | "reveal" | "beside" | "open" | "box" | "scar" | "undo" | "upkeep";

  type Props = {
    label: string;
    kind?: Kind;
    /** False while the game goes on under it. */
    modal?: boolean;
    /** Off the table for now, with whatever it holds kept as it is. */
    aside?: boolean;
    onclose?: () => void;
    clickaway?: boolean;
    /** The content rises into place as the scrim comes up. */
    rise?: boolean;
    /** Leaves by dropping off the table, where the others fade. */
    drops?: boolean;
    element?: HTMLElement | null;
    children: Snippet;
  };

  let {
    label,
    kind = "cover",
    modal = true,
    aside = false,
    onclose,
    clickaway = false,
    rise = false,
    drops = false,
    element = $bindable(null),
    children,
  }: Props = $props();

  // svelte-ignore state_referenced_locally
  if (onclose) closeOnEscape(() => onclose?.());

  const ms = $derived(kind === "box" || kind === "undo" ? 180 : 200);
  const leave = (node: Element) =>
    drops ? fly(node, { y: 120, duration: 360, opacity: 0 }) : fade(node, { duration: ms });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<div
  class="scrim {kind}"
  class:aside
  role="dialog"
  aria-modal={modal}
  aria-label={label}
  tabindex="-1"
  bind:this={element}
  in:fade|global={{ duration: ms }}
  out:leave|global
  onclick={(event) => clickaway && event.target === event.currentTarget && onclose?.()}
>
  {#if rise}
    <div class="rise" in:fly|global={{ y: 24, duration: 300 }}>{@render children()}</div>
  {:else}
    {@render children()}
  {/if}
</div>

<style>
  .scrim {
    position: absolute;
    inset: 0;
    z-index: var(--z-cover);
    display: grid;
    place-items: center;
    padding: 1rem;
    overflow: hidden;
    background: rgb(12 10 8 / 0.62);
    outline: none;
    transition: opacity 200ms ease;
  }

  .rise {
    display: flex;
    max-width: 100%;
    max-height: 100%;
    min-height: 0;
  }

  .table,
  .reveal {
    display: block;
    padding: 0;
    background: radial-gradient(ellipse at 50% 45%, rgb(12 10 8 / 0.3), rgb(10 8 6 / 0.68));
  }

  .reveal {
    display: grid;
    place-items: center;
    padding: 1rem;
    z-index: calc(var(--z-cover) + 4);
  }

  .box {
    z-index: calc(var(--z-cover) + 10);
  }

  .scar {
    z-index: calc(var(--z-cover) + 5);
  }

  .undo {
    z-index: calc(var(--z-cover) + 15);
    background: rgb(14 9 8 / 0.84);
  }

  .open {
    padding: 0;
    background: none;
  }

  .beside {
    place-items: start center;
    padding-top: 3.2rem;
    background: none;
    pointer-events: none;
  }

  /* Show board lifts every cover off the table and lets the board be panned and read, until Back. A Legacy reading
	   steps off the same way while what it changed comes onto the map. */
  :global(.peeking) .scrim,
  .scrim.aside {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition:
      opacity 200ms ease,
      visibility 0s 200ms;
  }

  /* Stepped aside, the spending sheet stands in the right column and leaves the board free to pan and read. */
  .scrim.upkeep.aside {
    inset: 0.7rem 0.7rem 0.7rem auto;
    z-index: var(--z-hud);
    display: flex;
    align-items: flex-start;
    padding: 0;
    overflow: visible;
    opacity: 1;
    visibility: visible;
    background: none;
    pointer-events: none;
  }

  .scrim.upkeep.aside > :global(*) {
    pointer-events: auto;
  }
</style>
