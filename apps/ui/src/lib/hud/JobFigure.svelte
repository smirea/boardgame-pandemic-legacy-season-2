<script lang="ts">
  import { figureUrl } from "#lib/characters/figures.ts";

  type Props = {
    /** The figure the occupation brings, from `jobFigure`. */
    figure: string;
    name: string;
    /** The figure's width; its height follows the drawing. */
    width: string;
  };

  let { figure, name, width }: Props = $props();
</script>

<!-- A character the box brings, as the table will see it on its card: the figure standing on a cut line with its name
     hung under the cut at its angle, on nothing. -->
<span class="figure" style:--w={width}>
  <span class="bust"><img src={figureUrl(figure)} alt="" /></span>
  <svg class="cut" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 100 L100 86" vector-effect="non-scaling-stroke" />
  </svg>
  <b class="name">{name}</b>
</span>

<style>
  .figure {
    position: relative;
    display: block;
    width: var(--w);
    aspect-ratio: 2 / 2.7;
    /* Room under the cut for the name hung from it. */
    margin-bottom: calc(var(--w) * 0.2);
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

  /* Hangs from the cut's left end at its angle, the line running from (0, 100) to (100, 86). */
  .name {
    position: absolute;
    top: 100cqh;
    left: 4cqw;
    transform-origin: 0 0;
    rotate: atan2(-14cqh, 100cqw);
    translate: 0 0.15em;
    color: #f4ead6;
    font-family: var(--font-display);
    font-size: 15cqw;
    font-weight: 400;
    line-height: 1;
    white-space: nowrap;
    text-shadow:
      0 0 0.35rem rgb(0 0 0 / 0.95),
      0 1px 2px rgb(0 0 0 / 0.9);
  }
</style>
