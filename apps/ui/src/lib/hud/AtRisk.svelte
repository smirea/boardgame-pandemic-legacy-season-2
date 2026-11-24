<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import type { CityId, Insights } from '@repo/game';
	import type { CitySpot, SpotTone } from '#lib/board/types.ts';
	import { fly } from 'svelte/transition';
	import { cityColor } from '#lib/board/CityMarker.svelte';
	import Glyph from '#lib/board/Glyph.svelte';
	import { cityName } from './labels.svelte.ts';
	import TopTip from './TopTip.svelte';

	type Props = {
		infection: Insights['infection'];
		/** The cities to point at on the board while the list is open, or null once it closes. */
		onspot?: (spots: ReadonlyMap<CityId, CitySpot> | null) => void;
	};

	let { infection, onspot }: Props = $props();

	let open = $state(false);

	type Group = { label: string; tone: SpotTone; cities: CityId[] };

	const cities = $derived(infection.atRisk);
	/** More cities than this widen the slip, so a late game's whole list still fits the screen: it cannot be scrolled. */
	const LONG = 10;
	const incidents = $derived(cities.filter(entry => entry.outbreak).length);
	const outbreaks = $derived(new Set(cities.flatMap(entry => (entry.outbreak ? [entry.city] : []))));
	const percent = (value: number) => (value < 0.01 ? '<1%' : `${Math.round(value * 100)}%`);

	/** Cities with the same printed chance together, the likeliest first, each group in name order. */
	function grouped(entries: [CityId, number][]) {
		const groups = new Map<string, { label: string; odds: number; cities: CityId[] }>();
		for (const [city, chance] of entries) {
			const label = percent(chance);
			const group = groups.get(label) ?? { label, odds: chance, cities: [] };
			group.odds = Math.max(group.odds, chance);
			group.cities.push(city);
			groups.set(label, group);
		}
		return [...groups.values()]
			.toSorted((a, b) => b.odds - a.odds)
			.map(group => ({
				label: group.label,
				odds: group.odds,
				cities: group.cities.toSorted((a, b) => cityName(a).localeCompare(cityName(b))),
			}));
	}

	// Every problematic city is red on the board, so every group of them is red here too.
	const problems = $derived<Group[]>(
		grouped(cities.map(entry => [entry.city, entry.odds])).map(group => ({
			label: group.label,
			tone: 'danger',
			cities: group.cities,
		})),
	);

	// While the next Infect step could turn over cards nobody can name yet, every city it might hit is listed by its
	// chance, cities with the same printed chance together: the top chance red, the next yellow, the rest grey. When
	// every city is as likely as the next, none stands out, so all of them are grey.
	const chances = $derived.by<Group[]>(() => {
		const entries = (Object.entries(infection.odds) as [CityId, number][]).filter(([, chance]) => chance > 0);
		if (!entries.some(([, chance]) => chance < 1)) return [];
		const sorted = grouped(entries);
		return sorted.map((group, index) => ({
			label: group.label,
			tone: sorted.length === 1 ? 'muted' : index === 0 ? 'danger' : index === 1 ? 'warn' : 'muted',
			cities: group.cities,
		}));
	});
	const wide = $derived(cities.length > LONG || chances.reduce((sum, group) => sum + group.cities.length, 0) > LONG);

	$effect(() => {
		const point = onspot;
		if (!open || !point) return;
		const spots = new Map<CityId, CitySpot>();
		for (const group of chances)
			for (const city of group.cities) spots.set(city, { tone: group.tone, label: group.label });
		for (const entry of cities) spots.set(entry.city, { tone: 'danger', label: percent(entry.odds) });
		point(spots);
		return () => point(null);
	});
</script>

<TopTip
	name="at-risk"
	testid="at-risk"
	label={`${cities.length} problematic cities: no supply cubes and a chance to be infected`}
	width={wide ? '31rem' : '20rem'}
	bind:open
	{@attach feedback('Problematic cities', () => ({ cities, chances }))}
>
	{#snippet counter()}
		<span class="risk" class:none={!cities.length} class:danger={incidents > 0}>
			<svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
				<path d="M8 1.6 15 14H1Z" />
				<path class="mark" d="M8 6v3.6M8 11.4v.4" />
			</svg>
			{#key cities.length}<strong data-testid="at-risk-count" in:fly={{ y: -8, duration: 260 }}>{cities.length}</strong
				>{/key}
		</span>
	{/snippet}
	<div class="parts">
		<section>
			<header>
				<strong>Problematic cities</strong>
				<p class="note">No supply cubes, and a chance to be infected in the next Infect step.</p>
			</header>
			{#if problems.length}
				{@render list(problems)}
			{:else}
				<p>None: every city that could be hit holds a supply cube.</p>
			{/if}
		</section>
		{#if chances.length}
			<section class="chances" data-testid="at-risk-chances">
				<header>
					<strong>Could come up</strong>
					<p class="note">Cards nobody can name yet: each city's chance to be infected in the next Infect step.</p>
				</header>
				{@render list(chances)}
			</section>
		{/if}
	</div>
</TopTip>

{#snippet list(groups: Group[])}
	<ul>
		{#each groups as group (group.label)}
			<li>
				<b class={group.tone}>{group.label}</b>
				<span class="names">
					{#each group.cities as city, index (city)}
						<span class="name" data-city={city}
							><Glyph glyph="infection" color={cityColor(city)} /><span
								>{cityName(city)}{#if outbreaks.has(city)}<em>incident</em>{/if}{index < group.cities.length - 1
									? ','
									: ''}</span
							></span
						>
					{/each}
				</span>
			</li>
		{/each}
	</ul>
{/snippet}

<style>
	/* The counter's own parts lie straight in it; the class carries how much is at stake. */
	.risk {
		display: contents;
	}

	.parts {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.risk.none .icon {
		color: var(--muted);
	}

	.risk.danger .icon {
		color: var(--danger);
	}

	.risk.danger strong {
		color: var(--danger);
	}

	.icon {
		width: 1.15rem;
		height: 1.15rem;
		color: var(--warn);
		fill: currentColor;
	}

	.icon .mark {
		fill: none;
		stroke: #1c140a;
		stroke-width: 1.7;
		stroke-linecap: round;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	header strong {
		display: block;
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 400;
		line-height: 1.1;
	}

	.note {
		color: var(--slip-muted);
		font-style: italic;
	}

	/* The one rule on the slip parts what nobody can name yet from what the table can. */
	.chances {
		padding-top: 0.6rem;
		border-top: 1px solid var(--slip-line);
	}

	ul {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem 0.55rem;
		align-items: start;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		grid-column: 1 / -1;
		grid-template-columns: subgrid;
	}

	b {
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	b.danger {
		color: var(--ink-danger);
	}

	b.warn {
		color: #a87708;
	}

	b.muted {
		color: var(--slip-muted);
	}

	.names {
		display: flex;
		flex-wrap: wrap;
		gap: 0.1rem 0.35rem;
	}

	.name {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	em {
		margin-left: 0.3rem;
		color: var(--ink-danger);
		font-size: 0.62rem;
		font-style: normal;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
</style>
