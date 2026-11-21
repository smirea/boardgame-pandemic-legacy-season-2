<script lang="ts">
	import { doorScans } from '#lib/scans.generated.ts';
	import { originals, scanUrl } from '#lib/scans.svelte.ts';

	/**
	 * A tear-off dossier door: perforated with its number while sealed, a hole once open. `tearing` plays the door
	 * coming off, which leaves the hole behind it.
	 */
	type Props = { id: string; open: boolean; tearing?: boolean };

	let { id, open, tearing = false }: Props = $props();

	const originalSrc = $derived(doorScans[id]?.[0]?.src ? scanUrl(doorScans[id]![0]!.src) : null);
</script>

<span class="door" class:open data-original-active={originals.held && Boolean(originalSrc)} aria-hidden="true">
	{#if originals.held && originalSrc}
		<img class="original-seal" src={originalSrc} alt="" />
	{:else}
		<span class="hole">{open ? id : ''}</span>
		{#if !open || tearing}<span class="flap" class:tearing>{id}</span>{/if}
	{/if}
</span>

<style>
	.door {
		position: relative;
		display: grid;
		aspect-ratio: 1;
		font-weight: 700;
	}

	.hole,
	.flap {
		grid-area: 1 / 1;
		display: grid;
		place-items: center;
		border-radius: 2px;
	}

	.hole {
		border: 1px solid rgb(40 24 8 / 0.5);
		background: radial-gradient(ellipse at 50% 30%, #4a3a26, #2b2014);
		box-shadow: inset 0 0.2rem 0.4rem rgb(0 0 0 / 0.55);
		color: rgb(236 222 190 / 0.75);
		font-weight: 500;
	}

	.flap {
		border: 1.5px dashed rgb(90 60 20 / 0.5);
		background: #ecd9a8;
		color: rgb(60 40 10 / 0.85);
		transform-origin: 0 0;
	}

	/* Torn from its top corner: it swings down and falls away. */
	.flap.tearing {
		animation: tear 900ms cubic-bezier(0.5, 0, 0.7, 0.4) forwards;
	}

	@keyframes tear {
		0% {
			transform: none;
		}
		35% {
			transform: rotate(18deg);
		}
		100% {
			transform: translate(20%, 160%) rotate(65deg);
			opacity: 0;
		}
	}
	.original-seal {
		grid-area: 1 / 1;
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 2px;
	}
</style>
