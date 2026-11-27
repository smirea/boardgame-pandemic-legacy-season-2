<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import {
    actionMenu,
    cardTargets,
    cityDef,
    insights,
    legalDecides,
    legalPlays,
    onGrid,
    pack,
    reconBoxes,
    reject,
    tableStart,
  } from "@repo/game";
  import type { BriefingEntry, CardId, CityId, Command, Decide, EdgeDef, SeatId } from "@repo/game";
  import Board from "#lib/board/Board.svelte";
  import type { BoardMarks, CitySpot } from "#lib/board/types.ts";
  import type { SessionView } from "#lib/session/session.svelte.ts";
  import { LS } from "#lib/storage.ts";
  import { setContext, tick, untrack, onDestroy } from "svelte";
  import type { Attachment } from "svelte/attachments";
  import type { Snippet } from "svelte";
  import { backOut } from "svelte/easing";
  import { fade, fly, scale } from "svelte/transition";
  import { GameAudio } from "#lib/audio/gameAudio.svelte.ts";
  import { hushSfx, sfxMoment } from "#lib/audio/sfx.ts";
  import { CharacterChatter } from "#lib/characters/chatter.svelte.ts";
  import type { FigureKey } from "#lib/characters/personas.ts";
  import { characterVoice } from "#lib/characters/voice.svelte.ts";
  import { barkFor } from "#lib/story/barks.ts";
  import { Radio } from "#lib/story/radio.svelte.ts";
  import RadioLine from "#lib/story/RadioLine.svelte";
  import { STORY_SCENES } from "#lib/story/script.ts";
  import { voicePlayer } from "#lib/story/voice.svelte.ts";
  import type { StoryScene } from "#lib/story/script.ts";
  import StoryArchive from "#lib/story/StoryArchive.svelte";
  import ActionPanel from "./ActionPanel.svelte";
  import Announcements from "./Announcements.svelte";
  import { createAnnouncements } from "./announcements.svelte.ts";
  import CardPick from "./CardPick.svelte";
  import { createBoardView } from "./boardView.svelte.ts";
  import { createChoosing } from "./choosing.svelte.ts";
  import { MapTools } from "./mapTools.svelte.ts";
  import { flyToStorage } from "./storageFlight.ts";
  import { createGameKeys } from "./gameKeys.ts";
  import { measurePanels } from "./panels.svelte.ts";
  import Corner from "./Corner.svelte";
  import { placeSeats } from "./seats.ts";
  import type { Place } from "./seats.ts";
  import Dock from "./Dock.svelte";
  import EpidemicSequence from "./EpidemicSequence.svelte";
  import CardFlights from "./CardFlights.svelte";
  import { createTurnAdmin } from "./turnAdmin.svelte.ts";
  import { CUBE_FLIGHTS, createCubeFlights } from "./cubeFlights.svelte.ts";
  import TurnDesk from "./TurnDesk.svelte";
  import TurnInterlude from "./TurnInterlude.svelte";
  import { TimeLapse as GameLapse } from "./timeLapse.svelte.ts";
  import TimeLapse from "./TimeLapse.svelte";
  import { FateShow as FateScenes } from "./fateShow.svelte.ts";
  import FateShow from "./FateShow.svelte";
  import { InfectionShow } from "./infectionShow.svelte.ts";
  import { PopulationShow } from "./populationShow.svelte.ts";
  import { LegacyShow } from "./legacyShow.svelte.ts";
  import { seatName, seatColor, setNames } from "./labels.svelte.ts";
  import { characterTraits } from "./traits.ts";
  import GameMenu from "./GameMenu.svelte";
  import Lobby from "./Lobby.svelte";
  import CharacterSelect from "./CharacterSelect.svelte";
  import Briefing from "./Briefing.svelte";
  import Unboxing from "./Unboxing.svelte";
  import LegacyBox from "./LegacyBox.svelte";
  import LegacyDeck from "./LegacyDeck.svelte";
  import Hotkeys from "./Hotkeys.svelte";
  import Objectives from "./Objectives.svelte";
  import ScannerDialog from "./ScannerDialog.svelte";
  import Scrim from "./Scrim.svelte";
  import { provideCovers } from "./covers.ts";
  import ScarChoice from "./ScarChoice.svelte";
  import ScarVote from "./ScarVote.svelte";
  import Replacement from "./Replacement.svelte";
  import SeatPicker from "./SeatPicker.svelte";
  import TopBar from "./TopBar.svelte";
  import UndoVote from "./UndoVote.svelte";
  import Upkeep from "./Upkeep.svelte";
  import RevealShow from "./RevealShow.svelte";
  import type { CityCardCopies } from "./PlayerCard.svelte";
  import { provideViewState } from "./viewState.ts";
  import type { GameUi } from "#lib/studio/scene.ts";

  // A spectator owns no seat, whatever this browser claimed in a live game. Replays use it, and draw their own
  // players and step marks over the board, so the panels a player acts from stay out of the way.
  let {
    session,
    spectator = false,
    marks,
    announce = true,
    corner,
    children,
  }: {
    session: SessionView;
    spectator?: boolean;
    marks?: BoardMarks;
    /** False when a spectator jumped rather than stepped, so the events in between are not announced. */
    announce?: boolean;
    /** Draws a seat's corner in place of the live table's slip, as the replay does with its speech bubbles. */
    corner?: Snippet<[SeatId, Place]>;
    children?: Snippet;
  } = $props();

  const snap = $derived(session.state!);
  const world = $derived(snap.world);
  const campaign = $derived(world.campaign);
  const game = $derived(world.game);
  const info = $derived(insights(world));
  const gridSet = $derived(new Set(onGrid(world)));
  const playing = $derived(snap.phase.startsWith("playing"));
  $effect.pre(() => setNames(campaign.names));

  // Which seats are this browser's is game state, keyed by the id the browser keeps, so a reload sits back down.
  const mine = $derived(
    world.table.seats.filter((entry) => entry.player === session.player).map((entry) => entry.seat),
  );
  const solo = $derived(session.mode === "solo");
  const owns = (seat: SeatId) => !spectator && (solo || mine.includes(seat));
  const canAct = $derived(game !== null && owns(game.active));
  const present = $derived(
    new Set(session.peers.filter((peer) => peer.connected).map((peer) => peer.id as string)),
  );
  /** A seat nobody holds, or held by someone no longer connected, such as a player who moved to another browser. */
  const isOpen = (seat: SeatId) => {
    const holder = world.table.seats.find((entry) => entry.seat === seat);
    return !holder || (holder.player !== session.player && !present.has(holder.player));
  };
  const picking = $derived(
    game !== null &&
      !spectator &&
      !solo &&
      mine.length === 0 &&
      snap.phase !== "upkeep" &&
      snap.phase !== "over",
  );
  const openSeats = $derived(picking ? game!.seats.filter(isOpen) : []);
  function takeSeat(seat: SeatId) {
    const id = game?.players[seat]?.character;
    const character = id ? campaign.characters[id] : undefined;
    if (character) characterVoice.playFor(character, "punchline", { priority: "ui" });
    send({
      type: "TAKE_SEAT",
      player: session.player,
      name: LS.get("name", "").trim() || "Player",
      seat,
    });
  }
  let viewing = $state<SeatId | null>(null);
  // The seat the pointer or keyboard focus rests on, whose pawn lights up on the board.
  let pointedSeat = $state<SeatId | null>(null);
  $effect(() => {
    // The dock follows whoever's turn it is, until the player picks a hand to look at.
    void game?.active;
    viewing = null;
  });
  // The seat this browser sits at. Playing several characters, on one screen or not, it moves to whoever's turn it is.
  const me = $derived(game ? (owns(game.active) ? game.active : game.seats.find(owns)) : undefined);
  const home = $derived(game ? (me ?? game.active) : null);
  const dockSeat = $derived(spectator ? null : (viewing ?? home));

  // Actions are offered only to whoever plays the active seat, and only in its action step. Nobody else reads the
  // menu, and listing it is the costliest thing a state change asks of the engine.
  const live = $derived(snap.phase === "playing.actions" && canAct);
  const actionChoices = $derived(game && live ? actionMenu(world, game.active) : []);
  const actions = $derived(live ? actionChoices.flatMap((choice) => choice.actions) : []);
  const plays = $derived(playing ? legalPlays(world, snap.phase) : []);
  const decides = $derived(playing ? legalDecides(world) : []);

  let menu = $state(false);
  let boxOpen = $state(false);
  let deckOpen = $state(false);
  let hotkeysOpen = $state(false);
  let scannerOpen = $state(false);
  let storyOpen = $state(false);
  let storyInitial = $state<StoryScene | null>(null);
  function closeStory() {
    storyOpen = false;
    storyInitial = null;
  }
  let legacyDeckOut = $state(false);
  const gameAudio = new GameAudio();
  const chatter = new CharacterChatter();
  onDestroy(() => {
    gameAudio.stop();
    chatter.stop();
  });
  const monitorChoice = $derived(actionChoices.find((choice) => choice.a === "monitor") ?? null);
  const canMonitor = $derived(live && Boolean(monitorChoice?.actions.length));
  const monitorReason = $derived(
    live ? (monitorChoice?.reason ?? null) : game ? "Available on your turn during actions" : null,
  );
  function openScanner() {
    if (canMonitor) {
      scannerOpen = false;
      choosing.step({ t: "start", a: "monitor", via: "panel" });
    } else {
      scannerOpen = !scannerOpen;
    }
  }
  // Once the table knows which game is next, every game is set up by choosing who plays, over the whole table.
  const choosingCharacters = $derived(
    snap.phase === "lobby" && !spectator && tableStart(snap.world) !== null,
  );
  /** A scar being chosen fills every screen, so the whole table sees the card it lands on. */
  const scarOwed = $derived.by(() => {
    const pending = playing ? game?.pending[0] : undefined;
    return pending?.t === "scar"
      ? { seat: pending.seat, chooser: pending.seat ?? game!.active }
      : null;
  });
  /** A character who died is replaced on a screen of its own, once the table has seen the death. */
  const replacing = $derived.by(() => {
    const pending = playing ? game?.pending[0] : undefined;
    return pending?.t === "replace" ? pending.seat : null;
  });
  /** A scar the Legacy deck owes is put to the table first: everyone votes for the character who takes it. */
  const scarVoting = $derived.by(() => {
    const pending = playing ? game?.pending[0] : undefined;
    return pending?.t === "scarVote" ? pending : null;
  });
  // A haven the character screen points at, which the camera looks at behind it.
  let focus = $state.raw<{ city: CityId; x: number; y: number } | null>(null);
  let stage = $state<HTMLElement | null>();
  let leftColumn = $state<HTMLElement | null>();
  let rightColumn = $state<HTMLElement | null>();
  let goals = $state<HTMLElement | null>();

  // Everyone sits round the table in turn order, clockwise, with this browser's player at the bottom right.
  // A replay seats the first player there.
  const seatAt = $derived(game ? placeSeats(game.seats, me) : null);
  const listed = $derived(actionChoices.length > 0);
  const panels = measurePanels({
    get stage() {
      return stage;
    },
    get leftColumn() {
      return leftColumn;
    },
    get rightColumn() {
      return upkeepDock ?? rightColumn;
    },
    get goals() {
      return goals;
    },
    // The Actions panel comes and goes with the turn's steps, and is one of the panels measured.
    get layout() {
      return [seatAt, listed, admin.deck, upkeepDock];
    },
  });
  let resetView = $state(0);

  const send = (command: Command) => session.send(command);

  const said = createAnnouncements({
    get game() {
      return game;
    },
    get campaign() {
      return campaign;
    },
    get spectator() {
      return spectator;
    },
    get announce() {
      return announce;
    },
  });
  const toast = said.toast;

  const recons = $derived(reconBoxes(world, snap.phase));
  const choosing = createChoosing({
    get world() {
      return world;
    },
    get phase() {
      return snap.phase;
    },
    get live() {
      return live;
    },
    get canAct() {
      return canAct;
    },
    get actionChoices() {
      return actionChoices;
    },
    get plays() {
      return plays;
    },
    get recons() {
      return recons;
    },
    get decides() {
      return decides;
    },
    owns,
    send,
    toast,
  });

  $effect(() => {
    // When an action, Lockdown, or pending choice needs cards from a hand, turn the dock to a seat that can answer.
    const pick = choosing.handPick;
    if (pick) {
      if (pick.seat && owns(pick.seat)) {
        viewing = pick.seat;
      } else if (pick.seat === null && game) {
        const current = untrack(() => viewing ?? home);
        if (!current || !owns(current) || pick.eligible(current).size === 0) {
          const fallback = game.seats.find((other) => owns(other) && pick.eligible(other).size > 0);
          if (fallback) viewing = fallback;
        }
      }
      return;
    }
    const owed = decides.find((decide) => decide.d === "discard" && owns(decide.seat));
    if (owed?.d === "discard") {
      viewing = owed.seat;
      return;
    }
    const pending = game?.pending[0];
    if (pending?.t === "giveCard" && owns(pending.seat)) {
      viewing = pending.seat;
      return;
    }
    if (pending?.t === "cordon" || pending?.t === "shield" || pending?.t === "guard") {
      const seatsWithCards = [
        ...new Set(
          decides
            .filter(
              (decide): decide is Extract<Decide, { d: "cordon" | "shield" | "guard" }> =>
                decide.d === pending.t && owns(decide.seat),
            )
            .map((decide) => decide.seat),
        ),
      ];
      const current = untrack(() => viewing ?? home);
      if (seatsWithCards.length && (!current || !seatsWithCards.includes(current))) {
        viewing = seatsWithCards[0]!;
      }
    }
  });

  const view = provideViewState();
  const covers = provideCovers();
  let board = $state<Board>();

  /** Everything on this screen that the game state does not decide, as plain JSON. */
  export function ui(): GameUi {
    return {
      camera: board?.camera() ?? null,
      viewing,
      menu,
      box: boxOpen,
      deck: deckOpen,
      hotkeys: hotkeysOpen,
      scanner: scannerOpen,
      steps: choosing.steps,
      toasts: said.toasts.map(({ text, tone }) => ({ text, tone })),
      banner: said.banner && { title: said.banner.title, text: said.banner.text },
      parts: view.read(),
    };
  }

  /** Where the board's camera is this instant, for telling when a glide has ended. */
  export const cameraNow = () => board?.cameraNow() ?? null;

  /**
   * Puts the screen the way `ui()` wrote it down, over the game state already loaded. Returns what could not be
   * put back, such as a click the rules no longer allow.
   */
  export async function applyUi(next: GameUi): Promise<string[]> {
    const problems: string[] = [];
    await tick();
    choosing.dismiss();
    menu = next.menu;
    boxOpen = next.box;
    deckOpen = next.deck;
    hotkeysOpen = next.hotkeys ?? false;
    scannerOpen = next.scanner ?? false;
    viewing = next.viewing;
    said.restore(next.toasts, next.banner);
    view.write(next.parts);
    board?.setCamera(next.camera);
    for (const [index, entry] of next.steps.entries()) {
      await tick();
      if (choosing.step(entry)) continue;
      problems.push(
        `Step ${index + 1} of ${next.steps.length} (${JSON.stringify(entry)}) is not possible in this state`,
      );
      break;
    }
    await tick();
    return problems;
  }

  /** Escape and a right click put down whatever was half-chosen. */
  function cancel() {
    return tools.dropEraser() || choosing.cancel();
  }

  function takeBack(city: CityId) {
    const command = { type: "PLACE_SUPPLY", city, count: -1 } as const;
    if (reject(world, snap.phase, command) === null) send(command);
  }

  // A spectator cannot acknowledge a briefing for the table, so closing it is theirs alone.
  let briefingRead = $state("");
  const briefingKey = $derived(JSON.stringify(campaign.briefing));
  const briefingOpen = $derived(campaign.briefing.length > 0 && briefingRead !== briefingKey);
  const population = new PopulationShow(said.pulse);
  // The spending sheet waits until the population show has played out on the board, then steps aside to a side
  // column only while a player looks at the board.
  let upkeepAsideChosen = $state(false);
  const upkeepAside = $derived(snap.phase === "upkeep" && upkeepAsideChosen);
  let upkeepScrim = $state<HTMLElement | null>(null);
  const upkeepDock = $derived(upkeepAside ? upkeepScrim : null);
  $effect(() => {
    if (snap.phase !== "upkeep") upkeepAsideChosen = false;
  });
  // Once the whole table is done with a reading, each player keeps what it said until they close it themselves. It
  // is this browser's alone and the game goes on under it.
  let recap = $state.raw<BriefingEntry[] | null>(null);
  // A studio scene keeps the recap, since the save it holds has already put the reading away.
  $effect(() =>
    view.register("recap", {
      read: () => recap,
      write: (value: BriefingEntry[] | null) => (recap = value),
    }),
  );
  let lastBriefing = untrack(() => ({
    entries: campaign.briefing,
    stowing: world.table.briefing.stowing,
  }));
  $effect.pre(() => {
    const now = { entries: campaign.briefing, stowing: world.table.briefing.stowing };
    const lived = !spectator || announce;
    untrack(() => {
      if (now.entries.length) recap = null;
      // Only a reading the table put away together, everyone having clicked Done.
      else if (lastBriefing.entries.length && lastBriefing.stowing && lived && !spectator)
        recap = lastBriefing.entries;
      lastBriefing = now;
    });
  });
  /** Anything that covers the board. While one does, Show board lifts it off the table and puts it back. */
  /** Cards a Monitor, a Cautious Approach or a search turned over, in front of the whole table until put away. */
  const revealing = $derived.by(() => {
    const pending = playing ? game?.pending[0] : undefined;
    return pending?.t === "reveal" || pending?.t === "search" ? pending : null;
  });
  const covered = $derived(
    briefingOpen ||
      recap !== null ||
      choosingCharacters ||
      snap.phase === "lobby" ||
      snap.phase === "finished" ||
      (snap.phase === "upkeep" && !upkeepAside && !population.pending) ||
      scarOwed !== null ||
      scarVoting !== null ||
      replacing !== null ||
      boxOpen ||
      deckOpen ||
      scannerOpen ||
      storyOpen ||
      revealing !== null ||
      choosing.chooser?.action === "monitor",
  );
  $effect(() => {
    const lived = !spectator || announce;
    const quiet = briefingOpen || storyOpen || revealing !== null || recap !== null;
    gameAudio.observe(world, snap.phase, lived, briefingOpen || storyOpen || revealing !== null);
    chatter.observe(world, snap.phase, lived, quiet);
  });
  let peeking = $state(false);
  $effect(() => {
    if (!covered) peeking = false;
  });
  // The closing dialog keeps what it said while it fades, so its objectives are still there to fly to the board.
  let shownBriefing = $state.raw(untrack(() => campaign.briefing));
  $effect.pre(() => {
    if (campaign.briefing.length) shownBriefing = campaign.briefing;
  });

  const show = new InfectionShow(said.pulse, (cue) => {
    gameAudio.showCue(cue);
    if (spectator && !announce) return;
    if (cue.t === "plague") chatter.dangerAt(world, cue.city);
    else if (
      cue.t === "strike" &&
      cue.city &&
      (cue.effect === "hollow" || cue.effect === "outbreak")
    ) {
      chatter.dangerAt(world, cue.city);
    }
  });
  // A scratched exposure box and a death are shown to the whole table before the screens that follow them.
  let deathVoiced: { figure: FigureKey; at: number } | null = null;
  const fate = new FateScenes(
    {
      scar: (character) =>
        characterTraits(character).flatMap((trait) => (trait.kind === "scar" ? [trait.name] : [])),
      ability: (character) =>
        characterTraits(character).flatMap((trait) =>
          trait.kind === "ability" ? [trait.name] : [],
        ),
    },
    (cue) => {
      if (cue.t === "result" && cue.result === "scar") {
        const voiced = characterVoice.play(cue.figure, "scar", {
          priority: "game",
          interrupt: true,
        });
        gameAudio.fateCue(cue, voiced);
        return;
      }
      if (cue.t === "result" && cue.result === "skull") {
        const voiced = characterVoice.play(cue.figure, "death", { priority: "death" });
        if (voiced) deathVoiced = { figure: cue.figure, at: performance.now() };
        gameAudio.fateCue(cue, voiced);
        return;
      }
      gameAudio.fateCue(cue, true);
      if (cue.t === "memorial") {
        const playEpitaph = () => voicePlayer.play(barkFor("epitaph", cue.key).id);
        const alreadySpoke =
          deathVoiced !== null &&
          deathVoiced.figure === cue.figure &&
          performance.now() - deathVoiced.at < 7000;
        if (alreadySpoke) {
          characterVoice.whenIdle(playEpitaph);
        } else {
          characterVoice.play(cue.figure, "death", { priority: "death", onEnd: playEpitaph });
        }
      }
    },
  );
  const radio = new Radio();

  // How the game ended is announced once the board has shown what ended it: the last incident's marker, a death.
  const outcomeShown = $derived(
    game?.outcome != null && snap.phase === "over" && !show.playing && !fate.playing,
  );
  let outcomeHeard = untrack(() => game?.outcome != null);
  $effect(() => {
    const shown = outcomeShown;
    const won = game?.outcome?.won ?? false;
    const lived = !spectator || announce;
    untrack(() => {
      if (shown && !outcomeHeard && lived) gameAudio.outcome(won);
      outcomeHeard = game?.outcome != null && (shown || outcomeHeard);
    });
  });

  // A game that ends in front of this player is played back on the board once the table has seen and heard how it
  // ended. One reloaded onto has nothing to wait for, so it only offers the playback.
  const lapse = new GameLapse(() => session.exportRecord());
  let endedHere = untrack(() => snap.phase !== "over");
  let lapseDue = $state(false);
  $effect(() => {
    const over = snap.phase === "over" && !spectator;
    untrack(() => {
      if (over) return void lapse.load();
      lapse.clear();
      lapseDue = false;
      endedHere = true;
    });
  });
  $effect(() => {
    if (!outcomeShown || spectator) return;
    return untrack(() => {
      if (!endedHere) return;
      endedHere = false;
      const timer = setTimeout(() => (lapseDue = true), 2600);
      return () => clearTimeout(timer);
    });
  });
  $effect(() => {
    if (!lapseDue || !lapse.ready || !outcomeShown || radio.line) return;
    untrack(() => {
      lapseDue = false;
      void lapse.play();
    });
  });
  $effect(() => hushSfx(lapse.playing));
  onDestroy(() => hushSfx(false));
  /** The middle of the board left open between the panels, level with the middle of the stage, as fractions. */
  function openMiddle() {
    const width = stage?.clientWidth || 1;
    const y = (stage?.clientHeight ?? 0) * 0.45;
    let left = 0;
    let right = width;
    for (const rect of panels.covered) {
      if (rect.y > y || rect.y + rect.height < y) continue;
      if (rect.x + rect.width / 2 < width / 2) left = Math.max(left, rect.x + rect.width);
      else right = Math.min(right, rect.x);
    }
    return { x: (left + right) / 2 / width, y: 0.45 };
  }
  // Worked out once per city: a new object restarts the camera's glide, and the panels move while the show plays.
  const showFocus = $derived.by(() => {
    const city = show.focus ?? population.focus;
    return city ? { city, ...untrack(openMiddle), glide: 900, zoom: 0.45 } : null;
  });
  // Before anything draws the new state, so the board and the incident track never show what the show holds back.
  $effect.pre(() => {
    const next = world;
    const lived = !spectator || announce;
    const phase = snap.phase;
    // The reading's recap covers the board too, so the population show waits until this player closes it, and for an
    // exposure the game's last move scratched open. The exposure is read as it now stands, after the state reached it.
    const held = briefingOpen || recap !== null || fate.playing;
    untrack(() => {
      show.observe(next, lived, phase);
      fate.observe(next, lived);
      population.observe(next, lived, phase, held || fate.playing);
    });
  });
  $effect(() => {
    const next = world;
    const lived = !spectator || announce;
    const phase = snap.phase;
    const quiet = briefingOpen || storyOpen || revealing !== null || recap !== null;
    const busy = show.playing || fate.playing;
    untrack(() => radio.observe(next, phase, lived, quiet, busy));
  });
  $effect(() => () => {
    show.stop();
    population.stop();
    fate.stop();
    radio.stop();
  });

  const legacy = new LegacyShow();
  $effect.pre(() => {
    const next = world;
    const lived = !spectator || announce;
    untrack(() => legacy.observe(next, lived));
  });
  $effect(() => () => legacy.stop());
  const legacyFocus = $derived(
    legacy.focus ? { city: legacy.focus, ...untrack(openMiddle), glide: 1000, zoom: 0.55 } : null,
  );

  const cubeFlights = createCubeFlights();
  setContext(CUBE_FLIGHTS, cubeFlights);

  // What follows a player's actions is wound up in one place, where the Actions panel stood, for everyone to see.
  const admin = createTurnAdmin({
    get world() {
      return world;
    },
    get phase() {
      return snap.phase;
    },
    get info() {
      return info;
    },
    get canAct() {
      return canAct;
    },
    get spectator() {
      return spectator || (!solo && mine.length === 0);
    },
    get lived() {
      return !spectator || announce;
    },
    show,
    send,
  });
  // The banner goes up as an Epidemic is started, before its steps are read out.
  $effect(() => {
    if (admin.turn.struck === 0) return;
    untrack(() => {
      const rate = pack.numbers.infectionRates[game?.rateIndex ?? 0];
      said.raise("Epidemic", `Infection rate: ${rate} cards a turn.`, 2600);
    });
  });
  /** Cards hidden from hand/corner while in flight from the deck or spotlighted for a search. */
  const hiddenCards = $derived(
    revealing?.t === "search"
      ? new Set([...admin.turn.arriving, revealing.card])
      : admin.turn.arriving,
  );
  /** Where a drawn card ends up on this screen: its place in the hand held up here, or the seat of whoever drew it. */
  const flightDest = (card: CardId, seat: SeatId) =>
    document.querySelector(`[data-testid="hand"] [data-card="${card}"]`) ??
    document.querySelector(`.place[data-seat="${seat}"] [data-testid="corner-hand"]`) ??
    document.querySelector(`.place[data-seat="${seat}"]`);
  // The next player is announced once the last card of the turn before has been played out.
  const nextUp = $derived.by(() => {
    const up = admin.turn.turn;
    if (
      !up ||
      !game ||
      game.outcome ||
      admin.deck !== null ||
      show.playing ||
      fate.playing ||
      !playing
    )
      return null;
    const playerState = game.players[up.seat];
    const character =
      campaign.characters[playerState?.character as keyof typeof campaign.characters];
    const at = playerState ? game.locations[playerState.location] : undefined;
    return {
      key: up.key,
      name: seatName(world, up.seat),
      color: seatColor(up.seat),
      seat: up.seat,
      character: character ?? null,
      danger: Boolean(at && (at.hollow > 0 || at.plague > 0)),
      mine: owns(up.seat),
    };
  });
  const announced = (key: number) => () => admin.turn.announced(key);
  // Where the foot of the Actions panel stood in its column, which is where the desk stands once the panel leaves.
  const panelFoot = $state<{ left: number | null; right: number | null }>({
    left: null,
    right: null,
  });
  const notePanel =
    (side: "left" | "right"): Attachment<HTMLElement> =>
    (node) => {
      const note = () => (panelFoot[side] = node.offsetTop + node.offsetHeight);
      const observer = new ResizeObserver(note);
      observer.observe(node);
      note();
      return () => observer.disconnect();
    };
  const standDesk =
    (side: "left" | "right"): Attachment<HTMLElement> =>
    (node) => {
      // A screen that never showed the panel, such as another player's, stands the desk on the seat below it.
      const seat = node.parentElement?.querySelector<HTMLElement>(
        ":scope > .place.bl, :scope > .place.br",
      );
      const floor = seat ? seat.offsetTop - 10 : (node.parentElement?.clientHeight ?? 0) * 0.62;
      // The panel is as short as the actions left to take, so its foot can be high up the column. The deck still
      // has to stand clear of the seat above it and that seat's piles.
      const above = node.parentElement?.querySelector<HTMLElement>(
        ":scope > .place.tl, :scope > .place.tr",
      );
      const deck = node.querySelector<HTMLElement>("[data-turn-well]")?.offsetHeight ?? 0;
      const ceiling = above ? above.offsetTop + above.offsetHeight + 10 + deck : 0;
      node.style.top = `${Math.min(Math.max(panelFoot[side] ?? floor, ceiling), floor)}px`;
    };

  // Animate cards flying out of the Player/Infection deck into Package 6 when inoculated.
  let seenStoredPlayer = untrack(() => new Set(campaign.stored.player));
  let seenStoredInfection = untrack(() => new Set(campaign.stored.infection));
  $effect(() => {
    const nextPlayer = campaign.stored.player;
    const nextInfection = campaign.stored.infection;
    const lived = !spectator || announce;
    untrack(() => {
      const added: { id: CardId; pile: "player" | "infection" }[] = [
        ...nextPlayer
          .filter((id) => !seenStoredPlayer.has(id))
          .map((id) => ({ id, pile: "player" as const })),
        ...nextInfection
          .filter((id) => !seenStoredInfection.has(id))
          .map((id) => ({ id, pile: "infection" as const })),
      ];
      seenStoredPlayer = new Set(nextPlayer);
      seenStoredInfection = new Set(nextInfection);
      if (lived) flyToStorage(world, added);
    });
  });

  $effect(() => {
    const notice = session.notice;
    if (notice) untrack(() => toast(notice.text, "bad"));
  });

  // A seat's hand shows interchangeable cards as one pile, so hovering it lights what every card in it reaches.
  let hoveredCards = $state<CardId[]>([]);
  setContext("card-hover", (cards: CardId | CardId[] | null) => {
    hoveredCards = cards === null ? [] : [cards].flat();
  });

  // City cards read live copy state (in hand/deck, discarded, or out of play) without prop drilling.
  const campaignCityCopies = $derived.by(() => {
    const stored = new Set(campaign.stored.player);
    const counts: Partial<Record<CityId, number>> = {};
    for (const card of Object.values(campaign.playerCards)) {
      if (card.kind === "city" && !stored.has(card.id))
        counts[card.city] = (counts[card.city] ?? 0) + 1;
    }
    return counts;
  });
  const deckBuilt = $derived(
    game !== null &&
      info !== null &&
      (info.playerDeck.cards > 0 ||
        game.playerDiscard.length > 0 ||
        game.seats.some((seat) => game.players[seat]!.hand.length > 0)),
  );
  setContext("card-copies", (city: CityId): CityCardCopies => {
    const total = cityDef(city).playerCards;
    if (deckBuilt && info) {
      const at = info.playerDeck.cities[city];
      if (at || gridSet.has(city)) {
        const inPlay = (at?.inDeck ?? 0) + (at?.inHands ?? 0);
        const discarded = at?.discarded ?? 0;
        return { live: inPlay, discarded, trashed: Math.max(0, total - inPlay - discarded) };
      }
    }
    const inPlay = campaignCityCopies[city] ?? 0;
    return { live: inPlay, discarded: 0, trashed: Math.max(0, total - inPlay) };
  });
  setContext("epidemic-wearing-off", () => campaign.rules.includes("epidemicFromStorage"));
  setContext("campaign", () => campaign);
  const hoveredTargets = $derived.by(() => {
    const targets = hoveredCards.map((card) => cardTargets(world, snap.phase, card));
    return {
      cities: [...new Set(targets.flatMap((target) => target.cities))],
      seats: [...new Set(targets.flatMap((target) => target.seats))],
    };
  });

  const targetCities = $derived(
    new Set<CityId>(
      choosing.targeting ? (choosing.targeting.lit ?? choosing.targeting.cities.keys()) : [],
    ),
  );
  // A target being aimed at wins over a card the pointer happens to rest on.
  const hintCities = $derived(
    new Set<CityId>(!choosing.targeting && hoveredCards.length ? hoveredTargets.cities : []),
  );
  // The lines a player could draw show faintly while they pick where to draw one.
  const ghostEdges = $derived.by((): EdgeDef[] => {
    const aimed = choosing.targeting?.a;
    const drawing = aimed === "establishLine" || aimed === "chartLane" ? aimed : null;
    const from = choosing.here;
    if (!from || !drawing) return [];
    return actions.flatMap((action) =>
      action.a === drawing
        ? [
            {
              a: from,
              b: action.to,
              kind: drawing === "establishLine" ? ("land" as const) : ("sea" as const),
            },
          ]
        : [],
    );
  });
  const NONE_PICKED: ReadonlyMap<CityId, number> = new Map();
  const NO_SPOTS: ReadonlyMap<CityId, CitySpot> = new Map();
  let spots = $state.raw(NO_SPOTS);
  const NO_RECONS: ReadonlySet<string> = new Set();
  const boardView = createBoardView({
    get world() {
      return lapse.world ?? world;
    },
    get playing() {
      return playing;
    },
    get info() {
      return info;
    },
    get onGrid() {
      return gridSet;
    },
    get lag() {
      return show.lag;
    },
    get populationLag() {
      return population.lag;
    },
    get mapLag() {
      return legacy.lag;
    },
    get skull() {
      return show.skull;
    },
    get selected() {
      return choosing.ring;
    },
    get targets() {
      return targetCities;
    },
    get hints() {
      return hintCities;
    },
    get spots() {
      return spots;
    },
    get picked() {
      return choosing.targeting?.multi?.picked ?? NONE_PICKED;
    },
    get aimedRecons() {
      return choosing.targeting?.recons ?? NO_RECONS;
    },
    get ghostEdges() {
      return ghostEdges;
    },
    get recons() {
      return recons;
    },
    get spectator() {
      return spectator;
    },
    get canAct() {
      return canAct;
    },
    get solo() {
      return solo;
    },
    litPawn: (seat) =>
      pointedSeat === seat ||
      choosing.targeting?.pawn === seat ||
      (choosing.targeting?.pawns?.has(seat) ?? false),
    pickablePawn: (seat) => choosing.targeting?.pawns?.has(seat) ?? false,
    get session() {
      return session;
    },
    get fx() {
      return said.fx;
    },
    get marks() {
      return marks ?? population.marks;
    },
  });

  const tools = new MapTools(
    () => session,
    () => !spectator,
    () => board?.pointerBoardPoint() ?? null,
  );

  const keys = createGameKeys({
    get world() {
      return world;
    },
    get phase() {
      return snap.phase;
    },
    get canUndo() {
      return snap.canUndo;
    },
    get canAct() {
      return canAct;
    },
    get spectator() {
      return spectator;
    },
    get player() {
      return session.player;
    },
    tools,
    admin,
    covers,
    // The game's playback and Show board come off before any dialog under them.
    escapes: [
      () => lapse.playing && (lapse.stop(), true),
      () => peeking && ((peeking = false), true),
    ],
    cancel() {
      cancel();
      menu = false;
    },
    toggleHotkeys() {
      menu = false;
      hotkeysOpen = !hotkeysOpen;
    },
    send,
    toast,
  });
