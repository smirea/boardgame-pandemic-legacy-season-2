<script lang="ts">
  import { pack } from "@repo/game";
  import type {
    BriefedUnlock,
    JobId,
    Campaign,
    CityId,
    InfectionCard as InfectionCardData,
    PlayerCard as PlayerCardData,
  } from "@repo/game";
  import InfectionCard from "#lib/cards/InfectionCard.svelte";
  import { jobFigure } from "#lib/characters/figures.ts";
  import Portrait from "./Portrait.svelte";
  import ActionIcon from "./ActionIcon.svelte";
  import { ACTION_ICON } from "./labels.svelte.ts";
  import PlayerCard from "./PlayerCard.svelte";

  type Props = { unlock: BriefedUnlock; campaign: Campaign; size?: string };

  const jobName = (job: JobId) => pack.jobs.find((candidate) => candidate.id === job)!.name;

  /** The sticker an unlock that is no card, cube or action comes as. */
  const STICKER: Partial<Record<BriefedUnlock["t"], string>> = {
    rule: "Rule",
    turningPoint: "Turning Pt",
    epidemicCard: "Epidemic",
    ability: "Ability",
    scar: "Scar",
    owedScar: "Scar",
    cityImprovement: "Upgrade",
    infectionImprovement: "Upgrade",
    permanentStructure: "Permanent",
    job: "Job",
    lab: "Lab",
    region: "Region",
    route: "Route",
    edge: "Route",
    haven: "Haven",
    infest: "Infested",
    forsake: "Forsaken",
    destroy: "Destroyed",
    frequencyHint: "Signal",
    freeAbilityUnits: "Units",
    actions: "Actions",
    objectives: "Objective",
  };

  let { unlock, campaign, size = "1.9rem" }: Props = $props();

  // An improvement is bought for any card, so it is shown on a city the group already knows.
  const known = <T extends { kind: string }>(cards: T[]) =>
    cards.find((card) => "city" in card && campaign.locations[card.city as CityId]?.revealed) as
      | Extract<T, { kind: "city" }>
      | undefined;

  /** The game piece an unlock puts on the table, when it is one. */
  const piece = $derived.by(
    ():
      | { t: "player"; card: PlayerCardData }
      | { t: "infection"; card: InfectionCardData; copies: number }
      | { t: "cubes"; count: number }
      | { t: "action"; action: keyof typeof ACTION_ICON }
      | null => {
      switch (unlock.t) {
        case "cityImprovement": {
          const card = known(Object.values(campaign.playerCards));
          return card
            ? { t: "player", card: { ...card, improvement: unlock.improvement, search: [] } }
            : null;
        }
        case "infectionImprovement": {
          const card = known(Object.values(campaign.infectionCards));
          return card
            ? { t: "infection", card: { ...card, improvement: unlock.improvement }, copies: 1 }
            : null;
        }
        case "event": {
          const card = Object.values(campaign.playerCards).find(
            (card) => card.kind === "event" && card.event === unlock.event,
          );
          // An Event the box has given joins the deck only with the next game. Its card is known all the same.
          const face = {
            id: `event:${unlock.event}`,
            kind: "event",
            event: unlock.event,
            mode: unlock.mode,
          };
          return { t: "player", card: card ?? (face as PlayerCardData) };
        }
        case "gather":
        case "assemble": {
          const card = Object.values(campaign.infectionCards).find(
            (card) => card.kind === unlock.t,
          );
          return card ? { t: "infection", card, copies: unlock.cards } : null;
        }
        case "stockpileBonus":
          return { t: "cubes", count: unlock.amount };
        case "action":
          return unlock.action in ACTION_ICON
            ? { t: "action", action: unlock.action as keyof typeof ACTION_ICON }
            : null;
        default:
          return null;
      }
    },
  );
</script>

{#if piece?.t === "player"}
  <span class="piece"><PlayerCard card={piece.card} /></span>
{:else if piece?.t === "infection"}
  <span class="piece infection">
    <InfectionCard card={piece.card} />
    {#if piece.copies > 1}<b class="copies">×{piece.copies}</b>{/if}
  </span>
{:else if piece?.t === "cubes"}
  <span class="piece cubes" role="img" aria-label={`${piece.count} supply cubes`}>
    {#each { length: piece.count } as _, cube (cube)}<i></i>{/each}
  </span>
{:else if piece?.t === "action"}
  <ActionIcon action={piece.action} {size} />
{:else if unlock.t === "job" && jobFigure(unlock.job)}
  <span class="job-medallion" style:--size={size} aria-label={jobName(unlock.job)}>
    <Portrait portrait={0} job={unlock.job} color="#6b5a43" />
  </span>
{:else if unlock.t === "job"}
  <span class="sticker" style:--size={size}>{jobName(unlock.job)}</span>
{:else if unlock.t === "rule" && unlock.rule === "storage"}
  <span class="sticker storage-pkg" style:--size={size}>Package 6</span>
{:else if STICKER[unlock.t]}
  <span class="sticker" style:--size={size}>{STICKER[unlock.t]}</span>
{/if}

<style>
  /* `--brief-card` lets a crowded page, such as the Box's overview, lay the cards out smaller. */
  .piece {
    --card-size: var(--brief-card, 0.6rem);
    position: relative;
    display: flex;
    flex: none;
  }

  .piece.infection {
    --card-size: calc(var(--brief-card, 0.6rem) * 0.93);
  }

  .copies {
    align-self: flex-end;
    margin-left: 0.3rem;
    padding: 0 0.35rem;
    border-radius: 2px;
    background: var(--paper-ink);
    color: var(--paper);
    font-size: 0.8rem;
  }

  .cubes {
    flex-wrap: wrap;
    filter: drop-shadow(0 1px 0.5px rgb(20 12 4 / 0.6));
    width: 4.6rem;
    gap: 3px;
  }

  .sticker {
    display: grid;
    flex: none;
    place-items: center;
    min-width: calc(var(--size) * 1.5);
    height: var(--size);
    padding: 0 0.5rem;
    border: 1.5px solid var(--paper-ink);
    border-radius: 999px;
    background: var(--slip);
    color: var(--paper-ink);
    box-shadow: 0 1px 2px rgb(40 26 12 / 0.35);
    font-size: 0.8rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .sticker.storage-pkg {
    border-color: #5b3e1a;
    background: linear-gradient(180deg, #c99f67, #a47b47);
    color: #241607;
  }

  .job-medallion {
    position: relative;
    flex: none;
    width: var(--size);
    height: var(--size);
    border: 1.5px solid var(--paper-ink);
    border-radius: 50%;
    overflow: hidden;
    box-shadow: 0 1px 2px rgb(40 26 12 / 0.35);
  }

  .cubes i {
    width: 0.8rem;
    height: 0.8rem;
    background: conic-gradient(
      from 30deg at 50% 35%,
      #b1a38a 0deg 120deg,
      #e0d5bb 120deg 240deg,
      #fff5dc 240deg
    );
    clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
  }
</style>
