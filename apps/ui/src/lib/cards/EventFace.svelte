<!--
	What an Event card says, on a Player card and on the Legacy card that brings it: the banner, the name, the rules
	over the event's emblem, and when it may be played. The card around it gives the background. `roomy` is the Legacy
	card's proportions, whose text runs larger against its em. Spans only, since a Player card is a button.
-->
<script lang="ts">
  import type { EventId } from "@repo/game";
  import RichText from "#lib/hud/RichText.svelte";
  import { fitText } from "./fit.ts";
  import { eventArtUrl } from "./playerPrint.ts";
  import type { EventPrint } from "./playerPrint.ts";

  type Props = { event: EventId; name: string; print: EventPrint; roomy?: boolean };

  let { event, name, print, roomy = false }: Props = $props();

  const titleFit = $derived(
    roomy ? { max: 1.4, min: 0.8, across: true } : { max: 1.08, min: 0.54, across: true },
  );
  const rulesFit = $derived(roomy ? { max: 1.12, min: 0.56 } : { max: 0.94, min: 0.5 });
</script>

<span class="ev {print.mode}" class:roomy>
  <span class="ev-top">
    <span class="ev-kicker-row">
      <span class="ev-kicker">{print.banner}</span>
      {#if print.destroy}
        <span class="ev-once">Destroy</span>
      {/if}
    </span>
    <span class="ev-title" {@attach fitText(name, titleFit)}>{name}</span>
  </span>
  {#if print.mode === "unrationed"}
    <span class="ev-hazard" aria-hidden="true"></span>
  {/if}
  <span class="ev-body" class:has-leaf={Boolean(print.timing)}>
    <img class="ev-art" src={eventArtUrl(event)} alt="" aria-hidden="true" />
    <span class="ev-rules" {@attach fitText(print.rules.join(" "), rulesFit)}>
      {#each print.rules as line, idx (idx)}
        <span class="rule-line"><RichText text={line} /></span>
      {/each}
    </span>
    {#if print.timing}
      <span class="ev-leaf">{print.timing}</span>
    {/if}
  </span>
</span>

<style>
  /* The parts lie straight in the card's own column. */
  .ev {
    display: contents;
    --top-gap: 0.08em;
    --top-pad: 0.34em 0.5em 0.34em;
    --kicker: 0.54em;
    --kicker-space: 0.05em;
    --title-space: 0.02em;
    --title-line: 0.98;
    --rules-gap: 0.35em;
    --rules-pad: 0.48em 0.52em 0.52em;
    --rules-line: 1.24;
    --leaf-room: 1.55em;
    --leaf-pad: 0.22em 0.62em 0.2em 0.48em;
    --leaf-corner: 0.65em;
    --leaf-size: 0.54em;
  }

  .ev.roomy {
    --top-gap: 0.14em;
    --top-pad: 0.62em 0.85em 0.6em;
    --kicker: 0.72em;
    --kicker-space: 0.06em;
    --title-space: 0.03em;
    --title-line: 1.02;
    --rules-gap: 0.55em;
    --rules-pad: 0.85em 0.9em 0.9em;
    --rules-line: 1.32;
    --leaf-room: 2.3em;
    --leaf-pad: 0.34em 0.9em 0.3em 0.75em;
    --leaf-corner: 0.95em;
    --leaf-size: 0.74em;
  }

  .ev-top {
    display: flex;
    flex-direction: column;
    gap: var(--top-gap);
    padding: var(--top-pad);
    background: linear-gradient(165deg, #1b221c, #101511);
    color: #a6e39d;
    flex: none;
  }

  .unrationed .ev-top {
    color: #ffd89b;
  }

  .permanent .ev-top {
    background: #eef3fb;
    color: #193263;
  }

  .ev-kicker-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.35em;
  }

  .ev-kicker {
    font-size: var(--kicker);
    font-weight: 800;
    font-style: italic;
    letter-spacing: var(--kicker-space);
    text-transform: uppercase;
    color: #f4d678;
  }

  .unrationed .ev-kicker {
    color: #f6a962;
  }

  .permanent .ev-kicker {
    color: #466196;
  }

  .ev-once {
    font-size: 0.5em;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #ff8e7b;
    line-height: 1;
  }

  .ev-title {
    font-family: var(--font-display);
    line-height: var(--title-line);
    text-transform: uppercase;
    letter-spacing: var(--title-space);
  }

  .roomy .ev-title {
    font-weight: 400;
  }

  .ev-hazard {
    display: block;
    flex: none;
    height: 0.22em;
    background: repeating-linear-gradient(-45deg, #c24b1c 0 0.34em, #18110c 0.34em 0.68em);
  }

  .ev-body {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .ev-art {
    position: absolute;
    right: -11%;
    bottom: -11%;
    z-index: 0;
    width: 82%;
    height: 82%;
    object-fit: contain;
    object-position: right bottom;
    opacity: 0.21;
    mix-blend-mode: multiply;
    pointer-events: none;
    user-select: none;
  }

  .permanent .ev-art {
    filter: invert(1);
    opacity: 0.22;
    mix-blend-mode: screen;
  }

  .ev-rules {
    position: relative;
    z-index: 1;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--rules-gap);
    padding: var(--rules-pad);
    overflow: hidden;
    font-weight: 500;
    line-height: var(--rules-line);
  }

  .ev-body.has-leaf .ev-rules {
    padding-bottom: var(--leaf-room);
  }

  .rule-line {
    display: block;
  }

  .ev-leaf {
    position: absolute;
    left: 0;
    bottom: 0;
    z-index: 2;
    padding: var(--leaf-pad);
    border-radius: 0 var(--leaf-corner) 0 0;
    background: #171d18;
    color: #f3e6c2;
    font-size: var(--leaf-size);
    font-weight: 700;
    letter-spacing: 0.02em;
    line-height: 1.1;
    white-space: nowrap;
  }

  .unrationed .ev-leaf {
    color: #ffd89b;
  }
</style>
