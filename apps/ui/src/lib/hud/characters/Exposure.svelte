<script lang="ts" module>
	import type { ExposureBox } from '@repo/game';

	export type ShownBox = ExposureBox | 'sealed';

	/** The track as the table knows it: the boxes scratched so far show what was under them, the rest stay sealed. */
	export const shownTrack = (track: ExposureBox[], exposure: number): ShownBox[] =>
		track.map((box, index) => (index < exposure ? box : 'sealed'));
</script>

<script lang="ts">
	import CardIcon from '#lib/cards/CardIcon.svelte';
	import { SCAR_ICON } from '#lib/cards/icons.ts';

	type Props = {
		boxes: ShownBox[];
		/** The box being scratched open in front of the table, and how far it has got. */
		now?: number;
		stage?: 'covered' | 'scratching' | 'open';
	};
	let { boxes, now, stage }: Props = $props();
	const scratched = $derived(boxes.filter(box => box !== 'sealed').length);
</script>

<span class="track" role="img" aria-label={`Exposure ${scratched} of ${boxes.length}`}>
	{#each boxes as box, index (index)}
		<i
			class={box}
			class:now={index === now}
			class:scratching={index === now && stage === 'scratching'}
			class:opened={index === now && stage === 'open'}
		>
			{#if box === 'scar'}<CardIcon path={SCAR_ICON} size="78%" />{:else if box === 'skull'}☠{/if}
		</i>
	{/each}
</span>

<style>
	.track {
		display: inline-flex;
		flex: none;
		gap: 0.28em;
	}

	i {
		display: grid;
		place-items: center;
		width: 0.95em;
		height: 0.95em;
		border: 1px solid rgb(240 230 206 / 0.55);
		border-radius: 0.15em;
		background: rgb(14 11 9 / 0.55);
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.6);
		color: #fff;
		font-size: inherit;
		font-style: normal;
		line-height: 1;
	}

	.sealed {
		background:
			repeating-linear-gradient(45deg, rgb(240 230 206 / 0.22) 0 1.5px, transparent 1.5px 4px), rgb(14 11 9 / 0.55);
	}

	.empty {
		background: rgb(240 230 206 / 0.75);
	}

	.scar {
		border-color: #d9573f;
		background: #c8432d;
	}

	.skull {
		border-color: #f4ead6;
		background: #0c0a08;
		font-size: 0.7em;
	}

	/* The box the table is watching grows out of the track. */
	.now {
		position: relative;
		z-index: 1;
		overflow: hidden;
		outline: 0.12em solid #ffd166;
		outline-offset: 0.12em;
		scale: 1.5;
		transition: scale 300ms cubic-bezier(0.3, 1.4, 0.5, 1);
	}

	/* A coin worked across the foil: the box shakes and the foil thins from one corner to the other. */
	.scratching {
		animation: shake 950ms linear 1;
	}

	.scratching::after {
		content: '';
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(-45deg, rgb(22 17 12 / 0.9) 0 3px, transparent 3px 7px);
		animation: wipe 950ms ease-in 1 both;
	}

	.opened {
		animation: open 420ms cubic-bezier(0.3, 1.5, 0.5, 1) 1;
	}

	@keyframes shake {
		0%,
		100% {
			translate: 0 0;
			rotate: 0deg;
		}
		12%,
		37%,
		62%,
		87% {
			translate: -2px 1px;
			rotate: -3deg;
		}
		25%,
		50%,
		75% {
			translate: 2px -1px;
			rotate: 3deg;
		}
	}

	@keyframes wipe {
		from {
			clip-path: inset(0 100% 0 0);
		}
	}

	@keyframes open {
		from {
			scale: 2.4;
		}
	}
</style>
