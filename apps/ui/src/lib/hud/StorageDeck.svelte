<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { cityDef, pack } from '@repo/game';
	import type { Campaign, CardId } from '@repo/game';
	import { untrack } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { CITY_COLOR } from '#lib/board/CityMarker.svelte';
	import { sortHand } from './handOrder.ts';
	import { cardColor } from './PlayerCard.svelte';
	import { HOLLOW_COLOR } from './rich.ts';
	import type { Rich } from './rich.ts';
	import RichText from './RichText.svelte';

	type Props = {
		campaign: Campaign;
		onopen?: () => void;
	};

	let { campaign, onopen }: Props = $props();

	let open = $state(false);
	let buttonEl = $state<HTMLButtonElement>();

	const cityName = (id: Parameters<typeof cityDef>[0]) => campaign.names[id] ?? cityDef(id).name;

	const cardLabel = (id: CardId) => {
		const p = campaign.playerCards[id];
		if (p) {
			if (p.kind === 'city') return cityName(p.city);
			if (p.kind === 'event') return pack.events.find(e => e.id === p.event)?.name ?? p.event;
			return p.kind === 'produce' ? 'Produce Supplies' : 'Epidemic';
		}
		const inf = campaign.infectionCards[id];
		if (inf) {
			if (inf.kind === 'city') return cityName(inf.city);
			return inf.kind === 'gather' ? 'Hollow Men Gather' : 'Hollow Men Assemble';
		}
		return String(id);
	};

	const playerCards = $derived.by((): Rich => {
		const cards = sortHand(
			campaign.stored.player.flatMap(id => campaign.playerCards[id] ?? []),
			card => cardLabel(card.id),
		);
		const groups = new Map<string, { card: (typeof cards)[number]; count: number }>();
		for (const card of cards) {
			const key =
				card.kind === 'city' ? `city:${card.city}` : card.kind === 'event' ? `event:${card.event}` : card.kind;
			const hit = groups.get(key);
			if (hit) hit.count += 1;
			else groups.set(key, { card, count: 1 });
		}
		return [...groups.values()].flatMap(({ card, count }, index) => [
			...(index ? [', '] : []),
			{
				glyph:
					card.kind === 'epidemic'
						? ('epidemic' as const)
						: card.kind === 'event'
							? ('event' as const)
							: ('card' as const),
				color: cardColor(card),
				text: `${cardLabel(card.id)}${count > 1 ? ` ×${count}` : ''}`,
			},
		]);
	});

	const infectionCards = $derived.by((): Rich => {
		const counts = new Map<string, { color: string; name: string; count: number }>();
		for (const id of campaign.stored.infection) {
			const card = campaign.infectionCards[id];
			if (!card) continue;
			const key = card.kind === 'city' ? `city:${card.city}` : card.kind;
			const color = card.kind === 'city' ? CITY_COLOR[cityDef(card.city).color ?? 'haven'] : HOLLOW_COLOR;
			const name = cardLabel(id);
			const hit = counts.get(key);
			if (hit) hit.count += 1;
			else counts.set(key, { color, name, count: 1 });
		}
		return [...counts.values()]
			.toSorted((a, b) => b.count - a.count || a.name.localeCompare(b.name))
			.flatMap(({ color, name, count }, index) => [
				...(index ? [', '] : []),
				{
					glyph: 'infection' as const,
					color,
					text: `${name}${count > 1 ? ` ×${count}` : ''}`,
				},
			]);
	});

	const total = $derived(campaign.stored.player.length + campaign.stored.infection.length);
	const cap = pack.numbers.storageCap;
	const strikesStorage = $derived(campaign.rules.includes('epidemicFromStorage'));

	let prevTotal = untrack(() => total);
	$effect(() => {
		const now = total;
		untrack(() => {
			if (now > prevTotal && buttonEl) {
				buttonEl.animate([{ scale: '1' }, { scale: '1.22' }, { scale: '1' }], {
					duration: 420,
					delay: 640,
					easing: 'cubic-bezier(0.3, 1.6, 0.5, 1)',
				});
			}
			prevTotal = now;
		});
	});
</script>

<div
	class="storage-wrap"
	{@attach feedback('Package 6 inoculation deck', () => ({
		player: campaign.stored.player.length,
		infection: campaign.stored.infection.length,
		total,
	}))}
