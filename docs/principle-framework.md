# Principle Framework: Personal Digital Board Games

> **Scope & Purpose**
> This document defines the design goals, aesthetic sensibilities, UX philosophy, architecture, and tooling mindset for building **digital board games played on laptops by a small, trusted group of friends** (as well as solo multi-hand).
>
> Give this document to an agent starting a new board game project with no other context. It describes what the finished game should feel, look, sound, and run like—guiding judgment calls toward that outcome without dictating rigid implementation details.

---

## 1. Product Vision

### Build for friends at a virtual table, not a public platform
Design explicitly for a small, trusted group playing together:
- **No platform bloat:** Skip user accounts, matchmaking, public room browsers, anti-cheat, and server-side state redaction. A single shared passphrase is the entire access control.
- **Spend that budget on craft:** Everything saved on SaaS infrastructure goes into tactile visuals, fluid motion, adaptive sound, and deep quality of life.

### One laptop screen, zero page scrolling
A board game is a spatial object meant to be taken in at a glance. Design uncompromisingly for laptop screens so the entire active play space—the explored board, player seats, hand, and key state—lives cleanly on one screen with zero full-page scroll. Do not dilute desktop tabletop ergonomics for mobile viewports.

### Faithful to the board game, native to the screen
Digitizing a board game is translation, not photocopying:
- **Preserve the soul:** Keep 100% of the rules, story, theme, flavor, and tactile satisfaction of the game intact.
- **Embrace the medium:** Replace physical compromises and paper bookkeeping with effortless digital affordances—live counts, exact deck probabilities, risk summaries, copy tracking, searchable spoiler-free rules reflecting only what has been unlocked so far, and instant undo (with a playful group consensus vote when undoing something that revealed hidden information).
- **Keep trust in the source:** When generating crisp digital versions of printed cards or components, provide an unobtrusive way to peek at the original reference artwork in place.

### Opinionated experience, fast iteration
- **One crafted default:** Choose the best default experience (full story, sound on with persisted volume/mute, deliberate pacing) instead of fragmenting the design behind preference toggles.
- **Zero backwards compatibility during development:** Keep save schemas strict, delete superseded paths cleanly, and maintain one canonical real-world save fixture rather than carrying migration shims.

---

## 2. Visual Language & Tabletop Aesthetics

### The board is the hero
Use one cohesive, atmospheric visual direction—dark, quiet peripheral chrome framing a bright, tactile board. Reserve high-chroma color strictly for game meaning (player identities, regions/cards, status effects, risk levels) derived from one shared color truth so cards, tokens, mini-piles, tooltips, and highlights never disagree.

### Show, don't tell—and never do both
Prefer icons, spatial placement, animation, and color over prose. Whenever the UI already communicates state visually, omit words saying the same thing. Avoid instructional helper text, redundant category labels, static map legends, and duplicating the same information across adjacent views.

### Boxless, full-bleed, breathing tabletop
Avoid wrapping game elements in opaque boxes and nested borders that eat viewport space and make a board game feel like an admin form:
- **Float game objects directly over the table** (hands, status tracks, tokens, character figures) with minimal chrome.
- **Prioritize generous legibility:** Run artwork full-bleed, size typography comfortably for laptop viewing distance, and let expressive character cutouts and glows break naturally past rectangular edges instead of hard-clipping them.
- **Fit spreads to the screen, never scrollboxes:** Selection screens, component reveals, archives, and card pickers should spread cleanly across the viewport and scale dynamically to fit—never falling back to cramped scrollbars or `...` truncation.

### One unified tabletop grammar
- **One attention signal:** Use a single unmistakable animated highlight everywhere the player needs to act next, reserving semantic color variations for passive risk or status cues.
- **Universal inline symbology:** Render recurring game concepts (cards, cubes, ports, hazards, structures, scars) as consistent, color-matched inline icons wherever game text appears.
- **Real components everywhere:** Briefings, unboxing spreads, archives, pickers, and debug galleries should display the actual styled cards, tokens, and characters—never dry prose summaries.

