<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack } from '@repo/game';
	import type { CityId, World } from '@repo/game';
	import { fade, fly } from 'svelte/transition';
	import type { CitySpot } from '#lib/board/types.ts';
	import { cityName } from './labels.svelte.ts';
	import { HOLLOW_COLOR } from './rich.ts';
	import type { Rich } from './rich.ts';
	import RichText from './RichText.svelte';

	type Props = {
		world: World;
		/** The cities to point at on the board while the tip is open, or null once it closes. */
		onspot?: (spots: ReadonlyMap<CityId, CitySpot> | null) => void;
	};

	let { world, onspot }: Props = $props();

	let open = $state(false);

	const game = $derived(world.game);
	const campaign = $derived(world.campaign);
	const total = pack.numbers.pieces.hollow;
	const left = $derived(game ? game.pieces.hollow : total);
	const lethal = $derived(campaign.rules.includes('hollowSetup'));
	const low = $derived(left <= 6);
	const danger = $derived(left <= 3);

	const holding = $derived(
		game
			? (Object.entries(game.locations) as unknown as [CityId, { hollow: number }][])
					.filter(([, loc]) => loc.hollow > 0)
					.toSorted((a, b) => b[1].hollow - a[1].hollow || cityName(a[0]).localeCompare(cityName(b[0])))
			: [],
	);
	const onBoard = $derived.by((): Rich => {
		const parts: Rich = [];
		holding.forEach(([city, loc], index) => {
			if (index) parts.push(', ');
			parts.push({
				glyph: 'hollow',
				color: HOLLOW_COLOR,
				text: `${cityName(city)}${loc.hollow > 1 ? ` ×${loc.hollow}` : ''}`,
			});
		});
		return parts;
	});
	const placed = $derived(total - left);

	$effect(() => {
		const point = onspot;
		if (!open || !point) return;
		point(new Map(holding.map(([city]) => [city, { tone: 'hollow', label: null }])));
		return () => point(null);
	});
</script>

<div class="hollow-wrap" {@attach feedback('Hollow Men supply', () => ({ left, placed, lethal }))}>
	<div
		class="hollow"
		class:low
		class:danger
		role="button"
		tabindex="0"
		data-testid="hollow-supply"
		data-dest="hollow"
		aria-label={`Hollow Men supply: ${left} of ${total} figures left`}
		aria-expanded={open}
		onpointerenter={() => (open = true)}
		onpointerleave={() => (open = false)}
		onfocus={() => (open = true)}
		onblur={() => (open = false)}
	>
		<span class="figure-icon" aria-hidden="true">
			<svg viewBox="0 0 16 18">
				<circle cx="8" cy="4.2" r="2.7" />
				<path d="M2.6 16.5 5.4 8.2h5.2l2.8 8.3Z" />
			</svg>
		</span>
		{#key left}<strong data-testid="hollow-supply-count" in:fly={{ y: -8, duration: 260 }}>{left}</strong>{/key}
	</div>

	{#if open}
		<div class="tip" role="tooltip" data-testid="hollow-supply-tip" transition:fade={{ duration: 140 }}>
			<strong>Hollow Men, {left} of {total} left</strong>
			{#if lethal}
				<p class="warn">Running out of Hollow Men figures loses the game.</p>
			{/if}
			<section>
				<h4>On the board <b>{placed}</b></h4>
				<p>
					{#if onBoard.length}<RichText text={onBoard} />{:else}none{/if}
				</p>
			</section>
			<p class="note">Leaving a location holding Hollow Men exposes your character.</p>
		</div>
	{/if}
</div>

<style>
	.hollow-wrap {
		position: relative;
		display: inline-flex;
		align-items: center;
		flex: none;
	}

	.hollow {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.15rem 0.3rem;
		border-radius: 4px;
		color: var(--ink);
		cursor: default;
		outline: none;
	}

	.hollow:focus-visible {
		outline: 1px solid var(--line-strong);
		outline-offset: 2px;
	}

	.hollow strong {
		font-size: 1.02rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.hollow.low strong {
		color: var(--warn);
	}

	.hollow.danger strong {
		color: var(--danger);
	}

	.figure-icon {
		display: inline-grid;
		place-items: center;
		width: 1.25rem;
		height: 1.25rem;
		border: 1px solid color-mix(in srgb, var(--hollow) 55%, #000);
		border-radius: 2px;
		background: linear-gradient(170deg, #4b3963, #2b203a);
		color: #d8c6ed;
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.45);
	}

	.hollow.danger .figure-icon {
		border-color: var(--danger);
		box-shadow: 0 0 0.45rem rgb(207 91 62 / 0.5);
	}

	.figure-icon svg {
		width: 0.85rem;
		height: 0.95rem;
		fill: currentColor;
	}

	.tip {
		position: absolute;
		top: calc(100% + 0.55rem);
		right: 0;
		z-index: 65;
		display: flex;
		flex-direction: column;
		gap: 0.38rem;
		width: 19.5rem;
		padding: 0.5rem 0.72rem 0.6rem;
		border-radius: 2px;
		background: var(--slip);
		box-shadow: var(--slip-shadow);
		color: var(--slip-ink);
		font-size: 0.78rem;
		line-height: 1.32;
		white-space: normal;
		pointer-events: none;
	}

	.tip > strong {
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 400;
	}

	.warn {
		margin: 0;
		color: var(--ink-danger);
		font-weight: 600;
	}

	section {
		padding-top: 0.35rem;
		border-top: 1px solid var(--slip-line);
	}

	h4 {
		display: flex;
		justify-content: space-between;
		margin: 0 0 0.12rem;
		font-size: 0.73rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	p {
		margin: 0;
	}

	.note {
		padding-top: 0.3rem;
		border-top: 1px solid var(--slip-line);
		color: var(--slip-muted);
		font-style: italic;
	}
</style>
