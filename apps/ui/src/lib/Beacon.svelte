<!--
	The one way the screen points at what the player is to click next: a city to aim at, a pawn, a card in hand, a
	seat, a recon box, the deck to draw from. A gold stroke with two bright heads running round it, between two dark
	hairlines so it reads on the chart's paper and on the dark table alike, and a glow behind.

	It lies over its parent's edge, so the parent must be positioned. Nothing in it is painted again while it runs:
	the heads are a gradient turned behind the stroke's mask and the glow only changes its opacity, both of which the
	compositor does alone. A table with thirty cities lit would otherwise repaint thirty shadows every frame. A beacon
	that shows while nobody is touching the game must stop (`turns`): an animation that never ends keeps the page
	drawing.
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
		/** Gold calls for a click. The others only point: red, yellow and grey by how much is at stake, violet at the Hollow Men. */
		tone?: 'gold' | 'danger' | 'warn' | 'muted' | 'hollow';
	};

	let { round = false, turns, gap = '0.2rem', width = '0.17rem', glow = '0.8rem', tone = 'gold' }: Props = $props();
</script>

<span
	class="beacon"
	class:round
	class:danger={tone === 'danger'}
	class:warn={tone === 'warn'}
	class:muted={tone === 'muted'}
	class:hollow={tone === 'hollow'}
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
		--fill: rgb(255 201 58 / 0.62);
		--halo: 255 186 48;
		position: absolute;
		inset: calc(-1 * var(--gap));
		z-index: 3;
		border-radius: inherit;
		pointer-events: none;
		box-shadow:
			0 0 0 1px var(--edge),
			inset 0 0 0 calc(var(--width) + 1px) var(--edge);
	}

	.beacon::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		box-shadow: 0 0 calc(var(--glow) * 1.4) calc(var(--glow) * 0.3) rgb(var(--halo) / 0.8);
		opacity: 0.55;
		animation: breathe 0.9s ease-in-out var(--breaths) alternate;
	}

	.round {
		border-radius: 50%;
	}

	.danger {
		--gold: #e8402a;
		--hot: #ffd9cf;
		--fill: rgb(214 52 32 / 0.62);
		--halo: 230 60 36;
	}

	.warn {
		--gold: #f2c230;
		--hot: #fff6d6;
		--fill: rgb(226 178 40 / 0.62);
		--halo: 236 186 40;
	}

	.muted {
		--gold: #a8a296;
		--hot: #f1eee8;
		--fill: rgb(150 144 134 / 0.55);
		--halo: 150 144 134;
	}

	.hollow {
		--gold: #a97ee0;
		--hot: #f1e6ff;
		--fill: rgb(150 108 205 / 0.62);
		--halo: 150 100 220;
	}

	.sweep {
		position: absolute;
		inset: 0;
		padding: var(--width);
		overflow: hidden;
		border-radius: inherit;
		background: linear-gradient(var(--fill), var(--fill));
		mask:
			linear-gradient(#000 0 0) content-box,
			linear-gradient(#000 0 0);
		mask-composite: exclude;
		container-type: size;
	}

	/* A square wide enough to cover the box at any angle, so turning it carries the heads round a box of any shape. */
	.sweep::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: calc(hypot(100cqw, 100cqh) + 4 * var(--width));
		aspect-ratio: 1;
		translate: -50% -50%;
		background: conic-gradient(
			transparent 0 0.28turn,
			var(--gold) 0.44turn,
			var(--hot) 0.5turn,
			transparent 0.5turn 0.78turn,
			var(--gold) 0.94turn,
			var(--hot) 1turn
		);
		animation: turn 1.8s linear var(--turns);
	}

	@keyframes turn {
		to {
			rotate: 1turn;
		}
	}

	@keyframes breathe {
		to {
			opacity: 1;
		}
	}
</style>
