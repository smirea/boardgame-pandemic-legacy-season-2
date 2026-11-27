<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import type { CityId } from "@repo/game";
  import { cityName } from "../labels.svelte.ts";

  type Props = {
    /** The haven the character calls home, or none picked yet. */
    home: CityId | null;
    /** Whether the table may name this haven, as it may each starting haven before the first game. */
    canRename: (city: CityId) => boolean;
    rename: (city: CityId, name: string) => void;
    /** The havens a new character may pick from. Without them the chip only shows the home. */
    options?: CityId[];
    pick?: (city: CityId) => void;
    /** The haven under the pointer, to find on the map behind the screen. */
    look?: (city: CityId | null) => void;
    /** Whether the list of havens is open, for the screen to step aside while it is. */
    open?: boolean;
  };

  let { home, canRename, rename, options, pick, look, open = $bindable(false) }: Props = $props();

  // The haven being named and what has been typed so far, before it is sent.
  let naming = $state<CityId | null>(null);
  let draft = $state("");

  function begin(city: CityId) {
    draft = cityName(city);
    naming = city;
  }
  function finish(city: CityId) {
    const name = draft.trim();
    naming = null;
    if (name && name !== cityName(city)) rename(city, name);
  }
  // A list closed by a click away takes its field with it before the field can blur, so the name is kept here.
  function close() {
    if (naming) finish(naming);
    open = false;
    look?.(null);
  }
</script>

{#snippet pen(city: CityId)}
  <button
    type="button"
    class="pen"
    aria-label={`Rename ${cityName(city)}`}
    onclick={() => begin(city)}
    data-testid={`rename-${city}`}
  >
    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11.3 1.7l3 3-8.6 8.6-3.8.8.8-3.8z" /></svg
    >
  </button>
{/snippet}

{#snippet field(city: CityId)}
  <input
    class="name"
    bind:value={draft}
    maxlength="24"
    aria-label={`Name for ${cityName(city)}`}
    {@attach (element) => {
      element.focus();
      element.select();
    }}
    onblur={() => finish(city)}
    onkeydown={(event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.currentTarget.blur();
      }
      if (event.key === "Escape") {
        event.stopPropagation();
        draft = cityName(city);
        event.currentTarget.blur();
      }
    }}
    data-testid={`haven-name-${city}`}
  />
{/snippet}

<span
  class="chip"
  class:open
  {@attach feedback("Home haven", () => ({ home, choosing: Boolean(options) }))}
>
  <svg class="house" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 1.5 1 7.6h2v6.9h4v-4.5h2v4.5h4V7.6h2z" />
  </svg>
  <span class="sr-only">Home:</span>
  {#if options}
    <button
      type="button"
      class="value"
      class:unset={!home}
      aria-expanded={open}
      aria-haspopup="listbox"
      onclick={() => (open ? close() : (open = true))}
      data-testid="new-home"
    >
      {home ? cityName(home) : "Pick a haven"}
      <svg class="caret" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" /></svg>
    </button>
  {:else if home && naming === home}
    {@render field(home)}
  {:else if home}
    <b class="value">{cityName(home)}</b>
    {#if canRename(home)}{@render pen(home)}{/if}
  {/if}

  {#if open && options && pick}
    <!-- Picking a haven: each one is found on the map while the pointer rests on it. -->
    <div
      class="havens"
      role="listbox"
      aria-label="Home haven"
      tabindex="-1"
      onpointerleave={() => look?.(null)}
      onkeydown={(event) => event.key === "Escape" && (event.stopPropagation(), close())}
      {@attach (element) => {
        const away = (event: PointerEvent) => {
          if (!element.parentElement?.contains(event.target as Node)) close();
        };
        document.addEventListener("pointerdown", away, true);
        return () => document.removeEventListener("pointerdown", away, true);
      }}
    >
      {#each options as city (city)}
        <div class="haven" role="presentation" onpointerenter={() => look?.(city)}>
          {#if naming === city}
            {@render field(city)}
          {:else}
            <button
              type="button"
              role="option"
              aria-selected={home === city}
              onfocus={() => look?.(city)}
              onclick={() => {
                pick(city);
                close();
              }}
              data-testid={`home-${city}`}>{cityName(city)}</button
            >
            {#if canRename(city)}{@render pen(city)}{/if}
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</span>

<style>
  .house {
    flex: none;
    align-self: center;
    width: 1.05em;
    height: 1.05em;
    fill: #d6b66f;
  }

  .chip {
    position: relative;
    display: inline-flex;
    align-items: baseline;
    gap: 0.4em;
    min-width: 0;
  }

  .value {
    overflow: hidden;
    color: #f4ead6;
    font: inherit;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  button.value {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    padding: 0.05em 0.5em;
    border: 1px solid rgb(226 195 106 / 0.55);
    border-radius: 999px;
    background: rgb(14 11 9 / 0.6);
    cursor: pointer;
  }

  button.value.unset {
    border-style: dashed;
    color: #d6b66f;
    font-weight: 400;
  }

  button.value:hover,
  .open button.value {
    border-color: #e2c36a;
    background: rgb(40 31 16 / 0.8);
  }

  .caret {
    width: 0.6em;
    height: 0.4em;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
  }

  .pen {
    display: grid;
    flex: none;
    place-items: center;
    align-self: center;
    width: 1.3em;
    height: 1.3em;
    padding: 0.2em;
    border: 0;
    border-radius: 0.25em;
    background: none;
    color: #b7a98e;
    cursor: pointer;
  }

  .pen:hover,
  .pen:focus-visible {
    background: rgb(240 230 206 / 0.12);
    color: #f4ead6;
  }

  .pen svg {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }

  .name {
    width: 9em;
    min-width: 0;
    padding: 0 0.2em;
    border: 0;
    border-bottom: 1px solid #e2c36a;
    background: rgb(14 11 9 / 0.7);
    color: #f4ead6;
    font: inherit;
    font-weight: 700;
  }

  .name:focus {
    outline: none;
  }

  .havens {
    position: absolute;
    top: calc(100% + 0.5em);
    left: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    gap: 0.15em;
    min-width: 12em;
    padding: 0.35em;
    border: 1px solid rgb(226 195 106 / 0.45);
    border-radius: 0.5em;
    background: linear-gradient(172deg, rgb(22 18 15 / 0.96), rgb(14 11 9 / 0.97));
    box-shadow: 0 1em 2.4em rgb(0 0 0 / 0.7);
    animation: drop 180ms cubic-bezier(0.2, 0.9, 0.3, 1.05) both;
  }

  @keyframes drop {
    from {
      opacity: 0;
      translate: 0 -0.4em;
    }
  }

  .haven {
    display: flex;
    align-items: center;
    gap: 0.3em;
  }

  .haven [role="option"] {
    flex: 1;
    padding: 0.3em 0.55em;
    border: 1px solid transparent;
    border-radius: 0.35em;
    background: none;
    color: #f4ead6;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .haven [role="option"]:hover,
  .haven [role="option"]:focus-visible {
    background: rgb(240 230 206 / 0.08);
    outline: none;
  }

  .haven [aria-selected="true"] {
    border-color: rgb(226 195 106 / 0.6);
    color: #e2c36a;
    font-weight: 700;
  }
</style>
