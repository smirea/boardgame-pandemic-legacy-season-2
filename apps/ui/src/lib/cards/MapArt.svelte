<script lang="ts">
	import type { CityId } from '@repo/game';
	import { CITY_COLOR } from '#lib/board/CityMarker.svelte';
	import { ART_HEIGHT, ART_WIDTH, mapArt } from './mapArt.ts';

	type Props = { city: CityId; accent: string; tone?: 'day' | 'night' };

	let { city, accent, tone = 'day' }: Props = $props();

	const art = $derived(mapArt(city));
</script>

<svg
	class={tone}
	viewBox={`0 0 ${ART_WIDTH} ${ART_HEIGHT}`}
	preserveAspectRatio="xMidYMid slice"
	style:--accent={accent}
	aria-hidden="true"
>
	<rect class="sea" width={ART_WIDTH} height={ART_HEIGHT} />
	<path class="graticule" d={art.graticule} />
	<path class="land" d={art.land} />
	{#each art.neighbours as point, index (index)}
		<circle class="neighbour" cx={point.x} cy={point.y} r="1.5" fill={CITY_COLOR[point.color ?? 'haven']} />
	{/each}
	<circle class="halo" cx={art.pin.x} cy={art.pin.y} r="9" />
	<circle class="halo inner" cx={art.pin.x} cy={art.pin.y} r="4.5" />
	<path
		class="pin"
		transform={`translate(${art.pin.x} ${art.pin.y})`}
		d="M0 0 C-1.2 -4.2 -5.2 -6 -5.2 -10.2 A5.2 5.2 0 1 1 5.2 -10.2 C5.2 -6 1.2 -4.2 0 0 Z"
	/>
	<circle class="eye" cx={art.pin.x} cy={art.pin.y - 10.2} r="1.9" />
</svg>

<style>
	svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	.sea {
		fill: #173a52;
	}

	.land {
		fill: #c5bd9f;
		stroke: #8f8970;
		stroke-width: 0.35;
	}

	.graticule {
		fill: none;
		stroke: rgb(255 255 255 / 0.1);
		stroke-width: 0.3;
	}

	.night .sea {
		fill: #0b1512;
	}

	.night .land {
		fill: color-mix(in srgb, var(--accent) 22%, #25302b);
		stroke: color-mix(in srgb, var(--accent) 45%, #25302b);
	}

	.neighbour {
		opacity: 0.75;
		stroke: rgb(0 0 0 / 0.45);
		stroke-width: 0.4;
	}

	.halo {
		fill: none;
		stroke: var(--accent);
		stroke-width: 0.7;
		opacity: 0.55;
	}

	.halo.inner {
		opacity: 0.9;
	}

	.pin {
		fill: var(--accent);
		stroke: rgb(0 0 0 / 0.55);
		stroke-width: 0.6;
		filter: drop-shadow(0 1px 1px rgb(0 0 0 / 0.5));
	}

	.eye {
		fill: #f4f1e8;
	}
</style>
