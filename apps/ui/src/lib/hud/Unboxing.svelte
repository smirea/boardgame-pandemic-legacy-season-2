<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import { changesMap, openings, pack, tablePlayers } from "@repo/game";
  import type { BriefingEntry, Campaign, Command, Opening, PlayerId, Table } from "@repo/game";
  import { onDestroy, onMount, tick, untrack } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { SvelteMap, SvelteSet } from "svelte/reactivity";
  import Beacon from "#lib/Beacon.svelte";
  import LegacyCard from "#lib/cards/LegacyCard.svelte";
  import { sfxCardDraw, sfxCardFlip, sfxCrateOpen, sfxDoorTear } from "#lib/audio/sfx.ts";
  import { sceneForOpening } from "#lib/story/script.ts";
  import StoryStage from "#lib/story/StoryStage.svelte";
  import Briefing from "./Briefing.svelte";
  import { jobFigure } from "#lib/characters/figures.ts";
  import Crate from "./Crate.svelte";
  import DossierDoor from "./DossierDoor.svelte";
  import { destination, flyTo } from "./flight.ts";
  import Newcomer, { type Arrival } from "./Newcomer.svelte";
  import ObjectiveTag from "./ObjectiveTag.svelte";
  import RichText from "./RichText.svelte";
  import UnboxPiece, { isRule, scaleOf } from "./UnboxPiece.svelte";
  import { legacyCardOf, piecesOf, STOW_ORDER, type Piece, type Placed } from "./unboxPieces.ts";
  import { assignSides, layoutTable, type Box, type Sized } from "./unboxLayout.ts";
  import { readingExit } from "./readingExit.ts";
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

  const still =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  let dismissedStep = $state<number | null>(null);
  // A character the box brings stands over the whole table and says hello once its package or door has opened; the
  // next press steps it down into its place among the pieces, and only then is the story read. One already opened
  // when the table sat down (a reload) does not stand up again.
  const landed = new SvelteSet<string>();
  const arrivals = $derived(
    current && flipped && !progress.stowing
      ? arrivalsOf(current, drawn - 1).filter((entry) => !landed.has(entry.key))
      : [],
  );
  for (const entry of untrack(() => arrivals)) landed.add(entry.key);

  /*
   * Each opening plays as one sequence, and only a press moves it on: the press that draws a card sends what lay in
   * the middle aside before the card arrives; the press that turns it over turns it, then tears open each package or
   * door it opens one after another, then lets what came out come out one piece at a time, and leaves it all a moment
   * to breathe. Only then does a new character stand up, and the story waits for a press of its own, so a set piece
   * never plays over the reveal. A press while a sequence plays does nothing.
   */
  const TURN = 800;
  const SEAL_GAP = 560;
  const PIECE_GAP = 140;
  const PIECE_FLIGHT = 640;
  const BREATHE = 600;
  const ASIDE_GAP = 60;
  /** When each piece of the opening being read comes out, after the press that turned it over. */
  let plan = new Map<string, number>();
  let flippedAt = 0;
  let mainAt = 0;
  /** The opening whose card has arrived, and the one whose reveal has played out. */
  let arrived = $state(untrack(() => drawn));
  let revealed = $state<number | null>(untrack(() => (flipped ? drawn : null)));
  /** The opening whose story the table asked for, and the one whose story has come in once the table made room. */
  let asked = $state<number | null>(null);
  let shown = $state<number | null>(null);
  let timers: ReturnType<typeof setTimeout>[] = [];
  const later = (ms: number, run: () => void) => {
    if (still) run();
    else timers.push(setTimeout(run, ms));
  };
  /** Runs once nothing on the table is moving any more, however slowly this browser drew it there. */
  function whenStill(run: () => void) {
    const check = () => {
      if (destroyed) return;
      const moving = [...(tableEl?.querySelectorAll<HTMLElement>("[data-piece]") ?? [])].some(
        (node) => node.getAnimations().some((animation) => animation.playState === "running"),
      );
      if (moving) timers.push(setTimeout(check, 100));
      else run();
    };
    check();
  }

  const story = $derived(current && flipped ? sceneForOpening(current, campaign) : null);
  const showing = $derived(current !== null && flipped && revealed !== drawn);
  const arrival = $derived(revealed === drawn ? (arrivals[0] ?? null) : null);
  const storyWaits = $derived(
    story !== null &&
      revealed === drawn &&
      !arrivals.length &&
      asked !== drawn &&
      dismissedStep !== drawn &&
      !progress.stowing,
  );
  const reading = $derived(
    story !== null && asked === drawn && dismissedStep !== drawn && !progress.stowing,
  );
  const activeStory = $derived(
    reading && shown === drawn && !paused && !arrivals.length ? story : null,
  );
  /** The table steps up out of the way of the story's panel first, and the story comes in after it. */
  function readOn() {
    const d = drawn;
    asked = d;
    later(650, () => (shown = d));
  }
  /** Everything the opening being read has to show has been shown. */
  const settled = $derived(
    drawn === 0 ||
      (arrived === drawn &&
        !showing &&
        !arrivals.length &&
        (story === null || dismissedStep === drawn || !flipped)),
  );
  let storyStage = $state<StoryStage>();
  let staging = $state(false);
  let prevDrawn = untrack(() => drawn);
  let prevFlipped = untrack(() => flipped);
  $effect(() => {
    const d = drawn;
    const f = flipped;
    const cur = current;
    if (d !== prevDrawn) {
      dismissedStep = null;
      tip = null;
      peek = null;
    }
    if (d > prevDrawn) {
      timers.forEach(clearTimeout);
      timers = [];
      sfxCardDraw();
      const before = steps[d - 2];
      const aside = before ? piecesOf(before, d - 2).length : 0;
      const wait = aside ? (aside - 1) * ASIDE_GAP + 560 : 0;
      mainAt = performance.now() + (still ? 0 : wait);
      later(wait + 720, () => (arrived = d));
    } else if (d < prevDrawn) {
      arrived = d;
      revealed = f ? d : null;
    } else if (f && !prevFlipped && cur) {
      timers.forEach(clearTimeout);
      timers = [];
      flippedAt = performance.now();
      if (cur.from.t === "seal") {
        if (cur.from.seal.t === "package") sfxCrateOpen();
        else sfxDoorTear();
      } else sfxCardFlip();
      const rest = piecesOf(cur, d - 1).slice(1);
      const seals = rest.filter(({ piece }) => piece.t === "seal");
      const pieces = rest.filter(({ piece }) => piece.t !== "seal");
      plan = new Map();
      seals.forEach(({ piece }, i) => {
        const at = TURN + i * SEAL_GAP;
        plan.set(piece.key, at);
        if (piece.t === "seal") later(at, piece.seal.t === "package" ? sfxCrateOpen : sfxDoorTear);
      });
      const out = TURN + seals.length * SEAL_GAP + (seals.length ? 200 : 0);
      pieces.forEach(({ piece }, i) => plan.set(piece.key, out + i * PIECE_GAP));
      const end = pieces.length
        ? out + (pieces.length - 1) * PIECE_GAP + PIECE_FLIGHT
        : seals.length
          ? TURN + seals.length * SEAL_GAP
          : TURN;
      later(end, () => whenStill(() => later(BREATHE, () => (revealed = d))));
    }
    prevDrawn = d;
    prevFlipped = f;
  });

  function arrivalsOf(opening: Opening, at: number): Arrival[] {
    return piecesOf(opening, at).flatMap(({ piece }) => {
      if (piece.t !== "unlock" || piece.unlock.t !== "job") return [];
      const job = piece.unlock.job;
      const figure = jobFigure(job);
      if (!figure) return [];
      const def = pack.jobs.find((entry) => entry.id === job)!;
      return [
        {
          key: piece.key,
          job,
          figure,
          occupation: def.name,
          text: def.text,
          home: piece.unlock.home,
          character:
            Object.values(campaign.characters).findLast(
              (character) => character.job === job && !character.dead,
            ) ?? null,
        },
      ];
    });
  }

  let newcomerEl = $state<HTMLElement>();
  let landing = $state(false);

  // A character is stepped down only once it has stood up in full and its Next has come in.
  const STAND = 1500;
  let stoodAt = 0;
  const standing = $derived(arrival?.key ?? null);
  $effect(() => {
    if (standing) stoodAt = performance.now();
  });

  /** The character steps down from over the table into its piece, and the reading goes on. */
  async function land() {
    const now = arrival;
    if (!now || landing || (!still && performance.now() - stoodAt < STAND)) return;
    landing = true;
    const from = newcomerEl?.querySelector<HTMLElement>(".figure");
    const to = root?.querySelector(`[data-piece="${now.key}"]`);
    if (from && to && !still) {
      const flight = flyTo(from, to, { duration: 1000 });
      from.style.visibility = "hidden";
      await flight;
    }
    landing = false;
    if (!destroyed) landed.add(now.key);
  }

  // Every piece of every opening read so far, each where it was opened. The opening being read shows only what is
  // to be opened until it is.
  type Item = { placed: Placed; at: number; main: boolean; current: boolean };
  const items = $derived.by(() => {
    const out: Item[] = [];
    steps.slice(0, drawn).forEach((opening, at) => {
      const isCurrent = at === drawn - 1;
      piecesOf(opening, at).forEach((placed, index) => {
        if (isCurrent && !flipped && index > 0) return;
        out.push({ placed, at, main: index === 0, current: isCurrent });
      });
    });
    return out;
  });

  const sizes = new SvelteMap<string, { w: number; h: number }>();
  const sizer =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver((entries) => {
          for (const entry of entries) {
            const node = entry.target as HTMLElement;
            const key = node.dataset.piece;
            if (!key) continue;
            const w = node.offsetWidth;
            const h = node.offsetHeight;
            const was = sizes.get(key);
            if (w && h && (!was || was.w !== w || was.h !== h)) sizes.set(key, { w, h });
          }
        });
  function measure(node: HTMLElement) {
    sizer?.observe(node);
    return () => sizer?.unobserve(node);
  }

  let tableEl = $state<HTMLElement>();
  let headEl = $state<HTMLElement>();
  let room = $state<{ width: number; height: number; deck: Box | null }>({
    width: 0,
    height: 0,
    deck: null,
  });
  $effect(() => {
    const element = tableEl;
    const head = headEl;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      room = {
        width: element.clientWidth,
        height: element.clientHeight,
        deck:
          head && head.offsetHeight
            ? { x: head.offsetLeft, y: head.offsetTop, w: head.offsetWidth, h: head.offsetHeight }
            : null,
      };
    });
    observer.observe(element);
    if (head) observer.observe(head);
    return () => observer.disconnect();
  });

  // The story's panel stands over the foot of the table while it is read, so the opening steps up above it.
  // It only grows while a story is read, so a longer line never shuffles the table under it.
  let storyRoom = $state(0);
  let roomGuess = 250;
  $effect(() => {
    if (!reading) storyRoom = 0;
    else storyRoom = Math.max(untrack(() => storyRoom), roomGuess);
  });
  $effect(() => {
    const host = root;
    const table = tableEl;
    if (!activeStory || !host || !table) return;
    let observer: ResizeObserver | null = null;
    const timer = setTimeout(() => {
      const dock = host.querySelector<HTMLElement>(".dialogue-dock");
      const stage = dock?.offsetParent;
      if (!dock || !stage) return;
      // Read from where it stands, not where its entrance has carried it so far.
      const update = () => {
        const top =
          stage.getBoundingClientRect().bottom -
          parseFloat(getComputedStyle(dock).bottom) -
          dock.offsetHeight;
        const room = Math.max(0, Math.round(table.getBoundingClientRect().bottom - top + 12));
        roomGuess = room;
        storyRoom = Math.max(untrack(() => storyRoom), room);
      };
      update();
      observer = new ResizeObserver(update);
      observer.observe(dock);
    });
    return () => {
      clearTimeout(timer);
      observer?.disconnect();
    };
  });

  let peek = $state<{ pile: string } | { key: string } | null>(null);
  // Room over the middle for the opening's title.
  const TITLE_ROOM = 52;

  const sizedOf = (item: Item): Sized | null => {
    const size = sizes.get(item.placed.piece.key);
    if (!size) return null;
    return {
      key: item.placed.piece.key,
      w: size.w,
      h: size.h,
      group: item.placed.heading,
      ...scaleOf(item.placed.piece, item.main),
    };
  };
  const present = <T,>(value: T | null): value is T => value !== null;

  const layout = $derived.by(() => {
    const spotItems = items.filter((item) => item.current);
    const main = spotItems.find((item) => item.main);
    return layoutTable({
      room: {
        width: room.width,
        height: room.height,
        top: TITLE_ROOM,
        bottom: storyRoom,
        deck: room.deck,
      },
      spot: {
        main: main ? sizedOf(main) : null,
        rest: spotItems
          .filter((item) => !item.main)
          .map(sizedOf)
          .filter(present),
      },
      sides: assignSides(
        items
          .filter((item) => !item.current)
          .map(sizedOf)
          .filter(present),
        room.deck ? 3 : 0,
      ),
      peek,
    });
  });

  // How each piece moves to its new place: what leaves the middle goes aside one after another, what comes out of a
  // card or package bursts out of it one at a time, and a pile fans out at once.
  type Zone = "spot" | "side" | "pile" | "peek";
  let lastZone = new Map<string, Zone>();
  const motion = $derived.by(() => {
    const out = new Map<string, { dur: number; delay: number }>();
    const peeking = new Set(
      peek && layout.peekBox
        ? "pile" in peek
          ? (layout.piles.get(peek.pile)?.keys ?? [])
          : [peek.key]
        : [],
    );
    const zones = new Map<string, Zone>();
    for (const item of items) {
      const key = item.placed.piece.key;
      if (!layout.places.has(key)) continue;
      zones.set(
        key,
        item.current
          ? "spot"
          : peeking.has(key)
            ? "peek"
            : layout.pileOf.has(key)
              ? "pile"
              : "side",
      );
    }
    const now = performance.now();
    let aside = 0;
    for (const [key, zone] of zones) {
      if (lastZone.get(key) === "spot" && zone !== "spot")
        out.set(key, { dur: 820, delay: aside++ * ASIDE_GAP });
    }
    for (const item of items) {
      const key = item.placed.piece.key;
      const zone = zones.get(key);
      if (!zone || out.has(key)) continue;
      const before = lastZone.get(key);
      if (!before)
        out.set(
          key,
          item.main
            ? { dur: 720, delay: Math.max(0, mainAt - now) }
            : { dur: PIECE_FLIGHT, delay: Math.max(0, flippedAt + (plan.get(key) ?? 0) - now) },
        );
      else if (zone === "peek" || before === "peek") out.set(key, { dur: 320, delay: 0 });
      // The card or package being opened holds still until the first piece comes out of it, then makes room.
      else if (item.main && item.current && plan.size)
        out.set(key, {
          dur: 620,
          delay: Math.max(0, flippedAt + Math.min(...plan.values()) - now),
        });
      else out.set(key, { dur: 620, delay: 0 });
    }
    lastZone = zones;
    return out;
  });

  // A piece first stands where it comes from (the deck, or the card it came out of), then is born into its place.
  const born = new SvelteSet<string>();
  const mountedAt = typeof performance === "undefined" ? 0 : performance.now();
  $effect(() => {
    const pending = [...layout.places.keys()].filter((key) => !born.has(key));
    if (!pending.length) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => pending.forEach((key) => born.add(key)));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  });

  function spawnOf(item: Item, w: number, h: number): string | null {
    if (still || performance.now() - mountedAt < 500 || !tableEl) return null;
    const box = tableEl.getBoundingClientRect();
    if (item.main) {
      const source = sourceEl?.getBoundingClientRect();
      if (!source?.width) return null;
      const scale = Math.min(source.width / w, source.height / h);
      const x = source.left - box.left + source.width / 2;
      const y = source.top - box.top + source.height / 2;
      return `translate(${x - w / 2}px, ${y - h / 2}px) scale(${scale}) rotate(-6deg)`;
    }
    const main = items.find((other) => other.current && other.main);
    const from = main ? layout.places.get(main.placed.piece.key) : null;
    if (!from) return null;
    return `translate(${from.cx - w / 2}px, ${from.cy - h / 2}px) scale(0.18)`;
  }

  function styleOf(item: Item) {
    const key = item.placed.piece.key;
    const size = sizes.get(key);
    const place = layout.places.get(key);
    if (!size || !place) return "opacity: 0; visibility: hidden;";
    const target = `translate(${place.cx - size.w / 2}px, ${place.cy - size.h / 2}px) scale(${place.scale}) rotate(${place.rot}deg)`;
    if (!born.has(key)) {
      const from = untrack(() => spawnOf(item, size.w, size.h));
      return `transform: ${from ?? target}; opacity: 0; transition: none; z-index: ${place.z};`;
    }
    const move = motion.get(key) ?? { dur: 600, delay: 0 };
    return `transform: ${target}; z-index: ${place.z}; --dur: ${still ? 1 : move.dur}ms; --delay: ${still ? 0 : move.delay}ms;`;
  }

  const waiting = $derived(new Set(arrivals.map((entry) => entry.key)));


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

  let hovered: string | null = null;
  function enter(item: Item, at: HTMLElement) {
    if (progress.stowing || arrival) return;
    const piece = item.placed.piece;
    hovered = piece.key;
    const was = JSON.stringify(peek);
    if (!item.current) {
      const pile = layout.pileOf.get(piece.key);
      if (pile) peek = { pile };
      else if (piece.t === "card" || piece.t === "note") peek = { key: piece.key };
      else peek = null;
    }
    // A piece that moves to be read gets its tip once it is there.
    const moves = JSON.stringify(peek) !== was;
    setTimeout(
      () => {
        if (hovered === piece.key) showTip(isRule(piece) ? null : piece, at);
      },
      moves && !still ? 340 : 0,
    );
  }

  function leave() {
    hovered = null;
    tip = null;
  }

  const grow = (box: Box, by: number): Box => ({
    x: box.x - by,
    y: box.y - by,
    w: box.w + by * 2,
    h: box.h + by * 2,
  });
  const inside = (box: Box, x: number, y: number) =>
    x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;

  /** A pile fanned out stays open while the pointer is over it or over where it lay. */
  function pointerMoved(event: PointerEvent) {
    if (!peek || !tableEl) return;
    const box = tableEl.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    const keep = [layout.peekBox, layout.peekAnchor].some(
      (area) => area && inside(grow(area, 14), x, y),
    );
    if (!keep) {
      peek = null;
      tip = null;
    }
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

  const players = $derived(tablePlayers(table));
  const multi = $derived(!solo && players.length > 1);
  const myReady = $derived(progress.ready.includes(player));
  const voters = $derived(multi ? tableVoters(table, (who) => progress.ready.includes(who)) : []);
  const waitingOn = $derived(stillWaiting(voters, player));

  const exit = readingExit();
  let root = $state<HTMLElement>();
  let deckEl = $state<HTMLElement>();
  let sourceEl = $state<HTMLElement>();
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
    timers.forEach(clearTimeout);
    sizer?.disconnect();
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
    peek = null;
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
              const pulse = node.firstElementChild?.animate(
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
              return pulse?.finished.catch(() => {});
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

    if (destroyed) return;
    send({ type: "ACK_BRIEFING" });
    exit?.leave();
  }

  const mayDraw = $derived(canDraw && settled);
  const mayFlip = $derived(needsFlip && arrived === drawn);
  const finished = $derived(allDrawn && settled);
  const prompt = $derived(
    mayDraw
      ? hasLegacy
        ? drawn === 0
          ? "Draw the first card"
          : "Draw the next card"
        : "Open the next one"
      : mayFlip
        ? current?.from.t === "seal"
          ? "Open it"
          : "Turn it over"
        : null,
  );

  /** What a press does now, the same from Space as from the screen; nothing while a sequence plays. */
  function press() {
    if (progress.stowing || paused) return;
    if (arrival) return void land();
    if (activeStory) return void storyStage?.next();
    if (storyWaits) return void readOn();
    if (needsChart && settled) return void step();
    if (finished) return void toggleReady();
    if (mayDraw || mayFlip) step();
  }
</script>

<svelte:window
  onpointermove={pointerMoved}
  onkeydown={(event) => {
    if (typing(event)) return;
    if (full) {
      if (event.key === "Escape") full = false;
      return;
    }
    // Space on a focused button already presses it.
    if (event.key === " " && !progress.stowing && !paused && !onButton(event)) {
      event.preventDefault();
      press();
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
    class:revealing={(arrival !== null && !landing) || (activeStory !== null && staging)}
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
    <!-- Everything lies straight on the table: the deck at the head of it, the opening read in the middle and what
         was read before spread on both sides, piled only where a side runs out of room. -->
    <div class="table" bind:this={tableEl}>
      <div class="head" bind:this={headEl}>
        {#if hasLegacy && !deckReturned}
          <button
            class="deck-pile"
            bind:this={deckEl}
            disabled={!mayDraw}
            onclick={step}
            data-testid="legacy-draw-deck"
            aria-label={mayDraw ? `Draw from the Legacy deck (${remaining} left)` : "Legacy deck"}
          >
            <span class="stack" bind:this={sourceEl}>
              {#if nextDeckCard}
                <LegacyCard card={nextDeckCard} side="a" size="deck" {campaign} />
              {:else}
                <span class="fallback-card">Legacy</span>
              {/if}
              {#if mayDraw}<Beacon gap="0.3rem" turns={4} />{/if}
            </span>
            <span class="count">{canDraw ? `${remaining} to draw` : `${deckCount} in deck`}</span>
          </button>
        {:else if !hasLegacy && mayDraw && !progress.stowing}
          {@const next = steps[drawn]}
          <button
            class="seal-trigger"
            onclick={step}
            data-testid="legacy-draw-deck"
            aria-label={`Open ${next?.title ?? "package"}`}
          >
            <span class="seal-icon" bind:this={sourceEl}>
              {#if next?.seals[0]?.t === "package"}
                <Crate id={next.seals[0].id} open={false} />
              {:else if next?.seals[0]?.t === "door"}
                <DossierDoor id={next.seals[0].id} open={false} />
              {/if}
              <Beacon gap="0.3rem" turns={4} />
            </span>
            <span class="count">{next?.title}</span>
          </button>
        {/if}
      </div>

      {#if current && flipped && !progress.stowing && layout.spotBox}
        {@const box = layout.spotBox}
        {#key drawn}
          <h2
            class="title"
            style:transform={`translate(${box.x + box.w / 2}px, ${box.y}px) translate(-50%, -100%)`}
            in:fly={{ y: 10, duration: 420, delay: still ? 0 : 300 }}
          >
            {current.title}
          </h2>
        {/key}
      {/if}

      {#if layout.peekBox}
        {@const box = layout.peekBox}
        <span
          class="peek-shade"
          style:transform={`translate(${box.x + box.w / 2}px, ${box.y + box.h / 2}px)`}
          style:width={`${box.w + 160}px`}
          style:height={`${box.h + 160}px`}
          transition:fade={{ duration: 200 }}
          aria-hidden="true"
        ></span>
      {/if}

      {#each layout.labels as label (label.key)}
        <span
          class="label"
          class:pile={label.pile !== null}
          class:center={label.align === "center"}
          class:right={label.align === "right"}
          style:width={`${label.w}px`}
          style:transform={`translate(${label.align === "right" ? label.x - label.w : label.align === "center" ? label.x - label.w / 2 : label.x}px, ${label.y}px)`}
          in:fade={{ duration: 360, delay: still ? 0 : 600 }}
          onpointerenter={() => {
            if (label.pile && !progress.stowing) peek = { pile: label.pile };
          }}
          role={label.pile ? "button" : undefined}
          aria-label={label.pile ? `${label.text}: ${label.count} pieces in a pile` : undefined}
          ><span>{label.text}{#if label.pile}<i>{label.count}</i>{/if}</span></span
        >
      {/each}

      {#each items as item (item.placed.piece.key)}
        {@const piece = item.placed.piece}
        {@const opens = item.current && item.main && mayFlip}
        <button
          type="button"
          class="piece {piece.t}"
          class:mechanic={piece.stow.cls === "mechanic"}
          class:opens
          class:current={item.current}
          style={styleOf(item)}
          style:visibility={waiting.has(piece.key) ? "hidden" : null}
          data-piece={piece.key}
          data-testid={item.current && item.main ? "legacy-active-card" : undefined}
          data-stow-class={item.current && item.main && !flipped ? undefined : piece.stow.cls}
          data-put={piece.stow.put}
          aria-label={opens
            ? `${current?.from.t === "seal" ? "Open" : "Turn over"} ${current?.title ?? ""}`
            : piece.tip}
          onclick={() => opens && step()}
          onpointerenter={(event) => enter(item, event.currentTarget)}
          onpointerleave={leave}
          onfocus={(event) => enter(item, event.currentTarget)}
          onblur={leave}
          {@attach measure}
        >
          <UnboxPiece
            {piece}
            {campaign}
            open={!item.current || flipped}
            live={item.current && item.main}
            fresh={item.current && showing}
          />
          {#if opens}<Beacon gap="0.25rem" turns={4} />{/if}
        </button>
      {/each}

      {#if tip}
        <div class="piece-tip" role="tooltip" style={tip.style} transition:fade={{ duration: 120 }}>
          <RichText text={tip.text} />
        </div>
      {/if}
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

    {#if arrival}
      {#key arrival.key}
        <Newcomer {arrival} onnext={() => void land()} leaving={landing} bind:element={newcomerEl} />
      {/key}
    {/if}

    {#if activeStory}
      <StoryStage
        bind:this={storyStage}
        bind:staging
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
        {#if finished && !progress.stowing}
          <VoteButton
            label={exit?.label ?? "Done"}
            tally="done"
            {voters}
            on={myReady}
            onclick={toggleReady}
            testid="ack-briefing"
          />
          {#if progress.ready.length && waitingOn.length}
            <span class="waiting">Waiting for {waitingOn.join(", ")}</span>
          {/if}
        {:else if needsChart && settled}
          <button class="chart-btn" onclick={step} data-testid="briefing-chart">
            Show on the map<Beacon gap="0.15rem" />
          </button>
        {:else if storyWaits && !paused}
          <button class="chart-btn" onclick={readOn} data-testid="briefing-read-on">
            Read on<kbd>Space</kbd><Beacon gap="0.15rem" />
          </button>
        {:else if !progress.stowing && prompt && !activeStory}
          <span class="prompt">{prompt}<kbd>Space</kbd></span>
        {/if}
      </div>

      {#if !progress.stowing && finished}
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
    padding: 0.4rem 0.8rem 0.8rem;
    color: var(--ink);
    pointer-events: auto;
  }

  .table {
    position: relative;
    min-height: 0;
  }

  /* While a new character stands over the table, the table steps back. */
  .table > :global(*) {
    transition: opacity 360ms ease;
  }

  .revealing .table > :global(*) {
    opacity: 0.12;
  }

  /* The deck stands in the corner nearest its place in the top bar. */
  .head {
    position: absolute;
    top: 0;
    right: 0.4rem;
    z-index: 300;
  }

  .deck-pile,
  .seal-trigger {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    cursor: pointer;
    transition: transform 220ms ease;
  }

  .deck-pile:disabled {
    cursor: default;
  }

  .deck-pile:not(:disabled):hover,
  .seal-trigger:hover {
    transform: translateY(-3px) scale(1.04);
  }

  .stack {
    position: relative;
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
    position: relative;
    width: 8rem;
  }

  .count,
  .label,
  .prompt,
  .waiting {
    color: #f4ead6;
    text-shadow:
      0 0 0.5em rgb(0 0 0 / 0.95),
      0 0 0.2em rgb(0 0 0 / 0.95),
      0 1px 2px rgb(0 0 0 / 0.9);
  }

  .count {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .title {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 160;
    max-width: 40rem;
    margin: 0;
    padding-bottom: 0.5rem;
    transition: transform 620ms cubic-bezier(0.2, 0.8, 0.2, 1);
    color: #fbf1da;
    font-family: var(--font-display);
    font-size: 1.75rem;
    font-weight: 400;
    line-height: 1.2;
    text-align: center;
    text-shadow:
      0 0 0.6em rgb(0 0 0 / 0.95),
      0 0 0.25em rgb(0 0 0 / 0.9);
  }

  /* A group's name is lettered on the table over its pieces, in two lines at most, its foot on the pieces' top. */
  .label {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 150;
    display: flex;
    align-items: flex-end;
    height: 26px;
    color: #e8d9b8;
    font-size: 0.64rem;
    font-weight: 800;
    letter-spacing: 0.09em;
    line-height: 1.1;
    text-transform: uppercase;
    pointer-events: none;
    transition:
      transform 620ms cubic-bezier(0.2, 0.8, 0.2, 1),
      opacity 300ms ease;
  }

  .label > span {
    display: -webkit-box;
    width: 100%;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .label.center > span {
    text-align: center;
  }

  .label.right > span {
    text-align: right;
  }

  .label.pile {
    pointer-events: auto;
    cursor: help;
  }

  .label i {
    margin-left: 0.5em;
    color: #ffd779;
    font-style: normal;
  }

  .stowing .label,
  .stowing .title {
    opacity: 0;
  }

  /* What a pile fans out is read over a shadow on the table, never in a box. */
  .peek-shade {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 450;
    translate: -50% -50%;
    border-radius: 50%;
    background: radial-gradient(closest-side, rgb(8 6 4 / 0.72), rgb(8 6 4 / 0.5) 60%, transparent);
    pointer-events: none;
  }

  .piece {
    position: absolute;
    top: 0;
    left: 0;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: help;
    transform-origin: center;
    perspective: 1400px;
    transition:
      transform var(--dur, 600ms) cubic-bezier(0.2, 0.8, 0.2, 1) var(--delay, 0ms),
      opacity 360ms ease var(--delay, 0ms);
  }

  .piece.opens {
    cursor: pointer;
  }

  .piece.opens:hover > :global(.content) {
    transform: translateY(-4px);
  }

  .piece > :global(.content) {
    transition: transform 200ms ease;
  }

  .piece:focus-visible {
    outline: 2px solid rgb(226 195 106 / 0.8);
    outline-offset: 4px;
  }

  .piece.mechanic > :global(.content) {
    filter: drop-shadow(0 0 0.6rem rgb(227 178 60 / 0.45));
  }

  .piece-tip {
    position: absolute;
    z-index: 600;
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
    padding-top: 0.4rem;
    z-index: 4;
  }

  .trash {
    justify-self: start;
    display: grid;
    place-items: center;
    width: 2.8rem;
    height: 2.8rem;
    color: #e8dcc2;
    opacity: 0.7;
    filter: drop-shadow(0 0 0.35rem rgb(0 0 0 / 0.9));
    transition:
      opacity 250ms ease,
      transform 250ms ease;
  }

  .trash.active {
    opacity: 1;
    transform: scale(1.15);
  }

  .trash svg {
    width: 1.7rem;
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

  .prompt,
  .waiting {
    font-size: 0.9rem;
    font-weight: 600;
  }

  .prompt kbd,
  .chart-btn kbd {
    margin-left: 0.6em;
    padding: 0.05em 0.45em;
    border: 1px solid rgb(244 234 214 / 0.55);
    border-radius: 3px;
    font: inherit;
    font-size: 0.78em;
    letter-spacing: 0.04em;
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
    border: 1px solid rgb(231 220 198 / 0.45);
    border-radius: 3px;
    background: none;
    color: #f4ead6;
    font: inherit;
    font-size: 0.82rem;
    text-shadow: 0 0 0.4em rgb(0 0 0 / 0.95);
    cursor: pointer;
  }

  .summary-btn:hover {
    border-color: var(--paper);
  }
</style>
