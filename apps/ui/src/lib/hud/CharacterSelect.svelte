<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { claimant, pack, reject, SEAT_IDS, tablePlayers, tableStart } from '@repo/game';
	import type { Character, CharacterId, CityId, Command, JobId, PlayerId, PublicState } from '@repo/game';
	import { flip } from 'svelte/animate';
	import { tick } from 'svelte';
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

	// Size the character grid and card scale to fill the available space without scrolling.
	let cardCols = $state(3);
	let cardScale = $state(1);
	const rosterKey = $derived(
		shown.map(character => `${character.id}:${character.slots.filter(Boolean).length}`).join('|'),
	);
	$effect(() => {
		void rosterKey;
		const element = cards;
		const count = shown.length;
		if (!element || count === 0) return;
		let run = 0;
		const fit = async () => {
			const mine = ++run;
			const width = element.clientWidth;
			const height = element.clientHeight;
			if (!width || !height) return;
			const gap = 12;
			// Pick the column count that gives each card the largest scale inside the container.
			let bestCols = 1;
			let bestScale = 0;
			for (let cols = 1; cols <= count; cols++) {
				const rows = Math.ceil(count / cols);
				const cellW = (width - gap * (cols - 1)) / cols;
				const cellH = (height - gap * (rows - 1)) / rows;
				const candidate = Math.min(cellW / 205, cellH / 260);
				if (candidate > bestScale) {
					bestScale = candidate;
					bestCols = cols;
				}
			}
			cardCols = bestCols;
			const most = Math.max(0.75, Math.min(1.85, bestScale));
			cardScale = Number(most.toFixed(3));
			await tick();
			if (mine !== run || !overflowing(element)) return;
			// A card with many traits still overflows: find the largest scale at which every card fits.
			let fits = 0.72;
			let over = most;
			for (let step = 0; step < 7 && mine === run; step++) {
				const mid = (fits + over) / 2;
				cardScale = Number(mid.toFixed(3));
				await tick();
				if (overflowing(element)) over = mid;
				else fits = mid;
			}
			if (mine === run) cardScale = Number(fits.toFixed(3));
		};
		let frame = 0;
		const observer = new ResizeObserver(() => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => void fit());
		});
		observer.observe(element);
		void fit();
		return () => {
			run++;
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	});
	// Each card against its own parts, never the grid's scrollHeight or any position: a claim reorders the cards, and
	// while their flip runs they stand in their old places, which overflowed the grid and once shrank every card to the
	// floor for good. Fractional heights, since the face stretches to fill a card that fits and rounding decides the
	// rest. The flip scales a card and its parts alike, so the comparison holds mid-flight.
	function overflowing(grid: HTMLElement) {
		return [...grid.children].some(card => {
			const parts = [...card.children];
			const scale = card.getBoundingClientRect().height / ((card as HTMLElement).offsetHeight || 1);
			const gap = (parseFloat(getComputedStyle(card).rowGap) || 0) * scale;
			const need = parts.reduce((sum, part) => sum + part.getBoundingClientRect().height, 0) + gap * (parts.length - 1);
			return need > card.getBoundingClientRect().height + scale;
		});
	}
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
		<div class="cards" bind:this={cards} style:--cols={cardCols} style:--s={cardScale}>
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
							{#each traits as trait, index (`${trait.kind}:${trait.name}:${index}`)}
								<span class="line {trait.kind}" class:struck={trait.struck}>
									{#if trait.kind === 'job' && trait.job}
										<span class="trait-icon"><OccupationIcon job={trait.job} /></span>
									{:else if trait.kind === 'scar'}
										<span class="trait-icon"><CardIcon path={SCAR_ICON} size="0.72rem" /></span>
									{/if}
									<span class="sr-only">{TRAIT_KIND[trait.kind]}{trait.struck ? ', covered by a scar' : ''}: </span>
									<b>{trait.name}</b>
									<span class="text">{trait.text}</span>
								</span>
							{/each}
							{#each { length: empty } as _, index (index)}
								<span class="slot-empty">
									<span class="sr-only">Empty slot</span>
								</span>
							{/each}
						</span>
						<span class="exposure" aria-label={`Exposure ${character.exposure} of ${character.exposureTrack.length}`}>
							<span class="kind">Exposure</span>
							{#each exposureShown(character) as box, index (index)}
								<i class={box}></i>
							{/each}
						</span>
					</button>
				</article>
			{/each}
		</div>
		<article
			class="card new"
			bind:this={form}
			data-testid="new-character"
			{@attach feedback('New character', () => ({ job, home, portrait }))}
		>
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
							<label class="avatar" class:worn={worn.has(index)}>
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
					<fieldset class="choices jobs" data-testid="new-job">
						<legend>Occupation</legend>
						{#each jobs as option (option.id)}
							<label class="choice" class:used={option.refusal !== null}>
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
					<button class="make" disabled={refusal !== null} data-testid="create-character">Create and take</button>
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
				{:else if mine.length < hands}
					Pick or create {hands - mine.length === 1 ? 'a character' : `${hands - mine.length} characters`} before readying
					up.
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
		</div>
		<div class="starts">
			<Ready
				{table}
				{player}
				{send}
				{start}
				label={`Ready for ${title}`}
				big
				disabled={!table.ready[player] && readyRefusal !== null}
			/>
		</div>
	</footer>
</div>

<style>
	.select {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		width: 100%;
		height: 100%;
		padding: 0.35rem 0.85rem 0.45rem;
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
		font-size: 1.45rem;
		font-weight: 400;
		line-height: 1;
	}

	.row {
		display: flex;
		flex: 1 1 auto;
		gap: 0.65rem;
		min-height: 0;
	}

	/* Every card whole, equal-sized, and scaled up to fill the available space without scrolling. */
	.cards {
		display: grid;
		flex: 1 1 auto;
		align-self: stretch;
		grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr));
		grid-auto-rows: 1fr;
		align-content: stretch;
		gap: calc(0.45rem * var(--s, 1)) calc(0.6rem * var(--s, 1));
		height: 100%;
		min-height: 0;
		padding: 0.15rem 0.2rem 0.2rem 0.15rem;
		overflow: hidden auto;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: calc(0.18rem * var(--s, 1));
		min-height: 0;
	}

	.claim {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		height: calc(1.35rem * var(--s, 1));
	}

	/* Words standing on the open map get a dark slip of their own, since the map under them may be pale land. */
	.claim > span,
	.status {
		padding: 0.08rem 0.45rem;
		border-radius: 999px;
		background: rgb(12 10 8 / 0.72);
		backdrop-filter: blur(4px);
	}

	.status {
		justify-self: start;
		padding: 0.25rem 0.65rem;
		border-radius: 8px;
	}

	.who {
		display: inline-flex;
		align-items: flex-end;
		gap: calc(0.28rem * var(--s, 1));
		font-size: calc(0.8rem * var(--s, 1));
	}

	.me {
		display: inline-flex;
		align-items: baseline;
		gap: 0.2rem;
		cursor: text;
	}

	/* Reads as the name itself until it is clicked. */
	.me input {
		field-sizing: content;
		min-width: 2ch;
		max-width: calc(9rem * var(--s, 1));
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
		width: calc(0.68rem * var(--s, 1));
		height: calc(0.68rem * var(--s, 1));
		fill: var(--muted);
		opacity: 0.6;
	}

	.me:hover .pen,
	.me:focus-within .pen {
		opacity: 1;
	}

	.pawn {
		width: calc(0.88rem * var(--s, 1));
		height: calc(1.15rem * var(--s, 1));
		fill: var(--seat);
		filter: drop-shadow(0 2px 2px rgb(0 0 0 / 0.6));
	}

	.free {
		color: var(--muted);
		font-size: calc(0.72rem * var(--s, 1));
		font-style: italic;
	}

	.face {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: calc(0.38rem * var(--s, 1));
		padding: calc(0.5rem * var(--s, 1)) calc(0.6rem * var(--s, 1));
		border: 2px solid transparent;
		border-radius: 4px;
		background: var(--document);
		box-shadow: 0 0.5rem 1.4rem rgb(0 0 0 / 0.45);
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
		translate: 0 -2px;
		box-shadow: 0 0.8rem 1.8rem rgb(0 0 0 / 0.55);
	}

	.card.mine .face,
	.card.taken .face {
		border-color: var(--seat);
		box-shadow:
			0 0 0 2px color-mix(in srgb, var(--seat) 35%, transparent),
			0 0.5rem 1.4rem rgb(0 0 0 / 0.45);
	}

	.card.taken .face {
		cursor: default;
		opacity: 0.88;
	}

	.top {
		display: flex;
		gap: calc(0.5rem * var(--s, 1));
		align-items: center;
	}

	.portrait {
		position: relative;
		flex: none;
		width: calc(2.45rem * var(--s, 1));
		height: calc(2.45rem * var(--s, 1));
		border-radius: 3px;
		overflow: hidden;
	}

	.title {
		display: flex;
		flex-direction: column;
		gap: calc(0.06rem * var(--s, 1));
		min-width: 0;
	}

	.title strong {
		font-family: var(--font-display);
		font-size: calc(1.12rem * var(--s, 1));
		font-weight: 400;
		line-height: 1.05;
	}

	.title small,
	.kind {
		color: var(--slip-muted);
		font-size: calc(0.7rem * var(--s, 1));
	}

	.traits {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: calc(0.26rem * var(--s, 1));
	}

	.line {
		display: block;
		padding-left: calc(0.42rem * var(--s, 1));
		border-left: 3px solid var(--ink-good);
		font-size: calc(0.7rem * var(--s, 1));
		line-height: 1.24;
	}

	.line.ability {
		border-left-color: #6a7fa8;
	}

	.line.scar {
		border-left-color: var(--ink-danger);
	}

	.trait-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: calc(0.8rem * var(--s, 1));
		height: calc(0.8rem * var(--s, 1));
		margin-right: 0.15rem;
		vertical-align: -0.14em;
	}

	.line.scar .trait-icon {
		color: var(--ink-danger);
	}

	.line b {
		margin-right: 0.22rem;
		font-size: calc(0.74rem * var(--s, 1));
		font-weight: 700;
	}

	.text {
		margin: 0;
		font-size: calc(0.7rem * var(--s, 1));
		line-height: 1.24;
	}

	.line.struck b,
	.line.struck .text {
		text-decoration: line-through;
		text-decoration-color: var(--ink-danger);
		opacity: 0.6;
	}

	.line.struck .trait-icon {
		opacity: 0.6;
	}

	.slot-empty {
		display: block;
		flex: 1 1 calc(1.1rem * var(--s, 1));
		min-height: calc(1.1rem * var(--s, 1));
		max-height: calc(2.6rem * var(--s, 1));
		border: 1px dashed rgb(42 32 23 / 0.28);
		border-radius: 2px;
		background: rgb(42 32 23 / 0.035);
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

	.exposure {
		display: flex;
		align-items: center;
		gap: calc(0.2rem * var(--s, 1));
		margin-top: auto;
		padding-top: calc(0.3rem * var(--s, 1));
		border-top: 1px dotted rgb(42 32 23 / 0.3);
	}

	.exposure .kind {
		margin-right: calc(0.22rem * var(--s, 1));
	}

	.exposure i {
		display: block;
		width: calc(0.78rem * var(--s, 1));
		height: calc(0.78rem * var(--s, 1));
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

	/* Compact single-column create panel beside the character grid so 8 cards and the form fit on a laptop screen. */
	.new {
		flex: none;
		align-self: flex-start;
		width: 16.5rem;
		max-height: 100%;
	}

	.new form {
		display: flex;
		flex-direction: column;
		gap: 0.32rem;
		min-height: 0;
		padding: 0.45rem 0.55rem;
		overflow-y: auto;
	}

	.who-new {
		display: flex;
		gap: 0.45rem;
		align-items: center;
	}

	.who-new .portrait {
		width: 2.15rem;
		height: 2.15rem;
	}

	.havens {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.jobs {
		gap: 0.1rem;
	}

	.named {
		flex: 1;
		min-width: 0;
	}

	.new label,
	legend {
		display: flex;
		flex-direction: column;
		gap: 0.08rem;
		color: var(--slip-muted);
		font-size: 0.66rem;
	}

	.named input {
		width: 100%;
		min-width: 0;
		padding: 0.16rem 0.2rem;
		border: 0;
		border-bottom: 1px solid rgb(42 32 23 / 0.35);
		background: rgb(255 252 242 / 0.35);
		color: var(--slip-ink);
		font: inherit;
		font-size: 0.8rem;
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
		margin-bottom: 0.12rem;
		padding: 0;
	}

	.avatars {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.2rem;
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
		gap: 0.12rem;
	}

	.choices legend {
		grid-column: 1 / -1;
	}

	.new .choice {
		position: relative;
		flex-direction: row;
		gap: 0.3rem;
		align-items: baseline;
		padding: 0.12rem 0.25rem;
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

	.havens .choice {
		justify-content: center;
		padding: 0.12rem 0.15rem;
		text-align: center;
		white-space: nowrap;
	}

	.havens .choice b {
		font-size: 0.66rem;
	}

	.mark {
		position: relative;
		flex: none;
		width: 1.15rem;
		height: 1.15rem;
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
		font-size: 0.7rem;
		line-height: 1.12;
	}

	.choice small {
		color: var(--slip-muted);
		font-size: 0.62rem;
		line-height: 1.15;
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
		padding: 0.35rem;
		border: 1px solid var(--slip-ink);
		border-radius: 2px;
		background: var(--slip-ink);
		color: #efe6d2;
		font: inherit;
		font-size: 0.78rem;
		font-weight: 700;
		cursor: pointer;
	}

	.make:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.fallen {
		margin: -0.15rem 0 0;
		color: var(--muted);
		font-size: 0.7rem;
	}

	/* What moves the table on: who is still choosing, and the vote in the middle. */
	footer {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 0.8rem;
		padding-top: 0.35rem;
		border-top: 1px solid var(--line);
	}

	.status {
		display: flex;
		flex-direction: column;
		gap: 0.14rem;
	}

	.hands {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		color: var(--muted);
		font-size: 0.72rem;
	}

	.hands b {
		min-width: 1ch;
		color: var(--ink);
		text-align: center;
	}

	.hands button {
		width: 1.25rem;
		height: 1.25rem;
		padding: 0;
		border: 1px solid var(--line-strong);
		border-radius: 5px;
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
		gap: 0.45rem;
		margin: 0;
		color: var(--muted);
		font-size: 0.72rem;
	}

	.choosing .who {
		color: var(--ink);
	}

	.starts {
		display: flex;
		gap: 0.8rem;
	}

	.starts :global(.ready.big) {
		gap: 0.3rem;
		min-width: 11rem;
		padding: 0.4rem 1.4rem 0.35rem;
	}

	.starts :global(.ready.big .label) {
		font-size: 1.35rem;
	}

	.starts :global(.ready.big .pips i) {
		width: 0.7rem;
		height: 0.7rem;
	}

	.hint {
		margin: 0;
		color: var(--muted);
		font-size: 0.68rem;
	}

	@media (max-height: 840px) {
		.select {
			gap: 0.25rem;
			padding: 0.25rem 0.75rem 0.35rem;
		}

		h1 {
			font-size: 1.25rem;
		}

		.cards {
			gap: 0.25rem 0.45rem;
		}

		.claim {
			height: 1.1rem;
		}

		.face {
			gap: 0.2rem;
			padding: 0.3rem 0.42rem;
		}

		.portrait {
			width: 1.8rem;
			height: 1.8rem;
		}

		.title strong {
			font-size: 0.88rem;
		}

		.line,
		.text {
			font-size: 0.6rem;
			line-height: 1.14;
		}

		.line b {
			font-size: 0.63rem;
		}

		.slot-empty {
			min-height: 0.95rem;
			max-height: 1.8rem;
		}

		.new form {
			gap: 0.22rem;
			padding: 0.38rem 0.48rem;
		}

		.who-new .portrait {
			width: 1.9rem;
			height: 1.9rem;
		}

		footer {
			padding-top: 0.25rem;
		}
	}
</style>
