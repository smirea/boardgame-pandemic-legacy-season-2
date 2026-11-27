<script lang="ts" module>
  import type { Character, CityId, JobId } from "@repo/game";

  /** A character the box brings: the occupation, the person it brings and, when a Character card was free, who it made. */
  export type Arrival = {
    key: string;
    job: JobId;
    figure: string;
    occupation: string;
    text: string;
    home: CityId | null;
    character: Character | null;
  };
</script>

<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import { onMount } from "svelte";
  import Beacon from "#lib/Beacon.svelte";
  import { jobProfiles } from "#lib/cards/print.generated.ts";
  import { figureUrl } from "#lib/characters/figures.ts";
  import type { FigureKey } from "#lib/characters/personas.ts";
  import { characterVoice } from "#lib/characters/voice.svelte.ts";
  import { characterTraits, TRAIT_KIND } from "./traits.ts";
  import Exposure, { shownTrack } from "./characters/Exposure.svelte";
  import HavenChip from "./characters/HavenChip.svelte";
  import Sheet from "./characters/Sheet.svelte";
  import TraitPanel from "./characters/TraitPanel.svelte";

  type Props = {
    arrival: Arrival;
    /** Steps the character down into its place among the pieces. */
    onnext: () => void;
    /** Renames a newly arrived character on creation. */
    onrename?: (name: string) => void;
    /** Leaving: everything but the figure, which flies, is gone. */
    leaving: boolean;
    element?: HTMLElement;
  };

  let { arrival, onnext, onrename, leaving, element = $bindable() }: Props = $props();

  const traits = $derived(
    arrival.character
      ? characterTraits(arrival.character)
      : [{ kind: "job" as const, name: arrival.occupation, text: arrival.text }],
  );
  const empty = $derived(
    arrival.character ? arrival.character.slots.filter((slot) => slot === null).length : 0,
  );
  const profile = $derived(jobProfiles[arrival.job] ?? null);
  const stones = $derived(traits.length + empty);
  const initialName = $derived(arrival.character?.name ?? arrival.occupation);
  let draftName = $state<string | null>(null);
  const called = $derived(draftName ?? initialName);

  function commitName() {
    const trimmed = called.trim();
    if (trimmed && arrival.character && trimmed !== arrival.character.name) onrename?.(trimmed);
    draftName = null;
  }

  function advance() {
    commitName();
    onnext();
  }

  const still =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The character says hello once it has stepped onto the table, not before.
  onMount(() => {
    const timer = setTimeout(
      () => characterVoice.play(arrival.figure as FigureKey, "greet", { priority: "ui" }),
      still ? 0 : 700,
    );
    return () => clearTimeout(timer);
  });
</script>

<div
  class="newcomer"
  class:leaving
  bind:this={element}
  role="dialog"
  aria-modal="true"
  aria-label={`${called}, ${arrival.occupation}, joins the roster`}
  data-testid="newcomer"
  {@attach feedback("New character", () => ({ name: called, occupation: arrival.occupation }))}
