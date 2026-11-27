<script lang="ts">
  import { pack, ruleBriefs, sealKey, unlockText } from "@repo/game";
  import type { Campaign, LegacyCardDef, Seal, Unlock } from "@repo/game";
  import LegacyCard from "#lib/cards/LegacyCard.svelte";
  import BriefPiece from "#lib/hud/BriefPiece.svelte";
  import Crate from "#lib/hud/Crate.svelte";
  import DossierDoor from "#lib/hud/DossierDoor.svelte";
  import RichText from "#lib/hud/RichText.svelte";

  type Props = {
    card: LegacyCardDef;
    /** The campaign as it stands in the card's month, which words what it reveals. */
    campaign: Campaign;
  };

  let { card, campaign }: Props = $props();

  const sealName = (seal: Seal) => (seal.t === "package" ? `Package ${seal.id}` : `Door ${seal.id}`);
  const defOf = (seal: Seal) =>
    pack.seals.find((entry) => sealKey(entry.seal) === sealKey(seal)) ?? null;
  const objectiveName = (id: string) =>
    pack.objectives.find((objective) => objective.id === id)?.name ?? id;

  /** The words for what the briefing does not word itself. */
  function plain(unlock: Unlock): string {
    switch (unlock.t) {
      case "objectives":
        return [
          unlock.add?.length ? `Objectives in play: ${unlock.add.map(objectiveName).join(", ")}.` : "",
          unlock.remove?.length
            ? `Objectives out of play: ${unlock.remove.map(objectiveName).join(", ")}.`
            : "",
        ]
          .filter(Boolean)
          .join(" ");
      case "required":
        return `Objectives to complete this month: ${unlock.count}.`;
      case "region": {
        const name = pack.regions.find((region) => region.id === unlock.region)?.name ?? unlock.region;
        const lines = unlock.connect?.length ?? 0;
        return `Region charted: ${name}${lines ? `, with ${lines} line${lines === 1 ? "" : "s"} drawn into it` : ""}.`;
      }
      case "rule":
        return ruleBriefs[unlock.rule] ?? `New rule: ${unlock.rule}.`;
      default:
        return unlock.t;
    }
  }

  // Seals lead to seals; none leads back, but the depth is bounded all the same.
  const DEEPEST = 6;
</script>

{#snippet line(unlock: Unlock, depth: number)}
  {#if unlock.t === "open"}
    {@render sealed(unlock.seal, depth, null)}
  {:else if unlock.t === "perimeter"}
    {@render sealed(
      unlock.seal,
      depth,
      `If ${sealName(unlock.seal)} is still sealed, it is forced open: its reward is lost and it counts toward no objective.`,
    )}
    {#each unlock.penalty ?? [] as penalty, index (index)}
      <div class="row penalty">
        <span class="kicker">Penalty</span>
        {@render line(penalty, depth)}
      </div>
    {/each}
  {:else if unlock.t === "scratch"}
    <div class="row note">
      If {sealName(unlock.unlessOpen)} is still sealed, scratch box {unlock.box.split(":")[1]} on this card.
    </div>
  {:else}
    {@const text = unlockText(campaign, unlock)}
    <div class="row">
      {#if text !== null}
        <span class="piece"><BriefPiece unlock={unlock as never} {campaign} size="2rem" /></span>
        <span class="text"><RichText {text} /></span>
      {:else}
        <span class="text">{plain(unlock)}</span>
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet sealed(seal: Seal, depth: number, condition: string | null)}
  {@const def = defOf(seal)}
  <section class="seal">
    <header>
      <span class="shell {seal.t}">
        {#if seal.t === "package"}<Crate id={seal.id} open />{:else}<DossierDoor
            id={seal.id}
            open
          />{/if}
      </span>
      <span>
        <b>{sealName(seal)}</b>
        {#if def}<span class="name">{def.name}</span>{/if}
        {#if condition}<span class="condition">{condition}</span>{/if}
      </span>
    </header>
    {#if def && depth < DEEPEST}
      <div class="contents">
        {#each def.unlocks as unlock, index (index)}
          {@render line(unlock, depth + 1)}
        {/each}
        {#if def.reward?.length}
          <span class="kicker">Reward, when the players open it themselves</span>
          {#each def.reward as unlock, index (index)}
            {@render line(unlock, depth + 1)}
          {/each}
        {/if}
        {#if !def.unlocks.length && !def.reward?.length}
          <span class="empty">Reference material only.</span>
        {/if}
      </div>
    {/if}
  </section>
{/snippet}

<div class="reveal">
  <div class="face">
    <LegacyCard {card} side="b" size="full" {campaign} />
  </div>
  <div class="what">
    <header class="head">
      <code>{card.id}</code>
      <h3>{card.title}</h3>
      <span class="tags">
        {card.kind}{#if card.halt}
          · {card.halt}{/if}{#if card.when}
          · only if the sample was {card.when === "delivered" ? "" : "not "}delivered{/if}
      </span>
    </header>
    {#if card.unlocks.length}
      {#each card.unlocks as unlock, index (index)}
        {@render line(unlock, 0)}
      {/each}
    {:else}
      <p class="empty">Reveals nothing beyond its own text.</p>
    {/if}
  </div>
</div>

<style>
  .reveal {
    display: flex;
    gap: 1.4rem;
    align-items: flex-start;
  }

  .face {
    position: sticky;
    top: 0;
    flex: none;
  }

  .what {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 0.55rem;
    min-width: 0;
  }

  .head code {
    color: var(--muted);
  }

  h3 {
    margin: 0.1rem 0;
    font-family: var(--font-display);
    font-size: 1.6rem;
    font-weight: 400;
  }

  .tags {
    color: var(--muted);
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .row {
    display: flex;
    gap: 0.7rem;
    align-items: center;
    font-size: 0.88rem;
    line-height: 1.35;
  }

  .piece {
    flex: none;
    display: grid;
    place-items: center;
    width: 4.6rem;
  }

  .text {
    min-width: 0;
  }

  .note,
  .condition {
    color: #f0c674;
  }

  .penalty {
    align-items: flex-start;
    padding-left: 1rem;
  }

  .seal {
    padding: 0.6rem 0.8rem;
    border-left: 2px solid #c9a86a;
    background: rgb(231 220 198 / 0.05);
  }

  .seal header {
    display: flex;
    gap: 0.8rem;
    align-items: center;
  }

  .seal header > span:last-child {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .shell.package {
    width: 3.6rem;
    font-size: 0.55rem;
  }

  .shell.door {
    width: 2.4rem;
    font-size: 0.6rem;
  }

  .name {
    font-family: var(--font-display);
    font-size: 1.1rem;
  }

  .condition {
    font-size: 0.8rem;
  }

  .contents {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.6rem;
    padding-left: 0.6rem;
  }

  .kicker {
    color: var(--muted);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .empty {
    margin: 0;
    color: var(--muted);
    font-size: 0.85rem;
  }
</style>
