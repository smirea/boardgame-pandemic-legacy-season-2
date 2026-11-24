<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import { freeCharacters } from "@repo/game";
  import type { CharacterId, Command, Decide, SeatId, World } from "@repo/game";
  import { fade, fly, scale } from "svelte/transition";
  import { figureUrl } from "#lib/characters/figures.ts";
  import CharacterSheet from "./characters/CharacterSheet.svelte";
  import { seatColor, seatName } from "./labels.svelte.ts";
  import { placed } from "./traits.ts";

  type Props = {
    world: World;
    seat: SeatId;
    decides: Decide[];
    /** Whether this browser plays the seat whose character died, which chooses who steps in. */
    canChoose: boolean;
    send: (command: Command) => void;
  };

  let { world, seat, decides, canChoose, send }: Props = $props();

  const game = $derived(world.game!);
  const fallen = $derived(world.campaign.characters[game.players[seat]!.character]!);
  const color = $derived(seatColor(seat));
  const free = $derived(freeCharacters(world));
  // A haven worker steps in only when no living character is free, as the engine allows.
  const worker = $derived(
    decides.some((decide) => decide.d === "replace" && decide.character === null),
  );
  // The choices fill the room left of the fallen character, in as square a grid as their number allows.
  const count = $derived(free.length + (worker ? 1 : 0));
  const cols = $derived(count <= 2 ? count : count <= 4 ? 2 : 3);
  const rows = $derived(Math.ceil(count / Math.max(1, cols)));

  function choose(character: CharacterId | null) {
    if (canChoose) send({ type: "DECIDE", decide: { d: "replace", character } });
  }
</script>

<div
  class="replacement"
  style:--seat={color}
  {@attach feedback("Replacement", () => ({ seat, fallen: fallen.name }))}
>
  <header in:fade={{ duration: 300 }}>
    <span class="kicker">{fallen.name} has fallen</span>
    <h2>Who steps in?</h2>
    <p>
      {#if canChoose}
        Choose who carries on in {seatName(world, seat)}'s seat.
      {:else}
        Waiting for {seatName(world, seat)} to choose who steps in.
      {/if}
    </p>
  </header>
  <div class="row">
    <div class="options" style:--cols={cols} style:--rows={rows}>
      {#each free as character, index (character.id)}
        <div class="choice" in:fly={{ y: 40, duration: 420, delay: 200 + index * 90 }}>
          <CharacterSheet
            {character}
            tone="free"
            {color}
            label="Replacement candidate"
            toggle={canChoose ? () => choose(character.id) : undefined}
          />
        </div>
      {/each}
      {#if worker}
        <button
          type="button"
          class="choice worker"
          disabled={!canChoose}
          onclick={() => choose(null)}
          in:fly={{ y: 40, duration: 420, delay: 200 }}
          {@attach feedback("Haven worker", () => ({ canChoose }))}
        >
          <img src={figureUrl("haven-worker")} alt="" />
          <strong>A haven worker</strong>
          <span
            >No living character is free. A haven worker with no occupation carries on from their
            haven.</span
          >
        </button>
      {/if}
    </div>
    <div class="fallen" in:scale={{ start: 0.92, duration: 500 }}>
      <div class="ashen">
        <CharacterSheet
          character={fallen}
          tone="dead"
          {color}
          side="right"
          label="Fallen character"
        >
          {#snippet base()}
            {#if fallen.diedAt}<span class="where"
                >Died in {placed(fallen.diedAt, world.campaign.month)}</span
              >{/if}
          {/snippet}
        </CharacterSheet>
      </div>
      <span class="rip" aria-hidden="true">RIP</span>
    </div>
  </div>
</div>

<style>
  .replacement {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 1.2rem 1.5rem;
    background: radial-gradient(ellipse at 50% 46%, rgb(18 13 9 / 0.86), rgb(8 6 4 / 0.95));
  }

  header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    text-align: center;
  }

  .kicker {
    padding: 0.12rem 0.8rem;
    border-radius: 2px;
    background: var(--danger);
    color: #fff4ea;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    color: var(--paper);
    font-family: var(--font-display);
    font-size: 2.1rem;
    font-weight: 400;
  }

  p {
    margin: 0;
    color: var(--ink);
    font-size: 0.95rem;
  }

  .row {
    display: grid;
    flex: 1;
    grid-template-columns: 1fr auto;
    align-items: stretch;
    gap: 2.5rem;
    width: 100%;
    min-height: 0;
  }

  .options {
    display: grid;
    grid-template-columns: repeat(var(--cols), auto);
    place-content: center;
    gap: 1.2rem;
    height: 100%;
    min-height: 0;
    container-type: size;
  }

  .choice {
    position: relative;
    width: min(
      26rem,
      (100cqw - (var(--cols) - 1) * 1.2rem) / var(--cols),
      ((100cqh - (var(--rows) - 1) * 1.2rem) / var(--rows)) * 1.2
    );
    aspect-ratio: 1.2;
  }

  /* The fallen character stands apart on the right, greyed, looking in at who replaces them, under a stamp. */
  .fallen {
    position: relative;
    align-self: center;
    width: min(30rem, 32vw, 56vh * 1.2);
    aspect-ratio: 1.2;
  }

  .ashen {
    width: 100%;
    height: 100%;
    filter: grayscale(1) brightness(0.6);
  }

  .rip {
    position: absolute;
    top: 42%;
    left: 50%;
    padding: 0.05em 0.5em;
    border: 0.12em solid rgb(200 54 40 / 0.9);
    border-radius: 0.1em;
    color: rgb(214 66 48 / 0.95);
    font-family: var(--font-display);
    font-size: 3.6rem;
    letter-spacing: 0.18em;
    text-shadow: 0 0 0.3em rgb(0 0 0 / 0.6);
    translate: -50% -50%;
    rotate: -14deg;
    pointer-events: none;
  }

  .where {
    color: var(--paper);
    font-size: 0.85em;
  }

  .worker {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 0.4rem;
    padding: 1rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: rgb(30 24 19 / 0.8);
    color: var(--paper);
    font: inherit;
    text-align: center;
    cursor: pointer;
  }

  .worker:disabled {
    cursor: default;
  }

  .worker:hover:not(:disabled),
  .worker:focus-visible {
    border-color: #e2c36a;
  }

  .worker img {
    flex: 1;
    min-height: 0;
    max-width: 100%;
    object-fit: contain;
  }

  .worker strong {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 400;
  }

  .worker span {
    color: var(--ink);
    font-size: 0.85rem;
  }
</style>
