<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import { campaignAt, legacyQuestions, pack, readingFrom, sealKey } from "@repo/game";
  import type {
    Campaign,
    LegacyCardDef,
    LegacyQuestion,
    ReadingChoices,
    Seal,
    SealKey,
  } from "@repo/game";
  import { onDestroy } from "svelte";
  import { fade } from "svelte/transition";
  import LegacyCard from "#lib/cards/LegacyCard.svelte";
  import GameOverlay from "#lib/debug/GameOverlay.svelte";
  import Crate from "#lib/hud/Crate.svelte";
  import DossierDoor from "#lib/hud/DossierDoor.svelte";
  import { GameSession } from "#lib/session/session.svelte.ts";
  import Reveal from "./Reveal.svelte";

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

  // The Prologue's two cards are in play from the start and never read, so the deck is read from January on. Only
  // the cards that are read show: an Event, an Epidemic, an objective, a turning point, the Frequency Scanner and the
  // Plan are pieces the reading hands the table, and every reading starts on a Stop or a Pause.
  const PIECES = new Set<LegacyCardDef["kind"]>([
    "event",
    "epidemic",
    "objective",
    "turningPoint",
    "scanner",
    "plan",
  ]);
  const deck = pack.legacyDeck.flatMap((card, index) =>
    card.month > 0 && !PIECES.has(card.kind)
      ? [{ card, index, starts: Boolean(pack.legacyDeck[index - 1]?.halt) }]
      : [],
  );
  const questions = legacyQuestions();
  const months = [...new Set(deck.map((entry) => entry.card.month))].map((month) => ({
    month,
    cards: deck.filter((entry) => entry.card.month === month),
    questions: questions.filter((question) => question.month === month),
  }));

  // What the table answered, kept in the address with the card read from: only the answers that differ from the
  // schedule `campaignAt` plays, so a seal left as it is follows the schedule in every other month too.
  const params = new URLSearchParams(location.search);
  const listed = (name: string) =>
    (params.get(name) ?? "").split(",").filter(Boolean) as SealKey[];
  let explored = $state<Partial<Record<SealKey, boolean>>>({
    ...Object.fromEntries(listed("open").map((key) => [key, true])),
    ...Object.fromEntries(listed("sealed").map((key) => [key, false])),
  });
  let delivered = $state(params.get("delivered") === "1");

  const isOpen = (question: Extract<LegacyQuestion, { t: "sealed" }>) =>
    question.fixed || (explored[sealKey(question.seal)] ?? question.open);
  function setOpen(question: Extract<LegacyQuestion, { t: "sealed" }>, open: boolean) {
    const key = sealKey(question.seal);
    const next = { ...explored };
    if (open === question.open) delete next[key];
    else next[key] = open;
    explored = next;
    remember();
  }
  const choices = (): ReadingChoices => ({ explored: { ...explored }, delivered });
  const asks = (question: Extract<LegacyQuestion, { t: "sealed" }>) =>
    question.cards
      .map((id) => {
        const card = pack.legacyDeck.find((entry) => entry.id === id)!;
        const unlock = card.unlocks.find(
          (entry) =>
            (entry.t === "perimeter" && sealKey(entry.seal) === sealKey(question.seal)) ||
            (entry.t === "scratch" && sealKey(entry.unlessOpen) === sealKey(question.seal)),
        );
        return unlock?.t === "perimeter"
          ? `${id} forces it open if it is still sealed`
          : `${id} scratches a box if it is still sealed`;
      })
      .join("; ");
  const sealName = (seal: Seal) => (seal.t === "package" ? `Package ${seal.id}` : `Door ${seal.id}`);

  let open = $state.raw<{ index: number; session: GameSession } | null>(null);

  function remember() {
    const next = new URLSearchParams(location.search);
    const set = (name: string, value: string) =>
      value ? next.set(name, value) : next.delete(name);
    set("card", open ? pack.legacyDeck[open.index]!.id : "");
    set(
      "open",
      Object.entries(explored)
        .filter(([, value]) => value)
        .map(([key]) => key)
        .join(","),
    );
    set(
      "sealed",
      Object.entries(explored)
        .filter(([, value]) => !value)
        .map(([key]) => key)
        .join(","),
    );
    set("delivered", delivered ? "1" : "");
    const query = next.toString();
    history.replaceState(null, "", query ? `?${query}` : location.pathname);
  }

  function start(index: number) {
    open?.session.close();
    hover = null;
    // A session given a save keeps it out of storage, so this browser's campaign is never touched.
    open = {
      index,
      session: new GameSession({
        mode: "solo",
        secret: "",
        save: readingFrom(index, choices()),
        player: "legacy-debug",
      }),
    };
    remember();
  }

  function leave() {
    open?.session.close();
    open = null;
    remember();
  }

  const asked = params.get("card");
  const askedIndex = pack.legacyDeck.findIndex((card) => card.id === asked);
  if (askedIndex > 0 && pack.legacyDeck[askedIndex]!.month > 0) start(askedIndex);

  onDestroy(() => open?.session.close());

  const current = $derived(open ? pack.legacyDeck[open.index]! : null);

  // The campaign each month's cards are worded against, built once a card of that month is looked at.
  const campaigns = new Map<number, Campaign>();
  const campaignOf = (month: number) => {
    let campaign = campaigns.get(month);
    if (!campaign) {
      campaign = campaignAt(month).world.campaign;
      campaigns.set(month, campaign);
    }
    return campaign;
  };

  // What a card reveals opens beside it while the pointer rests on it, and stays while the pointer is in it. A
  // card the pointer only crosses on its way there does not take its place.
  let hover = $state.raw<{ card: LegacyCardDef; side: "left" | "right" } | null>(null);
  let pending: ReturnType<typeof setTimeout> | null = null;
  let closing: ReturnType<typeof setTimeout> | null = null;
  const settle = () => {
    if (pending) clearTimeout(pending);
    if (closing) clearTimeout(closing);
    pending = closing = null;
  };
  function enter(card: LegacyCardDef, at: HTMLElement) {
    settle();
    const rect = at.getBoundingClientRect();
    const side = rect.left + rect.width / 2 < innerWidth / 2 ? "right" : "left";
    const show = () => (hover = { card, side });
    if (hover) pending = setTimeout(show, 280);
    else show();
  }
  function leaveCard() {
    if (pending) clearTimeout(pending);
    pending = null;
    closing = setTimeout(() => (hover = null), 260);
  }
