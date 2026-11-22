<script lang="ts">
	import type { Command, PlayerId, Start, Table } from '@repo/game';
	import VoteButton from './VoteButton.svelte';
	import { tableVoters } from './voters.ts';

	type Props = {
		table: Table;
		player: PlayerId;
		start: Start;
		label: string;
		send: (command: Command) => void;
		surface?: 'solid' | 'outline';
		disabled?: boolean;
	};

	let { table, player, start, label, send, surface = 'solid', disabled = false }: Props = $props();

	const on = $derived(table.ready[player] === start);
</script>

<VoteButton
	{label}
	tally="ready"
	voters={tableVoters(table, who => table.ready[who] === start)}
	{on}
	{surface}
	disabled={disabled || !table.seats.some(entry => entry.player === player)}
	onclick={() => send({ type: 'READY', player, start: on ? null : start })}
	testid={`ready-${start}`}
/>
