<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack, score, SEAT_IDS, tableSeating } from '@repo/game';
	import type { CharacterId, CityId, Command, JobId, PublicState } from '@repo/game';
	import { cityName, MONTHS } from './labels.svelte.ts';

	type Props = { snap: PublicState; send: (command: Command) => void };

	let { snap, send }: Props = $props();

	const campaign = $derived(snap.world.campaign);
	const living = $derived(Object.values(campaign.characters).filter(character => !character.dead && !character.worker));
	const fallen = $derived(Object.values(campaign.characters).filter(character => character.dead && !character.worker));
	const freeJobs = $derived(
		pack.jobs.filter(
			job => job.starting && !Object.values(campaign.characters).some(character => character.job === job.id),
		),
	);
	const havens = pack.cities.filter(city => city.kind === 'haven' && !city.lost);
	const finished = $derived(snap.phase === 'finished');
	const total = $derived(score(campaign));

	let name = $state('');
	let job = $state<JobId | ''>('');
	let home = $state<CityId>(havens[0]!.id);
	$effect(() => {
		if (!job || !freeJobs.some(candidate => candidate.id === job)) job = freeJobs[0]?.id ?? '';
	});

	// Seats live in the game state, so every player's lobby shows the same table.
	const seating = $derived(tableSeating(campaign));
	const seated = (index: number): CharacterId | 'worker' | '' => {
		const entry = seating.find(candidate => candidate.seat === SEAT_IDS[index]);
		return entry ? (entry.character ?? 'worker') : '';
	};
	const startCommand = $derived<Command>({ type: 'START_GAME', seating });
</script>

<div
	class="lobby"
	{@attach feedback(undefined, () => ({
		phase: snap.phase,
		characters: Object.keys(campaign.characters).length,
		seating: campaign.seating,
	}))}
