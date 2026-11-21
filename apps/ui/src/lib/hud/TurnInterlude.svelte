<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack } from '@repo/game';
	import type { JobId } from '@repo/game';
	import { backOut } from 'svelte/easing';
	import { fade, scale } from 'svelte/transition';
	import { inkOn } from '#lib/color.ts';
	import OccupationIcon from '#lib/occupations/OccupationIcon.svelte';

	type Props = {
		name: string;
		color: string;
		/** The portrait the character wears, or none for a seat without a character. */
		portrait: number | null;
		job: JobId | null;
		/** This browser plays the seat, so the panel speaks to its player. */
		mine: boolean;
		/** Called once the panel has been up for its moment. */
		ondone: () => void;
	};

	let { name, color, portrait, job, mine, ondone }: Props = $props();

	const UP_MS = 2000;
	const occupation = $derived(job ? pack.jobs.find(candidate => candidate.id === job)!.name : null);
	$effect(() => {
		const timer = setTimeout(ondone, UP_MS);
		return () => clearTimeout(timer);
	});
</script>

<!--
	The whole table stops for a moment between turns to say who is up, the way it does for an Epidemic. It takes no
	clicks, so the player it names can start at once.
-->
<div
	class="interlude"
	style:--seat={color}
	style:--on={inkOn(color)}
	role="status"
	data-testid="turn-interlude"
	transition:fade={{ duration: 280 }}
	{@attach feedback('Next turn', () => ({ name, job, mine }))}
>
	<div class="card" in:scale={{ start: 0.7, duration: 460, easing: backOut }}>
		<span class="kicker">{mine ? 'Your turn' : 'Next turn'}</span>
		<div class="who">
			{#if portrait !== null}
				<img src={`/portraits/survivor-${portrait}.webp`} alt="" />
			{/if}
			<div class="words">
				<strong>{name}</strong>
				{#if job && occupation}
					<span class="job"><i><OccupationIcon {job} /></i>{occupation}</span>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.interlude {
		position: absolute;
		inset: 0;
		z-index: 46;
		display: grid;
		place-items: center;
		background: radial-gradient(
			ellipse at 50% 46%,
			color-mix(in srgb, var(--seat) 38%, rgb(12 9 6 / 0.72)),
			rgb(10 8 6 / 0.86)
		);
		pointer-events: none;
	}

	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.7rem;
		padding: 1.3rem 2.6rem 1.5rem;
		border: 3px double color-mix(in srgb, var(--seat) 80%, white);
		border-radius: 6px;
		background: rgb(22 17 12 / 0.92);
		color: var(--paper);
		box-shadow:
			0 1.6rem 4rem rgb(0 0 0 / 0.7),
			0 0 3rem color-mix(in srgb, var(--seat) 45%, transparent);
	}

	.kicker {
		padding: 0.12rem 0.8rem;
		border-radius: 2px;
		background: var(--seat);
		color: var(--on);
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	.who {
		display: flex;
		align-items: center;
		gap: 1.2rem;
	}

	img {
		width: 7.5rem;
		height: 7.5rem;
		border: 3px solid var(--seat);
		border-radius: 6px;
		background: var(--seat);
		object-fit: cover;
		object-position: center 30%;
	}

	.words {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	strong {
		font-family: var(--font-display);
		font-size: 3.4rem;
		font-weight: 400;
		line-height: 1;
	}

	.job {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.25rem;
		color: color-mix(in srgb, var(--seat) 45%, var(--paper));
	}

	.job i {
		display: block;
		width: 1.9rem;
		height: 1.9rem;
	}
</style>
