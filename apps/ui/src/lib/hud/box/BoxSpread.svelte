<!--
	What came out of the box, laid out beside its index. With a package or door picked, everything it held lies here
	as the pieces themselves, each with what it means, then what Package 6 holds now, and along the foot the printed
	originals as thumbnails, each shown large while the pointer rests on it. With none picked, everything every open
	seal held is named here, a band per kind, and the piece under the pointer is laid out in a slip with what it
	means and where it came from. Nothing here scrolls: a spread too large for the dialog is zoomed down to fit it.
-->
<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import type { Campaign } from "@repo/game";
  import GlyphMark from "#lib/board/Glyph.svelte";
  import type { Glyph } from "#lib/board/hints.ts";
  import { fitZoom } from "#lib/cards/fit.ts";
  import { EVENT_PRINT } from "#lib/cards/playerPrint.ts";
  import { doorReports, packageReports } from "#lib/cards/print.generated.ts";
  import { jobFigure } from "#lib/characters/figures.ts";
  import { scanUrl, sealScans } from "#lib/scans.svelte.ts";
  import BriefPiece from "../BriefPiece.svelte";
  import Crate from "../Crate.svelte";
  import DossierDoor from "../DossierDoor.svelte";
  import { FACE_COLOR } from "../PlayerCard.svelte";
  import { HOLLOW_COLOR } from "../rich.ts";
  import RichText from "../RichText.svelte";
  import { storedInfectionLine, storedPlayerLine } from "../storedCards.ts";
  import { BOX_KINDS, byHeading, kindColor } from "./contents.ts";
  import type { BoxContents, BoxItem, BoxKind, BoxSlot } from "./contents.ts";

  type Props = {
    box: BoxContents;
    campaign: Campaign;
    /** The package or door laid out, or none for everything at once. */
    subject: BoxSlot | null;
    /** With no subject, the one kind of thing shown. */
    kind: BoxKind | null;
    /** Picks a package or door, by its key. */
    onpick: (key: string) => void;
    /** The seal a piece under the pointer came out of, for the index to mark. */
    onpoint: (key: string | null) => void;
  };

  let { box, campaign, subject, kind, onpick, onpoint }: Props = $props();

  /** Package 6 is where the campaign keeps the cards it takes out of play. */
  const STORAGE = "package:6";
  const stored = $derived(campaign.stored.player.length + campaign.stored.infection.length);

  const shown = $derived(kind ? box.items.filter((item) => item.kind === kind) : box.items);
  const groups = $derived(byHeading(shown));
  const bands = $derived(
    BOX_KINDS.map((entry) => ({
      ...entry,
      groups: groups.filter((group) => group.kind === entry.id),
    })).filter((band) => band.groups.length),
  );
  const scans = $derived(subject?.open ? sealScans(subject.seal) : []);
  const report = $derived(
    subject?.open
      ? (subject.seal.t === "package"
          ? packageReports[subject.seal.id]
          : doorReports[subject.seal.id]) ?? null
      : null,
  );
  const reportParagraphs = $derived(
    report
      ? report.text
          .split(/\n{2,}/)
          .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
          .filter(Boolean)
      : [],
  );
  /** The printed original the pointer or focus rests on, shown large over the spread. */
  let original = $state.raw<{ src: string; title: string } | null>(null);

  /** The piece under the pointer or focus in the overview, laid out in the slip on the half of the spread it is not in. */
  let spread = $state<HTMLElement>();
  let read = $state.raw<BoxItem | null>(null);
  let high = $state(false);
  const point = (item: BoxItem | null, at?: Element) => {
    read = item;
    if (at && spread) {
      const [piece, room] = [at.getBoundingClientRect(), spread.getBoundingClientRect()];
      high = piece.top + piece.height / 2 > room.top + room.height / 2;
    }
    onpoint(item?.from ?? null);
  };
  const sourceOf = (item: BoxItem) => {
    const from = box.slot(item.from)!;
    return from.name ? `${from.label}, ${from.name}` : from.label;
  };

  /** What a piece's name wears in the overview: the piece itself where it is small enough, or the glyph of its kind of card. */
  const STICKER_COLOR = "#c9b27a";
  function markOf(item: BoxItem): "piece" | { glyph: Glyph; color?: string } | null {
    const unlock = item.unlock;
    switch (unlock.t) {
      case "action":
        return "piece";
      case "job":
        return jobFigure(unlock.job) ? "piece" : null;
      case "event":
        return { glyph: "card", color: FACE_COLOR[EVENT_PRINT[unlock.event].mode] };
      case "gather":
      case "assemble":
        return { glyph: "infection", color: HOLLOW_COLOR };
      case "cityImprovement":
        return { glyph: "card", color: STICKER_COLOR };
      case "infectionImprovement":
        return { glyph: "infection", color: STICKER_COLOR };
      case "stockpileBonus":
        return { glyph: "supplies" };
      default:
        return null;
    }
  }

  const title = (item: BoxItem) => item.name ?? item.heading;
