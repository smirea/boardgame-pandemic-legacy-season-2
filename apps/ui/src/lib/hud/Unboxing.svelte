<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import { changesMap, openings, pack, tablePlayers } from "@repo/game";
  import type { BriefingEntry, Campaign, Command, Opening, PlayerId, Table } from "@repo/game";
  import { onDestroy, onMount, tick } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { fade, fly, scale } from "svelte/transition";
  import Beacon from "#lib/Beacon.svelte";
  import LegacyCard from "#lib/cards/LegacyCard.svelte";
  import { fitZoom } from "#lib/cards/fit.ts";
  import { sfxCardDraw, sfxCardFlip, sfxCrateOpen, sfxDoorTear } from "#lib/audio/sfx.ts";
  import { sceneForOpening } from "#lib/story/script.ts";
  import StoryStage from "#lib/story/StoryStage.svelte";
  import Briefing from "./Briefing.svelte";
  import Crate from "./Crate.svelte";
  import DossierDoor from "./DossierDoor.svelte";
  import { destination, flyTo } from "./flight.ts";
  import ObjectiveTag from "./ObjectiveTag.svelte";
  import PieceGroups from "./PieceGroups.svelte";
  import RichText from "./RichText.svelte";
  import {
    groupPieces,
    legacyCardOf,
    piecesOf,
    STOW_ORDER,
    wings,
    type Piece,
  } from "./unboxPieces.ts";
  import { keep } from "./viewState.ts";
  import { onButton, typing } from "#lib/keys.ts";
  import VoteButton from "./VoteButton.svelte";
  import { tableVoters, waitingOn as stillWaiting } from "./voters.ts";

  type Props = {
    briefing: BriefingEntry[];
    campaign: Campaign;
    table: Table;
    player: PlayerId;
    solo: boolean;
    send: (command: Command) => void;
    ondeckout?: (out: boolean) => void;
    /** The table is watching the map, so the reading waits. */
    paused?: boolean;
  };

  let {
    briefing,
    campaign,
    table,
    player,
    solo,
    send,
    ondeckout,
    paused = false,
  }: Props = $props();

  const steps = $derived(openings(briefing));
  const progress = $derived(table.briefing);
  const hasLegacy = $derived(steps.some((step) => step.from.t === "legacy"));
  const drawn = $derived(Math.min(progress.drawn, steps.length));
  const flipped = $derived(progress.flipped);
  const remaining = $derived(Math.max(0, steps.length - drawn));
  const current = $derived<Opening | null>(drawn > 0 ? (steps[drawn - 1] ?? null) : null);
  // What an opening changes on the map is shown once its story has been told, as a step of its own (`charted`).
  const needsChart = $derived(
    !progress.stowing && flipped && !progress.charted && current !== null && changesMap(current),
  );
  const canDraw = $derived(
    !progress.stowing && remaining > 0 && (drawn === 0 || (flipped && !needsChart)),
  );
  const needsFlip = $derived(!progress.stowing && drawn > 0 && !flipped);
  const allDrawn = $derived(steps.length > 0 && drawn >= steps.length && flipped && !needsChart);

  let dismissedStep = $state<number | null>(null);
  const activeStory = $derived(
    current && flipped && !progress.stowing && !paused && dismissedStep !== drawn
      ? sceneForOpening(current, campaign)
      : null,
  );
  let storyStage = $state<StoryStage>();
  let prevDrawn = 0;
  let prevFlipped = false;
  $effect(() => {
    const d = drawn;
    const f = flipped;
    const cur = current;
    if (d !== prevDrawn) {
      dismissedStep = null;
      tip = null;
    }
    if (d > prevDrawn) {
      sfxCardDraw();
    } else if (d === prevDrawn && f && !prevFlipped && cur) {
      if (cur.from.t === "seal") {
        if (cur.from.seal.t === "package") sfxCrateOpen();
        else sfxDoorTear();
      } else {
        sfxCardFlip();
        if (cur.seals.some((s) => s.t === "door")) setTimeout(() => sfxDoorTear(), 260);
        else if (cur.seals.some((s) => s.t === "package")) setTimeout(() => sfxCrateOpen(), 260);
      }
    }
    prevDrawn = d;
    prevFlipped = f;
  });
  const laid = $derived(wings(steps.slice(0, Math.max(0, drawn - 1))));
  const spotlit = $derived(current ? piecesOf(current, drawn - 1) : []);
  const spotCard = $derived(spotlit.find((placed) => placed.piece.t === "card")?.piece ?? null);
  const spotGroups = $derived(groupPieces(spotlit.filter((placed) => placed.piece.t === "unlock")));

  let tip = $state<{ text: string; style: string } | null>(null);
  function showTip(piece: Piece | null, at?: HTMLElement) {
    if (!piece || !at || !root) {
      tip = null;
      return;
    }
    const box = root.getBoundingClientRect();
    const rect = at.getBoundingClientRect();
    const gap = 10;
    const width = 320;
    const x =
      rect.right + gap + width <= box.right
        ? `left: ${rect.right - box.left + gap}px`
        : `left: ${Math.max(gap, rect.left - box.left - gap - width)}px`;
    const y =
      rect.top - box.top < box.height / 2
        ? `top: ${rect.top - box.top}px`
        : `bottom: ${box.bottom - rect.bottom}px`;
    tip = { text: piece.tip, style: `${x}; ${y}; width: ${width}px` };
  }

  const objectives = $derived(
    pack.objectives.filter((objective) => campaign.objectives.includes(objective.id)),
  );
  const objectiveSteps = $derived(
    new Set(
      steps.flatMap((step, index) =>
        step.items.some((item) => item.unlock.t === "objectives") ? [index] : [],
      ),
    ),
  );
  const showObjectives = $derived(
    [...objectiveSteps].some((idx) => idx < drawn - 1 || (idx === drawn - 1 && flipped)),
  );

  const nextDeckCard = $derived.by(() => {
    const nextStep = steps[drawn];
    const fromStep = nextStep ? legacyCardOf(nextStep) : null;
    if (fromStep) return fromStep;
    return (
      pack.legacyDeck[campaign.legacyIndex] ?? pack.legacyDeck[pack.legacyDeck.length - 1] ?? null
    );
  });
  const deckCount = $derived(
    remaining > 0 ? remaining : pack.legacyDeck.length - campaign.legacyIndex,
  );

  function fromLegacyDeck(node: HTMLElement) {
    if (still) return { duration: 120, css: (t: number) => `opacity: ${t};` };
    const deck = deckEl ?? root?.querySelector<HTMLElement>('[data-testid="legacy-draw-deck"]');
    const from = deck?.getBoundingClientRect();
    const to = node.getBoundingClientRect();
    const dx = from && to.width ? from.left + from.width / 2 - (to.left + to.width / 2) : 0;
    const dy = from && to.height ? from.top + from.height / 2 - (to.top + to.height / 2) : -120;
    const sx = from && to.width ? Math.min(0.65, Math.max(0.28, from.width / to.width)) : 0.45;
    const sy = from && to.height ? Math.min(0.65, Math.max(0.28, from.height / to.height)) : 0.45;
    return {
      duration: 540,
      easing: cubicOut,
      css: (t: number, u: number) => {
        const scaleX = sx + (1 - sx) * t;
        const scaleY = sy + (1 - sy) * t;
        const rot = -5 * u;
        return `transform: translate(${dx * u}px, ${dy * u}px) scale(${scaleX}, ${scaleY}) rotate(${rot}deg); opacity: ${Math.min(1, t * 1.45)};`;
      },
    };
  }

  const players = $derived(tablePlayers(table));
  const multi = $derived(!solo && players.length > 1);
  const myReady = $derived(progress.ready.includes(player));
  const voters = $derived(multi ? tableVoters(table, (who) => progress.ready.includes(who)) : []);
  const waitingOn = $derived(stillWaiting(voters, player));

  const still =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, still ? Math.min(ms, 80) : ms));

  let root = $state<HTMLElement>();
  let deckEl = $state<HTMLElement>();
  let trashEl = $state<HTMLElement>();
  let deckReturned = $state(false);
  let stowStarted = false;
  let full = $state(false);
  let destroyed = false;

  keep(
    "unboxing",
    () => ({ full }),
    (saved) => {
      full = saved.full;
    },
  );

  function step() {
    if (progress.stowing || allDrawn) return;
    send({ type: "BRIEFING_STEP" });
  }

  function toggleReady() {
    if (!allDrawn || progress.stowing) return;
    send({ type: "BRIEFING_READY", player, ready: !myReady });
  }

  onMount(async () => {
    if (!hasLegacy) return;
    ondeckout?.(true);
    await tick();
    const source = destination("legacyDeck");
    if (!source || !deckEl || still) return;
    const from = source.getBoundingClientRect();
    const to = deckEl.getBoundingClientRect();
    if (!from.width || !to.width) return;
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const sx = from.width / to.width;
    const sy = from.height / to.height;
    deckEl.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.9 },
        { transform: "translate(0, 0) scale(1, 1)", opacity: 1 },
      ],
      { duration: 680, easing: "cubic-bezier(0.2, 0.9, 0.25, 1.06)", fill: "both" },
    );
  });

  onDestroy(() => {
    destroyed = true;
    ondeckout?.(false);
  });

  $effect(() => {
    if (progress.stowing && !stowStarted) {
      stowStarted = true;
      void runStow();
    }
  });

  // Whichever browser finishes putting the reading away acknowledges it for the whole table, so one that shows no
  // motion takes as long over it as the others take to show theirs.
  const hold = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  async function runStow() {
    tip = null;
    await tick();
    if (destroyed) return;

    // 1. Return the Legacy deck to its slot in the top bar first.
    if (hasLegacy && deckEl && !deckReturned) {
      const target = destination("legacyDeck");
      if (target && !still) {
        const from = deckEl.getBoundingClientRect();
        const to = target.getBoundingClientRect();
        const dx = to.left + to.width / 2 - (from.left + from.width / 2);
        const dy = to.top + to.height / 2 - (from.top + from.height / 2);
        const sx = to.width / Math.max(1, from.width);
        const sy = to.height / Math.max(1, from.height);
        const anim = deckEl.animate(
          [
            { transform: "translate(0, 0) scale(1, 1)", opacity: 1 },
            { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.95 },
          ],
          { duration: 680, easing: "cubic-bezier(0.45, 0, 0.2, 1)", fill: "forwards" },
        );
        await anim.finished.catch(() => {});
      } else if (target) await hold(680);
      if (destroyed) return;
      deckReturned = true;
      ondeckout?.(false);
      const slot = destination("legacyDeck");
      if (slot && !still) {
        slot.animate([{ scale: "1" }, { scale: "1.16" }, { scale: "1" }], {
          duration: 360,
          easing: "cubic-bezier(0.3, 1.6, 0.5, 1)",
        });
      }
      await hold(240);
    }

    // 2. Stow each class of items one at a time, giving new mechanics extra emphasis and time.
    if (root) {
      for (const cls of STOW_ORDER) {
        if (destroyed) return;
        const nodes = [...root.querySelectorAll<HTMLElement>(`[data-stow-class="${cls}"]`)].filter(
          (node) => getComputedStyle(node).visibility !== "hidden",
        );
        if (!nodes.length) continue;

        const isMechanic = cls === "mechanic";
        if (isMechanic && still) await hold(860);
        if (isMechanic && !still) {
          await Promise.all(
            nodes.map((node) => {
              const pulse = node.animate(
                [
                  { transform: "scale(1)", filter: "drop-shadow(0 0 0 rgb(227 178 60 / 0))" },
                  {
                    transform: "scale(1.18)",
                    filter: "drop-shadow(0 0 1.4rem rgb(227 178 60 / 0.95))",
                    offset: 0.55,
                  },
                  {
                    transform: "scale(1.1)",
                    filter: "drop-shadow(0 0 0.8rem rgb(227 178 60 / 0.7))",
                  },
                ],
                { duration: 620, easing: "cubic-bezier(0.2, 0.9, 0.3, 1.1)", fill: "forwards" },
              );
              return pulse.finished.catch(() => {});
            }),
          );
          await hold(240);
        }

        const stagger = isMechanic ? 240 : 90;
        const duration = isMechanic ? 1550 : 880;
        const flights: Promise<void>[] = [];
        nodes.forEach((node, order) => {
          const destNames = (node.dataset.put ?? (cls === "trash" ? "trash" : "box"))
            .split(" ")
            .filter(Boolean);
          const target =
            cls === "trash"
              ? (trashEl ?? destination("trash"))
              : (destination(...destNames) ?? trashEl);
          const delay = order * stagger;
          if (!target || still) {
            node.style.visibility = "hidden";
            if (target) flights.push(hold(delay + duration));
            return;
          }
          flights.push(flyTo(node, target, { delay, duration }));
          setTimeout(() => {
            if (!destroyed) node.style.visibility = "hidden";
          }, delay);
        });
        await Promise.all(flights);
        await hold(isMechanic ? 320 : 200);
      }
    }

    if (!destroyed) send({ type: "ACK_BRIEFING" });
  }
