<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import {
		cityDef,
		createGameActor,
		hasCityImprovementSlot,
		hasInfectionImprovementSlot,
		pack,
		paddedTrack,
		searchCardCompanion,
	} from '@repo/game';
	import type {
		CityImprovementId,
		ExposureBox,
		InfectionCard as InfectionCardData,
		InfectionImprovementId,
		PlayerCard as PlayerCardData,
	} from '@repo/game';
	import CharacterCardFace from '#lib/cards/CharacterCardFace.svelte';
	import InfectionCard from '#lib/cards/InfectionCard.svelte';
	import LegacyCard from '#lib/cards/LegacyCard.svelte';
	import { EVENT_PRINT } from '#lib/cards/playerPrint.ts';
	import { legacyScans } from '#lib/scans.generated.ts';
	import { characterCardScan, infectionCardScan, playerCardScan, scanUrl } from '#lib/scans.svelte.ts';
	import type { CardScan } from '#lib/scans.svelte.ts';
	import PlayerCard, { HAND_CARD_SIZE } from '#lib/hud/PlayerCard.svelte';
	import DebugCardStage from './DebugCardStage.svelte';
	import type { CardControl, UpgradeControl } from './DebugCardStage.svelte';

	type CharacterCardEntry = {
		id: string;
		label: string;
		track: readonly ExposureBox[];
		exposure: number;
	};

	const baseCampaign = createGameActor({ seed: 1 }).getSnapshot().context.world.campaign;

	function buildInitialPlayerCards(): PlayerCardData[] {
		const seen = new Set<string>();
		const cards: PlayerCardData[] = [];
		for (const raw of Object.values(baseCampaign.playerCards)) {
			if (raw.kind === 'event') continue;
			const key =
				raw.kind === 'city'
					? `city:${raw.city}:${raw.search.length > 0 ? 'search' : 'plain'}`
					: raw.kind === 'produce'
						? `produce:${raw.boxesLeft}`
						: raw.kind;
			if (seen.has(key)) continue;
			seen.add(key);
			cards.push(structuredClone(raw));
		}
		for (const [index, event] of pack.events.entries()) {
			cards.push({
				id: `event-${index}` as never,
				kind: 'event',
				event: event.id,
				mode: EVENT_PRINT[event.id].mode,
			});
		}
		return cards;
	}

	function buildInitialInfectionCards(): InfectionCardData[] {
		const seen = new Set<string>();
		const cards: InfectionCardData[] = [];
		for (const raw of Object.values(baseCampaign.infectionCards)) {
			if (raw.kind !== 'city') continue;
			if (seen.has(raw.city)) continue;
			seen.add(raw.city);
			cards.push(structuredClone(raw));
		}
		cards.push({ id: 'hollow-gather' as never, kind: 'gather' }, { id: 'hollow-assemble' as never, kind: 'assemble' });
		return cards;
	}

	function buildInitialCharacterCards(): CharacterCardEntry[] {
		return pack.characterCards.map((track, index) => ({
			id: `character-${String(index + 1).padStart(2, '0')}`,
			label: `Character ${String(index + 1).padStart(2, '0')}`,
			track: paddedTrack(track),
			exposure: 0,
		}));
	}

	let playerCards = $state<PlayerCardData[]>(buildInitialPlayerCards());
	let infectionCards = $state<InfectionCardData[]>(buildInitialInfectionCards());
	let characterCards = $state<CharacterCardEntry[]>(buildInitialCharacterCards());

	let size = $state(HAND_CARD_SIZE);
	let legacySize = $state<'full' | 'deck'>('full');
	let compareScans = $state(false);
	let cardFilter = $state('');
	let legacyFilter = $state('');

	function resetAll() {
		playerCards = buildInitialPlayerCards();
		infectionCards = buildInitialInfectionCards();
		characterCards = buildInitialCharacterCards();
	}

	function playerCardLabel(card: PlayerCardData): string {
		if (card.kind === 'city') {
			const name = cityDef(card.city).name;
			const comp = card.companion ? pack.companions.find(item => item.id === card.companion)?.name : '';
			const imp = card.improvement ? pack.cityImprovements.find(item => item.id === card.improvement)?.name : '';
			return `${card.id} ${card.city} ${name} ${card.search.length ? 'search' : 'plain'} ${comp ?? ''} ${imp ?? ''}`.toLowerCase();
		}
		if (card.kind === 'event') {
			const name = pack.events.find(item => item.id === card.event)?.name ?? card.event;
			return `${card.id} ${card.event} ${name} event ${card.mode}`.toLowerCase();
		}
		if (card.kind === 'produce') return `${card.id} produce supplies ${card.boxesLeft}`.toLowerCase();
		return `${card.id} epidemic`.toLowerCase();
	}

	function infectionCardLabel(card: InfectionCardData): string {
		if (card.kind === 'city') {
			const name = cityDef(card.city).name;
			const imp = card.improvement ? pack.infectionImprovements.find(item => item.id === card.improvement)?.name : '';
			return `${card.id} ${card.city} ${name} ${imp ?? ''}`.toLowerCase();
		}
		return `${card.id} hollow men ${card.kind}`.toLowerCase();
	}

	const query = $derived(cardFilter.trim().toLowerCase());
	const shownPlayerCards = $derived(
		query ? playerCards.filter(card => playerCardLabel(card).includes(query)) : playerCards,
	);
	const shownInfectionCards = $derived(
		query ? infectionCards.filter(card => infectionCardLabel(card).includes(query)) : infectionCards,
	);
	const shownCharacterCards = $derived(
		query
			? characterCards.filter(entry => `${entry.id} ${entry.label} character`.toLowerCase().includes(query))
			: characterCards,
	);
	const legacyCards = $derived(
		pack.legacyDeck.filter(card => !legacyFilter || `${card.id} ${card.kind} ${card.title}`.includes(legacyFilter)),
	);

	function playerControlsLabel(card: PlayerCardData): string {
		if (card.kind === 'city' && card.search.length > 0) return 'Search';
		if (card.kind === 'produce') return 'System-wide boxes';
		return 'Card state';
	}

	function playerControls(card: PlayerCardData): CardControl[] {
		if (card.kind === 'city' && card.search.length > 0) {
			return card.search.map((box, index) => {
				const single = card.search.length === 1;
				const label = single
					? box.scratched
						? 'Unsearch'
						: 'Search'
					: box.scope === 'land'
						? box.scratched
							? 'Unsearch land'
							: 'Search land'
						: box.scratched
							? 'Unsearch sea'
							: 'Search sea';
				return {
					id: single ? 'search' : `search-${box.scope}`,
					label,
					active: box.scratched,
					onclick: () => {
						box.scratched = !box.scratched;
						card.companion = searchCardCompanion(card.search);
					},
				};
			});
		}
		if (card.kind === 'produce') {
			return [1, 2, 3].map(count => ({
				id: `boxes-${count}`,
				label: `${count} box${count === 1 ? '' : 'es'}`,
				active: card.boxesLeft === count,
				onclick: () => {
					card.boxesLeft = count;
				},
			}));
		}
		return [];
	}

	function playerUpgrades(card: PlayerCardData): UpgradeControl[] {
		if (card.kind !== 'city') return [];
		return pack.cityImprovements.map(improvement => ({
			id: improvement.id,
			label: improvement.name,
			active: card.improvement === improvement.id,
			onclick: () => {
				card.improvement = card.improvement === improvement.id ? null : (improvement.id as CityImprovementId);
			},
		}));
	}

	function infectionUpgrades(card: InfectionCardData): UpgradeControl[] {
		if (card.kind !== 'city') return [];
		return pack.infectionImprovements.map(improvement => ({
			id: improvement.id,
			label: improvement.name,
			active: card.improvement === improvement.id,
			onclick: () => {
				card.improvement = card.improvement === improvement.id ? null : (improvement.id as InfectionImprovementId);
			},
		}));
	}

	function characterControls(entry: CharacterCardEntry): CardControl[] {
		const max = entry.track.length;
		return [
			{
				id: 'expose',
				label: 'Expose (+1)',
				disabled: entry.exposure >= max,
				onclick: () => {
					entry.exposure = Math.min(max, entry.exposure + 1);
				},
			},
			{
				id: 'unexpose',
				label: 'Unexpose (−1)',
				disabled: entry.exposure <= 0,
				onclick: () => {
					entry.exposure = Math.max(0, entry.exposure - 1);
				},
			},
			{
				id: 'reveal-all',
				label: 'Reveal all',
				disabled: entry.exposure >= max,
				onclick: () => {
					entry.exposure = max;
				},
			},
			{
				id: 'reset',
				label: 'Reset to base',
				disabled: entry.exposure <= 0,
				onclick: () => {
					entry.exposure = 0;
				},
			},
		];
	}

	function characterScanOf(entry: CharacterCardEntry): CardScan | null {
		const scan = characterCardScan(entry.track, entry.exposure);
		return scan ? { card: scan } : null;
	}