</script>

{#snippet link(key: string)}
  {@const to = box.slot(key)}
  {#if to}
    <button class="link" onclick={() => onpick(key)} aria-label={`Show ${to.label}`}>
      <span class="mini {to.seal.t}">
        {#if to.seal.t === "package"}
          <Crate id={to.seal.id} open={to.open} />
        {:else}
          <DossierDoor id={to.seal.id} open={to.open} />
        {/if}
      </span>
      {to.label}
    </button>
  {/if}
{/snippet}

{#snippet chip(item: BoxItem)}
  {@const mark = markOf(item)}
  <button
    class="piece"
    aria-label={`${item.heading}: ${title(item)}, from ${sourceOf(item)}. ${item.text}`}
    onpointerenter={(event) => point(item, event.currentTarget)}
    onpointerleave={() => point(null)}
    onfocus={(event) => point(item, event.currentTarget)}
    onblur={() => point(null)}
    onclick={() => onpick(item.from)}
  >
    {#if mark === "piece"}
      <BriefPiece unlock={item.unlock} {campaign} size="1.15rem" />
    {:else if mark}
      <GlyphMark glyph={mark.glyph} color={mark.color} />
    {/if}
    {title(item)}
  </button>
{/snippet}

<section
  bind:this={spread}
  class="spread"
  aria-label={subject ? `${subject.label}: what it held` : "Everything the box has given"}
  {@attach feedback("Box spread", () => ({
    subject: subject?.key ?? null,
    kind,
    shown: shown.length,
  }))}
>
  <!-- Everything at once stays as it is under a package or door laid out over it, so crossing the index lays each
		one out without building the whole box again. -->
  <div class="layer" class:under={subject !== null} inert={subject !== null}>
    {#if kind && shown.length}
      <div class="fit" {@attach fitZoom({ min: 0.45 })}>
        <div class="list" style:--kind={kindColor(kind)}>
          {#each groups as group (group.heading)}
            <h4>{group.heading} <span>{group.items.length}</span></h4>
            {#each group.items as item (item.key)}
              {@const mark = markOf(item)}
              <button
                class="entry"
                aria-label={`${item.heading}: ${title(item)}, from ${sourceOf(item)}. ${item.text}`}
                onpointerenter={() => onpoint(item.from)}
                onpointerleave={() => onpoint(null)}
                onfocus={() => onpoint(item.from)}
                onblur={() => onpoint(null)}
                onclick={() => onpick(item.from)}
                {@attach feedback("Box piece", () => item)}
              >
                {#if mark === "piece"}
                  <BriefPiece unlock={item.unlock} {campaign} size="1.15rem" />
                {:else if mark}
                  <GlyphMark glyph={mark.glyph} color={mark.color} />
                {/if}
                <b>{title(item)}</b>
                {item.words}
                <i>{box.slot(item.from)!.label}</i>
              </button>
            {/each}
          {/each}
        </div>
      </div>
    {:else if shown.length}
      <div class="fit" {@attach fitZoom({ min: 0.45 })}>
        <div class="bands">
          {#each bands as band (band.id)}
            <section
              class="band"
              style:--kind={band.color}
              aria-label={band.label}
              {@attach feedback(`Box: ${band.label}`, () => ({
                groups: band.groups.map((group) => group.heading),
              }))}
            >
              <h4>{band.label}</h4>
              {#each band.groups as group (group.heading)}
                {#each group.items as item, index (item.key)}
                  <!-- A heading never ends a line with its pieces on the next. -->
                  {#if index === 0}
                    <span class="lead"
                      ><span class="label">{group.heading}</span>{@render chip(item)}</span
                    >
                  {:else}
                    {@render chip(item)}
                  {/if}
                {/each}
              {/each}
            </section>
          {/each}
        </div>
      </div>
      <div
        class="slip"
        class:shown={read !== null}
        class:high
        style:--kind={read ? kindColor(read.kind) : null}
        aria-live="polite"
        {@attach feedback("Box reading", () => read)}
      >
        {#if read}
          <span class="visual"><BriefPiece unlock={read.unlock} {campaign} size="2.6rem" /></span>
          <div class="words">
            <span class="kicker"><i></i>{read.heading}</span>
            <b class="name">{title(read)}</b>
            <p>{read.words}</p>
            <em>From {sourceOf(read)}. Click to lay it out.</em>
          </div>
        {/if}
      </div>
    {:else}
      <p class="quiet">
        {kind ? "Nothing of this kind has come out yet." : "Nothing has been opened yet."}
      </p>
    {/if}
  </div>
  {#if subject}
    <div class="layer">
      <header>
        <span class="glyph {subject.seal.t}">
          {#if subject.seal.t === "package"}
            <Crate id={subject.seal.id} open={subject.open} />
          {:else}
            <DossierDoor id={subject.seal.id} open={subject.open} />
          {/if}
        </span>
        <div class="title">
          <span class="kicker"
            >{subject.label}{subject.sheet ? ` · dossier sheet ${subject.sheet}` : ""}</span
          >
          <h3>{subject.open ? subject.name : "Still sealed"}</h3>
        </div>
        <div class="links">
          {#if subject.forced}<span class="forced">Forced open by a perimeter report</span>{/if}
          {#if subject.open && subject.openedBy}<span class="chain"
              >Came out of {@render link(subject.openedBy)}</span
            >{/if}
          {#if subject.opens.length}
            <span class="chain"
              >It opened {#each subject.opens as key (key)}{@render link(key)}{/each}</span
            >
          {/if}
        </div>
      </header>

      {#if !subject.open}
        <p class="quiet">Nothing about it is known until the campaign opens it.</p>
      {:else}
        <div class="fit" {@attach fitZoom({ min: 0.45 })}>
          <div class="detail">
            {#if report}
              <article
                class="report"
                {@attach feedback("Printed report", () => ({
                  seal: subject.key,
                  title: report.title,
                }))}
              >
                <span class="kicker">{report.title}</span>
                {#each reportParagraphs as paragraph, idx (idx)}
                  <p>{paragraph}</p>
                {/each}
              </article>
            {/if}
            {#if subject.items.length}
              <ul class="rows">
                {#each subject.items as item (item.key)}
                  <li
                    class="row"
                    style:--kind={kindColor(item.kind)}
                    {@attach feedback("Box piece", () => item)}
                  >
                    <span class="visual"
                      ><BriefPiece unlock={item.unlock} {campaign} size="2.5rem" /></span
                    >
                    <div class="words">
                      <span class="kicker"><i></i>{item.heading}</span>
                      {#if item.name}<b class="name">{item.name}</b>{/if}
                      <p>{item.words}</p>
                    </div>
                  </li>
                {/each}
              </ul>
            {:else if !report && subject.key !== STORAGE}
              <p class="quiet">
                A reference for the board or the player aid, with no rule of its own.
              </p>
            {/if}

            {#if subject.key === STORAGE}
              <section
                class="extra"
                {@attach feedback("Package 6 contents", () => campaign.stored)}
              >
                <h4>Inside now <span>{stored} {stored === 1 ? "card" : "cards"}</span></h4>
                {#if stored}
                  <p class="stored">
                    <b>{campaign.stored.player.length} Player cards</b>
                    {#if campaign.stored.player.length}<RichText
                        text={storedPlayerLine(campaign)}
                      />{/if}
                  </p>
                  <p class="stored">
                    <b>{campaign.stored.infection.length} Infection cards</b>
                    {#if campaign.stored.infection.length}<RichText
                        text={storedInfectionLine(campaign)}
                      />{/if}
                  </p>
                {:else}
                  <p class="quiet">
                    Empty. Inoculate and Inoculation Unit put cards in here, out of play.
                  </p>
                {/if}
              </section>
            {/if}
          </div>
        </div>
        {#if scans.length}
          <section
            class="originals"
            class:alone={!subject.items.length && !report && subject.key !== STORAGE}
            {@attach feedback("Printed originals", () => ({ scans: scans.length }))}
          >
            <h4>The printed originals <span>rest on one to read it</span></h4>
            <div class="scans">
              {#each scans as item (item.src)}
                <button
                  class="scan"
                  aria-label={`The printed original: ${item.title}`}
                  onpointerenter={() => (original = item)}
                  onpointerleave={() => (original = null)}
                  onfocus={() => (original = item)}
                  onblur={() => (original = null)}
                >
                  <img src={scanUrl(item.src)} alt="" />
                </button>
              {/each}
            </div>
          </section>
          {#if original}
            <img class="original" src={scanUrl(original.src)} alt={original.title} />
          {/if}
        {/if}
      {/if}
    </div>
  {/if}
</section>

<style>
  .spread {
    position: relative;
    display: grid;
    min-width: 0;
    min-height: 0;
    padding: 0.9rem 1.1rem 0.8rem;
    border: 1px solid var(--slip-line);
    border-radius: 4px;
    background: rgb(255 250 236 / 0.34);
    box-shadow: inset 0 0 2.5rem rgb(120 86 48 / 0.12);
  }

  .layer {
    display: flex;
    grid-area: 1 / 1;
    flex-direction: column;
    gap: 0.7rem;
    min-width: 0;
    min-height: 0;
  }

  .under {
    visibility: hidden;
  }

  header {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    padding-bottom: 0.65rem;
    border-bottom: 1px solid var(--slip-line);
  }

  .glyph {
    flex: none;
    width: 3.6rem;
  }

  .glyph.package :global(.crate) {
    margin-top: 12%;
  }

  .glyph.door {
    width: 2.8rem;
    font-size: 1.4rem;
  }

  .title {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-width: 0;
  }

  .kicker {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--paper-muted);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  h3 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.7rem;
    font-weight: 400;
    line-height: 1.1;
  }

  .links {
    display: flex;
    flex-direction: column;
    flex: 0 1 auto;
    align-items: flex-end;
    gap: 0.3rem;
    max-width: 45%;
    margin-left: auto;
    font-size: 0.82rem;
  }

  .chain {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.35rem;
    color: var(--paper-muted);
  }

  .forced {
    color: var(--ink-danger);
    font-style: italic;
  }

  button {
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.15rem 0.5rem 0.15rem 0.2rem;
    border: 1px solid rgb(60 44 28 / 0.3);
    border-radius: 999px;
    background: rgb(255 250 236 / 0.6);
    color: var(--paper-ink);
    font-weight: 600;
  }

  .link:hover,
  .link:focus-visible {
    border-color: var(--paper-ink);
    background: var(--slip);
  }

  .mini {
    flex: none;
    width: 1.25rem;
    font-size: 0.62rem;
  }

  .mini.package {
    width: 1.5rem;
  }

  .mini.package :global(.crate) {
    margin-top: 0;
  }

  /* The spread takes whatever height the dialog has left, and its one child is zoomed to fit it. */
  .fit {
    flex: 1;
    min-height: 0;
    min-width: 0;
  }

  .detail {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  .report {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    padding: 0.7rem 0.95rem;
    border: 1px solid var(--slip-line);
    border-left: 0.3rem solid #7c5c34;
    border-radius: 3px;
    background: rgb(252 246 230 / 0.85);
    box-shadow: 0 1px 2px rgb(40 26 12 / 0.14);
  }

  .report p {
    font-size: 0.9rem;
    line-height: 1.44;
    color: var(--paper-ink);
  }

  .rows {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
    gap: 0.6rem 0.8rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.55rem 0.8rem 0.6rem 0.6rem;
    border: 1px solid var(--slip-line);
    border-left: 0.3rem solid var(--kind);
    border-radius: 3px;
    background: var(--slip);
    box-shadow: 0 1px 2px rgb(40 26 12 / 0.18);
  }

  .visual {
    display: flex;
    flex: none;
    justify-content: center;
    min-width: 5rem;
  }

  /* A piece with no look of its own leaves its words the whole row. */
  .visual:empty {
    display: none;
  }

  .words {
    display: flex;
    flex-direction: column;
    gap: 0.12rem;
    min-width: 0;
  }

  .kicker i {
    flex: none;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--kind);
  }

  .name {
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 400;
    line-height: 1.1;
  }

  p {
    margin: 0;
  }

  .words p {
    font-size: 0.88rem;
    line-height: 1.34;
  }

  .quiet {
    color: var(--paper-muted);
    font-style: italic;
  }

  h4 {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0 0 0.4rem;
    font-size: 0.74rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  h4 span {
    color: var(--paper-muted);
    font-weight: 600;
  }

  .stored {
    font-size: 0.95rem;
    line-height: 1.55;
  }

  .stored + .stored {
    margin-top: 0.5rem;
  }

  .stored b {
    margin-right: 0.5rem;
  }

  /* The printed originals keep one row along the foot however many there are: each gives way to the others. */
  .originals {
    flex: none;
    padding-top: 0.55rem;
    border-top: 1px solid var(--slip-line);
  }

  .scans {
    display: flex;
    gap: 0.4rem;
    height: 5.2rem;
  }

  /* Each takes an even share of the row and shows as much of its left edge as fits there, whole when there is room. */
  /* A door that brought no rule is its printed original, which then has the room. */
  .alone .scans {
    height: 13rem;
  }

  .alone .scan {
    flex: 0 1 auto;
    box-shadow: none;
  }

  .alone .scan img {
    max-width: 100%;
    object-fit: contain;
    object-position: left center;
  }

  .scan {
    flex: 1 1 0;
    min-width: 0;
    max-width: max-content;
    height: 100%;
    padding: 0;
    border-radius: 3px;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.35);
    overflow: hidden;
  }

  .scan img {
    display: block;
    width: auto;
    max-width: none;
    height: 100%;
  }

  .scan:hover,
  .scan:focus-visible {
    outline: 2px solid #c8911a;
    outline-offset: 1px;
  }

  /* The one rested on, as large as the spread lets it be, over the pieces and clear of the row it came from. */
  .original {
    position: absolute;
    top: 1rem;
    left: 50%;
    z-index: 3;
    max-width: calc(100% - 2rem);
    max-height: calc(100% - 9rem);
    border-radius: 4px;
    box-shadow: 0 0.8rem 2.6rem rgb(0 0 0 / 0.6);
    translate: -50% 0;
    pointer-events: none;
  }

  /* Everything of one kind, each with its words, as two columns of a page. */
  .list {
    padding: 0.2rem 0.3rem;
    columns: 2;
    column-gap: 2rem;
    column-rule: 1px solid var(--slip-line);
  }

  .list h4 {
    margin: 0 0 0.35rem;
    color: color-mix(in srgb, var(--kind) 72%, var(--paper-ink));
    break-after: avoid;
  }

  .list .entry + h4 {
    margin-top: 0.9rem;
  }

  .entry {
    display: block;
    width: 100%;
    margin-bottom: 0.14rem;
    padding: 0.14rem 0.5rem 0.18rem;
    border-left: 0.2rem solid color-mix(in srgb, var(--kind) 45%, transparent);
    border-radius: 0 3px 3px 0;
    font-size: 0.86rem;
    line-height: 1.28;
    text-align: left;
    break-inside: avoid;
  }

  .entry:hover,
  .entry:focus-visible {
    border-left-color: var(--kind);
    background: color-mix(in srgb, var(--kind) 14%, #f6efdd);
  }

  .entry b {
    margin-right: 0.3rem;
    font-family: var(--font-display);
    font-size: 1.08rem;
    font-weight: 400;
  }

  .entry :global(.icon),
  .entry :global(.job-medallion),
  .entry :global(.glyph) {
    display: inline-block;
    margin-right: 0.25rem;
    vertical-align: -0.2em;
  }

  /* The package or door it came out of, which a click lays out. */
  .entry i {
    margin-left: 0.3rem;
    padding: 0 0.4rem;
    border: 1px solid rgb(60 44 28 / 0.3);
    border-radius: 999px;
    color: var(--paper-muted);
    font-size: 0.72rem;
    font-style: normal;
    white-space: nowrap;
  }

  .bands {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  /* One band per kind in its colour, as the chips over the box name it: its name, then every heading with its pieces, flowing on like lines of a ledger. */
  .band {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem 0.36rem;
    padding: 0.42rem 0.7rem 0.46rem 0.75rem;
    border: 1px solid var(--slip-line);
    border-left: 0.3rem solid var(--kind);
    border-radius: 3px;
    background: var(--slip);
    box-shadow: 0 1px 2px rgb(40 26 12 / 0.18);
  }

  .band h4 {
    margin: 0 0.3rem 0 0;
    color: color-mix(in srgb, var(--kind) 72%, var(--paper-ink));
    font-family: var(--font-display);
    font-size: 1.2rem;
    font-weight: 400;
    line-height: 1;
    letter-spacing: 0;
    text-transform: none;
  }

  .lead {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    white-space: nowrap;
  }

  .label {
    margin-left: 0.5rem;
    color: var(--paper-muted);
    font-size: 0.64rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .band h4 + .lead .label {
    margin-left: 0;
  }

  /* A piece by name, in its kind's colour. */
  .piece {
    display: inline-flex;
    align-items: center;
    gap: 0.32rem;
    padding: 0.16rem 0.5rem;
    border: 1px solid color-mix(in srgb, var(--kind) 55%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--kind) 9%, #f6efdd);
    font-size: 0.78rem;
    font-weight: 600;
    line-height: 1.15;
    white-space: nowrap;
    transition:
      transform 140ms ease,
      background 140ms ease;
  }

  .piece:hover,
  .piece:focus-visible {
    border-color: var(--kind);
    background: color-mix(in srgb, var(--kind) 26%, #f6efdd);
    transform: translateY(-1px);
  }

  /* The piece under the pointer, laid out over the half of the spread it is not in. */
  .slip {
    position: absolute;
    right: 1.1rem;
    bottom: 0.9rem;
    left: 1.1rem;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.8rem 1.1rem;
    border: 1px solid rgb(60 44 28 / 0.4);
    border-left: 0.35rem solid var(--kind);
    border-radius: 4px;
    background: #f7f0de;
    box-shadow: 0 0.6rem 2rem rgb(20 12 4 / 0.45);
    pointer-events: none;
  }

  .slip.high {
    top: 0.9rem;
    bottom: auto;
  }

  .slip:not(.shown) {
    display: none;
  }

  .slip .name {
    font-size: 1.4rem;
  }

  .slip p {
    font-size: 0.95rem;
  }

  .slip em {
    margin-top: 0.2rem;
    color: var(--paper-muted);
    font-size: 0.8rem;
  }
</style>
