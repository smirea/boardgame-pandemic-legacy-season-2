<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack, SEAT_IDS, tablePlayers } from '@repo/game';
	import type { Action, Command, Play, PlayerId, TableUndoVote, UndoSubject, UndoVoteChoice, World } from '@repo/game';
	import { ACTION_NAMES, SEAT_COLORS, seatName } from './labels.svelte.ts';

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
	const firstSeat = (who: PlayerId) => table.seats.find(entry => entry.player === who)!;
	const seated = $derived(table.seats.some(entry => entry.player === player));
	const myVote = $derived(vote.votes[player] ?? null);
	const culprit = $derived(
		(vote.by ? table.seats.find(entry => entry.player === vote.by)?.name : null) ?? seatName(world, vote.seat),
	);
	const actionLabel = $derived(subjectLabel(vote.subject));
	const subtext = $derived(subjectShame(vote.subject));
	const waitingOn = $derived(
		players.filter(who => vote.votes[who] === undefined).map(who => (who === player ? 'you' : firstSeat(who).name)),
	);
	const hasNo = $derived(players.some(who => vote.votes[who] === 'no'));
	const canWithdraw = $derived(!vote.by || vote.by === player);

	function cast(choice: UndoVoteChoice) {
		send({ type: 'UNDO_VOTE', player, vote: myVote === choice ? null : choice });
	}

	const countFor = (choice: UndoVoteChoice) => players.filter(who => vote.votes[who] === choice).length;
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
		<button
			type="button"
			class="vote yes"
			class:on={myVote === 'yes'}
			aria-pressed={myVote === 'yes'}
			disabled={!seated}
			onclick={() => cast('yes')}
			data-testid="undo-vote-yes"
		>
			<span class="label">Yes</span>
			<span class="caption">Allow this shameless act</span>
			<span class="pips" role="img" aria-label={`${countFor('yes')} of ${players.length} voted yes`}>
				{#each players as who (who)}
					{@const voted = vote.votes[who] === 'yes'}
					<i class:voted style:--seat={SEAT_COLORS[SEAT_IDS.indexOf(firstSeat(who).seat)]}></i>
				{/each}
			</span>
		</button>

		<button
			type="button"
			class="vote no"
			class:on={myVote === 'no'}
			aria-pressed={myVote === 'no'}
			disabled={!seated}
			onclick={() => cast('no')}
			data-testid="undo-vote-no"
		>
			<span class="label">No</span>
			<span class="caption">No cheating — it stands</span>
			<span class="pips" role="img" aria-label={`${countFor('no')} of ${players.length} voted no`}>
				{#each players as who (who)}
					{@const voted = vote.votes[who] === 'no'}
					<i class:voted style:--seat={SEAT_COLORS[SEAT_IDS.indexOf(firstSeat(who).seat)]}></i>
				{/each}
			</span>
		</button>
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

	.vote {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.45rem;
		padding: 1rem 0.9rem 0.9rem;
		border: 1.5px solid rgb(42 32 23 / 0.4);
		border-radius: 3px;
		background: rgb(42 32 23 / 0.03);
		color: var(--slip-ink);
		font: inherit;
		cursor: pointer;
		transition:
			background 150ms ease,
			border-color 150ms ease,
			color 150ms ease;
	}

	.vote:hover:not(:disabled) {
		border-color: var(--slip-ink);
		background: rgb(42 32 23 / 0.08);
	}

	.vote:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.vote.yes.on {
		border-color: var(--ink-good, #3d6b55);
		background: var(--ink-good, #3d6b55);
		color: #f3ecdc;
	}

	.vote.yes.on:hover:not(:disabled) {
		background: #335c48;
	}

	.vote.no.on {
		border-color: var(--danger, #a33126);
		background: var(--danger, #a33126);
		color: #f7efe2;
	}

	.vote.no.on:hover:not(:disabled) {
		background: #8c281f;
	}

	.label {
		font-family: var(--font-display);
		font-size: 1.85rem;
		line-height: 1;
	}

	.caption {
		font-size: 0.78rem;
		opacity: 0.8;
	}

	.pips {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		margin-top: 0.2rem;
	}

	.pips i {
		flex: none;
		width: 0.85rem;
		height: 0.85rem;
		border-radius: 50%;
		box-shadow: inset 0 0 0 1.5px currentColor;
		opacity: 0.45;
		transition:
			background 220ms ease,
			box-shadow 220ms ease,
			opacity 220ms ease;
	}

	.pips i.voted {
		background: var(--seat);
		box-shadow:
			inset 0 0 0 1.5px rgb(255 252 242 / 0.75),
			0 0 0.45rem var(--seat);
		opacity: 1;
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
