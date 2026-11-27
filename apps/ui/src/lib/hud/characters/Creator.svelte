<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import { pack, reject } from "@repo/game";
  import type { CityId, Command, JobId, PlayerId, PublicState } from "@repo/game";
  import { flip } from "svelte/animate";
  import { fade, fly } from "svelte/transition";
  import { jobProfiles } from "#lib/cards/print.generated.ts";
  import { figureUrl, jobFigure, UNKNOWN_FIGURE } from "#lib/characters/figures.ts";
  import type { FigureKey } from "#lib/characters/personas.ts";
  import { characterVoice } from "#lib/characters/voice.svelte.ts";
  import { keep } from "../viewState.ts";
  import Exposure, { shownTrack } from "./Exposure.svelte";
  import Faces from "./Faces.svelte";
  import HavenChip from "./HavenChip.svelte";
  import Sheet from "./Sheet.svelte";
  import TraitPanel from "./TraitPanel.svelte";

  type Props = {
    snap: PublicState;
    player: PlayerId;
    send: (command: Command) => void;
    /** The colour this player's next character plays in. */
    color: string | null;
    canRename: (city: CityId) => boolean;
    rename: (city: CityId, name: string) => void;
    look: (city: CityId | null) => void;
    /** Whether the list of havens is open, while the rest of the table steps aside for the map. */
    picking: boolean;
  };

  let {
    snap,
    player,
    send,
    color,
    canRename,
    rename,
    look,
    picking = $bindable(),
  }: Props = $props();

  const world = $derived(snap.world);
  const campaign = $derived(world.campaign);
  // The table makes one character together: every screen shows and edits the same draft.
  const draft = $derived(world.table.draft);

  const havens = pack.cities
    .filter((city) => city.kind === "haven" && !city.lost)
    .map((city) => city.id);
  const portraits = Array.from({ length: pack.numbers.portraits }, (_, index) => index);
  const worn = $derived(
    new Set(
      Object.values(campaign.characters)
        .filter((character) => !character.dead && !character.worker)
        .map((character) => character.portrait),
    ),
  );
  const faces = $derived(portraits.filter((index) => !worn.has(index)));
  const face = $derived(
    draft.portrait !== null && !worn.has(draft.portrait) ? draft.portrait : null,
  );

  // A found occupation comes with its own home and its own person.
  const homeOf = (id: JobId) =>
    pack.jobs.find((option) => option.id === id)?.starting
      ? null
      : (campaign.jobsFound.find((entry) => entry.job === id)?.home ?? null);
  // Each occupation is asked of the engine with a stand-in name and home, so a blank field crosses out nothing.
  const jobs = $derived(
    pack.jobs
      .filter(
        (option) => option.starting || campaign.jobsFound.some((entry) => entry.job === option.id),
      )
      .map((option) => ({
        ...option,
        refusal: reject(world, snap.phase, {
          type: "CREATE_CHARACTER",
          name: option.name,
          job: option.id,
          home: homeOf(option.id) ?? draft.home ?? havens[0]!,
          player,
        }),
      })),
  );
  const job = $derived(jobs.find((option) => option.id === draft.job) ?? null);
  const jobProfile = $derived(job ? (jobProfiles[job.id] ?? null) : null);
  const own = $derived(job ? jobFigure(job.id) : null);
  const fixedHome = $derived(job ? homeOf(job.id) : null);
  const home = $derived(fixedHome ?? draft.home);
  const figure = $derived(
    own ? figureUrl(own) : face !== null ? figureUrl(`survivor-${face}`) : UNKNOWN_FIGURE,
  );
  const card = $derived(campaign.characterCards[0]);

  // The name being typed here, sent a moment after each keystroke and shown instead of the table's until it is.
  let typing = $state<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const named = $derived(typing ?? draft.name);
  function type(name: string) {
    typing = name;
    clearTimeout(timer);
    timer = setTimeout(() => send({ type: "DRAFT", set: { name } }), 160);
  }
  function settle() {
    clearTimeout(timer);
    if (typing !== null && typing !== draft.name) send({ type: "DRAFT", set: { name: typing } });
    typing = null;
  }
  $effect(() => () => clearTimeout(timer));
  keep(
    "character-creator",
    () => ({ typing, picking }),
    (saved) => {
      typing = saved.typing;
      picking = saved.picking;
    },
  );

  const create = $derived<Command | null>(
    job && home
      ? {
          type: "CREATE_CHARACTER",
          name: named.trim(),
          job: job.id,
          home,
          ...(own || face === null ? {} : { portrait: face }),
          player,
        }
      : null,
  );
  const refusal = $derived(
    !job
      ? "Choose an occupation"
      : !own && face === null
        ? "Pick a face"
        : !home
          ? "Pick a home haven"
          : reject(world, snap.phase, create!),
  );
  function mint() {
    if (!create || refusal) return;
    const key = (own ?? (face !== null ? `survivor-${face}` : null)) as FigureKey | null;
    if (key) characterVoice.play(key, "punchline", { priority: "ui" });
    clearTimeout(timer);
    send(create);
    typing = null;
  }

  const stones = $derived(job ? 1 + pack.numbers.characterSlots : jobs.length);
  const shownJobs = $derived(job ? [job] : jobs);
</script>

<article
  class="creator"
  aria-label="New character"
  data-testid="new-character"
  {@attach feedback("New character", () => ({ draft, refusal }))}
