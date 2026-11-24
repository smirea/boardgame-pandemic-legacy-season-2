<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import type { CardId, PlayerCard as Card, SeatId } from "@repo/game";
  import { cubicOut } from "svelte/easing";
  import { scale } from "svelte/transition";
  import type { Attachment } from "svelte/attachments";
  import PlayerCard from "./PlayerCard.svelte";
  import { FLIP_MS } from "./turnShow.svelte.ts";
  import type { Reveal } from "./turnShow.svelte.ts";

  type Props = {
    /** Player cards just drawn: each is shown beside the deck, then flies to the hand that drew it. */
    reveals: Reveal[];
    /** An Epidemic that was drawn and waits to be started. It stays beside the deck. */
    epidemic: Card | null;
    /** This browser's player is the one who starts the Epidemic. */
    canStart: boolean;
    onstart: () => void;
    onlanded: (key: number) => void;
    /** Where a card ends up on this screen: its place in the hand shown, or the seat of whoever drew it. */
    dest: (card: CardId, seat: SeatId) => Element | null;
  };

  let { reveals, epidemic, canStart, onstart, onlanded, dest }: Props = $props();

  const FLIGHT_MS = 560;
  const box = (selector: string) =>
    document.querySelector(selector)?.getBoundingClientRect() ?? null;

  /** Stands the card on the desk's open place beside the deck, its foot level with the deck's. */
  const onDesk: Attachment<HTMLElement> = (node) => {
    const slot = box("[data-turn-slot]");
    if (!slot) return;
    node.style.left = `${slot.left + (slot.width - node.offsetWidth) / 2}px`;
    node.style.top = `${slot.bottom - node.offsetHeight}px`;
  };

  /** The card leaves the deck face down and turns over as it comes to rest beside it. */
  function flipIn(node: HTMLElement) {
    const pile = box("[data-turn-deck]");
    const card = node.getBoundingClientRect();
    const dx = pile ? pile.left + pile.width / 2 - (card.left + card.width / 2) : 0;
    const dy = pile ? pile.top + pile.height / 2 - (card.top + card.height / 2) : 0;
    const start = pile ? Math.min(1, pile.height / Math.max(1, card.height)) : 0.8;
    return {
      duration: FLIP_MS,
      easing: cubicOut,
      css: (t: number, u: number) =>
        `transform: translate(${dx * u}px, ${dy * u}px) scale(${start + (1 - start) * t}); --turn: ${u * 180}deg`,
    };
  }

  /** Once its moment beside the deck is over, the card floats to the hand that drew it and is handed over there. */
  const depart =
    (reveal: Reveal): Attachment<HTMLElement> =>
    (node) => {
      if (reveal.stage !== "leaving") return;
      const from = node.getBoundingClientRect();
      const target = dest(reveal.card.id, reveal.seat)?.getBoundingClientRect();
      const dx = target ? target.left + target.width / 2 - (from.left + from.width / 2) : 0;
      const dy = target ? target.top + target.height / 2 - (from.top + from.height / 2) : -40;
      // A place in a hand takes the card whole. A seat's pile of cards is small, so the card shrinks into it.
      const whole = target !== undefined && target.height > from.height * 0.6;
      const size = target ? Math.max(0.16, Math.min(1.3, target.height / from.height)) : 0.6;
      const lift = Math.min(70, Math.hypot(dx, dy) * 0.12);
      const flight = node.animate(
        [
          { transform: "none", opacity: 1 },
          {
            transform: `translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) scale(${(1 + size) / 2}) rotate(${dx > 0 ? 5 : -5}deg)`,
            opacity: 1,
          },
          { transform: `translate(${dx}px, ${dy}px) scale(${size})`, opacity: whole ? 1 : 0.25 },
        ],
        { duration: FLIGHT_MS, easing: "cubic-bezier(0.35, 0, 0.2, 1)", fill: "forwards" },
      );
      const key = reveal.key;
      flight.onfinish = () => onlanded(key);
      return () => flight.cancel();
    };
</script>

<div
  class="flights"
  {@attach feedback("Drawn cards", () => ({ shown: reveals.length, epidemic: epidemic !== null }))}
>
  {#each reveals as reveal (reveal.key)}
    <div
      class="drawn"
      data-testid="drawn-card"
      data-card={reveal.card.id}
      {@attach onDesk}
      {@attach depart(reveal)}
      in:flipIn
    >
      <div class="turner">
        <div class="face"><PlayerCard card={reveal.card} /></div>
        <div class="back" aria-hidden="true"><span>✦</span></div>
      </div>
    </div>
  {/each}
  {#if epidemic}
    <div
      class="drawn epidemic"
      class:mine={canStart}
      data-testid="epidemic-drawn"
      {@attach onDesk}
      in:flipIn
      out:scale={{ start: 1.5, duration: 260, opacity: 0 }}
    >
      <div class="turner">
        <div class="face">
          <PlayerCard
            card={epidemic}
            tone={canStart ? "play" : null}
            onclick={canStart ? onstart : undefined}
          />
        </div>
        <div class="back" aria-hidden="true"><span>✦</span></div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Over everything on the table, since a card crosses the board and the panels on its way to a hand. */
  .flights {
    position: fixed;
    inset: 0;
    z-index: 70;
    pointer-events: none;
    --card-size: 0.95rem;
  }

  .drawn {
    position: fixed;
    left: -100rem;
    top: 0;
    perspective: 50rem;
    --turn: 0deg;
  }

  /* The transition turns the card over by setting `--turn`, so the face and the back stay one piece. */
  .turner {
    position: relative;
    transform: rotateY(var(--turn));
    transform-style: preserve-3d;
  }

  .face {
    backface-visibility: hidden;
  }

  .back {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    border: 2px solid rgb(244 232 205 / 0.55);
    border-radius: 0.5rem;
    background: repeating-linear-gradient(135deg, #5d5446 0 0.4rem, #544b3e 0.4rem 0.8rem);
    color: #f4e8cd;
    font-size: 2.4rem;
    transform: rotateY(180deg);
    backface-visibility: hidden;
  }

  .epidemic {
    pointer-events: auto;
  }

  /* A few beats and then a steady glow: a pulse that never ends keeps the whole page drawing (see AGENTS.md). */
  .epidemic .face {
    border-radius: 0.6rem;
    box-shadow:
      0 0 0 0.2rem rgb(214 60 44 / 0.85),
      0 0 1.8rem rgb(214 60 44 / 0.7);
    animation: alarm 1.2s ease-in-out 8;
  }

  .epidemic.mine .face {
    cursor: pointer;
  }

  @keyframes alarm {
    0%,
    100% {
      transform: none;
      box-shadow:
        0 0 0 0.2rem rgb(214 60 44 / 0.85),
        0 0 1.8rem rgb(214 60 44 / 0.7);
    }
    50% {
      transform: scale(1.06);
      box-shadow:
        0 0 0 0.3rem rgb(255 110 84 / 0.95),
        0 0 3.2rem rgb(255 90 64 / 0.9);
    }
  }
</style>