</script>

<svelte:head>
	<title>Legacy: cards</title>
</svelte:head>

<main
	style:--card-size={`${size}rem`}
	{@attach feedback('Card debug page', () => ({
		playerCards: shownPlayerCards.length,
		infectionCards: shownInfectionCards.length,
		characterCards: shownCharacterCards.length,
		compareScans,
	}))}
>
	<header>
		<h1>Cards</h1>
		<label>Size <input type="range" min="0.6" max="1.6" step="0.01" bind:value={size} /> {size.toFixed(2)}rem</label>
		<label><input type="checkbox" bind:checked={compareScans} data-testid="compare-scans" /> Compare scans</label>
		<label>Filter <input bind:value={cardFilter} placeholder="city, search, event, character" /></label>
		<button type="button" class="reset-btn" onclick={resetAll} data-testid="reset-all">Reset all to base</button>
		<label>
			Legacy size
			<select bind:value={legacySize}>
				<option value="full">full</option>
				<option value="deck">deck</option>
			</select>
		</label>
		<span data-testid="counts"
			>{shownPlayerCards.length} player, {shownInfectionCards.length} infection, {shownCharacterCards.length} character</span
		>
	</header>
	<p class="hint">
		All cards start at base state (unscratched searches, 0 exposure, no stickers). Hover or focus a card to toggle
		searches, exposure, or attach and remove upgrades. Hold <kbd>O</kbd> to swap faces with printed scans.
	</p>

	<h2>Player cards</h2>
	<section data-testid="player-cards">
		{#each shownPlayerCards as card (card.id)}
			<DebugCardStage
				id={card.id}
				kind="player"
				compare={compareScans}
				scan={compareScans ? playerCardScan(card) : null}
				controlsLabel={playerControlsLabel(card)}
				controls={playerControls(card)}
				upgrades={playerUpgrades(card)}
				noSlotNote={card.kind === 'city' && !hasCityImprovementSlot(card)}
				onremoveUpgrade={card.kind === 'city'
					? () => {
							card.improvement = null;
						}
					: undefined}
			>
				<PlayerCard {card} />
			</DebugCardStage>
		{/each}
	</section>

	<h2>Infection cards</h2>
	<section data-testid="infection-cards">
		{#each shownInfectionCards as card (card.id)}
			<DebugCardStage
				id={card.id}
				kind="infection"
				compare={compareScans}
				scan={compareScans ? infectionCardScan(card) : null}
				upgrades={infectionUpgrades(card)}
				noSlotNote={card.kind === 'city' && !hasInfectionImprovementSlot(card)}
				onremoveUpgrade={card.kind === 'city'
					? () => {
							card.improvement = null;
						}
					: undefined}
			>
				<InfectionCard {card} />
			</DebugCardStage>
		{/each}
	</section>

	<h2>Character cards</h2>
	<section data-testid="character-cards">
		{#each shownCharacterCards as entry (entry.id)}
			<DebugCardStage
				id={entry.id}
				kind="character"
				compare={compareScans}
				scan={compareScans ? characterScanOf(entry) : null}
				controlsLabel="Exposure"
				controls={characterControls(entry)}
			>
				<CharacterCardFace exposureTrack={entry.track} exposure={entry.exposure} label={entry.label} />
			</DebugCardStage>
		{/each}
	</section>

	<h2>Legacy deck, generated beside the printed original</h2>
	<label class="filter">Filter <input bind:value={legacyFilter} placeholder="id, kind or title" /></label>
	{#each legacyCards as card (card.id)}
		<section class="legacy" data-legacy-row={card.id}>
			<LegacyCard {card} side="a" size={legacySize} campaign={baseCampaign} />
			{#if legacyScans[card.id]?.back}<img
					src={scanUrl(legacyScans[card.id]!.back!)}
					alt={`${card.id}a printed`}
				/>{/if}
			<LegacyCard {card} side="b" size={legacySize} campaign={baseCampaign} />
			<img src={scanUrl(legacyScans[card.id]!.src)} alt={`${card.id}b printed`} />
		</section>
	{/each}
</main>

<style>
	main {
		min-height: 100vh;
		padding: 1.5rem 2rem 3rem;
		background: var(--table);
		color: var(--ink);
		font-family: var(--font-ui);
	}

	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.9rem 1.4rem;
		color: var(--muted);
		font-size: 0.9rem;
	}

	header label {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.reset-btn {
		padding: 0.28rem 0.65rem;
		border: 1px solid rgb(231 220 198 / 0.35);
		border-radius: 0.25rem;
		background: rgb(255 248 228 / 0.08);
		color: var(--ink);
		font: inherit;
		font-size: 0.84rem;
		cursor: pointer;
	}

	.reset-btn:hover {
		border-color: var(--paper);
		background: rgb(255 248 228 / 0.16);
	}

	.hint {
		margin: 0.65rem 0 0;
		color: var(--muted);
		font-size: 0.84rem;
		line-height: 1.4;
	}

	.hint kbd {
		padding: 0.05rem 0.32rem;
		border: 1px solid rgb(231 220 198 / 0.35);
		border-radius: 0.2rem;
		background: rgb(255 248 228 / 0.08);
		color: var(--ink);
		font-family: var(--font-ui);
		font-size: 0.78rem;
		font-weight: 700;
	}

	input[type='range'] {
		accent-color: var(--paper);
	}

	h1 {
		margin: 0;
		color: var(--ink);
		font-family: var(--font-display);
		font-size: 2.2rem;
		font-weight: 400;
	}

	h2 {
		margin: 1.8rem 0 0.8rem;
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 400;
	}

	.filter {
		display: block;
		margin-bottom: 0.8rem;
	}

	.legacy {
		align-items: center;
		margin-bottom: 1.2rem;
	}

	.legacy img {
		max-width: 23.5rem;
		max-height: 20.4rem;
		border-radius: 7px;
	}

	section {
		display: flex;
		flex-wrap: wrap;
		gap: 0.8rem;
	}
</style>
