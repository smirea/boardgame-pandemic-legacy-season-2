<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	let {
		portrait,
		color,
		hooded = false,
		dead = false,
	}: { portrait: number; color: string; hooded?: boolean; dead?: boolean } = $props();
</script>

<img
	src={`/portraits/survivor-${portrait}.webp`}
	alt=""
	class:dead
	style:background={color}
	data-worker={hooded}
	{@attach feedback('Portrait', () => ({ portrait, dead }))}
/>

<style>
	img {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center 30%;
	}
	img.dead {
		filter: grayscale(1) contrast(0.85);
	}
</style>
