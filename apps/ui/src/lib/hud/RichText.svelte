<script lang="ts">
	import Glyph from '#lib/board/Glyph.svelte';
	import { withGlyphs } from './rich.ts';
	import type { Rich } from './rich.ts';

	/** Plain text is read for the game objects it names; a `Rich` line already says where its glyphs go. */
	let { text }: { text: Rich | string } = $props();

	const parts = $derived(typeof text === 'string' ? withGlyphs(text) : text);
</script>

{#each parts as part, index (index)}
	{#if typeof part === 'string'}{part}{:else}<span class="glyphed"
			><Glyph glyph={part.glyph} color={part.color} />{#if part.text}&#8239;{part.text}{/if}</span
		>{/if}
{/each}

<style>
	.glyphed {
		white-space: nowrap;
	}

	.glyphed :global(.glyph) {
		vertical-align: -0.08em;
	}
</style>
