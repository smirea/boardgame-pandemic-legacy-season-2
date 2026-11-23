<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack, reject } from '@repo/game';
	import type { CityId, Command, JobId, PlayerId, PublicState } from '@repo/game';
	import { flip } from 'svelte/animate';
	import { fade, fly } from 'svelte/transition';
	import { figureUrl, jobFigure, UNKNOWN_FIGURE } from '#lib/characters/figures.ts';
	import Portrait from '../Portrait.svelte';
	import { keep } from '../viewState.ts';
	import Exposure from './Exposure.svelte';
	import HavenChip from './HavenChip.svelte';
	import Sheet from './Sheet.svelte';
	import TraitPanel from './TraitPanel.svelte';

	type Props = {
		snap: PublicState;
		player: PlayerId;
		send: (command: Command) => void;
		/** The colour this player's next character plays in. */
		color: string | null;
		canRename: (city: CityId) => boolean;
		rename: (city: CityId, name: string) => void;
		look: (city: CityId | null) => void;
		/** Whether the list of havens is open, while the rest of the table steps aside for the map. */
		picking: boolean;
	};

	let { snap, player, send, color, canRename, rename, look, picking = $bindable() }: Props = $props();

	const world = $derived(snap.world);
	const campaign = $derived(world.campaign);
	// The table makes one character together: every screen shows and edits the same draft.
	const draft = $derived(world.table.draft);

	const havens = pack.cities.filter(city => city.kind === 'haven' && !city.lost).map(city => city.id);
	const portraits = Array.from({ length: pack.numbers.portraits }, (_, index) => index);
	const worn = $derived(
		new Set(
			Object.values(campaign.characters)
				.filter(character => !character.dead && !character.worker)
				.map(character => character.portrait),
		),
	);
	const faces = $derived(portraits.filter(index => !worn.has(index)));
	const face = $derived(draft.portrait !== null && !worn.has(draft.portrait) ? draft.portrait : null);

	// A found occupation comes with its own home and its own person.
	const homeOf = (id: JobId) =>
		pack.jobs.find(option => option.id === id)?.starting
			? null
			: (campaign.jobsFound.find(entry => entry.job === id)?.home ?? null);
	// Each occupation is asked of the engine with a stand-in name and home, so a blank field crosses out nothing.
	const jobs = $derived(
		pack.jobs
			.filter(option => option.starting || campaign.jobsFound.some(entry => entry.job === option.id))
			.map(option => ({
				...option,
				refusal: reject(world, snap.phase, {
					type: 'CREATE_CHARACTER',
					name: option.name,
					job: option.id,
					home: homeOf(option.id) ?? draft.home ?? havens[0]!,
					player,
				}),
			})),
	);
	const job = $derived(jobs.find(option => option.id === draft.job) ?? null);
	const own = $derived(job ? jobFigure(job.id) : null);
	const fixedHome = $derived(job ? homeOf(job.id) : null);
	const home = $derived(fixedHome ?? draft.home);
	const figure = $derived(own ? figureUrl(own) : face !== null ? figureUrl(`survivor-${face}`) : UNKNOWN_FIGURE);
	const card = $derived(campaign.characterCards[0]);

	// The name being typed here, sent a moment after each keystroke and shown instead of the table's until it is.
	let typing = $state<string | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;
	const named = $derived(typing ?? draft.name);
	function type(name: string) {
		typing = name;
		clearTimeout(timer);
		timer = setTimeout(() => send({ type: 'DRAFT', set: { name } }), 160);
	}
	function settle() {
		clearTimeout(timer);
		if (typing !== null && typing !== draft.name) send({ type: 'DRAFT', set: { name: typing } });
		typing = null;
	}
	$effect(() => () => clearTimeout(timer));
	keep(
		'character-creator',
		() => ({ typing, picking }),
		saved => {
			typing = saved.typing;
			picking = saved.picking;
		},
	);

	const create = $derived<Command | null>(
		job && home
			? {
					type: 'CREATE_CHARACTER',
					name: named.trim(),
					job: job.id,
					home,
					...(own || face === null ? {} : { portrait: face }),
					player,
				}
			: null,
	);
	const refusal = $derived(
		!job
			? 'Choose an occupation'
			: !own && face === null
				? 'Pick a face'
				: !home
					? 'Pick a home haven'
					: reject(world, snap.phase, create!),
	);
	function mint() {
		if (!create || refusal) return;
		clearTimeout(timer);
		send(create);
		typing = null;
	}

	const stones = $derived(job ? 1 + pack.numbers.characterSlots : jobs.length);
	const shownJobs = $derived(job ? [job] : jobs);
</script>

<article
	class="creator"
	aria-label="New character"
	data-testid="new-character"
	{@attach feedback('New character', () => ({ draft, refusal }))}
