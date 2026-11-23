<script lang="ts">
	import { getContext } from 'svelte';
	import type { CardId } from '@repo/game';
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack, SEAT_IDS } from '@repo/game';
	import type { SeatId, World } from '@repo/game';
	import { inkOn } from '#lib/color.ts';
	import Bubble from '#lib/replay/Bubble.svelte';
	import type { SaidNote } from '#lib/replay/replay.svelte.ts';
	import { flip } from 'svelte/animate';
	import { cubicIn, cubicOut } from 'svelte/easing';
	import { fade, fly, scale } from 'svelte/transition';
	import CardIcon from '#lib/cards/CardIcon.svelte';
	import { CUBE_FLIGHTS } from './cubeFlights.svelte.ts';
	import type { CubeFlights } from './cubeFlights.svelte.ts';
	import { deal } from './deal.ts';
	import { handGroups } from './handGroups.ts';
	import { sortHand } from './handOrder.ts';
	import { cardName } from './labels.svelte.ts';
	import HandFan from './HandFan.svelte';
	import CharacterSheet from './characters/CharacterSheet.svelte';
	import MiniSheet from './characters/MiniSheet.svelte';
	import type { Place } from './seats.ts';
	import { turnSteps } from './turn.ts';

	// Supply cubes flying off this seat's card and onto it, which it shows as they were until each one goes.
	const cubeFlights = getContext<CubeFlights | undefined>(CUBE_FLIGHTS);
	const hoverCard = getContext<((cards: CardId | CardId[] | null) => void) | undefined>('card-hover');

	type Props = {
		highlighted?: boolean;
		/** Who sits here: the player in a replay, the character at a live table. */
		name: string;
		seat: SeatId;
		color: string;
		world: World;
		place: Place;
		/** False for the hand the dock is already holding up, so it is not shown twice. */
		showHand?: boolean;
		notes?: SaidNote[];
		dimmed?: boolean;
		/** Followed in a replay, or the hand the dock shows at a live table. */
		selected: boolean;
		/** What clicking the card does. */
		action: string;
		/** Shown while selected, beside the name. */
		selectedTag?: string;
		onselect: () => void;
		onnote?: (note: SaidNote) => void;
		/** Cards drawn into this hand whose flight here has not landed: a pile made only of them is not shown yet. */
		arriving?: ReadonlySet<CardId>;
		/** Whether the active player is still taking actions. Once they draw, the turn's steps leave the seat. */
		acting: boolean;
	};

	let {
		highlighted = false,
		name,
		seat,
		color,
		world,
		place,
		showHand = true,
		notes = [],
		dimmed = false,
		selected,
		action,
		selectedTag,
		onselect,
		onnote = () => {},
		arriving = new Set(),
		acting,
	}: Props = $props();

	const cubesFlying = $derived(cubeFlights?.of(seat) ?? { leaving: 0, arriving: 0 });
	const game = $derived(world.game);
	const player = $derived(game?.players[seat]);
	const character = $derived(player ? world.campaign.characters[player.character] : undefined);
	const active = $derived(game !== null && game.active === seat && !game.outcome);
	const top = $derived(place === 'tl' || place === 'tr');
	const right = $derived(place === 'tr' || place === 'br');

	const named = (card: { id: CardId }) => cardName(world, card.id);
	const hand = $derived(
		sortHand(
			(player?.hand ?? []).flatMap(id => world.campaign.playerCards[id] ?? []),
			named,
		),
	);
	const groups = $derived(handGroups(hand, named));
	const steps = $derived(active && acting ? turnSteps(world, seat) : []);
	// The whole character and its whole hand open while the pointer rests anywhere on the seat: the character or its
	// piles. Leaving waits a beat, so crossing the gap between them does not close it.
	let reading = $state(false);
	let closing: ReturnType<typeof setTimeout> | undefined;
	const open = () => {
		clearTimeout(closing);
		reading = true;
	};
	const close = () => {
		clearTimeout(closing);
		closing = setTimeout(() => (reading = false), 160);
	};
