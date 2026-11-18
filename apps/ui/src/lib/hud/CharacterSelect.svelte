<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { claimant, pack, reject, SEAT_IDS, tablePlayers, tableStart } from '@repo/game';
	import type { Character, CharacterId, CityId, Command, JobId, PlayerId, PublicState } from '@repo/game';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import CardIcon from '#lib/cards/CardIcon.svelte';
	import { SCAR_ICON } from '#lib/cards/icons.ts';
	import { LS } from '#lib/storage.ts';
	import { cityName, MONTHS, SEAT_COLORS } from './labels.svelte.ts';
	import Portrait from './Portrait.svelte';
	import Ready from './Ready.svelte';
	import { characterTraits, TRAIT_KIND } from './traits.ts';

	type Props = {
		snap: PublicState;
		player: PlayerId;
		send: (command: Command) => void;
		rename: (name: string) => void;
		onpeek: () => void;
	};

	let { snap, player, send, rename, onpeek }: Props = $props();

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

	/** The colour a claimed character plays in: a player's characters go to their seats in order, as the deal does. */
	function colorFor(character: Character): string | null {
		const holder = claimant(world, character.id);
		if (!holder) return null;
		const seat = seatsOf(holder)[claimedBy(holder).indexOf(character)];
		return seat ? SEAT_COLORS[SEAT_IDS.indexOf(seat)]! : null;
	}
	const choosing = $derived(players.filter(who => claimedBy(who).length < seatsOf(who).length));
	const mine = $derived(claimedBy(player));

	const start = $derived(tableStart(world)!);
	const title = $derived(start === 'prologue' ? 'Prologue' : MONTHS[Math.max(1, campaign.month)]!);
	const waitingOn = $derived(players.filter(who => !table.ready[who]).map(nameOf));

	function take(character: Character) {
		const holder = claimant(world, character.id);
		if (holder && holder !== player) return;
		send({ type: 'CLAIM', player, character: holder === player ? null : character.id });
	}
	// Letting go of one of several characters goes through the claim rules: take the others again.
	function release(character: Character) {
		send({ type: 'CLAIM', player, character: null });
		for (const other of mine) if (other.id !== character.id) send({ type: 'CLAIM', player, character: other.id });
	}

	const freeJobs = $derived(
		pack.jobs.filter(
			job => job.starting && !Object.values(campaign.characters).some(character => character.job === job.id),
		),
	);
	const havens = pack.cities.filter(city => city.kind === 'haven' && !city.lost);
	let newName = $state('');
	let job = $state<JobId | ''>('');
	let home = $state<CityId>(havens[0]!.id);
	$effect(() => {
		if (!job || !freeJobs.some(candidate => candidate.id === job)) job = freeJobs[0]?.id ?? '';
	});
	const create = $derived<Command | null>(
		job ? { type: 'CREATE_CHARACTER', name: newName.trim(), job, home, player } : null,
	);
	const refusal = $derived(create ? reject(world, snap.phase, create) : 'Every starting job is taken');

	let name = $state(LS.get('name', ''));
	let typing: ReturnType<typeof setTimeout> | undefined;
	function typed() {
		clearTimeout(typing);
		typing = setTimeout(() => name.trim() && rename(name), 450);
	}

	const exposureShown = (character: Character) =>
		character.exposureTrack.map((box, index) => (index < character.exposure ? box : 'hidden'));
</script>

