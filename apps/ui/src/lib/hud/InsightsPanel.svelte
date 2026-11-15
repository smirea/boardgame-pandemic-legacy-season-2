<script lang="ts">
	import type { CardId, CityId, Insights, World } from '@repo/game';
	import { cityName, seatName } from './labels.svelte.ts';

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
			.map(entry => {
				switch (entry.t) {
					case 'turn':
						return { seq: entry.seq, tone: 'head', text: `${seatName(world, entry.seat)}'s turn` };
					case 'move':
						return { seq: entry.seq, tone: '', text: `${seatName(world, entry.seat)} to ${cityName(entry.to)}` };
					case 'draw':
						return { seq: entry.seq, tone: '', text: `${seatName(world, entry.seat)} draws a card` };
					case 'epidemic':
						return {
							seq: entry.seq,
							tone: 'bad',
							text: `Epidemic${entry.city ? ` in ${cityName(entry.city)}, ${entry.removed} cubes lost` : ''}. Rate ${entry.rate}`,
						};
					case 'infect':
						return {
							seq: entry.seq,
							tone: entry.effect === 'supply' || entry.effect === 'blocked' ? '' : 'bad',
							text: `${cityName(entry.city)}: ${{ supply: 'lost a cube', plague: 'plague cube', outbreak: 'outbreak', hollow: 'Hollow Men arrive', skipped: 'forsaken, skipped', blocked: 'held firm' }[entry.effect]}`,
						};
					case 'incident':
						return { seq: entry.seq, tone: 'bad', text: `Incident ${entry.total} in ${cityName(entry.city)}` };
					case 'exposure':
						return {
							seq: entry.seq,
							tone: entry.result === 'empty' ? '' : 'bad',
							text: `${seatName(world, entry.seat)} is exposed: ${{ empty: 'nothing', scar: 'a scar', skull: 'death', worker: 'sent home' }[entry.result]}`,
						};
					case 'connected':
						return { seq: entry.seq, tone: 'good', text: `${cityName(entry.city)} joins the grid` };
					case 'structure':
						return {
							seq: entry.seq,
							tone: 'good',
							text: `${{ center: 'Supply center', tower: 'Tower', shelter: 'Shelter' }[entry.structure]} in ${cityName(entry.city)}`,
						};
					case 'objective':
						return { seq: entry.seq, tone: 'good', text: 'Objective complete' };
					case 'unlock':
						return {
							seq: entry.seq,
							tone: 'good',
							text: `New content opened${entry.forced ? ' by a perimeter report' : ''}`,
						};
					case 'search':
						return {
							seq: entry.seq,
							tone: '',
							text: `${seatName(world, entry.seat)} searches ${cityName(entry.city)}`,
						};
					case 'end':
						return {
							seq: entry.seq,
							tone: entry.won ? 'good' : 'bad',
							text: entry.won ? 'Victory' : `Defeat: ${entry.reason}`,
						};
					default:
						return null;
				}
			})
			.filter(line => line !== null),
	);
</script>

<section class="panel">
	<nav>
		<button class:on={tab === 'threats'} onclick={() => (tab = 'threats')}>Threats</button>
		<button class:on={tab === 'decks'} onclick={() => (tab = 'decks')}>Decks</button>
		<button class:on={tab === 'log'} onclick={() => (tab = 'log')}>Log</button>
	</nav>

	{#if tab === 'threats'}
		<p class="hint">Next Infect step flips {info.infection.rate}. Incidents left: {info.incidentsLeft}.</p>
		{#if info.infection.atRisk.length === 0}
			<p class="calm">No unsupplied city can be hit next turn.</p>
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
	.panel {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		max-height: 100%;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--line);
		border-radius: 0.5rem;
		background: var(--panel);
		backdrop-filter: blur(8px);
		font-size: 0.7rem;
		overflow: hidden auto;
	}

	nav {
		display: flex;
		gap: 0.25rem;
	}

	nav button {
		flex: 1;
		padding: 0.2rem;
		border: 0;
		border-radius: 0.3rem;
		background: none;
		color: var(--muted);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	nav button.on {
		background: rgb(255 255 255 / 0.08);
		color: var(--ink);
	}

	.hint,
	.calm {
		margin: 0.15rem 0 0;
		color: var(--muted);
		font-size: 0.64rem;
	}

	.calm {
		color: var(--accent);
	}

	ul,
	ol {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
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
		padding: 0.18rem 0.4rem;
		border: 0;
		border-radius: 0.25rem;
		background: rgb(255 255 255 / 0.04);
		color: var(--ink);
		font: inherit;
		cursor: pointer;
		overflow: hidden;
	}

	.bar {
		position: absolute;
		inset: 0 auto 0 0;
		background: rgb(255 107 107 / 0.22);
		transition: width 400ms ease;
	}

	.name,
	li b,
	li em {
		position: relative;
	}

	li b {
		margin-left: auto;
	}

	li em {
		color: var(--danger);
		font-size: 0.6rem;
		font-style: normal;
		text-transform: uppercase;
	}

	.lockdown {
		padding: 0.2rem 0.5rem;
		border: 1px solid var(--warn);
		border-radius: 0.3rem;
		background: none;
		color: var(--warn);
		font: inherit;
		cursor: pointer;
	}

	.stratum {
		display: flex;
		gap: 0.4rem;
		padding: 0.25rem 0.35rem;
		border-radius: 0.3rem;
		background: rgb(255 255 255 / 0.04);
	}

	.size {
		color: var(--warn);
		font-weight: 700;
	}

	.cards {
		display: flex;
		flex-wrap: wrap;
		gap: 0.1rem 0.45rem;
		color: var(--ink);
	}

	ol li {
		color: var(--muted);
	}

	ol li.head {
		margin-top: 0.25rem;
		color: var(--ink);
		font-weight: 650;
	}

	ol li.bad {
		color: var(--danger);
	}

	ol li.good {
		color: var(--accent);
	}
</style>