</script>

<div
	class="corner {place}"
	class:dimmed
	data-testid="corner"
	data-player={name}
	onpointerenter={open}
	onpointerleave={close}
	onfocusin={open}
	onfocusout={close}
	role="group"
	aria-label="{name}'s seat"
	{@attach feedback(undefined, () => ({ name, seat, place, selected, action, player: world.game?.players[seat] }))}
>
	{#if top}
		{@render card()}
		{@render held()}
		{@render bubbles()}
	{:else}
		{@render bubbles()}
		{@render held()}
		{@render card()}
	{/if}
</div>

{#snippet card()}
	<div class="seat" style:--seat={color} style:--on={inkOn(color)} role="group" aria-label={name}>
		<button
			class="slip"
			class:highlighted
			class:active
			class:selected
			onclick={onselect}
			aria-pressed={selected}
			aria-label={`${name}: ${action}`}
		>
			<MiniSheet
				{character}
				portrait={SEAT_IDS.indexOf(seat)}
				{name}
				{color}
				side={right ? 'right' : 'left'}
				supplies={(player?.supplies ?? 0) + cubesFlying.leaving - cubesFlying.arriving}
				coming={cubesFlying.arriving}
				{active}
			/>
		</button>

		{#if reading && character}
			<!-- The whole character, grown out of the seat over the board while the pointer rests on it. -->
			<div
				class="big"
				data-testid="character-sheet"
				in:scale={{ start: 0.4, duration: 170, easing: cubicOut }}
				out:scale={{ start: 0.4, duration: 110, easing: cubicIn }}
			>
				<CharacterSheet
					{character}
					tone={character.dead ? 'dead' : 'mine'}
					{color}
					side={right ? 'right' : 'left'}
					label="Character sheet"
				>
					{#snippet base()}
						{#if player?.supplies}
							<span class="carried">{player.supplies} {player.supplies === 1 ? 'cube' : 'cubes'} carried</span>
						{/if}
					{/snippet}
				</CharacterSheet>
				{#if showHand}
					<div class="fan">
						<HandFan label="{name}'s hand" cards={hand} size="0.82rem" testid="corner-full-hand" />
					</div>
				{/if}
			</div>
		{/if}
		{#if steps.length}
			<!-- The turn so far, beside the card on the side facing the board. -->
			<ol class="steps" data-testid="turn-steps" out:fade={{ duration: 240 }}>
				{#each steps as step (step.seq)}
					<li
						class={step.kind}
						class:unpaid={!step.paid}
						in:fly={{ x: right ? 24 : -24, duration: 320 }}
						animate:flip={{ duration: 260 }}
					>
						<b>{step.name}</b>
						{#if step.detail}<span>{step.detail}</span>{/if}
						{#if step.count > 1}<i aria-label="{step.count} times">×{step.count}</i>{/if}
					</li>
				{/each}
			</ol>
		{/if}
	</div>
{/snippet}

{#snippet held()}
	{#if showHand && hand.length}
		<!-- Interchangeable cards stack into one pile, a card with its own state or ability stands alone. -->
		<div class="hand" style:--n={groups.length} data-testid="corner-hand" role="group" aria-label="{name}'s hand">
			{#each groups as group (group.key)}
				{@const ids = group.cards.map(card => card.id)}
				<button
					class="mini"
					onmouseenter={() => hoverCard?.(ids)}
					onmouseleave={() => hoverCard?.(null)}
					onfocus={() => hoverCard?.(ids)}
					onblur={() => hoverCard?.(null)}
					style:--band={group.color}
					style:--ink={inkOn(group.color)}
					aria-label={group.title}
					onclick={onselect}
					data-group={group.key}
					data-count={group.cards.length}
					animate:flip={{ duration: 320 }}
					class:arriving={group.cards.every(card => arriving.has(card.id))}
					in:deal
					out:fly={{ y: top ? 16 : -16, duration: 220, easing: cubicIn }}
				>
					{#each group.cards.slice(1) as card, index (card.id)}
						<i
							class="sheet"
							style:--depth={Math.min(index + 1, 3)}
							in:deal
							out:fly={{ y: top ? 12 : -12, duration: 220, easing: cubicIn }}
						></i>
					{/each}
					<span class="face">
						{#if group.art}<i class="art" style:--art="url({group.art})"></i>
						{:else if group.icon}<CardIcon path={group.icon} size="0.95rem" />{/if}
						{#if group.mark}<em>{group.mark}</em>{/if}
						{#if group.cards.length > 1}
							{#key group.cards.length}<b in:scale={{ start: 1.6, duration: 260 }}>{group.cards.length}</b>{/key}
						{/if}
					</span>
				</button>
			{/each}
		</div>
	{/if}
{/snippet}

{#snippet bubbles()}
	<div class="bubbles">
		{#each notes as note, index (note.key)}
			<Bubble {note} folded={index < notes.length - 1} above={!top} {right} {color} onopen={() => onnote(note)} />
		{/each}
	</div>
{/snippet}

<style>
	.corner {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		width: 100%;
		pointer-events: none;
		transition: opacity 250ms ease;
	}

	.corner > :global(*) {
		pointer-events: auto;
	}

	.tr,
	.br {
		align-items: flex-end;
	}

	.dimmed .slip {
		opacity: 0.55;
	}

	.seat {
		position: relative;
		width: 100%;
	}

	/* The character stands in the corner with no card behind it: the figure, the cut and its lines. */
	.slip {
		display: block;
		width: 100%;
		height: 8.8rem;
		padding: 0;
		border: 0;
		border-radius: 4px;
		background: none;
		font: inherit;
		cursor: pointer;
		transition:
			height 300ms cubic-bezier(0.2, 0.9, 0.3, 1.1),
			margin 300ms cubic-bezier(0.2, 0.9, 0.3, 1.1),
			opacity 250ms ease;
	}

	/* The active character stands taller, with room under its cut line for Current turn. */
	.slip.active {
		height: 11.2rem;
		margin-bottom: 1.2rem;
	}

	.slip.selected {
		outline: 2px dashed var(--seat);
		outline-offset: 3px;
	}

	.slip.highlighted {
		outline: 3px solid #f7d68b;
		outline-offset: 3px;
	}

	/* The full card takes the mini's place while it is open. */
	.seat:has(.big) .slip :global(.mini) {
		opacity: 0;
	}

	.slip:focus-visible {
		outline: 2px solid #f7d68b;
		outline-offset: 3px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	/* Grown from the seat's outer corner toward the board, over everything near it. */
	.big {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 20;
		width: min(31rem, 46vw);
		aspect-ratio: 1.2;
		transform-origin: top left;
		pointer-events: none;
	}

	.tr .big,
	.br .big {
		right: 0;
		left: auto;
		transform-origin: top right;
	}

	.bl .big,
	.br .big {
		top: auto;
		bottom: 0;
	}

	.bl .big {
		transform-origin: bottom left;
	}

	.br .big {
		transform-origin: bottom right;
	}

	/* The hand fanned beside the card, on the side toward the middle of the screen. */
	.fan {
		position: absolute;
		left: 1.4rem;
		bottom: calc(100% + 0.8rem);
	}

	.tl .fan,
	.tr .fan {
		top: calc(100% + 0.8rem);
		bottom: auto;
	}

	.tr .fan,
	.br .fan {
		right: 1.4rem;
		left: auto;
	}

	.carried {
		color: #e7dcc6;
		font-weight: 700;
	}

	/* The active player's turn so far, floating beside the card toward the board. */
	.steps {
		position: absolute;
		top: 0;
		z-index: 1;
		left: calc(100% + 0.4rem);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		width: max-content;
		max-width: 14rem;
		margin: 0;
		padding: 0;
		list-style: none;
		pointer-events: none;
	}

	.tr .steps,
	.br .steps {
		right: calc(100% + 0.4rem);
		left: auto;
	}

	.bl .steps,
	.br .steps {
		top: auto;
		bottom: 0;
	}

	.steps li {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		padding: 0.22rem 0.55rem 0.24rem;
		border-left: 3px solid var(--seat);
		border-radius: 2px;
		background: rgb(240 231 210 / 0.95);
		box-shadow: var(--slip-shadow);
		color: var(--slip-ink);
		font-size: 0.74rem;
		line-height: 1.25;
	}

	.steps li.event {
		border-left-color: #b08628;
	}

	.steps li.unpaid b {
		font-weight: 500;
	}

	.steps i {
		margin-left: auto;
		padding-left: 0.4rem;
		color: rgb(42 32 23 / 0.55);
		font-style: normal;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.steps b {
		font-weight: 700;
	}

	.steps span {
		color: rgb(42 32 23 / 0.75);
	}

	/* Mini cards overlap just enough that the whole hand spans the card's width and no more. */
	/* Everything else in the corner stands over the character, whose figure and glow spill out under it. */
	.hand {
		--card: 2.45rem;
		position: relative;
		z-index: 1;
		display: flex;
		width: 100%;
	}

	.tr .hand,
	.br .hand {
		justify-content: flex-end;
	}

	/* A pile per group: the top card's face, with a sheet peeking above it for each card beneath. */
	.mini {
		position: relative;
		flex: none;
		width: var(--card);
		height: 3.6rem;
		padding: 0;
		border: 0;
		background: none;
		color: var(--ink);
		cursor: pointer;
		transition: translate 160ms ease;
	}

	.mini.arriving {
		visibility: hidden;
	}

	.mini + .mini {
		margin-left: min(0.3rem, calc((100% - var(--n) * var(--card)) / max(1, var(--n) - 1)));
	}

	.mini:hover,
	.mini:focus-visible {
		z-index: 2;
		translate: 0 -0.3rem;
	}

	.tl .mini:hover,
	.tr .mini:hover,
	.tl .mini:focus-visible,
	.tr .mini:focus-visible {
		translate: 0 0.3rem;
	}

	.face,
	.sheet {
		position: absolute;
		inset: 0;
		border: 1px solid rgb(20 12 4 / 0.45);
		border-radius: 3px;
	}

	.sheet {
		background: color-mix(in srgb, var(--band) 78%, #140c06);
		box-shadow: 0 1px 2px rgb(20 12 4 / 0.3);
		translate: calc(var(--depth) * 1px) calc(var(--depth) * -3px);
	}

	.tl .sheet,
	.tr .sheet {
		translate: calc(var(--depth) * 1px) calc(var(--depth) * 3px);
	}

	.face {
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.15rem;
		background:
			radial-gradient(ellipse at 30% 0%, rgb(255 248 228 / 0.22), transparent 70%),
			linear-gradient(172deg, var(--band), color-mix(in srgb, var(--band) 80%, #140c06));
		box-shadow:
			inset 0 0 0 2px rgb(255 248 228 / 0.14),
			-2px 0 4px rgb(20 12 4 / 0.25),
			0 2px 3px rgb(20 12 4 / 0.3);
	}

	.face b {
		font-family: var(--font-display);
		font-size: 1.45rem;
		font-weight: 400;
		line-height: 1;
	}

	/* The emblem on the card's face, inked in the pile's colour like an icon. */
	.face .art {
		width: 1.6rem;
		height: 1.6rem;
		background: currentColor;
		mask: var(--art) center / contain no-repeat;
	}

	.face em {
		font-size: 0.8rem;
		font-style: normal;
		font-weight: 700;
		line-height: 1;
	}

	.bubbles {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		width: 19.5rem;
		max-width: 24vw;
		pointer-events: none;
	}

	.bubbles > :global(*) {
		pointer-events: auto;
	}

	.tr .bubbles,
	.br .bubbles {
		align-items: flex-end;
	}

	.tl .bubbles,
	.bl .bubbles {
		align-items: flex-start;
	}
</style>