</script>

<svelte:window onkeydown={keys.onkeydown} onkeyup={keys.onkeyup} onblur={keys.onblur} />

{#snippet turnSlot(side: "left" | "right")}
  {#if game && admin.deck}
    <!-- The desk takes the panel's place for the rest of the turn, and everyone at the table sees it. -->
    <div
      class="desk-slot {side}"
      {@attach standDesk(side)}
      in:fly={{ x: side === "left" ? -220 : 220, duration: 320, delay: 240 }}
      out:fly={{ x: side === "left" ? -220 : 220, duration: 240 }}
    >
      <TurnDesk
        {side}
        deck={admin.deck}
        count={admin.count}
        left={admin.left}
        task={admin.task}
        action={admin.action}
        name={admin.seat ? seatName(world, admin.seat) : null}
        color={admin.seat ? seatColor(admin.seat) : "#f4e8cd"}
        epidemic={admin.epidemic !== null}
        stack={show.stack}
        exit={show.exit}
        gathering={game.gathering}
        shuffle={show.shuffle}
      />
    </div>
  {:else if game && !spectator && actionChoices.length && canAct && snap.phase === "playing.actions"}
    <div
      class="actions-slot"
      {@attach notePanel(side)}
      transition:fly={{ x: side === "left" ? -320 : 320, duration: 360, opacity: 0 }}
    >
      <ActionPanel
        {snap}
        seat={game.active}
        player={session.player}
        name={seatName(world, game.active)}
        menu={actionChoices}
        {live}
        {canAct}
        {owns}
        aiming={choosing.targeting?.a ??
          choosing.handPick?.a ??
          choosing.dockChoice?.a ??
          choosing.cardPick?.a ??
          null}
        onchoose={(choice) => choosing.step({ t: "start", a: choice.a, via: "panel" })}
        {send}
        onlockdown={(card) => choosing.step({ t: "lockdown", card })}
      />
    </div>
  {/if}
{/snippet}

{#snippet seated(place: Place)}
  {@const seat = seatAt?.get(place)}
  {#if seat && game}
    <div
      class="place {place}"
      class:open={openSeats.includes(seat)}
      data-place={place}
      data-seat={seat}
      role="group"
      onpointerenter={() => (pointedSeat = seat)}
      onpointerleave={() => pointedSeat === seat && (pointedSeat = null)}
      onfocusin={() => (pointedSeat = seat)}
      onfocusout={() => pointedSeat === seat && (pointedSeat = null)}
    >
      {#if corner}
        {@render corner(seat, place)}
      {:else}
        {#key seat}
          <div
            class="seated"
            in:fly={{ x: place === "tl" || place === "bl" ? -32 : 32, duration: 360, delay: 120 }}
          >
            <Corner
              highlighted={hoveredTargets.seats.includes(seat)}
              aimed={choosing.targeting?.pawns?.has(seat) ?? false}
              {seat}
              {place}
              {world}
              name={seatName(world, seat)}
              color={seatColor(seat)}
              selected={viewing === seat}
              showHand={seat !== dockSeat}
              arriving={hiddenCards}
              acting={snap.phase === "playing.actions"}
              action="Show this hand in the dock"
              selectedTag="Hand shown"
              onselect={() =>
                choosing.targeting?.pawns?.has(seat)
                  ? choosing.step({ t: "pawn", seat })
                  : (viewing = seat)}
            />
          </div>
        {/key}
      {/if}
      {#if openSeats.includes(seat)}
        <button
          class="take"
          style:--seat={seatColor(seat)}
          onclick={() => takeSeat(seat)}
          data-testid={`take-${seat}`}
          transition:fade={{ duration: 200 }}>Sit here as {seatName(world, seat)}</button
        >
      {/if}
    </div>
  {/if}
{/snippet}

<div
  class="game"
  class:peeking
  style:--left={`${panels.sides.low.left}px`}
  style:--right={`${panels.sides.low.right}px`}
  style:--high-left={`${panels.sides.high.left}px`}
  style:--high-right={`${panels.sides.high.right}px`}
  data-card-cities={hoveredTargets.cities.join(" ")}
  data-card-seats={hoveredTargets.seats.join(" ")}
  {@attach feedback("Game", () => ({
    phase: snap.phase,
    turn: game?.turn,
    active: game?.active,
    mine,
    canAct,
  }))}
>
  <TopBar
    {snap}
    {info}
    status={session.status}
    players={session.peers.filter((peer) => peer.connected).length}
    solo={session.mode === "solo" || spectator}
    legacyOut={legacyDeckOut}
    {canMonitor}
    {monitorReason}
    hasDrawings={!spectator && tools.hasDrawings}
    hasOwnDrawings={!spectator && tools.hasOwnDrawings}
    erasing={tools.tool === "eraser"}
    oneraser={() => tools.toggleEraser()}
    onclear={tools.clear}
    onreset={() => resetView++}
    peek={covered ? { on: peeking, toggle: () => (peeking = !peeking) } : null}
    onmenu={() => (menu = !menu)}
    onbox={() => (boxOpen = !boxOpen)}
    ondeck={() => (deckOpen = !deckOpen)}
    onscanner={openScanner}
    onspot={(next) => (spots = next ?? NO_SPOTS)}
  />

  <main class="stage" bind:this={stage} data-dest="map">
    <Board
      view={boardView}
      bind:this={board}
      oncity={(city) => choosing.step({ t: "city", city })}
      onrecon={(route) => choosing.step({ t: "recon", route })}
      oncityback={(city) => cancel() || takeBack(city)}
      oncancel={cancel}
      onmiss={choosing.closeRing}
      onpawn={(seat) => choosing.step({ t: "pawn", seat: seat as SeatId })}
      ring={choosing.ring && choosing.ringEntries.length
        ? {
            city: choosing.ring,
            entries: choosing.ringEntries.map((entry) => ({
              key: entry.a,
              label: entry.label,
              detail: entry.detail,
            })),
          }
        : null}
      onring={(key) => choosing.step({ t: "start", a: key, via: "ring" })}
      onpointer={(point) => tools.pointer(point)}
      tool={tools.tool}
      ondrawstart={tools.drawStart}
      ondrawmove={tools.drawMove}
      ondrawend={tools.drawEnd}
      onerasestart={tools.eraseStart}
      onerasemove={tools.eraseMove}
      oneraseend={tools.eraseEnd}
      {resetView}
      covered={panels.covered}
      focus={legacyFocus ?? showFocus ?? focus}
      handover={cubeFlights.fly}
    />

    {#if game && seatAt && snap.phase !== "upkeep"}
      <div class="column left" bind:this={leftColumn}>
        {@render seated("tl")}
        {#if seatAt.has("tr")}{@render turnSlot("left")}{/if}
        {@render seated("bl")}
      </div>
      <div class="column right" bind:this={rightColumn}>
        {@render seated("tr")}
        {#if !seatAt.has("tr")}{@render turnSlot("right")}{/if}
        {@render seated("br")}
      </div>
    {/if}
    {#if game && snap.phase !== "upkeep"}
      <div class="goals" bind:this={goals}>
        <Objectives
          {snap}
          held={briefingOpen &&
            campaign.briefing.some(
              (entry) => entry.t === "unlock" && entry.unlock.t === "objectives",
            )}
          heldIncidents={show.heldIncidents}
          surge={show.surge}
          onwaive={(objective) =>
            confirm(
              "Mark this objective impossible for this game? The remaining objectives then decide the win.",
            ) && send({ type: "WAIVE_OBJECTIVE", objective })}
        />
      </div>
    {/if}

    {#if picking && stage}
      <!-- A browser the table does not know yet, such as a new one, picks an open seat before any control is offered. -->
      <SeatPicker
        {stage}
        seats={openSeats.map((seat) => ({
          seat,
          place: [...seatAt!].find(([, at]) => at === seat)![0],
          name: seatName(world, seat),
          color: seatColor(seat),
        }))}
        onpick={takeSeat}
      />
    {/if}

    {#if choosing.cardPick}
      <CardPick
        pick={choosing.cardPick}
        {world}
        oncard={(card) => choosing.step({ t: "card", card })}
        onconfirm={() => choosing.step({ t: "cardConfirm" })}
        oncancel={cancel}
      />
    {/if}

    <Announcements toasts={said.toasts} banner={said.banner} {spectator} />

    {#if nextUp && !said.banner}
      {#key nextUp.key}
        <TurnInterlude
          name={nextUp.name}
          color={nextUp.color}
          seat={nextUp.seat}
          character={nextUp.character}
          danger={nextUp.danger}
          mine={nextUp.mine && !spectator}
          ondone={announced(nextUp.key)}
        />
      {/key}
    {/if}

    {#if fate.scene && game}
      {#key fate.scene.key}
        <FateShow
          scene={fate.scene}
          color={seatColor(fate.scene.who.seat)}
          epitaph={barkFor("epitaph", fate.scene.key).text}
        />
      {/key}
    {/if}

    {#if radio.line}
      {#key radio.line.key}<RadioLine line={radio.line} />{/key}
    {/if}

    {#if lapse.world}
      <TimeLapse world={lapse.world} progress={lapse.progress} onstop={() => lapse.stop()} />
    {:else if outcomeShown && lapse.ready}
      <button class="rewatch" onclick={() => void lapse.play()} data-testid="time-lapse-play">
        Play the game back
      </button>
    {/if}

    {#if outcomeShown && game?.outcome && !lapse.world}
      <div
        class="outcome"
        {@attach feedback("Outcome", () => game?.outcome)}
        class:won={game.outcome.won}
        in:scale={{ start: 0.7, duration: 600, easing: backOut }}
      >
        <strong>{game.outcome.won ? "Victory" : "Defeat"}</strong>
        <span>{game.outcome.reason}</span>
      </div>
    {/if}

    {#if briefingOpen}
      <!-- A spectator reads the briefing beside the board instead of in front of it, so what was just revealed stays in view. -->
      <Scrim
        label="New this game"
        kind={spectator ? "beside" : "table"}
        modal={!spectator}
        aside={legacy.aside}
        rise={spectator}
      >
        {#if spectator}
          <Briefing
            briefing={shownBriefing}
            {campaign}
            passive
            oncontinue={() => (briefingRead = briefingKey)}
          />
        {:else}
          <!-- Each new briefing is unpacked interactively over the map. -->
          {#key briefingKey}
            <Unboxing
              briefing={shownBriefing}
              {campaign}
              table={world.table}
              player={session.player}
              {solo}
              {send}
              ondeckout={(out) => (legacyDeckOut = out)}
              paused={legacy.aside}
            />
          {/key}
        {/if}
      </Scrim>
    {:else if recap}
      <Scrim label="What the reading changed" rise onclose={() => (recap = null)}>
        <Briefing
          briefing={recap}
          {campaign}
          passive={false}
          recap
          oncontinue={() => (recap = null)}
        />
      </Scrim>
    {:else if choosingCharacters}
      <Scrim label="Choose characters" kind="open" drops>
        <CharacterSelect
          {snap}
          {send}
          player={session.player}
          rename={(name) => session.rename(name)}
          onfocus={(look) => {
            const box = stage?.getBoundingClientRect();
            focus =
              look && box
                ? {
                    city: look.city,
                    x: (look.x - box.left) / box.width,
                    y: (look.y - box.top) / box.height,
                  }
                : null;
          }}
        />
      </Scrim>
    {:else if snap.phase === "lobby" || snap.phase === "finished"}
      <Scrim label="Lobby">
        <Lobby
          {snap}
          {send}
          player={session.player}
          rename={(name) => session.rename(name)}
          onintro={() => {
            storyInitial = STORY_SCENES.prelude ?? null;
            storyOpen = true;
          }}
        />
      </Scrim>
    {:else if snap.phase === "upkeep" && population.pending}
      <div class="population-caption" role="status" data-testid="population-show">
        <span>Game end · Population</span>
        <b>{population.shown} of {population.total}</b>
        <button onclick={() => population.stop()} data-testid="population-skip">Skip</button>
      </div>
    {:else if snap.phase === "upkeep"}
      <Scrim
        label="Between games"
        kind="upkeep"
        aside={upkeepAside}
        modal={!upkeepAside}
        bind:element={upkeepScrim}
      >
        <Upkeep
          {snap}
          {send}
          player={session.player}
          {spectator}
          aside={upkeepAside}
          onaside={(aside) => (upkeepAsideChosen = aside)}
        />
      </Scrim>
    {/if}

    {#if revealing && game}
      <Scrim label="Cards turned over" kind="reveal">
        <RevealShow {world} pending={revealing} mine={!spectator && owns(revealing.seat)} {send} />
      </Scrim>
    {/if}

    {#if scarOwed && game && !fate.playing}
      <Scrim label="Choose a scar" kind="scar">
        <ScarChoice
          {world}
          seat={scarOwed.seat}
          {decides}
          chooser={scarOwed.chooser}
          canChoose={owns(scarOwed.chooser)}
          {send}
        />
      </Scrim>
    {/if}

    {#if replacing && game && !fate.playing}
      <Scrim label="Choose who steps in" kind="scar">
        <Replacement {world} seat={replacing} {decides} canChoose={owns(replacing)} {send} />
      </Scrim>
    {/if}

    {#if scarVoting && game && !fate.playing}
      <Scrim label="Vote for who takes the scar" kind="scar">
        <ScarVote {world} vote={scarVoting} player={session.player} {spectator} {send} />
      </Scrim>
    {/if}

    {@render children?.()}

    {#if boxOpen}
      <Scrim label="The box" kind="box" rise clickaway onclose={() => (boxOpen = false)}>
        <LegacyBox {campaign} onclose={() => (boxOpen = false)} />
      </Scrim>
    {/if}

    {#if deckOpen}
      <Scrim label="The Legacy deck" kind="box" rise clickaway onclose={() => (deckOpen = false)}>
        <LegacyDeck {campaign} onclose={() => (deckOpen = false)} />
      </Scrim>
    {/if}

    {#if choosing.chooser?.action === "monitor" || scannerOpen}
      {@const monitorOptions =
        choosing.chooser?.action === "monitor" ? choosing.chooser.options : null}
      {@const legalFrequencies = monitorOptions
        ? new Set(
            monitorOptions.flatMap((option) =>
              option.frequency !== undefined ? [option.frequency] : [],
            ),
          )
        : undefined}
      {@const closeScanner = () =>
        monitorOptions ? void choosing.step({ t: "closeChooser" }) : void (scannerOpen = false)}
      <Scrim label="Frequency Scanner" kind="box" rise clickaway onclose={closeScanner}>
        <ScannerDialog
          {campaign}
          legal={legalFrequencies}
          reason={monitorOptions ? null : monitorReason}
          onpick={monitorOptions
            ? (frequency) => {
                const index = monitorOptions.findIndex((option) => option.frequency === frequency);
                if (index >= 0) choosing.step({ t: "option", index });
              }
            : undefined}
          onclose={closeScanner}
        />
      </Scrim>
    {/if}

    {#if world.table.undoVote && game && !spectator}
      <Scrim label="Shameful undo vote" kind="undo">
        <UndoVote {world} vote={world.table.undoVote} player={session.player} {send} />
      </Scrim>
    {/if}

    {#if hotkeysOpen}
      <Scrim
        label="Keyboard shortcuts"
        kind="box"
        rise
        clickaway
        onclose={() => (hotkeysOpen = false)}
      >
        <Hotkeys onclose={() => (hotkeysOpen = false)} />
      </Scrim>
    {/if}

    {#if storyOpen}
      <Scrim label="Campaign story log" kind="box" clickaway onclose={closeStory}>
        <StoryArchive {campaign} initialScene={storyInitial} onclose={closeStory} />
      </Scrim>
    {/if}

    {#if menu}
      <GameMenu
        {session}
        {spectator}
        canVacate={game !== null && !solo && !spectator && mine.length > 0}
        {toast}
        onclose={() => (menu = false)}
        onstory={(scene) => {
          storyInitial = scene;
          storyOpen = true;
        }}
        onhotkeys={() => (hotkeysOpen = true)}
        onvacate={() => send({ type: "LEAVE", player: session.player })}
      />
    {/if}
    {#if !spectator && game}
      <EpidemicSequence
        {world}
        increasing={admin.increasing}
        side={seatAt?.has("tr") ? "right" : "left"}
      />
    {/if}
  </main>

  {#if game && snap.phase !== "upkeep" && !spectator}
    <!-- No tray: the hand and whatever the turn asks for float over the bottom of the map. -->
    <div class="dock-layer">
      <Dock
        {snap}
        {canAct}
        player={session.player}
        {spectator}
        {owns}
        seat={dockSeat!}
        home={home!}
        {plays}
        {decides}
        {send}
        onview={(seat) => (viewing = seat)}
        aiming={choosing.targeting
          ? {
              label: choosing.targeting.label,
              a: choosing.targeting.a,
              prompt:
                choosing.targeting.prompt ??
                (choosing.targeting.cities.size === 1
                  ? "Click the lit city on the map."
                  : `Click one of the ${choosing.targeting.cities.size} lit cities on the map.`),
              confirm: choosing.targeting.multi
                ? {
                    label: `${choosing.targeting.multi.verb}: ${choosing.targeting.multi.count} of up to ${choosing.targeting.multi.max}`,
                    ready: choosing.targeting.multi.ready,
                  }
                : choosing.targeting.skip
                  ? { label: choosing.targeting.skip, ready: true }
                  : null,
              held: Boolean(choosing.targeting.skip),
            }
          : null}
        onaimconfirm={() => choosing.step({ t: "aimConfirm" })}
        onchip={(key) => choosing.step({ t: "chip", key })}
        handPick={choosing.handPick}
        dockChoice={choosing.dockChoice}
        onhandcard={(seat, card) => choosing.step({ t: "handCard", seat, card })}
        onhandconfirm={() => choosing.step({ t: "handConfirm" })}
        onhandtoggle={() => choosing.step({ t: "handToggle" })}
        oncancel={cancel}
        uses={choosing.cardUses}
        onplaycard={(seat, card) => choosing.step({ t: "play", seat, card })}
        onproducecard={(seat, card) => {
          const produceUses = choosing
            .cardUses(seat, card)
            .filter((tag) => tag.key.startsWith("produce:"));
          const legal = produceUses.filter((tag) => !tag.disabled);
          if (legal.length === 1) legal[0]!.run();
          else if (legal.length > 1) choosing.step({ t: "start", a: "produce", via: { card } });
          else produceUses[0]?.run();
        }}
        onlockdown={(card) => choosing.step({ t: "lockdown", card })}
        arriving={hiddenCards}
        opening={admin.opening || (snap.phase === "setup.events" && show.playing)
          ? game.infectionsLeft
          : null}
      />
    </div>
  {/if}
  {#if game}
    <CardFlights
      reveals={admin.turn.reveals}
      epidemic={admin.epidemic}
      canStart={canAct && !spectator}
      onstart={admin.start}
      onlanded={(key) => {
        sfxMoment("cardLand");
        admin.turn.landed(key);
      }}
      dest={flightDest}
    />
  {/if}
</div>

<style>
  .game {
    position: fixed;
    /* A page that hosts the game beside something else, such as the replay viewer, sets the inset. */
    inset: var(--game-inset, 0);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-columns: minmax(0, 1fr);
    background: var(--table);
    color: var(--ink);
    font-family: var(--font-ui);
    font-variant-numeric: tabular-nums;
    overflow: hidden;
  }

  .stage {
    position: relative;
    grid-row: 2;
    grid-column: 1;
    min-height: 0;
  }

  /* Shares the stage's cell, lying over the bottom of the map between the side columns. */
  .dock-layer {
    position: relative;
    z-index: 35;
    grid-row: 2;
    grid-column: 1;
    align-self: end;
    margin-left: calc(var(--left) + 0.7rem);
    margin-right: calc(var(--right) + 0.7rem);
    pointer-events: none;
  }

  /* The seats sit in the corners, with the Actions panel between them on one side. */
  .column {
    position: absolute;
    top: 0.7rem;
    bottom: 0.7rem;
    z-index: 30;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    width: 15.5rem;
    pointer-events: none;
    /* A seat card is narrower than the column, which the Actions panel and the desk still fill. */
    --seat-card: 11.6rem;
  }

  .column > :global(*) {
    pointer-events: auto;
  }

  /* A seat's character sheet or expanded hand opens above the dock, objectives, actions panel, and prompts. */
  .column:has(:global([data-testid="character-sheet"], [data-testid="corner-full-hand"])) {
    z-index: 52;
  }

  .place:has(:global([data-testid="character-sheet"], [data-testid="corner-full-hand"])) {
    z-index: 10;
  }

  .column.left {
    left: 0.7rem;
  }

  .column.right {
    right: 0.7rem;
    align-items: flex-end;
  }

  .place,
  .seated {
    width: var(--seat-card);
  }

  .place.bl,
  .place.br {
    margin-top: auto;
  }

  /* The action list sits in whichever side column has room, beside the seats. */
  .actions-slot {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 15.5rem;
    min-height: 0;
    flex: 0 1 auto;
  }

  /* The desk stands with its foot where the panel's was, out of the column's flow, so nothing moves to make room. */
  .column > .desk-slot {
    position: absolute;
    left: 0;
    z-index: 1;
    translate: 0 -100%;
    pointer-events: none;
  }

  .column > .desk-slot.right {
    right: 0;
    left: auto;
  }

  .column.left .actions-slot {
    align-self: flex-start;
  }

  /* On the right it stands on the player's own seat, above the controls that end the turn. */
  .column.right .actions-slot {
    margin-top: auto;
  }

  .column.right .actions-slot + .place.br {
    margin-top: 0;
  }

  /* Centred over the room between the side panels, where the fitted board sits, so a wide panel never reaches it. */
  .goals {
    position: absolute;
    top: 0.6rem;
    left: calc((var(--high-left, 0px) + 100% - var(--high-right, 0px)) / 2);
    z-index: 30;
    transform: translateX(-50%);
  }

  .place {
    position: relative;
  }

  /* An open seat glows in its colour and takes the whole corner as its button. */
  .place.open > .seated {
    filter: saturate(0.6) brightness(0.8);
  }

  .take {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: grid;
    place-items: center;
    min-height: 4rem;
    border: 2px dashed var(--seat);
    border-radius: 4px;
    background: color-mix(in srgb, var(--seat) 16%, rgb(10 8 6 / 0.55));
    color: var(--paper);
    font: inherit;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    animation: beckon 1.6s ease-in-out 4;
  }

  .take:hover {
    border-style: solid;
    background: color-mix(in srgb, var(--seat) 32%, rgb(10 8 6 / 0.55));
  }

  @keyframes beckon {
    50% {
      box-shadow: 0 0 1.4rem color-mix(in srgb, var(--seat) 70%, transparent);
    }
  }

  /* While the population show plays on the board, the spending sheet waits: only this line stands over the table. */
  .population-caption {
    position: absolute;
    bottom: 1.2rem;
    left: 50%;
    z-index: 46;
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.4rem 0.5rem 0.4rem 1rem;
    border: 1px solid var(--line);
    border-radius: 2px;
    background: var(--panel-solid);
    color: var(--ink);
    font-size: 0.9rem;
    translate: -50% 0;
  }

  .population-caption span {
    font-family: var(--font-display);
    font-size: 1.05rem;
  }

  .population-caption b {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .population-caption button {
    padding: 0.2rem 0.7rem;
    border: 1px solid var(--line);
    border-radius: 2px;
    background: none;
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }

  .population-caption button:hover,
  .population-caption button:focus-visible {
    border-color: var(--ink);
  }

  .rewatch {
    position: absolute;
    top: calc(28% + 8.2rem);
    left: 50%;
    z-index: 46;
    padding: 0.35rem 1rem;
    border: 1px solid var(--line);
    border-radius: 2px;
    background: var(--panel-solid);
    color: var(--ink);
    font: inherit;
    font-size: 0.9rem;
    translate: -50% 0;
    cursor: pointer;
  }

  .rewatch:hover,
  .rewatch:focus-visible {
    border-color: var(--good);
    color: var(--good);
  }

  .outcome {
    position: absolute;
    top: 28%;
    left: 50%;
    z-index: 46;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 1.3rem 3.5rem 1.5rem;
    border: 1px solid var(--danger);
    border-radius: 2px;
    background: rgb(20 18 14 / 0.9);
    color: var(--danger);
    translate: -50% 0;
    pointer-events: none;
  }

  .outcome.won {
    border-color: var(--good);
    color: var(--good);
  }

  .outcome strong {
    font-family: var(--font-display);
    font-size: 3.6rem;
    font-weight: 400;
    line-height: 1;
  }

  .outcome span {
    color: var(--ink);
    font-size: 1rem;
  }

  /* The top bar's slips, such as a deck's, hang over the board's panels. */
  .game > :global(:first-child) {
    position: relative;
    z-index: 55;
    grid-row: 1;
    grid-column: 1;
  }
</style>