>
  <div class="veil" aria-hidden="true"></div>
  <div class="burst" aria-hidden="true"></div>
  <div class="rays" aria-hidden="true"></div>

  <p class="kicker"><span>A new character joins the roster</span></p>

  <div class="card">
    <Sheet figure={figureUrl(arrival.figure)} tone="mine" color="#e2c36a" fitted={called || arrival.occupation}>
      {#snippet name()}
        {#if arrival.character && onrename}
          <label class="rename">
            <input
              value={called}
              maxlength="24"
              aria-label="Name this character"
              placeholder={arrival.occupation}
              oninput={(event) => (draftName = event.currentTarget.value)}
              onblur={commitName}
              onkeydown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") {
                  draftName = null;
                  event.currentTarget.blur();
                }
              }}
              data-testid="newcomer-name"
            />
            <svg class="pen" viewBox="0 0 16 16" aria-hidden="true"
              ><path d="M11.3 1.7l3 3-8.6 8.6-3.8.8.8-3.8z" /></svg
            >
          </label>
        {:else}
          {called}
        {/if}
      {/snippet}
      {#snippet meta()}
        {#if arrival.character}
          <Exposure
            boxes={shownTrack(arrival.character.exposureTrack, arrival.character.exposure)}
          />
        {/if}
        <HavenChip
          home={arrival.character?.home ?? arrival.home}
          canRename={() => false}
          rename={() => {}}
        />
        {#if profile?.age}<span class="age">Age {profile.age}</span>{/if}
      {/snippet}
      {#snippet arch()}
        {#if profile?.text}
          <p class="bio" data-testid="newcomer-bio">{profile.text}</p>
        {/if}
        {#each traits as trait, index (`${trait.kind}:${trait.name}:${index}`)}
          <TraitPanel
            at={(index + 0.5) / stones}
            kind={trait.kind}
            label={TRAIT_KIND[trait.kind]}
            name={trait.name}
            text={trait.text}
          />
        {/each}
        {#each { length: empty } as _, index (index)}
          <TraitPanel at={(traits.length + index + 0.5) / stones} kind="empty" />
        {/each}
      {/snippet}
      {#snippet base()}{#if called !== arrival.occupation}<span class="occupation"
            >{arrival.occupation}</span
          >{/if}{/snippet}
    </Sheet>
  </div>

  <button class="next" onclick={advance} data-testid="newcomer-next">
    Next<Beacon gap="0.2rem" turns={3} />
  </button>
</div>

<style>
  /* The whole table steps back for a new character: it stands over everything, larger than anywhere else. */
  .newcomer {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    justify-items: center;
    gap: 1.2vh;
    padding: 5vh 4vw 4vh;
    pointer-events: auto;
    --h: min(70vh, calc((100vw - 8rem) / 1.2));
  }

  .veil {
    position: absolute;
    inset: 0;
    z-index: -3;
    background: radial-gradient(
      ellipse 70% 75% at 50% 52%,
      rgb(28 20 10 / 0.7),
      rgb(6 5 4 / 0.94) 75%
    );
    animation: fade-in 520ms ease both;
  }

  .burst {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: -2;
    width: calc(var(--h) * 1.7);
    aspect-ratio: 1;
    margin: calc(var(--h) * -0.85) 0 0 calc(var(--h) * -0.85);
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgb(255 214 120 / 0.5),
      rgb(226 160 60 / 0.16) 38%,
      transparent 68%
    );
    animation: burst 1600ms cubic-bezier(0.2, 0.8, 0.2, 1) 120ms both;
  }

  .rays {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: -1;
    width: calc(var(--h) * 2.2);
    aspect-ratio: 1;
    margin: calc(var(--h) * -1.1) 0 0 calc(var(--h) * -1.1);
    border-radius: 50%;
    background: repeating-conic-gradient(
      from 0deg,
      rgb(255 220 140 / 0.1) 0deg 4deg,
      transparent 4deg 18deg
    );
    mask-image: radial-gradient(circle, black 18%, transparent 62%);
    animation:
      fade-in 900ms ease 300ms both,
      turn 26s linear 300ms 1 both;
  }

  .kicker {
    margin: 0;
    overflow: hidden;
    color: #e9cf8e;
    font-size: clamp(0.9rem, 1.6vh, 1.2rem);
    font-weight: 800;
    letter-spacing: 0.42em;
    text-transform: uppercase;
    text-shadow: 0 0 1.2em rgb(226 160 60 / 0.7);
  }

  .kicker span {
    display: inline-block;
    animation: rise 700ms cubic-bezier(0.2, 0.9, 0.3, 1) 250ms both;
  }

  .card {
    align-self: center;
    width: calc(var(--h) * 1.2);
    height: var(--h);
    animation: step-in 900ms cubic-bezier(0.16, 1, 0.3, 1) 150ms both;
  }

  /* The figure rises first, then its name, its line and the panels of its arch one after another. */
  .card :global(.info > *) {
    animation: rise 620ms cubic-bezier(0.2, 0.9, 0.3, 1) both;
  }

  .card :global(.info > :nth-child(1)) {
    animation-delay: 650ms;
  }

  .card :global(.info > :nth-child(2)) {
    animation-delay: 850ms;
  }

  .card :global(.info > :nth-child(3)) {
    animation-delay: 1050ms;
  }

  .card :global(.cut) {
    transform-origin: 0 92%;
    animation: draw 700ms cubic-bezier(0.3, 0.8, 0.3, 1) 450ms both;
  }

  .occupation {
    color: #f1dca4;
    font-family: var(--font-display);
    white-space: nowrap;
    animation: rise 600ms ease 900ms both;
  }

  .rename {
    display: inline-flex;
    align-items: baseline;
    gap: 0.2em;
    max-width: 100%;
    cursor: text;
    pointer-events: auto;
  }

  .rename input {
    field-sizing: content;
    min-width: 3ch;
    max-width: 100%;
    padding: 0;
    border: 0;
    border-bottom: 1px dashed rgb(226 195 106 / 0.5);
    background: none;
    color: inherit;
    font: inherit;
    line-height: inherit;
    text-shadow: inherit;
  }

  .rename input:focus {
    border-bottom-color: #ffe293;
    outline: none;
  }

  .rename .pen {
    flex: none;
    width: 0.4em;
    height: 0.4em;
    fill: #e9cf8e;
    opacity: 0.75;
  }

  .age {
    flex: none;
    padding: 0.08em 0.5em;
    border: 1px solid rgb(226 195 106 / 0.42);
    border-radius: 999px;
    background: rgb(28 20 10 / 0.8);
    color: #f3dfb0;
    font-size: 0.72em;
    font-weight: 700;
    text-shadow: none;
  }

  .bio {
    flex: none;
    margin: 0 0 0.4cqh;
    padding: 1.2cqh 1.8cqw;
    border-left: 0.45cqw solid rgb(226 195 106 / 0.65);
    border-radius: 0.8cqh;
    background: rgb(20 15 10 / 0.82);
    color: #f1e3c4;
    font-size: 3.1cqh;
    font-style: italic;
    line-height: 1.35;
    text-shadow: none;
  }

  .next {
    position: relative;
    padding: 0.7rem 2.6rem;
    border: 1px solid rgb(233 207 142 / 0.75);
    border-radius: 4px;
    background: linear-gradient(180deg, rgb(64 46 18 / 0.95), rgb(34 24 10 / 0.95));
    color: #fbefd0;
    font: inherit;
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    cursor: pointer;
    animation: rise 500ms ease 1400ms both;
  }

  .next:hover,
  .next:focus-visible {
    border-color: #fff3cf;
    outline: none;
  }

  .leaving .veil,
  .leaving .burst,
  .leaving .rays,
  .leaving .kicker,
  .leaving .next,
  .leaving .card :global(.info),
  .leaving .card :global(.cut),
  .leaving .card :global(.base) {
    opacity: 0;
    transition: opacity 320ms ease;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }

  @keyframes burst {
    from {
      opacity: 0;
      transform: scale(0.3);
    }
    45% {
      opacity: 1;
    }
    to {
      opacity: 0.75;
      transform: scale(1);
    }
  }

  @keyframes turn {
    to {
      transform: rotate(40deg);
    }
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(0.8em);
    }
  }

  @keyframes step-in {
    from {
      opacity: 0;
      transform: translateY(6vh) scale(0.86);
    }
  }

  @keyframes draw {
    from {
      transform: scaleX(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .newcomer *,
    .newcomer :global(*) {
      animation-duration: 1ms !important;
      animation-delay: 0ms !important;
    }
  }
</style>
