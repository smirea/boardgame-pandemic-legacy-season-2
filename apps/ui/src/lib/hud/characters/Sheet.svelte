<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fitGroup, fitText } from '#lib/cards/fit.ts';

	type Props = {
		figure: string;
		/** Nobody yet: the figure is drawn as a shadow. */
		unknown?: boolean;
		/** How the character stands at the table: yours, someone else's, free to take, or being made. */
		tone: 'mine' | 'taken' | 'free' | 'new';
		/** The colour of the seat it plays in, once someone has it. */
		color: string | null;
		/** The name, as text or as the field that names a new character. */
		name: Snippet;
		/** The line under the name: the exposure track and the home haven. */
		meta: Snippet;
		/** The occupation, abilities and scars, one panel each down the arch. */
		arch: Snippet;
		/** What stands on the cut under the figure: who has the character, or the button that makes it. */
		base: Snippet;
		/** What lies over the figure's foot, such as the faces a new character may wear. */
		over?: Snippet;
		/** The whole card as one button, laid under everything that takes clicks of its own. */
		hit?: Snippet;
		/** The text the name is fitted to. */
		fitted: string;
	};

	let { figure, unknown = false, tone, color, name, meta, arch, base, over, hit, fitted }: Props = $props();
</script>

<!-- The card has no face of its own: the figure, the cut under it and the arch of panels stand on the table. -->
<div class="sheet {tone}" style:--seat={color ?? '#e7dcc6'}>
	{@render hit?.()}
	<div class="figure">
		{#key figure}
			<img class:unknown src={figure} alt="" />
		{/key}
	</div>
	<svg class="cut" viewBox="0 0 120 100" aria-hidden="true">
		<path class="stroke" d="M-2 92.6 L62 85.6" />
		<path class="rule" d="M-2 95.4 L44 90.4" />
		<path class="notch" d="M62 85.6 l2.4 -2.4 l2.4 2.4 l-2.4 2.4z" />
	</svg>
	{#if over}<div class="over">{@render over()}</div>{/if}
	<div class="base">{@render base()}</div>
	<div class="info">
		<div class="name" {@attach fitText(fitted, { across: true, min: 0.45 })}>{@render name()}</div>
		<div class="meta">{@render meta()}</div>
		<div class="arch" {@attach fitGroup({ max: 0.56, min: 0.26 })}>{@render arch()}</div>
	</div>
</div>

<style>
	/* Everything is sized by the card's height, so a card reads the same at any size. */
	.sheet {
		position: relative;
		width: 100%;
		height: 100%;
		container-type: size;
		color: #f4ead6;
		text-shadow:
			0 0 0.5rem rgb(0 0 0 / 0.9),
			0 1px 2px rgb(0 0 0 / 0.9);
	}

	.figure {
		position: absolute;
		top: 1cqh;
		left: 0;
		width: 47cqw;
		height: 92cqh;
		/* The figure ends on the cut, which falls from right to left. */
		clip-path: polygon(-10% -10%, 110% -10%, 110% 89.5%, 0% 100%);
		pointer-events: none;
	}

	img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: bottom center;
		filter: drop-shadow(0 1.2cqh 2.4cqh rgb(0 0 0 / 0.72));
		transform-origin: bottom center;
		transition:
			transform 380ms cubic-bezier(0.2, 0.9, 0.3, 1.05),
			filter 380ms ease;
		animation: arrive 520ms cubic-bezier(0.2, 0.9, 0.3, 1.05) both;
	}

	@keyframes arrive {
		from {
			opacity: 0;
			transform: translateX(-6cqw);
		}
	}

	.mine img {
		filter: drop-shadow(0 1.2cqh 2.4cqh rgb(0 0 0 / 0.75))
			drop-shadow(0 0 2.2cqh color-mix(in srgb, var(--seat) 55%, transparent));
	}

	.taken img {
		filter: brightness(0.5) saturate(0.55) drop-shadow(0 1.2cqh 2.4cqh rgb(0 0 0 / 0.72));
	}

	img.unknown {
		filter: drop-shadow(0 0 1.6cqh rgb(226 195 106 / 0.28)) drop-shadow(0 1.2cqh 2.4cqh rgb(0 0 0 / 0.6));
		opacity: 0.9;
	}

	.sheet:has(:global(.hit:hover:not(:disabled))) img,
	.sheet:has(:global(.hit:focus-visible)) img {
		transform: translateY(-0.8cqh) scale(1.015);
	}

	.cut {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}

	.cut path {
		fill: none;
		stroke: var(--seat);
		stroke-linecap: round;
	}

	.stroke {
		stroke-width: 0.9;
	}

	.rule {
		stroke-width: 0.3;
		opacity: 0.6;
	}

	.notch {
		fill: var(--seat) !important;
		stroke: none !important;
	}

	.free .cut,
	.new .cut {
		opacity: 0.55;
	}

	.taken .cut {
		opacity: 0.7;
	}

	.over {
		position: absolute;
		left: 0;
		bottom: 13cqh;
		width: 46cqw;
		z-index: 2;
		display: flex;
		justify-content: center;
	}

	.base {
		position: absolute;
		left: 2.5cqw;
		bottom: 0;
		z-index: 3;
		display: flex;
		align-items: flex-end;
		gap: 1.2cqh;
		max-width: 44cqw;
		height: 7.4cqh;
		font-size: 4.2cqh;
	}

	.info {
		position: absolute;
		top: 1cqh;
		right: 0;
		bottom: 1cqh;
		left: 39cqw;
		z-index: 2;
		display: flex;
		flex-direction: column;
		/* The name's largest size; it is fitted down from here to its width. */
		font-size: 8.8cqh;
		pointer-events: none;
	}

	.info :global(button),
	.info :global(input),
	.info :global([role='listbox']) {
		pointer-events: auto;
	}

	.name {
		flex: none;
		height: 9.5cqh;
		font-family: var(--font-display);
		line-height: 1.05;
		white-space: nowrap;
	}

	.meta {
		position: relative;
		z-index: 3;
		display: flex;
		flex: none;
		align-items: center;
		gap: 2.2cqw;
		margin-top: 0.6cqh;
		font-size: 3.9cqh;
	}

	.arch {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 1.3cqh;
		min-height: 0;
		margin-top: 2.4cqh;
	}

	.taken .arch {
		opacity: 0.78;
	}
</style>
