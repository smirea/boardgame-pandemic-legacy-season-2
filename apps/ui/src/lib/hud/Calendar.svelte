<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack } from '@repo/game';
	import type { Campaign } from '@repo/game';
	import { backOut } from 'svelte/easing';
	import { scale } from 'svelte/transition';
	import { MONTHS } from './labels.svelte.ts';

	type Slot = 'won' | 'lost' | 'now' | 'open';

	let { campaign }: { campaign: Campaign } = $props();

	const ATTEMPTS = ['Early', 'Late'] as const;
	const SAID: Record<Slot, string> = { won: 'won', lost: 'lost', now: 'in play', open: '' };

	const months = $derived(
		MONTHS.slice(1).map((name, index) => {
			const month = index + 1;
			const slots = ([1, 2] as const).map((attempt): Slot => {
				const result = campaign.results.find(entry => entry.month === month && entry.attempt === attempt);
				if (result) return result.won ? 'won' : 'lost';
				return month === campaign.month && attempt === campaign.attempt ? 'now' : 'open';
			});
			const required = pack.numbers.requiredByMonth[month] ?? 0;
			const cubes = pack.numbers.supplyByMonth[month] ?? 0;
			const attempts = slots.flatMap((slot, attempt) =>
				slot === 'open' ? [] : [`${ATTEMPTS[attempt]} attempt ${SAID[slot]}`],
			);
			return { month, name, slots, required, cubes, attempts };
		}),
	);

	/** The month in play, or the Prologue when the campaign has not reached January. */
	const current = $derived(months.find(entry => entry.month === campaign.month) ?? null);
</script>

