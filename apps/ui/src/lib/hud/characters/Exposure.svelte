<script lang="ts">
	import type { ExposureBox } from '@repo/game';

	type Props = { track: ExposureBox[]; exposure: number };
	let { track, exposure }: Props = $props();
</script>

<!-- The boxes scratched so far show what was under them; the rest stay sealed. -->
<span class="track" role="img" aria-label={`Exposure ${exposure} of ${track.length}`}>
	{#each track as box, index (index)}
		<i class={index < exposure ? box : 'sealed'}></i>
	{/each}
</span>

<style>
	.track {
		display: inline-flex;
		flex: none;
		gap: 0.28em;
	}

	i {
		display: block;
		width: 0.95em;
		height: 0.95em;
		border: 1px solid rgb(240 230 206 / 0.55);
		border-radius: 0.15em;
		background: rgb(14 11 9 / 0.55);
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.6);
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
		background: #d9573f;
	}

	.skull {
		border-color: #f4ead6;
		background: #0c0a08;
	}
</style>
