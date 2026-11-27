<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import CloseButton from "#lib/hud/CloseButton.svelte";
  import Crash from "#lib/hud/Crash.svelte";
  import Game from "#lib/hud/Game.svelte";
  import { setReadingExit } from "#lib/hud/readingExit.ts";
  import type { GameSession } from "#lib/session/session.svelte.ts";

  type Props = {
    session: GameSession;
    /** What is being played, named in the strip over the game. */
    title: string;
    /** Where the × goes, and the label of a Legacy reading's last button. */
    back: string;
    onclose: () => void;
  };

  let { session, title, back, onclose }: Props = $props();

  // A reading played here ends by coming back, never by going on into the game.
  setReadingExit({
    get label() {
      return back;
    },
    leave: () => onclose(),
  });
</script>

<!-- A debugging page's game on the whole screen, under a strip that names it and leads back. -->
<div class="strip" {@attach feedback("Debug game", () => ({ title }))}>
  <span>{title}</span>
  <CloseButton label={back} onclick={onclose} />
</div>
<div class="stage">
  {#if session.state}
    <svelte:boundary>
      <Game {session} />
      {#snippet failed(error)}
        <Crash {error} {session} />
      {/snippet}
    </svelte:boundary>
  {/if}
</div>

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

  /* The game sits under the strip, filling the rest of the screen, over everything the page itself draws. */
  .stage {
    position: fixed;
    inset: 0;
    z-index: 1999;
    --game-inset: 2.6rem 0 0 0;
  }
</style>
