<!--
	The box: what the campaign has opened so far. Its first tab is an index of the 8 packages and the 69 dossier doors
	on the left, and beside it whatever came out of them, laid out as the pieces themselves (`box/BoxSpread.svelte`).
	A package or door under the pointer is laid out for as long as it rests there, and a click keeps it. The chips
	above the index show one kind of thing at a time, across the whole box. It never shows what a sealed one holds.
-->
<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import { dossierView, stickerStock } from "@repo/game";
  import type { Campaign } from "@repo/game";
  import { fitZoom } from "#lib/cards/fit.ts";
  import BoxSpread from "./box/BoxSpread.svelte";
  import { BOX_KINDS, boxContents, kindColor } from "./box/contents.ts";
  import type { BoxKind, BoxSlot } from "./box/contents.ts";
  import CloseButton from "./CloseButton.svelte";
  import Crate from "./Crate.svelte";
  import DossierDoor from "./DossierDoor.svelte";
  import Logbook from "./Logbook.svelte";
  import Rulebook from "./Rulebook.svelte";
  import { keep } from "./viewState.ts";

  type Props = { campaign: Campaign; onclose: () => void };

  let { campaign, onclose }: Props = $props();

  const box = $derived(boxContents(dossierView(campaign)));
  const stock = $derived(stickerStock(campaign));
  const TABS = [
    { id: "box", label: "Packages and dossier" },
    { id: "rulebook", label: "Rulebook" },
    { id: "stickers", label: "Stickers" },
    { id: "logbook", label: "Logbook" },
  ] as const;
  let tab = $state<(typeof TABS)[number]["id"]>("box");
  const STRUCTURE = {
    center: "Permanent supply center",
    tower: "Permanent tower",
    shelter: "Permanent shelter",
  };
  const doors = $derived(box.sheets.flat());
  const openDoors = $derived(doors.filter((door) => door.open).length);
  const openPackages = $derived(box.packages.filter((slot) => slot.open).length);

  /** The seal the pointer rests on, or else the one last clicked, laid out in the spread. Both are keys. */
  let pointed = $state<string | null>(null);
  let chosen = $state<string | null>(null);
  /** The one kind of thing the box is showing, across every seal. */
  let kind = $state<BoxKind | null>(null);
  /** The seal a piece under the pointer came out of, marked in the index. */
  let source = $state<string | null>(null);
  const subject = $derived(box.slot(pointed ?? chosen ?? "") ?? null);
  const counts = $derived(
    Object.fromEntries(
      BOX_KINDS.map((entry) => [
        entry.id,
        box.items.filter((item) => item.kind === entry.id).length,
      ]),
    ) as Record<BoxKind, number>,
  );
  keep(
    "box",
    () => ({ tab, chosen, kind }),
    (saved) => {
      tab = saved.tab;
      chosen = saved.chosen;
      kind = saved.kind;
    },
  );

  /** Package 6 is where the campaign keeps the cards it takes out of play. */
  const stored = $derived(campaign.stored.player.length + campaign.stored.infection.length);
  const describe = (slot: BoxSlot) =>
    `${slot.label}: ${slot.open ? (slot.name ?? "opened") : "sealed"}`;
  /** The seal laid out when a press began. Focus lays a seal out before its click arrives, so the click cannot tell. */
  let held: string | null = null;
  const look = (slot: BoxSlot) => ({
    onpointerenter: () => (pointed = slot.key),
    onpointerdown: () => (held = chosen),
    onfocus: () => (chosen = slot.key),
    // A click on the one laid out puts it away.
    onclick: () => {
      chosen = held === slot.key ? null : slot.key;
      held = null;
    },
  });
  /** A dot per kind a seal held, painted as one strip: a node per dot would be a fifth of the dialog's nodes. */
  const dots = (kinds: BoxKind[]) =>
    kinds
      .map(
        (held, index) =>
          `radial-gradient(circle at calc(var(--dot) * ${index + 0.5}) 50%, color-mix(in srgb, ${kindColor(held)} var(--tone), #fff6dc) 0 calc(var(--dot) * 0.34), var(--rim) calc(var(--dot) * 0.36) calc(var(--dot) * 0.44), transparent calc(var(--dot) * 0.46))`,
      )
      .join(", ");
  /** One kind at a time: its chip again, or Everything, shows the whole box. */
  function show(next: BoxKind | null) {
    kind = kind === next ? null : next;
    chosen = null;
  }
