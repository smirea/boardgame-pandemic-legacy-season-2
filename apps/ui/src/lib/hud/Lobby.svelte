<script lang="ts">
	import { pack, score } from '@repo/game';
	import type { CharacterId, CityId, Command, JobId, PublicState, SeatId } from '@repo/game';
	import { untrack } from 'svelte';
	import { cityName, MONTHS } from './labels';

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
	let seats = $state<(CharacterId | 'worker' | '')[]>(['', '', '', '']);

	$effect(() => {
		if (!job || !freeJobs.some(candidate => candidate.id === job)) job = freeJobs[0]?.id ?? '';
	});
	// Seats default to the first living characters so a returning group starts with one click.
	$effect(() => {
		const ids = living.map(character => character.id);
		untrack(() => {
			let next = seats.map(seat => (seat === '' || seat === 'worker' || ids.includes(seat) ? seat : ''));
			if (next.every(seat => seat === '') && ids.length >= 2) next = [ids[0]!, ids[1]!, '', ''];
			if (next.some((seat, index) => seat !== seats[index])) seats = next;
		});
	});

	const seating = $derived(
		seats.flatMap((choice, index) =>
			choice === '' ? [] : [{ seat: `seat-${index + 1}` as SeatId, character: choice === 'worker' ? null : choice }],
		),
	);
	const startCommand = $derived<Command>({ type: 'START_GAME', seating });
</script>

<div class="lobby">
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
				{#each seats as _, index (index)}
					<label>
						<span>Seat {index + 1}</span>
						<select bind:value={seats[index]}>
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
	.lobby {
		width: min(46rem, 92vw);
		padding: 1.4rem 1.6rem;
		border: 1px solid var(--line);
		border-radius: 0.9rem;
		background: var(--panel);
		backdrop-filter: blur(14px);
		box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 0.5);
	}

	h1 {
		margin: 0;
		font-size: 1.7rem;
		letter-spacing: -0.01em;
	}

	header p {
		margin: 0.3rem 0 1rem;
		color: var(--muted);
		font-size: 0.85rem;
	}

	h2 {
		margin: 0 0 0.5rem;
		color: var(--muted);
		font-size: 0.65rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.columns {
		display: grid;
		grid-template-columns: 1.2fr 1fr;
		gap: 1.6rem;
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin: 0 0 0.8rem;
		padding: 0;
		list-style: none;
		font-size: 0.82rem;
	}

	li {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	li span {
		color: var(--accent);
		font-size: 0.72rem;
	}

	li small,
	.empty,
	.jobtext {
		color: var(--muted);
		font-size: 0.72rem;
	}

	li small {
		margin-left: auto;
	}

	li.dead {
		opacity: 0.5;
		text-decoration: line-through;
	}

	form {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem;
	}

	.jobtext {
		margin: 0.5rem 0 0;
	}

	label {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 0.4rem;
		font-size: 0.8rem;
	}

	label span {
		width: 3.2rem;
		color: var(--muted);
	}

	label select {
		flex: 1;
	}

	input,
	select,
	button {
		padding: 0.4rem 0.55rem;
		border: 1px solid var(--line);
		border-radius: 0.4rem;
		background: rgb(255 255 255 / 0.05);
		color: var(--ink);
		font: inherit;
		font-size: 0.8rem;
	}

	button {
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.buttons {
		display: flex;
		gap: 0.5rem;
		margin: 0.8rem 0 1rem;
	}

	.primary {
		flex: 1;
		border-color: var(--accent);
		background: var(--accent);
		color: #06120c;
		font-weight: 700;
	}

	.record {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin: 0;
		font-size: 0.65rem;
	}

	.record span {
		padding: 0.05rem 0.35rem;
		border-radius: 0.25rem;
		background: rgb(255 107 107 / 0.18);
		color: var(--danger);
	}

	.record span.won {
		background: rgb(125 252 192 / 0.16);
		color: var(--accent);
	}

	.score {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.3rem 2rem;
		margin: 0;
		font-size: 0.9rem;
	}

	.score dd {
		margin: 0;
		font-weight: 700;
		text-align: right;
	}
</style>