### Intentional 3D & art-directed craft
- **Tactile, structured 3D—never a physics sandbox:** Use 3D for physical presence, distinct piece silhouettes, beveled tokens, readable camera angles, smooth geography-aware routes, and clean piece attachment—not loose physics tumbling. Fit the camera to *explored* territory rather than empty fog.
- **Procedural + bespoke art:** Generate systematic visuals (charts, card map crops, fog of war, structured tokens) algorithmically for crisp consistency, and use AI image generation for bespoke organic identity (transparent character figures facing inward toward the table, monochrome card emblems, companion portraits, thematic icons)—auditioning samples before generating full sets.
- **Zero browser-default chrome:** Keep native browser tooltips and autofill popups completely out of the game so nothing breaks tabletop immersion.

---

## 3. Interaction Design & Shared Table Feel

### Direct manipulation on the table
Players should interact directly with the game objects themselves—clicking lit spaces and pieces on the board, picking cards directly from their hand, and fanning real cards out on the table when choosing from a pile. Avoid modal option lists and form dropdowns whenever a real board object can carry the interaction.

### Smooth rhythm with clear agency
- **Zero friction on repeatable actions:** Cheap, repeatable steps (picking up or delivering a token, placing setup pieces) should happen in one click—repeating or undoing is faster than quantity dialogs.
- **Keep real choices clear and anchored:** Keep targeted decisions explicit and intuitive, surface only currently legal actions by default (tucking unavailable ones away with clear reasons), and keep sequential turn phases anchored in one ergonomic zone so the player isn't chasing buttons across the screen.

### Hover to inspect, click to act
Make hover a rich, cross-linked inspection lens across the entire table:
- Hovering a card highlights its relevant targets on the board or seats.
- Hovering a player's corner seat expands their full character details, fans out their complete hand, and highlights their piece on the board.
- Hovering top-bar counters (decks, risks, threats) reveals exact odds and spotlights the matching board locations—with hoverable tooltips so players can inspect deeper breakdowns without clicking away.

### Always let players see the board
Every full-screen overlay (lobby, character selection, narrative reveal, archive, upkeep shop, group vote) must allow players to effortlessly step it aside to inspect and pan the live board before deciding.

### Everyone sits at the same table
- **Stable spatial seats & diegetic pools:** Anchor seats consistently around the screen corners (local player fixed in a consistent home corner) with minimal resting cards that expand on hover, and place physical shared pools (like a supply stockpile) right on open board space when they belong on the table.
- **Live table presence:** Support live cursors, shared freehand map annotations (persisted outside game state, where erasing clears only your own marks), and temporary board pings, alongside natural keyboard shortcuts cleanly isolated from text inputs.
- **Experience every beat together:** Step through card flips, reveals, crises, and story moments in sync so every screen witnesses the exact same drama together and players can react between beats.
- **One consensus language:** Use one unified seat-colored voting control for every table-wide gate (starting, readying, continuing, upkeep, shared votes, revealing undo) that simplifies cleanly for solo play and never deadlocks if someone steps away.
- **Seamless seating & solo parity:** Persist player identity across reloads so everyone drops straight back into their seat, make claiming or vacating seats effortless, support solo multi-hand seamlessly, and let peers inspect, export, and replay while keeping destructive campaign resets with the host.

---

## 4. Motion, Pacing & Living World

### Physical continuity & stakes-proportional drama
- **Move the real pieces:** Tokens lift from their actual source (stockpile, player seat, space), arc across the board, and count at their destination upon landing. Cards flip, linger briefly to register, and glide smoothly into hands without pop-in or layout jitter.
- **Scale pacing to emotional weight:** Keep routine turns brisk, linger on tense outcomes, and give major moments—crises, map reveals, character fates, end-of-game tallies—deliberate theatrical choreography (plus a fast time-lapse replay at game end).
- **Decouple shows from game state:** Let the rules engine advance immediately and drive animations reactively from the append-only game log. Players stay unblocked, remote peers and replays automatically play identical scenes, and reloads, undos, or replay seeks skip cleanly.

