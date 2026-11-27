<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import { pack } from "@repo/game";
  import type { Campaign, Character, CityId } from "@repo/game";
  import { getContext } from "svelte";
  import type { Snippet } from "svelte";
  import { jobProfiles } from "#lib/cards/print.generated.ts";
  import { figureKey, figureUrl } from "#lib/characters/figures.ts";
  import { cityName, MONTHS } from "../labels.svelte.ts";
  import { characterTraits, placed, TRAIT_KIND } from "../traits.ts";
  import Exposure, { shownTrack } from "./Exposure.svelte";
  import type { ShownBox } from "./Exposure.svelte";
  import HavenChip from "./HavenChip.svelte";
  import Sheet from "./Sheet.svelte";
  import TraitPanel from "./TraitPanel.svelte";

  type Props = {
    character: Character;
    campaign?: Campaign;
    tone: "mine" | "taken" | "free" | "dead";
    color: string | null;
    side?: "left" | "right";
    /** What stands on the cut under the figure, such as who holds the character. */
    base?: Snippet;
    /** What lies over the figure's foot. */
    over?: Snippet;
    /** Clicking anywhere on the card, such as taking it for the next game. */
    toggle?: () => void;
    canRename?: (city: CityId) => boolean;
    rename?: (city: CityId, name: string) => void;
    /** When provided, lets the player rename this character inline on the card. */
    onrenameCharacter?: (name: string) => void;
    /** Whether the bottom-left journal toggle is shown (full card only; off for haven workers). */
    showJournal?: boolean;
    /** The track shown, when the table is watching a box scratched open. */
    exposure?: { boxes: ShownBox[]; now: number; stage: "covered" | "scratching" | "open" };
    /** Drawn above the card, for the feedback tag. */
    label?: string;
  };

  let {
    character,
    campaign: campaignProp,
    tone,
    color,
    side = "left",
    base,
    over,
    toggle,
    canRename = () => false,
    rename = () => {},
    onrenameCharacter,
    showJournal = true,
    exposure,
    label = "Character",
  }: Props = $props();

  const campaignFromCtx = getContext<(() => Campaign) | undefined>("campaign");
  const campaign = $derived(campaignProp ?? campaignFromCtx?.());

  const traits = $derived(characterTraits(character));
  const empty = $derived(character.slots.filter((slot) => slot === null).length);
  const stones = $derived(traits.length + empty);
  const profile = $derived(character.job ? (jobProfiles[character.job] ?? null) : null);

  let journalOpen = $state(false);
  let lastCharacterId = $state("");
  $effect(() => {
    if (character.id !== lastCharacterId) {
      lastCharacterId = character.id;
      journalOpen = false;
    }
  });

  const journalGames = $derived.by(() => {
    if (!campaign) return [];
    const entries: { month: number; attempt: number; won: boolean; player: string | null }[] = [];
    for (const result of campaign.results) {
      const idx = result.characters.indexOf(character.id);
      if (idx < 0) continue;
      entries.push({
        month: result.month,
        attempt: result.attempt,
        won: result.won,
        player: result.chronicle?.crew[idx]?.player ?? null,
      });
    }
    return entries;
  });

  const journalScars = $derived.by(() => {
    const out: { name: string; where: string }[] = [];
    for (const [scarId, record] of Object.entries(character.scarred ?? {})) {
      if (!record) continue;
      const def = pack.scars.find((s) => s.id === scarId);
      if (!def) continue;
      out.push({ name: def.name, where: placed(record.at, record.month) });
    }
    return out;
  });

  const hasJournal = $derived(showJournal && !character.worker);

  function commitRename(event: Event & { currentTarget: HTMLInputElement }) {
    const trimmed = event.currentTarget.value.trim();
    if (trimmed && trimmed !== character.name) onrenameCharacter?.(trimmed);
    else event.currentTarget.value = character.name;
  }
</script>

