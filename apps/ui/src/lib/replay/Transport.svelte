<script lang="ts" module>
	export const SPEEDS = [0.5, 1, 2, 4, 8];

	export const KEYS: [string, string][] = [
		['Space', 'Play or pause'],
		['← →', 'Step back or forward'],
		['↑ ↓', 'Previous or next turn'],
		['[ ]', 'Previous or next event'],
		['S', 'Change speed'],
		['1 to 4', 'Follow a player, again to stop'],
		['B', 'Show or hide bubbles'],
		['T', 'Show or hide the side panel'],
		['Home End', 'Start or end'],
		['?', 'Show these keys'],
	];
</script>

<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { Marker } from './replay.svelte.ts';

	type Props = {
		frame: number;
		total: number;
		turn: number;
		clock: string;
		markers: Marker[];
		playing: boolean;
		speed: number;
		bubbles: boolean;
		panel: boolean;
		follow: string | null;
		keys: boolean;
		go: (frame: number) => void;
		onplay: () => void;
		onspeed: () => void;
		onturn: (direction: -1 | 1) => void;
		onbubbles: () => void;
		onpanel: () => void;
		onkeys: () => void;
		onunfollow: () => void;
	};

	let {
		frame,
		total,
		turn,
		clock,
		markers,
		playing,
		speed,
		bubbles,
		panel,
		follow,
		keys,
		go,
		onplay,
		onspeed,
		onturn,
		onbubbles,
		onpanel,
		onkeys,
		onunfollow,
	}: Props = $props();

	const at = (value: number) => `${(value / Math.max(1, total)) * 100}%`;
	const turns = $derived(markers.filter(marker => marker.kind === 'turn'));
	const events = $derived(markers.filter(marker => marker.kind !== 'turn'));
</script>