>
	<Sheet {figure} unknown={!own && face === null} tone="new" {color} fitted={named || 'New character'}>
		{#snippet name()}
			<input
				class="name"
				value={named}
				maxlength="24"
				placeholder="New character"
				aria-label="Character name"
				oninput={event => type(event.currentTarget.value)}
				onblur={settle}
				onkeydown={event => event.key === 'Enter' && event.currentTarget.blur()}
				data-testid="new-name"
			/>
		{/snippet}
		{#snippet meta()}
			{#if card}<Exposure track={card.track} exposure={card.exposure} />{/if}
			{#if job}
				<span class="home" in:fade={{ duration: 260, delay: 220 }}>
					<HavenChip
						{home}
						{canRename}
						{rename}
						options={fixedHome ? undefined : havens}
						pick={city => send({ type: 'DRAFT', set: { home: city } })}
						{look}
						bind:open={picking}
					/>
				</span>
			{/if}
		{/snippet}
		{#snippet arch()}
			{#each shownJobs as option, index (option.id)}
				<div
					class="stone"
					animate:flip={{ duration: 360 }}
					in:fly={{ x: 40, duration: 260, delay: index * 30 }}
					out:fly={{ x: 60, duration: 220 }}
				>
					<TraitPanel
						at={(index + 0.5) / stones}
						kind="job"
						label={job ? 'Occupation' : 'Choose an occupation'}
						name={option.name}
						text={option.text}
						refusal={job ? null : option.refusal}
						onclick={job ? undefined : () => send({ type: 'DRAFT', set: { job: option.id } })}
						testid={job ? undefined : `job-${option.id}`}
					>
						{#if job}
							<button
								type="button"
								class="change"
								onclick={() => send({ type: 'DRAFT', set: { job: null } })}
								data-testid="change-job">Change</button
							>
						{/if}
					</TraitPanel>
				</div>
			{/each}
			{#if job}
				{#each { length: pack.numbers.characterSlots } as _, index (index)}
					<div class="stone" in:fade={{ duration: 300, delay: 260 + index * 70 }}>
						<TraitPanel at={(index + 1.5) / stones} kind="empty" />
					</div>
				{/each}
			{/if}
		{/snippet}
		{#snippet over()}
			{#if !own}
				<div class="faces" role="radiogroup" aria-label="Face">
					{#each faces as index (index)}
						<button
							type="button"
							role="radio"
							class="face"
							aria-checked={face === index}
							aria-label={`Face ${index + 1}`}
							onclick={() => send({ type: 'DRAFT', set: { portrait: index } })}
							data-testid={`face-${index}`}
						>
							<Portrait portrait={index} color="#3a3128" />
						</button>
					{/each}
				</div>
			{/if}
		{/snippet}
		{#snippet base()}
			<button class="mint" disabled={refusal !== null} onclick={mint} data-testid="create-character"
				>Create &amp; take</button
			>
			<span class="why" aria-live="polite">{refusal ?? ''}</span>
		{/snippet}
	</Sheet>
</article>

<style>
	.creator {
		width: 100%;
		height: 100%;
	}

	.name {
		width: 100%;
		min-width: 0;
		padding: 0;
		border: 0;
		border-bottom: 1px dashed rgb(240 230 206 / 0.35);
		background: none;
		color: inherit;
		font: inherit;
		text-shadow: inherit;
	}

	.name::placeholder {
		color: rgb(240 230 206 / 0.38);
	}

	.name:focus {
		border-bottom-color: #e2c36a;
		outline: none;
	}

	.home {
		display: inline-flex;
		min-width: 0;
	}

	.stone {
		display: flex;
		flex: 1.5 1 0;
		flex-direction: column;
		min-height: 0;
	}

	.stone:has(:global(.empty)) {
		flex-grow: 0.8;
	}

	.change {
		align-self: center;
		flex: none;
		padding: 0.2em 0.6em;
		border: 1px solid rgb(226 195 106 / 0.55);
		border-radius: 999px;
		background: rgb(14 11 9 / 0.6);
		color: #e2c36a;
		font: inherit;
		font-size: 0.8em;
		cursor: pointer;
	}

	.change:hover,
	.change:focus-visible {
		border-color: #e2c36a;
		background: rgb(40 31 16 / 0.85);
		outline: none;
	}

	/* The faces still free, laid over the figure's foot: choosing one puts it on the shadow. */
	.faces {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.9cqh;
		max-width: 46cqw;
	}

	.face {
		position: relative;
		width: 7cqh;
		height: 7cqh;
		padding: 0;
		border: 2px solid rgb(240 230 206 / 0.35);
		border-radius: 50%;
		overflow: hidden;
		background: none;
		box-shadow: 0 0.4cqh 1.2cqh rgb(0 0 0 / 0.6);
		cursor: pointer;
		transition:
			transform 160ms ease,
			border-color 160ms ease;
	}

	.face:hover,
	.face:focus-visible {
		transform: translateY(-0.4cqh) scale(1.08);
		border-color: rgb(240 230 206 / 0.8);
		outline: none;
	}

	.face[aria-checked='true'] {
		border-color: #e2c36a;
		box-shadow:
			0 0 0 0.4cqh rgb(226 195 106 / 0.35),
			0 0.4cqh 1.2cqh rgb(0 0 0 / 0.6);
	}

	.mint {
		flex: none;
		padding: 0.3em 1em;
		border: 1px solid #e2c36a;
		border-radius: 0.3em;
		background: #e2c36a;
		color: #16110a;
		font: inherit;
		font-weight: 800;
		text-shadow: none;
		cursor: pointer;
		transition: opacity 200ms ease;
	}

	.mint:disabled {
		border-color: rgb(226 195 106 / 0.4);
		background: rgb(14 11 9 / 0.55);
		color: rgb(226 195 106 / 0.6);
		cursor: default;
	}

	.why {
		color: #b7a98e;
		font-size: 0.8em;
		white-space: nowrap;
	}
</style>
