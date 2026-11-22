<script lang="ts" module>
	import { cityDef } from '@repo/game';
	import type { PlayerCard } from '@repo/game';
	import { CITY_COLOR } from '#lib/board/CityMarker.svelte';
	import { EVENT_PRINT } from '#lib/cards/playerPrint.ts';

	/** The top of each face's gradient, which the face, its pile on a seat and its glyphs all wear. */
	export const FACE_COLOR = {
		rationed: '#e2ba46',
		unrationed: '#df9032',
		permanent: '#274782',
		produce: '#1e557e',
		epidemic: '#215729',
	} as const;

	export const KIND_COLOR = {
		event: FACE_COLOR.rationed,
		produce: FACE_COLOR.produce,
		epidemic: FACE_COLOR.epidemic,
	} as const;

	export const HAND_CARD_SIZE = 1.04;

	export const GLYPH = { event: '✦', produce: '▦', epidemic: '☣' } as const;

	export type CityCardCopies = { live: number; discarded: number; trashed: number };

	/** The colour a card is known by at a glance: its city's region, or its kind. */
	export function cardColor(card: PlayerCard): string {
		switch (card.kind) {
			case 'city':
				return CITY_COLOR[cityDef(card.city).color ?? 'haven'];
			case 'event':
				return FACE_COLOR[EVENT_PRINT[card.event].mode];
			default:
				return FACE_COLOR[card.kind];
		}
	}
</script>

<script lang="ts">
	import { getContext } from 'svelte';
	import type { CardId, CityId } from '@repo/game';
	import { pack } from '@repo/game';
	import { fitText } from '#lib/cards/fit.ts';
	import MapArt from '#lib/cards/MapArt.svelte';
	import {
		COMPANION_PRINT,
		EPIDEMIC_STEPS,
		IMPROVEMENT_PRINT,
		companionArtUrl,
		eventArtUrl,
		producePrint,
	} from '#lib/cards/playerPrint.ts';
	import { inkOn } from '#lib/color.ts';
	import { originals, playerCardScan, scanUrl } from '#lib/scans.svelte.ts';
	import RichText from './RichText.svelte';

	const hoverCard = getContext<((card: CardId | null) => void) | undefined>('card-hover');
	const copiesFromGame = getContext<((city: CityId) => CityCardCopies) | undefined>('card-copies');

	type Props = {
		card: PlayerCard;
		onclick?: () => void;
		tone?: 'play' | 'discard' | null;
		small?: boolean;
		/** Overrides live deck copy counts for a city card (used by debug showcases). */
		copies?: CityCardCopies;
	};

	let { card, onclick, tone = null, small = false, copies }: Props = $props();

	const EPIDEMIC_PLAIN = EPIDEMIC_STEPS.map(step => `${step.heading}: ${step.text}`).join(' ');

	const cityDetails = $derived.by(() => {
		if (card.kind !== 'city') return null;
		const city = cityDef(card.city);
		const improvement = card.improvement
			? (() => {
					const name = pack.cityImprovements.find(item => item.id === card.improvement)!.name;
					const print = IMPROVEMENT_PRINT[card.improvement];
					return { name, ...print, plain: `${name}: ${print.text}` };
				})()
			: null;
		const companion = card.companion
			? (() => {
					const name = pack.companions.find(item => item.id === card.companion)!.name;
					const print = COMPANION_PRINT[card.companion];
					return { id: card.companion, name, ...print, plain: `${name}: ${print.text}` };
				})()
			: null;
		const exposedSearches = card.search
			.filter(box => !box.scratched)
			.map(box => ({
				scope: box.scope,
				label:
					card.search.length > 1
						? box.scope === 'sea'
							? 'Search the sea'
							: 'Search the land'
						: box.scope === 'sea'
							? 'Search the sea'
							: 'Search',
			}));
		const floatingUpgrade = Boolean(improvement && companion);
		const diagonalUpgrade = Boolean(improvement && !companion);
		return { city, improvement, companion, exposedSearches, floatingUpgrade, diagonalUpgrade };
	});

	const cityCopies = $derived.by(() => {
		if (card.kind !== 'city') return null;
		const counts = copies ??
			copiesFromGame?.(card.city) ?? { live: cityDef(card.city).playerCards, discarded: 0, trashed: 0 };
		const parts = [
			counts.live > 0 && `${counts.live} in deck or hand`,
			counts.discarded > 0 && `${counts.discarded} discarded`,
			counts.trashed > 0 && `${counts.trashed} out of game`,
		].filter(Boolean);
		return { ...counts, label: parts.join(', ') || 'No copies remaining' };
	});

	const eventInfo = $derived.by(() => {
		if (card.kind !== 'event') return null;
		const def = pack.events.find(item => item.id === card.event)!;
		const print = EVENT_PRINT[card.event];
		return { name: def.name, print };
	});

	const produceInfo = $derived.by(() => {
		if (card.kind !== 'produce') return null;
		const print = producePrint(card.boxesLeft);
		const plain = `${print.localTitle}: ${print.local} OR ${print.systemTitle} ${print.uses}: ${print.system}`;
		return { print, plain, uses: Math.max(0, card.boxesLeft) };
	});

	const face = $derived.by(() => {
		switch (card.kind) {
			case 'city': {
				const { city, companion } = cityDetails!;
				return {
					title: city.name,
					kicker: small && companion ? companion.name : '',
					color: cardColor(card),
				};
			}
			case 'event': {
				const { name, print } = eventInfo!;
				return {
					title: name,
					kicker: print.banner,
					color: cardColor(card),
				};
			}
			case 'produce':
				return {
					title: 'Produce Supplies',
					kicker: `${card.boxesLeft} ${card.boxesLeft === 1 ? 'use' : 'uses'} left`,
					color: cardColor(card),
				};
			case 'epidemic':
				return {
					title: 'Epidemic',
					kicker: '1-Increase · 2-Infect · 3-Intensify',
					color: cardColor(card),
				};
		}
	});

	const originalScan = $derived(small ? null : playerCardScan(card));
	const showingOriginal = $derived(originals.held && Boolean(originalScan));
	const floatUpgradeActive = $derived(!small && !showingOriginal && Boolean(cityDetails?.floatingUpgrade));
