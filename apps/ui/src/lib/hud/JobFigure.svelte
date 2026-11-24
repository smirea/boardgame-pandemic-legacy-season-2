<script lang="ts" module>
  import type { Campaign, JobId } from "@repo/game";

  /** The name of the character the box made with an occupation, the newest when there are several. */
  export const madeWith = (campaign: Campaign, job: JobId) =>
    Object.values(campaign.characters).findLast(
      (character) => character.job === job && !character.dead,
    )?.name ?? null;
</script>

<script lang="ts">
  import { figureUrl } from "#lib/characters/figures.ts";

  type Props = {
    /** The figure the occupation brings, from `jobFigure`. */
    figure: string;
    occupation: string;
    /** The character the box made with it, if a Character card was free to make one. */
    name: string | null;
    /** The figure's width; its height and its lettering follow it. */
    width: string;
  };

  let { figure, occupation, name, width }: Props = $props();
</script>

<!-- A character the box brings, standing on a cut line on nothing, as the character cards stand: its occupation hung
     under the cut at its angle, and its name under that. -->
<span class="figure" style:--w={width}>
  <span class="bust"><img src={figureUrl(figure)} alt="" /></span>
  <svg class="cut" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 100 L100 86" vector-effect="non-scaling-stroke" />
  </svg>
  <span class="words">
    <b class="occupation">{occupation}</b>
    {#if name}<span class="name">{name}</span>{/if}
  </span>
</span>

<style>
  .figure {
    position: relative;
    display: block;
    width: var(--w);
    aspect-ratio: 2 / 2.7;
    /* Room under the cut for the words hung from it. */
    margin-bottom: calc(var(--w) * 0.34);
    container-type: size;
  }

  /* The cut ends the figure at the waist; nothing else frames it. */
  .bust {
    position: absolute;
    inset: 0;
    clip-path: polygon(-50% -50%, 150% -50%, 150% 86%, 0 100%, -50% 100%);
  }

  img {
    display: block;
    width: 100%;
    height: auto;
    filter: drop-shadow(0 0.3rem 0.6rem rgb(0 0 0 / 0.6));
  }

  .cut {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .cut path {
    fill: none;
    stroke: #c9a86a;
    stroke-width: 3;
    stroke-linecap: round;
  }

  /* Hung from the cut's left end at its angle, the line running from (0, 100) to (100, 86). */
  .words {
    position: absolute;
    top: 100cqh;
    left: 4cqw;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1cqw;
    transform-origin: 0 0;
    rotate: atan2(-14cqh, 100cqw);
    translate: 0 2cqw;
    color: #f4ead6;
    line-height: 1;
    white-space: nowrap;
    text-shadow:
      0 0 0.35em rgb(0 0 0 / 0.95),
      0 1px 2px rgb(0 0 0 / 0.9);
  }

  .occupation {
    font-family: var(--font-display);
    font-size: 15cqw;
    font-weight: 400;
  }

  .name {
    color: #d8c9ab;
    font-size: 8cqw;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
</style>