</script>

<svelte:head>
  <title>Legacy: debug deck</title>
</svelte:head>

<svelte:window
  onkeydown={(event) => {
    if (event.key === "Escape" && hover) hover = null;
  }}
/>

{#if open && current}
  {#key open}
    <GameOverlay
      session={open.session}
      title={`Reading the Legacy deck from ${current.id} ${current.title}`}
      back="Back to the deck"
      onclose={leave}
    />
  {/key}
{:else}
  <main {@attach feedback("Legacy deck", () => ({ cards: deck.length, explored, delivered }))}>
    <h1>Legacy deck</h1>
    <p class="lead">
      Click a card to read the deck from it on the real game screen: the months before are played, its month’s
      cards before it are read, and the reading runs to the next Stop or Pause. A gold edge marks where the
      campaign starts a reading. Each month’s questions above its cards set how the campaign stands when it is
      asked; rest on a card to see everything it reveals.
    </p>
    {#each months as { month, cards, questions: asked } (month)}
      <section {@attach feedback("Legacy month", () => ({ month: MONTH[month] }))}>
        <h2>{MONTH[month]}</h2>
        {#if asked.length}
          <div class="questions">
            {#each asked as question (question.t === "sealed" ? sealKey(question.seal) : "delivered")}
              {#if question.t === "sealed"}
                <label class="question" class:fixed={question.fixed}>
                  <input
                    type="checkbox"
                    checked={isOpen(question)}
                    disabled={question.fixed}
                    onchange={(event) => setOpen(question, event.currentTarget.checked)}
                    data-testid={`opened-${sealKey(question.seal)}`}
                  />
                  <span class="shell {question.seal.t}">
                    {#if question.seal.t === "package"}<Crate
                        id={question.seal.id}
                        open={isOpen(question)}
                      />{:else}<DossierDoor id={question.seal.id} open={isOpen(question)} />{/if}
                  </span>
                  <span class="words">
                    <b>{sealName(question.seal)} opened before {MONTH[month]}</b>
                    <small
                      >{question.fixed
                        ? "The deck has opened it by then."
                        : `${asks(question)}.${question.open === isOpen(question) ? " As the schedule plays it." : ""}`}</small
                    >
                  </span>
                </label>
              {:else}
                <label class="question">
                  <input
                    type="checkbox"
                    bind:checked={delivered}
                    onchange={remember}
                    data-testid="sample-delivered"
                  />
                  <span class="words">
                    <b>Sample delivered</b>
                    <small>Decides {question.cards.join(", ")}.</small>
                  </span>
                </label>
              {/if}
            {/each}
          </div>
        {/if}
        <ol class="cards">
          {#each cards as { card, index, starts } (card.id)}
            <li>
              <button
                type="button"
                class="card"
                class:starts
                onclick={() => start(index)}
                onpointerenter={(event) => enter(card, event.currentTarget)}
                onpointerleave={leaveCard}
                onfocus={(event) => enter(card, event.currentTarget)}
                onblur={leaveCard}
                aria-label={`Read the deck from ${card.id} ${card.title}`}
                data-testid={`read-from-${card.id}`}
              >
                <span class="face"
                  ><LegacyCard {card} side="b" size="thumb" campaign={campaignOf(month)} /></span
                >
                <span class="caption">
                  <code>{card.id}</code>
                  {#if card.halt}<span class="tag halt">{card.halt}</span>{/if}
                  {#if card.when}<span class="tag"
                      >{card.when === "delivered" ? "delivered" : "not delivered"}</span
                    >{/if}
                </span>
              </button>
            </li>
          {/each}
        </ol>
      </section>
    {/each}
  </main>

  {#if hover}
    <div
      class="popup {hover.side}"
      role="dialog"
      aria-label={`What ${hover.card.id} reveals`}
      tabindex="-1"
      onpointerenter={settle}
      onpointerleave={leaveCard}
      transition:fade={{ duration: 120 }}
      {@attach feedback("Card reveals", () => ({ card: hover?.card.id }))}
    >
      {#key hover.card.id}
        <Reveal card={hover.card} campaign={campaignOf(hover.card.month)} />
      {/key}
    </div>
  {/if}
{/if}

<style>
  main {
    min-height: 100vh;
    padding: 3rem max(1.5rem, calc(50vw - 40rem));
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
    max-width: 48rem;
    margin: 0 0 2rem;
    color: var(--muted);
  }

  section {
    margin-bottom: 2.2rem;
  }

  h2 {
    margin: 0 0 0.6rem;
    font-family: var(--font-display);
    font-size: 1.6rem;
    font-weight: 400;
  }

  .questions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin-bottom: 0.9rem;
  }

  .question {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    max-width: 34rem;
    padding: 0.5rem 0.8rem;
    border-left: 2px solid #c9a86a;
    background: var(--wash);
    cursor: pointer;
  }

  .question.fixed {
    opacity: 0.6;
    cursor: default;
  }

  .question input {
    width: 1.05rem;
    height: 1.05rem;
    accent-color: #e2c36a;
  }

  .question .words {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .question small {
    color: var(--muted);
  }

  .shell.package {
    width: 2.8rem;
  }

  .shell.door {
    width: 1.8rem;
  }

  .cards {
    display: flex;
    flex-wrap: wrap;
    gap: 0.9rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem;
    border: 0;
    border-bottom: 2px solid transparent;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition:
      transform 0.15s,
      border-color 0.15s;
  }

  .card:hover,
  .card:focus-visible {
    transform: translateY(-3px);
    outline: none;
  }

  .card.starts {
    border-bottom-color: #e2c36a;
  }

  .face {
    display: flex;
  }

  .caption {
    display: flex;
    gap: 0.4rem;
    align-items: baseline;
  }

  code {
    color: var(--muted);
    font-size: 0.78rem;
  }

  .tag {
    color: var(--muted);
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .tag.halt {
    color: #e2c36a;
  }

  /* Large enough to read a card and everything behind it, scrolling only when a card opens a long chain. */
  .popup {
    position: fixed;
    top: 4vh;
    z-index: var(--z-tooltip);
    width: min(64rem, 64vw);
    max-height: 92vh;
    overflow: auto;
    padding: 1.4rem 1.6rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: #15110d;
    box-shadow: 0 1.6rem 4rem rgb(0 0 0 / 0.7);
    color: var(--ink);
    overscroll-behavior: contain;
  }

  .popup.right {
    right: 2vw;
  }

  .popup.left {
    left: 2vw;
  }
</style>
