<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import type { JobId } from '@repo/game';
	import { figureKey, figureUrl, headOf } from '#lib/characters/figures.ts';

	let {
		portrait,
		color,
		job = null,
		hooded = false,
		dead = false,
	}: {
		portrait: number;
		color: string;
		job?: JobId | null;
		hooded?: boolean;
		dead?: boolean;
	} = $props();
	const key = $derived(figureKey({ portrait, job, hooded }));
	const head = $derived(headOf(key));
</script>

<!-- A headshot cut from the character's figure, on the colour it plays in. -->
<span
	class="face"
	class:dead
	style:--color={color}
	data-worker={hooded}
	{@attach feedback('Portrait', () => ({ portrait, job, dead }))}
>
	<img
		src={figureUrl(key)}
		alt=""
		style:width={`${100 / head.size}%`}
		style:left={`${(0.5 - head.x / head.size) * 100}%`}
		style:top={`${(0.5 - head.y / (head.size * head.aspect)) * 100}%`}
	/>
</span>

<style>
	.face {
		position: absolute;
		inset: 0;
		display: block;
		overflow: hidden;
		background: radial-gradient(
			circle at 50% 40%,
			color-mix(in srgb, var(--color) 85%, #fff),
			color-mix(in srgb, var(--color) 60%, #000)
		);
	}

	img {
		position: absolute;
		max-width: none;
		height: auto;
	}

	.dead {
		filter: grayscale(1) contrast(0.85);
	}
</style>