>
	<button
		class="storage"
		bind:this={buttonEl}
		onclick={() => {
			open = false;
			onopen?.();
		}}
		data-testid="storage-deck"
		data-dest="storage"
		aria-label={`Package 6 — Inoculation deck: ${total} cards stored`}
		aria-expanded={open}
		onpointerenter={() => (open = true)}
		onpointerleave={() => (open = false)}
		onfocus={() => (open = true)}
		onblur={() => (open = false)}
	>
		<span class="pkg-icon" aria-hidden="true">
			<span class="pkg-lid"></span>
			<b>6</b>
		</span>
		{#key total}<strong data-testid="storage-deck-count" in:fly={{ y: -8, duration: 260 }}>{total}</strong>{/key}
	</button>

	{#if open}
		<div class="tip" role="tooltip" data-testid="storage-deck-tip" transition:fade={{ duration: 140 }}>
			<strong>Package 6 · Inoculation deck</strong>
			<section>
				<h4>Player cards <b>{campaign.stored.player.length} / {cap}</b></h4>
				<p>
					{#if playerCards.length}<RichText text={playerCards} />{:else}none{/if}
				</p>
			</section>
			<section>
				<h4>Infection cards <b>{campaign.stored.infection.length} / {cap}</b></h4>
				<p>
					{#if infectionCards.length}<RichText text={infectionCards} />{:else}none{/if}
				</p>
			</section>
			<p class="note">
				{#if strikesStorage}
					<RichText text="Each Epidemic pulls a stored Infection card back out and strikes its city." />
				{:else}
					<RichText text="Inoculated City cards stay in Package 6, out of the decks." />
				{/if}
			</p>
		</div>
	{/if}
</div>

<style>
	.storage-wrap {
		position: relative;
		display: inline-flex;
		align-items: center;
		flex: none;
	}

	.storage {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.15rem 0.3rem;
		border: 0;
		border-radius: 4px;
		background: transparent;
		color: var(--ink);
		font: inherit;
		cursor: pointer;
	}

	.storage:hover {
		background: rgb(231 220 198 / 0.08);
	}

	.storage strong {
		font-size: 1.02rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.pkg-icon {
		position: relative;
		display: inline-grid;
		place-items: center;
		width: 1.45rem;
		height: 1.25rem;
		padding-top: 0.15rem;
		border: 1px solid #6b4c24;
		border-radius: 2px;
		background: linear-gradient(180deg, #b88e58, #946d3d);
		box-shadow:
			inset 0 0 0 1px rgb(255 244 214 / 0.18),
			2px -2px 0 -1px #4f3a1d,
			2px -2px 0 0 #7b5d34;
		color: #261808;
	}

	.pkg-lid {
		position: absolute;
		top: -1px;
		left: -1px;
		right: -1px;
		height: 0.28rem;
		border-bottom: 1px solid rgb(56 36 12 / 0.55);
		border-radius: 2px 2px 0 0;
		background: linear-gradient(180deg, #cea66f, #b08752);
	}

	.pkg-icon b {
		font-family: var(--font-display);
		font-size: 0.85rem;
		font-weight: 700;
		line-height: 1;
	}

	.tip {
		position: absolute;
		top: calc(100% + 0.55rem);
		left: 0;
		z-index: 65;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		width: 21rem;
		padding: 0.5rem 0.75rem 0.6rem;
		border-radius: 2px;
		background: var(--slip);
		box-shadow: var(--slip-shadow);
		color: var(--slip-ink);
		font-size: 0.78rem;
		line-height: 1.3;
		white-space: normal;
		pointer-events: none;
	}

	.tip > strong {
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 400;
	}

	section {
		padding-top: 0.35rem;
		border-top: 1px solid var(--slip-line);
	}

	.tip > strong + section {
		padding-top: 0;
		border-top: 0;
	}

	h4 {
		display: flex;
		justify-content: space-between;
		margin: 0 0 0.15rem;
		font-size: 0.73rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	p {
		margin: 0;
	}

	.note {
		margin-top: 0.1rem;
		padding-top: 0.3rem;
		border-top: 1px solid var(--slip-line);
		color: var(--slip-muted);
		font-style: italic;
	}
</style>
