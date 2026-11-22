<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { actionCost, isFreeAction, pack, reject } from '@repo/game';
	import type { Action, ActionChoice, CardId, Command, PublicState, SeatId } from '@repo/game';
	import ActionIcon from './ActionIcon.svelte';
	import { ACTION_NAMES, actionDetail, actionTarget, actionText, cityName, sharedCost } from './labels.svelte.ts';
	import RichText from './RichText.svelte';
	import { keep } from './viewState.ts';
	import { ways } from './ways.ts';

	type Props = {
		snap: PublicState;
		seat: SeatId;
		name: string;
		menu: ActionChoice[];
		/** The seat is taking actions on this screen, so rows can be chosen and the ones that cannot say why. */
		live: boolean;
		/** This screen plays the active seat, so the controls that move the turn on are offered. */
		canAct: boolean;
		/** The kind of action whose targets are lit on the map. */
		aiming: Action['a'] | null;
		onchoose: (choice: ActionChoice) => void;
		send: (command: Command) => void;
		/** Destroying a Lockdown card costs a Player card, so the screen asks whose. */
		onlockdown: (card: CardId) => void;
	};

	let { snap, seat, name, menu, live, canAct, aiming, onchoose, send, onlockdown }: Props = $props();

	let showUnavailable = $state(false);
	keep(
		'actions',
		() => ({ showUnavailable }),
		saved => {
			showUnavailable = Boolean(saved?.showUnavailable);
		},
	);

	const world = $derived(snap.world);
	const game = $derived(world.game!);
	const anyPay = $derived(
		game.seats.flatMap(other => game.players[other]!.hand.map(pay => ({ seat: other, pay })))[0] ?? null,
	);
	const refused = (command: Command) => !canAct || reject(world, snap.phase, command) !== null;

	const rows = $derived(
		menu.map(choice => {
			const offered = ways(world, choice.actions);
			const only = offered.length === 1 ? offered[0]! : null;
			const target = only ? actionTarget(world, only) : null;
			const detail = only ? actionDetail(world, only) : sharedCost(world, offered);
			const free =
				live &&
				choice.actions.length > 0 &&
				(isFreeAction(choice.a) || choice.actions.every(action => actionCost(world, seat, action) === 0));
			return {
				choice,
				open: live && choice.actions.length > 0,
				title: ACTION_NAMES[choice.a] + (live && target ? ` to ${cityName(target)}` : ''),
				text:
					live && choice.reason ? choice.reason : live && detail?.length ? detail : actionText(world, seat, choice.a),
				count: live && offered.length > 1 ? offered.length : null,
				free,
			};
		}),
	);

	const available = $derived(rows.filter(row => row.open));
	const unavailable = $derived(rows.filter(row => !row.open));

	// A Lockdown card in the infection discard can be destroyed at any point of a turn, so it waits here with the
	// controls that move the turn on.
	const lockable = $derived(
		game.infectionDiscard.flatMap(id => {
			const card = world.campaign.infectionCards[id];
			return card?.kind === 'city' && card.improvement === 'lockdown' ? [{ id, city: card.city }] : [];
		}),
	);
</script>