<footer class="transport" data-testid="transport">
	<div class="buttons">
		<button onclick={() => go(0)} title="Start (Home)" aria-label="Start"><i class="icon first"></i></button>
		<button onclick={() => onturn(-1)} title="Previous turn (↑)" aria-label="Previous turn"
			><i class="icon back2"></i></button
		>
		<button onclick={() => go(frame - 1)} title="Step back (←)" aria-label="Step back" data-testid="step-back"
			><i class="icon back"></i></button
		>
		<button
			class="play"
			onclick={onplay}
			title="Play or pause (space)"
			aria-label={playing ? 'Pause' : 'Play'}
			data-testid="play"><i class="icon" class:pause={playing} class:forward={!playing}></i></button
		>
		<button onclick={() => go(frame + 1)} title="Step forward (→)" aria-label="Step forward" data-testid="step-forward"
			><i class="icon forward"></i></button
		>
		<button onclick={() => onturn(1)} title="Next turn (↓)" aria-label="Next turn" data-testid="next-turn"
			><i class="icon fwd2"></i></button
		>
		<button onclick={() => go(total)} title="End (End)" aria-label="End"><i class="icon last"></i></button>
		<button class="speed" onclick={onspeed} title="Change speed (S)" data-testid="speed">{speed}×</button>
	</div>

	<div class="scrubber">
		<div class="pins">
			{#each events as marker (`${marker.frame}:${marker.kind}`)}
				<button
					class="pin {marker.kind}"
					class:passed={marker.frame <= frame}
					style:left={at(marker.frame)}
					title={marker.label}
					aria-label={marker.label}
					onclick={() => go(marker.frame)}
					data-testid="marker-{marker.kind}"
				></button>
			{/each}
		</div>
		<div class="rail">
			<div class="filled" style:width={at(frame)}></div>
			{#each turns as marker (marker.frame)}
				<button
					class="tick"
					style:left={at(marker.frame)}
					title={marker.label}
					aria-label={marker.label}
					onclick={() => go(marker.frame)}
					data-testid="marker-turn"
				></button>
			{/each}
			<input
				type="range"
				min="0"
				max={total}
				value={frame}
				oninput={event => go(Number(event.currentTarget.value))}
				aria-label="Position in the game"
				data-testid="scrub"
			/>
		</div>
	</div>

	<div class="where" data-testid="where">
		<strong>{frame} / {total}</strong>
		<span>{turn ? `Turn ${turn}` : 'Setup'}{clock ? `, ${clock}` : ''}</span>
	</div>

	<div class="toggles">
		{#if follow}
			<button class="chip on" onclick={onunfollow} title="Stop following (press the player's number again)"
				>Following {follow}</button
			>
		{/if}
		<button
			class="chip"
			class:on={bubbles}
			onclick={onbubbles}
			title="Show or hide what players say (B)"
			data-testid="toggle-bubbles">Bubbles</button
		>
		<button
			class="chip"
			class:on={panel}
			onclick={onpanel}
			title="Show or hide the side panel (T)"
			data-testid="toggle-panel">Panel</button
		>
		<button
			class="chip key"
			class:on={keys}
			onclick={onkeys}
			title="Keyboard shortcuts (?)"
			aria-label="Keyboard shortcuts">?</button
		>
	</div>

	{#if keys}
		<dl class="keys" transition:fade={{ duration: 120 }} data-testid="keys">
			{#each KEYS as [key, what] (key)}<dt>{key}</dt>
				<dd>{what}</dd>{/each}
		</dl>
	{/if}
</footer>

<style>
	.transport {
		position: absolute;
		inset: auto 0 0 0;
		height: var(--bar);
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0 0.9rem;
		border-top: 1px solid var(--line);
		background: var(--chrome);
		z-index: 90;
	}

	.buttons,
	.toggles {
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}

	button {
		border: 1px solid var(--line);
		border-radius: 2px;
		background: none;
		color: var(--ink);
		font: inherit;
		cursor: pointer;
	}

	.buttons button {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
	}

	button:hover {
		border-color: var(--line-strong);
		background: var(--wash);
	}

	.buttons .play {
		width: 2.6rem;
		height: 2.3rem;
		margin: 0 0.15rem;
		border-color: var(--paper);
		background: var(--paper);
		color: var(--paper-ink);
	}

	.buttons .speed {
		width: 2.9rem;
		margin-left: 0.4rem;
		font-size: 0.85rem;
		font-weight: 600;
	}

	/* Transport glyphs drawn in CSS, so they match the chrome's weight instead of whatever font holds the emoji. */
	.icon {
		position: relative;
		display: block;
		width: 0.7rem;
		height: 0.7rem;
		background: currentColor;
	}

	.icon.forward {
		clip-path: polygon(0 0, 100% 50%, 0 100%);
	}

	.icon.back {
		clip-path: polygon(100% 0, 0 50%, 100% 100%);
	}

	.icon.pause {
		border-inline: 0.24rem solid currentColor;
		background: none;
	}

	.icon.fwd2 {
		width: 0.9rem;
		clip-path: polygon(0 0, 50% 50%, 50% 0, 100% 50%, 50% 100%, 50% 50%, 0 100%);
	}

	.icon.back2 {
		width: 0.9rem;
		clip-path: polygon(100% 0, 50% 50%, 50% 0, 0 50%, 50% 100%, 50% 50%, 100% 100%);
	}

	.icon.last {
		clip-path: polygon(0 0, 75% 50%, 75% 0, 100% 0, 100% 100%, 75% 100%, 75% 50%, 0 100%);
	}

	.icon.first {
		clip-path: polygon(100% 0, 25% 50%, 25% 0, 0 0, 0 100%, 25% 100%, 25% 50%, 100% 100%);
	}

	.scrubber {
		position: relative;
		flex: 1;
		min-width: 8rem;
		height: 100%;
	}

	.pins {
		position: absolute;
		inset: 0.35rem 0 auto;
		height: 0.9rem;
	}

	.pin {
		position: absolute;
		top: 0;
		width: 0.7rem;
		height: 0.7rem;
		padding: 0;
		border: 0;
		background: var(--muted);
		translate: -50% 0;
		clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
		opacity: 0.55;
		transition:
			opacity 150ms ease,
			scale 150ms ease;
	}

	.pin.passed,
	.pin:hover {
		opacity: 1;
	}

	.pin:hover {
		scale: 1.4;
	}

	.pin.epidemic {
		background: var(--danger);
	}

	.pin.incident {
		background: #93b236;
	}

	.pin.objective {
		background: var(--good);
		clip-path: polygon(50% 0, 62% 35%, 100% 38%, 70% 60%, 80% 100%, 50% 78%, 20% 100%, 30% 60%, 0 38%, 38% 35%);
		width: 0.85rem;
		height: 0.85rem;
	}

	.pin.reveal {
		background: var(--paper);
		clip-path: circle(45%);
	}

	.pin.death {
		background: var(--hollow);
	}

	.pin.end {
		background: var(--ink);
		width: 0.8rem;
		height: 0.9rem;
		clip-path: polygon(0 0, 100% 25%, 18% 50%, 18% 100%, 0 100%);
	}

	.rail {
		position: absolute;
		inset: auto 0 0.9rem;
		height: 0.8rem;
	}

	.rail::before,
	.filled {
		content: '';
		position: absolute;
		left: 0;
		top: 50%;
		height: 3px;
		translate: 0 -50%;
		border-radius: 2px;
		pointer-events: none;
	}

	.rail::before {
		right: 0;
		background: var(--line-strong);
	}

	.filled {
		background: var(--paper);
	}

	.tick {
		position: absolute;
		top: 0.95rem;
		width: 2px;
		height: 0.45rem;
		padding: 0;
		border: 0;
		background: var(--muted);
		translate: -50% 0;
	}

	.tick:hover {
		background: var(--ink);
	}

	input[type='range'] {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		background: none;
		appearance: none;
		cursor: pointer;
	}

	input[type='range']::-webkit-slider-runnable-track {
		height: 100%;
		background: none;
	}

	input[type='range']::-webkit-slider-thumb {
		width: 0.85rem;
		height: 0.85rem;
		margin-top: -0.02rem;
		border: 2px solid var(--chrome);
		border-radius: 50%;
		background: var(--paper);
		appearance: none;
	}

	input[type='range']::-moz-range-thumb {
		width: 0.85rem;
		height: 0.85rem;
		border: 2px solid var(--chrome);
		border-radius: 50%;
		background: var(--paper);
	}

	.where {
		display: flex;
		flex-direction: column;
		min-width: 7.5rem;
		font-size: 0.74rem;
		line-height: 1.25;
	}

	.where span {
		color: var(--muted);
	}

	.chip {
		padding: 0.25rem 0.6rem;
		color: var(--muted);
		font-size: 0.78rem;
	}

	.chip.on {
		border-color: var(--line-strong);
		color: var(--ink);
	}

	.chip.key {
		width: 1.8rem;
		padding: 0.25rem 0;
		font-weight: 700;
	}

	.keys {
		position: absolute;
		right: 0.9rem;
		bottom: calc(100% + 0.5rem);
		display: grid;
		grid-template-columns: auto auto;
		gap: 0.25rem 0.9rem;
		margin: 0;
		padding: 0.7rem 0.9rem;
		border: 1px solid var(--line-strong);
		border-radius: 3px;
		background: var(--panel-solid);
		box-shadow: 0 1rem 2.5rem rgb(0 0 0 / 0.5);
		font-size: 0.8rem;
	}

	.keys dt {
		color: var(--paper);
		font-weight: 600;
		text-align: right;
	}

	.keys dd {
		margin: 0;
		color: var(--muted);
	}
</style>
