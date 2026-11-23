<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack, sealKey } from '@repo/game';
	import type { Campaign, CityId, GameChronicle, GameResult } from '@repo/game';
	import { cityName, MONTHS } from './labels.svelte.ts';

	let { campaign }: { campaign: Campaign } = $props();

	const STRUCTURE = { center: 'supply center', tower: 'tower', shelter: 'shelter' };
	const REASON = { plague: 'plague', hollow: 'Hollow Men', center: 'supply center' };
	const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
	const list = (items: string[]) =>
		items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
	const cities = (ids: CityId[]) => list(ids.map(cityName));
	const jobName = (id: GameChronicle['crew'][number]['job']) => pack.jobs.find(job => job.id === id)?.name;

	/** The game as the Chronicler writes it down: one line for each kind of thing that happened, in the order it matters. */
	function lines(result: GameResult, log: GameChronicle): { tone: 'plain' | 'bad' | 'good'; text: string }[] {
		const out: { tone: 'plain' | 'bad' | 'good'; text: string }[] = [];
		out.push({
			tone: 'plain',
			text: `${result.won ? 'The grid held' : 'The grid fell'} after ${plural(log.turns, 'turn')}, through ${plural(log.incidents, 'incident')} and ${plural(log.epidemics, 'Epidemic')}.${result.won || !log.reason ? '' : ` ${log.reason}.`}`,
		});
		for (const death of log.deaths)
			out.push({ tone: 'bad', text: `${death.character} died in ${cityName(death.at)}.` });
		for (const scar of log.scars)
			out.push({
				tone: 'bad',
				text: `${scar.character} came back${scar.at ? ` from ${cityName(scar.at)}` : ''} scarred: ${pack.scars.find(def => def.id === scar.scar)?.name}.`,
			});
		if (log.objectives.length)
			out.push({
				tone: 'good',
				text: `Done: ${list(log.objectives.map(id => pack.objectives.find(objective => objective.id === id)!.name))}.`,
			});
		if (log.revealed.length)
			out.push({
				tone: 'good',
				text: `Charted: ${list(log.revealed.map(id => pack.regions.find(region => region.id === id)?.name ?? id))}.`,
			});
		if (log.opened.length)
			out.push({
				tone: 'plain',
				text: `Opened: ${list(log.opened.map(key => pack.seals.find(def => sealKey(def.seal) === key)?.name ?? key))}.`,
			});
		if (log.connected.length) out.push({ tone: 'good', text: `Joined the grid: ${cities(log.connected)}.` });
		for (const kind of ['center', 'tower', 'shelter'] as const) {
			const built = log.built.filter(entry => entry.structure === kind).map(entry => entry.city);
			if (built.length)
				out.push({
					tone: 'plain',
					text: `${built.length === 1 ? `A ${STRUCTURE[kind]}` : `${built.length} ${STRUCTURE[kind]}s`} went up in ${cities(built)}.`,
				});
		}
		const grew = log.population.filter(change => change.delta > 0);
		const shrank = log.population.filter(change => change.delta < 0);
		if (grew.length) out.push({ tone: 'good', text: `Grew: ${cities(grew.map(change => change.city))}.` });
		if (shrank.length)
			out.push({
				tone: 'bad',
				text: `Lost people: ${list(shrank.map(change => `${cityName(change.city)} (${REASON[change.reason]})`))}.`,
			});
		return out;
	}

	// Newest first: the page the table just wrote is the one it opens to.
	const pages = $derived(campaign.results.map((result, index) => ({ result, index })).toReversed());
</script>

<div class="logbook" data-testid="logbook" {@attach feedback('Logbook', () => ({ games: campaign.results.length }))}>
	{#if !pages.length}
		<p class="empty">Nothing is written here yet. Each game played adds a page.</p>
	{/if}
	{#each pages as { result, index } (index)}
		{@const log = result.chronicle}
		<article class="page" class:won={result.won} data-testid="logbook-page">
			<header>
				<h4>{MONTHS[result.month]}{result.attempt === 2 ? ', second attempt' : ''}</h4>
				<span class="verdict">{result.won ? 'Won' : 'Lost'}</span>
			</header>
			{#if log}
				<p class="crew">
					{#each log.crew as member, at (at)}
						<span
							><b>{member.character}</b>{jobName(member.job) ? `, ${jobName(member.job)}` : ''}{member.player
								? ` (${member.player})`
								: ''}</span
						>
					{/each}
				</p>
				<ul>
					{#each lines(result, log) as line, at (at)}
						<li class={line.tone}>{line.text}</li>
					{/each}
				</ul>
			{:else}
				<p class="unkept">No page was kept for this game.</p>
			{/if}
		</article>
	{/each}
</div>

<style>
	.logbook {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(21rem, 1fr));
		gap: 0.9rem;
		margin-top: 1rem;
		max-height: 34rem;
		padding-right: 0.3rem;
		overflow: auto;
	}

	.page {
		padding: 0.7rem 0.9rem 0.8rem;
		border: 1px solid rgb(60 44 28 / 0.3);
		border-left: 4px solid var(--ink-danger);
		border-radius: 2px;
		background: rgb(255 255 255 / 0.25);
		font-size: 0.88rem;
		line-height: 1.4;
	}

	.page.won {
		border-left-color: #3f7a55;
	}

	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.6rem;
	}

	h4 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 400;
	}

	.verdict {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-danger);
	}

	.won .verdict {
		color: #3f7a55;
	}

	.crew {
		display: flex;
		flex-wrap: wrap;
		gap: 0.1rem 0.9rem;
		margin: 0.25rem 0 0.4rem;
		color: var(--paper-muted);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		padding-left: 0.7rem;
		border-left: 2px solid transparent;
	}

	li + li {
		margin-top: 0.15rem;
	}

	li.bad {
		border-left-color: var(--ink-danger);
	}

	li.good {
		border-left-color: #3f7a55;
	}

	.unkept,
	.empty {
		margin: 0.3rem 0 0;
		color: var(--paper-muted);
		font-style: italic;
	}
</style>