{#snippet actionRow(row: (typeof rows)[number], index: number)}
	<li style:--i={Math.min(index, 10)}>
		<button
			class:aiming={aiming === row.choice.a}
			class:closed={!row.open}
			disabled={!row.open}
			data-action={row.choice.a}
			onclick={() => onchoose(row.choice)}
		>
			<ActionIcon action={row.choice.a} size="1.5rem" />
			<span class="words">
				<span class="name">
					{row.title}
					{#if row.free}<em class="free">free</em>{/if}
					{#if row.count}<em>{row.count}</em>{/if}
				</span>
				<span class="text" class:why={live && !row.open}><RichText text={row.text} /></span>
			</span>
		</button>
	</li>
{/snippet}

<section
	class="panel"
	class:live
	aria-label={`${name}'s actions`}
	data-testid="actions"
	data-dest="actions"
	{@attach feedback('Actions', () => ({
		seat,
		live,
		aiming,
		open: available.length,
		unavailable: unavailable.length,
		showUnavailable,
		phase: snap.phase,
	}))}
>
	<div class="list" data-testid="action-list">
		{#if available.length}
			<ul>
				{#each available as row, index (row.choice.a)}
					{@render actionRow(row, index)}
				{/each}
			</ul>
		{/if}
		{#if unavailable.length}
			<button
				type="button"
				class="more"
				aria-expanded={showUnavailable}
				aria-controls="unavailable-actions"
				data-testid="toggle-unavailable"
				onclick={() => (showUnavailable = !showUnavailable)}
			>
				<span class="chevron" aria-hidden="true">{showUnavailable ? '▾' : '▸'}</span>
				{#if showUnavailable}
					Hide {unavailable.length} unavailable action{unavailable.length === 1 ? '' : 's'}
				{:else}
					+{unavailable.length} unavailable action{unavailable.length === 1 ? '' : 's'}
				{/if}
			</button>
			{#if showUnavailable}
				<ul id="unavailable-actions" class="unavailable" data-testid="unavailable-actions">
					{#each unavailable as row, index (row.choice.a)}
						{@render actionRow(row, index)}
					{/each}
				</ul>
			{/if}
		{/if}
	</div>
	<footer>
		{#if snap.phase === 'playing.actions'}
			<span
				class="pips"
				role="img"
				aria-label={`${game.actionsLeft} action${game.actionsLeft === 1 ? '' : 's'} left`}
				data-testid="pips"
			>
				{#each { length: Math.max(pack.numbers.actionsPerTurn, game.actionsLeft) } as _, index (index)}
					<i class:on={index < game.actionsLeft}></i>
				{/each}
			</span>
		{/if}
		{#if !canAct}
			<span class="who" data-testid="whose-turn">{name}'s turn</span>
		{:else if snap.phase === 'playing.actions'}
			<button
				class="primary"
				disabled={refused({ type: 'END_ACTIONS', seat: game.active })}
				onclick={() => send({ type: 'END_ACTIONS', seat: game.active })}
				data-testid="end-actions"
			>
				{game.actionsLeft > 0 ? 'End actions' : 'Draw cards'}
			</button>
			<button disabled={!snap.canUndo} onclick={() => send({ type: 'UNDO' })} data-testid="undo">Undo</button>
		{/if}
		{#each lockable as card (card.id)}
			<button
				class="lockdown"
				disabled={!anyPay || reject(world, snap.phase, { type: 'LOCKDOWN', card: card.id, ...anyPay }) !== null}
				onclick={() => onlockdown(card.id)}
				data-testid="lockdown">Lockdown: destroy {cityName(card.city)}</button
			>
		{/each}
	</footer>
</section>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		width: 100%;
		min-width: 15.5rem;
		min-height: 0;
		max-height: 100%;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--panel);
		backdrop-filter: blur(10px);
		box-shadow: 0 0.6rem 1.6rem rgb(0 0 0 / 0.35);
	}

	.who {
		flex: 1;
		color: var(--muted);
		font-size: 0.85rem;
		text-align: center;
	}

	.pips {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding-inline: 0.15rem 0.2rem;
	}

	.pips i {
		width: 0.7rem;
		height: 0.7rem;
		border: 1px solid var(--paper);
		border-radius: 50%;
		transition:
			background 250ms ease,
			transform 250ms ease,
			opacity 250ms ease;
	}

	.pips i.on {
		background: var(--paper);
	}

	.pips i:not(.on) {
		transform: scale(0.8);
		opacity: 0.5;
	}

	.list {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		min-height: 0;
		padding: 0.3rem;
		overflow-x: hidden;
		overflow-y: auto;
		overscroll-behavior: contain;
		scrollbar-width: thin;
		scrollbar-color: rgb(231 220 198 / 0.25) transparent;
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 0.08rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.more {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		width: 100%;
		margin-top: 0.25rem;
		padding: 0.28rem 0.35rem;
		border: 0;
		border-top: 1px solid var(--line);
		border-radius: 2px;
		background: none;
		color: var(--muted);
		font-size: 0.75rem;
		font-weight: 600;
		text-align: left;
		transition:
			background 140ms ease,
			color 140ms ease;
	}

	.more:first-child {
		margin-top: 0;
		border-top: 0;
	}

	.more:hover {
		background: var(--wash);
		color: var(--ink);
	}

	.chevron {
		width: 0.7rem;
		font-size: 0.72rem;
		text-align: center;
	}

	.unavailable {
		margin-top: 0.12rem;
	}

	li {
		animation: rise 300ms calc(var(--i) * 25ms) both;
	}

	button {
		font: inherit;
		cursor: pointer;
	}

	li button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		height: 100%;
		padding: 0.1rem 0.3rem;
		border: 1px solid transparent;
		border-radius: 3px;
		background: none;
		color: var(--ink);
		text-align: left;
		transition:
			background 160ms ease,
			border-color 160ms ease,
			opacity 200ms ease;
	}

	li button:hover:not(:disabled) {
		border-color: var(--line-strong);
		background: var(--wash);
	}

	li button:hover:not(:disabled) :global(.icon) {
		scale: 1.08;
	}

	li button :global(.icon) {
		transition: scale 160ms ease;
	}

	li button.aiming {
		border-color: var(--warn);
		background: rgb(227 178 60 / 0.12);
	}

	/* Rows that cannot be taken stay readable, with the reason where the description was. */
	li button.closed {
		opacity: 0.55;
		cursor: default;
	}

	li button.closed :global(.icon) {
		filter: grayscale(0.85);
	}

	.words {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.name {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		column-gap: 0.4rem;
		font-size: 0.84rem;
		font-weight: 600;
		line-height: 1.05;
	}

	.name em {
		padding: 0 0.3rem;
		border-radius: 2px;
		background: rgb(231 220 198 / 0.12);
		color: var(--muted);
		font-size: 0.72rem;
		font-style: normal;
		font-weight: 600;
	}

	.name em.free {
		background: none;
		color: var(--good);
	}

	.text {
		color: var(--muted);
		font-size: 0.7rem;
		line-height: 1.1;
	}

	.text.why {
		color: var(--warn);
		font-style: italic;
	}

	footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem;
		border-top: 1px solid var(--line);
	}

	footer:empty {
		display: none;
	}

	footer button {
		flex: 1 1 auto;
		padding: 0.3rem 0.7rem;
		border: 1px solid var(--line-strong);
		border-radius: 2px;
		background: none;
		color: var(--ink);
		font-size: 0.85rem;
		animation: rise 320ms cubic-bezier(0.2, 0.9, 0.3, 1.1) both;
		transition:
			border-color 150ms ease,
			background 150ms ease,
			transform 150ms ease;
	}

	footer button:hover:not(:disabled) {
		border-color: var(--paper);
		background: var(--wash);
	}

	footer button:active:not(:disabled) {
		transform: translateY(1px);
	}

	footer button.primary {
		border-color: var(--paper);
		background: var(--paper);
		color: var(--paper-ink);
		font-weight: 700;
	}

	footer button.primary:hover:not(:disabled) {
		background: #e9dec5;
	}

	footer [data-testid='undo'] {
		flex: none;
	}

	footer .lockdown {
		flex-basis: 100%;
	}

	footer button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	@keyframes rise {
		from {
			opacity: 0;
			translate: -0.5rem 0;
		}
	}
</style>