</script>

<svelte:window
  onkeydown={(event) => {
    if (typing(event)) return;
    if (full) {
      if (event.key === "Escape") full = false;
      return;
    }
    // Space on a focused button already presses it.
    if (event.key === " " && !progress.stowing && !paused && !onButton(event)) {
      event.preventDefault();
      if (activeStory && storyStage?.advance()) return;
      if (allDrawn) toggleReady();
      else step();
    }
  }}
/>

{#if full}
  <div class="summary-wrap">
    <Briefing {briefing} {campaign} passive={false} oncontinue={() => (full = false)} />
  </div>
{:else}
  <div
    class="tabletop-unboxing"
    class:stowing={progress.stowing}
    class:narrating={Boolean(activeStory)}
    bind:this={root}
    data-drawn={drawn}
    data-total={steps.length}
    data-flipped={flipped}
    {@attach feedback("Legacy tabletop", () => ({
      drawn,
      of: steps.length,
      flipped,
      stowing: progress.stowing,
      ready: progress.ready,
    }))}
  >
    <!-- Main tabletop spread over the map -->
    <div class="spread">
      <div class="wing" {@attach fitZoom()}>
        <PieceGroups groups={laid.left} {campaign} side="left" ontip={showTip} />
      </div>

      <!-- The Legacy deck (or the package or door pile when no Legacy card is in this briefing) stands over the spotlight, so the wings have the table's full height. -->
      <div class="middle">
        <div class="top-dock">
          {#if hasLegacy && !deckReturned}
            <button
              class="deck-pile"
              class:pulsing={canDraw}
              class:idle={!canDraw}
              bind:this={deckEl}
              disabled={!canDraw && !needsFlip}
              onclick={step}
              data-testid="legacy-draw-deck"
              aria-label={canDraw
                ? `Draw from the Legacy deck (${remaining} left)`
                : needsFlip
                  ? "Flip the drawn card"
                  : "Legacy deck"}
            >
              <span class="stack">
                {#if nextDeckCard}
                  <LegacyCard card={nextDeckCard} side="a" size="deck" {campaign} />
                {:else}
                  <span class="fallback-card">Legacy</span>
                {/if}
              </span>
              <span class="badge">
                {#if canDraw}
                  Draw · {remaining} left
                {:else if needsFlip}
                  Flip card
                {:else}
                  {deckCount} in deck
                {/if}
              </span>
            </button>
          {:else if !hasLegacy && canDraw && !progress.stowing}
            {@const next = steps[drawn]}
            <button
              class="seal-trigger pulsing"
              onclick={step}
              data-testid="legacy-draw-deck"
              aria-label={`Open ${next?.title ?? "package"}`}
            >
              <span class="seal-icon">
                {#if next?.seals[0]?.t === "package"}
                  <Crate id={next.seals[0].id} open={false} />
                {:else if next?.seals[0]?.t === "door"}
                  <DossierDoor id={next.seals[0].id} open={false} />
                {/if}
              </span>
              <span class="badge">Click to open · {next?.title}</span>
            </button>
          {/if}
        </div>

        <!-- Center spotlight: the active card / package / door -->
        <div class="center" {@attach fitZoom()}>
          {#if current}
            {#key drawn}
              {@const cardDef = legacyCardOf(current)}
              {@const firstSeal = cardDef ? null : current.seals[0]}
              {@const moreSeals = cardDef ? current.seals : current.seals.slice(1)}
              <div class="spotlight" in:fromLegacyDeck>
                <div class="spotlight-top">
                  {#if cardDef && spotCard}
                    <button
                      class="flip-card"
                      class:flipped
                      class:clickable={needsFlip}
                      onclick={() => needsFlip && step()}
                      data-testid="legacy-active-card"
                      data-stow-class={flipped ? spotCard.stow.cls : undefined}
                      data-put={spotCard.stow.put}
                      aria-label={needsFlip ? `Flip ${current.title}` : current.title}
                    >
                      <span class="flipper" class:flipped>
                        <span class="card-side front">
                          <LegacyCard card={cardDef} side="a" size="full" {campaign} />
                        </span>
                        <span class="card-side back-face">
                          <LegacyCard card={cardDef} side="b" size="full" {campaign} />
                        </span>
                      </span>
                      {#if needsFlip}
                        <span class="flip-hint">Click to flip</span>
                      {/if}
                    </button>
                  {:else if firstSeal}
                    <button
                      class="seal-spotlight"
                      class:clickable={needsFlip}
                      onclick={() => needsFlip && step()}
                      data-testid="legacy-active-card"
                      aria-label={needsFlip ? `Open ${current.title}` : current.title}
                    >
                      <span
                        class="big-shell {firstSeal.t}"
                        data-stow-class={flipped ? "trash" : undefined}
                        data-put="trash"
                      >
                        {#if firstSeal.t === "package"}
                          <Crate id={firstSeal.id} open={flipped} />
                        {:else}
                          <DossierDoor id={firstSeal.id} open={flipped} tearing={flipped} />
                        {/if}
                      </span>
                      {#if needsFlip}<span class="flip-hint">Click to open</span>{/if}
                    </button>
                  {:else}
                    <button
                      class="note-spotlight"
                      class:clickable={needsFlip}
                      onclick={() => needsFlip && step()}
                      data-testid="legacy-active-card"
                      data-stow-class={flipped ? "trash" : undefined}
                      data-put="trash"
                      aria-label={needsFlip ? `Reveal ${current.title}` : current.title}
                    >
                      <strong>{current.title}</strong>
                      {#if flipped && current.text}<span><RichText text={current.text} /></span
                        >{/if}
                      {#if needsFlip}<span class="flip-hint">Click to reveal</span>{/if}
                    </button>
                  {/if}

                  {#if flipped && moreSeals.length}
                    <div class="opened-seals" in:scale={{ start: 0.8, duration: 380 }}>
                      {#each moreSeals as seal, sIdx (`${seal.t}:${seal.id}:${sIdx}`)}
                        <span class="med-shell {seal.t}" data-stow-class="trash" data-put="trash">
                          {#if seal.t === "package"}
                            <Crate id={seal.id} open={true} />
                          {:else}
                            <DossierDoor id={seal.id} open={true} tearing={true} />
                          {/if}
                        </span>
                      {/each}
                    </div>
                  {/if}
                </div>

                <!-- What came out stands beside the card, never under it, each piece once and its meaning on hover. -->
                <div class="spotlight-side">
                  {#if flipped}
                    <div class="caption-plate" in:fade={{ duration: 240 }}>
                      <h2>{current.title}</h2>
                      {#if current.text && !cardDef}<p><RichText text={current.text} /></p>{/if}
                    </div>
                    <PieceGroups groups={spotGroups} {campaign} side="spotlight" ontip={showTip} />
                  {/if}
                </div>
              </div>
            {/key}
          {/if}
        </div>
      </div>

      <div class="wing" {@attach fitZoom()}>
        <PieceGroups groups={laid.right} {campaign} side="right" ontip={showTip} />
      </div>
    </div>

    {#if showObjectives && objectives.length}
      <div class="table-objectives" in:fly={{ y: 20, duration: 360 }}>
        {#each objectives as objective (objective.id)}
          <span class="obj-tag" data-brief-objective={objective.id}
            ><ObjectiveTag {objective} /></span
          >
        {/each}
      </div>
    {/if}

    {#if tip}
      <div class="piece-tip" role="tooltip" style={tip.style} transition:fade={{ duration: 120 }}>
        <RichText text={tip.text} />
      </div>
    {/if}

    {#if activeStory}
      <StoryStage
        bind:this={storyStage}
        scene={activeStory}
        overlay
        delivered={campaign.sampleDelivered}
        ondone={() => {
          if (allDrawn || needsChart) dismissedStep = drawn;
          else step();
        }}
        onclose={() => {
          dismissedStep = drawn;
        }}
      />
    {/if}

    <!-- Bottom action bar: Trash receptacle + Done button with multiplayer agreement -->
    <footer class="bottom-bar">
      <span
        class="trash"
        class:active={progress.stowing}
        bind:this={trashEl}
        data-dest="trash"
        aria-label="Trash"
        role="img"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
        </svg>
      </span>

      <div class="controls">
        {#if allDrawn && !progress.stowing}
          <VoteButton
            label="Done"
            tally="done"
            {voters}
            on={myReady}
            onclick={toggleReady}
            testid="ack-briefing"
          />
          {#if progress.ready.length && waitingOn.length}
            <span class="waiting">Waiting for {waitingOn.join(", ")}</span>
          {/if}
        {:else if needsChart && !activeStory}
          <button class="chart-btn" onclick={step} data-testid="briefing-chart">
            Show on the map<Beacon gap="0.15rem" />
          </button>
        {:else if !progress.stowing}
          <span class="prompt">
            {#if canDraw}
              Click the Legacy deck to draw ({remaining} remaining)
            {:else if needsFlip}
              Click the card to flip it over
            {/if}
          </span>
        {/if}
      </div>

      {#if !progress.stowing && allDrawn}
        <button class="summary-btn" onclick={() => (full = true)}>Read summary</button>
      {/if}
    </footer>
  </div>
{/if}

<style>
  .summary-wrap {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
  }

  .tabletop-unboxing {
    position: relative;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto auto;
    width: 100%;
    height: 100%;
    padding: 0.6rem 1.2rem 1rem;
    color: var(--ink);
    pointer-events: auto;
  }

  .middle {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .top-dock {
    display: flex;
    flex: none;
    justify-content: center;
    align-items: flex-start;
    min-height: 11.4rem;
    z-index: 4;
  }

  .deck-pile,
  .seal-trigger {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--ink);
    font: inherit;
    cursor: pointer;
    transition: transform 220ms ease;
  }

  .deck-pile:disabled {
    cursor: default;
  }

  .deck-pile.pulsing,
  .seal-trigger.pulsing {
    animation: deckPulse 1.7s ease-in-out 4;
  }

  .deck-pile.pulsing:hover,
  .seal-trigger.pulsing:hover {
    transform: scale(1.06);
  }

  @keyframes deckPulse {
    0%,
    100% {
      transform: scale(1);
      filter: drop-shadow(0 0.4rem 1.1rem rgb(227 178 60 / 0.35));
    }
    50% {
      transform: scale(1.06);
      filter: drop-shadow(0 0.6rem 1.8rem rgb(227 178 60 / 0.85));
    }
  }

  .stack {
    display: inline-flex;
    border-radius: 6px;
    box-shadow:
      3px 3px 0 #c9bc9c,
      6px 6px 0 #8f8266,
      0 0.9rem 2rem rgb(0 0 0 / 0.65);
  }

  .fallback-card {
    display: grid;
    place-items: center;
    width: 7rem;
    height: 9.6rem;
    border-radius: 5px;
    background: linear-gradient(160deg, #3d3326, #241d14);
    font-family: var(--font-display);
  }

  .seal-icon {
    width: 9rem;
  }

  .badge {
    padding: 0.2rem 0.7rem;
    border-radius: 999px;
    background: rgb(16 13 10 / 0.86);
    border: 1px solid rgb(227 178 60 / 0.55);
    color: var(--paper);
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .deck-pile.idle .badge {
    border-color: var(--line);
    color: var(--muted);
  }

  /* Every column is sized by the table, never by what lies in it, so each can zoom its pieces to fit (`fitZoom`)
	   and a reading of any size shows whole, with nothing to scroll. */
  .spread {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 2.4fr) minmax(0, 1fr);
    gap: 1.2rem;
    min-height: 0;
  }

  .wing {
    display: flex;
    flex-direction: column;
    justify-content: safe center;
    min-height: 0;
    overflow: hidden;
  }

  .center {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: safe center;
    justify-content: safe center;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    padding: 0.4rem;
    transition: padding-bottom 280ms ease;
  }

  .narrating .center {
    padding-bottom: 8.5rem;
  }

  .spotlight {
    display: flex;
    align-items: center;
    gap: 1.4rem;
  }

  .spotlight-side {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.7rem;
    flex: 1 1 22rem;
    min-width: 18rem;
    max-width: 44rem;
  }

  .spotlight-top {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.2rem;
  }

  .flip-card,
  .seal-spotlight {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    cursor: default;
    perspective: 1200px;
  }

  .flip-card.clickable,
  .seal-spotlight.clickable,
  .note-spotlight.clickable {
    cursor: pointer;
  }

  .note-spotlight {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    max-width: 24rem;
    padding: 1.2rem 1.6rem;
    border: 1px solid rgb(231 220 198 / 0.35);
    border-radius: 6px;
    background: rgb(22 18 14 / 0.9);
    color: var(--paper);
    font: inherit;
    box-shadow: 0 1.2rem 2.8rem rgb(0 0 0 / 0.6);
  }

  .note-spotlight strong {
    font-family: var(--font-display);
    font-size: 1.6rem;
    font-weight: 400;
  }

  .flip-card.clickable:hover .flipper,
  .seal-spotlight.clickable:hover {
    transform: translateY(-4px) scale(1.02);
  }

  .flipper {
    display: grid;
    place-items: center;
    transform-style: preserve-3d;
    transition: transform 640ms cubic-bezier(0.2, 0.9, 0.3, 1.08);
  }

  .flipper.flipped {
    transform: rotateY(180deg);
  }

  .card-side {
    grid-area: 1 / 1;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }

  .card-side.back-face {
    transform: rotateY(180deg);
  }

  .card-side :global(.legacy-card) {
    box-shadow: 0 1.4rem 3.2rem rgb(0 0 0 / 0.65);
  }

  .flip-card.clickable .card-side.front :global(.legacy-card) {
    box-shadow:
      0 0 0 2px rgb(227 178 60 / 0.8),
      0 1.4rem 3.2rem rgb(0 0 0 / 0.65);
  }

  .flip-hint {
    padding: 0.25rem 0.85rem;
    border-radius: 999px;
    background: var(--paper);
    color: var(--paper-ink);
    font-size: 0.85rem;
    font-weight: 700;
    box-shadow: 0 0.4rem 1.2rem rgb(0 0 0 / 0.5);
  }

  .big-shell.package {
    width: 10rem;
    font-size: 1.5rem;
  }

  .big-shell.door {
    width: 6.5rem;
    font-size: 1.6rem;
  }

  /* Three doors to a column, so a card that opens five stays no taller than the card. */
  .opened-seals {
    display: grid;
    grid-template-rows: repeat(3, auto);
    grid-auto-flow: column;
    gap: 0.6rem;
  }

  .med-shell.package {
    width: 6.5rem;
    font-size: 1.1rem;
  }

  .med-shell.door {
    width: 3.8rem;
    font-size: 1.1rem;
  }

  .caption-plate {
    padding: 0.35rem 1rem;
    border-radius: 6px;
    background: rgb(16 13 10 / 0.88);
    text-align: center;
  }

  .caption-plate h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 400;
    color: var(--paper);
  }

  .caption-plate p {
    margin: 0.2rem 0 0;
    color: var(--muted);
    font-size: 0.88rem;
  }

  .piece-tip {
    position: absolute;
    z-index: 6;
    padding: 0.6rem 0.8rem;
    border: 1px solid rgb(231 220 198 / 0.35);
    border-radius: 6px;
    background: rgb(16 13 10 / 0.95);
    box-shadow: 0 0.8rem 2rem rgb(0 0 0 / 0.55);
    color: var(--ink);
    font-size: 0.88rem;
    line-height: 1.4;
    pointer-events: none;
  }

  .table-objectives {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.6rem;
    padding-top: 0.5rem;
    z-index: 4;
  }

  .obj-tag {
    display: flex;
    font-size: 1.05rem;
    box-shadow: 0 0.6rem 1.4rem rgb(0 0 0 / 0.5);
  }

  .bottom-bar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 1rem;
    padding-top: 0.5rem;
    z-index: 4;
  }

  .trash {
    justify-self: start;
    display: grid;
    place-items: center;
    width: 2.8rem;
    height: 2.8rem;
    border: 1px solid rgb(231 220 198 / 0.2);
    border-radius: 50%;
    background: rgb(22 18 14 / 0.85);
    color: var(--muted);
    opacity: 0.65;
    transition:
      opacity 250ms ease,
      transform 250ms ease;
  }

  .trash.active {
    opacity: 1;
    transform: scale(1.1);
    border-color: rgb(231 220 198 / 0.5);
    color: var(--paper);
  }

  .trash svg {
    width: 1.5rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
  }

  .waiting,
  .prompt {
    padding: 0.25rem 0.8rem;
    border-radius: 999px;
    background: rgb(16 13 10 / 0.78);
    color: var(--paper);
    font-size: 0.85rem;
  }

  .chart-btn {
    position: relative;
    padding: 0.45rem 1.2rem;
    border: 1px solid rgb(227 178 60 / 0.6);
    border-radius: 3px;
    background: rgb(18 15 11 / 0.9);
    color: var(--paper);
    font: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
  }

  .chart-btn:hover {
    border-color: var(--paper);
  }

  .summary-btn {
    justify-self: end;
    padding: 0.35rem 0.9rem;
    border: 1px solid rgb(231 220 198 / 0.35);
    border-radius: 3px;
    background: rgb(18 15 11 / 0.78);
    color: var(--ink);
    font: inherit;
    font-size: 0.82rem;
    cursor: pointer;
  }

  .summary-btn:hover {
    border-color: var(--paper);
  }
</style>
