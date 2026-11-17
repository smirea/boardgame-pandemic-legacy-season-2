<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { actionCost, isFreeAction } from '@repo/game';
	import type { Action, ActionChoice, SeatId, World } from '@repo/game';
	import { flip } from 'svelte/animate';
	import ActionIcon from './ActionIcon.svelte';
	import { ACTION_NAMES, ACTION_TEXT, actionDetail, actionTarget, cityName } from './labels.svelte.ts';

	type Props = {
		world: World;
		seat: SeatId;
		name: string;
		menu: ActionChoice[];
		/** The seat is taking actions on this screen, so rows can be chosen and the ones that cannot say why. */
		live: boolean;
		/** The kind of action whose targets are lit on the map. */
		aiming: Action['a'] | null;
		onchoose: (choice: ActionChoice) => void;
	};

	let { world, seat, name, menu, live, aiming, onchoose }: Props = $props();

	// What can be done now rises to the top, so the rows worth reading are the first ones.
	const rows = $derived(
		(live ? menu.toSorted((a, b) => Number(b.actions.length > 0) - Number(a.actions.length > 0)) : menu).map(choice => {
			const only = choice.actions.length === 1 ? choice.actions[0]! : null;
			const target = only ? actionTarget(world, only) : null;
			const detail = only ? actionDetail(world, only) : '';
			const free =
				choice.actions.length > 0 &&
				(isFreeAction(choice.a) || choice.actions.every(action => actionCost(world, seat, action) === 0));
			return {
				choice,
				open: live && choice.actions.length > 0,
				title: ACTION_NAMES[choice.a] + (target ? ` to ${cityName(target)}` : ''),
				text: live && choice.reason ? choice.reason : detail || ACTION_TEXT[choice.a],
				count: choice.actions.length > 1 ? choice.actions.length : null,
				free,
			};
		}),
	);
</script>

<section
	class="panel"
	class:live
	aria-label="Actions"
	data-testid="actions"
	{@attach feedback('Actions', () => ({ seat, live, aiming, open: rows.filter(row => row.open).length }))}
>
	<header>
		<strong>Actions</strong>
		<span>{name}</span>
	</header>
	<ul>
		{#each rows as row, index (row.choice.a)}
			<li animate:flip={{ duration: 280 }} style:--i={Math.min(index, 10)}>
				<button
					class:aiming={aiming === row.choice.a}
					class:closed={!row.open}
					disabled={!row.open}
					title={row.text}
					data-action={row.choice.a}
					onclick={() => onchoose(row.choice)}
				>
					<ActionIcon action={row.choice.a} />
					<span class="words">
						<span class="name">
							{row.title}
							{#if row.free}<em class="free">free</em>{/if}
							{#if row.count}<em>{row.count}</em>{/if}
						</span>
						<span class="text" class:why={live && !row.open}>{row.text}</span>
					</span>
				</button>
			</li>
		{/each}
	</ul>
</section>

<style>
	.panel {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		min-height: 0;
		max-height: 100%;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--panel);
		backdrop-filter: blur(10px);
		box-shadow: 0 0.6rem 1.6rem rgb(0 0 0 / 0.35);
	}

	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.6rem;
		padding: 0.45rem 0.7rem 0.35rem;
		border-bottom: 1px solid var(--line);
	}

	header strong {
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 400;
	}

	header span {
		overflow: hidden;
		color: var(--muted);
		font-size: 0.78rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-height: 0;
		margin: 0;
		padding: 0.3rem;
		overflow: auto;
		list-style: none;
		scrollbar-width: thin;
	}

	li {
		animation: rise 300ms calc(var(--i) * 25ms) both;
	}

	button {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		padding: 0.32rem 0.45rem;
		border: 1px solid transparent;
		border-radius: 3px;
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			background 160ms ease,
			border-color 160ms ease,
			opacity 200ms ease;
	}

	button:hover:not(:disabled) {
		border-color: var(--line-strong);
		background: var(--wash);
	}

	button:hover:not(:disabled) :global(.icon) {
		scale: 1.08;
	}

	button :global(.icon) {
		transition: scale 160ms ease;
	}

	button.aiming {
		border-color: var(--warn);
		background: rgb(227 178 60 / 0.12);
	}

	/* Rows that cannot be taken stay readable, with the reason where the description was. */
	.live button.closed {
		opacity: 0.5;
		cursor: default;
	}

	.live button.closed :global(.icon) {
		filter: grayscale(0.85);
	}

	.words {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.name {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		font-size: 0.98rem;
		font-weight: 600;
		line-height: 1.2;
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
		overflow: hidden;
		color: var(--muted);
		font-size: 0.78rem;
		line-height: 1.25;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.text.why {
		color: var(--warn);
		font-style: italic;
	}

	@keyframes rise {
		from {
			opacity: 0;
			translate: -0.5rem 0;
		}
	}
</style>
