<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import { pack, revealDone, revealOutcome, searchFind, REVEAL_COUNT } from "@repo/game";
  import type { CardId, Command, Decision, SeatId, World } from "@repo/game";
  import { untrack } from "svelte";
  import { backOut } from "svelte/easing";
  import { fade, scale } from "svelte/transition";
  import { inkOn } from "#lib/color.ts";
  import { searchStory } from "#lib/cards/playerPrint.ts";
  import { sfxCardDraw, sfxCardFlip, sfxScratchBox } from "#lib/audio/sfx.ts";
  import { sceneForSearch } from "#lib/story/script.ts";
  import StoryStage from "#lib/story/StoryStage.svelte";
  import { onButton, typing } from "#lib/keys.ts";
  import { cardName, cityName, seatName, seatColor } from "./labels.svelte.ts";
  import PlayerCard from "./PlayerCard.svelte";

  type Props = {
    world: World;
    pending: Extract<Decision, { t: "reveal" | "search" }>;
    /** Whether this screen moves the reveal on. Everyone else watches it move. */
    mine: boolean;
    send: (command: Command) => void;
  };

  type SearchStage = "flying" | "shaking" | "scratching" | "revealed";

  const FLY_MS = 520;
  const SHAKE_MS = 480;
  const SCRATCH_MS = 900;

  let { world, pending, mine, send }: Props = $props();

  const game = $derived(world.game!);
  const who = $derived(seatName(world, pending.seat));
  const color = $derived(seatColor(pending.seat));

  const reveal = $derived(pending.t === "reveal" ? pending : null);
  const done = $derived(reveal ? revealDone(game, reveal) : true);
  const outcome = $derived(reveal && done ? revealOutcome(world, reveal) : null);
  /** Face-down places for the cards still to come, so the table sees how many are left to turn. */
  const slots = $derived.by(() => {
    if (!reveal) return [];
    const left = Math.min(REVEAL_COUNT - reveal.cards.length, game.playerDeck.order.length);
    return [...reveal.cards, ...Array.from({ length: left }, () => null)] as (CardId | null)[];
  });

  const searched = $derived.by(() => {
    if (pending.t !== "search") return null;
    const card = world.campaign.playerCards[pending.card];
    if (card?.kind !== "city") return null;
    const box = card.search[pending.box]!;
    return {
      key: `${pending.card}:${pending.box}`,
      card,
      box: pending.box,
      city: cityName(card.city),
      sea: box.scope === "sea",
      story: searchStory(card.city, box.scope),
      found: searchFind(box.result),
      companion: box.result.t === "companion",
    };
  });

  const reward = $derived(
    reveal?.by.t === "monitor" ? pack.frequencies[reveal.by.frequency] : undefined,
  );
  const title = $derived(
    reveal
      ? reveal.by.t === "monitor"
        ? `Monitor · ${pack.frequencyLabels[reveal.by.frequency]}`
        : "Cautious Approach"
      : searched
        ? `${searched.sea ? "Searched the sea at" : "Searched the land at"} ${searched.city}`
        : "Search",
  );
  const rule = $derived(
    reveal?.by.t === "monitor"
      ? "The top 4 Player cards are turned over and discarded. An Epidemic among them has no effect."
      : reveal
        ? "The top 4 Player cards are turned over. City cards go to the hand, the rest are discarded with no effect."
        : "",
  );
  const verdict = $derived.by(() => {
    if (!outcome || !reveal) return "";
    const names = (cards: CardId[]) => cards.map((id) => cardName(world, id)).join(", ");
    if (reveal.by.t === "monitor") {
      if (reward && "seal" in reward)
        return "Something answers on this frequency. It is unpacked next.";
      if (!outcome.keep.length) return "Nothing on this frequency to keep.";
      return `${who} keeps ${names(outcome.keep)}.`;
    }
    return outcome.keep.length ? `${who} keeps ${names(outcome.keep)}.` : "No City cards to keep.";
  });

  const next = $derived(
    reveal
      ? done
        ? outcome?.keep.length
          ? "Take them and discard the rest"
          : "Discard them"
        : `Turn over card ${reveal.cards.length + 1}`
      : "Continue",
  );
  const waiting = $derived(
    reveal && !done
      ? `Waiting for ${who} to turn over the next card`
      : `Waiting for ${who} to continue`,
  );

  const searchScene = $derived(
    searched ? sceneForSearch(searched.card.city, searched.sea ? "sea" : "land") : null,
  );
  const hasFlavorText = $derived(Boolean(searched?.story));

  let searchStage = $state<SearchStage>("flying");
  let cardNode = $state<HTMLElement>();
  let activeAnim: Animation | null = null;
  let playedScratch = false;
  let lastSearchKey = "";

  const cardScratch = $derived(
    searched
      ? {
          box: searched.box,
          stage:
            searchStage === "revealed"
              ? ("open" as const)
              : searchStage === "scratching"
                ? ("scratching" as const)
                : ("sealed" as const),
        }
      : undefined,
  );

  let lastRevealCount = 0;
  $effect(() => {
    const count = reveal?.cards.length ?? 0;
    if (reveal) {
      if (count > lastRevealCount) sfxCardFlip();
      lastRevealCount = count;
    } else {
      lastRevealCount = 0;
    }
  });

  $effect(() => {
    const key = searched?.key ?? "";
    if (key === lastSearchKey) return;
    lastSearchKey = key;
    playedScratch = false;
    searchStage = "flying";
  });

  function findSourceRect(card: CardId, seat: SeatId): DOMRect | null {
    const node =
      document.querySelector(`[data-testid="hand"] [data-card="${card}"]`) ??
      document.querySelector(`.place[data-seat="${seat}"] [data-testid="corner-hand"]`) ??
      document.querySelector(`.place[data-seat="${seat}"]`);
    return node?.getBoundingClientRect() ?? null;
  }

  /** Drives the search sequence via Web Animations so Studio's `settle({ hurry: true })` advances every stage cleanly. */
  $effect(() => {
    const target = searched;
    const node = cardNode;
    const stage = searchStage;
    if (!target || !node || stage === "revealed") return;

    return untrack(() => {
      if (activeAnim) {
        activeAnim.onfinish = null;
        activeAnim.cancel();
        activeAnim = null;
      }

      let anim: Animation;
      if (stage === "flying") {
        sfxCardDraw();
        const end = node.getBoundingClientRect();
        const start = findSourceRect(target.card.id, pending.seat);
        const dx = start ? start.left + start.width / 2 - (end.left + end.width / 2) : 0;
        const dy = start ? start.top + start.height / 2 - (end.top + end.height / 2) : 90;
        const scaleFrom =
          start && end.width > 0 ? Math.max(0.24, Math.min(0.95, start.width / end.width)) : 0.72;
        const arc = Math.min(72, Math.hypot(dx, dy) * 0.16);
        const tilt = dx > 12 ? -6 : dx < -12 ? 6 : -4;
        anim = node.animate(
          [
            {
              transform: `translate(${dx}px, ${dy}px) scale(${scaleFrom}) rotate(${tilt}deg)`,
              opacity: start ? 0.96 : 0,
            },
            {
              transform: `translate(${dx * 0.42}px, ${dy * 0.42 - arc}px) scale(${(scaleFrom + 1.05) / 2}) rotate(${-tilt * 0.45}deg)`,
              opacity: 1,
              offset: 0.56,
            },
            { transform: "translate(0, 0) scale(1) rotate(0deg)", opacity: 1 },
          ],
          { duration: FLY_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        );
        anim.onfinish = () => {
          if (activeAnim !== anim) return;
          activeAnim = null;
          searchStage = "shaking";
        };
      } else if (stage === "shaking") {
        anim = node.animate(
          [
            { transform: "translate(0, 0) rotate(0deg)" },
            { transform: "translate(-6px, -2px) rotate(-2.4deg)", offset: 0.14 },
            { transform: "translate(7px, 2px) rotate(2.6deg)", offset: 0.28 },
            { transform: "translate(-7px, 1px) rotate(-2.5deg)", offset: 0.44 },
            { transform: "translate(6px, -2px) rotate(2.1deg)", offset: 0.6 },
            { transform: "translate(-4px, 1px) rotate(-1.3deg)", offset: 0.76 },
            { transform: "translate(3px, 0px) rotate(0.8deg)", offset: 0.9 },
            { transform: "translate(0, 0) rotate(0deg)" },
          ],
          { duration: SHAKE_MS, easing: "ease-in-out" },
        );
        anim.onfinish = () => {
          if (activeAnim !== anim) return;
          activeAnim = null;
          searchStage = "scratching";
        };
      } else {
        if (!playedScratch) {
          playedScratch = true;
          sfxScratchBox();
        }
        anim = node.animate(
          [
            { transform: "translate(0, 0) rotate(0deg)" },
            { transform: "translate(-2px, 1px) rotate(-0.6deg)", offset: 0.15 },
            { transform: "translate(2px, -1px) rotate(0.5deg)", offset: 0.32 },
            { transform: "translate(-2px, 0px) rotate(-0.5deg)", offset: 0.5 },
            { transform: "translate(2px, 1px) rotate(0.5deg)", offset: 0.68 },
            { transform: "translate(-1px, -1px) rotate(-0.3deg)", offset: 0.84 },
            { transform: "translate(0, 0) rotate(0deg)" },
          ],
          { duration: SCRATCH_MS, easing: "linear" },
        );
        anim.onfinish = () => {
          if (activeAnim !== anim) return;
          activeAnim = null;
          searchStage = "revealed";
        };
      }
      activeAnim = anim;

      return () => {
        anim.onfinish = null;
        anim.cancel();
        if (activeAnim === anim) activeAnim = null;
      };
    });
  });

  // The click that turned the last card or hurried the scratch must not land on Continue right away.
  let busy = $state(false);
  function lockBriefly(ms = 350) {
    busy = true;
    setTimeout(() => (busy = false), ms);
  }

  function hurrySearch() {
    if (!searched || searchStage === "revealed") return;
    if (activeAnim) {
      activeAnim.onfinish = null;
      activeAnim.cancel();
      activeAnim = null;
    }
    if (!playedScratch) {
      playedScratch = true;
      sfxScratchBox();
    }
    searchStage = "revealed";
    lockBriefly(250);
  }

  function advance() {
    if (searched && searchStage !== "revealed") {
      hurrySearch();
      return;
    }
    if (!mine || busy) return;
    lockBriefly(350);
    send({ type: "DECIDE", decide: { d: pending.t } });
  }
</script>

<svelte:window
  onkeydown={(event) => {
    if (event.key !== " " || typing(event) || onButton(event)) return;
    if (searched && searchStage !== "revealed") {
      event.preventDefault();
      if (!event.repeat) hurrySearch();
      return;
    }
    if (!mine) return;
    event.preventDefault();
    if (!event.repeat) advance();
  }}
/>

<!--
	What a Monitor, a Cautious Approach or a search turns over is hidden until that moment, so the whole table watches
	it happen in front of the board. Each card is turned by a command, and only the player it belongs to moves it on.
-->
{#if reveal}
  <section
    class="reveal"
    style:--seat={color}
    style:--on={inkOn(color)}
    aria-label={`${who}: ${title}`}
    in:scale={{ start: 0.85, duration: 380, easing: backOut }}
    {@attach feedback("Reveal", () => ({ who, kind: pending.t, cards: reveal?.cards, done }))}
  >
    <header>
      <span class="who">{who}</span>
      <h2>{title}</h2>
    </header>

    <p class="rule">{rule}</p>
    <ol class="cards" data-testid="reveal-cards">
      {#each slots as id, index (index)}
        {@const card = id ? world.campaign.playerCards[id] : null}
        {@const kept = id !== null && (outcome?.keep.includes(id) ?? false)}
        <li class:up={card !== null} class:kept class:dropped={outcome !== null && !kept}>
          <span class="flip">
            <span class="back" aria-hidden="true"><span>Player</span></span>
            <span class="face">
              {#if card}<PlayerCard {card} />{/if}
            </span>
          </span>
          {#if outcome && id}
            <span class="fate"
              >{kept ? "To hand" : card?.kind === "epidemic" ? "No effect" : "Discard"}</span
            >
          {/if}
        </li>
      {/each}
    </ol>
    {#if outcome}<p class="verdict" data-testid="reveal-verdict">{verdict}</p>{/if}

    <footer>
      {#if mine}
        <!-- svelte-ignore a11y_autofocus -->
        <button
          type="button"
          class="go"
          data-testid="reveal-next"
          autofocus
          disabled={busy}
          onclick={advance}
        >
          {next}
        </button>
        <span class="key">Space</span>
      {:else}
        <p class="waiting">{waiting}.</p>
      {/if}
    </footer>
  </section>
{:else if searched}
  <section
    class="search-stage"
    class:with-bubble={!hasFlavorText && searchStage === "revealed"}
    style:--seat={color}
    style:--on={inkOn(color)}
    style:--story-dock-bottom="1.15rem"
    aria-label={`${who}: ${title}`}
    data-testid="search-stage"
    data-search-stage={searchStage}
    {@attach feedback("Search reveal", () => ({
      who,
      city: searched.city,
      scope: searched.sea ? "sea" : "land",
      stage: searchStage,
      found: searched.found,
    }))}
  >
    <header class="search-head" class:shown={searchStage !== "flying"}>
      <span class="who">{who}</span>
      <h2>{title}</h2>
    </header>

    {#key searched.key}
      <div
        class="spotlight-card"
        class:compact-card={!hasFlavorText}
        bind:this={cardNode}
        {@attach feedback("Searched card", () => ({
          city: searched.city,
          stage: searchStage,
          found: searched.found,
        }))}
      >
        <PlayerCard
          card={searched.card}
          scratch={cardScratch}
          onclick={searchStage !== "revealed" ? hurrySearch : undefined}
        />
      </div>
    {/key}

    <footer class="search-foot" class:ready={searchStage === "revealed"}>
      {#if searchStage === "revealed"}
        {#if mine}
          <!-- svelte-ignore a11y_autofocus -->
          <button
            type="button"
            class="go"
            data-testid="reveal-next"
            autofocus
            disabled={busy}
            onclick={advance}
          >
            {next}
          </button>
        {:else}
          <p class="waiting">{waiting}.</p>
        {/if}
      {/if}
    </footer>
  </section>

  {#if searchScene && searchStage === "revealed"}
    <div class="search-story-layer" style:--story-dock-bottom="1.15rem">
      <StoryStage
        scene={searchScene}
        overlay
        solo
        bare={hasFlavorText}
        delivered={world.campaign.sampleDelivered}
      />
    </div>
  {/if}
{/if}

<style>
  .reveal {
    position: relative;
    z-index: 15;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.9rem;
    max-width: min(46rem, 100%);
    padding: 1.1rem 1.4rem 1.2rem;
    border: 1px solid color-mix(in srgb, var(--seat) 70%, var(--line));
    border-radius: 0.6rem;
    background: var(--panel-solid);
    box-shadow:
      0 0 0 1px rgb(0 0 0 / 0.3),
      0 1.4rem 3rem rgb(0 0 0 / 0.5);
  }

  header {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
  }

  h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .who {
    padding: 0.1rem 0.5rem;
    border-radius: 0.25rem;
    background: var(--seat);
    color: var(--on);
    font-weight: 800;
  }

  .rule,
  .waiting,
  .verdict {
    margin: 0;
    max-width: 36rem;
    text-align: center;
  }

  .rule,
  .waiting {
    color: var(--muted);
    font-size: 0.86rem;
  }

  .verdict {
    font-size: 1.05rem;
    font-weight: 700;
    animation: arrive 400ms ease-out both;
  }

  .cards {
    display: flex;
    gap: 0.9rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .cards li {
    --card-size: 0.95rem;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    perspective: 60rem;
    transition:
      transform 320ms ease,
      opacity 320ms ease;
  }

  .flip {
    position: relative;
    display: grid;
    font-size: var(--card-size);
    transform-style: preserve-3d;
    transition: transform 650ms cubic-bezier(0.3, 0.7, 0.3, 1);
  }

  .back,
  .face {
    grid-area: 1 / 1;
    backface-visibility: hidden;
  }

  .face {
    transform: rotateY(180deg);
    pointer-events: none;
  }

  .back {
    display: grid;
    place-items: center;
    width: 8.4em;
    height: 10.6em;
    border: 1px solid #2e2820;
    border-radius: 0.4em;
    background:
      radial-gradient(ellipse at 30% 10%, rgb(255 248 228 / 0.14), transparent 60%),
      linear-gradient(172deg, #5d5446, #3d362c);
    box-shadow: inset 0 0 0 0.3em rgb(255 248 228 / 0.1);
  }

  .back span {
    font-size: 0.8em;
    font-weight: 800;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    opacity: 0.55;
  }

  .up .flip {
    transform: rotateY(180deg);
  }

  .kept {
    transform: translateY(-0.5rem);
  }

  .dropped {
    opacity: 0.55;
  }

  .fate {
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    animation: arrive 300ms ease-out both;
  }

  .kept .fate {
    color: var(--good, #8fc77a);
  }

  /* === Search Spotlight Sequence (card floats directly over the dimmed tabletop) === */
  .search-stage {
    position: relative;
    z-index: 15;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.9rem;
    height: 100%;
    box-sizing: border-box;
    padding: 0.5rem 1rem;
    transition: padding-bottom 300ms ease;
  }

  .search-stage.with-bubble {
    gap: 0.65rem;
    padding-bottom: 11.6rem;
  }

  .search-head {
    opacity: 0;
    transform: translateY(-0.4rem);
    text-shadow: 0 2px 14px rgb(0 0 0 / 0.85);
    transition:
      opacity 260ms ease,
      transform 260ms ease;
  }

  .search-head.shown {
    opacity: 1;
    transform: none;
  }

  .search-head h2 {
    color: #f6ebd4;
    font-family: var(--font-display);
    font-size: 1.55rem;
    font-weight: 400;
    letter-spacing: 0.02em;
  }

  .spotlight-card {
    --card-size: clamp(1.75rem, 4.1vh, 2.5rem);
    filter: drop-shadow(0 1.4rem 3.2rem rgb(0 0 0 / 0.72));
    will-change: transform;
  }

  .spotlight-card.compact-card {
    --card-size: clamp(1.25rem, calc((100vh - 23.5rem) / 10.6), 2.05rem);
  }

  .search-story-layer {
    position: absolute;
    inset: 0;
    z-index: 12;
    pointer-events: none;
  }

  footer {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-height: 2.3rem;
  }

  .search-foot {
    opacity: 0;
    transform: translateY(0.35rem);
    transition:
      opacity 240ms ease,
      transform 240ms ease;
  }

  .search-foot.ready {
    opacity: 1;
    transform: none;
  }

  .go {
    padding: 0.5rem 1.1rem;
    border: 1px solid color-mix(in srgb, var(--seat) 70%, #000);
    border-radius: 0.35rem;
    background: var(--seat);
    color: var(--on);
    font: inherit;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 0.5rem 1.4rem rgb(0 0 0 / 0.5);
  }

  .go:disabled {
    opacity: 0.7;
    cursor: default;
  }

  .key {
    padding: 0.05rem 0.4rem;
    border: 1px solid var(--line);
    border-radius: 0.2rem;
    background: rgb(16 13 10 / 0.72);
    color: var(--muted);
    font-size: 0.72rem;
  }

  @keyframes arrive {
    from {
      opacity: 0;
      transform: translateY(0.3rem);
    }
  }
</style>
