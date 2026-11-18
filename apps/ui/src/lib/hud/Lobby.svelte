<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { score, SEAT_IDS, tablePlayers } from '@repo/game';
	import type { Command, PlayerId, PublicState, SeatId, Start } from '@repo/game';
	import { LS } from '#lib/storage.ts';
	import { MONTHS, SEAT_COLORS } from './labels.svelte.ts';
	import Ready from './Ready.svelte';

	type Props = {
		snap: PublicState;
		player: PlayerId;
		send: (command: Command) => void;
		rename: (name: string) => void;
	};

	let { snap, player, send, rename }: Props = $props();

	const campaign = $derived(snap.world.campaign);
	const table = $derived(snap.world.table);
	const finished = $derived(snap.phase === 'finished');
	const total = $derived(score(campaign));
	const players = $derived(tablePlayers(table));
	const colorOf = (seat: SeatId) => SEAT_COLORS[SEAT_IDS.indexOf(seat)]!;
	const firstSeat = (who: PlayerId) => table.seats.find(entry => entry.player === who)!;
	const mine = $derived(table.seats.filter(entry => entry.player === player));

	const starts: { start: Start; label: string }[] = [
		{ start: 'prologue', label: 'Prologue' },
		{ start: 'month', label: MONTHS[1]! },
	];
	const waitingOn = $derived(players.filter(who => !table.ready[who]).map(who => firstSeat(who).name));
	const split = $derived(new Set(Object.values(table.ready)).size > 1);

	let name = $state(LS.get('name', ''));
	let typing: ReturnType<typeof setTimeout> | undefined;
	function typed() {
		clearTimeout(typing);
		typing = setTimeout(() => name.trim() && rename(name), 450);
	}
</script>

<div
	class="lobby"
	{@attach feedback(undefined, () => ({ phase: snap.phase, month: campaign.month, table }))}
	data-testid="lobby"
>
	{#if finished}
		<h1>Campaign complete</h1>
		<dl class="score">
			<dt>Final score</dt>
			<dd>{total.total}</dd>
			<dt>Months won early</dt>
			<dd>{total.earlyWins}</dd>
			<dt>Months won late</dt>
			<dd>{total.lateWins}</dd>
			<dt>Population</dt>
			<dd>{total.population}</dd>
			<dt>Sample delivered</dt>
			<dd>{total.sample}</dd>
			<dt>Labs found</dt>
			<dd>{total.labs}</dd>
			<dt>Forsaken cities</dt>
			<dd>{total.forsaken}</dd>
		</dl>
	{:else}
		<h1>{campaign.month === 0 ? 'The table' : MONTHS[campaign.month]}</h1>

		<label class="name">
			<span>Your name</span>
			<input
				bind:value={name}
				oninput={typed}
				onchange={() => name.trim() && rename(name)}
				maxlength="24"
				placeholder="Your name"
				autocomplete="nickname"
				data-testid="lobby-name"
			/>
		</label>

		<ol class="seats" aria-label="Seats">
			{#each SEAT_IDS as seat (seat)}
				{@const entry = table.seats.find(candidate => candidate.seat === seat)}
				<li class:open={!entry} class:you={entry?.player === player} style:--seat={colorOf(seat)}>
					<i></i>
					{#if entry}
						<strong>{entry.name}</strong>
						{#if entry.player === player && mine.length > 1}
							<button
								class="drop"
								aria-label={`Give up this seat`}
								title="Give up this seat"
								onclick={() => send({ type: 'LEAVE', player, seat })}>×</button
							>
						{/if}
					{:else}
						<span>Open seat</span>
					{/if}
				</li>
			{/each}
		</ol>
		{#if mine.length > 0 && table.seats.length < SEAT_IDS.length}
			<button class="add" onclick={() => send({ type: 'ADD_SEAT', player })} data-testid="add-seat"
				>+ Play another seat on this screen</button
			>
		{/if}

		<div class="starts">
			{#each starts as option (option.start)}
				<Ready {table} {player} {send} start={option.start} label={option.label} />
			{/each}
		</div>
		<p class="hint" aria-live="polite">
			{#if table.seats.length < 2}
				A game needs two seats. Others join with your passphrase, or play another seat here.
			{:else if split}
				Everyone has to pick the same game.
			{:else if waitingOn.length}
				Waiting for {waitingOn.join(', ')}.
			{:else}
				Choosing characters.
			{/if}
		</p>
	{/if}
</div>

<style>
	.lobby {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		width: min(26rem, 92vw);
		padding: 1.6rem 1.8rem 1.4rem;
		border-radius: 2px;
		background: var(--document);
		color: var(--slip-ink);
		box-shadow: var(--document-shadow);
		animation: laid 420ms cubic-bezier(0.2, 0.9, 0.3, 1.1) both;
	}

	@keyframes laid {
		from {
			opacity: 0;
			translate: 0 1.5rem;
			rotate: -1.2deg;
		}
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 2.4rem;
		font-weight: 400;
		line-height: 1;
	}

	.name {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.name span {
		color: var(--slip-muted);
		font-size: 0.78rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	input {
		padding: 0.35rem 0.1rem;
		border: 0;
		border-bottom: 1px solid rgb(42 32 23 / 0.35);
		background: none;
		color: var(--slip-ink);
		font-family: var(--font-display);
		font-size: 1.35rem;
	}

	input:focus {
		outline: none;
		border-bottom-color: var(--slip-ink);
	}

	input::placeholder {
		color: rgb(42 32 23 / 0.4);
	}

	.seats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.seats li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.3rem;
		padding: 0.3rem 0.55rem;
		border: 1px solid rgb(42 32 23 / 0.22);
		border-radius: 2px;
		font-size: 0.95rem;
		animation: sit 320ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
	}

	@keyframes sit {
		from {
			opacity: 0;
			scale: 0.94;
		}
	}

	.seats li i {
		flex: none;
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 50%;
		background: var(--seat);
	}

	.seats li strong {
		overflow: hidden;
		font-family: var(--font-display);
		font-size: 1.08rem;
		font-weight: 400;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.seats li.you {
		border-color: var(--slip-ink);
		box-shadow: inset 3px 0 0 var(--seat);
	}

	.seats li.open {
		border-style: dashed;
		color: var(--slip-muted);
		font-size: 0.85rem;
	}

	.seats li.open i {
		background: none;
		box-shadow: inset 0 0 0 1.5px rgb(42 32 23 / 0.3);
	}

	button {
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

	button:hover:not(:disabled) {
		border-color: var(--slip-ink);
		background: rgb(42 32 23 / 0.06);
	}

	button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.drop {
		margin-left: auto;
		padding: 0 0.35rem;
		border-color: transparent;
		color: var(--slip-muted);
		font-size: 1rem;
		line-height: 1.2;
	}

	.add {
		align-self: flex-start;
		margin-top: -0.6rem;
		padding: 0.2rem 0;
		border: 0;
		color: var(--slip-muted);
		font-size: 0.82rem;
	}

	.add:hover:not(:disabled) {
		background: none;
		color: var(--slip-ink);
	}

	.starts {
		display: flex;
		gap: 0.6rem;
	}

	.hint {
		margin: -0.3rem 0 0;
		color: var(--slip-muted);
		font-size: 0.85rem;
		text-align: center;
	}

	.score {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.35rem 2rem;
		margin: 0;
		font-size: 1rem;
	}

	.score dt {
		border-bottom: 1px dotted rgb(42 32 23 / 0.25);
	}

	.score dd {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.25rem;
		text-align: right;
	}
</style>