>
  <Sheet
    {figure}
    unknown={!own && face === null}
    tone="new"
    {color}
    fitted={named || "New character"}
  >
    {#snippet name()}
      <input
        class="name"
        value={named}
        maxlength="24"
        placeholder="New character"
        aria-label="Character name"
        oninput={(event) => type(event.currentTarget.value)}
        onblur={settle}
        onkeydown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        data-testid="new-name"
      />
    {/snippet}
    {#snippet meta()}
      {#if card}<Exposure boxes={shownTrack(card.track, card.exposure)} />{/if}
      {#if job}
        <span class="home" in:fade={{ duration: 260, delay: 220 }}>
          <HavenChip
            {home}
            {canRename}
            {rename}
            options={fixedHome ? undefined : havens}
            pick={(city) => send({ type: "DRAFT", set: { home: city } })}
            {look}
            bind:open={picking}
          />
        </span>
        {#if jobProfile?.age}<span class="age">Age {jobProfile.age}</span>{/if}
      {/if}
    {/snippet}
    {#snippet arch()}
      {#if jobProfile?.text}
        <p class="bio">{jobProfile.text}</p>
      {/if}
      {#each shownJobs as option, index (option.id)}
        <div
          class="stone"
          animate:flip={{ duration: 360 }}
          in:fly={{ x: 40, duration: 260, delay: index * 30 }}
          out:fly={{ x: 60, duration: 220 }}
        >
          <TraitPanel
            at={(index + 0.5) / stones}
            kind="job"
            label={job ? "Occupation" : "Choose an occupation"}
            name={option.name}
            text={option.text}
            refusal={job ? null : option.refusal}
            onclick={job
              ? undefined
              : () => {
                  const special = jobFigure(option.id) as FigureKey | null;
                  if (special) characterVoice.play(special, "punchline", { priority: "ui" });
                  send({ type: "DRAFT", set: { job: option.id } });
                }}
            testid={job ? undefined : `job-${option.id}`}
          >
            {#if job}
              <button
                type="button"
                class="change"
                onclick={() => send({ type: "DRAFT", set: { job: null } })}
                data-testid="change-job">Change</button
              >
            {/if}
          </TraitPanel>
        </div>
      {/each}
      {#if job}
        {#each { length: pack.numbers.characterSlots } as _, index (index)}
          <div class="stone" in:fade={{ duration: 300, delay: 260 + index * 70 }}>
            <TraitPanel at={(index + 1.5) / stones} kind="empty" />
          </div>
        {/each}
      {/if}
    {/snippet}
    {#snippet over()}
      {#if !own}
        <Faces
          {faces}
          chosen={face}
          pick={(portrait) => {
            characterVoice.play(`survivor-${portrait}` as FigureKey, "punchline", {
              priority: "ui",
            });
            send({ type: "DRAFT", set: { portrait } });
          }}
        />
      {/if}
    {/snippet}
    {#snippet base()}
      <button class="mint" disabled={refusal !== null} onclick={mint} data-testid="create-character"
        >Create &amp; take</button
      >
      <span class="why" aria-live="polite">{refusal ?? ""}</span>
    {/snippet}
  </Sheet>
</article>

<style>
  .creator {
    width: 100%;
    height: 100%;
  }

  .name {
    width: 100%;
    min-width: 0;
    padding: 0;
    border: 0;
    border-bottom: 1px dashed rgb(240 230 206 / 0.35);
    background: none;
    color: inherit;
    font: inherit;
    text-shadow: inherit;
  }

  .name::placeholder {
    color: rgb(240 230 206 / 0.38);
  }

  .name:focus {
    border-bottom-color: #e2c36a;
    outline: none;
  }

  .home {
    display: inline-flex;
    min-width: 0;
  }

  .age {
    flex: none;
    padding: 0.06em 0.45em;
    border: 1px solid rgb(226 195 106 / 0.4);
    border-radius: 999px;
    background: rgb(22 17 11 / 0.8);
    color: #f3dfb0;
    font-size: 0.72em;
    font-weight: 700;
    text-shadow: none;
  }

  .bio {
    flex: none;
    margin: 0 0 0.4cqh;
    padding: 1cqh 1.6cqw;
    border-left: 0.4cqw solid rgb(226 195 106 / 0.6);
    border-radius: 0.7cqh;
    background: rgb(20 15 10 / 0.82);
    color: #f1e3c4;
    font-size: 2.9cqh;
    font-style: italic;
    line-height: 1.32;
    text-shadow: none;
  }

  .stone {
    display: flex;
    flex: 1.5 1 0;
    flex-direction: column;
    min-height: 0;
  }

  .stone:has(:global(.empty)) {
    flex-grow: 0.8;
  }

  .change {
    align-self: center;
    flex: none;
    padding: 0.2em 0.6em;
    border: 1px solid rgb(226 195 106 / 0.55);
    border-radius: 999px;
    background: rgb(14 11 9 / 0.6);
    color: #e2c36a;
    font: inherit;
    font-size: 0.8em;
    cursor: pointer;
  }

  .change:hover,
  .change:focus-visible {
    border-color: #e2c36a;
    background: rgb(40 31 16 / 0.85);
    outline: none;
  }

  .mint {
    flex: none;
    padding: 0.3em 1em;
    border: 1px solid #e2c36a;
    border-radius: 0.3em;
    background: #e2c36a;
    color: #16110a;
    font: inherit;
    font-weight: 800;
    text-shadow: none;
    cursor: pointer;
    transition: opacity 200ms ease;
  }

  .mint:disabled {
    border-color: rgb(226 195 106 / 0.4);
    background: rgb(14 11 9 / 0.55);
    color: rgb(226 195 106 / 0.6);
    cursor: default;
  }

  .why {
    color: #b7a98e;
    font-size: 0.8em;
    white-space: nowrap;
  }
</style>
