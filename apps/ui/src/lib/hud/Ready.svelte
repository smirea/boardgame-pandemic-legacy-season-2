<script lang="ts">
	import { SEAT_IDS, tablePlayers } from '@repo/game';
	import type { Command, PlayerId, Start, Table } from '@repo/game';
	import { SEAT_COLORS } from './labels.svelte.ts';

	type Props = {
		table: Table;
		player: PlayerId;
		start: Start;
		label: string;
		send: (command: Command) => void;
		big?: boolean;
	};

	let { table, player, start, label, send, big = false }: Props = $props();

	const players = $derived(tablePlayers(table));
	const firstSeat = (who: PlayerId) => table.seats.find(entry => entry.player === who)!;
	const on = $derived(table.ready[player] === start);
	const count = $derived(players.filter(who => table.ready[who] === start).length);
</script>

<button
	class="ready"
	class:big
	class:on
	aria-pressed={on}
	disabled={!table.seats.some(entry => entry.player === player)}
	onclick={() => send({ type: 'READY', player, start: on ? null : start })}
	data-testid={`ready-${start}`}
>
	<span class="label">{label}</span>
	<span class="pips" role="img" aria-label={`${count} of ${players.length} ready`}>
		{#each players as who (who)}
			{@const voted = table.ready[who] === start}
			<!-- An empty socket for each player still to ready, filled with their colour once they are. -->
			<i class:voted style:--seat={SEAT_COLORS[SEAT_IDS.indexOf(firstSeat(who).seat)]}></i>
		{/each}
	</span>
</button>

<style>
	.ready {
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: center;
		gap: 0.45rem;
		padding: 0.7rem 0.6rem 0.6rem;
		border: 1px solid rgb(42 32 23 / 0.4);
		border-radius: 2px;
		background: none;
		color: var(--slip-ink);
		font: inherit;
		cursor: pointer;
		transition:
			background 150ms ease,
			border-color 150ms ease,
			color 150ms ease;
	}

	.ready:hover:not(:disabled) {
		border-color: var(--slip-ink);
		background: rgb(42 32 23 / 0.06);
	}

	.ready:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.label {
		font-family: var(--font-display);
		font-size: 1.35rem;
		line-height: 1;
	}

	.ready.on {
		border-color: var(--slip-ink);
		background: var(--slip-ink);
		color: #efe6d2;
	}

	.ready.on:hover:not(:disabled) {
		background: #3d3022;
	}

	.big {
		flex: none;
		gap: 0.7rem;
		min-width: 15rem;
		padding: 1rem 2.4rem 0.9rem;
		border: 2px solid var(--paper);
		border-radius: 4px;
		background: var(--paper);
		box-shadow: 0 1rem 2.5rem rgb(0 0 0 / 0.45);
		color: var(--paper-ink);
	}

	.big .label {
		font-size: 2.2rem;
	}

	.big:hover:not(:disabled) {
		border-color: var(--paper);
		background: #e9dec5;
	}

	.big.on {
		border-color: var(--ink-good, #3d6b55);
		background: var(--ink-good, #3d6b55);
		color: #f3ecdc;
	}

	.big.on:hover:not(:disabled) {
		background: #335c48;
	}

	.pips {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.big .pips {
		gap: 0.5rem;
	}

	.pips i {
		flex: none;
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 50%;
		box-shadow: inset 0 0 0 1.5px currentColor;
		opacity: 0.45;
		transition:
			background 220ms ease,
			box-shadow 220ms ease,
			opacity 220ms ease;
	}

	.big .pips i {
		width: 1rem;
		height: 1rem;
	}

	.pips i.voted {
		background: var(--seat);
		box-shadow:
			inset 0 0 0 1.5px rgb(255 252 242 / 0.75),
			0 0 0.45rem var(--seat);
		opacity: 1;
	}
</style>
