<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { claimant, pack, reject, SEAT_IDS, tablePlayers, tableStart } from '@repo/game';
	import type { Character, CharacterId, CityId, Command, JobId, PlayerId, PublicState } from '@repo/game';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import CardIcon from '#lib/cards/CardIcon.svelte';
	import { SCAR_ICON } from '#lib/cards/icons.ts';
	import OccupationIcon from '#lib/occupations/OccupationIcon.svelte';
	import { cityName, MONTHS, SEAT_COLORS } from './labels.svelte.ts';
	import Portrait from './Portrait.svelte';
	import Ready from './Ready.svelte';
	import { keep } from './viewState.ts';
	import { characterTraits, TRAIT_KIND } from './traits.ts';

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

	/** The colour a claimed character plays in: a player's characters go to their seats in order, as the deal does. */
	function colorFor(character: Character): string | null {
		const holder = claimant(world, character.id);
		if (!holder) return null;
		const seat = seatsOf(holder)[claimedBy(holder).indexOf(character)];
		return seat ? SEAT_COLORS[SEAT_IDS.indexOf(seat)]! : null;
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
	const waitingOn = $derived(players.filter(who => !table.ready[who]).map(nameOf));

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

	const havens = pack.cities.filter(city => city.kind === 'haven' && !city.lost);
	let newName = $state('');
	let job = $state<JobId | ''>('');
	let home = $state<CityId>(havens[0]!.id);
	const portraits = Array.from({ length: pack.numbers.portraits }, (_, index) => index);
	const worn = $derived(new Set(living.map(character => character.portrait)));
	let picked = $state<number | null>(null);
	keep(
		'characters',
		() => ({ newName, job, home, picked }),
		saved => {
			newName = saved.newName;
			job = saved.job;
			home = saved.home;
			picked = saved.picked;
		},
	);
	const portrait = $derived(picked ?? portraits.find(index => !worn.has(index)) ?? 0);
	// Every starting occupation and every job the group has found is listed, and the engine says which can still be
	// taken. It is asked with a stand-in name, so a blank name field does not cross out the whole list. A found job
	// comes with its own home.
	const homeOf = (id: JobId) =>
		pack.jobs.find(option => option.id === id)?.starting
			? null
			: (world.campaign.jobsFound.find(entry => entry.job === id)?.home ?? null);
	const jobs = $derived(
		pack.jobs
			.filter(option => option.starting || world.campaign.jobsFound.some(entry => entry.job === option.id))
			.map(option => ({
				...option,
				refusal: reject(world, snap.phase, {
					type: 'CREATE_CHARACTER',
					name: option.name,
					job: option.id,
					home: homeOf(option.id) ?? home,
					portrait,
					player,
				}),
			})),
	);
	const anyJob = $derived(jobs.some(option => option.refusal === null));
	$effect(() => {
		if (!job || jobs.find(option => option.id === job)?.refusal)
			job = jobs.find(option => option.refusal === null)?.id ?? '';
	});
	$effect(() => {
		const fixed = job ? homeOf(job) : null;
		if (fixed && fixed !== home) home = fixed;
	});
	const create = $derived<Command | null>(
		job ? { type: 'CREATE_CHARACTER', name: newName.trim(), job, home: homeOf(job) ?? home, portrait, player } : null,
	);
	const refusal = $derived(create ? reject(world, snap.phase, create) : 'Every starting job is taken');

	function renamed(event: Event & { currentTarget: HTMLInputElement }) {
		const name = event.currentTarget.value.trim();
		if (name && name !== nameOf(player)) rename(name);
		else event.currentTarget.value = nameOf(player);
	}

	let screen = $state<HTMLElement>();
	let cards = $state<HTMLElement>();
	let form = $state<HTMLElement>();
	let footer = $state<HTMLElement>();
	// The map shows through wherever the character cards leave room left of the form: beside them or below them.
	function look(city: CityId) {
		if (!screen || !cards || !form || !footer) return;
		const area = screen.getBoundingClientRect();
		const top = cards.getBoundingClientRect().top;
		const wall = form.getBoundingClientRect().left;
		const floor = footer.getBoundingClientRect().top;
		const boxes = [...cards.children].map(child => child.getBoundingClientRect());
		const right = Math.max(area.left, ...boxes.map(box => box.right));
		const bottom = Math.max(top, ...boxes.map(box => box.bottom));
		const beside = (wall - right) * (floor - top);
		const below = (wall - area.left) * (floor - bottom);
		onfocus(
			beside > below
				? { city, x: (right + wall) / 2, y: (top + floor) / 2 }
				: { city, x: (area.left + wall) / 2, y: (bottom + floor) / 2 },
		);
	}
	$effect(() => () => onfocus(null));

	const exposureShown = (character: Character) =>
		character.exposureTrack.map((box, index) => (index < character.exposure ? box : 'hidden'));
</script>

{#snippet pawn(color: string)}
	<!-- The pawn this player moves on the board, in their colour. -->
	<svg class="pawn" viewBox="0 0 20 28" style:--seat={color} aria-hidden="true">
		<circle cx="10" cy="6.5" r="5" />
		<path d="M10 11.5c-4 0-6.5 4.5-6.5 9.5v1.5h13V21c0-5-2.5-9.5-6.5-9.5z" />
		<rect x="1.5" y="22.5" width="17" height="4" rx="1.5" />
	</svg>
{/snippet}

{#snippet marker(color: string, label: string)}
	{@render pawn(color)}
	<b>{label}</b>
{/snippet}

{#snippet you(color: string)}
	<!-- Your own name, written where it shows: click it to change it. -->
	{@render pawn(color)}
	<label class="me" title="Change your name">
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
	bind:this={screen}
	data-testid="character-select"
	{@attach feedback('Character select', () => ({
		month: campaign.month,
		claims: living.map(character => ({ character: character.name, by: claimant(world, character.id) })),
		ready: table.ready,
	}))}
>
	<h1>{title}</h1>

	<div class="row">
		<div class="cards" bind:this={cards}>
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
									{#if holder === player}
										{@render you(color)}
									{:else}
										{@render marker(color, nameOf(holder))}
									{/if}
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
							<span class="portrait"
								><Portrait portrait={character.portrait} color={color ?? '#4a4238'} job={character.job} /></span
							>
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
		</div>
		<article class="card new" bind:this={form} data-testid="new-character">
			<form
				class="face"
				aria-label="New character"
				onsubmit={event => {
					event.preventDefault();
					if (create && !refusal) send(create);
					newName = '';
					picked = null;
				}}
			>
				{#if anyJob}
					<div class="who-new">
						<span class="portrait"><Portrait {portrait} color="#4a4238" job={job || null} /></span>
						<label class="named"
							>New character<input
								bind:value={newName}
								maxlength="24"
								placeholder="Their name"
								data-testid="new-name"
							/></label
						>
					</div>
					<fieldset class="avatars">
						<legend>Portrait</legend>
						{#each portraits as index (index)}
							<label
								class="avatar"
								class:worn={worn.has(index)}
								title={worn.has(index) ? 'Worn by another character' : ''}
							>
								<input
									type="radio"
									name="portrait"
									aria-label={`Portrait ${index + 1}${worn.has(index) ? ', worn by another character' : ''}`}
									value={index}
									checked={portrait === index}
									onchange={() => (picked = index)}
								/>
								<span class="portrait"><Portrait portrait={index} color="#4a4238" /></span>
							</label>
						{/each}
					</fieldset>
					<fieldset class="choices havens" data-testid="new-home" onpointerleave={() => onfocus(null)}>
						<legend>Home haven</legend>
						{#each havens as haven (haven.id)}
							<label
								class="choice"
								onpointerenter={() => look(haven.id)}
								onfocusin={() => look(haven.id)}
								onfocusout={() => onfocus(null)}
							>
								<input type="radio" name="home" value={haven.id} bind:group={home} />
								<span><b>{cityName(haven.id)}</b></span>
							</label>
						{/each}
					</fieldset>
					<button class="make" disabled={refusal !== null} title={refusal ?? ''} data-testid="create-character"
						>Create and take</button
					>
					<fieldset class="choices jobs" data-testid="new-job">
						<legend>Occupation</legend>
						{#each jobs as option (option.id)}
							<label class="choice" class:used={option.refusal !== null} title={option.refusal ?? ''}>
								<input
									type="radio"
									name="job"
									value={option.id}
									bind:group={job}
									disabled={option.refusal !== null}
									aria-describedby={`job-${option.id}`}
								/>
								<span class="mark"><OccupationIcon job={option.id} /></span>
								<span id={`job-${option.id}`}><b>{option.name}</b><small>{option.text}</small></span>
							</label>
						{/each}
					</fieldset>
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

	<footer bind:this={footer}>
		<div class="status">
			{#if hands > 0}
				<div class="hands" role="group" aria-label="Characters played on this screen">
					<span>Characters on this screen</span>
					<button
						onclick={dropHand}
						disabled={hands < 2}
						title={hands < 2 ? 'You play at least one character' : 'Play one character fewer here'}
						aria-label="One character fewer"
						data-testid="hand-fewer">−</button
					>
					<b aria-live="polite">{hands}</b>
					<button
						onclick={() => send(addHand)}
						disabled={cannotAdd !== null}
						title={cannotAdd ?? 'Play one more character here'}
						aria-label="One more character"
						data-testid="hand-more">+</button
					>
				</div>
			{/if}
			{#if choosing.length}
				<p class="choosing">
					Still choosing:
					{#each choosing as who (who)}
						{@const color = SEAT_COLORS[SEAT_IDS.indexOf(seatsOf(who)[0]!)]!}
						<span class="who">
							{#if who === player}{@render you(color)}{:else}{@render marker(color, nameOf(who))}{/if}
						</span>
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
	</footer>
</div>

<style>
	.select {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		width: 100%;
		height: 100%;
		padding: 1rem 1.6rem 1rem;
		color: var(--ink);
		/* No backdrop: the map shows through, so the words standing on it carry their own shadow. */
		text-shadow:
			0 0 0.4rem rgb(0 0 0 / 0.9),
			0 1px 2px rgb(0 0 0 / 0.9);
		overflow: hidden;
		animation: rise 420ms cubic-bezier(0.2, 0.9, 0.3, 1.05) both;
	}

	@keyframes rise {
		from {
			opacity: 0;
			translate: 0 2rem;
		}
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 2.6rem;
		font-weight: 400;
		line-height: 1;
	}

	.row {
		display: flex;
		flex: 1 1 auto;
		gap: 1.1rem;
		min-height: 0;
	}

	/* Every card whole and legible, wrapping into rows. A roster too long for the screen scrolls here, never the page. */
	.cards {
		display: grid;
		flex: 1 1 auto;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
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

	/* Words standing on the open map get a dark slip of their own, since the map under them may be pale land. */
	.claim > span,
	.status {
		padding: 0.25rem 0.7rem;
		border-radius: 999px;
		background: rgb(12 10 8 / 0.72);
		backdrop-filter: blur(4px);
	}

	.status {
		justify-self: start;
		padding: 0.6rem 1rem;
		border-radius: 10px;
	}

	.who {
		display: inline-flex;
		align-items: flex-end;
		gap: 0.4rem;
		font-size: 1.1rem;
	}

	.me {
		display: inline-flex;
		align-items: baseline;
		gap: 0.3rem;
		cursor: text;
	}

	/* Reads as the name itself until it is clicked. */
	.me input {
		field-sizing: content;
		min-width: 2ch;
		max-width: 12rem;
		padding: 0 0.15rem;
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
		border-bottom-color: var(--muted);
		outline: none;
	}

	.me span {
		color: var(--muted);
	}

	.pen {
		width: 0.8rem;
		height: 0.8rem;
		fill: var(--muted);
		opacity: 0.6;
	}

	.me:hover .pen,
	.me:focus-within .pen {
		opacity: 1;
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
		text-shadow: none;
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

	/* The portrait thumbs set the form's width: five to a row, with the preview the same size as one. */
	.new {
		--thumb: 4.4rem;
		--thumb-gap: 0.35rem;
		flex: none;
		align-self: flex-start;
		max-height: 100%;
	}

	.new form {
		display: grid;
		grid-template:
			'who jobs' auto
			'avatars jobs' auto
			'havens jobs' auto
			'make jobs' 1fr
			/ calc(5 * var(--thumb) + 4 * var(--thumb-gap)) 17rem;
		gap: 0.7rem 1.2rem;
	}

	.new form > .text {
		grid-column: 1 / -1;
	}

	.who-new {
		display: flex;
		grid-area: who;
		gap: 0.8rem;
		align-items: center;
	}

	.who-new .portrait {
		width: var(--thumb);
		height: var(--thumb);
	}

	.havens {
		grid-area: havens;
		grid-template-columns: repeat(auto-fit, minmax(6rem, 1fr));
	}

	.jobs {
		grid-area: jobs;
	}

	.named {
		flex: 1;
		min-width: 0;
	}

	.new label,
	legend {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		color: var(--slip-muted);
		font-size: 0.85rem;
	}

	.named input {
		width: 100%;
		min-width: 0;
		padding: 0.35rem 0.3rem;
		border: 0;
		border-bottom: 1px solid rgb(42 32 23 / 0.35);
		background: rgb(255 252 242 / 0.35);
		color: var(--slip-ink);
		font: inherit;
		font-size: 1.05rem;
	}

	.named input:focus {
		outline: none;
		border-bottom-color: var(--slip-ink);
	}

	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
	}

	legend {
		margin-bottom: 0.25rem;
		padding: 0;
	}

	.avatars {
		display: grid;
		grid-area: avatars;
		grid-template-columns: repeat(5, var(--thumb));
		gap: var(--thumb-gap);
	}

	.avatars legend {
		grid-column: 1 / -1;
	}

	.avatar {
		position: relative;
		cursor: pointer;
	}

	.avatar .portrait {
		width: 100%;
		height: auto;
		aspect-ratio: 1;
		outline: 2px solid transparent;
		outline-offset: 1px;
		transition: outline-color 150ms ease;
	}

	.avatar.worn .portrait {
		opacity: 0.55;
	}

	/* Taken already: a red cross over the face, which can still be chosen. */
	.avatar.worn::after,
	.choice.used .mark::after {
		content: '';
		position: absolute;
		inset: 0;
		background:
			linear-gradient(
				to top right,
				transparent calc(50% - 1.5px),
				var(--ink-danger) calc(50% - 1.5px) calc(50% + 1.5px),
				transparent calc(50% + 1.5px)
			),
			linear-gradient(
				to bottom right,
				transparent calc(50% - 1.5px),
				var(--ink-danger) calc(50% - 1.5px) calc(50% + 1.5px),
				transparent calc(50% + 1.5px)
			);
		pointer-events: none;
	}

	.avatar:has(input:checked)::after {
		opacity: 0.5;
	}

	.avatar:hover .portrait {
		outline-color: rgb(42 32 23 / 0.4);
	}

	.avatar:has(input:checked) .portrait {
		opacity: 1;
		outline-color: var(--slip-ink);
	}

	.choices {
		display: grid;
		gap: 0.2rem;
	}

	.choices legend {
		grid-column: 1 / -1;
	}

	.new .choice {
		position: relative;
		flex-direction: row;
		gap: 0.5rem;
		align-items: baseline;
		padding: 0.2rem 0.45rem;
		border: 1px solid transparent;
		border-radius: 3px;
		color: var(--slip-ink);
		cursor: pointer;
		transition:
			background 150ms ease,
			border-color 150ms ease;
	}

	.choice:hover {
		background: rgb(255 252 242 / 0.45);
	}

	.jobs .choice {
		align-items: center;
	}

	.mark {
		position: relative;
		flex: none;
		width: 1.9rem;
		height: 1.9rem;
	}

	.choice.used {
		cursor: default;
	}

	.choice.used:hover {
		background: none;
	}

	.choice.used .mark {
		opacity: 0.55;
	}

	.choice.used b {
		text-decoration: line-through;
		text-decoration-color: var(--ink-danger);
		text-decoration-thickness: 2px;
	}

	.choice.used small {
		opacity: 0.6;
	}

	.choice:has(input:checked) {
		border-color: rgb(42 32 23 / 0.45);
		background: rgb(255 252 242 / 0.6);
	}

	.choice span {
		display: flex;
		flex-direction: column;
	}

	.choice b {
		font-size: 0.95rem;
	}

	.choice small {
		color: var(--slip-muted);
		font-size: 0.78rem;
		line-height: 1.25;
	}

	/* The radio itself stays for the keyboard and screen readers; the row is what shows the choice. */
	.choice input,
	.avatar input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.choice:has(input:focus-visible),
	.avatar:has(input:focus-visible) .portrait {
		outline: 2px solid var(--slip-ink);
	}

	.make {
		grid-area: make;
		align-self: end;
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

	/* What moves the table on: who is still choosing, and the vote in the middle. */
	footer {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1.5rem;
		padding-top: 0.7rem;
		border-top: 1px solid var(--line);
	}

	.status {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.hands {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--muted);
		font-size: 0.9rem;
	}

	.hands b {
		min-width: 1ch;
		color: var(--ink);
		text-align: center;
	}

	.hands button {
		width: 1.7rem;
		height: 1.7rem;
		padding: 0;
		border: 1px solid var(--line-strong);
		border-radius: 6px;
		background: rgb(12 10 8 / 0.6);
		color: var(--ink);
		font: inherit;
		line-height: 1;
		cursor: pointer;
	}

	.hands button:disabled {
		opacity: 0.4;
		cursor: default;
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
		font-size: 0.85rem;
	}
</style>
