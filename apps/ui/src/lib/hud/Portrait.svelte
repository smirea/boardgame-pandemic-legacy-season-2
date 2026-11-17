<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	let {
		id,
		color,
		hooded = false,
		dead = false,
	}: { id: string; color: string; hooded?: boolean; dead?: boolean } = $props();
	const portrait = $derived.by(() => {
		const number = /^char-(\d+)$/.exec(id)?.[1];
		const index = number ? Number(number) - 1 : [...id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
		return index % 10;
	});
</script>

<img
	src={`/portraits/survivor-${portrait}.webp`}
	alt=""
	class:dead
	style:background={color}
	data-worker={hooded}
	{@attach feedback('Portrait', () => ({ id, portrait, dead }))}
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
