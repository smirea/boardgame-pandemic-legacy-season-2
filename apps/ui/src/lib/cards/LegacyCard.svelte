<script lang="ts">
	import type { Campaign, LegacyCardDef } from '@repo/game';
	import Back from '#lib/cards/legacy/Back.svelte';
	import DocFace from '#lib/cards/legacy/DocFace.svelte';
	import SpecialFace from '#lib/cards/legacy/SpecialFace.svelte';
	import { legacyPrint } from '#lib/cards/print.generated.ts';
	import { legacyScans } from '#lib/scans.generated.ts';
	import { originals, scanUrl } from '#lib/scans.svelte.ts';
	import { MONTHS } from '#lib/hud/labels.svelte.ts';

	type Props = {
		card: LegacyCardDef;
		side: 'a' | 'b';
		campaign?: Campaign;
		/** Visual scale preset: `mini` (TopBar), `thumb` (scattered wing / deck list), `deck` (tabletop pile), `full` (spotlight). */
		size?: 'mini' | 'thumb' | 'deck' | 'full';
	};

	let { card, side, campaign, size = 'full' }: Props = $props();

	const LANDSCAPE_KINDS = new Set<LegacyCardDef['kind']>(['objective', 'scanner', 'plan', 'reckoning']);
	const SPECIAL = new Set<LegacyCardDef['kind']>(['objective', 'scanner', 'plan', 'reckoning', 'epidemic', 'event']);
	const landscape = $derived(side === 'b' && LANDSCAPE_KINDS.has(card.kind));
	const code = $derived(`${card.id}${side}`);
	const monthLabel = $derived(card.month === 0 ? 'Prologue' : (MONTHS[card.month] ?? 'Campaign'));
	const print = $derived.by(() => {
		const entry = legacyPrint[card.id];
		if (!entry) throw new Error(`No printed text for Legacy card ${card.id}`);
		return entry;
	});

	const originalSrc = $derived.by(() => {
		const entry = legacyScans[card.id];
		if (!entry) return null;
		const rel = side === 'a' ? entry.back : entry.src;
		return rel ? scanUrl(rel) : null;
	});
</script>

<div
	class="legacy-card {card.kind} side-{side} size-{size}"
	class:landscape
	data-legacy-card={card.id}
	data-legacy-side={side}
	data-original-active={originals.held}
>
	{#if originals.held && originalSrc}
		<img class="original-img" src={originalSrc} alt={`${card.title} (original ${code})`} />
	{:else if side === 'a'}
		<Back {card} {print} {code} {monthLabel} {campaign} />
	{:else if SPECIAL.has(card.kind)}
		<SpecialFace {card} {print} {code} {monthLabel} {campaign} />
	{:else}
		<DocFace {card} {print} {code} {monthLabel} {campaign} />
	{/if}
</div>

<style>
	.legacy-card {
		--w: 14.8rem;
		--h: 20.4rem;
		--fs: 1.02rem;
		position: relative;
		width: var(--w);
		height: var(--h);
		border-radius: 7px;
		overflow: hidden;
		font-size: var(--fs);
		font-family: var(--font-ui);
		box-shadow: 0 1rem 2.4rem rgb(0 0 0 / 0.58);
		user-select: none;
		flex: none;
	}

	.legacy-card.landscape {
		--w: 23.5rem;
		--h: 16.5rem;
	}

	.legacy-card.size-deck {
		--w: 7.6rem;
		--h: 10.5rem;
		--fs: 0.54rem;
		border-radius: 5px;
	}

	.legacy-card.size-deck.landscape {
		--w: 12.4rem;
		--h: 8.7rem;
	}

	.legacy-card.size-thumb {
		--w: 6.8rem;
		--h: 9.4rem;
		--fs: 0.48rem;
		border-radius: 4px;
	}

	.legacy-card.size-thumb.landscape {
		--w: 10rem;
		--h: 7rem;
	}

	.legacy-card.size-mini {
		--w: 1.45rem;
		--h: 2rem;
		--fs: 0.16rem;
		border-radius: 2px;
		box-shadow:
			1px 1px 0 rgb(0 0 0 / 0.5),
			2px 2px 0 rgb(231 220 198 / 0.25);
	}

	.legacy-card.size-mini :global(.code) {
		display: none;
	}

	.original-img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.legacy-card :global(.inner) {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		padding: 1.1em 1em 1.4em;
		box-sizing: border-box;
	}

	.legacy-card :global(.code) {
		position: absolute;
		right: 0.65em;
		bottom: 0.45em;
		padding: 0.08em 0.45em;
		border-radius: 999px;
		background: rgb(255 252 245 / 0.9);
		color: #1c1712;
		font-size: 0.68em;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.02em;
	}
</style>
