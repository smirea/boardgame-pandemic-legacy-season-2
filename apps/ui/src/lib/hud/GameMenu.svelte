<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import { scenarios } from "@repo/game";
  import { scale } from "svelte/transition";
  import { presentFeedback } from "#lib/feedback.ts";
  import { keepRecord } from "#lib/replay/library.ts";
  import type { SessionView } from "#lib/session/session.svelte.ts";
  import { DEBUG_ID } from "#lib/storage.ts";
  import { STORY_SCENES } from "#lib/story/script.ts";
  import type { StoryScene } from "#lib/story/script.ts";

  type Props = {
    session: SessionView;
    spectator: boolean;
    /** This browser holds a seat at a table of several, which it can give up. */
    canVacate: boolean;
    toast: (text: string) => void;
    onclose: () => void;
    /** Opens the story log, at a scene or at its start. */
    onstory: (scene: StoryScene | null) => void;
    onhotkeys: () => void;
    onvacate: () => void;
  };

  let { session, spectator, canVacate, toast, onclose, onstory, onhotkeys, onvacate }: Props =
    $props();

  /** The host's recording, which a peer has to ask the host for. Null, with the reason shown, when there is none. */
  async function fetchRecord(): Promise<string | null> {
    try {
      const record = await session.exportRecord();
      if (!record)
        toast("Nothing has been recorded yet: the recording starts with the first move of a game.");
      return record;
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async function downloadRecord() {
    onclose();
    const record = await fetchRecord();
    if (!record) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([record], { type: "application/json" }));
    link.download = `recording-${(JSON.parse(record) as { id: string }).id}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const replayUrl = (game?: string) =>
    `/replay?src=library${game ? `&game=${game}` : ""}${DEBUG_ID ? `&DEBUG_ID=${DEBUG_ID}` : ""}`;

  /**
   * A peer keeps a copy of the host's recording in its own library and opens it there. The recording arrives within
   * the click's activation window, so the browser lets the tab open after it.
   */
  async function replayTable() {
    onclose();
    const record = await fetchRecord();
    if (!record) return;
    let game: string;
    try {
      game = await keepRecord(JSON.parse(record));
    } catch (error) {
      return toast(
        `This browser could not keep the recording: ${error instanceof Error ? error.message : error}`,
      );
    }
    if (!open(replayUrl(game), "_blank"))
      toast(
        "The browser blocked the replay tab. Allow pop-ups for this site, or open Replays from the Menu again.",
      );
  }

  let fileInput = $state<HTMLInputElement>();
  function download() {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([session.exportSave()], { type: "application/json" }));
    link.download = `campaign-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
</script>

<div
  class="menu"
  transition:scale|global={{ start: 0.92, duration: 180, opacity: 0 }}
  {@attach feedback("Menu", () => undefined)}
>
  <button
    onclick={() => {
      onclose();
      onstory(null);
    }}
    data-testid="open-story-log">Story log</button
  >
  <button
    onclick={() => {
      onclose();
      onstory(STORY_SCENES.prelude ?? null);
    }}
    data-testid="watch-prelude">Watch intro (71 Years Ago)</button
  >
  <button
    onclick={() => {
      onclose();
      // The capture waits for the menu's exit transition, so the screenshot shows the table without it.
      setTimeout(() => void presentFeedback(), 220);
    }}>Give feedback <kbd>⌥⌘ click</kbd></button
  >
  {#if !spectator}
    <button
      onclick={() => {
        onclose();
        onhotkeys();
      }}
      data-testid="open-hotkeys">Keyboard shortcuts <kbd>?</kbd></button
    >
  {/if}
  {#if canVacate}
    <button
      onclick={() => {
        onclose();
        onvacate();
      }}
      data-testid="vacate-seat">Vacate my seat</button
    >
  {/if}
  <button onclick={download}>Export campaign save</button>
  {#if !spectator}
    <button onclick={downloadRecord} data-testid="save-recording">Save this game's recording</button
    >
    {#if session.mode === "join"}
      <button onclick={replayTable} data-testid="open-replay">Replays</button>
    {:else}
      <a href={replayUrl()} target="_blank" data-testid="open-replay">Replays</a>
    {/if}
  {/if}
  {#if session.mode !== "join"}
    <button onclick={() => fileInput?.click()}>Import campaign save</button>
    <button
      onclick={() =>
        confirm(
          "Load the canonical campaign at the September lobby? The current one is erased unless you exported it.",
        ) && session.importSave(scenarios.canonical())}
      data-testid="scenario-canonical">Load canonical save</button
    >
    <button
      class="danger"
      onclick={() =>
        confirm("Start a new campaign? The current one is erased unless you exported it.") &&
        session.newCampaign()}>New campaign</button
    >
    <input
      bind:this={fileInput}
      type="file"
      accept="application/json"
      hidden
      onchange={async (event) => session.importSave(await event.currentTarget.files![0]!.text())}
    />
  {/if}
</div>

<style>
  .menu {
    transform-origin: top right;
    position: absolute;
    top: 0.4rem;
    right: 0.7rem;
    z-index: var(--z-menu);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem;
    border: 1px solid var(--line-strong);
    border-radius: 3px;
    background: var(--panel-solid);
    box-shadow: 0 1rem 2.5rem rgb(0 0 0 / 0.5);
    font-size: 0.85rem;
  }

  .menu > * {
    animation: rise 260ms calc(var(--n, 0) * 30ms) both;
  }

  .menu > :nth-child(2) {
    --n: 1;
  }

  .menu > :nth-child(3) {
    --n: 2;
  }

  .menu > :nth-child(4) {
    --n: 3;
  }

  .menu > :nth-child(5) {
    --n: 4;
  }

  .menu > :nth-child(n + 6) {
    --n: 5;
  }

  @keyframes rise {
    from {
      opacity: 0;
      translate: 0 0.4rem;
    }
  }

  .menu button,
  .menu a {
    padding: 0.35rem 0.7rem;
    border: 1px solid transparent;
    border-radius: 2px;
    background: none;
    color: var(--ink);
    font: inherit;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }

  .menu button:hover,
  .menu a:hover {
    border-color: var(--line);
    background: var(--wash);
  }

  .menu kbd {
    margin-left: 0.6rem;
    color: var(--muted);
    font: inherit;
    font-size: 0.75rem;
  }

  .menu .danger {
    color: var(--danger);
  }
</style>