{#snippet hit()}
  <button
    class="hit"
    onclick={toggle}
    disabled={tone === "taken"}
    aria-pressed={tone === "mine"}
    aria-label={tone === "mine" ? `Let go of ${character.name}` : `Take ${character.name}`}
    data-testid={`claim-${character.id}`}
  ></button>
{/snippet}

{#snippet nothing()}{/snippet}

{#snippet journalContent()}
  <div class="journal-head">
    <span class="journal-kicker">Character Journal</span>
    {#if profile?.age}<span class="journal-age">Age {profile.age}</span>{/if}
    <button
      type="button"
      class="journal-close"
      aria-label="Close character journal"
      onclick={(event) => {
        event.stopPropagation();
        journalOpen = false;
      }}>×</button
    >
  </div>
  {#if profile?.text}
    <p class="journal-bio">{profile.text}</p>
  {/if}
  {#if character.dead}
    <p class="journal-fallen">
      Fallen{character.diedAt ? ` in ${cityName(character.diedAt)}` : ""}
    </p>
  {/if}
  {#if journalScars.length}
    <div class="journal-block">
      <span class="journal-sub">Scars</span>
      <ul class="journal-scars">
        {#each journalScars as scar (scar.name)}
          <li><b>{scar.name}</b>{#if scar.where}<span>{scar.where}</span>{/if}</li>
        {/each}
      </ul>
    </div>
  {/if}
  <div class="journal-block">
    <span class="journal-sub">Service Record</span>
    {#if journalGames.length}
      <table class="journal-log">
        <thead>
          <tr><th>Month</th><th>Player</th><th>Outcome</th></tr>
        </thead>
        <tbody>
          {#each journalGames as entry, idx (`${entry.month}-${entry.attempt}-${idx}`)}
            <tr>
              <td>{MONTHS[entry.month] ?? `Month ${entry.month}`}{entry.attempt > 1 ? " II" : ""}</td>
              <td>{entry.player ?? "—"}</td>
              <td class={entry.won ? "won" : "lost"}>{entry.won ? "Won" : "Lost"}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="journal-empty">No games logged yet.</p>
    {/if}
  </div>
{/snippet}

<article
  class="character"
  aria-label={character.name}
  {@attach feedback(label, () => ({ character: character.name, job: character.job, tone }))}
>
  <Sheet
    figure={figureUrl(figureKey({ ...character, hooded: character.worker }))}
    {tone}
    {side}
    {color}
    fitted={character.name}
    hit={toggle ? hit : undefined}
    {over}
    base={base ?? nothing}
    journal={hasJournal ? journalContent : undefined}
    {journalOpen}
    onToggleJournal={hasJournal ? () => (journalOpen = !journalOpen) : undefined}
  >
    {#snippet name()}
      {#if onrenameCharacter}
        <label class="char-rename">
          <input
            value={character.name}
            maxlength="24"
            aria-label={`Rename ${character.name}`}
            onclick={(event) => event.stopPropagation()}
            onchange={commitRename}
            onkeydown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                event.currentTarget.value = character.name;
                event.currentTarget.blur();
              }
            }}
            data-testid={`rename-${character.id}`}
          />
          <svg class="pen" viewBox="0 0 16 16" aria-hidden="true"
            ><path d="M11.3 1.7l3 3-8.6 8.6-3.8.8.8-3.8z" /></svg
          >
        </label>
      {:else}
        {character.name}
      {/if}
    {/snippet}
    {#snippet meta()}
      {#if exposure}
        <Exposure boxes={exposure.boxes} now={exposure.now} stage={exposure.stage} />
      {:else}
        <Exposure boxes={shownTrack(character.exposureTrack, character.exposure)} />
      {/if}
      <HavenChip home={character.home} {canRename} {rename} />
      {#if character.carrier}<span class="sample" data-testid="carrier-badge">Sample</span>{/if}
    {/snippet}
    {#snippet arch()}
      {#each traits as trait, index (`${trait.kind}:${trait.name}:${index}`)}
        <TraitPanel
          at={(index + 0.5) / stones}
          kind={trait.kind}
          label={TRAIT_KIND[trait.kind]}
          name={trait.name}
          text={trait.text}
          struck={trait.struck}
          taken={trait.taken}
        />
      {/each}
      {#each { length: empty } as _, index (index)}
        <TraitPanel at={(traits.length + index + 0.5) / stones} kind="empty" />
      {/each}
    {/snippet}
  </Sheet>
</article>

<style>
  .character {
    width: 100%;
    height: 100%;
  }

  .hit {
    position: absolute;
    inset: 0;
    z-index: 1;
    padding: 0;
    border: 0;
    border-radius: 1cqh;
    background: none;
    cursor: pointer;
  }

  .hit:disabled {
    cursor: default;
  }

  .hit:focus-visible {
    outline: 2px solid rgb(226 195 106 / 0.7);
    outline-offset: 0.4cqh;
  }

  .char-rename {
    display: inline-flex;
    align-items: baseline;
    gap: 0.18em;
    max-width: 100%;
    cursor: text;
    pointer-events: auto;
  }

  .char-rename input {
    field-sizing: content;
    min-width: 2ch;
    max-width: 100%;
    padding: 0;
    border: 0;
    border-bottom: 1px dashed transparent;
    background: none;
    color: inherit;
    font: inherit;
    line-height: inherit;
    text-shadow: inherit;
  }

  .char-rename:hover input,
  .char-rename input:focus {
    border-bottom-color: rgb(226 195 106 / 0.7);
    outline: none;
  }

  .char-rename .pen {
    flex: none;
    width: 0.42em;
    height: 0.42em;
    fill: #d8c6a3;
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .char-rename:hover .pen,
  .char-rename:focus-within .pen {
    opacity: 0.85;
  }

  .sample {
    flex: none;
    padding: 0.05em 0.45em;
    border: 1px solid #3fe3b0;
    border-radius: 999px;
    background: rgb(14 48 40 / 0.92);
    color: #9bf5d7;
    font-size: 0.7em;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-shadow: none;
  }

  .journal-head {
    display: flex;
    align-items: center;
    gap: 0.5em;
    padding-bottom: 0.4em;
    border-bottom: 1px solid rgb(235 220 190 / 0.16);
  }

  .journal-kicker {
    color: #e2c36a;
    font-size: 0.82em;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .journal-age {
    padding: 0.08em 0.45em;
    border: 1px solid rgb(226 195 106 / 0.35);
    border-radius: 999px;
    color: #f3dfb0;
    font-size: 0.76em;
    font-weight: 700;
  }

  .journal-close {
    margin-left: auto;
    padding: 0 0.25em;
    border: 0;
    background: none;
    color: #c8b89b;
    font: inherit;
    font-size: 1.25em;
    line-height: 1;
    cursor: pointer;
  }

  .journal-close:hover,
  .journal-close:focus-visible {
    color: #fff3d6;
    outline: none;
  }

  .journal-bio {
    margin: 0;
    padding-left: 0.55em;
    border-left: 2px solid rgb(226 195 106 / 0.45);
    color: #efe2c6;
    font-style: italic;
  }

  .journal-fallen {
    margin: 0;
    color: #ff9a80;
    font-weight: 700;
  }

  .journal-block {
    display: flex;
    flex-direction: column;
    gap: 0.3em;
  }

  .journal-sub {
    color: #b7a98e;
    font-size: 0.76em;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .journal-scars {
    display: flex;
    flex-direction: column;
    gap: 0.22em;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .journal-scars li {
    display: flex;
    justify-content: space-between;
    gap: 0.6em;
  }

  .journal-scars b {
    color: #f6b19a;
  }

  .journal-scars span {
    color: #b7a98e;
    font-size: 0.9em;
  }

  .journal-log {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.92em;
  }

  .journal-log th {
    padding: 0.15em 0.3em 0.25em 0;
    border-bottom: 1px solid rgb(235 220 190 / 0.14);
    color: #b7a98e;
    font-size: 0.8em;
    font-weight: 700;
    text-align: left;
  }

  .journal-log td {
    padding: 0.22em 0.3em 0.22em 0;
    border-bottom: 1px solid rgb(235 220 190 / 0.08);
  }

  .journal-log td.won {
    color: #9fe0a8;
    font-weight: 700;
  }

  .journal-log td.lost {
    color: #f29a86;
    font-weight: 700;
  }

  .journal-empty {
    margin: 0;
    color: #b7a98e;
    font-style: italic;
  }
</style>
