<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack, tablePlayers } from '@repo/game';
	import type { Action, Command, Play, PlayerId, TableUndoVote, UndoSubject, UndoVoteChoice, World } from '@repo/game';
	import { ACTION_NAMES, seatName } from './labels.svelte.ts';
	import VoteButton from './VoteButton.svelte';
	import { tableVoters, waitingOn as stillWaiting } from './voters.ts';

	type Props = {
		world: World;
		vote: TableUndoVote;
		player: PlayerId;
		send: (command: Command) => void;
	};

	let { world, vote, player, send }: Props = $props();

	const ACTION_SHAME_TEXT: Partial<Record<Action['a'], string>> = {
		monitor:
			'They already peeked at the frequency and saw the cards. Pretending it never happened requires unanimous absolution.',
		search:
			'They already scratched the search box and saw what was inside. Rewriting history requires unanimous absolution.',
		recon: 'They already cracked open the unknown. Un-discovering the world requires unanimous absolution.',
		selfInject: 'They already poked the sample and saw how it went. Un-poking it requires unanimous absolution.',
	};

	const PLAY_SHAME_TEXT: Partial<Record<Play['e'], string>> = {
		forecast:
			'They already peeked at the top of the Infection deck. Un-seeing the future requires unanimous absolution.',
		scavenge:
			'They already drew 4 cards off the Player deck and saw what came up. Putting them back requires unanimous absolution.',
		encore:
			'They already replayed a card that leaked secret information. Rewinding the encore requires unanimous absolution.',
	};

	function subjectLabel(subject: UndoSubject): string {
		switch (subject.kind) {
			case 'action':
				return ACTION_NAMES[subject.action];
			case 'play':
				return (
					pack.events.find(entry => entry.id === subject.play)?.name ??
					pack.companions.find(entry => entry.id === subject.play)?.name ??
					subject.play
				);
			case 'lockdown':
				return 'Lockdown';
			case 'waive':
				return 'waiving an objective';
		}
	}

	function subjectShame(subject: UndoSubject): string {
		if (subject.kind === 'action' && ACTION_SHAME_TEXT[subject.action]) return ACTION_SHAME_TEXT[subject.action]!;
		if (subject.kind === 'play' && PLAY_SHAME_TEXT[subject.play]) return PLAY_SHAME_TEXT[subject.play]!;
		return 'That move already leaked secret information. Pretending it never happened requires unanimous absolution.';
	}

	const table = $derived(world.table);
	const players = $derived(tablePlayers(table));
	const seated = $derived(table.seats.some(entry => entry.player === player));
	const myVote = $derived(vote.votes[player] ?? null);
	const culprit = $derived(
		(vote.by ? table.seats.find(entry => entry.player === vote.by)?.name : null) ?? seatName(world, vote.seat),
	);
	const actionLabel = $derived(subjectLabel(vote.subject));
	const subtext = $derived(subjectShame(vote.subject));
	const waitingOn = $derived(
		stillWaiting(
			tableVoters(table, who => vote.votes[who] !== undefined),
			player,
		),
	);
	const hasNo = $derived(players.some(who => vote.votes[who] === 'no'));
	const canWithdraw = $derived(!vote.by || vote.by === player);

	function cast(choice: UndoVoteChoice) {
		send({ type: 'UNDO_VOTE', player, vote: myVote === choice ? null : choice });
	}
</script>

<section
	class="tribunal"
	data-testid="undo-vote"
	{@attach feedback('UndoVote', () => ({ subject: vote.subject, votes: vote.votes }))}
>
	<span class="stamp">Shameful undo request</span>
	<h1>{culprit} is shamefully trying to undo {actionLabel}</h1>
	<p class="subtext">{subtext}</p>

	<div class="choices">
		<VoteButton
			label="Yes"
			caption="Allow this shameless act"
			tally="voted yes"
			voters={tableVoters(table, who => vote.votes[who] === 'yes')}
			on={myVote === 'yes'}
			surface="outline"
			disabled={!seated}
			onclick={() => cast('yes')}
			testid="undo-vote-yes"
		/>
		<VoteButton
			label="No"
			caption="No cheating — it stands"
			tally="voted no"
			voters={tableVoters(table, who => vote.votes[who] === 'no')}
			on={myVote === 'no'}
			surface="outline"
			tone="danger"
			disabled={!seated}
			onclick={() => cast('no')}
			testid="undo-vote-no"
		/>
	</div>

	<p class="status" aria-live="polite">
		{#if hasNo && waitingOn.length}
			Someone already said no — waiting on {waitingOn.join(', ')} to make it official.
		{:else if waitingOn.length}
			Full consensus required. Waiting on {waitingOn.join(', ')}.
		{:else}
			Counting votes…
		{/if}
	</p>

	{#if canWithdraw}
		<button
			type="button"
			class="withdraw"
			onclick={() => send({ type: 'CANCEL_UNDO_VOTE', player })}
			data-testid="cancel-undo-vote"
		>
			Never mind, I’ll live with my choices
		</button>
	{/if}
</section>

<style>
	.tribunal {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.15rem;
		width: min(36rem, 92vw);
		padding: 2rem 2.2rem 1.7rem;
		border: 2px solid rgb(163 49 38 / 0.45);
		border-radius: 3px;
		background: var(--document);
		color: var(--slip-ink);
		box-shadow: var(--document-shadow);
		text-align: center;
		animation: slam 340ms cubic-bezier(0.2, 0.9, 0.3, 1.12) both;
	}

	@keyframes slam {
		from {
			opacity: 0;
			scale: 0.94;
			translate: 0 1.2rem;
		}
	}

	.stamp {
		padding: 0.2rem 0.65rem;
		border: 2px solid var(--danger, #a33126);
		border-radius: 2px;
		color: var(--danger, #a33126);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		rotate: -1.5deg;
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.7rem, 4.2vw, 2.35rem);
		font-weight: 400;
		line-height: 1.08;
	}

	.subtext {
		max-width: 28rem;
		margin: -0.25rem 0 0;
		color: var(--slip-muted);
		font-size: 0.94rem;
		line-height: 1.4;
	}

	.choices {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.85rem;
		width: 100%;
		margin-top: 0.25rem;
	}

	@media (max-width: 480px) {
		.tribunal {
			padding: 1.4rem 1.2rem 1.2rem;
		}

		.choices {
			grid-template-columns: 1fr;
		}
	}

	.status {
		margin: 0;
		color: var(--slip-muted);
		font-size: 0.86rem;
	}

	.withdraw {
		padding: 0.25rem 0.5rem;
		border: 0;
		background: none;
		color: var(--slip-muted);
		font: inherit;
		font-size: 0.82rem;
		text-decoration: underline;
		text-underline-offset: 0.2em;
		cursor: pointer;
	}

	.withdraw:hover {
		color: var(--slip-ink);
	}
</style>
