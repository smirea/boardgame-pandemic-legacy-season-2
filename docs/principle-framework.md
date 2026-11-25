# Principle Framework: Building Rich Interactive Multiplayer Web Applications

> **How to use this document**
> This is a portable design, UX, architecture, and infrastructure framework distilled from building a full-featured, 3D, real-time multiplayer digital tabletop application from scratch through hundreds of human-in-the-loop design iterations.
>
> Give this document to an agent starting a new project with **no other context**. It defines the aesthetic bar, interaction grammar, engineering invariants, tradeoffs, and anti-patterns required to reach the same quality of outcome—without prescribing project-specific filenames or domain rules.

---

## Table of Contents

1. [North-Star Product Axioms](#1-north-star-product-axioms)
2. [Visual Design Language & Aesthetics](#2-visual-design-language--aesthetics)
3. [Interaction Design & UX Grammar](#3-interaction-design--ux-grammar)
4. [Multiplayer Ergonomics & Shared Tabletop Presence](#4-multiplayer-ergonomics--shared-tabletop-presence)
5. [Motion, Pacing, Audio & Living World](#5-motion-pacing-audio--living-world)
6. [Core Architecture & State Design](#6-core-architecture--state-design)
7. [Networking, Sync & Deployment Infrastructure](#7-networking-sync--deployment-infrastructure)
8. [Performance Engineering & Runtime Budgets](#8-performance-engineering--runtime-budgets)
9. [Debugging, Feedback & Verification Infrastructure](#9-debugging-feedback--verification-infrastructure)
10. [Decision & Tradeoff Matrix](#10-decision--tradeoff-matrix)
11. [Catalog of Anti-Patterns to Reject on Sight](#11-catalog-of-anti-patterns-to-reject-on-sight)
12. [Day-Zero Project Bootstrap Checklist](#12-day-zero-project-bootstrap-checklist)

---

## 1. North-Star Product Axioms

### 1.1 Build for the real audience, not an imaginary enterprise
Scope ruthlessly to who actually uses the product. For a personal or trusted-friends multiplayer system:
- **No accounts, no room browsers, no matchmaking, no anti-cheat / state redaction, no multi-tenant database.** One shared passphrase is the entire access control.
- Every layer of imaginary SaaS infrastructure you skip is engineering budget reinvested into responsiveness, animation craft, audio, QOL, and polish.

### 1.2 Target the real viewport honestly
If a rich spatial interface (a map, board, canvas, or dense dashboard) is built for laptop screens, design uncompromisingly for laptop screens (`1280×720` through `1920×1080`).
- **Fit the entire primary workspace on one screen with zero full-page scroll.**
- Do not degrade desktop ergonomics, hide controls behind hamburger menus, or shrink focal canvases to accommodate a phone viewport the product does not target.

### 1.3 Adapt physical domains to the digital medium—never mimic blindly
When digitizing a tabletop game, physical workflow, or analog tool:
- **Preserve 100% fidelity to the underlying rules, content, narrative, and tactile soul.**
- **Replace physical compromises with superior digital affordances.** Turn paper checkboxes into live counters (`"3 uses left"`). Hide spent one-time prompts to reclaim space. Drop printed warning paragraphs the rules engine already enforces. Compute probabilities, deck compositions, and searchable live rules automatically.
- **Keep a bridge to the source for trust and verification.** When generating crisp digital counterparts of printed artifacts, offer a zero-chrome hold-to-peek hotkey (e.g., holding `O`) that swaps generated artifacts to their reference scans in place.

### 1.4 Fidelity over misguided self-censorship
For private, personal, or friends-only builds, keep the authentic source content, story, flavor text, and terminology intact. Do not silently strip, paraphrase, or bowdlerize content out of unrequested assumptions about public distribution.

### 1.5 Quality of Life (QOL) is a first-class feature
Never force humans to count, remember, or cross-reference information the engine already knows:
- Surface exact live counts, deck layers, draw probabilities, tiered risk indicators, and copy-status pips (in deck / discarded / permanently removed).
- Provide a **spoiler-free live reference** (rulebook / archive) that dynamically reflects *only* what has been unlocked up to the current state, with instant search.
- Provide frictionless **Undo** for routine mistakes—and a playful **unanimous group-vote Undo** when taking back an action that revealed hidden information.

### 1.6 Zero backwards compatibility during active development
While iterating toward completion, never carry migration shims, legacy defaults, or dual rendering paths for old save formats or superseded UI designs:
- Strict parsers reject stale shapes immediately.
- Update canonical test/campaign fixtures in lockstep with schema changes.
- Delete superseded code and UI paths completely; dead fallbacks breed subtle bugs and split maintenance.

### 1.7 Opinionated defaults over configuration sprawl
Resist adding settings toggles (e.g., animation pacing modes, layout variants) unless a real operational need exists. Ship the intended, highest-craft experience as the single default (including audio enabled by default, with user volume/mute choices persisted cleanly).

---

## 2. Visual Design Language & Aesthetics

### 2.1 "Show, don't tell—and never do both"
This is the single highest-leverage visual rule. Every word on screen must earn its pixels.
- If an animated border, glow, icon, spatial position, or counter already communicates state, **delete all prose saying the same thing.**
- Purge instructional onboarding sentences (*"Choose one from the list, click a city, or hover a card"*), category kickers (*"Ability"*, *"Occupation"*, *"Infection"*, *"Playing"*), redundant counters (*"4 actions left"* when 4 pips are visible), static map legends, redundant boundary lines (a dotted line tracing the edge of an already-visible fog of war), and placeholder copy (*"1 empty slot for..."*—just draw the empty slot).
- Never duplicate the same information across two simultaneous surfaces (e.g., writing a card's rules in a prose summary right beside the card itself).

### 2.2 Boxless, full-bleed, low-chrome surfaces
Avoid wrapping UI elements in opaque rectangular cards or bordered containers by default. Boxes add nested margins and padding that consume precious viewport area without adding clarity.
- **Float primary objects directly over the canvas** (player hands, incident diamonds, character figures, status tracks) without wrapper panels.
- **Run artwork and headers full-bleed** inside cards and overlays, using subtle scrims or hairline separators (`— OR —`) instead of boxed sub-panels.
- **Let figures and effects breathe past their bounds.** Character cutouts stand on a bold colored cut line (angled or baseline) with transparent backgrounds and `overflow: visible` so heads, hands, props, and active glows spill naturally into space (with low z-index so spills never block clicks).
- **Dark, quiet peripheral chrome framing one bright focal workspace.** Use a single deliberate theme (e.g., dark table/chrome framing a warm illuminated chart). High-chroma colors are reserved exclusively for semantic signals (player seats, categories, risk levels, status effects).

### 2.3 Zero scrolling on primary views and overlays; dynamic auto-fitting
Scrollbars inside game screens, selection overlays, pickers, or archive spreads are a layout failure.
- **Use measurement-driven fitting primitives**, never `text-overflow: ellipsis`:
  - `fitText`: binary-searches font size via `ResizeObserver` (and `document.fonts.ready`) so card/title text uses the largest legible size that fits with zero clipping.
  - `fitGroup`: fits a set of sibling panels (e.g., abilities/scars on a character sheet) to one uniform font size so nothing looks ragged.
  - `fitZoom`: dynamically scales variable-size card/piece spreads (unboxing, archives, pickers) using CSS `zoom` (measuring layout, never animated transforms) so everything stays visible on one screen regardless of item count.
- **Design for generous text legibility.** Rich spatial UIs viewed from laptop distance need larger typography (~1.15–1.2× standard web defaults). Pair an atmospheric display/serif face for titles and world labels with a crisp condensed sans-serif for dense UI copy.
- **Degrade top bars gracefully by priority.** When horizontal space tightens, collapse low-urgency items first (e.g., future calendar months, then past months) before crowding live counters or buttons.

### 2.4 One unified visual grammar
Never invent one-off styles for equivalent concepts across different screens:
- **One attention highlight (`Beacon`):** Use the exact same unmistakable animated highlight (e.g., a masked spinning gold border with subtle glow) everywhere the user is expected to click next—canvas locations, pieces, hand cards, decks, seats, and overlay choices. Use color variants of the *same* primitive strictly for passive spotlighting (red/yellow/grey risk tiers, distinct threat hue).
- **One inline symbology renderer (`RichText`):** Wherever prose refers to a domain entity (card, resource cube, port, hazard, structure, scar, package), render a crisp, vertically aligned, color-matched inline icon alongside or instead of the word. Use this component universally across cards, action rows, tooltips, briefings, and logs.
- **Single source of color truth & universal contrast:** Every entity color (card face, location category, seat identity) must come from one shared helper so mini-piles, glyphs, tooltips, tokens, vote pips, and borders never disagree. Seat colors stay stable regardless of player count. Colored badges or numbers placed over varied backgrounds (e.g., status numbers on differently colored discs) carry a contrasting dark outline so they remain legible on every background—never relying on contrast against only one color.
- **Show real components, never text descriptions of them:** Briefings, unboxing spreads, archives, pickers, and tooltips should display the actual styled cards, tokens, markers, and character figures—not plain bulleted text describing them.
- **Every ambient signifier must justify itself.** Never leave unexplained rings, dots, or badges floating on the canvas; if hovering it doesn't explain it, players read it as a bug—either make it self-explanatory on hover or delete it.

### 2.5 Bespoke, art-directed asset pipelines
Never leave generic SVG boxes or emoji placeholders in a finished UI:
- **Procedural generation for systematic visuals:** Generate world charts, card map-and-pin crops, fog-of-war shaders, beveled 3D tokens, and structured layouts algorithmically so every entity gets consistent, sharp, resolution-independent visuals.
- **AI-generated bespoke artwork for organic identity:** Use image-generation pipelines for transparent character cutouts, monochrome transparent card emblems, companion portraits, and grunge/thematic icons.
  - Enforce art direction programmatically: consistent facing direction (mirror figures placed on the opposite side of the screen so everyone looks *inward* toward the table), transparent backgrounds, head-crop bounding metadata for derived portraits, and explicit visual separation between player avatars and story NPCs.
  - **Audition small samples visually before batch-generating** a full set.
- **Map typography & placement craft:** Print geographic labels directly onto the canvas layer (so pieces sit naturally above them), use subtle contrast halos rather than heavy boxes, highlight the printed name on hover, and draw thin solid leader lines whenever an offset label's ownership could be ambiguous.

### 2.6 Spatial Canvas, 3D Tabletop Craft & Diegetic HUD Layout
When the core surface is a 3D board, map, or spatial canvas:
- **Intentional, deterministic 3D—never a physics sandbox.** Use 3D for tactile presence, silhouettes, camera choreography, and crisp piece attachment—not generic physics tumbling. Every piece snaps cleanly to semantic anchor slots (e.g., distinct fixed positions around a location for hubs, resources, hazards, structures, and fanned-out multi-pawn layouts so pieces never pile on top of one another).
- **Distinct 3D silhouettes & camera-aware framing.** Give every piece class an unmistakable silhouette (beveled tokens, distinct structure models angled ~45° so their profile reads clearly from the default overhead camera, contextual morphing on travel—car/boat/plane—matching the mode of transport).
- **Clean, legible route geometry.** Draw connections as smooth arches or beziers that respect geography (sea routes stay on water, land routes stay on land, avoiding uncharted ground and unnecessary intersections) with subtle contrasting outlines so lines stay readable over varied terrain. Drop artificial drop-shadows beneath flat routes.
- **Fit camera to explored bounds only.** Start fitted to the currently active/revealed region rather than zooming out across empty fog; linger on focused locations during multi-step reveals and zoom back to fit only when the phase finishes.
- **Diegetic table placement & stable spatial anchors.**
  - Where a resource conceptually lives on the table (e.g., a shared supply stockpile), render it as physical pieces on a guaranteed-clear spot of the canvas inside the default frame instead of adding another numeric counter to the top bar.
  - Anchor multiplayer seats consistently in screen corners in clockwise turn order with **the local player fixed in the bottom-right** (never shuffling corners when turns pass). Keep corner cards minimal at rest (legible name, core abilities/traits, physical carried tokens along the cut-line—dropping secondary metadata like home/tracks) and expand into the full sheet + fanned hand on hover.
  - Keep the top bar compact: icon + count summaries always visible (collapsed timeline/calendar expanding on hover), goals/objectives centered at the top with crisp symbology and crisis pips directly underneath.

### 2.7 Ban browser-default UI chrome & footer clutter
- **Zero HTML `title` attributes anywhere.** Native browser hover tooltips look janky, delay inconsistently, and collide with custom UI. Use `aria-label` for accessibility and custom styled tooltips for hover content.
- **Block password managers globally.** Run a root-level `MutationObserver` stamping `autocomplete="off"` and manager-specific opt-outs (`data-1p-ignore`, `data-lpignore`, `data-bwignore`, `data-protonpass-ignore`, `data-form-type="other"`) onto every `input`, `textarea`, `select`, and `form`—including dynamically mounted ones.
- **Keep overlay footers razor-minimal.** Show only the primary continuation control (e.g., `Continue` or `VoteButton`). Don't clutter footers with redundant voice/replay toggles (those live once in the global audio control) or noisy `"Space"` keycap hints (hotkeys still work silently and live in the `?` reference).

---

## 3. Interaction Design & UX Grammar

### 3.1 Direct manipulation on the workspace—ban modal option lists
Whenever an action operates on game objects, players, or cards, **let the user click the actual objects directly**:
- Spatial actions light valid locations or pieces on the board; clicking a node directly opens a compact radial ring of legal actions there.
- Card-discard or card-payment flows highlight eligible cards directly inside the player's hand dock (single-card cost fires on click; multi-card cost toggles selection with a dock confirm).
- Picking from a discard pile, another player's hand, or a deck fans the *real cards* out in front of the table (`CardPick`).
- **Rule of thumb:** If you are about to build a dark modal dialog containing a vertical list of text buttons or `<select>` dropdowns, stop and redesign it as direct manipulation on the board, cards, or seats.

### 3.2 Anchor sequential workflows to eliminate mouse travel
Don't force players to bounce their cursor across opposite corners of the screen during routine multi-step sequences:
- When a player finishes their action phase, slide the action panel away and bring the next phase's interactive deck/control directly into that same ergonomic anchor zone.
- Stack drawn cards so every previously flipped card keeps its title visible; hovering a card in the stack brings it forward and spotlights its location on the canvas.

### 3.3 Balance zero-friction repeatability with explicit agency
Two complementary rules govern when an interaction executes immediately vs. asks for confirmation:
1. **Repeatable / zero-target / cheap reversible actions fire 1× immediately on click.** Don't pop a quantity modal for `"Pick up 1..N"` or `"Deliver 1..N"`—one click does 1×, repeated clicks do more, and Undo reverses mistakes effortlessly. During setup placement, right-click decrements/removes.
2. **Any action that takes a choice or target MUST remain explicit—even when only one target currently exists.** Never silently auto-fire a targeted action or pick a card at random just because there's only 1 valid option today; highlight the single valid option and wait for the click so the mental model stays predictable and transparent.

### 3.4 Concise action surfaces & predictable ordering
- **Show only legal actions by default** in the active action panel, collapsing currently unavailable actions behind an expandable `(+N unavailable)` section that states the exact rule preventing each one.
- **Avoid combinatorial spam.** Describe multi-card costs succinctly (`"5 [blue card] cards"`) instead of enumerating every subset combination.
- **Group repeated history entries** (`×3` right-aligned) and sort hands predictably by one universal comparator everywhere (dock, corner mini-piles, expanded hover hands).
- **Consistent cancellation everywhere:** `Escape` (closing the topmost active layer via a shared stack) and right-click cancel any half-chosen action cleanly.

### 3.5 Hover-driven progressive disclosure & interactive tooltips
Hover is the primary inspection channel—clicks should perform actions, not merely open info drawers:
- **Cross-surface hover linking:**
  - Hovering a card highlights its relevant targets (cities, hubs, or player seats) across the board and HUD.
  - Hovering a seat card expands it into the full character sheet, fans out that player's complete hand in full size, and lights their piece on the board.
  - Hovering a top-bar risk/status counter spotlights matching locations on the board with large, color-tiered probability readouts (`red` highest, `yellow` medium, `grey` lower).
  - Hovering a location during creation/selection smoothly pans the camera to it.
- **Tooltip craftsmanship:**
  - Position city/node tooltips on the side *away* from the label they illuminate (staying inside viewport bounds).
  - Lead with active status effects (colored badge + 1-line plain rule explanation) above aligned label-value rows (never write `"No cubes"`—write `Supply cubes: 0` in red).
  - **Make rich summary tooltips hoverable** (move pointer into the tooltip without it closing) so players can inspect grouped sub-sections and preview individual cards/items inside decks or storage.

### 3.6 Preserve spatial context on every blocking screen
Every full-screen overlay (lobby, character selection, narrative briefing, scar/upgrade choice, archive/box viewer, between-games shop) **must** support a universal **"Show board"** toggle in the top bar (or step-aside mode for spending screens) that hides or slides the overlay away so players can pan, zoom, and inspect the live board before deciding, then return via `"Back"` or `Escape`.

### 3.7 Keyboard-first shortcuts with strict input isolation
- Wire intuitive global hotkeys (`WASD`/arrows to pan, `Space` to advance the current step, `Z` to undo, `F` for freehand map pen, `Tab` for board ping, `O` to hold-peek original scans, `?` for hotkey reference).
- **Hard invariant:** Every global hotkey handler must check whether focus is inside any text field (`input`, `textarea`, `select`, `contenteditable`) **or inside an open overlay/shadow DOM** (such as the Feedback editor) and yield completely so typing never triggers game shortcuts.

---

## 4. Multiplayer Ergonomics & Shared Tabletop Presence

### 4.1 One unified consensus voting primitive
Every table-wide decision—starting a session, readying characters, finishing an unboxing sequence, advancing past game end, closing between-games upkeep, voting on a shared penalty, or approving an info-revealing Undo—uses the **exact same `VoteButton` component**:
- Displays one equal-sized pip per seated player: empty socket while pending, glowing filled pip in the player's seat color once voted.
- Lists explicitly who the table is waiting on (or notes split votes when consensus on a target is required).
- Automatically hides pips in solo play.
- **Never deadlocks on departure:** If a player vacates their seat or disconnects, every open vote immediately re-evaluates against the remaining seated players.

### 4.2 Seamless seating, identity & solo multi-hand parity
- **Persist a stable `playerId` per browser** so reloads drop the player straight back into their exact seat without re-entering a lobby.
- **Mid-game arrivals** without a seat see vacant seats highlighted directly on the board with a centered prompt and curved arrows pointing to each open spot.
- **Always allow seat swapping** via `"Vacate my seat"` in the menu.
- **First-class solo multi-hand mode:** A single player controlling multiple seats plays seamlessly, with the active hand dock automatically following the active turn seat.
- **Collaborative shared drafts:** Multi-step creation flows (like building a shared roster character) store draft state inside synced table state so every browser sees and contributes to the same form live.

### 4.3 Synced step-by-step tabletop reveals
Never run multi-card reveals, deck draws, or narrative sequences on local client timers or loops hidden inside a single engine transition:
- **One explicit command per card flip / reveal step / phase gate.** Every player sees the exact same card turn over, scratch open, or escalate at the exact same moment, and reactive plays/interrupts remain legal between beats.
- **All screens witness major table interactions**, not just the active player: end-of-turn card draws, searches, scars, epidemics, and story reveals play in shared view (with watchers seeing status labels instead of action buttons).

### 4.4 Shared ambient presence & tabletop expression
Make remote play feel like leaning over one physical table:
- **Live multiplayer cursors** on a lossy lane (player color + name that fades cleanly at rest).
- **Shared freehand map drawing** (hold `F` to draw, eraser tool, `"Erase mine"` clearing only your own strokes—never wiping teammates' annotations) persisted asynchronously on the host outside game state so a reload keeps the table's markings without polluting game state or hurting frame rate.
- **Shared pings** (`Tab` drops an animated 10-second pulse at the cursor; multiple simultaneous pings allowed).

### 4.5 Safe peer empowerment vs. host authority
- Give peers full non-destructive agency: inspect everything, export saves, request the live recording from the host to download or save into their own local replay library.
- Keep campaign-destructive actions (New campaign, Load/Import save, Load canonical fixture) restricted to the host so no peer can accidentally wipe the table's progress.

---

## 5. Motion, Pacing, Audio & Living World

### 5.1 State never waits for animation—drive shows from the append-only log
**Core architectural pattern:** The state machine transitions immediately and deterministically. Visual "shows" (piece flights, infection sequences, population tallies, death memorials, map reveals) observe new entries in the append-only game log via a shared `LogWatch` helper and compute a **visual lag** (`$effect.pre`) before the frame renders.
- **Why this wins:**
  1. Players can keep interacting without artificial input locks.
  2. Remote peers and `/replay` viewers automatically play the exact same choreography with zero extra network events.
  3. Jumps, undos, page reloads, and replay timeline seeks automatically detect a non-sequential log and skip animations cleanly instead of replaying stale scenes.
- **Sequence blocking shows cleanly:** When a dramatic sequence must complete before the next overlay appears (e.g., end-of-game city-by-city tally before the upgrade shop; story narration before map reveal; death memorial before tally), gate the *overlay's visibility* on the show completing (with a visible `"Skip"` escape hatch), never the engine state.

### 5.2 Physical continuity & stakes-proportional pacing
- **Move the real piece, never teleport-and-blink.** Cubes physically lift off the stockpile or off a character's seat cut-line, scale along an arc across the screen to the target city, and are only counted at the destination the moment they land (never double-counted or popped in early). Drawn cards flip, linger briefly (~0.5 s), then glide seamlessly into hand slots with zero layout jitter.
- **Scale duration to emotional stakes:**
  - Routine updates run briskly so chains don't drag.
  - High-risk events linger slightly longer.
  - Crises escalate visually and temporally (e.g., skull morphing into plague cube → incident track scaling up 2–3× and flashing red as the marker lands; epidemic rate track sliding out, advancing, and tucking back; character death holding a deliberate memorial beat).
  - End a completed session with a **compressed time-lapse replay** (~20 s) showing the arc of the whole game.
- **Choreograph map reveals out of overlays:** When a narrative beat reveals new territory or pieces on the board, play the story/narration first, then step the overlay aside on a deliberate `"Next"` beat, pan the camera to the target, animate the fog/pieces onto the map, and return cleanly.

### 5.3 Procedural adaptive soundscape calibrated objectively
Audio transforms a quiet web UI into a living world—and must be engineered with the same discipline as graphics:
- **Procedural Web Audio music running identically live and offline:** Author the adaptive score against an abstract `AudioContext` bus so CLI render scripts can export WAVs/spectrograms and verify RMS loudness, spectral balance, and peak headroom (no clipping) objectively—critical when agents cannot "hear" output directly. Account for laptop speaker physics (reinforce bass harmonics an octave up since laptop speakers roll off below ~150 Hz).
- **Respond smoothly to live game context:** Shift scale/harmony across campaign/progression tones; layer gentle environmental beds (low wind everywhere, occasional breaking waves near water—never monotonous loop drones that read as engine noise); escalate into rain and distant thunder only in deep crisis; weave subtle per-role musical motifs on turn changes and sharp stingers on turning points.
- **Key-matched procedural foley SFX:** Give every distinct action family (land/sea/air movement, cube pickup/delivery, alarms, scars) its own crafted sound tuned to the score's active key, fired strictly at the *visual impact beat* (landing, not command dispatch), with automatic attenuation on rapid repeats.

### 5.4 Expressive, subtle voiced narrative & character presence
- **Use modern expressive voice synthesis** (e.g., Gemini Voice Design with tailored persona + emotional acting directions, loudness-mastered via `ffmpeg`) rather than flat monotonic TTS.
- **Audition voice samples first** (presented as a playable visual gallery alongside character faces) before batch-generating a full campaign's lines.
- **Avoid flanderization:** Character punchlines and contextual barks (selection, turn start, receiving help, greeting/leaving teammates, facing threats, companions, scars, death) should feel *subtle, human, brief, and varied*—do not make a character mention their single prop or occupation in every line. Keep selection/turn punchlines snappy so menus feel responsive.
- **Respect playback context:**
  - Audio defaults **ON**, saving mixer/mute settings locally.
  - When the browser tab hides or mutes, **pause the audio clock and resume from the exact same moment** on refocus—never destroy and restart the score with a fresh fade-in.
  - Automatically hush character voices and rapid SFX (`hushVoices` / `hushSfx`) during >1× replays and time-lapses while keeping visual captions readable.

---

## 6. Core Architecture & State Design

### 6.1 Pure, deterministic, framework-free domain engine
Isolate all rules, content, and state transitions into a zero-dependency package (e.g., `packages/game`):
- **Zero browser/DOM/UI imports.** Runs identically in the browser host, Bun unit tests, CLI bots, and headless benchmarks.
- **Deterministic PRNG stored in state.** Given an initial state and command sequence, execution is 100% reproducible.
- **Explicit state machine (e.g., XState) + immutable updates (`immer`).** Every phase and allowed transition is declarative, inspectable, and serializable as plain JSON.

### 6.2 Single legality oracle (`reject`)
Expose **one canonical function**—`reject(world, phase, command): string | null`—returning `null` when legal or a concise user-facing refusal reason when illegal.
- Machine transition guards call `reject`.
- UI action menus, target highlights, disabled tooltips, and keyboard handlers call `reject`.
- Automated bots and playtest harnesses call `reject`.
- **Hard invariant:** Never duplicate or invent legality checks inside a UI component.

### 6.3 Tripartite state separation
Keep three distinct classes of state strictly separated by lifecycle and sync semantics:

| State Layer | What Belongs Here | Persistence & Sync | Affected by Undo / Reset? |
|---|---|---|---|
| **Domain State** (`campaign`, `game`) | Rules, board, hands, decks, RNG seed, append-only event log | Saved/exported; host-authoritative JSON patches | **Yes** |
| **Table / Session State** (`table`) | Seated players, browser IDs, ready/consensus votes, shared creation draft, briefing position | Synced across browsers; survives reload | **No** (undo/rollback never unseats players) |
| **Ephemeral Social State** | Live cursors, board pings, freehand pen strokes | Lossy presence lane (cursors/pings) or throttled separate storage key on host (drawings) | **No** (never triggers game reactivity or enters saves) |

### 6.4 State-diff recordings over command logs
Record sessions (`GameRecord`) as `{ initial: PublicState, steps: { at, by, command, patch }[] }` where each step stores the structural JSON diff (`patch`) rather than relying solely on re-executing `command`.
- **Why:** Replays remain 100% exact forever, even after game rules, RNG, or command schemas evolve—and every step diff averages a few hundred bytes to ~1 KB.
- The exact same `diff` / `applyPatches` / `frozen` machinery powers **both** P2P network synchronization and session recordings.

### 6.5 Precomputed build-time geometry, content & asset pipelines
Push heavy deterministic computation (geographic routing, collision avoidance, line-of-sight/region graphs, scan indexing, sprite head-detection, voice rendering) into standalone Bun build scripts (`scripts/gen-*.ts`) that commit typed `*.generated.ts` outputs:
- Runtime stays instantaneous and deterministic; missing generated artifacts throw loudly on startup.
- **Single spatial truth:** Derive fog of war, region membership, route legality, rendered line curves, and piece movement paths from **one** spatial partition and **one** precomputed course array—so if a path looks clear on screen, it *is* legally clear, and vice versa.
- **Clean-baseline data provenance:** When extracting structured assets or rules from an existing source or live save, always capture **state zero (untouched baseline)** and **fully revealed state** separately so mutable progression states never leak into base definitions—and maintain one canonical real-world save fixture to validate end-to-end feature parity.

### 6.6 Thin screen shell + stateful controller modules + shared primitives
Prevent god-components in complex reactive UIs:
- Keep the top-level screen component (`Game.svelte`) as a thin layout and wiring shell.
- Extract every distinct interactive subsystem (board view projection, targeting/choosing state machine, turn administration, map drawing tools, panel measurement, keyboard routing, announcements, log-watching shows, menu import/export) into focused controller modules (`.svelte.ts`) that receive read-only state via a clean getter bag.
- Consolidate recurring UI chrome into one canonical component per pattern (`Scrim`, `CloseButton`, `VoteButton`, `Beacon`, `TopTip`, `RichText`, `LogWatch`) so behavior (Escape stack, Show board peeking, hover timing, accessibility) is fixed once for the entire app.
- **Never maintain duplicate debug-only variants** of production components—every debug showcase must render the exact production component.

### 6.7 Fail fast and surface real errors
- Parse environment variables, config, network peer IDs, and saved states strictly at startup/ingress (`zod` / typed guards) and throw immediately with exact field names.
- Never mask runtime UI exceptions behind generic `"Internal Error"` messages: wire framework error hooks (`hooks.client.ts`) to forward the real error name, message, and stack trace to an unmistakable Crash screen—and make automated benchmarks fail immediately if that Crash screen ever mounts (even when caught cleanly without an uncaught `pageerror`).

---

## 7. Networking, Sync & Deployment Infrastructure

### 7.1 Zero-server, host-authoritative P2P architecture
- Keep the networking package (`packages/net`) completely domain-agnostic.
- The **host browser** runs the authoritative state machine and persists saves, undo stack, drawings, and recordings locally.
- **Peers** send typed commands over WebRTC and mirror the host's state. No application backend is required during live play.

### 7.2 Single Cloudflare Worker for static SPA + signaling + TURN (free tier)
Deploy one lightweight edge Worker that handles everything outside P2P traffic:
1. **Static SPA & asset serving:** Serves the built frontend (and any referenced static assets assembled via a build script that validates asset existence and edge file-size limits, e.g., Cloudflare's 25 MiB cap).
2. **Hibernatable Durable Object signaling (`/signal`):** Relays WebRTC SDP offers/answers and ICE candidates only; game traffic never touches it. Store socket identity strictly in WebSocket tags and `serializeAttachment` so Durable Object hibernation loses zero state and stores zero DB rows. Auto-respond to keepalive pings without waking the object.
3. **Cloudflare TURN relay credential minting:** On WebSocket connect, fetch and cache short-lived ICE/TURN credentials (using `TURN_KEY_ID` / `TURN_KEY_API_TOKEN`) and send them as the first `ice` message so players behind strict corporate/mobile NATs connect reliably—degrading cleanly to direct P2P when credentials are absent.
4. **Auth & semantic close codes:** Validate the shared passphrase with constant-time SHA-256 comparison (`crypto.subtle.timingSafeEqual`). Because browsers hide HTTP status codes on failed WebSocket upgrades, complete the `101` upgrade and immediately close with structured application close codes (`unauthorized`, `host-taken`, `replaced`) so the UI can show exact recovery messages.

### 7.3 Same-origin dev/prod parity
Never hardcode `localhost` URLs in client networking code:
- Route signaling through same-origin `/signal` in both development (Vite WebSocket proxy) and production (`run_worker_first: ["/signal"]` in Wrangler).
- Result: multiplayer works identically over `localhost`, LAN hostnames, Tailscale/tunnels, and custom domains without configuration tweaks.

### 7.4 Dual-lane WebRTC protocol with structural-sharing deltas
Separate traffic onto two WebRTC data channels:
- **Reliable ordered lane** (chunked into `≤16 KiB` frames with a 1-byte `MORE`/`LAST` header and bounded max reassembly size):
  - Sends full `state` on initial connect or `resync`, then monotonic `seq`-numbered JSON `patch` arrays (~hundreds of bytes per move).
  - Optimize array diffs: emit `shift` for front-popped queues, `len` for trims, and send plain primitive arrays whole whenever that JSON is shorter than per-index edits (e.g., removing from the middle of a sorted list).
  - Peers apply patches via `applyPatches` + incremental `frozen` (skipping already-frozen subtrees), keeping untouched object references identical to the previous frame so reactive views and identity-keyed engine caches perform identically on peers and host.
  - Any `seq` gap immediately returns `"lost"` and triggers an automatic full `resync`.
- **Lossy unordered lane** (throttled ~30 Hz, coalescing to latest value): Carries cursors, presence, and pings with zero head-of-line blocking. The host never trusts a peer's claimed sender ID—always stamp `from` from the authenticated transport link.

### 7.5 Secrets, environment management & push-to-master CI/CD
- **Single source of truth for env vars (`env-manager`):** Track `.env` with harmless local defaults (so fresh clones and CI work out of the box); keep `.env.local` gitignored; store real values in `env-manager` across `dev`/`prod`; commit the generated Zod `env.ts` reader; never add `env-manager` as a project dependency or invoke it in CI.
- **Scripted secret syncing:** Provide a small `./scripts/secrets.ts` (`push` to Cloudflare Worker secrets, `github` to GitHub Actions secrets) that reads from `env-manager prod` and logs secret *names*, never values. No manual copy-pasting into cloud consoles.
- **Fast parallel CI & automatic deploy:** Run independent parallel jobs (`lint:ci`, `typecheck`, `test`, `build`, 5-minute timeout) with zero slow pre-push git hooks. Keep pre-commit hooks millisecond-fast (lint staged files, typecheck, pure logic tests with git hook env vars unset). Push to `master` automatically builds, deploys to the custom domain, and smoke-checks the live URL.
- **Isolated local ports & namespaced storage:** Route all browser storage through one typed wrapper (`LS`) namespaced by `?DEBUG_ID=` (never touch raw `localStorage` or un-namespaced IndexedDB). Give automated tools/agents dedicated port ranges so concurrent sessions never disturb the developer's running server.

---

## 8. Performance Engineering & Runtime Budgets

### 8.1 Zero idle cost (hard requirement)
An untouched screen—and any background tab—must consume **0 frames/sec and ~0% CPU/GPU**:
- **Demand-driven 3D/canvas rendering:** Wrap the 3D/WebGL scheduler (`restWhenStill`) to call `setAnimationLoop(null)` after ~0.5 s (30 quiet frames) without an `invalidate()`, wake instantly on the next `invalidate()`, and stop immediately when `document.hidden` becomes `true`.
- **No infinite idle animations:** Ambient visual motion (fog smoke, focus pulses, attention beacons on idle screens) must settle after a finite number of cycles (`turns`), never keeping the browser compositor spinning forever.
- **Measure it:** Maintain an automated idle benchmark (`perf.ts`) in GPU-backed Chromium asserting `0` frames drawn at rest and `0` endless CSS animations still running.

### 8.2 Strict `<50 ms` frame budget under CPU throttle
Every interactive operation (hovering across crowded elements, panning/zooming, freehand drawing, opening overlays, aiming actions, playing full turns, undoing) must keep worst-case frames under **50 ms**, tested on late-game worst-case state under **4× CPU throttling** (`interact.ts`) with optional CPU profiles and Chrome trace capture.

### 8.3 Reactive structural sharing & browser compositor rules
Three measured browser pathologies routinely wreck frame times without showing up clearly in JS profiles:
1. **Reactivity over-invalidation:** Rebuilding view-model objects from state produces fresh object identities every change, forcing frameworks to re-render untouched subtrees and re-upload canvas textures. **Fix:** Split derived UI/board projections into independent fine-grained slices passed through a value-preserving `reconcile(prev, next)` helper. **Never** fold high-frequency pointer/hover state into the same derived object as expensive canvas/mesh/list rendering.
2. **DOM mutations directly under `<canvas>`:** Adding or removing DOM nodes directly inside a `<canvas>` fallback subtree costs ~40× normal DOM work (common with declarative 3D wrappers like Threlte). **Fix:** Mount declarative 3D scene components inside a `<div hidden>` wrapper inside the canvas.
3. **Compositor repaint traps:**
   - **No `backdrop-filter` over live/animated canvases**—every animated frame behind it triggers an extra blur render pass. Use opaque-enough panel fills (reserve a single blur pass at most for static full-screen modals).
   - **Animate only `transform` and `opacity`.** Never animate `box-shadow`, `border-color`, `width`, or `filter` on repeated elements (e.g., `Beacon` rotates a conic gradient behind a static mask and fades opacity on a pre-drawn halo).
4. **Main-thread startup discipline:** Offload heavy procedural texture/map generation to Web Workers that self-terminate when done; defer text auto-fitting to `ResizeObserver` so a batch of newly mounted cards triggers one shared layout pass instead of N forced synchronous layouts.

### 8.4 Zero-cost-until-triggered instrumentation
Diagnostic and feedback features must pay **zero runtime cost** during normal play:
- Dynamically `import()` the feedback editor after initial render so it never delays first paint.
- Never set `preserveDrawingBuffer: true` on WebGL contexts just to enable screenshots; instead, hook capture requests to trigger a single synchronous `renderer.render()` right before reading the canvas.

---

## 9. Debugging, Feedback & Verification Infrastructure

### 9.1 Millisecond logic-only committed test suite
- Commit unit tests **only for decided domain rules, invariants, and protocol contracts** in pure TypeScript—one clear rule per test, running in milliseconds (entire suite in a few seconds).
- **Never commit slow, flaky browser/UI E2E tests** into the test suite or CI. Keep browser verification in dedicated on-demand harnesses and real-app runs.

### 9.2 Built-in `/debug` diagnostic suite
Host all debugging tools directly inside the main dev server under `/debug` (never hidden behind obscure standalone ports):
- **`/debug` index:** One directory page linking every diagnostic tool.
- **`/debug/game`:** Solo multi-seat sandbox with a `window.DEBUG` API (inspect/inject state, send commands, named checkpoints, fetch recording).
- **Component & asset gallery (`/debug/cards`):** Renders every generated card/piece using the **exact production component at exact in-game size**, with clean on-hover toggles for every mutable state/upgrade and side-by-side comparison against source reference scans.
- **Deterministic UI State Studio (`/debug/studio`):** A structured JSON scene format (`StudioScene`) and `window.STUDIO` API capable of capturing and round-trip restoring *any exact screen state*—viewport size, player perspective, save state, camera pose, half-chosen multi-click action steps, open panels, scroll positions, and exact pointer hover coordinates—with screenshot + JSON capture saved to IndexedDB and bulk/selective export. Essential for both human visual polish and agent self-verification.
- **Audio / Narrative Audition (`/debug/story`):** Interactive workbench to scrub branching story trees, audition voices, and sweep adaptive music/weather parameters without playing through a full campaign.
- **Session Replay Browser (`/debug/runs` & `/replay`):** Lists recorded playtest and human sessions and plays them back through the real `Game` UI in read-only spectator mode with timeline pins, hover tooltips, notes, and variable playback speed.

### 9.3 Closed-loop in-app Feedback Engine (dev + production)
Wire an always-available in-app feedback tool (`@stefan.inc/feedback-engine`, reachable via hotkey and Menu in every build including production):
- Captures annotated screenshots with exact component source locations (`file:line`) and structured element labels (add explicit feedback accessibility tags to canvas anchors and custom interactive elements).
- Stamps a concise 1-line human summary in image metadata (e.g., `"Game Setup: campaign, hosting, 3p, November, playing.actions, turn 4"`).
- Automatically attaches **full reproducible state** (`save.json` + `recording.json`, transparently fetched from host for peers) using lazy per-file generators so every bug report or UX note can be loaded straight into the app or `/replay` in one step.
- Integrates directly with the issue/task tracker (e.g., ProcrastiMate) so automated orchestrator agents can pick up feedback in isolated worktrees, reproduce from the exact attached save, fix, verify visually, get cross-model code review, merge, and deploy automatically.

### 9.4 Purpose-built verification harnesses
Build targeted CLI harnesses for every major risk class (kept outside `bun test` and CI):
1. **Idle performance (`perf.ts`):** Measures idle frames, WebGL calls, CSS animations, and CPU time at rest.
2. **Interaction latency (`interact.ts`):** Drives real input across every major UI scenario at late-game density with 4× CPU throttle; checks `<50 ms` frames and asserts no Crash screen appeared.
3. **Real P2P networking (`netcheck.ts`):** Launches a host + multiple real browser peers over real WebRTC (plus `--relay` forcing TURN-only paths), tests lobby, live commands from every seat, drawings, peer reload, and host reload, verifying bit-identical final states and frame smoothness.
4. **Multi-agent playtest & UX review lab (`apps/playtest`):** Runs bots and multi-model AI playtesters (including fresh, zero-memory **computer-use / vision-only** agents operating the real UI) to find rule edge cases, measure live-play mechanic coverage across the full ruleset, and surface genuine UX friction that authors become blind to.

### 9.5 "Done means you ran it the way a user will" & multi-model workflow discipline
- **Real verification over proxies:** A typecheck or unit test proves logic compiles; a static screenshot proves layout—**neither proves interactive behavior.** Run the built app or real entry point, click through the real interaction, inspect real rendered frames/audio metrics, verify zero console/page errors and no Crash boundary, and report honestly both what was verified and any edge case that wasn't exercised.
- **Hunt systemic root causes:** When a bug resembles an earlier failure in a related feature or tool, audit the shared mechanism and fix the class of bug once instead of patching a single symptom.
- **Play to each model's strengths (when orchestrating reviews, art, or playtests):**
  - Build the shared framework and core abstractions yourself *before* fanning out any parallel work so contributors never duplicate infrastructure.
  - Pair visual/image models for bespoke art generation and screenshot-based visual critique; pair fast, low-cost models for parallel content extraction and high-volume playtesting; use fresh, **zero-memory** computer-use playtesters to expose UX friction an author stops noticing—and always evaluate AI critique skeptically rather than applying suggestions blindly.

---

## 10. Decision & Tradeoff Matrix

| We Choose | Over | Rationale | Accepted Tradeoff |
|---|---|---|---|
| **Static SPA + Host-Authoritative WebRTC P2P + Tiny CF Worker** | Dedicated game server / managed realtime DB | Zero server ops, free-tier hosting, offline-capable core, instant host interaction | Host tab must stay open for live multiplayer; reload briefly reconnects peers |
| **Single shared passphrase, zero state redaction** | User accounts, rooms, server-side fog-of-war redaction | Trusted-friends product; eliminates auth/redaction complexity across every message | Not suitable for untrusted public matchmaking without adding server authority |
| **Laptop-first single-screen layout (no page scroll)** | Mobile-responsive stacked/scrollable layout | Rich spatial tabletop requires simultaneous view of canvas, hands, and HUD | Phones are not a target viewport |
| **Direct workspace manipulation (lit board, radial ring, live hand pick)** | Modal option dialogs & `<select>` dropdowns | Feels tactile, eliminates context switching, drastically faster to play | Higher initial interaction-controller engineering (`choosing` state machine) |
| **Explicit click even for 1 valid choice** | Auto-executing single-option targeted actions | Prevents surprising silent mutations or accidental discards; keeps mental model consistent | One extra click when a targeted action happens to have only one legal target |
| **State-diff recordings (`patch[]`)** | Command-log replay | Replays stay exact forever across rule refactors; reuses exact P2P sync diff engine | Slightly larger recordings than raw commands (~1 KB/step) |
| **Log-driven lagged visual shows** | Blocking engine transitions on UI animation timers | Engine stays pure/instant; peers & `/replay` animate identically; jumps/undos never wedge | Visual layer must explicitly track and apply lag before paint (`$effect.pre`) |
| **One single `reject()` legality oracle** | Component-level `disabled` / validation logic | Zero drift between UI, machine guards, bots, and playtesters | Every UI affordance must speak in engine commands |
| **Precomputed build-time geometry & assets (`*.generated.ts`)** | Runtime geometry solving / manual asset wiring | Instant deterministic runtime; single spatial truth between rendering and rules | Editing base geometry/content requires rerunning generator scripts |
| **Zero backwards compatibility while iterating** | Save migrations & legacy fallbacks | Keeps code clean, small, and bug-free during rapid iteration | Stale dev saves are dropped; canonical save updated in lockstep |
| **Millisecond logic tests + on-demand perf/net/playtest harnesses** | Committed Playwright/browser E2E suites in CI | Sub-30s CI, zero flake, fast pre-commit hooks, much deeper real perf/WebRTC coverage | Requires discipline to run real-app verification before calling UI work done |
| **Procedural Web Audio + offline render calibration** | Static looping MP3 tracks | Dynamic emotional/contextual responsiveness, zero repetitive loop fatigue, small bundle | Requires audio-engineering care and objective render checks by agents |
| **In-app `/debug/studio` + Production Feedback with save/replay** | Ad-hoc console logging & verbal bug reports | Every human complaint arrives with exact component line, screenshot, save, and replay | Small upfront investment in serializable UI state and feedback hooks |

---

## 11. Catalog of Anti-Patterns to Reject on Sight

### Visual & Layout Anti-Patterns
1. **Boxitis (boxes inside boxes):** Wrapping cards, tracks, character cutouts, or text blocks in unnecessary bordered containers with padded backgrounds. *Instead:* float elements cleanly, use full-bleed art, subtle scrims, or hairline dividers.
2. **Show AND Tell:** Adding `"Playing"`, `"4 actions left"`, `"Choose a city below..."`, `"Ability:"`, `"Infection"`, or `"1 empty slot"` alongside visuals that already communicate it. *Instead:* delete the text completely.
3. **Scrollbars inside overlays or primary views:** Putting character lists, unboxing spreads, archives, or action panels inside cramped scrollable boxes. *Instead:* spread elements across the viewport and auto-fit via `fitZoom` / `fitGroup` / `fitText`.
4. **Ellipsis truncation (`...`):** Clamping card rules, titles, or names with ellipses. *Instead:* dynamically fit typography or reclaim wasted chrome so 100% of text is readable.
5. **Hard-clipping expressive art (`overflow: hidden`):** Slicing off character heads, props, or active glows at a card's bounding box. *Instead:* clip only at the intentional baseline/cut-line and allow top/side spill with low z-index.
6. **Native browser `title` tooltips & password-manager popups:** Leaving default hover tooltips or 1Password/autofill icons on game inputs. *Instead:* zero `title` attributes anywhere; global autofill opt-out observer.
7. **Unexplained ambient canvas markers:** Faint rings, dots, or lines that don't explain themselves on hover. *Instead:* make every signifier unmistakable and hover-explained, or remove it.
8. **Duplicate debug-only components:** Building a separate component for `/debug/cards` that diverges from the live game component. *Instead:* render the exact production component at exact in-game scale.

### Interaction & UX Anti-Patterns
9. **Dull text-list action modals & `<select>` pickers:** Asking players to choose a city, card, or teammate from a black popup menu. *Instead:* highlight the actual cities, hand cards, seats, or fanned table cards directly.
10. **Cursor tennis:** Putting sequential workflow controls in opposite corners of the screen. *Instead:* bring the next deck/control directly to where the user just clicked.
11. **"Too smart" silent auto-execution:** Automatically discarding a card or firing a targeted action without a click just because only 1 option is legal. *Instead:* keep targeted choices explicit; reserve 1-click immediate execution for repeatable/zero-choice actions.
12. **Blindly copying physical board-game friction:** Replicating paper scratch boxes, printed reminder warnings already enforced by the engine, or keeping spent one-time prompts cluttering cards. *Instead:* translate mechanics natively to digital UX while preserving full rules/story fidelity.
13. **Blocking full-screen overlays with no `"Show board"` escape:** Forcing players to make strategic choices (scars, purchases, character picks, votes) blind to the current board state. *Instead:* include a universal `"Show board"` toggle on every full-screen scrim.
14. **Global hotkeys hijacking text inputs:** Pressing `Space`, `F`, `Z`, or `?` inside a name field or Feedback text box and firing game commands. *Instead:* gate all hotkeys strictly against focused inputs, contenteditables, and overlay shadow DOMs.
15. **Non-interactive or deadlocking multiplayer flows:** Client-only draw loops where peers don't see cards flip, inconsistent vote buttons across screens, or votes that wedge forever when a player leaves. *Instead:* one command per flip, one `VoteButton` primitive everywhere, auto-reconcile votes on leave.

### Motion, Audio & Narrative Anti-Patterns
16. **Teleporting / popping state changes:** Snapping cubes/cards straight to their new counts or letting a newly drawn card pop into a hand and shift siblings abruptly. *Instead:* animate the real piece along its physical path and update the destination count on landing.
17. **Holding game state hostage to animations:** Delaying state transitions with `setTimeout` inside engine/session handlers. *Instead:* transition state immediately and lag the rendered view from the event log (`LogWatch`).
18. **Monotonous audio loops & restart-on-refocus:** Constant surf noise that sounds like a fan/engine, or tearing down and fading-in music every time the player alt-tabs. *Instead:* subtle wind bed + sparse natural events, pause/resume the audio clock seamlessly on tab visibility changes.
19. **Flanderized / overly long character barks:** Writing every line for a character around one visual prop or making selection punchlines ramble. *Instead:* audition samples first; keep voice lines brief, varied, subtle, and punchy; hush voices at `>1×` replay speed.

### Architecture, Performance & Infra Anti-Patterns
20. **UI-side legality logic:** Re-implementing rule checks inside button `disabled` expressions or click handlers. *Instead:* query the single engine `reject()` oracle everywhere.
21. **Polling/spinning idle render loops & endless CSS animations:** Leaving a 60 fps `requestAnimationFrame` loop or infinite `@keyframes` glow running when nobody is touching the screen. *Instead:* sleep WebGL after 0.5 s idle, stop on hidden tab, cap ambient animations to finite cycles, and verify `0` idle frames with `perf.ts`.
22. **Broad reactive objects & compositor traps:** Mixing pointer/hover state into the same derived view object as expensive board textures; putting `backdrop-filter` over a live canvas; mutating DOM children directly inside `<canvas>`; animating `box-shadow`. *Instead:* fine-grained `reconcile` slices, `<div hidden>` inside `<canvas>`, opaque fills, `transform`/`opacity`-only motion.
23. **Swallowing errors or hardcoding localhost:** Letting framework defaults hide stack traces behind `"Internal Error"`, hardcoding `ws://localhost:...` for signaling, or storing production secrets only inside a cloud console. *Instead:* surface real stacks to a Crash screen, proxy signaling on same-origin `/signal`, manage all secrets in `env-manager` with scripted push.
24. **Slow flaky browser tests in CI & migration bloat during active dev:** Committing brittle Playwright suites into pre-commit/CI or accumulating backwards-compatibility fallbacks for old save formats. *Instead:* millisecond pure-logic unit tests in CI, strict schema parsing, and targeted on-demand perf/net/playtest verification harnesses.

---

## 12. Day-Zero Project Bootstrap Checklist

When starting a new interactive multiplayer project under this framework, establish these foundations *before* scaling out features:

1. **Workspace split:**
   - `packages/core` (or `game`): Pure deterministic engine, XState phase machine, `immer` state, single `reject()` oracle, structural `diff`/`applyPatches`/`frozen` + `GameRecord`. Zero DOM imports.
   - `packages/net`: Domain-agnostic dual-lane WebRTC P2P (`reliable` chunked + `lossy` throttled presence) with strict boundary parsing and typed fatal close codes.
   - `packages/shared`: Generated `env.ts` reader (`env-manager`) and shared contracts.
   - `apps/signal`: Minimal Cloudflare Worker serving static SPA assets + hibernatable Durable Object `/signal` + Cloudflare TURN minting + timing-safe passphrase auth.
   - `apps/ui`: Thin main screen shell, fine-grained `reconcile` view layer, demand-driven renderer (`restWhenStill`), shared primitives (`Scrim`, `VoteButton`, `Beacon`, `RichText`, `TopTip`, `LogWatch`, `fitText`/`fitZoom`/`fitGroup`, `blockAutofill`, `LS` namespaced by `?DEBUG_ID=`), and real-stack `Crash` boundary.
2. **Built-in observability from week one:**
   - `/debug` hub (`/debug/game`, component gallery at exact scale, `/debug/studio` serializable scene capture/restore, `/debug/runs` + `/replay`).
   - Lazy-loaded in-app Feedback Engine enabled in dev and prod, exporting 1-line setup metadata + reproducible `save.json` + `recording.json`.
   - On-demand verification scripts: `perf.ts` (0 idle frames), `interact.ts` (<50 ms frames at 4× throttle), `netcheck.ts` (multi-browser WebRTC + `--relay` TURN + host/peer reload).
3. **CI, hooks & secrets:**
   - Tracked `.env` with harmless defaults; `env-manager` for `dev`/`prod`; `./scripts/secrets.ts` for pushing to Worker & GitHub.
   - Millisecond pre-commit hook (lint + typecheck + pure logic tests); no pre-push hook; fast parallel CI + auto-deploy on `master` push with live smoke check.
4. **Asset & content discipline:**
   - Build-time generator scripts (`scripts/gen-*.ts`) for spatial geometry, card/reference indices, and art/voice assets; audition art & voice samples before batch generation.
   - Establish the single visual theme, unified `Beacon` highlight, inline `RichText` symbology, and single color helpers before building secondary screens.
