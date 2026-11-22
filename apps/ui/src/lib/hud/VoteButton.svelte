<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import type { Voter } from './voters.ts';

	type Props = {
		label: string;
		/** What everyone agrees to by pressing it, read in the pips' label: "2 of 3 ready". */
		tally: string;
		voters: Voter[];
		on: boolean;
		onclick: () => void;
		caption?: string;
		disabled?: boolean;
		/** Solid stands on the dark table; outline sits inside a paper panel. */
		surface?: 'solid' | 'outline';
		/** The colour it fills with once pressed: agreeing, or refusing. */
		tone?: 'good' | 'danger';
		testid?: string;
	};

	let {
		label,
		tally,
		voters,
		on,
		onclick,
		caption,
		disabled = false,
		surface = 'solid',
		tone = 'good',
		testid,
	}: Props = $props();

	const agreed = $derived(voters.filter(voter => voter.voted));
	const count = $derived(agreed.length);
	const summary = $derived(
		`${count} of ${voters.length} ${tally}${count ? `: ${agreed.map(voter => voter.name).join(', ')}` : ''}`,
	);
</script>

<!-- One player alone has nobody to wait for, so a solo table shows no pips. -->
<button
	type="button"
	class="vote {surface} {tone}"
	class:on
	aria-pressed={on}
	{disabled}
	{onclick}
	data-testid={testid}
	{@attach feedback('VoteButton', () => ({ label, count, of: voters.length }))}
>
	<span class="label"
		>{label}{#if on}<span class="check" aria-hidden="true">✓</span>{/if}</span
	>
	{#if caption}<span class="caption">{caption}</span>{/if}
	{#if voters.length > 1}
		<span class="pips" role="img" aria-label={summary}>
			{#each voters as voter (voter.player)}
				<!-- An empty socket for each player still to agree, filled with their colour once they do. -->
				<i class:voted={voter.voted} style:--seat={voter.color}></i>
			{/each}
		</span>
	{/if}
</button>

<style>
	.vote {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		min-width: 11rem;
		padding: 0.45rem 1.4rem 0.45rem;
		border-radius: 3px;
		font: inherit;
		cursor: pointer;
		transition:
			background 150ms ease,
			border-color 150ms ease,
			color 150ms ease;
	}

	.vote:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.solid {
		border: 2px solid var(--paper);
		background: var(--paper);
		box-shadow: 0 0.7rem 1.8rem rgb(0 0 0 / 0.5);
		color: var(--paper-ink);
	}

	.solid:hover:not(:disabled) {
		background: #e9dec5;
	}

	.outline {
		flex: 1;
		border: 1.5px solid rgb(42 32 23 / 0.4);
		background: rgb(42 32 23 / 0.03);
		color: var(--slip-ink);
	}

	.outline:hover:not(:disabled) {
		border-color: var(--slip-ink);
		background: rgb(42 32 23 / 0.08);
	}

	.vote.good.on {
		border-color: var(--ink-good);
		background: var(--ink-good);
		color: #f3ecdc;
	}

	.vote.good.on:hover:not(:disabled) {
		background: #335c48;
	}

	.vote.danger.on {
		border-color: #a33126;
		background: #a33126;
		color: #f7efe2;
	}

	.vote.danger.on:hover:not(:disabled) {
		background: #8c281f;
	}

	.label {
		font-family: var(--font-display);
		font-size: 1.35rem;
		line-height: 1.05;
	}

	.check {
		margin-left: 0.35em;
		font-size: 0.8em;
	}

	.caption {
		font-size: 0.78rem;
		opacity: 0.8;
	}

	.pips {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
	}

	.pips i {
		flex: none;
		width: 0.75rem;
		height: 0.75rem;
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
</style>
