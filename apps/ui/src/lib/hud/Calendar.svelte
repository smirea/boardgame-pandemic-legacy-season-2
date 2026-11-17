<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import type { Campaign } from '@repo/game';
	import { backOut } from 'svelte/easing';
	import { scale } from 'svelte/transition';
	import { MONTHS } from './labels.svelte.ts';

	type Slot = 'won' | 'lost' | 'now' | 'open' | 'skipped';

	let { campaign }: { campaign: Campaign } = $props();

	const ATTEMPTS = ['early', 'late'] as const;

	const months = $derived(
		MONTHS.slice(1).map((name, index) => {
			const month = index + 1;
			const slots = ([1, 2] as const).map((attempt): Slot => {
				const result = campaign.results.find(entry => entry.month === month && entry.attempt === attempt);
				if (result) return result.won ? 'won' : 'lost';
				if (month === campaign.month && attempt === campaign.attempt) return 'now';
				const wonEarly = campaign.results.some(entry => entry.month === month && entry.attempt === 1 && entry.won);
				return attempt === 2 && wonEarly ? 'skipped' : 'open';
			});
			const said = slots
				.map((slot, attempt) =>
					slot === 'won' || slot === 'lost'
						? `${ATTEMPTS[attempt]} attempt ${slot}`
						: slot === 'now'
							? `${ATTEMPTS[attempt]} attempt in play`
							: '',
				)
				.filter(Boolean);
			return { month, name, slots, title: said.length ? `${name}: ${said.join(', ')}` : name };
		}),
	);
</script>

<ol
	class="calendar"
	aria-label="Campaign calendar"
	{@attach feedback('Calendar', () => ({
		month: campaign.month,
		attempt: campaign.attempt,
		results: campaign.results.map(result => `${result.month}.${result.attempt}:${result.won ? 'won' : 'lost'}`),
	}))}
>
	{#each months as entry (entry.month)}
		<li
			class="month"
			class:current={entry.month === campaign.month}
			class:past={entry.month < campaign.month}
			title={entry.title}
			data-month={entry.month}
		>
			<span class="initial">{entry.name.slice(0, 3)}</span>
			<span class="slots">
				{#each entry.slots as slot, attempt (attempt)}
					<i class={slot} data-slot={slot}>
						{#if slot === 'won'}
							<svg viewBox="0 0 10 10" in:scale={{ duration: 420, easing: backOut }}
								><path d="M2 5.3 4.2 7.5 8 2.8" /></svg
							>
						{:else if slot === 'lost'}
							<svg viewBox="0 0 10 10" in:scale={{ duration: 420, easing: backOut }}
								><path d="M2.8 2.8 7.2 7.2M7.2 2.8 2.8 7.2" /></svg
							>
						{/if}
					</i>
				{/each}
			</span>
		</li>
	{/each}
</ol>

<style>
	/* Like the box's calendar track: every month has an early and a late box, marked as each game ends. */
	.calendar {
		display: flex;
		gap: 0.1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.month {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.12rem;
		padding: 0.12rem 0.18rem;
		border-radius: 2px;
		transition: background 300ms ease;
	}

	.month.current {
		background: rgb(231 220 198 / 0.12);
	}

	.initial {
		color: var(--muted);
		font-size: 0.62rem;
		letter-spacing: 0.04em;
		line-height: 1;
		text-transform: uppercase;
	}

	.current .initial {
		color: var(--ink);
		font-weight: 700;
	}

	.slots {
		display: flex;
		gap: 0.1rem;
	}

	.slots i {
		display: grid;
		place-items: center;
		width: 0.7rem;
		height: 0.7rem;
		border: 1px solid var(--line-strong);
		border-radius: 1px;
		transition:
			background 300ms ease,
			border-color 300ms ease;
	}

	.slots i.skipped {
		border-style: dashed;
		opacity: 0.3;
	}

	.slots i.won {
		border-color: var(--good);
		background: var(--good);
	}

	.slots i.lost {
		border-color: var(--danger);
		background: var(--danger);
	}

	.slots i.now {
		border-color: var(--warn);
		animation: due 1.6s ease-in-out infinite;
	}

	@keyframes due {
		50% {
			background: rgb(227 178 60 / 0.45);
		}
	}

	svg {
		width: 100%;
		height: 100%;
		fill: none;
		stroke: var(--paper-ink);
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