### Adaptive soundscape & expressive voices
- **Procedural ambient score:** Synthesize adaptive Web Audio music that shifts with campaign progression, crisis tension, and player turns, paired with tactile, key-matched procedural foley timed to visual impact—designed to render offline so levels and balance can be verified objectively rather than guessed.
- **Expressive voiced cast & characters:** Bring narrative moments and player characters to life with expressive, auditioned voice synthesis that feels natural, punchy, and varied.
- **Context-aware playback:** Respect tab visibility seamlessly (pause and resume cleanly) and hush voices and rapid cues during fast-forward replays.

---

## 5. Architecture, Networking & Performance

### Pure deterministic rules core & single legality oracle
Isolate all game rules, content, and seeded randomness in a framework-free core package driven by an explicit state machine and immutable updates. Expose **one canonical legality function** that powers machine guards, UI affordances, refusal explanations, bots, and playtesters alike—never decide legality inside UI components.

### Clean separation of state lifecycles
Keep three layers cleanly apart:
- **Game & campaign state:** Authoritative, saved, diffed, and undoable.
- **Table & seating state:** Synced across browsers and reload-persistent, immune to undo and game rollbacks.
- **Ephemeral social state:** Live cursors, pings, and map drawings live completely outside game state so they never pollute saves or trigger game recomputation.

### Zero-server P2P multiplayer & evergreen replays
- **Host-authoritative P2P:** Keep networking game-agnostic. The host browser owns the authoritative state machine; peers connect over WebRTC with a reliable ordered lane for state patches/commands and a throttled lossy lane for presence.
- **One tiny free-tier edge worker:** Serve the static app and assets, relay WebRTC signaling through a hibernatable room object (zero database rows), check the shared passphrase, and mint short-lived TURN relay credentials for strict NATs—proxied same-origin in both dev and prod so multiplayer works across any network.
- **Diff-based sync and replays:** Use the same structural JSON patches (preserving object identity on untouched subtrees) for both P2P state sync and session recordings, so replays remain exact forever even after rules evolve.

### Build-time pipelines, modular UI & effortless performance
- **Single spatial & content truth:** Precompute heavy map geometry, legal route curves, asset indices, and media at build time so runtime stays instant and what looks clear on the board matches what the rules allow.
- **Thin shell, shared primitives & fail-fast boundaries:** Keep the main game view as clean wiring over focused behavior controllers and shared UI primitives (reused identically by live play and debug views). Validate config, env vars, and saves strictly at boundaries and surface real errors clearly.
- **Zero idle cost, fluid under load:** A board game sits idle while players think and talk. Render 3D/canvas scenes strictly on demand (sleeping after stillness and stopping completely in hidden tabs), cap ambient idle animations to finite beats, isolate high-frequency hover reactivity from heavy board updates, keep compositor layers light, and load debug/feedback tooling lazily so normal play pays nothing.

---

## 6. Tooling, Feedback & Verification Loop

### Fast pure-logic CI & clean ops
- Commit only millisecond pure-logic tests for decided rules and invariants so pre-commit hooks and parallel CI stay blazingly fast, with automatic deploys on `master` and centrally managed, scripted environment secrets.
- Namespace browser storage cleanly (e.g., via a debug query parameter) so multiple tabs, playtesters, and concurrent agents never collide.

### Built-in `/debug` suite & live feedback loop
Treat observability as part of the product from early on:
- **In-app `/debug` routes:** A solo sandbox with state checkpoints, an exact-scale production component gallery with live state toggles and reference scans, a deterministic UI studio that captures and restores exact screen states for visual polish, an audio/story audition workbench, and a replay viewer running on the real game screen.
- **Always-on in-app Feedback:** Ship an integrated feedback tool in dev and production that attaches annotated screenshots, component locations, and full reproducible save + replay files—turning live playtest friction straight into reproducible fixes.

