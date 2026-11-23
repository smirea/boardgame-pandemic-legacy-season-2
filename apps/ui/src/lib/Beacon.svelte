<!--
	The one way the screen points at what the player is to click next: a city to aim at, a pawn, a card in hand, a
	seat, a recon box, the deck to draw from. A gold stroke with two bright heads running round it, between two dark
	hairlines so it reads on the chart's paper and on the dark table alike, and a glow behind.

	It lies over its parent's edge, so the parent must be positioned. `round` is for a circle and turns the stroke
	itself, which the compositor does alone; the others move the gradient round a box of any shape. A beacon that
	shows while nobody is touching the game must stop (`turns`): an animation that never ends keeps the page drawing.
-->
<script lang="ts">
	type Props = {
		round?: boolean;
		/** How many times the heads run round before the stroke rests, lit. Endless when left out. */
		turns?: number;
		/** How far outside the parent's edge the stroke lies. */
		gap?: string;
		width?: string;
		glow?: string;
	};

	let { round = false, turns, gap = '0.2rem', width = '0.17rem', glow = '0.8rem' }: Props = $props();
</script>

<span
	class="beacon"
	class:round
	style:--gap={gap}
	style:--width={width}
	style:--glow={glow}
	style:--turns={turns ?? 'infinite'}
	style:--breaths={turns === undefined ? 'infinite' : turns * 2}
	aria-hidden="true"
	data-beacon
>
	<span class="sweep"></span>
</span>

<style>
	.beacon {
		--gold: #ffc93a;
		--hot: #fffbe6;
		--edge: rgb(28 16 4 / 0.62);
		position: absolute;
		inset: calc(-1 * var(--gap));
		z-index: 3;
		border-radius: inherit;
		pointer-events: none;
		box-shadow:
			0 0 0 1px var(--edge),
			inset 0 0 0 calc(var(--width) + 1px) var(--edge),
			0 0 var(--glow) calc(var(--glow) * 0.2) rgb(255 186 48 / 0.55);
		animation: breathe 0.9s ease-in-out var(--breaths) alternate;
	}

	.round {
		border-radius: 50%;
	}

	.sweep {
		position: absolute;
		inset: 0;
		padding: var(--width);
		border-radius: inherit;
		background:
			conic-gradient(
				from var(--beacon-angle),
				transparent 0 0.28turn,
				var(--gold) 0.44turn,
				var(--hot) 0.5turn,
				transparent 0.5turn 0.78turn,
				var(--gold) 0.94turn,
				var(--hot) 1turn
			),
			linear-gradient(rgb(255 201 58 / 0.62), rgb(255 201 58 / 0.62));
		mask:
			linear-gradient(#000 0 0) content-box,
			linear-gradient(#000 0 0);
		mask-composite: exclude;
		animation: sweep 1.8s linear var(--turns);
	}

	.round .sweep {
		animation-name: turn;
	}

	@keyframes sweep {
		to {
			--beacon-angle: 1turn;
		}
	}

	@keyframes turn {
		to {
			transform: rotate(1turn);
		}
	}

	@keyframes breathe {
		to {
			box-shadow:
				0 0 0 1px var(--edge),
				inset 0 0 0 calc(var(--width) + 1px) var(--edge),
				0 0 calc(var(--glow) * 1.6) calc(var(--glow) * 0.35) rgb(255 186 48 / 0.8);
		}
	}
</style>
