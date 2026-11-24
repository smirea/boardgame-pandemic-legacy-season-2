<script lang="ts">
  import { getContext } from "svelte";
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import { cityDef } from "@repo/game";
  import type { CardId, InfectionCard } from "@repo/game";
  import { CITY_COLOR } from "#lib/board/CityMarker.svelte";
  import RichText from "#lib/hud/RichText.svelte";
  import { infectionCardScan, originals, scanUrl } from "#lib/scans.svelte.ts";
  import MapArt from "./MapArt.svelte";
  import { fitText } from "./fit.ts";
  import { INFECTION_IMPROVEMENT_PRINT } from "./playerPrint.ts";

  const hoverCard = getContext<((card: CardId | null) => void) | undefined>("card-hover");

  type Props = { card: InfectionCard; onclick?: () => void };

  let { card, onclick }: Props = $props();

  const city = $derived(card.kind === "city" ? cityDef(card.city) : null);
  const accent = $derived(city ? CITY_COLOR[city.color ?? "haven"] : "#8f74ad");
  const improvement = $derived(
    card.kind === "city" && card.improvement
      ? { id: card.improvement, ...INFECTION_IMPROVEMENT_PRINT[card.improvement] }
      : undefined,
  );
  const originalScan = $derived(infectionCardScan(card));
  const hollowTitle = $derived(
    card.kind === "gather" ? "Hollow Men gather" : "Hollow Men assemble",
  );
  const cardTitle = $derived(card.kind === "city" && city ? city.name : hollowTitle);
  const hollowRule =
    "Discard this card and flip again until you reach a city. Place a Hollow Man there instead of infecting it.";
  $effect(() => () => hoverCard?.(null));
</script>

<div
  class="wrap"
  role="presentation"
  onpointerenter={() => hoverCard?.(card.id)}
  onpointerleave={() => hoverCard?.(null)}
  {@attach feedback("Infection card", () => ({
    card: card.id,
    kind: card.kind,
    improvement: improvement?.id,
  }))}
>
  <button
    class="card"
    data-card={card.id}
    data-original-active={originals.held && Boolean(originalScan)}
    style:--accent={accent}
    disabled={!onclick}
    {onclick}
    onfocus={() => hoverCard?.(card.id)}
    onblur={() => hoverCard?.(null)}
  >
    {#if originals.held && originalScan}
      <span class="original-frame">
        <img
          class="original-swap"
          class:rotated={Boolean(originalScan.card.rotated)}
          src={scanUrl(originalScan.card.src)}
          alt={cardTitle}
        />
        {#if originalScan.sticker}
          <img
            class="original-sticker"
            src={scanUrl(originalScan.sticker.src)}
            alt={originalScan.sticker.title}
          />
        {/if}
      </span>
    {:else if card.kind === "city" && city}
      <span class="art"><MapArt city={card.city} {accent} tone="night" /></span>
      {#if improvement}
        <span
          class="improvement"
          {@attach feedback("Infection improvement", () => ({ id: improvement?.id }))}
        >
          <span
            class="sticker-fit"
            {@attach fitText(`${improvement.name}: ${improvement.text}`, { min: 0.46, max: 0.78 })}
          >
            <strong class="improvement-name">{improvement.name}:</strong>
            <RichText text={improvement.text} />
          </span>
        </span>
      {/if}
      <span class="plate">
        <span class="title" {@attach fitText(city.name, { max: 1.24, min: 0.72, across: true })}
          >{city.name}</span
        >
      </span>
    {:else}
      <span class="hollow">
        <span class="title" {@attach fitText(hollowTitle, { max: 1.2, min: 0.72, across: true })}
          >{hollowTitle}</span
        >
        <span class="hollow-rule" {@attach fitText(hollowRule, { min: 0.55, max: 0.86 })}>
          <RichText text={hollowRule} />
        </span>
      </span>
    {/if}
  </button>
</div>

<style>
  .card {
    --tint: color-mix(in srgb, var(--accent) 55%, #f3e9d4);
    --deep: color-mix(in srgb, var(--accent) 55%, #120d09);
    position: relative;
    display: block;
    width: 11em;
    height: 7.2em;
    flex: none;
    padding: 0;
    border: 1px solid var(--accent);
    border-radius: 0.4em;
    background: var(--deep);
    color: #ece2cd;
    font-family: var(--font-ui);
    font-size: var(--card-size, 0.72rem);
    text-align: left;
    overflow: hidden;
    box-shadow: 0 0.3em 0.9em rgb(0 0 0 / 0.5);
  }

  .card:not(:disabled) {
    cursor: pointer;
  }

  .card[data-original-active="true"] {
    display: grid;
    place-items: center;
    background: #14110e;
  }

  .original-frame {
    position: relative;
    width: 100%;
    max-height: 100%;
    aspect-ratio: 571 / 410;
    overflow: hidden;
  }

  .original-swap {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .original-swap.rotated {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 71.8%;
    height: 139.3%;
    transform: translate(-50%, -50%) rotate(-90deg);
    object-fit: cover;
  }

  .original-sticker {
    position: absolute;
    left: 11%;
    top: 58%;
    width: 78%;
    height: auto;
    transform: translateY(-50%);
    border-radius: 0.16em;
    box-shadow: 0 1px 4px rgb(0 0 0 / 0.55);
    pointer-events: none;
  }

  .card :global(.glyphed) {
    white-space: normal;
  }

  .card :global(.glyph.supplies),
  .card :global(.glyph.plague) {
    width: 0.72em;
    height: 0.72em;
  }

  .card :global(.glyph.hollow) {
    width: 0.7em;
    height: 0.88em;
  }

  .card :global(.glyph.card) {
    width: 0.66em;
    height: 0.9em;
  }

  .card :global(.glyph.infection) {
    width: 0.9em;
    height: 0.66em;
  }

  .art {
    position: absolute;
    inset: 0;
  }

  .plate,
  .hollow {
    position: absolute;
    inset: auto 0 0 0;
    z-index: 2;
    display: flex;
    flex-direction: column;
    padding: 1.05em 0.6em 0.44em;
    background: linear-gradient(to top, var(--deep) 58%, transparent);
  }

  .hollow {
    inset: 0;
    gap: 0.28em;
    padding: 0.52em 0.64em 0.56em;
    background: repeating-linear-gradient(135deg, #1f1a24 0 0.5em, #261f2d 0.5em 1em);
  }

  .hollow-rule {
    flex: 1;
    min-height: 0;
    line-height: 1.24;
    overflow: hidden;
  }

  .title {
    font-family: var(--font-display);
    line-height: 1.05;
    white-space: nowrap;
    overflow: hidden;
  }

  .improvement {
    position: absolute;
    left: 50%;
    top: 2.65em;
    z-index: 3;
    display: flex;
    flex-direction: column;
    width: 9.4em;
    max-height: 4em;
    padding: 0.34em 0.48em;
    border: 1px solid rgb(34 25 16 / 0.45);
    border-radius: 0.22em;
    background: linear-gradient(168deg, #fcf7ea, #eee2c4);
    color: #1a140e;
    box-shadow: 0 0.2em 0.55em rgb(0 0 0 / 0.48);
    transform: translate(-50%, -50%) rotate(-4.5deg);
    overflow: hidden;
  }

  .sticker-fit {
    display: block;
    flex: 0 1 auto;
    min-height: 0;
    line-height: 1.2;
    overflow: hidden;
  }

  .improvement-name {
    margin-right: 0.22em;
    font-weight: 700;
  }
</style>
