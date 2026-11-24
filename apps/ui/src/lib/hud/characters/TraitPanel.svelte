<script lang="ts">
  import type { Snippet } from "svelte";
  import CardIcon from "#lib/cards/CardIcon.svelte";
  import { SCAR_ICON } from "#lib/cards/icons.ts";

  type Props = {
    /** Where the panel stands on the arch, from 0 at the top to 1 at the foot. */
    at: number;
    kind: "job" | "ability" | "scar" | "empty";
    label?: string;
    name?: string;
    text?: string;
    /** Covered by a scar: the occupation no longer works. */
    struck?: boolean;
    /** Where and when a scar was taken. */
    taken?: string;
    /** What else the panel carries, such as the button that changes an occupation. */
    children?: Snippet;
    /** Makes the panel a choice, as the occupations are while a character is being made. */
    onclick?: () => void;
    /** Why the choice cannot be made, which crosses it out. */
    refusal?: string | null;
    testid?: string;
    /** Picked, such as the place a scar will go. */
    chosen?: boolean;
    /** A line for what is about to happen to it, such as the scar that will cover it. */
    note?: string | null;
  };

  let {
    at,
    kind,
    label,
    name,
    text,
    struck = false,
    taken,
    children,
    onclick,
    refusal = null,
    testid,
    chosen = false,
    note = null,
  }: Props = $props();
</script>

<svelte:element
  this={onclick ? "button" : "div"}
  type={onclick ? "button" : undefined}
  class="panel {kind}"
  class:struck={struck || refusal !== null}
  class:choice={Boolean(onclick)}
  class:chosen
  style:--at={at}
  aria-hidden={kind === "empty" ? "true" : undefined}
  aria-disabled={refusal !== null ? "true" : undefined}
  onclick={refusal === null ? onclick : undefined}
  data-testid={testid}
>
  {#if kind !== "empty" || name}
    <div class="body" data-fit>
      <span class="sr-only">{label}{struck ? ", covered by a scar" : ""}: </span>
      <b
        >{name}{#if taken}<i>{taken}</i>{/if}</b
      >
      {#if text}<span class="text">{text}</span>{/if}
      {#if note}<span class="note">{note}</span>{/if}
      {#if refusal}<span class="sr-only">Unavailable: {refusal}</span>{/if}
    </div>
    {#if kind === "scar"}<span class="mark" aria-hidden="true"
        ><CardIcon path={SCAR_ICON} size="2.1em" /></span
      >{/if}
    {@render children?.()}
  {/if}
</svelte:element>

<style>
  /* One stone of the arch: panels bow away from the figure in the middle and lean in at the ends. */
  .panel {
    --turn: calc(var(--at) * 180deg);
    position: relative;
    display: flex;
    flex: 1.5 1 0;
    align-items: stretch;
    gap: 0.6em;
    width: 89%;
    min-height: 0;
    margin-left: calc((1 + var(--bow, 1)) * 5% * sin(var(--turn)));
    margin-right: calc((1 - var(--bow, 1)) * 5% * sin(var(--turn)));
    padding: 0.35em 0.65em;
    border: 1px solid rgb(240 230 206 / 0.14);
    border-radius: 0.5em;
    background: linear-gradient(100deg, rgb(14 11 9 / 0.9), rgb(14 11 9 / 0.78));
    box-shadow:
      0 0.6em 1.6em rgb(0 0 0 / 0.4),
      inset 0 1px 0 rgb(255 248 232 / 0.06);
    rotate: calc(cos(var(--turn)) * -2.2deg * var(--bow, 1));
    color: #f4ead6;
    font: inherit;
    text-align: left;
    text-shadow: none;
    transition:
      opacity 200ms ease,
      border-color 200ms ease,
      background 200ms ease;
  }

  .choice {
    cursor: pointer;
  }

  .choice:hover:not([aria-disabled]),
  .choice:focus-visible {
    border-color: rgb(226 195 106 / 0.7);
    background: linear-gradient(100deg, rgb(40 31 16 / 0.86), rgb(24 19 12 / 0.6));
    outline: none;
  }

  .chosen,
  .chosen:hover {
    border-color: #d9573f !important;
    box-shadow:
      0 0 0 0.15em rgb(217 87 63 / 0.45),
      0 0.6em 1.6em rgb(0 0 0 / 0.4);
  }

  .note {
    color: #ff9a80;
    font-weight: 700;
  }

  .choice[aria-disabled] {
    cursor: default;
    opacity: 0.6;
  }

  .scar {
    background: linear-gradient(100deg, rgb(32 10 8 / 0.8), rgb(24 9 7 / 0.52));
  }

  .empty {
    flex-grow: 0.8;
    border: 1px dashed rgb(240 230 206 / 0.2);
    background: rgb(14 11 9 / 0.16);
    box-shadow: none;
  }

  .mark {
    display: grid;
    flex: none;
    place-items: center;
    align-self: center;
    color: #f0b2a6;
    opacity: 0.9;
  }

  .body {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: safe center;
    gap: 0.1em;
    min-width: 0;
    overflow: hidden;
  }

  b {
    font-family: var(--font-display);
    font-size: 1.18em;
    font-weight: 400;
    line-height: 1.05;
  }

  b i {
    margin-left: 0.5em;
    color: #b7a98e;
    font-family: var(--font-ui);
    font-size: 0.62em;
  }

  .text {
    color: #e2d7c0;
    line-height: 1.18;
  }

  .struck b,
  .struck .text {
    text-decoration: line-through;
    text-decoration-color: #d9573f;
    opacity: 0.55;
  }
</style>
