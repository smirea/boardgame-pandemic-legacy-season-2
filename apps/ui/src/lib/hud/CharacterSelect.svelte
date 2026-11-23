<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { claimant, pack, reject, SEAT_IDS, tablePlayers, tableStart } from '@repo/game';
	import type { Character, CityId, Command, PlayerId, PublicState } from '@repo/game';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import CharacterSheet from './characters/CharacterSheet.svelte';
	import Creator from './characters/Creator.svelte';
	import { cityName, MONTHS, SEAT_COLORS } from './labels.svelte.ts';
	import Ready from './Ready.svelte';

	type Props = {
		snap: PublicState;
		player: PlayerId;
		send: (command: Command) => void;
		/** Renames this player wherever they sit, and keeps the name for next time. */
		rename: (name: string) => void;
		/** A haven to look at on the map behind the screen, with the point in the window it should land on. */
		onfocus: (focus: { city: CityId; x: number; y: number } | null) => void;
	};

	let { snap, player, send, rename, onfocus }: Props = $props();

	const world = $derived(snap.world);
	const campaign = $derived(world.campaign);
	const table = $derived(world.table);
	const players = $derived(tablePlayers(table));
	const living = $derived(Object.values(campaign.characters).filter(character => !character.dead && !character.worker));
	// Your own characters first, then the ones others took, then the free ones.
	const shown = $derived(
		living.toSorted((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id, undefined, { numeric: true })),
	);
	function rank(character: Character) {
		const holder = claimant(world, character.id);
		return holder === player ? 0 : holder ? 1 : 2;
	}
	const fallen = $derived(Object.values(campaign.characters).filter(character => character.dead && !character.worker));
	const nameOf = (who: PlayerId) => table.seats.find(entry => entry.player === who)?.name ?? '';
	const seatsOf = (who: PlayerId) => table.seats.filter(entry => entry.player === who).map(entry => entry.seat);
	const claimedBy = (who: PlayerId) => living.filter(character => claimant(world, character.id) === who);
	const seatColor = (who: PlayerId, index: number) => {
		const seat = seatsOf(who)[index];
		return seat ? SEAT_COLORS[SEAT_IDS.indexOf(seat)]! : null;
	};

	/** The colour a claimed character plays in: a player's characters go to their seats in order, as the deal does. */
	function colorFor(character: Character): string | null {
		const holder = claimant(world, character.id);
		return holder ? seatColor(holder, claimedBy(holder).indexOf(character)) : null;
	}
	const choosing = $derived(players.filter(who => claimedBy(who).length < seatsOf(who).length));
	const mine = $derived(claimedBy(player));

	// One screen can play several characters: each seat this player holds is one more hand.
	const hands = $derived(seatsOf(player).length);
	const addHand: Command = $derived({ type: 'ADD_SEAT', player });
	const cannotAdd = $derived(reject(world, snap.phase, addHand));
	function dropHand() {
		const seat = seatsOf(player).at(-1);
		if (hands < 2 || !seat) return;
		if (mine.length >= hands) release(mine.at(-1)!);
		send({ type: 'LEAVE', player, seat });
	}

	const start = $derived(tableStart(world)!);
	const title = $derived(start === 'prologue' ? 'Prologue' : MONTHS[Math.max(1, campaign.month)]!);
	const readyRefusal = $derived(reject(world, snap.phase, { type: 'READY', player, start }));
	const waitingOn = $derived(
		players.filter(who => !table.ready[who]).map(who => (who === player ? 'you' : nameOf(who))),
	);

	function take(character: Character) {
		const holder = claimant(world, character.id);
		if (holder && holder !== player) return;
		send({ type: 'CLAIM', player, character: holder === player ? null : character.id });
	}
	// Letting go of one of several characters goes through the claim rules: take the others again.
	// Kept is read before sending: on one screen the first CLAIM lands at once and empties `mine`.
	function release(character: Character) {
		const kept = mine.filter(other => other.id !== character.id);
		send({ type: 'CLAIM', player, character: null });
		for (const other of kept) send({ type: 'CLAIM', player, character: other.id });
	}

	// The table names its havens in the lobby, the starting three before the first game, as the box asks.
	const canRename = (city: CityId) =>
		reject(world, snap.phase, { type: 'RENAME_HAVEN', city, name: cityName(city) }) === null;
	const renameHaven = (city: CityId, name: string) => send({ type: 'RENAME_HAVEN', city, name });

	function renamed(event: Event & { currentTarget: HTMLInputElement }) {
		const name = event.currentTarget.value.trim();
		if (name && name !== nameOf(player)) rename(name);
		else event.currentTarget.value = nameOf(player);
	}

	// Every starting occupation taken leaves nothing to make: the blank card stays off the table.
	const canMake = $derived(
		pack.jobs.some(
			job =>
				(job.starting || campaign.jobsFound.some(entry => entry.job === job.id)) &&
				!living.some(character => character.job === job.id),
		) && campaign.characterCards.length > 0,
	);
	const count = $derived(shown.length + (canMake ? 1 : 0));

	// Cards keep one shape and grow to fill the table: the column count is whichever makes them largest.
	const RATIO = 1.2;
	const GAP = 12;
	let stage = $state<HTMLElement>();
	let room = $state({ width: 0, height: 0 });
	$effect(() => {
		const element = stage;
		if (!element) return;
		const observer = new ResizeObserver(() => (room = { width: element.clientWidth, height: element.clientHeight }));
		observer.observe(element);
		return () => observer.disconnect();
	});
	const cardHeight = $derived.by(() => {
		let best = 0;
		for (let cols = 1; cols <= Math.max(1, count); cols++) {
			const rows = Math.ceil(count / cols);
			const height = Math.min((room.height - GAP * (rows - 1)) / rows, (room.width - GAP * (cols - 1)) / cols / RATIO);
			best = Math.max(best, height);
		}
		return Math.floor(best);
	});

	// While a haven is being picked, the other cards step aside and the map behind finds it beside the blank card.
	let picking = $state(false);
	let creator = $state<HTMLElement>();
	function look(city: CityId | null) {
		if (!city || !stage || !creator) return onfocus(null);
		const area = stage.getBoundingClientRect();
		const card = creator.getBoundingClientRect();
		const left = (card.left - area.left) * area.height;
		const above = (card.top - area.top) * area.width;
		onfocus(
			left >= above
				? { city, x: (area.left + card.left) / 2, y: area.top + area.height / 2 }
				: { city, x: area.left + area.width / 2, y: (area.top + card.top) / 2 },
		);
	}
	$effect(() => () => onfocus(null));