### Verify like players actually play
- **Run targeted on-demand harnesses** outside CI for what logic tests cannot prove: idle CPU/frame cost, interaction frame latency on dense late-game boards, real multi-browser WebRTC + TURN networking with reloads, and multi-model AI playtesters (including fresh, zero-memory vision/computer-use reviewers to surface real UX friction, evaluated critically).
- **Real verification over proxies:** Run the built game and exercise the real interaction before calling work done. Build shared foundations first before fanning out parallel work, and fix recurring bugs at their systemic root.

---

## 7. Guiding Tradeoffs

| We Choose | Over | Why | Accepted Tradeoff |
|---|---|---|---|
| **Host-authoritative WebRTC P2P + tiny edge worker** | Dedicated backend game server & database | Zero server ops, free-tier hosting, offline-capable core, instant host feel | Host browser anchors live sessions; host reload briefly reconnects peers |
| **Shared passphrase & open state** | Accounts, rooms, server-side redaction | Built for trusted friends; avoids auth/redaction overhead everywhere | Not suited for untrusted public matchmaking |
| **Laptop single-screen tabletop** | Mobile-responsive scrolling layouts | Spatial board games need the whole table visible at once | Phones are out of scope |
| **Direct tabletop manipulation** | Modal menus & form dropdowns | Tactile, fast, intuitive play with minimal context switching | Requires an explicit client interaction layer |
| **Digital-native QOL with authentic theme** | Blind physical skeuomorphism | Keeps the soul of the board game while removing paper tedium | Requires thoughtful design translation per mechanic |
| **Log-driven reactive animation** | Timer-blocked game state | Pure instant engine, automatic peer/replay parity, clean undo/seeking | Visual layer computes render lag from the event log |
| **State-diff recordings** | Command-log replay | Replays stay exact across rule changes and reuse the P2P sync diff engine | Slightly larger recordings than command-only logs |
| **Fast logic CI + on-demand real harnesses** | Committed browser E2E suites in CI | Sub-minute, flake-free CI and far deeper perf/WebRTC/UX coverage | Requires discipline to verify interactively on the real app |
| **Zero backwards compatibility while building** | Versioned migrations & legacy fallbacks | Keeps code small, clean, and fast to iterate | Old dev saves are dropped; canonical save updates in lockstep |

---

## 8. Anti-Patterns to Reject on Sight

1. **Enterprise-itis:** Adding user accounts, room browsers, state redaction, or mobile compromises to a friends-only laptop board game.
2. **Form UI on a tabletop:** Boxing everything into bordered cards or asking players to pick board spaces, cards, or teammates from popup lists and dropdowns instead of interacting with the game itself.
3. **Show AND tell:** Adding helper instructions, category labels, static legends, or duplicate descriptions alongside visuals that already communicate state.
4. **Scrollboxes, ellipses & clipped art:** Solving dense tabletop spreads with scrollbars, `...` truncation, or hard `overflow: hidden` bounds instead of fitting cleanly and letting expressive art breathe.
5. **Split-brain rules or debug doppelgängers:** Putting legality logic in UI components or maintaining simplified debug-only versions of production game pieces.
6. **Teleporting state or timer-locked logic:** Snapping pieces/cards instantly without physical travel, or blocking engine state transitions behind UI animation timers.
7. **Burning CPU at rest:** Leaving 3D render loops or endless idle animations spinning while players think or tabs are hidden.
8. **Blind skeuomorphism:** Copying tedious physical bookkeeping literally instead of letting the digital medium shine—while still keeping the game's authentic rules, flavor, and story intact.
9. **Slow CI ceremony & premature migrations:** Clogging CI with flaky browser E2E suites or piling up backwards-compatibility shims mid-development.
