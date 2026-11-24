<script lang="ts">
  import type { Character } from "@repo/game";
  import CardIcon from "#lib/cards/CardIcon.svelte";
  import { fitText } from "#lib/cards/fit.ts";
  import { SCAR_ICON } from "#lib/cards/icons.ts";
  import { figureKey, figureUrl, headOf } from "#lib/characters/figures.ts";
  import { characterTraits, TRAIT_KIND } from "../traits.ts";

  type Props = {
    character: Character | undefined;
    /** The face a seat without a character shows. */
    portrait: number;
    name: string;
    color: string;
    /** The side of the screen the seat is on: the figure stands at the edge and looks in. */
    side: "left" | "right";
    /** Supply cubes on the card. */
    supplies: number;
    /** Cubes flying in, whose places stand empty until they land. */
    coming?: number;
    active?: boolean;
  };

  let {
    character,
    portrait,
    name,
    color,
    side,
    supplies,
    coming = 0,
    active = false,
  }: Props = $props();

  const key = $derived(
    figureKey({
      portrait: character?.portrait ?? portrait,
      job: character?.job ?? null,
      hooded: character?.worker ?? false,
    }),
  );
  const head = $derived(headOf(key));
  const traits = $derived(character ? characterTraits(character) : []);
</script>

<!-- The character as the table sees it all game: the figure from the chest up, the name and what it can do. -->
<span class="mini {side}" class:active class:dead={character?.dead} style:--seat={color}>
  <span
    class="bust"
    style:--hx={head.x}
    style:--hy={head.y}
    style:--hs={head.size}
    style:--ha={head.aspect}
  >
    <img src={figureUrl(key)} alt="" />
  </span>
  <svg class="cut" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <path d="M-2 98 L50 88" vector-effect="non-scaling-stroke" />
  </svg>
  {#if active}<span class="turn" data-testid="current-turn">Current turn</span>{/if}
  {#if supplies + coming}
    <span class="cubes" role="img" aria-label={`${supplies} supply cubes carried`}>
      {#each { length: supplies + coming } as _, index (index)}
        <i class:coming={index >= supplies} data-cube={index >= supplies ? "coming" : "solid"}></i>
      {/each}
    </span>
  {/if}
  <span class="info">
    <span class="name">
      {#key name}<strong {@attach fitText(name, { min: 0.55, across: true })}>{name}</strong>{/key}
    </span>
    {#if character?.carrier}<span class="sample" data-testid="carrier-badge">Sample</span>{/if}
    {#each traits as trait, index (`${trait.kind}:${trait.name}:${index}`)}
      <span class="trait {trait.kind}" class:struck={trait.struck}>
        <span class="sr-only">{TRAIT_KIND[trait.kind]}: </span>
        <b>{trait.name}</b>
        {#if trait.kind === "scar"}<CardIcon path={SCAR_ICON} size="1.05em" />{/if}
      </span>
    {/each}
  </span>
</span>

<style>
  .mini {
    --bust: 44cqw;
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    container-type: size;
    color: #f4ead6;
    text-align: left;
    text-shadow:
      0 0 0.35rem rgb(0 0 0 / 0.95),
      0 1px 2px rgb(0 0 0 / 0.9);
  }

  /* The head takes most of the bust's width, its top just under the bust's top edge. */
  .bust {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: var(--bust);
    /* Only the cut ends the figure: its head, shoulders and glow may spill far past the bust's other edges. The bottom
		   edge is the cut line carried across the bust's coordinates. */
    clip-path: polygon(-300% -100%, 400% -100%, 400% 63.8%, -300% 123%);
    pointer-events: none;
  }

  .right .bust {
    right: 0;
    left: auto;
    scale: -1 1;
  }

  /* The head takes two thirds of the bust's width and its centre a third of the way down it. A drawing with little
	   body under the head is drawn larger, as much as it takes for its foot to reach the bottom, so every figure stands
	   on the cut rather than floating above it. */
  img {
    --head-y: calc(3cqh + var(--bust) * 0.33);
    --w: max(
      var(--bust) * 0.66 / var(--hs),
      (100cqh - var(--head-y)) * var(--ha) / (1 - var(--hy))
    );
    position: absolute;
    left: calc(var(--bust) * 0.5 - var(--w) * var(--hx));
    top: calc(var(--head-y) - var(--w) * var(--hy) / var(--ha));
    width: var(--w);
    max-width: none;
    height: auto;
    filter: drop-shadow(0 0.4rem 0.8rem rgb(0 0 0 / 0.7));
    transition: filter 300ms ease;
  }

  /* The active character and its Current turn share one tight glow, which pulses a few times as the turn starts.
	   Both ends are the plain seat colour: Chrome turns a color-mix() with transparent to garbage mid-animation. */
  .mini {
    --glow-low: drop-shadow(0 0 0.5px var(--seat)) drop-shadow(0 0 1px var(--seat));
    --glow-high: drop-shadow(0 0 1.5px var(--seat)) drop-shadow(0 0 3.5px var(--seat));
    --shade: drop-shadow(0 0.4rem 0.8rem rgb(0 0 0 / 0.7));
  }

  .active img {
    filter: var(--glow-low) var(--shade);
    animation: figure-glow 1.4s ease-in-out 6;
  }

  @keyframes figure-glow {
    50% {
      filter: var(--glow-high) var(--shade);
    }
  }

  .dead img {
    filter: grayscale(1) brightness(0.75);
  }

  .cut {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
  }

  .right .cut {
    scale: -1 1;
  }

  .cut path {
    fill: none;
    stroke: var(--seat);
    stroke-width: 4.5;
    stroke-linecap: round;
  }

  /* Hangs under the cut line at its angle, which follows the seat's shape (the line runs from (-2, 98) to (50, 88)). */
  .turn {
    position: absolute;
    top: 97.25cqh;
    left: 2cqw;
    z-index: 1;
    transform-origin: 0 0;
    rotate: atan2(-10cqh, 52cqw);
    translate: 0 3px;
    color: #0b0806;
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 12cqw, 2.3rem);
    line-height: 1;
    white-space: nowrap;
    -webkit-text-stroke: 0.14em var(--seat);
    paint-order: stroke fill;
    text-shadow: none;
    filter: var(--glow-low);
    pointer-events: none;
    animation: turn-glow 1.4s ease-in-out 6;
  }

  .right .turn {
    right: 2cqw;
    left: auto;
    transform-origin: 100% 0;
    rotate: atan2(10cqh, 52cqw);
  }

  @keyframes turn-glow {
    50% {
      filter: var(--glow-high);
    }
  }

  /* Carried cubes ride the cut under the figure. */
  /* Carried cubes stand on the cut line at its angle, from the screen's edge in. */
  .cubes {
    position: absolute;
    bottom: calc(2.96cqh + 3px);
    left: 3cqw;
    display: flex;
    flex-wrap: wrap-reverse;
    gap: 2px;
    width: 40cqw;
    transform-origin: 0 100%;
    rotate: atan2(-10cqh, 52cqw);
    filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.7));
  }

  .right .cubes {
    right: 3cqw;
    left: auto;
    flex-direction: row-reverse;
    transform-origin: 100% 100%;
    rotate: atan2(10cqh, 52cqw);
  }

  .cubes i.coming {
    visibility: hidden;
  }

  .cubes i {
    width: 0.95rem;
    height: 0.95rem;
    border: 1px solid rgb(20 12 4 / 0.55);
    background: conic-gradient(
      from 30deg at 50% 35%,
      #b1a38a 0deg 120deg,
      #e0d5bb 120deg 240deg,
      #fff5dc 240deg
    );
    clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
  }

  .info {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: calc(var(--bust) - 2cqw);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    font-size: 0.76rem;
  }

  /* Clear of Current turn, which climbs with the cut line under the traits' side. */
  .active .info {
    bottom: 18cqh;
  }

  .right .info {
    right: calc(var(--bust) - 2cqw);
    left: 0;
    align-items: flex-end;
  }

  /* The name's largest size; it is fitted down to the room beside the figure. */
  .name {
    display: flex;
    align-self: stretch;
    margin-bottom: 1px;
    font-family: var(--font-display);
    font-size: 1.5rem;
    line-height: 1.05;
  }

  .right .name {
    justify-content: flex-end;
  }

  strong {
    min-width: 0;
    overflow: hidden;
    font-weight: 400;
    white-space: nowrap;
  }

  .active strong {
    color: color-mix(in srgb, var(--seat) 35%, #fff4dc);
  }

  .trait {
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
    max-width: 100%;
    padding: 0.12em 0.5em;
    border: 1px solid rgb(240 230 206 / 0.14);
    border-radius: 0.35em;
    background: rgb(14 11 9 / 0.82);
    text-shadow: none;
    white-space: nowrap;
  }

  .trait b {
    overflow: hidden;
    font-weight: 700;
    text-overflow: ellipsis;
  }

  .trait.scar {
    background: rgb(70 16 10 / 0.82);
    color: #ffd9d0;
  }

  .trait.struck b {
    text-decoration: line-through;
    text-decoration-color: #d9573f;
    opacity: 0.6;
  }

  .sample {
    padding: 0.05em 0.45em;
    border: 1px solid #3fe3b0;
    border-radius: 999px;
    background: rgb(14 48 40 / 0.92);
    color: #9bf5d7;
    font-size: 0.85em;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-shadow: none;
  }
</style>
