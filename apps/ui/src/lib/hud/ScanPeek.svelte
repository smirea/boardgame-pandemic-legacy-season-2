<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { peek, scanUrl } from '#lib/scans.svelte.ts';

	const GAP = 14;
	let width = $state(0);
	let height = $state(0);
	let ownWidth = $state(0);
	let ownHeight = $state(0);

	const current = $derived(peek.current);
	/** Beside the element, on the side with more room, never off the screen. */
	const place = $derived.by(() => {
		if (!current || !ownWidth) return null;
		const { anchor } = current;
		const own = { width: ownWidth, height: ownHeight };
		const right = anchor.left + anchor.width / 2 < width / 2;
		const left = right
			? Math.min(anchor.right + GAP, width - own.width - 8)
			: Math.max(8, anchor.left - GAP - own.width);
		const top = Math.max(8, Math.min(anchor.top + anchor.height / 2 - own.height / 2, height - own.height - 8));
		return { left, top };
	});
	const many = $derived((current?.scans.length ?? 0) > 2);
</script>

<svelte:window bind:innerWidth={width} bind:innerHeight={height} />

{#if current}
	<figure
		class="peek"
		class:many
		bind:offsetWidth={ownWidth}
		bind:offsetHeight={ownHeight}
		style:left={`${place?.left ?? -9999}px`}
		style:top={`${place?.top ?? 0}px`}
		aria-label="The printed original"
		{@attach feedback('Printed original', () => current.scans.map(scan => scan.src))}
	>
		<div class="row">
			{#each current.scans as scan (scan.src)}
				<img src={scanUrl(scan.src)} alt={scan.title} title={scan.title} />
			{/each}
		</div>
		<figcaption>The printed original</figcaption>
	</figure>
{/if}

<style>
	.peek {
		position: fixed;
		z-index: 1000;
		margin: 0;
		padding: 0.5rem 0.5rem 0.3rem;
		border-radius: 6px;
		background: rgb(20 18 14 / 0.94);
		box-shadow: 0 1.2rem 3rem rgb(0 0 0 / 0.6);
		pointer-events: none;
		max-width: min(46rem, 48vw);
		max-height: calc(100vh - 1rem);
	}

	.row {
		display: flex;
		flex-wrap: nowrap;
		gap: 0.4rem;
		justify-content: center;
	}

	.many .row {
		flex-wrap: wrap;
	}

	img {
		display: block;
		min-width: 0;
		max-width: 100%;
		max-height: min(26rem, 62vh);
		width: auto;
		height: auto;
		object-fit: contain;
		border-radius: 4px;
		background: var(--chrome);
	}

	.many img {
		max-height: min(13rem, 30vh);
	}

	figcaption {
		margin-top: 0.25rem;
		font-size: 0.7rem;
		color: var(--muted);
		text-align: center;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
</style>
