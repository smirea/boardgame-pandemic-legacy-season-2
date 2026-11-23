<!--
	Cards that live off the board (a discard pile, storage, another player's hand, the top of the Infection deck)
	laid out over the table as the real cards, for a pick. The cards that can be picked are lit; a picked one rises
	with a tick, or its place when the order matters.
-->
<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import type { CardId, World } from '@repo/game';
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import Beacon from '#lib/Beacon.svelte';
	import InfectionCard from '#lib/cards/InfectionCard.svelte';
	import ActionIcon from './ActionIcon.svelte';
	import type { CardPick } from './choosing.svelte.ts';
	import PlayerCard from './PlayerCard.svelte';

	type Props = {
		pick: CardPick;
		world: World;
		oncard: (card: CardId) => void;
		onconfirm: () => void;
		oncancel: () => void;
	};

	let { pick, world, oncard, onconfirm, oncancel }: Props = $props();
</script>

<section
	class="pick"
	aria-label={pick.title}
	data-testid="card-pick"
	oncontextmenu={event => {
		event.preventDefault();
		oncancel();
	}}
	transition:fly={{ y: 24, duration: 220, easing: cubicOut }}
	{@attach feedback('Card pick', () => ({ title: pick.title, picked: pick.picked, eligible: [...pick.eligible] }))}
>
	<header class="slip">
		{#if pick.a}<ActionIcon action={pick.a} size="2.2rem" />{/if}
		<div class="say">
			<strong>{pick.title}</strong>
			<span>{pick.prompt} Esc or a right click cancels.</span>
		</div>
		<div class="buttons">
			{#if pick.confirm}
				<button
					type="button"
					class="primary"
					disabled={!pick.confirm.ready}
					data-testid="card-pick-confirm"
					onclick={onconfirm}>{pick.confirm.label}</button
				>
			{/if}
			<button type="button" onclick={oncancel} data-testid="card-pick-cancel">Cancel</button>
		</div>
	</header>
	{#each pick.groups as group (group.label)}
		<div class="group" role="group" aria-label={group.label}>
			<span class="label">{group.label}</span>
			<div class="cards" class:sideways={group.pile === 'infection'}>
				{#each group.cards as id, index (id)}
					{@const open = pick.eligible.has(id)}
					{@const place = pick.picked.indexOf(id)}
					{@const player = group.pile === 'player' ? world.campaign.playerCards[id] : undefined}
					{@const infection = group.pile === 'infection' ? world.campaign.infectionCards[id] : undefined}
					<div
						class="card"
						class:open
						class:picked={place >= 0}
						style:--i={index}
						data-card={id}
						data-picked={place >= 0 || undefined}
						{@attach feedback(undefined, () => ({ id, open, place }))}
					>
						{#if player}
							<PlayerCard card={player} dimmed={!open} onclick={open ? () => oncard(id) : undefined} />
						{:else if infection}
							<InfectionCard card={infection} onclick={open ? () => oncard(id) : undefined} />
						{/if}
						{#if place >= 0}
							<span class="tick" aria-label={pick.ordered ? `Number ${place + 1}` : 'Picked'}
								>{pick.ordered ? place + 1 : '✓'}</span
							>
						{:else if open}
							<Beacon />
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/each}
</section>

<style>
	/* In front of the middle of the table, clear of the hand floating at its foot. */
	.pick {
		position: absolute;
		left: calc(var(--left, 0px) + (100% - var(--left, 0px) - var(--right, 0px)) / 2);
		top: 46%;
		z-index: 40;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6rem;
		width: max-content;
		max-width: calc(100% - var(--left, 0px) - var(--right, 0px) - 2rem);
		translate: -50% -50%;
		pointer-events: none;
	}

	.pick > :global(*) {
		pointer-events: auto;
	}

	.slip {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.55rem 0.8rem;
		border-radius: 3px;
		background: var(--slip);
		box-shadow: var(--slip-shadow);
		color: var(--slip-ink);
	}

	.say {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		font-size: 0.82rem;
	}

	.say strong {
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 400;
	}

	.say span {
		color: var(--slip-muted);
	}

	.buttons {
		display: flex;
		gap: 0.4rem;
		margin-left: 0.6rem;
	}

	.buttons button {
		padding: 0.35rem 0.8rem;
		border: 1px solid var(--slip-line);
		border-radius: 2px;
		background: none;
		color: var(--slip-ink);
		font: inherit;
		font-size: 0.85rem;
		white-space: nowrap;
		cursor: pointer;
	}

	.buttons .primary {
		border-color: var(--slip-ink);
		background: var(--slip-ink);
		color: var(--slip);
	}

	.buttons button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.group {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
	}

	.label {
		padding: 0.1rem 0.5rem;
		border-radius: 2px;
		background: rgb(20 14 8 / 0.7);
		color: var(--ink);
		font-size: 0.75rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.cards {
		--card-size: 0.74rem;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.9rem;
		padding: 0.5rem;
	}

	.card {
		position: relative;
		border-radius: 0.35rem;
		filter: drop-shadow(0 0.5rem 0.9rem rgb(0 0 0 / 0.55));
		transition: translate 220ms cubic-bezier(0.22, 1, 0.36, 1);
		animation: deal 300ms calc(var(--i) * 40ms) both cubic-bezier(0.22, 1, 0.36, 1);
	}

	.card.open:hover,
	.card.picked {
		translate: 0 -0.6rem;
	}

	.tick {
		position: absolute;
		right: -0.55rem;
		top: -0.55rem;
		z-index: 4;
		display: grid;
		place-items: center;
		min-width: 1.6rem;
		height: 1.6rem;
		padding: 0 0.3rem;
		border: 2px solid rgb(28 16 4 / 0.7);
		border-radius: 0.8rem;
		background: #3f9b6e;
		color: #fff;
		font-weight: 700;
	}

	@keyframes deal {
		from {
			opacity: 0;
			translate: 0 1.5rem;
		}
	}
</style>
