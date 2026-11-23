<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack } from '@repo/game';
	import type { JobId } from '@repo/game';
	import OccupationIcon from '#lib/occupations/OccupationIcon.svelte';
	const SPECIALIST_PORTRAIT: Partial<Record<JobId, string>> = {
		immunologist: '/portraits/immunologist.webp',
		vectorControl: '/portraits/vector-control.webp',
		scientist: '/portraits/scientist.webp',
	};

	let {
		portrait,
		color,
		job = null,
		showBadge = true,
		hooded = false,
		dead = false,
	}: {
		portrait: number;
		color: string;
		job?: JobId | null;
		showBadge?: boolean;
		hooded?: boolean;
		dead?: boolean;
	} = $props();
	const occupation = $derived(job ? pack.jobs.find(candidate => candidate.id === job)!.name : null);
	const src = $derived(
		hooded
			? '/portraits/haven-worker.webp'
			: (job && SPECIALIST_PORTRAIT[job]) || `/portraits/survivor-${portrait % pack.numbers.portraits}.webp`,
	);
</script>

<img
	{src}
	alt=""
	class:dead
	style:background={color}
	data-worker={hooded}
	{@attach feedback('Portrait', () => ({ portrait, job, dead }))}
/>
{#if job && showBadge}
	<span class="job" role="img" aria-label={occupation}><OccupationIcon {job} /></span>
{/if}

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

	/* The occupation, always at the bottom left of the face, sized with the portrait. */
	.job {
		position: absolute;
		bottom: 3px;
		left: 3px;
		width: clamp(16px, 32%, 26px);
		aspect-ratio: 1;
		padding: 2px;
		border-radius: 3px;
		background: rgb(16 12 8 / 0.78);
		color: #efe6d2;
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.5);
	}
</style>
