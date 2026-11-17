<script lang="ts">
	import type { Glyph } from './hints';

	// Buildings and the anchor take the ink of whatever they sit on; cubes and Hollow Men keep their piece colours.
	let { glyph }: { glyph: Glyph } = $props();
</script>

{#if glyph === 'port'}
	<b class="glyph port" aria-hidden="true">{'⚓\uFE0E'}</b>
{:else}
	<b class="glyph {glyph}" aria-hidden="true"></b>
{/if}

<style>
	.glyph {
		display: inline-block;
		flex: none;
		font-weight: 400;
		line-height: 1;
	}

	.port {
		font-size: 1.05rem;
	}

	.supplies,
	.plague {
		width: 0.62rem;
		height: 0.62rem;
		border: 1px solid #2a2017;
		background: #efe6d2;
	}

	.plague {
		border-color: #3b5210;
		background: #93b236;
	}

	.hollow {
		width: 0.62rem;
		height: 0.8rem;
		background: #4e3b63;
		clip-path: polygon(50% 0, 100% 100%, 0 100%);
	}

	.center {
		width: 0.85rem;
		height: 0.85rem;
		background: currentColor;
		clip-path: polygon(50% 0, 100% 45%, 85% 45%, 85% 100%, 15% 100%, 15% 45%, 0 45%);
	}

	.tower {
		width: 0.7rem;
		height: 0.95rem;
		background:
			radial-gradient(circle at 50% 18%, currentColor 0 0.16rem, transparent 0.17rem),
			linear-gradient(currentColor, currentColor) center 0.2rem / 2px 100% no-repeat;
	}

	.shelter {
		width: 0.9rem;
		height: 0.48rem;
		border-radius: 0.48rem 0.48rem 0 0;
		background: currentColor;
	}
</style>
