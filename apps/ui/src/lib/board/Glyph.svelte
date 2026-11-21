<script lang="ts">
	import type { Glyph } from './hints';

	// Buildings and the anchor take the ink of whatever they sit on; cubes and Hollow Men keep their piece colours.
	// A card takes the colour it is known by: its city's region, or its kind.
	let { glyph, color }: { glyph: Glyph; color?: string } = $props();
</script>

{#if glyph === 'port'}
	<b class="glyph port" aria-hidden="true">{'⚓︎'}</b>
{:else if glyph === 'epidemic'}
	<b class="glyph epidemic" aria-hidden="true">☣</b>
{:else if glyph === 'event'}
	<b class="glyph event" aria-hidden="true">✦</b>
{:else if glyph === 'objective'}
	<b class="glyph objective" aria-hidden="true">★</b>
{:else if glyph === 'scar'}
	<b class="glyph scar" aria-hidden="true">⚡</b>
{:else if glyph === 'package'}
	<b class="glyph package" aria-hidden="true">▣</b>
{:else if glyph === 'door'}
	<b class="glyph door" aria-hidden="true">▤</b>
{:else if glyph === 'lab'}
	<b class="glyph lab" aria-hidden="true">⬠</b>
{:else if glyph === 'haven'}
	<b class="glyph haven" aria-hidden="true">⬡</b>
{:else}
	<b class="glyph {glyph}" style:--band={color} aria-hidden="true"></b>
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

	.card,
	.infection {
		--band-dark: color-mix(in srgb, var(--band, #8d8476) 55%, #000);
		border: 1px solid var(--band-dark);
		border-radius: 2px;
		box-shadow: inset 0 0 0 1.5px rgb(255 248 228 / 0.18);
	}

	.card {
		width: 0.6rem;
		height: 0.84rem;
		background: linear-gradient(172deg, var(--band, #8d8476), color-mix(in srgb, var(--band, #8d8476) 80%, #140c06));
	}

	/* Infection cards lie on their side, dark backed, with their city's colour as a band. */
	.infection {
		width: 0.84rem;
		height: 0.6rem;
		background: linear-gradient(90deg, var(--band, #8d8476) 0 32%, #2b3a2a 32%);
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

	.epidemic {
		display: inline-grid;
		place-items: center;
		width: 0.85em;
		height: 1.05em;
		border-radius: 2px;
		background: #a8261c;
		color: #f6ead4;
		font-size: 0.82em;
	}

	.event {
		display: inline-grid;
		place-items: center;
		width: 0.85em;
		height: 1.05em;
		border-radius: 2px;
		background: #b08628;
		color: #fff6e0;
		font-size: 0.78em;
	}

	.objective {
		color: #d9a72e;
		font-size: 0.95em;
	}

	.scar {
		color: #c84232;
		font-size: 0.92em;
	}

	.package {
		color: #a97a46;
		font-size: 0.95em;
	}

	.door {
		color: #c89d4c;
		font-size: 0.95em;
	}

	.lab {
		color: #d9a72e;
		font-size: 0.92em;
	}

	.haven {
		color: #3f9169;
		font-size: 0.95em;
	}
</style>
