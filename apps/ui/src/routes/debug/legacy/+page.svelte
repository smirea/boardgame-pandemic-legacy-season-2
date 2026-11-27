<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import { pack, readingFrom } from "@repo/game";
  import { onDestroy } from "svelte";
  import CloseButton from "#lib/hud/CloseButton.svelte";
  import Crash from "#lib/hud/Crash.svelte";
  import Game from "#lib/hud/Game.svelte";
  import { setReadingExit } from "#lib/hud/readingExit.ts";
  import { GameSession } from "#lib/session/session.svelte.ts";

  // The Prologue's two cards are in play from the start and never read, so the deck is read from January on.
  const deck = pack.legacyDeck.flatMap((card, index) =>
    card.month > 0
      ? [{ card, index, starts: Boolean(pack.legacyDeck[index - 1]?.halt) }]
      : [],
  );
  const months = [...new Set(deck.map((entry) => entry.card.month))].map((month) => ({
    month,
    cards: deck.filter((entry) => entry.card.month === month),
  }));
  const MONTH = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  let open = $state.raw<{ index: number; session: GameSession } | null>(null);

  // The card read from is kept in the address, beside whatever else it holds, so a reload reads it again.
  function remember(card: string | null) {
    const params = new URLSearchParams(location.search);
    if (card) params.set("card", card);
    else params.delete("card");
    const query = params.toString();
    history.replaceState(null, "", query ? `?${query}` : location.pathname);
  }

  function start(index: number) {
    open?.session.close();
    // A session given a save keeps it out of storage, so this browser's campaign is never touched.
    open = {
      index,
      session: new GameSession({
        mode: "solo",
        secret: "",
        save: readingFrom(index),
        player: "legacy-debug",
      }),
    };
    remember(pack.legacyDeck[index]!.id);
  }

  function leave() {
    open?.session.close();
    open = null;
    remember(null);
  }

  setReadingExit({ label: "Back to the deck", leave });

  const asked = new URLSearchParams(location.search).get("card");
  const askedIndex = pack.legacyDeck.findIndex((card) => card.id === asked);
  if (askedIndex > 0 && pack.legacyDeck[askedIndex]!.month > 0) start(askedIndex);

  onDestroy(() => open?.session.close());

  const current = $derived(open ? pack.legacyDeck[open.index]! : null);
</script>

<svelte:head>
  <title>Legacy: debug deck</title>
</svelte:head>

{#if open && current}
  <div class="strip" {@attach feedback("Legacy deck reading", () => ({ from: current.id }))}>
    <span>Reading the Legacy deck from <b>{current.id}</b> {current.title}</span>
    <CloseButton label="Back to the deck" onclick={leave} />
  </div>
  {#key open}
    <div class="stage">
      {#if open.session.state}
        <svelte:boundary>
          <Game session={open.session} />
          {#snippet failed(error)}
            <Crash {error} session={open!.session} />
          {/snippet}
        </svelte:boundary>
      {/if}
    </div>
  {/key}
{:else}
  <main {@attach feedback("Legacy deck", () => ({ cards: deck.length }))}>
    <h1>Legacy deck</h1>
    <p class="lead">
      Pick a card to read the deck from it, as the table would: the months before are played, the cards of its
      month before it are read already, and the reading runs to the next Stop or Pause. A gold card starts a
      reading in the campaign.
    </p>
    {#each months as { month, cards } (month)}
      <section>
        <h2>{MONTH[month]}</h2>
        <ol>
          {#each cards as { card, index, starts } (card.id)}
            <li>
              <button
                type="button"
                class:starts
                onclick={() => start(index)}
                data-testid={`read-from-${card.id}`}
              >
                <code>{card.id}</code>
                <span class="title">{card.title}</span>
                {#if card.when}<span class="tag">{card.when}</span>{/if}
                {#if card.halt}<span class="tag halt">{card.halt}</span>{/if}
              </button>
            </li>
          {/each}
        </ol>
      </section>
    {/each}
  </main>
{/if}

<style>
  .strip {
    position: fixed;
    inset: 0 0 auto;
    z-index: 2000;
    display: flex;
    align-items: center;
    gap: 1rem;
    height: 2.6rem;
    padding: 0 0.5rem 0 1rem;
    border-bottom: 1px solid var(--line-strong);
    background: #0d0b09;
    color: var(--ink);
    font-size: 0.85rem;
  }

  .strip b {
    font-weight: 700;
  }

  /* The game sits under the strip, filling the rest of the screen. */
  .stage {
    --game-inset: 2.6rem 0 0 0;
  }

  main {
    min-height: 100vh;
    padding: 3rem max(1.5rem, calc(50vw - 34rem));
    background: var(--table);
    color: var(--ink);
    font-family: var(--font-ui);
  }

  h1 {
    margin: 0 0 0.6rem;
    font-family: var(--font-display);
    font-size: 2.6rem;
    font-weight: 400;
  }

  .lead {
    max-width: 44rem;
    margin: 0 0 2rem;
    color: var(--muted);
  }

  section {
    margin-bottom: 1.6rem;
  }

  h2 {
    margin: 0 0 0.5rem;
    font-family: var(--font-display);
    font-size: 1.4rem;
    font-weight: 400;
  }

  ol {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  button {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    width: 100%;
    padding: 0.55rem 0.8rem;
    border: 0;
    border-left: 2px solid var(--line-strong);
    background: var(--wash);
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      border-color 0.15s,
      background 0.15s;
  }

  button:hover,
  button:focus-visible {
    border-left-color: var(--paper);
    background: rgb(231 220 198 / 0.09);
    outline: none;
  }

  button.starts {
    border-left-color: #e2c36a;
  }

  code {
    color: var(--muted);
    font-size: 0.8rem;
  }

  .title {
    flex: 1;
    min-width: 0;
  }

  .tag {
    color: var(--muted);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .tag.halt {
    color: #e2c36a;
  }
</style>
