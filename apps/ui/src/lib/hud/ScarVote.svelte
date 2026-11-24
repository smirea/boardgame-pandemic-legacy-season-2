<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import { scarCandidates, tablePlayers } from "@repo/game";
  import type { Command, Decision, PlayerId, SeatId, World } from "@repo/game";
  import { onMount } from "svelte";
  import { fade, fly, scale } from "svelte/transition";
  import { backOut } from "svelte/easing";
  import { characterVoice } from "#lib/characters/voice.svelte.ts";
  import CharacterSheet from "./characters/CharacterSheet.svelte";
  import { seatColor } from "./labels.svelte.ts";
  import VoteButton from "./VoteButton.svelte";
  import { tableVoters, waitingOn } from "./voters.ts";

  type Props = {
    world: World;
    vote: Extract<Decision, { t: "scarVote" }>;
    player: PlayerId;
    spectator: boolean;
    send: (command: Command) => void;
  };

  let { world, vote, player, spectator, send }: Props = $props();

  const game = $derived(world.game!);
  const owed = $derived(game.pending.filter((pending) => pending.t === "scarVote").length);
  const candidates = $derived(new Set(scarCandidates(world, vote)));
  const players = $derived(tablePlayers(world.table));
  const canVote = $derived(!spectator && (players.length === 0 || players.includes(player)));
  const mine = $derived(vote.votes[player] ?? null);
  const everyone = $derived(tableVoters(world.table, (who) => vote.votes[who] !== undefined));
  const waiting = $derived(waitingOn(everyone, player));
  const split = $derived(new Set(Object.values(vote.votes)).size > 1);
  const colorOf = (seat: SeatId) => seatColor(seat);

  // The table is warned before it is asked: the note holds a moment on every screen, then the characters come up.
  const NOTE_MS = 2600;
  let noted = $state(false);
  onMount(() => {
    const timer = setTimeout(() => (noted = true), NOTE_MS);
    return () => clearTimeout(timer);
  });

  function choose(seat: SeatId) {
    if (!canVote || !candidates.has(seat)) return;
    if (mine !== seat) {
      const id = game.players[seat]?.character;
      const character = id ? world.campaign.characters[id] : undefined;
      if (character) characterVoice.playFor(character, "punchline", { priority: "ui" });
    }
    send({ type: "SCAR_VOTE", player, seat: mine === seat ? null : seat });
  }
</script>

<div class="scar-vote" {@attach feedback("Scar vote", () => ({ owed, votes: vote.votes, noted }))}>
  {#if !noted}
    <div
      class="note"
      role="status"
      in:scale={{ start: 0.9, duration: 420, easing: backOut }}
      out:fade={{ duration: 220 }}
    >
      <span class="kicker">The Legacy deck</span>
      <h2>Prepare to add a scar</h2>
      <p>
        {owed > 1 ? `${owed} characters` : "One character"} of this game {owed > 1
          ? "each take"
          : "takes"} a scar. The table chooses who, together.
      </p>
    </div>
  {:else}
    <div class="ballot" in:fade={{ duration: 320 }}>
      <header>
        <span class="kicker">A scar is owed</span>
        <h2>Who takes the scar?</h2>
        <p>
          Everyone votes for the same character. They choose which scar it is, and where it goes.
        </p>
      </header>
      <div class="cards" style:--count={game.seats.length}>
        {#each game.seats as seat, index (seat)}
          {@const character = world.campaign.characters[game.players[seat]!.character]!}
          {@const open = candidates.has(seat)}
          <div
            class="choice"
            class:closed={!open}
            in:fly={{ y: 40, duration: 420, delay: index * 90 }}
            {@attach feedback("Scar candidate", () => ({
              character: character.name,
              open,
              votes: vote.votes,
            }))}
          >
            <VoteButton
              label={open ? character.name : `${character.name} cannot`}
              tally={`for ${character.name}`}
              voters={tableVoters(world.table, (who) => vote.votes[who] === seat)}
              on={mine === seat}
              disabled={!canVote || !open}
              tone="danger"
              onclick={() => choose(seat)}
              testid={`scar-vote-${seat}`}
            />
            <div class="card">
              <CharacterSheet
                {character}
                tone={mine === seat ? "mine" : "free"}
                color={colorOf(seat)}
                label="Scar candidate card"
                toggle={canVote && open ? () => choose(seat) : undefined}
              />
            </div>
          </div>
        {/each}
      </div>
      <p class="status" role="status">
        {#if split}
          The votes are split: everyone must agree on one character.
        {:else if waiting.length}
          Waiting for {waiting.join(", ")}
        {/if}
      </p>
    </div>
  {/if}
</div>

<style>
  /* The whole table stops for it, as for an exposure: the board falls back under a dark wash. */
  .scar-vote {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: radial-gradient(ellipse at 50% 46%, rgb(18 13 9 / 0.84), rgb(8 6 4 / 0.94));
  }

  /* The note and the ballot cross-fade in one place, so neither pushes the other aside. */
  .scar-vote > * {
    grid-area: 1 / 1;
  }

  .note {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    max-width: 34rem;
    padding: 1.6rem 2.2rem;
    border: 1px solid rgb(168 38 28 / 0.6);
    border-radius: 4px;
    background: rgb(20 12 9 / 0.92);
    box-shadow: 0 1.4rem 3rem rgb(0 0 0 / 0.6);
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
    line-height: 1.4;
  }

  .ballot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    width: 100%;
    height: 100%;
    padding: 1.2rem 1.5rem;
  }

  header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    text-align: center;
  }

  .cards {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 1.4rem;
    width: 100%;
    min-height: 0;
  }

  .choice {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.7rem;
    width: min(30rem, calc((100% - (var(--count) - 1) * 1.4rem) / var(--count)));
    transition: opacity 200ms ease;
  }

  .choice.closed {
    opacity: 0.45;
  }

  .card {
    width: min(100%, 60vh * 1.2);
    aspect-ratio: 1.2;
  }

  .status {
    min-height: 1.4em;
    color: var(--muted);
  }
</style>