{#snippet marker(color: string, label: string)}
	<!-- The pawn this player moves on the board, in their colour. -->
	<svg class="pawn" viewBox="0 0 20 28" style:--seat={color} aria-hidden="true">
		<circle cx="10" cy="6.5" r="5" />
		<path d="M10 11.5c-4 0-6.5 4.5-6.5 9.5v1.5h13V21c0-5-2.5-9.5-6.5-9.5z" />
		<rect x="1.5" y="22.5" width="17" height="4" rx="1.5" />
	</svg>
	<b>{label}</b>
{/snippet}

<div
	class="select"
	data-testid="character-select"
	{@attach feedback('Character select', () => ({
		month: campaign.month,
		claims: living.map(character => ({ character: character.name, by: claimant(world, character.id) })),
		ready: table.ready,
	}))}
>
	<header>
		<div class="heading">
			<h1>{title}</h1>
			<p>Choose who you play. Click a card to take it, click it again to let it go.</p>
		</div>
		<label class="name">
			<span>Your name</span>
			<input
				bind:value={name}
				oninput={typed}
				onchange={() => name.trim() && rename(name)}
				maxlength="24"
				placeholder="Your name"
				data-testid="lobby-name"
			/>
		</label>
	</header>

	<div class="cards">
		{#each shown as character (character.id)}
			{@const holder = claimant(world, character.id)}
			{@const color = colorFor(character)}
			{@const traits = characterTraits(character)}
			{@const empty = character.slots.filter(slot => slot === null).length}
			<article
				class="card"
				class:mine={holder === player}
				class:taken={holder !== null && holder !== player}
				style:--seat={color ?? 'transparent'}
				animate:flip={{ duration: 260 }}
			>
				<div class="claim" aria-live="polite">
					{#if holder && color}
						{#key holder}
							<span class="who" in:fly={{ y: -10, duration: 240 }}>
								{@render marker(color, holder === player ? `${nameOf(holder)} (you)` : nameOf(holder))}
							</span>
						{/key}
					{:else}
						<span class="free">Not taken</span>
					{/if}
				</div>
				<button
					class="face"
					onclick={() => (holder === player ? release(character) : take(character))}
					disabled={holder !== null && holder !== player}
					aria-pressed={holder === player}
					title={holder === player
						? 'Let this character go'
						: holder
							? `${nameOf(holder)} plays this character`
							: 'Play this character'}
					data-testid={`claim-${character.id}`}
				>
					<span class="top">
						<span class="portrait"><Portrait id={character.id} color={color ?? '#4a4238'} /></span>
						<span class="title">
							<strong>{character.name}</strong>
							<small>Home: {cityName(character.home)}</small>
						</span>
					</span>
					<span class="traits">
						{#each traits as trait (`${trait.kind}:${trait.name}`)}
							<span class="line {trait.kind}" class:struck={trait.struck}>
								<span class="kind">
									{#if trait.kind === 'scar'}<CardIcon path={SCAR_ICON} size="0.85rem" />{/if}
									{TRAIT_KIND[trait.kind]}{trait.struck ? ', covered by a scar' : ''}
								</span>
								<b>{trait.name}</b>
								<span class="text">{trait.text}</span>
							</span>
						{/each}
						{#if empty}
							<span class="slots">{empty} empty slot{empty === 1 ? '' : 's'} for abilities or scars</span>
						{/if}
					</span>
					<span class="exposure" aria-label={`Exposure ${character.exposure} of ${character.exposureTrack.length}`}>
						<span class="kind">Exposure</span>
						{#each exposureShown(character) as box, index (index)}
							<i class={box} title={box === 'hidden' ? 'Not yet scratched' : box}></i>
						{/each}
					</span>
				</button>
			</article>
		{/each}

		<article class="card new" data-testid="new-character">
			<div class="claim"><span class="free">New character</span></div>
			<form
				class="face"
				onsubmit={event => {
					event.preventDefault();
					if (create && !refusal) send(create);
					newName = '';
				}}
			>
				{#if freeJobs.length}
					<label
						>Name<input bind:value={newName} maxlength="24" placeholder="Their name" data-testid="new-name" /></label
					>
					<label
						>Occupation<select bind:value={job} data-testid="new-job">
							{#each freeJobs as option (option.id)}<option value={option.id}>{option.name}</option>{/each}
						</select></label
					>
					<p class="text">{freeJobs.find(candidate => candidate.id === job)?.text}</p>
					<label
						>Home haven<select bind:value={home}>
							{#each havens as haven (haven.id)}<option value={haven.id}>{cityName(haven.id)}</option>{/each}
						</select></label
					>
					<button class="make" disabled={refusal !== null} title={refusal ?? ''} data-testid="create-character"
						>Create and take</button
					>
				{:else}
					<p class="text">
						Every starting occupation is taken. A seat with no character left gets a haven worker when the game starts.
					</p>
				{/if}
			</form>
		</article>
	</div>

	{#if fallen.length}
		<p class="fallen">
			Fallen: {fallen
				.map(character => `${character.name}${character.diedAt ? `, ${cityName(character.diedAt)}` : ''}`)
				.join('; ')}
		</p>
	{/if}

	<footer>
		<div class="status">
			{#if choosing.length}
				<p class="choosing">
					Still choosing:
					{#each choosing as who (who)}
						<span class="who">{@render marker(SEAT_COLORS[SEAT_IDS.indexOf(seatsOf(who)[0]!)]!, nameOf(who))}</span>
					{/each}
				</p>
			{/if}
			<p class="hint" aria-live="polite">
				{#if table.seats.length < 2}
					A game needs two seats.
				{:else if waitingOn.length}
					Waiting for {waitingOn.join(', ')}.
				{:else}
					Starting.
				{/if}
				{#if choosing.length}
					A player who has not chosen is dealt a free character, or a new one named after them.
				{/if}
			</p>
		</div>
		<div class="starts">
			<Ready {table} {player} {send} {start} label={`Ready for ${title}`} big />
		</div>
		<div class="side">
			<button class="peek" onclick={onpeek} data-testid="show-game">Show the board</button>
		</div>
	</footer>
</div>

<style>
	.select {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		width: 100%;
		height: 100%;
		padding: 1rem 1.6rem 1rem;
		border: 1px solid var(--line-strong);
		border-radius: 6px;
		background: rgb(20 18 14 / 0.9);
		box-shadow: 0 2rem 5rem rgb(0 0 0 / 0.6);
		color: var(--ink);
		overflow: hidden;
		animation: rise 420ms cubic-bezier(0.2, 0.9, 0.3, 1.05) both;
	}

	@keyframes rise {
		from {
			opacity: 0;
			translate: 0 2rem;
		}
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 2rem;
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 2.6rem;
		font-weight: 400;
		line-height: 1;
	}

	.heading {
		display: flex;
		align-items: baseline;
		gap: 1.2rem;
	}

	header p {
		margin: 0;
		color: var(--muted);
		font-size: 1.05rem;
	}

	.name {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		width: 18rem;
	}

	.name input {
		flex: 1;
		min-width: 0;
	}

	.name span {
		color: var(--muted);
		font-size: 0.78rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.name input {
		padding: 0.3rem 0.1rem;
		border: 0;
		border-bottom: 1px solid var(--line-strong);
		background: none;
		color: var(--ink);
		font-family: var(--font-display);
		font-size: 1.35rem;
	}

	.name input:focus {
		outline: none;
		border-bottom-color: var(--paper);
	}

	/* Every card whole and legible, wrapping into rows. A roster too long for the screen scrolls here, never the page. */
	.cards {
		display: grid;
		flex: 1 1 auto;
		grid-template-columns: repeat(auto-fill, minmax(15.5rem, 1fr));
		align-content: start;
		gap: 0.6rem 1.1rem;
		min-height: 0;
		padding: 0.2rem 0.4rem 0.6rem 0.2rem;
		overflow: hidden auto;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.claim {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		height: 2.2rem;
	}

	.who {
		display: inline-flex;
		align-items: flex-end;
		gap: 0.4rem;
		font-size: 1.1rem;
	}

	.pawn {
		width: 1.3rem;
		height: 1.8rem;
		fill: var(--seat);
		filter: drop-shadow(0 2px 2px rgb(0 0 0 / 0.6));
	}

	.free {
		color: var(--muted);
		font-size: 0.9rem;
		font-style: italic;
	}

	.face {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.7rem;
		min-height: 0;
		padding: 0.9rem 1rem 0.9rem;
		border: 2px solid transparent;
		border-radius: 4px;
		background: var(--document);
		box-shadow: 0 0.8rem 2rem rgb(0 0 0 / 0.45);
		color: var(--slip-ink);
		font: inherit;
		text-align: left;
		transition:
			border-color 180ms ease,
			translate 180ms ease,
			box-shadow 180ms ease,
			opacity 180ms ease;
	}

	button.face {
		cursor: pointer;
	}

	button.face:hover:not(:disabled) {
		translate: 0 -3px;
		box-shadow: 0 1.2rem 2.4rem rgb(0 0 0 / 0.55);
	}

	.card.mine .face,
	.card.taken .face {
		border-color: var(--seat);
		box-shadow:
			0 0 0 3px color-mix(in srgb, var(--seat) 35%, transparent),
			0 0.8rem 2rem rgb(0 0 0 / 0.45);
	}

	.card.taken .face {
		cursor: default;
		opacity: 0.88;
	}

	.top {
		display: flex;
		gap: 0.8rem;
		align-items: center;
	}

	.portrait {
		position: relative;
		flex: none;
		width: 4.6rem;
		height: 4.6rem;
		border-radius: 3px;
		overflow: hidden;
	}

	.title {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.title strong {
		font-family: var(--font-display);
		font-size: 1.7rem;
		font-weight: 400;
		line-height: 1.05;
	}

	.title small,
	.kind {
		color: var(--slip-muted);
		font-size: 0.85rem;
	}

	.traits {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.line {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		padding-left: 0.6rem;
		border-left: 3px solid var(--ink-good);
	}

	.line.ability {
		border-left-color: #6a7fa8;
	}

	.line.scar {
		border-left-color: var(--ink-danger);
	}

	.line .kind {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.78rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.line b {
		font-size: 1.08rem;
	}

	.text {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.4;
	}

	.line.struck b,
	.line.struck .text {
		text-decoration: line-through;
		text-decoration-color: var(--ink-danger);
		opacity: 0.6;
	}

	.slots {
		color: var(--slip-muted);
		font-size: 0.88rem;
		font-style: italic;
	}

	.exposure {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-top: auto;
		padding-top: 0.5rem;
		border-top: 1px dotted rgb(42 32 23 / 0.3);
	}

	.exposure .kind {
		margin-right: 0.35rem;
	}

	.exposure i {
		display: block;
		width: 1.05rem;
		height: 1.05rem;
		border: 1px solid rgb(42 32 23 / 0.45);
		border-radius: 2px;
	}

	.exposure i.hidden {
		background: repeating-linear-gradient(45deg, rgb(42 32 23 / 0.18) 0 2px, transparent 2px 5px);
	}

	.exposure i.scar {
		background: var(--ink-danger);
	}

	.exposure i.skull {
		background: var(--slip-ink);
	}

	.new form {
		gap: 0.6rem;
	}

	.new label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		color: var(--slip-muted);
		font-size: 0.85rem;
	}

	.new input,
	.new select {
		padding: 0.35rem 0.3rem;
		border: 0;
		border-bottom: 1px solid rgb(42 32 23 / 0.35);
		background: rgb(255 252 242 / 0.35);
		color: var(--slip-ink);
		font: inherit;
		font-size: 1.05rem;
	}

	.new input:focus,
	.new select:focus {
		outline: none;
		border-bottom-color: var(--slip-ink);
	}

	.make {
		margin-top: auto;
		padding: 0.6rem;
		border: 1px solid var(--slip-ink);
		border-radius: 2px;
		background: var(--slip-ink);
		color: #efe6d2;
		font: inherit;
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
	}

	.make:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.fallen {
		margin: -0.4rem 0 0;
		color: var(--muted);
		font-size: 0.88rem;
	}

	/* What moves the table on: who is still choosing, the vote in the middle, and the way out to the board. */
	footer {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1.5rem;
		padding-top: 0.9rem;
		border-top: 1px solid var(--line);
	}

	.status {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.side {
		display: flex;
		justify-content: flex-end;
	}

	.choosing {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.8rem;
		margin: 0;
		color: var(--muted);
	}

	.choosing .who {
		color: var(--ink);
	}

	.starts {
		display: flex;
		gap: 1rem;
	}

	.hint {
		margin: 0;
		color: var(--muted);
		font-size: 0.92rem;
	}

	.peek {
		padding: 1rem 2.4rem;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		background: rgb(10 8 6 / 0.6);
		color: var(--ink);
		font: inherit;
		font-size: 1.25rem;
		letter-spacing: 0.03em;
		cursor: pointer;
		transition:
			border-color 150ms ease,
			background 150ms ease;
	}

	.peek:hover {
		border-color: var(--paper);
		background: var(--wash);
	}
</style>
