<script lang="ts">
  import Crash from "#lib/hud/Crash.svelte";
  import Game from "#lib/hud/Game.svelte";
  import { GameSession } from "#lib/session/session.svelte.ts";
  import type { Mode } from "#lib/session/session.svelte.ts";
  import { LS } from "#lib/storage.ts";
  import Engraving from "#lib/board/Engraving.svelte";
  import { onDestroy } from "svelte";

  const browser = typeof window !== "undefined";

  let secret = $state(LS.get("passphrase", ""));
  let session = $state<GameSession | null>(null);
  let error = $state<string | null>(null);

  function start(mode: Mode) {
    error = null;
    LS.set({ passphrase: secret, mode });
    try {
      session = new GameSession({ mode, secret });
      window.DEBUG = session.debugApi();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      LS.set({ mode: null });
    }
  }

  // A reload keeps the player in the game they were in.
  const resume = browser ? LS.get("mode") : null;
  if (resume) start(resume);
  onDestroy(() => {
    session?.close();
    if (browser) delete window.DEBUG;
  });

  function leave() {
    session?.close();
    session = null;
    LS.set({ mode: null });
    delete window.DEBUG;
  }
</script>

<svelte:head>
  <title>Pandemic Legacy: Season 2</title>
</svelte:head>

{#if session?.fatal}
  <main class="landing">
    <Engraving />
    <section>
      <h1>Disconnected</h1>
      <p>{session.fatal}</p>
      <button class="primary" onclick={leave}>Back</button>
    </section>
  </main>
{:else if session?.state}
  <svelte:boundary>
    <Game {session} />
    {#snippet failed(error)}
      <Crash {error} session={session!} />
    {/snippet}
  </svelte:boundary>
{:else if session}
  <main class="landing">
    <Engraving />
    <section>
      <h1>Looking for the host</h1>
      <p>Status: {session.status}. The game appears as soon as the host is online.</p>
      <button onclick={leave}>Cancel</button>
    </section>
  </main>
{:else}
  <main class="landing">
    <Engraving />
    <section>
      <h1>Legacy</h1>
      <p>
        A co-op campaign for two to four characters. Play every character yourself on this screen,
        or play with a group: one player hosts and keeps the save, everyone else joins them
        directly.
      </p>
      <label
        >Passphrase <input
          bind:value={secret}
          class="masked"
          spellcheck="false"
          placeholder="Shared with your group"
          data-testid="passphrase"
        /><small>Needed to host or join. Playing on this screen needs none.</small></label
      >
      <div class="buttons">
        <button class="primary" disabled={!secret} onclick={() => start("host")} data-testid="host"
          >Host</button
        >
        <button disabled={!secret} onclick={() => start("join")} data-testid="join">Join</button>
        <button onclick={() => start("solo")} data-testid="solo">Play on this screen</button>
      </div>
      {#if error}<p class="error">{error}</p>{/if}
    </section>
  </main>
{/if}

<style>
  .landing {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background:
      radial-gradient(ellipse 60% 55% at 50% 50%, rgb(255 226 170 / 0.07), transparent 70%),
      var(--table);
    color: var(--ink);
    font-family: var(--font-ui);
    overflow: hidden;
  }

  section {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    width: min(26rem, 90vw);
    animation: rise 700ms 150ms cubic-bezier(0.2, 0.9, 0.3, 1) both;
  }

  @keyframes rise {
    from {
      opacity: 0;
      translate: 0 0.8rem;
    }
  }

  h1 {
    margin: 0 0 -0.2rem;
    font-family: var(--font-display);
    font-size: 5.5rem;
    font-weight: 400;
    line-height: 0.9;
    letter-spacing: -0.01em;
  }

  p {
    margin: 0;
    color: #c3b8a3;
    font-size: 1rem;
    line-height: 1.5;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    color: var(--ink);
    font-size: 0.9rem;
  }

  label small {
    color: var(--muted);
    font-size: 0.8rem;
  }

  input {
    padding: 0.5rem 0.6rem;
    border: 0;
    border-bottom: 1px solid rgb(231 220 198 / 0.45);
    border-radius: 2px 2px 0 0;
    background: rgb(10 8 6 / 0.55);
    color: var(--ink);
    font: inherit;
    font-size: 1.05rem;
    transition: border-color 150ms ease;
  }

  input:focus {
    outline: none;
    border-bottom-color: var(--paper);
  }

  /* Masked with CSS rather than type="password", which password managers claim whatever the field says. */
  .masked {
    -webkit-text-security: disc;
  }

  input::placeholder {
    color: rgb(190 178 158 / 0.75);
  }

  .buttons {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  button {
    padding: 0.55rem 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: 2px;
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: 0.95rem;
    cursor: pointer;
    transition:
      border-color 150ms ease,
      background 150ms ease;
  }

  button:hover:not(:disabled) {
    border-color: var(--paper);
    background: var(--wash);
  }

  button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .primary {
    border-color: var(--paper);
    background: var(--paper);
    color: var(--paper-ink);
    font-weight: 700;
  }

  .primary:hover:not(:disabled) {
    background: #e9dec5;
  }

  .error {
    color: var(--danger);
  }
</style>