</script>

{#snippet pips(slot: BoxSlot)}
  {#if slot.kinds.length}
    <span
      class="pips"
      style:--dots={slot.kinds.length}
      style:background-image={dots(slot.kinds)}
      aria-hidden="true"
    ></span>
  {/if}
{/snippet}

{#snippet seal(slot: BoxSlot)}
  <button
    class="seal {slot.seal.t}"
    class:open={slot.open}
    class:chosen={chosen === slot.key}
    class:source={source === slot.key}
    class:dim={kind !== null && !slot.kinds.includes(kind)}
    aria-label={describe(slot)}
    aria-pressed={chosen === slot.key}
    data-seal={slot.key}
    data-open={slot.open}
    {...look(slot)}
  >
    {#if slot.seal.t === "package"}
      <span class="crate"><Crate id={slot.seal.id} open={slot.open} /></span>
      <span class="about">
        <span class="caption">{slot.open ? slot.name : "Sealed"}</span>
        {#if slot.key === "package:6" && slot.open}<span class="holds">{stored} inside</span>{/if}
        {@render pips(slot)}
      </span>
    {:else}
      <DossierDoor id={slot.seal.id} open={slot.open} />
      {@render pips(slot)}
    {/if}
  </button>
{/snippet}

<section
  class="box"
  aria-label="The box"
  {@attach feedback("The box", () => ({ openPackages, openDoors, doors: doors.length }))}
>
  <header>
    <h2>The box</h2>
    <div class="tabs" role="tablist" aria-label="What to look at">
      {#each TABS as entry (entry.id)}
        <button role="tab" aria-selected={tab === entry.id} onclick={() => (tab = entry.id)}
          >{entry.label}</button
        >
      {/each}
    </div>
    <p class="tally">
      {openPackages} of {box.packages.length} packages, {openDoors} of {doors.length} doors opened
    </p>
    <CloseButton label="Close the box" onclick={onclose} />
  </header>

  {#if tab === "box"}
    <div class="shelves">
      <div
        class="kinds"
        role="group"
        aria-label="Show one kind of thing"
        {@attach feedback("Box kinds", () => ({ kind, counts }))}
      >
        <button
          class="kind"
          aria-pressed={kind === null && chosen === null}
          onclick={() => show(null)}
        >
          Everything <b>{box.items.length}</b>
        </button>
        {#each BOX_KINDS as entry (entry.id)}
          <button
            class="kind"
            style:--kind={entry.color}
            aria-pressed={kind === entry.id}
            disabled={counts[entry.id] === 0}
            onclick={() => show(entry.id)}
            data-kind={entry.id}
          >
            <i></i>{entry.label} <b>{counts[entry.id]}</b>
          </button>
        {/each}
        <p class="how">Rest on anything to see it, click to keep it laid out.</p>
      </div>
      <!-- The last package or door crossed stays laid out until the pointer leaves them all, so the spread does not
				flicker in the gaps between doors. -->
      <div
        class="index"
        role="group"
        aria-label="Packages and dossier doors"
        onpointerleave={() => (pointed = null)}
        {@attach fitZoom({ min: 0.6 })}
      >
        <div class="inner">
          <h3>Packages <span>{openPackages} of {box.packages.length} opened</span></h3>
          <ol class="packages" {@attach feedback("Packages", () => ({ open: openPackages }))}>
            {#each box.packages as slot (slot.key)}
              <li>{@render seal(slot)}</li>
            {/each}
          </ol>

          <h3>Dossier <span>{openDoors} of {doors.length} doors torn open</span></h3>
          <ol class="sheets">
            {#each box.sheets as sheet, index (index)}
              {@const open = sheet.filter((door) => door.open).length}
              <li
                class="sheet"
                class:done={open === sheet.length}
                {@attach feedback(`Dossier sheet ${index + 1}`, () => ({ open }))}
              >
                <span class="tab">Sheet {index + 1} <b>{open}/{sheet.length}</b></span>
                <ol class="doors" aria-label={`Sheet ${index + 1}`}>
                  {#each sheet as door (door.key)}
                    <li>{@render seal(door)}</li>
                  {/each}
                </ol>
              </li>
            {/each}
          </ol>
        </div>
      </div>

      <BoxSpread
        {box}
        {campaign}
        {subject}
        {kind}
        onpick={(key) => (chosen = key)}
        onpoint={(key) => (source = key)}
      />
    </div>
  {:else if tab === "rulebook"}
    <div class="page"><Rulebook {campaign} /></div>
  {:else if tab === "logbook"}
    <div class="page"><Logbook {campaign} /></div>
  {:else}
    <div class="pages" {@attach feedback("Stickers", () => stock)}>
      {#snippet list(
        title: string,
        items: { id: string; name: string; text: string; left: number }[],
      )}
        <h3>{title}</h3>
        {#each items as item (item.id)}
          <p>
            <b>{item.name}</b>{#if item.left > 1}<span class="left">×{item.left}</span>{/if}
            {item.text}
          </p>
        {:else}
          <p class="hint">None left.</p>
        {/each}
      {/snippet}
      <section>
        {@render list("Abilities", stock.abilities)}
        {@render list("City card improvements", stock.cityImprovements)}
        {@render list("Infection card improvements", stock.infectionImprovements)}
      </section>
      <section>
        {@render list("Scars", stock.scars)}
        <h3>Permanent structures</h3>
        {#each stock.permanent as [structure, left] (structure)}
          <p><b>{STRUCTURE[structure]}</b><span class="left">×{left}</span></p>
        {:else}
          <p class="hint">None left.</p>
        {/each}
        {#if stock.jobsWaiting.length}
          <h3>Characters waiting for a free card</h3>
          <p>{stock.jobsWaiting.join(", ")}</p>
        {/if}
      </section>
    </div>
  {/if}
</section>

<style>
  .box {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    width: min(94rem, calc(100vw - 2rem));
    height: min(48rem, calc(100vh - 6rem));
    box-sizing: border-box;
    padding: 1rem 1.4rem 1.1rem;
    border-radius: 2px;
    background: var(--document);
    color: var(--paper-ink);
    box-shadow: var(--document-shadow);
  }

  header {
    display: flex;
    flex: none;
    align-items: center;
    gap: 1.2rem;
  }

  h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.9rem;
    font-weight: 400;
    line-height: 1;
  }

  h3 {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 400;
  }

  h3 span {
    color: var(--paper-muted);
    font-family: var(--font-ui);
    font-size: 0.76rem;
  }

  .tally {
    margin: 0 0 0 auto;
    color: var(--paper-muted);
    font-size: 0.85rem;
  }

  ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  button {
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .tabs {
    display: flex;
    gap: 0.4rem;
  }

  .tabs button {
    padding: 0.3rem 0.8rem;
    border: 1px solid rgb(60 44 28 / 0.35);
    border-radius: 2px;
  }

  .tabs button[aria-selected="true"] {
    background: var(--paper-ink);
    color: var(--paper);
  }

  /* The index keeps its width and the spread takes the rest. Neither scrolls. */
  .shelves {
    display: grid;
    flex: 1;
    grid-template-columns: 28rem minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    gap: 0.6rem 1.2rem;
    min-height: 0;
  }

  .index {
    min-width: 0;
    min-height: 0;
  }

  .inner {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  /* The kinds stand over the index and the spread alike, since choosing one changes both. */
  .kinds {
    display: flex;
    grid-column: 1 / -1;
    align-items: center;
    gap: 0.35rem;
  }

  .kind {
    display: inline-flex;
    align-items: center;
    gap: 0.32rem;
    padding: 0.2rem 0.65rem;
    border: 1px solid rgb(60 44 28 / 0.3);
    border-radius: 999px;
    font-size: 0.84rem;
  }

  .kind i {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: var(--kind);
  }

  .kind b {
    color: var(--paper-muted);
    font-weight: 600;
  }

  .kind:hover:not(:disabled) {
    border-color: var(--paper-ink);
  }

  .kind[aria-pressed="true"] {
    border-color: var(--paper-ink);
    background: var(--paper-ink);
    color: var(--paper);
  }

  .kind[aria-pressed="true"] b {
    color: inherit;
  }

  .kind:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .how {
    margin: 0 0 0 auto;
    color: var(--paper-muted);
    font-size: 0.84rem;
    font-style: italic;
  }

  /* 1 to 4 down the left, 5 to 8 down the right. */
  .packages {
    display: grid;
    grid-template-rows: repeat(4, auto);
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-flow: column;
    gap: 0.2rem 0.6rem;
  }

  .seal {
    position: relative;
    display: block;
    width: 100%;
    padding: 0;
    border-radius: 3px;
    transition:
      opacity 160ms ease,
      transform 140ms ease;
  }

  .seal.package {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    height: 100%;
    padding: 0.15rem 0.4rem 0.25rem 0.3rem;
    text-align: left;
  }

  .about {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.1rem 0.5rem;
    min-width: 0;
  }

  .seal:hover,
  .seal:focus-visible {
    transform: translateY(-1px);
  }

  /* What is still sealed stands back, so the opened ones are what the eye finds. */
  .seal:not(.open) {
    opacity: 0.55;
  }

  .seal.dim {
    opacity: 0.22;
  }

  /* The one laid out beside the index wears a still gold ring, and the one a piece came out of a dashed one. */
  .seal.chosen {
    outline: 2px solid #c8911a;
    outline-offset: 2px;
    background: rgb(255 201 58 / 0.22);
  }

  .seal.source {
    outline: 2px dashed #c8911a;
    outline-offset: 2px;
    opacity: 1;
  }

  .crate {
    flex: none;
    width: 2.1rem;
    font-size: 0.48rem;
  }

  .crate :global(.crate) {
    margin-top: 12%;
  }

  .caption {
    flex: 1 1 100%;
    font-size: 0.8rem;
    font-weight: 600;
    line-height: 1.08;
  }

  .holds {
    color: var(--paper-muted);
    font-size: 0.7rem;
  }

  /* What a seal held, a dot per kind: along the foot of a door's hole, under a package's name. */
  .pips {
    --dot: 0.5rem;
    --tone: 55%;
    --rim: rgb(20 12 4 / 0.55);
    position: absolute;
    bottom: 0.1rem;
    left: 50%;
    width: calc(var(--dot) * var(--dots));
    height: var(--dot);
    translate: -50% 0;
    pointer-events: none;
  }

  .package .pips {
    --dot: 0.62rem;
    --tone: 100%;
    --rim: transparent;
    position: static;
    flex: none;
    translate: none;
  }

  /* The number of an opened door makes room for its dots. */
  .seal.door.open :global(.hole) {
    padding-bottom: 0.42rem;
  }

  .sheets {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.3rem 0.6rem;
    margin-top: 0.95rem;
  }

  /* A manila dossier sheet with a filing tab. */
  .sheet {
    position: relative;
    padding: 0.5rem 0.45rem 0.55rem;
    border: 1px solid rgb(110 80 30 / 0.35);
    border-radius: 0 3px 3px 3px;
    background: linear-gradient(180deg, #e2c98f, #d6ba7c);
    box-shadow: 0 0.3rem 0.7rem rgb(40 24 8 / 0.25);
  }

  .tab {
    position: absolute;
    top: -1.2rem;
    left: -1px;
    display: flex;
    gap: 0.4rem;
    padding: 0.1rem 0.55rem;
    border: 1px solid rgb(110 80 30 / 0.35);
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    background: #e2c98f;
    color: rgb(60 40 10 / 0.8);
    font-size: 0.74rem;
  }

  .tab b {
    font-weight: 700;
  }

  .done .tab b {
    color: #2c6a4f;
  }

  .doors {
    display: grid;
    /* A door keeps its size when the index is zoomed down to fit a short screen, where a share of the sheet would grow. */
    grid-template-columns: repeat(7, minmax(0, 1.62rem));
    justify-content: space-between;
    gap: 0.32rem 0;
    font-size: 0.8rem;
  }

  /* The other tabs are documents of their own, which take the dialog's height and scroll inside it. */
  .page {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    overflow: auto;
  }

  .pages {
    display: grid;
    flex: 1;
    grid-template-columns: 1fr 1fr;
    gap: 0 2rem;
    min-height: 0;
    overflow: auto;
    font-size: 0.9rem;
    line-height: 1.35;
  }

  .pages h3 {
    margin: 1rem 0 0.5rem;
    color: var(--paper-muted);
  }

  .pages p {
    margin: 0 0 0.45rem;
  }

  .left {
    margin: 0 0.3rem;
    color: var(--paper-muted);
  }

  .hint {
    color: var(--paper-muted);
  }
</style>
