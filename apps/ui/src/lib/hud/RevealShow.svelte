<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack, revealDone, revealOutcome, searchFind, REVEAL_COUNT } from '@repo/game';
	import type { CardId, Command, Decision, World } from '@repo/game';
	import { backOut } from 'svelte/easing';
	import { scale } from 'svelte/transition';
	import { inkOn } from '#lib/color.ts';
	import { onButton, typing } from '#lib/keys.ts';
	import { cardName, cityName, seatName, SEAT_COLORS } from './labels.svelte.ts';
	import PlayerCard from './PlayerCard.svelte';

	type Props = {
		world: World;
		pending: Extract<Decision, { t: 'reveal' | 'search' }>;
		/** Whether this screen moves the reveal on. Everyone else watches it move. */
		mine: boolean;
		send: (command: Command) => void;
	};

	let { world, pending, mine, send }: Props = $props();

	const game = $derived(world.game!);
	const who = $derived(seatName(world, pending.seat));
	const color = $derived(SEAT_COLORS[game.seats.indexOf(pending.seat)] ?? '#f4e8cd');

	const reveal = $derived(pending.t === 'reveal' ? pending : null);
	const done = $derived(reveal ? revealDone(game, reveal) : true);
	const outcome = $derived(reveal && done ? revealOutcome(world, reveal) : null);
	/** Face-down places for the cards still to come, so the table sees how many are left to turn. */
	const slots = $derived.by(() => {
		if (!reveal) return [];
		const left = Math.min(REVEAL_COUNT - reveal.cards.length, game.playerDeck.order.length);
		return [...reveal.cards, ...Array.from({ length: left }, () => null)] as (CardId | null)[];
	});

	const searched = $derived.by(() => {
		if (pending.t !== 'search') return null;
		const card = world.campaign.playerCards[pending.card];
		if (card?.kind !== 'city') return null;
		const box = card.search[pending.box]!;
		return {
			card,
			box: pending.box,
			city: cityName(card.city),
			sea: box.scope === 'sea',
			found: searchFind(box.result),
		};
	});

	const reward = $derived(reveal?.by.t === 'monitor' ? pack.frequencies[reveal.by.frequency] : undefined);
	const title = $derived(
		reveal
			? reveal.by.t === 'monitor'
				? `Monitor · ${pack.frequencyLabels[reveal.by.frequency]}`
				: 'Cautious Approach'
			: searched
				? `${searched.sea ? 'Searched the sea at' : 'Searched'} ${searched.city}`
				: 'Search',
	);
	const rule = $derived(
		reveal?.by.t === 'monitor'
			? 'The top 4 Player cards are turned over and discarded. An Epidemic among them has no effect.'
			: reveal
				? 'The top 4 Player cards are turned over. City cards go to the hand, the rest are discarded with no effect.'
				: '',
	);
	const verdict = $derived.by(() => {
		if (!outcome || !reveal) return '';
		const names = (cards: CardId[]) => cards.map(id => cardName(world, id)).join(', ');
		if (reveal.by.t === 'monitor') {
			if (reward && 'seal' in reward) return 'Something answers on this frequency. It is unpacked next.';
			if (!outcome.keep.length) return 'Nothing on this frequency to keep.';
			return `${who} keeps ${names(outcome.keep)}.`;
		}
		return outcome.keep.length ? `${who} keeps ${names(outcome.keep)}.` : 'No City cards to keep.';
	});

	const next = $derived(
		reveal
			? done
				? outcome?.keep.length
					? 'Take them and discard the rest'
					: 'Discard them'
				: `Turn over card ${reveal.cards.length + 1}`
			: 'Continue',
	);
	const waiting = $derived(
		reveal && !done ? `Waiting for ${who} to turn over the next card` : `Waiting for ${who} to continue`,
	);

	// The click that turned the last card must not land on the button that now puts them away.
	let busy = $state(false);
	function advance() {
		if (!mine || busy) return;
		busy = true;
		send({ type: 'DECIDE', decide: { d: pending.t } });
		setTimeout(() => (busy = false), 350);
	}
</script>

<svelte:window
	onkeydown={event => {
		if (!mine || event.key !== ' ' || typing(event) || onButton(event)) return;
		event.preventDefault();
		if (!event.repeat) advance();
	}}
/>

<!--
	What a Monitor, a Cautious Approach or a search turns over is hidden until that moment, so the whole table watches
	it happen in front of the board. Each card is turned by a command, and only the player it belongs to moves it on.
-->
<section
	class="reveal"
	style:--seat={color}
	style:--on={inkOn(color)}
	aria-label={`${who}: ${title}`}
	in:scale={{ start: 0.85, duration: 380, easing: backOut }}
	{@attach feedback('Reveal', () => ({ who, kind: pending.t, cards: reveal?.cards, done }))}