{#snippet mark(slot: Slot, side: 'early' | 'late')}
	<i class="mark {side} {slot}" data-slot={slot} data-attempt={side}>
		{#if slot === 'won'}
			<svg viewBox="0 0 10 10" in:scale={{ duration: 420, easing: backOut }}><path d="M1.8 5.4 4.1 7.7 8.4 2.4" /></svg>
		{:else if slot === 'lost'}
			<svg viewBox="0 0 10 10" in:scale={{ duration: 420, easing: backOut }}
				><path d="M2.6 2.6 7.4 7.4M7.4 2.6 2.6 7.4" /></svg
			>
		{/if}
	</i>
{/snippet}

{#snippet month(entry: (typeof months)[number])}
	<li
		class="month"
		class:current={entry.month === campaign.month}
		class:past={entry.month < campaign.month}
		data-month={entry.month}
		aria-label={[
			entry.name,
			`${entry.required} objective${entry.required === 1 ? '' : 's'} required`,
			`${entry.cubes} supply cubes`,
			...entry.attempts,
		].join('. ')}
	>
		<span class="line">
			{@render mark(entry.slots[0]!, 'early')}
			<span class="name">{entry.name.slice(0, 3)}</span>
			{@render mark(entry.slots[1]!, 'late')}
		</span>
		<span class="goals" data-required={entry.required}>
			{#each { length: entry.required } as _, index (index)}<i></i>{/each}
		</span>

		<!-- The month's printed numbers: what the board says before any Legacy card adds to them. -->
		<div class="tip" role="tooltip" data-testid="calendar-tip">
			<strong>{entry.name}</strong>
			<p class="needs">
				<span class="goals"
					>{#each { length: entry.required } as _, index (index)}<i></i>{/each}</span
				>
				{entry.required} objective{entry.required === 1 ? '' : 's'} required
			</p>
			<p>
				{entry.cubes ? `${entry.cubes} supply cubes at setup` : 'No supply cubes at setup'}
			</p>
			{#if entry.cubes}
				<span class="cubes" data-cubes={entry.cubes}>
					{#each { length: entry.cubes } as _, index (index)}<i></i>{/each}
				</span>
			{/if}
			{#each entry.attempts as said (said)}<p class="said">{said}</p>{/each}
		</div>
	</li>
{/snippet}

<!-- The bar shows the month in play. The whole year drops down while the pointer or focus rests on it. -->
<div
	class="calendar"
	role="group"
	aria-label="Campaign calendar"
	{@attach feedback('Calendar', () => ({
		month: campaign.month,
		attempt: campaign.attempt,
		results: campaign.results.map(result => `${result.month}.${result.attempt}:${result.won ? 'won' : 'lost'}`),
	}))}
>
	<button
		type="button"
		class="peek"
		aria-label={`${current?.name ?? MONTHS[campaign.month] ?? 'Campaign over'}: show the calendar`}
	>
		{#if current}
			<span class="month current" data-month={current.month}>
				<span class="line">
					{@render mark(current.slots[0]!, 'early')}
					<span class="name">{current.name.slice(0, 3)}</span>
					{@render mark(current.slots[1]!, 'late')}
				</span>
				<span class="goals" data-required={current.required}>
					{#each { length: current.required } as _, index (index)}<i></i>{/each}
				</span>
			</span>
		{:else}
			<span class="month current prologue"><span class="name">{MONTHS[campaign.month] ?? 'Done'}</span></span>
		{/if}
		<span class="more" aria-hidden="true">
			<svg viewBox="0 0 10 10"><path d="M2.5 3.8 5 6.3l2.5-2.5" /></svg>
		</span>
	</button>
	<div class="year">
		<ol data-testid="calendar-year">
			{#each months as entry (entry.month)}
				{@render month(entry)}
			{/each}
		</ol>
	</div>
</div>

<style>
	/* Each month carries its own record: the early attempt's mark on the left of its name, the late one's on the right. */
	.calendar {
		position: relative;
		outline: none;
	}

	ol {
		display: flex;
		gap: 0.05rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.peek {
		display: flex;
		align-items: stretch;
		padding: 0;
		border: 0;
		border-radius: 2px;
		background: none;
		color: inherit;
		font: inherit;
		cursor: default;
		transition: background 200ms ease;
	}

	.calendar:hover .peek,
	.peek:focus-visible {
		background: rgb(231 220 198 / 0.07);
	}

	.peek:focus-visible {
		outline: 1px solid var(--line-strong);
	}

	.more {
		display: grid;
		place-items: center;
		width: 0.9rem;
		color: var(--muted);
	}

	.more svg {
		width: 0.7rem;
		height: 0.7rem;
		stroke: currentColor;
		transition: rotate 200ms ease;
	}

	.calendar:hover .more svg,
	.calendar:focus-within .more svg {
		rotate: 180deg;
	}

	.prologue {
		justify-content: center;
		padding-inline: 0.4rem;
	}

	/* The padding bridges the gap under the bar, so the pointer can travel down into the year without it closing. */
	.year {
		position: absolute;
		top: 100%;
		left: -0.4rem;
		z-index: 6;
		padding-top: 0.35rem;
		opacity: 0;
		visibility: hidden;
		translate: 0 -0.3rem;
		transition:
			opacity 160ms ease,
			translate 160ms ease,
			visibility 0s 160ms;
	}

	.year ol {
		padding: 0.3rem 0.4rem;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--panel);
		backdrop-filter: blur(10px);
		box-shadow: 0 0.6rem 1.6rem rgb(0 0 0 / 0.4);
	}

	.calendar:hover .year,
	.calendar:focus-within .year {
		opacity: 1;
		visibility: visible;
		translate: 0 0;
		transition:
			opacity 160ms ease 80ms,
			translate 160ms ease 80ms,
			visibility 0s 80ms;
	}

	.month {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.18rem;
		padding: 0.2rem 0.1rem 0.22rem;
		border-radius: 2px;
		cursor: default;
		transition: background 300ms ease;
	}

	.month:hover {
		background: rgb(231 220 198 / 0.07);
	}

	.month.current {
		background: rgb(231 220 198 / 0.14);
		box-shadow: inset 0 -2px 0 var(--warn);
	}

	.line {
		display: flex;
		align-items: center;
		gap: 0.08rem;
	}

	.name {
		min-width: 1.55rem;
		color: var(--muted);
		font-size: 0.68rem;
		letter-spacing: 0.04em;
		line-height: 1;
		text-align: center;
		text-transform: uppercase;
	}

	.past .name {
		opacity: 0.75;
	}

	.current .name {
		color: var(--ink);
		font-weight: 700;
	}

	.mark {
		display: grid;
		place-items: center;
		width: 0.62rem;
		height: 0.62rem;
	}

	.mark.now::after {
		content: '';
		width: 0.32rem;
		height: 0.32rem;
		border-radius: 50%;
		background: var(--warn);
		animation: due 1.6s ease-in-out 3;
	}

	@keyframes due {
		50% {
			opacity: 0.25;
			transform: scale(0.7);
		}
	}

	svg {
		width: 100%;
		height: 100%;
		fill: none;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.won svg {
		stroke: var(--good);
	}

	.lost svg {
		stroke: var(--danger);
	}

	.goals {
		display: flex;
		gap: 0.12rem;
	}

	/* An objective is a small ringed target, the same mark in the bar and in the tip. */
	.goals i {
		width: 0.34rem;
		height: 0.34rem;
		border: 1px solid var(--muted);
		border-radius: 50%;
		background: radial-gradient(circle, var(--muted) 0 0.06rem, transparent 0.07rem);
	}

	.current .goals i {
		border-color: var(--ink);
		background: radial-gradient(circle, var(--ink) 0 0.06rem, transparent 0.07rem);
	}

	.tip {
		position: absolute;
		top: calc(100% + 0.35rem);
		left: 0;
		z-index: 5;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		width: max-content;
		max-width: 11.5rem;
		padding: 0.4rem 0.6rem 0.5rem;
		border-radius: 2px;
		background: var(--slip);
		box-shadow: var(--slip-shadow);
		color: var(--slip-ink);
		font-size: 0.76rem;
		line-height: 1.3;
		white-space: normal;
		opacity: 0;
		visibility: hidden;
		translate: 0 -0.25rem;
		pointer-events: none;
		transition:
			opacity 160ms ease,
			translate 160ms ease,
			visibility 0s 160ms;
	}

	.month:hover .tip {
		opacity: 1;
		visibility: visible;
		translate: 0 0;
		transition:
			opacity 160ms ease 120ms,
			translate 160ms ease 120ms,
			visibility 0s 120ms;
	}

	.tip strong {
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 400;
	}

	.tip p {
		margin: 0;
	}

	.tip .needs {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.tip .goals i {
		width: 0.55rem;
		height: 0.55rem;
		border-color: var(--slip-ink);
		background: radial-gradient(circle, var(--slip-ink) 0 0.1rem, transparent 0.11rem);
	}

	.tip .said {
		color: var(--slip-muted);
	}

	/* The setup stockpile as cubes, twelve to a row, drawn like the cubes on the board. */
	.cubes {
		display: grid;
		grid-template-columns: repeat(12, 0.5rem);
		gap: 0.15rem;
		padding: 0.15rem 0 0.1rem;
	}

	.cubes i {
		width: 0.5rem;
		height: 0.5rem;
		border: 1px solid #2a2017;
		background: #efe6d2;
	}
</style>