>
	<header>
		<h1>{finished ? 'Campaign complete' : (MONTHS[campaign.month] ?? '')}</h1>
		<p>
			{#if finished}
				Final score {total.total}
			{:else if campaign.month === 0}
				The prologue is a practice game. Nothing in it is permanent. Play it as often as you like, then begin January.
			{:else}
				{campaign.attempt === 1 ? 'Early attempt' : 'Late attempt'}. Rationing {campaign.rationing}.
			{/if}
		</p>
	</header>

	{#if finished}
		<dl class="score">
			<dt>Months won early</dt>
			<dd>{total.earlyWins}</dd>
			<dt>Months won late</dt>
			<dd>{total.lateWins}</dd>
			<dt>Population</dt>
			<dd>{total.population}</dd>
			<dt>Sample delivered</dt>
			<dd>{total.sample}</dd>
			<dt>Labs found</dt>
			<dd>{total.labs}</dd>
			<dt>Forsaken cities</dt>
			<dd>{total.forsaken}</dd>
		</dl>
	{:else}
		<div class="columns">
			<section>
				<h2>Characters</h2>
				<ul>
					{#each living as character (character.id)}
						<li>
							<strong>{character.name}</strong>
							<span>{pack.jobs.find(candidate => candidate.id === character.job)?.name}</span>
							<small>{cityName(character.home)}</small>
						</li>
					{:else}
						<li class="empty">Create at least two characters to begin.</li>
					{/each}
					{#each fallen as character (character.id)}
						<li class="dead">
							<strong>{character.name}</strong><span
								>died in {character.diedAt ? cityName(character.diedAt) : 'the field'}</span
							>
						</li>
					{/each}
				</ul>
				{#if freeJobs.length}
					<form
						onsubmit={event => {
							event.preventDefault();
							if (job) send({ type: 'CREATE_CHARACTER', name, job, home });
							name = '';
						}}
					>
						<input bind:value={name} placeholder="Name" maxlength="24" data-testid="character-name" />
						<select bind:value={job} title={pack.jobs.find(candidate => candidate.id === job)?.text}>
							{#each freeJobs as option (option.id)}<option value={option.id}>{option.name}</option>{/each}
						</select>
						<select bind:value={home}>
							{#each havens as haven (haven.id)}<option value={haven.id}>{haven.name}</option>{/each}
						</select>
						<button disabled={!name.trim()} data-testid="create-character">Create</button>
					</form>
					<p class="jobtext">{pack.jobs.find(candidate => candidate.id === job)?.text}</p>
				{/if}
			</section>

			<section>
				<h2>Seats</h2>
				{#each SEAT_IDS as seat, index (seat)}
					<label>
						<span>Seat {index + 1}</span>
						<select
							value={seated(index)}
							onchange={event => {
								const choice = event.currentTarget.value as CharacterId | 'worker' | '';
								send({ type: 'SEAT', seat, choice: choice === '' ? null : choice });
							}}
						>
							<option value="">empty</option>
							{#each living as character (character.id)}<option value={character.id}>{character.name}</option>{/each}
							<option value="worker">Haven worker</option>
						</select>
					</label>
				{/each}
				<div class="buttons">
					<button
						class="primary"
						disabled={seating.length < 2}
						onclick={() => send(startCommand)}
						data-testid="start-game"
					>
						{campaign.month === 0 ? 'Play the prologue' : `Start ${MONTHS[campaign.month]}`}
					</button>
					{#if campaign.month === 0}
						<button onclick={() => send({ type: 'BEGIN_CAMPAIGN' })} data-testid="begin-campaign">Begin January</button>
					{/if}
				</div>
				<h2>Rationing</h2>
				<div
					class="rationing"
					title="How many Rationed Events go in the deck. It moves by 2 after each game. Change it only to correct a rules mistake."
				>
					<button
						onclick={() => send({ type: 'SET_RATIONING', value: campaign.rationing - 1 })}
						disabled={campaign.rationing <= 0}>−</button
					>
					<strong data-testid="rationing">{campaign.rationing}</strong>
					<button
						onclick={() => send({ type: 'SET_RATIONING', value: campaign.rationing + 1 })}
						disabled={campaign.rationing >= 10}>+</button
					>
				</div>
				<h2>Haven names</h2>
				{#each pack.cities.filter(entry => entry.kind === 'haven' && campaign.locations[entry.id]?.revealed) as haven (haven.id)}
					<input
						class="haven"
						value={cityName(haven.id)}
						maxlength="24"
						onchange={event =>
							event.currentTarget.value.trim() &&
							send({ type: 'RENAME_HAVEN', city: haven.id, name: event.currentTarget.value })}
					/>
				{/each}
				{#if campaign.results.length}
					<h2>Record</h2>
					<p class="record">
						{#each campaign.results as result, index (index)}
							<span class:won={result.won} title={`${MONTHS[result.month]} ${result.attempt === 1 ? 'early' : 'late'}`}
								>{MONTHS[result.month]!.slice(0, 3)}</span
							>
						{/each}
					</p>
				{/if}
			</section>
		</div>
	{/if}
</div>

<style>
	/* The campaign ledger: a loose sheet of chart paper with the roster and the seating on it. */
	.lobby {
		width: min(48rem, 92vw);
		max-height: 100%;
		padding: 1.5rem 1.8rem 1.4rem;
		border-radius: 2px;
		background: var(--document);
		color: var(--slip-ink);
		box-shadow: var(--document-shadow);
		overflow: auto;
		animation: laid 420ms cubic-bezier(0.2, 0.9, 0.3, 1.1) both;
	}

	@keyframes laid {
		from {
			opacity: 0;
			translate: 0 1.5rem;
			rotate: -1.2deg;
		}
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 2.6rem;
		font-weight: 400;
		line-height: 1;
	}

	header {
		padding-bottom: 0.9rem;
		margin-bottom: 1rem;
		border-bottom: 1px solid rgb(42 32 23 / 0.25);
	}

	header p {
		margin: 0.35rem 0 0;
		color: var(--slip-muted);
		font-size: 0.92rem;
	}

	h2 {
		margin: 0 0 0.45rem;
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 400;
	}

	.columns {
		display: grid;
		grid-template-columns: 1.15fr 1fr;
		gap: 2rem;
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		margin: 0 0 0.9rem;
		padding: 0;
		list-style: none;
		font-size: 0.9rem;
	}

	li {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0.12rem 0;
		border-bottom: 1px dotted rgb(42 32 23 / 0.2);
	}

	li strong {
		font-family: var(--font-display);
		font-size: 1.02rem;
		font-weight: 400;
	}

	li span {
		color: var(--ink-good);
		font-size: 0.8rem;
	}

	li small,
	.empty,
	.jobtext {
		color: var(--slip-muted);
		font-size: 0.8rem;
	}

	li small {
		margin-left: auto;
		font-family: var(--font-display);
		font-style: italic;
	}

	li.dead {
		opacity: 0.55;
		text-decoration: line-through;
		text-decoration-color: var(--ink-danger);
	}

	form {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.45rem;
	}

	.jobtext {
		margin: 0.5rem 0 0;
		line-height: 1.35;
	}

	label {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 0.3rem;
		font-size: 0.88rem;
	}

	label span {
		width: 3.2rem;
		color: var(--slip-muted);
	}

	label select {
		flex: 1;
	}

	input,
	select,
	button {
		padding: 0.35rem 0.45rem;
		border: 0;
		border-bottom: 1px solid rgb(42 32 23 / 0.35);
		border-radius: 0;
		background: rgb(255 252 242 / 0.35);
		color: var(--slip-ink);
		font: inherit;
		font-size: 0.88rem;
	}

	input::placeholder {
		color: rgb(42 32 23 / 0.45);
	}

	input:focus,
	select:focus {
		outline: none;
		border-bottom-color: var(--slip-ink);
		background: rgb(255 252 242 / 0.6);
	}

	button {
		border: 1px solid rgb(42 32 23 / 0.4);
		border-radius: 2px;
		background: none;
		cursor: pointer;
		transition:
			background 150ms ease,
			border-color 150ms ease;
	}

	button:hover:not(:disabled) {
		border-color: var(--slip-ink);
		background: rgb(42 32 23 / 0.06);
	}

	button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.primary {
		border-color: var(--slip-ink);
		background: var(--slip-ink);
		color: #efe6d2;
		font-weight: 700;
	}

	.primary:hover:not(:disabled) {
		background: #3d3022;
	}

	.buttons {
		display: flex;
		gap: 0.5rem;
		margin: 0.7rem 0 1rem;
	}

	.buttons .primary {
		flex: 1;
		padding-block: 0.5rem;
	}

	.rationing {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 1rem;
	}

	.rationing button {
		width: 1.9rem;
		padding: 0.2rem 0;
	}

	.rationing strong {
		min-width: 1.5rem;
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 400;
		text-align: center;
	}

	.haven {
		display: inline-block;
		width: calc(50% - 0.2rem);
		margin: 0 0.4rem 0.35rem 0;
	}

	.haven:nth-of-type(2n) {
		margin-right: 0;
	}

	.record {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin: 0;
		font-size: 0.75rem;
	}

	.record span {
		padding: 0.02rem 0.35rem;
		border: 1px solid rgb(163 48 28 / 0.5);
		border-radius: 2px;
		color: var(--ink-danger);
	}

	.record span.won {
		border-color: rgb(61 107 85 / 0.6);
		color: var(--ink-good);
	}

	.score {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.35rem 2rem;
		margin: 0;
		font-size: 1rem;
	}

	.score dt {
		border-bottom: 1px dotted rgb(42 32 23 / 0.25);
	}

	.score dd {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.25rem;
		text-align: right;
	}
</style>
