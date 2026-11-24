<script lang="ts">
	import { pack } from '@repo/game';
	import type { CampaignLocation, CityId } from '@repo/game';
	import { cityColor } from '#lib/board/CityMarker.svelte';
	import { inkOn } from '#lib/color.ts';
	import { cityName } from './labels.svelte.ts';

	type Props = {
		city: CityId;
		location: CampaignLocation | undefined;
		/** One board unit; the marker and the name keep the map's proportions to it. */
		unit: string;
	};

	let { city, location, unit }: Props = $props();

	// Sizes in board units, as `CityMarker` and `print.svelte.ts` draw them.
	const RADIUS = 1.9;
	const def = $derived(pack.cities.find(entry => entry.id === city)!);
	const population = $derived(location?.population ?? def.population);
	const forsaken = $derived(population === 0);
	const color = $derived(forsaken ? '#8d8476' : cityColor(city));
	const hex = (r: number) =>
		Array.from({ length: 6 }, (_, i) => {
			const angle = (Math.PI / 3) * i - Math.PI / 2;
			return `${(r * Math.cos(angle)).toFixed(3)},${(r * Math.sin(angle)).toFixed(3)}`;
		}).join(' ');
	const numeral = $derived(
		location?.infested
			? { fill: '#9ce022', stroke: '#1b2e05' }
			: forsaken
				? { fill: '#ec2a20', stroke: '#3b0806' }
				: { fill: inkOn(color), stroke: 'none' },
	);
</script>

<!-- A place as the board shows it: its marker, and its name lettered on the chart, on a scrap of the chart's paper. -->
<span class="place" style:--u={unit}>
	<svg class="marker" viewBox="-2 -2 4 4" aria-hidden="true">
		{#if def.kind === 'haven'}
			<polygon points={hex(RADIUS)} fill={color} />
			<polygon
				points={hex(RADIUS * 0.84)}
				fill="none"
				stroke={location?.infested ? '#9ce022' : '#efe6d2'}
				stroke-width="0.15"
			/>
		{:else}
			<circle r={RADIUS} fill={color} />
			<circle r={RADIUS * 0.84} fill="none" stroke={location?.infested ? '#9ce022' : '#efe6d2'} stroke-width="0.15" />
		{/if}
		<text
			y="0.11"
			text-anchor="middle"
			dominant-baseline="central"
			fill={numeral.fill}
			stroke={numeral.stroke}
			stroke-width="0.17"
			paint-order="stroke">{population}</text
		>
	</svg>
	<span class="name">
		{#if def.port}
			<svg class="anchor" viewBox="-1 -1.2 2 2.3" aria-hidden="true">
				<circle cx="0" cy="-0.85" r="0.22" />
				<path d="M0 -0.63V0.95M-0.5 -0.3H0.5M-0.85 0.25Q-0.7 0.95 0 0.95Q0.7 0.95 0.85 0.25" />
			</svg>
		{/if}{cityName(city)}
	</span>
</span>

<style>
	.place {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		gap: calc(var(--u) * 0.35);
		padding: calc(var(--u) * 0.7) calc(var(--u) * 0.9) calc(var(--u) * 0.5);
		border-radius: 3px;
		background: radial-gradient(ellipse at 50% 40%, #efe3c4, #dccca4);
		box-shadow: 0 0.35rem 0.9rem rgb(0 0 0 / 0.5);
	}

	.marker {
		width: calc(var(--u) * 4);
		height: calc(var(--u) * 4);
		overflow: visible;
		filter: drop-shadow(0 calc(var(--u) * 0.12) calc(var(--u) * 0.1) rgb(40 26 12 / 0.45));
	}

	.marker text {
		font-family: 'Barlow Semi Condensed', var(--font-ui);
		font-size: 2.3px;
		font-weight: 700;
	}

	/* The chart's lettering: an engraver's italic in ink, a hairline over the fill for the weight the face lacks. */
	.name {
		display: inline-flex;
		align-items: center;
		gap: calc(var(--u) * 0.15);
		color: #2a2017;
		font-family: var(--font-display);
		font-size: calc(var(--u) * 2.7);
		font-style: italic;
		font-weight: 400;
		letter-spacing: 0.02em;
		line-height: 1;
		white-space: nowrap;
		-webkit-text-stroke: 0.035em #2a2017;
	}

	.anchor {
		width: 0.62em;
		height: 0.72em;
		fill: none;
		stroke: currentColor;
		stroke-width: 0.2;
		stroke-linecap: round;
		opacity: 0.8;
	}
</style>
