<script lang="ts">
	import type { CardId, CityId, Insights, World } from '@repo/game';
	import { cityName, logLine } from './labels.svelte.ts';

	type Props = { world: World; info: Insights; onfocus: (city: CityId) => void; onlockdown: (card: CardId) => void };

	let { world, info, onfocus, onlockdown }: Props = $props();

	let tab = $state<'threats' | 'decks' | 'log'>('threats');
	const percent = (value: number) => `${Math.round(value * 100)}%`;
	const entries = (record: Record<string, number>) =>
		Object.entries(record).sort((a, b) => b[1] - a[1]) as [CityId | 'hollow', number][];
	const label = (city: CityId | 'hollow') => (city === 'hollow' ? 'Hollow Men' : cityName(city));
	const game = $derived(world.game!);
	const lockable = $derived(
		game.infectionDiscard.flatMap(id => {
			const card = world.campaign.infectionCards[id];
			return card?.kind === 'city' && card.improvement === 'lockdown' ? [{ id, city: card.city }] : [];
		}),
	);

	const lines = $derived(
		game.log
			.slice(-60)
			.reverse()
			.flatMap(entry => {
				const line = logLine(world, entry);
				return line ? [{ seq: entry.seq, ...line }] : [];
			}),
	);
</script>

<section class="panel">
	<nav>
		<button class:on={tab === 'threats'} onclick={() => (tab = 'threats')}>Threats</button>
		<button class:on={tab === 'decks'} onclick={() => (tab = 'decks')}>Decks</button>
		<button class:on={tab === 'log'} onclick={() => (tab = 'log')}>Log</button>
	</nav>

	{#if tab === 'threats'}
		<p class="hint">
			{#if info.infection.opening}
				The opening infection flips {info.infection.rate} cards{world.campaign.rules.includes('hollowSetup')
					? ', then 3 more that place Hollow Men'
					: ''}. A city with no cubes takes a plague cube.
			{:else}
				Next Infect step flips {info.infection.rate}. Incidents left: {info.incidentsLeft}.
			{/if}
		</p>
		{#if info.infection.atRisk.length === 0}
			<p class="calm">
				{info.infection.opening
					? 'Every city that can be hit holds a cube.'
					: 'No unsupplied city can be hit next turn.'}
			</p>
		{/if}
		<ul>
			{#each info.infection.atRisk.slice(0, 9) as risk (risk.city)}
				<li>
					<button onclick={() => onfocus(risk.city)}>
						<span class="bar" style:width={percent(risk.odds)}></span>
						<span class="name">{cityName(risk.city)}</span>
						{#if risk.outbreak}<em>outbreak</em>{/if}
						<b>{percent(risk.odds)}</b>
					</button>
				</li>
			{/each}
		</ul>
	{:else if tab === 'decks'}
		<p class="hint">Infection deck, top layer first. Cards in a layer come in an unknown order.</p>
		{#each info.infection.strata as stratum, index (index)}
			<div class="stratum">
				<span class="size">{stratum.size}</span>
				<span class="cards">
					{#each entries(stratum.cities) as [city, count] (city)}
						<span>{label(city)}{count > 1 ? ` ×${count}` : ''}</span>
					{/each}
				</span>
			</div>
		{/each}
		<p class="hint">Infection discard</p>
		<div class="stratum">
			<span class="cards">
				{#each entries(info.infection.discard) as [city, count] (city)}
					<span>{label(city)}{count > 1 ? ` ×${count}` : ''}</span>
				{:else}
					<span>empty</span>
				{/each}
			</span>
		</div>
		{#each lockable as card (card.id)}
			<button
				class="lockdown"
				onclick={() => onlockdown(card.id)}
				title="Lockdown: destroy this Infection card for good">Destroy {cityName(card.city)}</button
			>
		{/each}
		<p class="hint">Player deck, {info.playerDeck.cards} cards</p>
		<div class="stratum">
			<span class="cards">
				{#each entries(info.playerDeck.byKind) as [kind, count] (kind)}
					<span>{kind} ×{count}</span>
				{/each}
			</span>
		</div>
		{#if info.playerDeck.epidemicWithin}
			<p class="hint">An epidemic comes within {info.playerDeck.epidemicWithin} draws.</p>
		{/if}
	{:else}
		<ol>
			{#each lines as line (line.seq)}
				<li class={line.tone}>{line.text}</li>
			{/each}
		</ol>
	{/if}
</section>

<style>
	/* A field note on the chart: what the next infection is likely to hit, the decks, and the log. */
	.panel {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		max-height: 100%;
		padding: 0.4rem 0.6rem 0.6rem;
		border-radius: 2px;
		background: var(--slip);
		color: var(--slip-ink);
		box-shadow: var(--slip-shadow);
		rotate: 0.35deg;
		font-size: 0.78rem;
		overflow: hidden auto;
		scrollbar-width: thin;
	}

	nav {
		display: flex;
		gap: 0.2rem;
		border-bottom: 1px solid var(--slip-line);
	}

	nav button {
		flex: 1;
		margin-bottom: -1px;
		padding: 0.2rem 0.2rem 0.3rem;
		border: 0;
		border-bottom: 2px solid transparent;
		background: none;
		color: var(--slip-muted);
		font: inherit;
		font-family: var(--font-display);
		font-size: 0.95rem;
		cursor: pointer;
		transition:
			color 150ms ease,
			border-color 150ms ease;
	}

	nav button:hover {
		color: var(--slip-ink);
	}

	nav button.on {
		border-bottom-color: var(--slip-ink);
		color: var(--slip-ink);
	}

	.hint,
	.calm {
		margin: 0.15rem 0 0;
		color: var(--slip-muted);
		font-size: 0.74rem;
		line-height: 1.3;
	}

	.calm {
		color: var(--ink-good);
	}

	ul,
	ol {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li button {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		width: 100%;
		padding: 0.14rem 0.35rem;
		border: 0;
		border-bottom: 1px dotted var(--slip-line);
		background: none;
		color: var(--slip-ink);
		font: inherit;
		cursor: pointer;
		overflow: hidden;
	}

	li button:hover {
		background: rgb(60 44 28 / 0.06);
	}

	.bar {
		position: absolute;
		inset: 0 auto 0 0;
		background: rgb(163 48 28 / 0.16);
		transition: width 400ms ease;
	}

	.name,
	li b,
	li em {
		position: relative;
	}

	li b {
		margin-left: auto;
		font-weight: 600;
	}

	li em {
		color: var(--ink-danger);
		font-size: 0.7rem;
	}

	.lockdown {
		padding: 0.2rem 0.5rem;
		border: 1px solid var(--ink-warn);
		border-radius: 2px;
		background: none;
		color: var(--ink-warn);
		font: inherit;
		cursor: pointer;
	}

	.stratum {
		display: flex;
		gap: 0.45rem;
		padding: 0.2rem 0.35rem;
		border-left: 2px solid var(--slip-line);
	}

	.size {
		color: var(--ink-warn);
		font-weight: 700;
	}

	.cards {
		display: flex;
		flex-wrap: wrap;
		gap: 0.1rem 0.45rem;
	}

	ol li {
		color: var(--slip-muted);
		line-height: 1.3;
	}

	ol li.head {
		margin-top: 0.3rem;
		color: var(--slip-ink);
		font-weight: 600;
	}

	ol li.bad {
		color: var(--ink-danger);
	}

	ol li.good {
		color: var(--ink-good);
	}
</style>
