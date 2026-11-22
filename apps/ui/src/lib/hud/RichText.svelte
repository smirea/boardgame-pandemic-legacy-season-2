<script lang="ts">
	import Glyph from '#lib/board/Glyph.svelte';
	import { withGlyphs } from './rich.ts';
	import type { Rich } from './rich.ts';

	/** Plain text is read for the game objects it names; a `Rich` line already says where its glyphs go. */
	let { text }: { text: Rich | string } = $props();

	const parts = $derived(typeof text === 'string' ? withGlyphs(text) : text);

	function splitFirstWord(value: string): [string, string] {
		const space = value.indexOf(' ');
		return space === -1 ? [value, ''] : [value.slice(0, space), value.slice(space)];
	}
</script>

{#each parts as part, index (index)}
	{#if typeof part === 'string'}{part}{:else if part.text}{@const [first, rest] = splitFirstWord(part.text)}<span
			class="glyphed"
			><span class="glyph-glue"><Glyph glyph={part.glyph} color={part.color} />&#8239;{first}</span>{rest}</span
		>{:else}<span class="glyphed"
			><Glyph glyph={part.glyph} color={part.color} />{#if part.alt}<span class="alt">{part.alt}</span>{/if}</span
		>{/if}
{/each}

<style>
	.glyphed {
		white-space: nowrap;
	}

	.glyph-glue {
		white-space: nowrap;
	}

	/* Read aloud and copied, never seen: the glyph already shows it. */
	.alt {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.glyphed :global(.glyph) {
		vertical-align: -0.08em;
	}

	.glyphed :global(.glyph.haven),
	.glyphed :global(.glyph.lab),
	.glyphed :global(.glyph.package) {
		vertical-align: -0.1em;
	}
</style>
