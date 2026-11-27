<script lang="ts" module>
  import type { Piece } from "./unboxPieces.ts";
  import { jobFigure } from "#lib/characters/figures.ts";

  /** A character the box brings stands as its whole figure, which carries its own name. */
  export const figureOf = (piece: Piece) =>
    piece.t === "unlock" && piece.unlock.t === "job" ? jobFigure(piece.unlock.job) : null;
  const placeOf = (piece: Piece) =>
    piece.t === "unlock" && piece.unlock.t === "haven" ? piece.unlock.city : null;
  export const isRule = (piece: Piece) => piece.t === "unlock" && piece.unlock.t === "rule";

  /**
   * How a piece is drawn on the table against its size in the middle: `side` on the sides, where a Legacy card lies as
   * a thumbnail and a sticker stays legible, `spot` in the middle, where a door a card opens stands smaller than the
   * card, and `weight`, how much of a side it takes.
   */
  export function scaleOf(piece: Piece, main: boolean) {
    if (piece.t === "card") return { side: 0.42, spot: 1, weight: 3 };
    if (piece.t === "seal") return { side: 0.45, spot: main ? 1 : 0.62, weight: 1 };
    if (piece.t === "note") return { side: 0.55, spot: 1, weight: 2 };
    if (isRule(piece)) return { side: 0.78, spot: 1, weight: 2 };
    if (figureOf(piece)) return { side: 0.72, spot: 1, weight: 2 };
    if (placeOf(piece)) return { side: 0.76, spot: 1, weight: 1 };
    return { side: 0.8, spot: 1, weight: 1 };
  }
</script>

<script lang="ts">
  import type { Campaign } from "@repo/game";
  import LegacyCard from "#lib/cards/LegacyCard.svelte";
  import BriefPiece from "./BriefPiece.svelte";
  import Crate from "./Crate.svelte";
  import DossierDoor from "./DossierDoor.svelte";
  import JobFigure, { madeWith } from "./JobFigure.svelte";
  import MapPlace from "./MapPlace.svelte";
  import RichText from "./RichText.svelte";

  type Props = {
    piece: Piece;
    campaign: Campaign;
    /** Turned face up: a Legacy card shows its back, a package or door stands open. */
    open: boolean;
    /** Still to be turned over, so a Legacy card keeps its face down side under it. */
    live: boolean;
  };

  let { piece, campaign, open, live }: Props = $props();

  const label = $derived(
    piece.t === "card"
      ? piece.card.title
      : piece.t === "seal" || piece.t === "note"
        ? piece.tip
        : (piece.name ?? piece.tip),
  );
  const named = $derived(
    piece.t === "seal" ||
      (piece.t === "unlock" &&
        piece.name !== null &&
        !figureOf(piece) &&
        !placeOf(piece) &&
        !isRule(piece)),
  );
</script>

<span class="content {piece.t}">
  {#if piece.t === "card"}
    <span class="flipper" class:open>
      {#if live}
        <span class="side front"
          ><LegacyCard card={piece.card} side="a" size="full" {campaign} /></span
        >
      {/if}
      <span class="side back"><LegacyCard card={piece.card} side="b" size="full" {campaign} /></span>
    </span>
  {:else if piece.t === "seal"}
    <span class="shell {piece.seal.t}">
      {#if piece.seal.t === "package"}
        <Crate id={piece.seal.id} {open} />
      {:else}
        <DossierDoor id={piece.seal.id} {open} tearing={open && live} />
      {/if}
    </span>
  {:else if piece.t === "note"}
    <span class="slip note-slip">
      <b>{piece.title}</b>
      {#if piece.text && open}<span class="text"><RichText text={piece.text} /></span>{/if}
    </span>
  {:else if placeOf(piece)}
    {@const city = placeOf(piece)!}
    <MapPlace {city} location={campaign.locations[city]} unit="0.62rem" />
  {:else if isRule(piece)}
    <span class="slip rule">
      <span class="kicker">Rule</span>
      <b>{label}</b>
      <span class="text"><RichText text={piece.tip} /></span>
    </span>
  {:else if figureOf(piece) && piece.t === "unlock" && piece.unlock.t === "job"}
    <JobFigure
      figure={figureOf(piece)!}
      occupation={label}
      name={madeWith(campaign, piece.unlock.job)}
      width="7.5rem"
    />
  {:else if piece.t === "unlock"}
    <BriefPiece unlock={piece.unlock} {campaign} size="2.8rem" />
  {/if}
  {#if named}<span class="name">{label}</span>{/if}
</span>

<style>
  .content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
  }

  .content.unlock:not(:has(.slip, :global(.figure), :global(.place))) {
    max-width: 9rem;
  }

  .flipper {
    display: grid;
    place-items: center;
    transform-style: preserve-3d;
    transition: transform 700ms cubic-bezier(0.2, 0.9, 0.3, 1.08);
  }

  .flipper.open {
    transform: rotateY(180deg);
  }

  .side {
    grid-area: 1 / 1;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }

  .side.back {
    transform: rotateY(180deg);
  }

  .side :global(.legacy-card) {
    box-shadow: 0 1.2rem 2.6rem rgb(0 0 0 / 0.6);
  }

  .shell {
    display: block;
    filter: drop-shadow(0 0.9rem 1.4rem rgb(0 0 0 / 0.55));
  }

  .shell.package {
    width: 10rem;
    font-size: 1.5rem;
  }

  .shell.door {
    width: 6.5rem;
    font-size: 1.6rem;
  }

  /* A rule or a note is printed on a slip of the rulebook's paper, to be read where it lies. */
  .slip {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 16rem;
    padding: 0.6rem 0.75rem 0.7rem;
    border-radius: 3px;
    background: linear-gradient(180deg, #efe3c4, #e2d3ad);
    box-shadow: 0 0.6rem 1.4rem rgb(0 0 0 / 0.5);
    color: #2a2017;
    font-size: 0.8rem;
    line-height: 1.32;
    text-align: left;
  }

  .note-slip {
    width: 18rem;
    padding: 1rem 1.2rem 1.1rem;
    font-size: 0.92rem;
    text-align: center;
  }

  .note-slip b {
    font-size: 1.6rem;
  }

  .kicker {
    color: #7a6748;
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .slip b {
    font-family: var(--font-display);
    font-size: 1.15em;
    font-weight: 400;
    line-height: 1.15;
  }

  .name {
    color: #f4ead6;
    font-size: 0.86rem;
    font-weight: 600;
    line-height: 1.2;
    text-align: center;
    text-shadow:
      0 0 0.4em rgb(0 0 0 / 0.95),
      0 1px 2px rgb(0 0 0 / 0.9);
  }
</style>
