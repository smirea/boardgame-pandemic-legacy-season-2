<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import type { Campaign } from "@repo/game";
  import { fly, scale } from "svelte/transition";
  import LegacyCard from "#lib/cards/LegacyCard.svelte";
  import { jobFigure } from "#lib/characters/figures.ts";
  import BriefPiece from "./BriefPiece.svelte";
  import JobFigure from "./JobFigure.svelte";
  import MapPlace from "./MapPlace.svelte";
  import RichText from "./RichText.svelte";
  import Crate from "./Crate.svelte";
  import DossierDoor from "./DossierDoor.svelte";
  import type { Piece, PieceGroup } from "./unboxPieces.ts";

  type Props = {
    groups: PieceGroup[];
    campaign: Campaign;
    /** Which side of the table the groups stand on; the spotlight's are larger and stand square. */
    side: "left" | "right" | "spotlight";
    /** The piece under the pointer or focus, whose meaning the Unboxing shows beside it. */
    ontip: (piece: Piece | null, at?: HTMLElement) => void;
  };

  let { groups, campaign, side, ontip }: Props = $props();

  const big = $derived(side === "spotlight");
  /** A character the box brings stands as its whole figure, which carries its own name. */
  const figureOf = (piece: Piece) =>
    piece.t === "unlock" && piece.unlock.t === "job" ? jobFigure(piece.unlock.job) : null;
  /** A new place stands as the board shows it, and a new rule is read where it lies: neither needs a word under it. */
  const placeOf = (piece: Piece) =>
    piece.t === "unlock" && piece.unlock.t === "haven" ? piece.unlock.city : null;
  const isRule = (piece: Piece) => piece.t === "unlock" && piece.unlock.t === "rule";
  const speaks = (piece: Piece) =>
    figureOf(piece) !== null || placeOf(piece) !== null || isRule(piece);
  const label = (piece: Piece) =>
    piece.t === "card"
      ? piece.card.title
      : piece.t === "seal"
        ? piece.tip
        : (piece.name ?? piece.tip);
</script>

<div class="groups {side}">
  {#each groups as group, index (group.heading)}
    <section
      class="group"
      style:--tilt={big ? "0deg" : `${((index + (side === "right" ? 1 : 0)) % 3) - 1}deg`}
      in:fly={{
        x: side === "left" ? 50 : side === "right" ? -50 : 0,
        y: big ? 24 : -16,
        duration: 380,
      }}
      {@attach feedback("Unboxing group", () => ({
        heading: group.heading,
        pieces: group.pieces.length,
      }))}
    >
      <h3>{group.heading}</h3>
      <div class="pieces">
        {#each group.pieces as piece (piece.key)}
          <button
            type="button"
            class="piece {piece.t}"
            class:mechanic={piece.stow.cls === "mechanic"}
            class:figure={figureOf(piece) !== null}
            class:whole={placeOf(piece) !== null || isRule(piece)}
            data-stow-class={piece.stow.cls}
            data-put={piece.stow.put}
            aria-label={piece.tip}
            onpointerenter={(event) => ontip(isRule(piece) ? null : piece, event.currentTarget)}
            onpointerleave={() => ontip(null)}
            onfocus={(event) => ontip(isRule(piece) ? null : piece, event.currentTarget)}
            onblur={() => ontip(null)}
            in:scale={{ start: 0.6, duration: 320 }}
          >
            {#if piece.t === "card"}
              <LegacyCard card={piece.card} side="b" size="thumb" {campaign} />
            {:else if piece.t === "seal"}
              <span class="shell {piece.seal.t}">
                {#if piece.seal.t === "package"}
                  <Crate id={piece.seal.id} open={true} />
                {:else}
                  <DossierDoor id={piece.seal.id} open={true} />
                {/if}
              </span>
            {:else if placeOf(piece)}
              {@const city = placeOf(piece)!}
              <MapPlace
                {city}
                location={campaign.locations[city]}
                unit={big ? "0.62rem" : "0.48rem"}
              />
            {:else if piece.t === "unlock" && isRule(piece)}
              <span class="rule">
                <span class="kicker">Rule</span>
                <b>{label(piece)}</b>
                <span class="text"><RichText text={piece.tip} /></span>
              </span>
            {:else if figureOf(piece)}
              <JobFigure
                figure={figureOf(piece)!}
                name={label(piece)}
                width={big ? "7.5rem" : "5.5rem"}
              />
            {:else}
              <BriefPiece unlock={piece.unlock} {campaign} size={big ? "2.8rem" : "2.2rem"} />
            {/if}
            {#if piece.t !== "card" && !speaks(piece) && (piece.t === "seal" || piece.name)}
              <span class="name">{label(piece)}</span>
            {/if}
          </button>
        {/each}
      </div>
    </section>
  {/each}
</div>

<style>
  .groups {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.3rem;
  }

  .groups.left {
    align-items: flex-end;
  }

  .groups.right {
    align-items: flex-start;
  }

  /* Beside the card the groups flow across the width there is, so a reading that opens many kinds stays large. */
  .groups.spotlight {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-start;
    padding: 0;
  }

  .spotlight .group {
    flex: 1 1 auto;
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    max-width: 100%;
    padding: 0.45rem 0.65rem 0.6rem;
    border: 1px solid rgb(231 220 198 / 0.2);
    border-radius: 6px;
    background: rgb(18 15 11 / 0.86);
    box-shadow: 0 0.7rem 1.8rem rgb(0 0 0 / 0.45);
    transform: rotate(var(--tilt));
  }

  h3 {
    margin: 0;
    color: var(--muted);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .spotlight h3 {
    font-size: 0.78rem;
  }

  .pieces {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .left .pieces {
    justify-content: flex-end;
  }

  .piece {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem;
    border: 1px solid transparent;
    border-radius: 5px;
    background: none;
    color: var(--ink);
    font: inherit;
    cursor: help;
    transition:
      border-color 160ms ease,
      background 160ms ease;
  }

  /* A name wraps under its sticker; a card, landscape ones included, keeps its own width. */
  .piece:not(.card, .figure, .whole) {
    max-width: 7.4rem;
  }

  /* A rule is printed on a slip of the rulebook's paper, to be read where it lies. */
  .rule {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    width: 13rem;
    padding: 0.5rem 0.65rem 0.6rem;
    border-radius: 3px;
    background: linear-gradient(180deg, #efe3c4, #e2d3ad);
    box-shadow: 0 0.35rem 0.9rem rgb(0 0 0 / 0.5);
    color: #2a2017;
    font-size: 0.74rem;
    line-height: 1.32;
    text-align: left;
  }

  .spotlight .rule {
    width: 16rem;
    font-size: 0.8rem;
  }

  .rule .kicker {
    color: #7a6748;
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .rule b {
    font-family: var(--font-display);
    font-size: 1.15em;
    font-weight: 400;
    line-height: 1.15;
  }

  .piece:hover,
  .piece:focus-visible {
    border-color: rgb(231 220 198 / 0.45);
    background: rgb(231 220 198 / 0.08);
    outline: none;
  }

  .piece.mechanic {
    border-color: rgb(227 178 60 / 0.45);
    background: rgb(227 178 60 / 0.1);
  }

  .piece.card :global(.legacy-card) {
    box-shadow: 0 0.35rem 0.9rem rgb(0 0 0 / 0.5);
  }

  .shell.package {
    width: 4.2rem;
  }

  .shell.door {
    width: 2.6rem;
  }

  .name {
    font-size: 0.72rem;
    line-height: 1.2;
    text-align: center;
  }

  .spotlight .name {
    font-size: 0.8rem;
  }
</style>