</script>

{#snippet pawn(color: string)}
	<!-- The pawn this player moves on the board, in their colour. -->
	<svg class="pawn" viewBox="0 0 20 28" style:--seat={color} aria-hidden="true">
		<circle cx="10" cy="6.5" r="5" />
		<path d="M10 11.5c-4 0-6.5 4.5-6.5 9.5v1.5h13V21c0-5-2.5-9.5-6.5-9.5z" />
		<rect x="1.5" y="22.5" width="17" height="4" rx="1.5" />
	</svg>
{/snippet}

{#snippet you(color: string)}
	<!-- Your own name, written where it shows: click it to change it. -->
	{@render pawn(color)}
	<label class="me">
		<input
			value={nameOf(player)}
			maxlength="24"
			aria-label="Your name"
			onchange={renamed}
			onkeydown={event => {
				if (event.key === 'Enter') event.currentTarget.blur();
				if (event.key === 'Escape') {
					event.currentTarget.value = nameOf(player);
					event.currentTarget.blur();
				}
			}}
			data-testid="my-name"
		/><span>(you)</span>
		<svg class="pen" viewBox="0 0 16 16" aria-hidden="true"><path d="M11.3 1.7l3 3-8.6 8.6-3.8.8.8-3.8z" /></svg>
	</label>
{/snippet}

<div
	class="select"
	class:picking
	data-testid="character-select"
	{@attach feedback('Character select', () => ({
		month: campaign.month,
		claims: living.map(character => ({ character: character.name, by: claimant(world, character.id) })),
		ready: table.ready,
	}))}
>
	<div class="stage" bind:this={stage}>
		<div class="cards" style:--card-h={`${cardHeight}px`} style:--ratio={RATIO} style:--gap={`${GAP}px`}>
			{#each shown as character, index (character.id)}
				{@const holder = claimant(world, character.id)}
				{@const color = colorFor(character)}
				<div class="slot" animate:flip={{ duration: 300 }} in:fly={{ y: 30, duration: 420, delay: index * 70 }}>
					<CharacterSheet
						{character}
						tone={holder === player ? 'mine' : holder ? 'taken' : 'free'}
						{color}
						toggle={() => (holder === player ? release(character) : take(character))}
						{canRename}
						rename={renameHaven}
					>
						{#snippet owner()}
							{@const who = claimant(world, character.id)}
							{#key who}
								<span class="who" in:fly={{ y: 8, duration: 220 }}>
									{#if who && color}
										{#if who === player}
											{@render you(color)}
										{:else}
											{@render pawn(color)}<b>{nameOf(who)}</b>
										{/if}
									{:else}
										<span class="free">Free to take</span>
									{/if}
								</span>
							{/key}
						{/snippet}
					</CharacterSheet>
				</div>
			{/each}
			{#if canMake}
				<div class="slot new" bind:this={creator} in:fly={{ y: 30, duration: 420, delay: shown.length * 70 }}>
					<Creator
						{snap}
						{player}
						{send}
						color={seatColor(player, mine.length)}
						{canRename}
						rename={renameHaven}
						{look}
						bind:picking
					/>
				</div>
			{/if}
		</div>
	</div>

	<footer>
		<div class="status">
			<h1><span>Choose your characters</span> {title}</h1>
			{#if hands > 0}
				<div class="hands" role="group" aria-label="Characters played on this screen">
					<span>Characters on this screen</span>
					<button onclick={dropHand} disabled={hands < 2} aria-label="One character fewer" data-testid="hand-fewer"
						>−</button
					>
					<b aria-live="polite">{hands}</b>
					<button
						onclick={() => send(addHand)}
						disabled={cannotAdd !== null}
						aria-label="One more character"
						data-testid="hand-more">+</button
					>
				</div>
			{/if}
			{#if choosing.length}
				<p class="choosing">
					Still choosing:
					{#each choosing as who (who)}
						{@const color = seatColor(who, 0)!}
						<span class="who">
							{#if who === player}{@render you(color)}{:else}{@render pawn(color)}<b>{nameOf(who)}</b>{/if}
						</span>
					{/each}
				</p>
			{/if}
			{#if fallen.length}
				<p class="fallen">
					Fallen: {fallen
						.map(character => `${character.name}${character.diedAt ? `, ${cityName(character.diedAt)}` : ''}`)
						.join('; ')}
				</p>
			{/if}
		</div>
		<div class="starts">
			<Ready
				{table}
				{player}
				{send}
				{start}
				label={`Ready for ${title}`}
				disabled={!table.ready[player] && readyRefusal !== null}
			/>
		</div>
		<p class="hint" aria-live="polite">
			{#if table.seats.length < 2}
				A game needs two seats.
			{:else if mine.length < hands}
				Pick or create {hands - mine.length === 1 ? 'a character' : `${hands - mine.length} characters`} before readying up.
			{:else if choosing.length}
				Waiting for {choosing.map(nameOf).join(', ')} to pick a character.
			{:else if waitingOn.length}
				Waiting for {waitingOn.join(', ')}.
				{#if waitingOn.includes('you')}
					Taking or making a character asks everyone to ready again.
				{/if}
			{:else}
				Starting.
			{/if}
		</p>
	</footer>
</div>

<style>
	.select {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		width: 100%;
		height: 100%;
		padding: 0.5rem 1rem 0.6rem;
		/* No card has a face, so the table under them is darkened at the edges and left clear in the middle. */
		background:
			radial-gradient(ellipse 80% 75% at 50% 48%, rgb(12 10 9 / 0.62), rgb(8 7 6 / 0.88)),
			linear-gradient(180deg, rgb(8 7 6 / 0.5), transparent 18%, transparent 80%, rgb(8 7 6 / 0.6));
		backdrop-filter: blur(3px) saturate(0.7);
		color: #f4ead6;
		text-shadow:
			0 0 0.4rem rgb(0 0 0 / 0.9),
			0 1px 2px rgb(0 0 0 / 0.9);
		overflow: hidden;
		transition:
			background 300ms ease,
			backdrop-filter 300ms ease;
	}

	/* Picking a haven lifts the dark off the table, so the map can show where it is. */
	.select.picking {
		background: transparent;
		backdrop-filter: none;
	}

	h1 {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin: 0 0 0.1rem;
		color: #f6ebd4;
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 400;
		line-height: 1;
	}

	h1 span {
		color: #d6b66f;
		font-family: var(--font-ui);
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	.stage {
		flex: 1 1 auto;
		min-height: 0;
	}

	.cards {
		display: flex;
		flex-wrap: wrap;
		align-content: center;
		justify-content: center;
		gap: var(--gap);
		height: 100%;
	}

	.slot {
		flex: none;
		width: calc(var(--card-h) * var(--ratio));
		height: var(--card-h);
		transition: opacity 260ms ease;
	}

	.picking .slot:not(.new) {
		opacity: 0.08;
		pointer-events: none;
	}

	.who {
		display: inline-flex;
		align-items: flex-end;
		gap: 0.3em;
		white-space: nowrap;
	}

	.who b {
		font-weight: 700;
	}

	.free {
		color: #b7a98e;
		font-style: italic;
	}

	.pawn {
		width: 0.9em;
		height: 1.2em;
		flex: none;
		fill: var(--seat);
		filter: drop-shadow(0 2px 2px rgb(0 0 0 / 0.6));
	}

	.me {
		display: inline-flex;
		align-items: baseline;
		gap: 0.2em;
		cursor: text;
	}

	/* Reads as the name itself until it is clicked. */
	.me input {
		field-sizing: content;
		min-width: 2ch;
		max-width: 9em;
		padding: 0 0.15em;
		border: 0;
		border-bottom: 1px dashed transparent;
		background: none;
		color: inherit;
		font: inherit;
		font-weight: 700;
		text-shadow: inherit;
	}

	.me:hover input,
	.me input:focus {
		border-bottom-color: #b7a98e;
		outline: none;
	}

	.me span {
		color: #b7a98e;
	}

	.pen {
		width: 0.7em;
		height: 0.7em;
		fill: #b7a98e;
		opacity: 0.6;
	}

	.me:hover .pen,
	.me:focus-within .pen {
		opacity: 1;
	}

	/* What moves the table on: who is still choosing, and the vote in the middle. */
	footer {
		display: grid;
		flex: none;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 0.8rem;
		padding-top: 0.4rem;
		border-top: 1px solid rgb(231 220 198 / 0.18);
	}

	.status {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-size: 0.74rem;
	}

	.hands {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		color: #b7a98e;
	}

	.hands b {
		min-width: 1ch;
		color: #f4ead6;
		text-align: center;
	}

	.hands button {
		width: 1.3rem;
		height: 1.3rem;
		padding: 0;
		border: 1px solid rgb(231 220 198 / 0.28);
		border-radius: 3px;
		background: rgb(255 255 255 / 0.04);
		color: #f4ead6;
		font: inherit;
		line-height: 1;
		cursor: pointer;
	}

	.hands button:hover:not(:disabled) {
		border-color: rgb(231 220 198 / 0.65);
	}

	.hands button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.choosing {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.45rem;
		margin: 0;
		color: #b7a98e;
	}

	.choosing .who {
		color: #f4ead6;
	}

	.fallen {
		margin: 0;
		color: #b7a98e;
	}

	.starts {
		display: flex;
		gap: 0.8rem;
	}

	.hint {
		justify-self: end;
		margin: 0;
		color: #b7a98e;
		font-size: 0.74rem;
		text-align: right;
	}
</style>