</script>

{#snippet portAnchor()}
	<svg class="port-anchor" viewBox="0 0 24 24" role="img" aria-label="Port">
		<circle cx="12" cy="5" r="2.3" fill="none" stroke="currentColor" stroke-width="2.1" />
		<path d="M12 7.3V20M7.5 10.4h9" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" />
		<path
			d="M4.6 14.4a7.4 7.4 0 0 0 14.8 0"
			fill="none"
			stroke="currentColor"
			stroke-width="2.2"
			stroke-linecap="round"
		/>
		<path
			d="M2.6 15.8 4.6 13.1l2.4 1.9M17 15l2.4-1.9 2 2.7"
			fill="none"
			stroke="currentColor"
			stroke-width="1.9"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
{/snippet}

{#snippet upgradeBody(improvement: NonNullable<NonNullable<typeof cityDetails>['improvement']>)}
	<span class="slip-head">
		{#if improvement.swatch === 'wild'}
			<i class="swatch-wild" aria-hidden="true"></i>
		{:else if improvement.swatch === 'red'}
			<i class="swatch-red" aria-hidden="true"></i>
		{/if}
		<strong>{improvement.name}:</strong>
	</span>
	<RichText text={improvement.text} />
{/snippet}

<button
	class="card {card.kind}"
	class:unrationed={eventInfo?.print.mode === 'unrationed'}
	class:permanent={eventInfo?.print.mode === 'permanent'}
	class:floating-upgrade={floatUpgradeActive}
	data-card={card.id}
	data-original-active={showingOriginal}
	data-floating-upgrade={floatUpgradeActive ? '' : undefined}
	onmouseenter={() => hoverCard?.(card.id)}
	onmouseleave={() => hoverCard?.(null)}
	onfocus={() => hoverCard?.(card.id)}
	onblur={() => hoverCard?.(null)}
	class:small
	class:play={tone === 'play'}
	class:discard={tone === 'discard'}
	style:--band={face.color}
	style:--on={inkOn(face.color)}
	disabled={!onclick}
	{onclick}
>
	{#if showingOriginal && originalScan}
		<img class="original-swap" src={scanUrl(originalScan.card.src)} alt={face.title} />
		{#if originalScan.sticker}
			<img class="original-sticker" src={scanUrl(originalScan.sticker.src)} alt={originalScan.sticker.title} />
		{/if}
	{:else if small}
		{#if card.kind === 'city' && cityDetails}
			<span class="head small-city">
				<span class="city-title-row">
					<span class="title" {@attach fitText(face.title, { max: 1.15, min: 0.56, across: true })}>{face.title}</span>
					{#if cityDetails.city.port}{@render portAnchor()}{/if}
				</span>
				{#if face.kicker}<span class="kicker">{face.kicker}</span>{/if}
			</span>
		{:else}
			<span class="head">
				<span class="kicker">{face.kicker}</span>
				<span class="title" {@attach fitText(face.title, { max: 1.18, min: 0.7, across: true })}>{face.title}</span>
			</span>
		{/if}
	{:else if card.kind === 'city' && cityDetails && cityCopies}
		<span class="city-face">
			<span class="city-head">
				<span class="title" {@attach fitText(face.title, { max: 1.24, min: 0.52, across: true })}>{face.title}</span>
				{#if cityDetails.city.port}{@render portAnchor()}{/if}
			</span>
			<span class="art">
				{#if cityDetails.companion}
					<img class="companion-art" src={companionArtUrl(cityDetails.companion.id)} alt="" aria-hidden="true" />
					{#if cityDetails.exposedSearches.length > 0}
						<span class="search-stack top">
							{#each cityDetails.exposedSearches as search, index (index)}
								<span class="search-chip" role="note" aria-label={search.label}>{search.label}</span>
							{/each}
						</span>
					{/if}
					<span class="companion-scrim">
						<span class="overlay-kicker">Companion</span>
						<span class="companion-fit" {@attach fitText(cityDetails.companion.plain, { max: 0.74, min: 0.44 })}>
							<span class="slip-head">
								<strong>{cityDetails.companion.name}:</strong>
								{#if cityDetails.companion.cards}
									{#each cityDetails.companion.cards as letter (letter)}
										<i class="mini-red-card">{letter}</i>
									{/each}
								{/if}
							</span>
							<RichText text={cityDetails.companion.text} />
						</span>
					</span>
				{:else}
					<MapArt city={card.city} accent={face.color} />
					{#if cityDetails.diagonalUpgrade && cityDetails.improvement}
						<span
							class="upgrade-sticker upgrade-diagonal"
							class:above-one={cityDetails.exposedSearches.length === 1}
							class:above-two={cityDetails.exposedSearches.length >= 2}
						>
							<span class="sticker-fit" {@attach fitText(cityDetails.improvement.plain, { max: 0.76, min: 0.46 })}>
								{@render upgradeBody(cityDetails.improvement)}
							</span>
						</span>
					{/if}
					{#if cityDetails.exposedSearches.length > 0}
						<span class="search-stack" class:compact={cityDetails.diagonalUpgrade}>
							{#each cityDetails.exposedSearches as search, index (index)}
								<span class="search-chip" role="note" aria-label={search.label}>{search.label}</span>
							{/each}
						</span>
					{/if}
				{/if}
			</span>
			<span class="foot">
				<span class="pips" role="img" aria-label={cityCopies.label}>
					{#each { length: cityCopies.live } as _, index (`l${index}`)}
						<i class="pip live" aria-hidden="true"></i>
					{/each}
					{#each { length: cityCopies.discarded } as _, index (`d${index}`)}
						<i class="pip discarded" aria-hidden="true"></i>
					{/each}
					{#each { length: cityCopies.trashed } as _, index (`t${index}`)}
						<svg class="pip-trash" viewBox="0 0 16 16" aria-hidden="true">
							<path
								d="M5.5 2.5h5M2.8 4.2h10.4M4.3 4.2l.7 8.4a1.1 1.1 0 0 0 1.1 1h3.8a1.1 1.1 0 0 0 1.1-1l.7-8.4M6.8 6.8v4.3M9.2 6.8v4.3"
								fill="none"
								stroke="currentColor"
								stroke-width="1.45"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					{/each}
				</span>
			</span>
		</span>
		{#if cityDetails.floatingUpgrade && cityDetails.improvement}
			<span class="upgrade-sticker upgrade-float">
				<span class="sticker-fit" {@attach fitText(cityDetails.improvement.plain, { max: 0.72, min: 0.46 })}>
					{@render upgradeBody(cityDetails.improvement)}
				</span>
			</span>
		{/if}
	{:else if card.kind === 'event' && eventInfo}
		<span class="ev-top">
			<span class="ev-kicker-row">
				<span class="ev-kicker">{eventInfo.print.banner}</span>
				{#if eventInfo.print.destroy}
					<span class="ev-once">Destroy</span>
				{/if}
			</span>
			<span class="ev-title" {@attach fitText(eventInfo.name, { max: 1.08, min: 0.54, across: true })}
				>{eventInfo.name}</span
			>
		</span>
		{#if eventInfo.print.mode === 'unrationed'}
			<span class="ev-hazard" aria-hidden="true"></span>
		{/if}
		<span class="ev-body" class:has-leaf={Boolean(eventInfo.print.timing)}>
			<img class="ev-art" src={eventArtUrl(card.event)} alt="" aria-hidden="true" />
			<span class="ev-rules" {@attach fitText(eventInfo.print.rules.join(' '), { max: 0.94, min: 0.5 })}>
				{#each eventInfo.print.rules as line, idx (idx)}
					<span class="rule-line"><RichText text={line} /></span>
				{/each}
			</span>
			{#if eventInfo.print.timing}
				<span class="ev-leaf">{eventInfo.print.timing}</span>
			{/if}
		</span>
	{:else if card.kind === 'produce' && produceInfo}
		<span class="prod-top">
			<span class="prod-head" {@attach fitText('PRODUCE SUPPLIES', { max: 1.04, min: 0.62, across: true })}
				>PRODUCE SUPPLIES</span
			>
		</span>
		<span class="prod-body" {@attach fitText(produceInfo.plain, { max: 0.9, min: 0.5 })}>
			<span class="prod-choice">
				<span class="prod-label">{produceInfo.print.localTitle}</span>
				<span class="prod-text"><RichText text={produceInfo.print.local} /></span>
			</span>
			<span class="prod-or">OR</span>
			<span class="prod-choice">
				<span class="prod-label-row">
					<span class="prod-label">{produceInfo.print.systemTitle}</span>
					<span class="prod-uses" class:last={produceInfo.uses <= 1}>{produceInfo.print.uses}</span>
				</span>
				<span class="prod-text"><RichText text={produceInfo.print.system} /></span>
			</span>
		</span>
	{:else if card.kind === 'epidemic'}
		<span class="ep-top">
			<span class="ep-title">EPIDEMIC</span>
		</span>
		<span class="ep-body" {@attach fitText(EPIDEMIC_PLAIN, { max: 0.78, min: 0.48 })}>
			<svg class="ep-art" viewBox="0 0 24 24" aria-hidden="true">
				<circle cx="12" cy="12" r="2.2" fill="currentColor" />
				<path
					d="M12 4.2a4.3 4.3 0 0 0-3.7 6.5l1.5-.9a2.6 2.6 0 1 1 4.4 0l1.5.9A4.3 4.3 0 0 0 12 4.2Zm-6.8 11.7a4.3 4.3 0 0 0 7.4-.1l-1.5-.9a2.6 2.6 0 1 1-2.2-3.8V9.4a4.3 4.3 0 0 0-3.7 6.5Zm13.6 0a4.3 4.3 0 0 0-3.7-6.5v1.7a2.6 2.6 0 1 1-2.2 3.8l-1.5.9a4.3 4.3 0 0 0 7.4.1Z"
					fill="currentColor"
				/>
			</svg>
			{#each EPIDEMIC_STEPS as step (step.heading)}
				<span class="ep-step">
					<strong>{step.heading}</strong>
					<span><RichText text={step.text} /></span>
				</span>
			{/each}
		</span>
	{/if}
</button>

<style>
	/* A player card is printed solid in its region's colour, with the map inset like a plate on the front. */
	.card {
		--soft: color-mix(in srgb, var(--on) 72%, transparent);
		position: relative;
		display: flex;
		flex-direction: column;
		width: 8.4em;
		height: 10.6em;
		flex: none;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--band) 55%, #000);
		border-radius: 0.4em;
		background:
			radial-gradient(ellipse at 20% 0%, rgb(255 248 228 / 0.22), transparent 60%),
			linear-gradient(172deg, var(--band), color-mix(in srgb, var(--band) 80%, #140c06));
		color: var(--on);
		font-family: var(--font-ui);
		font-size: var(--card-size, 0.73rem);
		text-align: left;
		overflow: hidden;
		box-shadow:
			inset 0 0 0 0.22em rgb(255 248 228 / 0.14),
			0 0.15em 0.3em rgb(0 0 0 / 0.35),
			0 0.6em 1.4em rgb(0 0 0 / 0.25);
		transition:
			box-shadow 200ms ease,
			outline-color 200ms ease;
		outline: 2px solid transparent;
		outline-offset: 2px;
	}

	.card.small {
		width: 7.6em;
		height: 3em;
	}

	/* Scale inline glyphs with fitted card text and allow multi-word phrases to wrap after the glyph+first-word pair. */
	.card :global(.glyphed) {
		white-space: normal;
	}

	.card :global(.glyph.supplies),
	.card :global(.glyph.plague) {
		width: 0.72em;
		height: 0.72em;
	}

	.card :global(.glyph.hollow) {
		width: 0.7em;
		height: 0.88em;
	}

	.card :global(.glyph.card) {
		width: 0.66em;
		height: 0.9em;
	}

	.card :global(.glyph.infection) {
		width: 0.9em;
		height: 0.66em;
	}

	.card :global(.glyph.center) {
		width: 0.92em;
		height: 0.92em;
	}

	.card :global(.glyph.tower) {
		width: 0.74em;
		height: 0.98em;
		background:
			radial-gradient(circle at 50% 18%, currentColor 0 0.18em, transparent 0.19em),
			linear-gradient(currentColor, currentColor) center 0.22em / 0.13em 100% no-repeat;
	}

	.card :global(.glyph.shelter) {
		width: 0.94em;
		height: 0.52em;
		border-radius: 0.52em 0.52em 0 0;
	}

	.original-swap {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.original-sticker {
		position: absolute;
		left: 11%;
		top: 50%;
		width: 78%;
		height: auto;
		transform: translateY(-50%);
		border-radius: 0.16em;
		box-shadow: 0 1px 4px rgb(0 0 0 / 0.45);
		pointer-events: none;
	}

	.card:not(:disabled) {
		cursor: pointer;
	}

	.card.play {
		outline-color: var(--warn);
	}

	.card.discard {
		outline-color: var(--danger);
	}

	/* City cards drop the inner inset frame so the map runs truly full bleed to the outer edge. */
	.card.city:not(.small) {
		box-shadow:
			0 0.15em 0.3em rgb(0 0 0 / 0.35),
			0 0.6em 1.4em rgb(0 0 0 / 0.25);
	}

	.card.floating-upgrade {
		overflow: visible;
	}

	.city-face {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		border-radius: calc(0.4em - 1px);
		overflow: hidden;
	}

	.head {
		display: flex;
		flex-direction: column;
		padding: 0.45em 0.55em 0.3em;
	}

	.small-city {
		justify-content: center;
		gap: 0.06em;
		height: 100%;
		padding: 0.24em 0.46em;
	}

	.city-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.26em;
		height: 1.72em;
		padding: 0 0.46em;
		flex: none;
	}

	.city-title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.24em;
		min-width: 0;
	}

	.kicker {
		color: var(--soft);
		font-size: 0.64em;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
	}

	.title {
		font-family: var(--font-display);
		line-height: 1.02;
		overflow: hidden;
		overflow-wrap: normal;
	}

	.city-head .title,
	.city-title-row .title {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
	}

	.port-anchor {
		flex: none;
		width: 0.96em;
		height: 0.96em;
		color: var(--on);
		opacity: 0.92;
	}

	.art {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.companion-art {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center 20%;
	}

	.search-stack {
		position: absolute;
		left: 0.34em;
		right: 0.34em;
		bottom: 0.32em;
		z-index: 2;
		display: flex;
		flex-direction: column;
		gap: 0.22em;
	}

	.search-stack.compact {
		bottom: 0.24em;
		gap: 0.16em;
	}

	.search-stack.top {
		top: 0.28em;
		bottom: auto;
	}

	.search-chip {
		display: block;
		padding: 0.24em 0.38em;
		border: 1px solid rgb(24 30 36 / 0.38);
		border-radius: 0.2em;
		background:
			repeating-linear-gradient(-35deg, rgb(255 255 255 / 0.22) 0 0.24em, transparent 0.24em 0.52em),
			rgb(220 229 233 / 0.74);
		backdrop-filter: blur(1.5px);
		box-shadow: 0 0.08em 0.22em rgb(0 0 0 / 0.22);
		color: #14191e;
		font-size: 0.56em;
		font-weight: 850;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		line-height: 1.1;
		text-align: center;
	}

	.search-stack.compact .search-chip,
	.search-stack.top .search-chip {
		padding: 0.18em 0.34em;
		font-size: 0.52em;
	}

	.companion-scrim {
		position: absolute;
		inset: auto 0 0 0;
		z-index: 2;
		display: flex;
		flex-direction: column;
		gap: 0.1em;
		max-height: 4.9em;
		padding: 1.25em 0.44em 0.34em;
		background: linear-gradient(
			to top,
			rgb(12 10 8 / 0.94) 0%,
			rgb(12 10 8 / 0.84) 68%,
			rgb(12 10 8 / 0.36) 88%,
			transparent 100%
		);
		color: #f5eee0;
		overflow: hidden;
	}

	.overlay-kicker {
		flex: none;
		font-size: 0.48em;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #d8c296;
		line-height: 1;
	}

	.companion-scrim .slip-head strong {
		color: #f7de9a;
	}

	.companion-fit,
	.sticker-fit {
		display: block;
		flex: 0 1 auto;
		min-height: 0;
		overflow: hidden;
		line-height: 1.2;
	}

	.upgrade-sticker {
		display: flex;
		flex-direction: column;
		padding: 0.36em 0.48em;
		border: 1px solid rgb(34 25 16 / 0.45);
		border-radius: 0.22em;
		background: linear-gradient(168deg, #fcf7ea, #eee2c4);
		color: #1a140e;
		box-shadow: 0 0.2em 0.55em rgb(0 0 0 / 0.44);
		overflow: hidden;
	}

	.upgrade-diagonal {
		position: absolute;
		left: 50%;
		top: 50%;
		z-index: 3;
		width: 7.5em;
		max-height: 4.5em;
		transform: translate(-50%, -50%) rotate(-7deg);
	}

	.upgrade-diagonal.above-one {
		top: 2.85em;
		max-height: 4.1em;
		transform: translate(-50%, -50%) rotate(-5.5deg);
	}

	.upgrade-diagonal.above-two {
		top: 2.32em;
		width: 7.6em;
		max-height: 3.65em;
		padding: 0.28em 0.42em;
		transform: translate(-50%, -50%) rotate(-4.5deg);
	}

	.upgrade-float {
		position: absolute;
		left: 50%;
		bottom: calc(100% + 0.34em);
		z-index: 4;
		width: 8.6em;
		max-height: 3.7em;
		padding: 0.3em 0.44em;
		transform: translateX(-50%);
		border-bottom: 0.18em solid color-mix(in srgb, var(--band) 78%, #1a140e);
		box-shadow:
			0 0.28em 0.75em rgb(0 0 0 / 0.52),
			0 0 0 1px rgb(255 250 238 / 0.22);
	}

	.slip-head {
		display: inline-flex;
		align-items: center;
		gap: 0.24em;
		margin-right: 0.22em;
	}

	.swatch-wild {
		display: inline-block;
		width: 0.85em;
		height: 0.85em;
		border-radius: 50%;
		background: conic-gradient(#24211f 0 90deg, #c44536 90deg 180deg, #e5bc34 180deg 270deg, #3973a8 270deg 360deg);
		border: 1px solid rgb(0 0 0 / 0.3);
		flex: none;
	}

	.swatch-red {
		display: inline-block;
		width: 0.65em;
		height: 0.85em;
		border-radius: 1.5px;
		background: #c44536;
		border: 1px solid rgb(0 0 0 / 0.25);
		flex: none;
	}

	.mini-red-card {
		display: inline-grid;
		place-items: center;
		width: 1.05em;
		height: 1.25em;
		border-radius: 1.5px;
		background: #c44536;
		color: #fff;
		font-style: normal;
		font-size: 0.82em;
		font-weight: 800;
	}

	.foot {
		display: flex;
		align-items: center;
		height: 1.45em;
		padding: 0 0.48em;
		flex: none;
	}

	.pips {
		display: flex;
		align-items: center;
		gap: 0.22em;
	}

	.pip {
		display: block;
		width: 0.44em;
		height: 0.44em;
		border-radius: 50%;
		flex: none;
	}

	.pip.live {
		background: var(--on);
	}

	.pip.discarded {
		border: 0.1em solid var(--on);
		background: transparent;
		box-sizing: border-box;
		opacity: 0.85;
	}

	.pip-trash {
		display: block;
		width: 0.72em;
		height: 0.72em;
		flex: none;
		color: var(--on);
		opacity: 0.84;
	}

	/* === Event cards === */
	.card.event:not(.small) {
		padding: 0;
		gap: 0;
		background:
			radial-gradient(ellipse at 18% 12%, rgb(255 247 210 / 0.28), transparent 58%),
			linear-gradient(170deg, var(--band), #bc8e1d);
		border-color: #7c580b;
		color: #181209;
		box-shadow:
			0 0.15em 0.3em rgb(0 0 0 / 0.35),
			0 0.6em 1.4em rgb(0 0 0 / 0.25);
	}

	.card.event.unrationed:not(.small) {
		background:
			radial-gradient(ellipse at 18% 12%, rgb(255 232 195 / 0.24), transparent 58%),
			linear-gradient(170deg, var(--band), #b55e18);
		border-color: #69300a;
		color: #191007;
	}

	.card.event.permanent:not(.small) {
		background:
			radial-gradient(ellipse at 18% 12%, rgb(160 205 255 / 0.16), transparent 58%),
			linear-gradient(170deg, var(--band), #15294e);
		border-color: #101e3b;
		color: #f0f5ff;
	}

	.ev-top {
		display: flex;
		flex-direction: column;
		gap: 0.08em;
		padding: 0.34em 0.5em 0.34em;
		background: linear-gradient(165deg, #1b221c, #101511);
		color: #a6e39d;
		flex: none;
	}

	.card.event.unrationed .ev-top {
		color: #ffd89b;
	}

	.card.event.permanent .ev-top {
		background: #eef3fb;
		color: #193263;
	}

	.ev-kicker-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.35em;
	}

	.ev-kicker {
		font-size: 0.54em;
		font-weight: 800;
		font-style: italic;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: #f4d678;
	}

	.card.event.unrationed .ev-kicker {
		color: #f6a962;
	}

	.card.event.permanent .ev-kicker {
		color: #466196;
	}

	.ev-once {
		font-size: 0.5em;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #ff8e7b;
		line-height: 1;
	}

	.ev-title {
		font-family: var(--font-display);
		line-height: 0.98;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.ev-hazard {
		display: block;
		flex: none;
		height: 0.22em;
		background: repeating-linear-gradient(-45deg, #c24b1c 0 0.34em, #18110c 0.34em 0.68em);
	}

	.ev-body {
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.ev-art {
		position: absolute;
		right: -11%;
		bottom: -11%;
		z-index: 0;
		width: 82%;
		height: 82%;
		object-fit: contain;
		object-position: right bottom;
		opacity: 0.21;
		mix-blend-mode: multiply;
		pointer-events: none;
		user-select: none;
	}

	.card.event.permanent .ev-art {
		filter: invert(1);
		opacity: 0.22;
		mix-blend-mode: screen;
	}

	.ev-rules {
		position: relative;
		z-index: 1;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		gap: 0.35em;
		padding: 0.48em 0.52em 0.52em;
		overflow: hidden;
		font-weight: 500;
		line-height: 1.24;
	}

	.ev-body.has-leaf .ev-rules {
		padding-bottom: 1.55em;
	}

	.rule-line {
		display: block;
	}

	.ev-leaf {
		position: absolute;
		left: 0;
		bottom: 0;
		z-index: 2;
		padding: 0.22em 0.62em 0.2em 0.48em;
		border-radius: 0 0.65em 0 0;
		background: #171d18;
		color: #f3e6c2;
		font-size: 0.54em;
		font-weight: 700;
		letter-spacing: 0.02em;
		line-height: 1.1;
		white-space: nowrap;
	}

	.card.event.unrationed .ev-leaf {
		color: #ffd89b;
	}

	/* === Produce Supplies === */
	.card.produce:not(.small) {
		padding: 0;
		gap: 0;
		background:
			radial-gradient(ellipse at 20% 10%, rgb(135 200 245 / 0.16), transparent 58%),
			linear-gradient(170deg, var(--band), #11314a);
		border-color: #0b2234;
		color: #f2f7fb;
		box-shadow:
			0 0.15em 0.3em rgb(0 0 0 / 0.35),
			0 0.6em 1.4em rgb(0 0 0 / 0.25);
	}

	.prod-top {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.36em 0.46em 0.32em;
		background: rgb(7 20 33 / 0.58);
		border-bottom: 1px solid rgb(226 241 252 / 0.16);
		flex: none;
	}

	.prod-head {
		width: 100%;
		font-family: var(--font-display);
		letter-spacing: 0.04em;
		line-height: 1.02;
		text-align: center;
		white-space: nowrap;
		color: #ffffff;
	}

	.prod-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-evenly;
		gap: 0.32em;
		padding: 0.48em 0.56em 0.54em;
		overflow: hidden;
		line-height: 1.24;
	}

	.prod-choice {
		display: flex;
		flex-direction: column;
		gap: 0.16em;
	}

	.prod-label-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.35em;
	}

	.prod-label {
		font-size: 0.84em;
		font-weight: 800;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: #f3d74b;
		line-height: 1.1;
	}

	.prod-uses {
		font-size: 0.72em;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: #c5e2f6;
		white-space: nowrap;
	}

	.prod-uses.last {
		color: #ff9c7a;
	}

	.prod-text {
		display: block;
		color: #f4f9fd;
	}

	.prod-or {
		display: flex;
		align-items: center;
		gap: 0.4em;
		font-weight: 800;
		font-size: 0.78em;
		letter-spacing: 0.08em;
		color: #b7daf0;
		line-height: 1;
	}

	.prod-or::before,
	.prod-or::after {
		content: '';
		flex: 1;
		height: 1px;
		background: rgb(183 218 240 / 0.42);
	}

	/* === Epidemic === */
	.card.epidemic:not(.small) {
		padding: 0;
		gap: 0;
		background:
			radial-gradient(circle at 50% 45%, rgb(130 210 95 / 0.16), transparent 65%),
			linear-gradient(168deg, var(--band), #123318);
		border-color: #0e1d10;
		color: #f6ea8e;
		box-shadow:
			0 0.15em 0.3em rgb(0 0 0 / 0.35),
			0 0.6em 1.4em rgb(0 0 0 / 0.25);
	}

	.ep-top {
		padding: 0.34em 0.4em 0.3em;
		border-bottom: 1.5px solid rgb(244 238 204 / 0.42);
		background: linear-gradient(180deg, #d86d24, #ecc63b);
		text-align: center;
		flex: none;
	}

	.ep-title {
		font-family: var(--font-display);
		font-size: 1.06em;
		font-weight: 700;
		letter-spacing: 0.06em;
		color: #8f1d14;
		line-height: 1;
	}

	.ep-body {
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 0.34em;
		padding: 0.46em 0.52em 0.5em;
		overflow: hidden;
		line-height: 1.22;
	}

	.ep-art {
		position: absolute;
		right: -14%;
		bottom: -14%;
		z-index: 0;
		width: 72%;
		height: 72%;
		color: #0a1f0d;
		opacity: 0.32;
		pointer-events: none;
	}

	.ep-step {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 0.04em;
	}

	.ep-step strong {
		color: #ffffff;
		font-style: italic;
		letter-spacing: 0.02em;
	}
</style>
