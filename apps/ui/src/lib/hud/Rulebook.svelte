<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import { rulebook } from "@repo/game";
  import type { Campaign } from "@repo/game";
  import { highlight, searchRulebook, searchWords } from "./rulebookSearch.ts";
  import { keep } from "./viewState.ts";

  type Props = { campaign: Campaign };

  let { campaign }: Props = $props();

  let query = $state("");
  keep(
    "rulebook",
    () => ({ query }),
    (saved) => (query = saved.query),
  );

  const book = $derived(rulebook(campaign));
  const words = $derived(searchWords(query));
  const result = $derived(searchRulebook(book, query));
  let pages = $state<HTMLElement>();

  function jump(id: string) {
    pages
      ?.querySelector(`[data-chapter="${id}"]`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== "Escape" || !query) return;
    event.stopPropagation();
    query = "";
  }

  const focus = (input: HTMLInputElement) => input.focus({ preventScroll: true });
</script>

{#snippet lit(text: string)}
  {#each highlight(text, words) as part, index (index)}{#if part.lit}<mark>{part.text}</mark
      >{:else}{part.text}{/if}{/each}
{/snippet}

<div
  class="rulebook"
  {@attach feedback("Rulebook", () => ({ query, found: result.found, month: campaign.month }))}
>
  <div class="search">
    <input
      type="search"
      bind:value={query}
      {onkeydown}
      placeholder="Search the rules"
      aria-label="Search the rules"
      autocomplete="off"
      spellcheck="false"
      {@attach focus}
    />
    <span class="found" aria-live="polite">
      {#if result.found !== null}{result.found}
        {result.found === 1 ? "rule matches" : "rules match"}{/if}
    </span>
  </div>

  <div class="body">
    <nav aria-label="Chapters">
      <ol>
        {#each result.chapters as chapter (chapter.id)}
          <li><button onclick={() => jump(chapter.id)}>{chapter.title}</button></li>
        {/each}
      </ol>
    </nav>

    <div
      class="pages"
      bind:this={pages}
      {@attach feedback("Rulebook pages", () => ({ chapters: result.chapters.length }))}
    >
      {#each result.chapters as chapter (chapter.id)}
        <section class="chapter" data-chapter={chapter.id} aria-label={chapter.title}>
          <h3>{chapter.title}</h3>
          {#each chapter.sections as section (section.id)}
            <section class="section" aria-label={section.title}>
              {#if section.title !== chapter.title}<h4>{@render lit(section.title)}</h4>{/if}
              {#each section.blocks as block, index (index)}
                {#if block.t === "slot"}
                  <p class="slot">Rule sticker {block.sticker}</p>
                {:else}
                  <div class="block" class:sticker={block.sticker}>
                    {#if block.sticker}<span
                        class="letter"
                        aria-label={`Rule sticker ${block.sticker}`}>{block.sticker}</span
                      >{/if}
                    {#if block.t === "p"}
                      <p>
                        {#if block.lead}<b>{@render lit(block.lead)}</b>{/if}
                        {@render lit(block.text)}
                      </p>
                    {:else if block.t === "list"}
                      <svelte:element this={block.ordered ? "ol" : "ul"} class="items">
                        {#each block.items as item, itemIndex (itemIndex)}<li>
                            {@render lit(item)}
                          </li>{/each}
                      </svelte:element>
                    {:else}
                      <table>
                        <thead>
                          <tr
                            >{#each block.head as cell (cell)}<th>{cell}</th>{/each}</tr
                          >
                        </thead>
                        <tbody>
                          {#each block.rows as row, rowIndex (rowIndex)}
                            <tr
                              >{#each row as cell, cellIndex (cellIndex)}<td>{@render lit(cell)}</td
                                >{/each}</tr
                            >
                          {/each}
                        </tbody>
                      </table>
                    {/if}
                  </div>
                {/if}
              {/each}
            </section>
          {/each}
        </section>
      {:else}
        <p class="none">No rule mentions “{query.trim()}”.</p>
      {/each}
    </div>
  </div>
</div>

<style>
  .rulebook {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    /* The box sizes to its content, so a short search result would otherwise shrink it while typing. */
    width: min(64.8rem, calc(100vw - 6.4rem));
    min-height: 0;
    margin-top: 0.8rem;
  }

  .search {
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }

  input {
    width: min(24rem, 100%);
    padding: 0.4rem 0.7rem;
    border: 1px solid rgb(60 44 28 / 0.35);
    border-radius: 2px;
    background: rgb(255 255 255 / 0.45);
    color: var(--paper-ink);
    font: inherit;
  }

  input:focus-visible {
    outline: 2px solid var(--paper-ink);
    outline-offset: 1px;
  }

  .found {
    font-size: 0.85rem;
    color: var(--paper-muted);
  }

  .body {
    display: grid;
    grid-template-columns: 11rem 1fr;
    gap: 1.6rem;
    min-height: 0;
  }

  nav ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  nav button {
    display: block;
    width: 100%;
    padding: 0.25rem 0;
    border: 0;
    background: none;
    color: var(--paper-muted);
    font: inherit;
    font-size: 0.88rem;
    text-align: left;
    cursor: pointer;
  }

  nav button:hover,
  nav button:focus-visible {
    color: var(--paper-ink);
    text-decoration: underline;
  }

  .pages {
    height: 34rem;
    max-height: calc(100dvh - 16rem);
    overflow: auto;
    padding-right: 0.6rem;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .chapter + .chapter {
    margin-top: 1.4rem;
    padding-top: 0.6rem;
    border-top: 1px solid var(--slip-line);
  }

  h3 {
    margin: 0 0 0.4rem;
    font-family: var(--font-display);
    font-size: 1.35rem;
    font-weight: 400;
  }

  h4 {
    margin: 0.8rem 0 0.3rem;
    font-family: var(--font-display);
    font-size: 1.05rem;
    font-weight: 400;
    color: var(--paper-muted);
  }

  p {
    margin: 0 0 0.45rem;
  }

  .block {
    position: relative;
  }

  /* A placed rule sticker: a slightly brighter label stuck over the page. */
  .sticker {
    margin: 0.2rem 0 0.55rem;
    padding: 0.4rem 0.6rem 0.1rem 1.9rem;
    border: 1px solid rgb(60 44 28 / 0.22);
    border-radius: 3px;
    background: rgb(255 252 240 / 0.6);
    box-shadow: 0 1px 2px rgb(40 24 8 / 0.15);
  }

  .letter {
    position: absolute;
    top: 0.45rem;
    left: 0.5rem;
    width: 1.05rem;
    height: 1.05rem;
    border-radius: 50%;
    background: var(--paper-ink);
    color: var(--paper);
    font-size: 0.68rem;
    font-weight: 700;
    line-height: 1.05rem;
    text-align: center;
  }

  .slot {
    margin: 0.2rem 0 0.55rem;
    padding: 0.35rem 0.6rem;
    border: 1px dashed rgb(60 44 28 / 0.35);
    border-radius: 3px;
    font-size: 0.8rem;
    color: var(--paper-muted);
  }

  .items {
    margin: 0 0 0.45rem;
    padding-left: 1.3rem;
    list-style: disc;
  }

  ol.items {
    list-style: decimal;
  }

  .items li {
    margin-bottom: 0.15rem;
  }

  table {
    margin: 0.2rem 0 0.6rem;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  th,
  td {
    padding: 0.2rem 0.9rem 0.2rem 0;
    border-bottom: 1px solid var(--slip-line);
    text-align: left;
    vertical-align: top;
  }

  th {
    font-weight: 600;
    color: var(--paper-muted);
  }

  mark {
    border-radius: 2px;
    background: rgb(240 200 90 / 0.7);
    color: inherit;
  }

  .none {
    color: var(--paper-muted);
  }
</style>
