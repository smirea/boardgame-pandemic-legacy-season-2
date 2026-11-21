<script lang="ts">
	import { getContext } from 'svelte';
	import type { CardId } from '@repo/game';
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack, SEAT_IDS } from '@repo/game';
	import type { PlayerDeckKind, SeatId, World } from '@repo/game';
	import { inkOn } from '#lib/color.ts';
	import Bubble from '#lib/replay/Bubble.svelte';
	import type { SaidNote } from '#lib/replay/replay.svelte.ts';
	import { flip } from 'svelte/animate';
	import { cubicIn, cubicOut } from 'svelte/easing';
	import { fly, scale } from 'svelte/transition';
	import { CITY_COLOR } from '#lib/board/CityMarker.svelte';
	import CardIcon from '#lib/cards/CardIcon.svelte';
	import { SCAR_ICON } from '#lib/cards/icons.ts';
	import { deal } from './deal.ts';
	import { handGroups } from './handGroups.ts';
	import { sortHand } from './handOrder.ts';
	import { cardName } from './labels.svelte.ts';
	import PlayerCard, { KIND_COLOR } from './PlayerCard.svelte';
	import Portrait from './Portrait.svelte';
	import type { Place } from './seats.ts';
	import { characterTraits, TRAIT_KIND } from './traits.ts';
	import { turnSteps } from './turn.ts';

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
		/** What clicking the card does, as its tooltip. */
		action: string;
		/** Shown while selected, beside the name. */
		selectedTag?: string;
		onselect: () => void;
		onnote?: (note: SaidNote) => void;
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
	}: Props = $props();

	const game = $derived(world.game);
	const player = $derived(game?.players[seat]);
	const character = $derived(player ? world.campaign.characters[player.character] : undefined);
	const job = $derived(pack.jobs.find(candidate => candidate.id === character?.job));
	const active = $derived(game !== null && game.active === seat && !game.outcome);
	const top = $derived(place === 'tl' || place === 'tr');
	const right = $derived(place === 'tr' || place === 'br');

	const traits = $derived(character ? characterTraits(character) : []);

	const named = (card: { id: CardId }) => cardName(world, card.id);
	const hand = $derived(
		sortHand(
			(player?.hand ?? []).flatMap(id => world.campaign.playerCards[id] ?? []),
			named,
		),
	);
	const groups = $derived(handGroups(hand, named));
	const toneColor = (tone: PlayerDeckKind) =>
		tone in CITY_COLOR ? CITY_COLOR[tone as keyof typeof CITY_COLOR] : KIND_COLOR[tone as keyof typeof KIND_COLOR];
	// Cards drawn this turn come from the Player deck. Anything else, such as a shared card, settles in where it lands.
	const drawnThisTurn = $derived.by(() => {
		const log = game?.log ?? [];
		const since = log.slice(log.findLastIndex(entry => entry.t === 'turn') + 1);
		return new Set(since.flatMap(entry => (entry.t === 'draw' && entry.seat === seat ? [entry.card] : [])));
	});
	const steps = $derived(active ? turnSteps(world, seat) : []);
	let reading = $state(false);

	// The whole hand opens while the pointer rests anywhere on the seat: its card or its piles. Leaving waits a beat, so
	// crossing the gap between the card and the piles does not close it.
	let spread = $state(false);
	let closing: ReturnType<typeof setTimeout> | undefined;
	const open = () => {
		clearTimeout(closing);
		spread = true;
	};
	const close = () => {
		clearTimeout(closing);
		closing = setTimeout(() => (spread = false), 160);
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
	<div
		class="seat"
		style:--seat={color}
		style:--on={inkOn(color)}
		onpointerenter={() => (reading = true)}
		onpointerleave={() => (reading = false)}
		onfocusin={() => (reading = true)}
		onfocusout={() => (reading = false)}
		role="group"
		aria-label={name}
	>
		<button
			class="slip"
			class:highlighted
			class:active
			class:selected
			onclick={onselect}
			title={action}
			aria-pressed={selected}
		>
			<span class="portrait">
				<Portrait
					portrait={character?.portrait ?? SEAT_IDS.indexOf(seat)}
					{color}
					job={character?.job}
					hooded={character?.worker ?? false}
					dead={character?.dead ?? false}
				/>
			</span>
			<span class="body">
				<span class="head">
					<strong>{name}</strong>
					{#if player}
						<span
							class="cubes"
							role="img"
							aria-label={`${player.supplies} supply cubes carried`}
							title={`${player.supplies} supply cubes carried`}
						>
							{#each { length: player.supplies } as _, index (index)}<i></i>{/each}
						</span>
					{/if}
				</span>
				{#if player && character}
					<span class="traits">
						{#each traits as trait, index (`${trait.kind}:${trait.name}:${index}`)}
							<span class="trait {trait.kind}" class:struck={trait.struck}>
								{#if trait.kind === 'scar'}<CardIcon path={SCAR_ICON} size="0.75rem" />{/if}
								<b>{trait.name}</b>
							</span>
						{/each}
					</span>
				{/if}
			</span>
		</button>

		{#if active}
			<span class="turn-rail" class:on-left={right} data-testid="current-turn-rail" aria-label="Current turn"
				>Current turn</span
			>
		{/if}

		{#if reading && traits.length}
			<!-- The whole character card, readable: beside the seat on the side facing the board. -->
			<div
				class="sheet-out"
				data-testid="character-sheet"
				{@attach feedback(undefined, () => ({
					name,
					seat,
					traits: traits.map(trait => `${trait.kind}: ${trait.name}`),
				}))}
				transition:fly={{ x: right ? 18 : -18, duration: 200, easing: cubicOut }}
			>
				{#each traits as trait, index (`${trait.kind}:${trait.name}:${index}`)}
					<div class="line {trait.kind}" class:struck={trait.struck}>
						<span class="kind">
							{#if trait.kind === 'scar'}<CardIcon path={SCAR_ICON} size="0.85rem" />{/if}
							{TRAIT_KIND[trait.kind]}{trait.struck ? ', covered by a scar' : ''}
						</span>
						<b>{trait.name}</b>
						<p>{trait.text}</p>
					</div>
				{/each}
			</div>
		{/if}
		{#if steps.length}
			<!-- The turn so far, beside the card on the side facing the board. -->
			<ol class="steps" data-testid="turn-steps">
				{#each steps as step, index (step.seq)}
					<li class={step.kind} in:fly={{ x: right ? 24 : -24, duration: 320 }} animate:flip={{ duration: 260 }}>
						<i>{index + 1}</i>
						<b>{step.name}</b>
						{#if step.detail}<span>{step.detail}</span>{/if}
					</li>
				{/each}
			</ol>
		{/if}
	</div>
{/snippet}

{#snippet held()}
	{#if showHand && hand.length}
		<!-- Interchangeable cards stack into one pile, a card with its own state or ability stands alone. -->
		<div class="hand" style:--n={groups.length} data-testid="corner-hand">
			{#if spread}
				<!-- The whole hand as real cards, laid over the piles and growing away from the seat card. -->
				<div
					class="spread"
					style:--cols={Math.min(3, hand.length)}
					role="group"
					aria-label="{name}'s hand"
					data-testid="corner-full-hand"
					{@attach feedback(undefined, () => ({ name, seat, hand: hand.map(named) }))}
					transition:fly={{ y: top ? -10 : 10, duration: 180, easing: cubicOut }}
				>
					{#each hand as card (card.id)}<PlayerCard {card} onclick={onselect} />{/each}
				</div>
			{/if}
			{#each groups as group (group.key)}
				{@const color = toneColor(group.tone)}
				{@const ids = group.cards.map(card => card.id)}
				<button
					class="mini"
					onmouseenter={() => hoverCard?.(ids)}
					onmouseleave={() => hoverCard?.(null)}
					onfocus={() => hoverCard?.(ids)}
					onblur={() => hoverCard?.(null)}
					style:--band={color}
					style:--ink={inkOn(color)}
					title={group.title}
					aria-label={group.title}
					onclick={onselect}
					data-group={group.key}
					data-count={group.cards.length}
					animate:flip={{ duration: 320 }}
					in:deal={{ drawn: group.cards.some(card => drawnThisTurn.has(card.id)) }}
					out:fly={{ y: top ? 16 : -16, duration: 220, easing: cubicIn }}
				>
					{#each group.cards.slice(1) as card, index (card.id)}
						<i
							class="sheet"
							style:--depth={Math.min(index + 1, 3)}
							in:deal={{ drawn: drawnThisTurn.has(card.id) }}
							out:fly={{ y: top ? 12 : -12, duration: 220, easing: cubicIn }}
						></i>
					{/each}
					<span class="face">
						{#if group.icon}<CardIcon path={group.icon} size="0.95rem" />{/if}
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

	/* A character card laid on the table: the portrait down the left, the card's lines beside it. */
	.slip {
		display: grid;
		grid-template-columns: 4.1rem minmax(0, 1fr);
		width: 100%;
		min-height: 6.4rem;
		padding: 0;
		overflow: hidden;
		border: 0;
		border-radius: 3px;
		background:
			radial-gradient(ellipse at 15% 0%, rgb(255 248 228 / 0.2), transparent 65%),
			linear-gradient(170deg, var(--seat), color-mix(in srgb, var(--seat) 82%, #140c06));
		box-shadow: var(--slip-shadow);
		color: var(--on);
		font-family: var(--font-ui);
		text-align: left;
		cursor: pointer;
		transition:
			translate 300ms cubic-bezier(0.2, 0.9, 0.3, 1.2),
			box-shadow 300ms ease,
			opacity 250ms ease;
	}

	/* The pulse announces the turn and then rests: an animation that never ends keeps the whole screen compositing. */
	.slip.active {
		animation: active-border 2s ease-in-out 3;
		translate: 0 0.25rem;
		box-shadow:
			0 0 0 2px var(--on),
			0 1rem 2rem rgb(20 12 4 / 0.55);
	}

	.bl .slip.active,
	.br .slip.active {
		translate: 0 -0.25rem;
	}

	.slip.selected {
		outline: 2px dashed var(--seat);
		outline-offset: 3px;
	}

	.slip.highlighted {
		outline: 3px solid #f7d68b;
		outline-offset: 3px;
	}

	.turn-rail {
		position: absolute;
		top: 50%;
		left: calc(100% + 0.4rem);
		z-index: 38;
		transform: translateY(-50%);
		padding: 0.45rem 0.24rem;
		border: 1px solid rgb(247 214 139 / 0.72);
		border-radius: 3px;
		background: rgb(18 14 10 / 0.86);
		writing-mode: vertical-rl;
		text-orientation: mixed;
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #ffeaad;
		text-shadow:
			0 0 8px rgb(255 212 104 / 0.95),
			0 0 18px rgb(227 178 60 / 0.75);
		box-shadow:
			0 0 14px rgb(227 178 60 / 0.55),
			0 0.35rem 0.9rem rgb(0 0 0 / 0.55);
		pointer-events: none;
		user-select: none;
		white-space: nowrap;
		animation: turn-glow 2s ease-in-out 3;
	}

	.turn-rail.on-left {
		left: auto;
		right: calc(100% + 0.4rem);
		transform: translateY(-50%) rotate(180deg);
	}

	@keyframes turn-glow {
		50% {
			color: #fff7dc;
			border-color: rgb(255 232 166 / 0.95);
			text-shadow:
				0 0 12px rgb(255 224 128 / 1),
				0 0 26px rgb(227 178 60 / 0.95);
			box-shadow:
				0 0 22px rgb(255 208 86 / 0.85),
				0 0.35rem 0.9rem rgb(0 0 0 / 0.55);
		}
	}

	.portrait {
		position: relative;
		display: block;
		min-height: 100%;
		border-right: 1px solid rgb(20 12 4 / 0.35);
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
		padding: 0.4rem 0.55rem 0.45rem;
	}

	.head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 1.35rem;
	}

	strong {
		overflow: hidden;
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 400;
		line-height: 1;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Keep even a full reserve of carried cubes beside the name. */
	.cubes {
		display: flex;
		flex: none;
		flex-wrap: wrap;
		justify-content: flex-end;
		max-width: 3.75rem;
		gap: 2px;
		margin-left: auto;
	}

	@keyframes active-border {
		50% {
			box-shadow:
				0 0 0 3px var(--on),
				0 0 1rem var(--seat);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.slip.active {
			animation: none;
		}
	}

	.cubes i {
		flex: none;
		width: 0.5rem;
		height: 0.5rem;
		border: 1px solid rgb(20 12 4 / 0.55);
		border-radius: 1px;
		background: conic-gradient(from 30deg at 50% 35%, #b1a38a 0deg 120deg, #e0d5bb 120deg 240deg, #fff5dc 240deg);
		clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
		box-shadow: 0 1px 0 rgb(20 12 4 / 0.35);
	}

	.traits {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.trait {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		overflow: hidden;
		padding: 0.05rem 0.3rem;
		border-left: 2px solid color-mix(in srgb, var(--on) 45%, transparent);
		background: color-mix(in srgb, var(--on) 10%, transparent);
		font-size: 0.72rem;
		line-height: 1.35;
		white-space: nowrap;
	}

	.trait b {
		overflow: hidden;
		color: var(--on);
		font-weight: 700;
		text-overflow: ellipsis;
	}

	.trait.struck b {
		text-decoration: line-through;
	}

	.trait.scar {
		border-left-color: #1d140d;
		background: rgb(20 10 6 / 0.3);
	}

	/* Above the turn's steps, which sit on the same side, while the pointer rests on the card. */
	.sheet-out {
		position: absolute;
		top: 0;
		left: calc(100% + 0.5rem);
		z-index: 20;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		width: 20rem;
		max-width: calc(50vw - 100% - 1rem);
		padding: 0.6rem 0.75rem 0.7rem;
		border-left: 4px solid var(--seat);
		border-radius: 3px;
		background: rgb(240 231 210 / 0.97);
		box-shadow: var(--slip-shadow);
		color: var(--slip-ink);
		pointer-events: none;
	}

	.tr .sheet-out,
	.br .sheet-out {
		right: calc(100% + 0.5rem);
		left: auto;
	}

	.bl .sheet-out,
	.br .sheet-out {
		top: auto;
		bottom: 0;
	}

	.line .kind {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		color: rgb(42 32 23 / 0.6);
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.line.scar .kind {
		color: #8a2a1c;
	}

	.line b {
		display: block;
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 400;
		line-height: 1.15;
	}

	.line.struck b {
		text-decoration: line-through;
	}

	.line p {
		margin: 0.1rem 0 0;
		font-size: 0.86rem;
		line-height: 1.35;
	}

	/* The active player's turn so far, floating beside the card toward the board. */
	.steps {
		position: absolute;
		top: 0;
		left: calc(100% + 0.5rem);
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
		right: calc(100% + 0.5rem);
		left: auto;
		align-items: flex-end;
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
		padding: 0.22rem 0.55rem 0.24rem 0.3rem;
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

	.steps i {
		min-width: 1rem;
		color: rgb(42 32 23 / 0.55);
		font-style: normal;
		font-weight: 700;
		text-align: center;
	}

	.steps b {
		font-weight: 700;
	}

	.steps span {
		color: rgb(42 32 23 / 0.75);
	}

	/* Mini cards overlap just enough that the whole hand spans the card's width and no more. */
	.hand {
		--card: 2.45rem;
		position: relative;
		display: flex;
		width: 100%;
	}

	/* Three real cards to a row, as wide as the seat, so it stays clear of the character sheet beside the card. */
	.spread {
		--card-size: 0.6rem;
		position: absolute;
		bottom: -0.35rem;
		left: -0.35rem;
		z-index: 10;
		display: grid;
		grid-template-columns: repeat(var(--cols), max-content);
		gap: 0.35rem;
		padding: 0.35rem;
		border-radius: 4px;
		background: rgb(20 12 4 / 0.6);
		box-shadow: var(--slip-shadow);
	}

	.tl .spread,
	.tr .spread {
		top: -0.35rem;
		bottom: auto;
	}

	.tr .spread,
	.br .spread {
		right: -0.35rem;
		left: auto;
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

	.face em {
		font-size: 0.8rem;
		font-style: normal;
		font-weight: 700;
		line-height: 1;
	}

	.bubbles {
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