>
	<header>
		<span class="who">{who}</span>
		<h2>{title}</h2>
	</header>

	{#if reveal}
		<p class="rule">{rule}</p>
		<ol class="cards" data-testid="reveal-cards">
			{#each slots as id, index (index)}
				{@const card = id ? world.campaign.playerCards[id] : null}
				{@const kept = id !== null && (outcome?.keep.includes(id) ?? false)}
				<li class:up={card !== null} class:kept class:dropped={outcome !== null && !kept}>
					<span class="flip">
						<span class="back" aria-hidden="true"><span>Player</span></span>
						<span class="face">
							{#if card}<PlayerCard {card} />{/if}
						</span>
					</span>
					{#if outcome && id}
						<span class="fate">{kept ? 'To hand' : card?.kind === 'epidemic' ? 'No effect' : 'Discard'}</span>
					{/if}
				</li>
			{/each}
		</ol>
		{#if outcome}<p class="verdict" data-testid="reveal-verdict">{verdict}</p>{/if}
	{:else if searched}
		<div class="search">
			<span class="searched"><PlayerCard card={searched.card} revealing={searched.box} /></span>
			<div class="found">
				<span class="kicker">Found</span>
				<strong data-testid="search-found">{searched.found}</strong>
			</div>
		</div>
	{/if}

	<footer>
		{#if mine}
			<!-- svelte-ignore a11y_autofocus -->
			<button type="button" class="go" data-testid="reveal-next" autofocus disabled={busy} onclick={advance}>
				{next}
			</button>
			<span class="key">Space</span>
		{:else}
			<p class="waiting">{waiting}.</p>
		{/if}
	</footer>
</section>

<style>
	.reveal {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.9rem;
		max-width: min(46rem, 100%);
		padding: 1.1rem 1.4rem 1.2rem;
		border: 1px solid color-mix(in srgb, var(--seat) 70%, var(--line));
		border-radius: 0.6rem;
		background: var(--panel-solid);
		box-shadow:
			0 0 0 1px rgb(0 0 0 / 0.3),
			0 1.4rem 3rem rgb(0 0 0 / 0.5);
	}

	header {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}

	h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	.who {
		padding: 0.1rem 0.5rem;
		border-radius: 0.25rem;
		background: var(--seat);
		color: var(--on);
		font-weight: 800;
	}

	.rule,
	.waiting,
	.verdict {
		margin: 0;
		max-width: 36rem;
		text-align: center;
	}

	.rule,
	.waiting {
		color: var(--muted);
		font-size: 0.86rem;
	}

	.verdict {
		font-size: 1.05rem;
		font-weight: 700;
		animation: arrive 400ms ease-out both;
	}

	.cards {
		display: flex;
		gap: 0.9rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.cards li {
		--card-size: 0.95rem;
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		perspective: 60rem;
		transition:
			transform 320ms ease,
			opacity 320ms ease;
	}

	.flip {
		position: relative;
		display: grid;
		font-size: var(--card-size);
		transform-style: preserve-3d;
		transition: transform 650ms cubic-bezier(0.3, 0.7, 0.3, 1);
	}

	.back,
	.face {
		grid-area: 1 / 1;
		backface-visibility: hidden;
	}

	.face {
		transform: rotateY(180deg);
		pointer-events: none;
	}

	.back {
		display: grid;
		place-items: center;
		width: 8.4em;
		height: 10.6em;
		border: 1px solid #2e2820;
		border-radius: 0.4em;
		background:
			radial-gradient(ellipse at 30% 10%, rgb(255 248 228 / 0.14), transparent 60%),
			linear-gradient(172deg, #5d5446, #3d362c);
		box-shadow: inset 0 0 0 0.3em rgb(255 248 228 / 0.1);
	}

	.back span {
		font-size: 0.8em;
		font-weight: 800;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		opacity: 0.55;
	}

	.up .flip {
		transform: rotateY(180deg);
	}

	.kept {
		transform: translateY(-0.5rem);
	}

	.dropped {
		opacity: 0.55;
	}

	.fate {
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		animation: arrive 300ms ease-out both;
	}

	.kept .fate {
		color: var(--good, #8fc77a);
	}

	.search {
		display: flex;
		align-items: center;
		gap: 1.2rem;
	}

	.searched {
		--card-size: 1.25rem;
		pointer-events: none;
	}

	.found {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		max-width: 16rem;
	}

	.kicker {
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		opacity: 0.7;
	}

	.found strong {
		font-size: 1.35rem;
		line-height: 1.25;
		animation: arrive 500ms 900ms ease-out both;
	}

	footer {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-height: 2.2rem;
	}

	.go {
		padding: 0.5rem 1.1rem;
		border: 1px solid color-mix(in srgb, var(--seat) 70%, #000);
		border-radius: 0.35rem;
		background: var(--seat);
		color: var(--on);
		font: inherit;
		font-weight: 800;
		cursor: pointer;
	}

	.go:disabled {
		opacity: 0.7;
		cursor: default;
	}

	.key {
		padding: 0.05rem 0.4rem;
		border: 1px solid var(--line);
		border-radius: 0.2rem;
		color: var(--muted);
		font-size: 0.72rem;
	}

	@keyframes arrive {
		from {
			opacity: 0;
			transform: translateY(0.3rem);
		}
	}
</style>
