<script lang="ts" module>
	import { cityDef } from '@repo/game';
	import type { PlayerCard } from '@repo/game';
	import { CITY_COLOR } from '#lib/board/CityMarker.svelte';

	export const KIND_COLOR = {
		event: '#b08628',
		produce: '#8d8476',
		epidemic: '#a8261c',
	} as const;

	export const GLYPH = { event: '✦', produce: '▦', epidemic: '☣' } as const;

	/** The colour a card is known by at a glance: its city's region, or its kind. */
	export const cardColor = (card: PlayerCard) =>
		card.kind === 'city' ? CITY_COLOR[cityDef(card.city).color ?? 'haven'] : KIND_COLOR[card.kind];
</script>

<script lang="ts">
	import { getContext } from 'svelte';
	import type { CardId } from '@repo/game';
	import { pack } from '@repo/game';
	import { fitText } from '#lib/cards/fit.ts';
	import MapArt from '#lib/cards/MapArt.svelte';
	import {
		COMPANION_PRINT,
		EPIDEMIC_STEPS,
		EVENT_PRINT,
		IMPROVEMENT_PRINT,
		eventPlainText,
		producePrint,
	} from '#lib/cards/playerPrint.ts';
	import { inkOn } from '#lib/color.ts';
	import { legacyScans } from '#lib/scans.generated.ts';
	import { eventScan, originals, scanUrl } from '#lib/scans.svelte.ts';
	import RichText from './RichText.svelte';

	const hoverCard = getContext<((card: CardId | null) => void) | undefined>('card-hover');

	type Props = { card: PlayerCard; onclick?: () => void; tone?: 'play' | 'discard' | null; small?: boolean };

	let { card, onclick, tone = null, small = false }: Props = $props();

	const EPIDEMIC_PLAIN = EPIDEMIC_STEPS.map(step => `${step.heading}: ${step.text}`).join(' ');

	const cityDetails = $derived.by(() => {
		if (card.kind !== 'city') return null;
		const city = cityDef(card.city);
		const improvement = card.improvement
			? {
					name: pack.cityImprovements.find(item => item.id === card.improvement)!.name,
					...IMPROVEMENT_PRINT[card.improvement],
				}
			: null;
		const companion = card.companion
			? {
					name: pack.companions.find(item => item.id === card.companion)!.name,
					...COMPANION_PRINT[card.companion],
				}
			: null;
		const plain = [
			improvement && `${improvement.name}: ${improvement.text}`,
			companion && `Companion: ${companion.name}. ${companion.text}`,
		]
			.filter(Boolean)
			.join(' ');
		return { city, improvement, companion, plain };
	});

	const eventInfo = $derived.by(() => {
		if (card.kind !== 'event') return null;
		const def = pack.events.find(item => item.id === card.event)!;
		const print = EVENT_PRINT[card.event];
		return { name: def.name, print, plain: eventPlainText(card.event) };
	});

	const produceInfo = $derived.by(() => {
		if (card.kind !== 'produce') return null;
		const print = producePrint(card.boxesLeft);
		const plain = `${print.lead} ${print.local} OR ${print.system} ${print.check} ${print.footer}`;
		return { print, plain, boxes: Math.max(0, card.boxesLeft) };
	});

	const face = $derived.by(() => {
		switch (card.kind) {
			case 'city': {
				const { city, companion, plain } = cityDetails!;
				return {
					title: city.name,
					kicker: companion ? `${city.port ? 'Port' : 'City'} · ${companion.name}` : city.port ? 'Port' : 'City',
					color: cardColor(card),
					text: plain,
				};
			}
			case 'event': {
				const { name, print, plain } = eventInfo!;
				return {
					title: name,
					kicker: print.banner,
					color: cardColor(card),
					text: plain,
				};
			}
			case 'produce':
				return {
					title: 'Produce Supplies',
					kicker: `${card.boxesLeft} system-wide left`,
					color: cardColor(card),
					text: produceInfo!.plain,
				};
			case 'epidemic':
				return {
					title: 'Epidemic',
					kicker: '1-Increase · 2-Infect · 3-Intensify',
					color: cardColor(card),
					text: EPIDEMIC_PLAIN,
				};
		}
	});

	const originalScan = $derived.by(() => {
		if (small) return null;
		if (card.kind === 'event') return eventScan(card.event)[0] ?? null;
		if (card.kind === 'epidemic') return legacyScans['03-07'] ?? null;
		if (card.kind === 'produce') {
			const n = Math.min(3, Math.max(1, card.boxesLeft));
			return { title: 'Produce Supplies', src: `base/player-deck/produce-supplies-0${n}.jpg` };
		}
		return null;
	});
</script>

<button
	class="card {card.kind}"
	class:unrationed={eventInfo?.print.mode === 'unrationed'}
	class:permanent={eventInfo?.print.mode === 'permanent'}
	data-card={card.id}
	data-original-active={originals.held && Boolean(originalScan)}
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
	title={face.text}
>
	{#if originals.held && originalScan}
		<img class="original-swap" src={scanUrl(originalScan.src)} alt={face.title} />
	{:else if small}
		<span class="head">
			<span class="kicker">{face.kicker}</span>
			<span class="title" {@attach fitText(face.title, { max: 1.18, min: 0.7, across: true })}>{face.title}</span>
		</span>
	{:else if card.kind === 'city' && cityDetails}
		<span class="head">
			<span class="kicker">{face.kicker}</span>
			<span class="title" {@attach fitText(face.title, { max: 1.18, min: 0.7, across: true })}>{face.title}</span>
		</span>
		<span class="art" class:compact={Boolean(cityDetails.improvement || cityDetails.companion)}>
			<MapArt city={card.city} accent={face.color} />
		</span>
		{#if cityDetails.improvement || cityDetails.companion}
			<span class="city-slip" {@attach fitText(cityDetails.plain, { max: 0.68, min: 0.38 })}>
				{#if cityDetails.improvement}
					<span class="slip-block">
						<span class="slip-head">
							{#if cityDetails.improvement.swatch === 'wild'}
								<i class="swatch-wild" aria-hidden="true"></i>
							{:else if cityDetails.improvement.swatch === 'red'}
								<i class="swatch-red" aria-hidden="true"></i>
							{/if}
							<strong>{cityDetails.improvement.name}:</strong>
						</span>
						<RichText text={cityDetails.improvement.text} />
					</span>
				{/if}
				{#if cityDetails.companion}
					<span class="slip-block">
						<span class="slip-head">
							<strong>Companion: {cityDetails.companion.name}</strong>
							{#if cityDetails.companion.cards}
								{#each cityDetails.companion.cards as letter (letter)}
									<i class="mini-red-card">{letter}</i>
								{/each}
							{/if}
						</span>
						<RichText text={cityDetails.companion.text} />
					</span>
				{/if}
			</span>
		{/if}
		<span class="foot">
			<span class="pips" title="Population when the campaign began">
				{#each { length: cityDetails.city.population } as _, index (index)}<i></i>{/each}
			</span>
			{#each card.search as box, index (index)}
				<span class="box" class:used={box.scratched} title={`${box.scope} search${box.scratched ? ', used' : ''}`}
					>{box.scope === 'sea' ? '≈' : '⌕'}</span
				>
			{/each}
		</span>
	{:else if card.kind === 'event' && eventInfo}
		<span class="ev-top">
			<span class="ev-kicker">{eventInfo.print.banner}</span>
			<span class="ev-title" {@attach fitText(eventInfo.name, { max: 1.05, min: 0.65, across: true })}
				>{eventInfo.name}</span
			>
		</span>
		<span class="ev-body" class:striped={eventInfo.print.mode === 'unrationed'}>
			<span class="ev-rules" {@attach fitText(eventInfo.plain, { max: 0.72, min: 0.36 })}>
				{#each eventInfo.print.rules as line, idx (idx)}
					<span class="rule-line"><RichText text={line} /></span>
				{/each}
				{#if eventInfo.print.destroy}
					<span class="ev-destroy">{eventInfo.print.destroy}</span>
				{/if}
			</span>
			{#if eventInfo.print.timing}
				<span class="ev-timing">{eventInfo.print.timing}</span>
			{/if}
		</span>
	{:else if card.kind === 'produce' && produceInfo}
		<span class="prod-head">PRODUCE SUPPLIES</span>
		<span class="prod-body" {@attach fitText(produceInfo.plain, { max: 0.56, min: 0.3 })}>
			<span class="prod-lead">{produceInfo.print.lead}</span>
			<span class="prod-opt">• <RichText text={produceInfo.print.local} /></span>
			<span class="prod-or">OR</span>
			<span class="prod-opt">• <RichText text={produceInfo.print.system} /></span>
			<span class="prod-opt">• {produceInfo.print.check}</span>
		</span>
		<span class="prod-boxes" aria-label={`${produceInfo.boxes} unchecked boxes`}>
			{#each { length: produceInfo.boxes } as _, idx (idx)}<i class="prod-box"></i>{/each}
		</span>
		<span class="prod-foot">{produceInfo.print.footer}</span>
	{:else if card.kind === 'epidemic'}
		<span class="ep-top">
			<span class="ep-title">EPIDEMIC</span>
		</span>
		<span class="ep-body" {@attach fitText(EPIDEMIC_PLAIN, { max: 0.64, min: 0.34 })}>
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
		width: 8.2em;
		height: 9.7em;
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

	.card:not(:disabled) {
		cursor: pointer;
	}

	.card.play {
		outline-color: var(--warn);
	}

	.card.discard {
		outline-color: var(--danger);
	}

	.head {
		display: flex;
		flex-direction: column;
		padding: 0.45em 0.55em 0.3em;
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

	.art {
		flex: 1;
		min-height: 0;
		margin: 0 0.4em;
		border: 1px solid rgb(0 0 0 / 0.3);
		border-radius: 0.15em;
		overflow: hidden;
		box-shadow: 0 0 0 0.12em rgb(255 248 228 / 0.35);
	}

	.art.compact {
		flex: 0 0 2.05em;
	}

	.city-slip {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.28em;
		margin: 0.25em 0.4em 0;
		padding: 0.3em 0.42em;
		border-radius: 0.2em;
		background: rgb(250 245 232 / 0.94);
		color: #1f1912;
		line-height: 1.22;
		overflow: hidden;
	}

	.slip-block {
		display: block;
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
		gap: 0.3em;
		height: 1.5em;
		padding: 0 0.5em;
	}

	.pips {
		display: flex;
		gap: 0.16em;
		margin-right: auto;
	}

	.pips i {
		width: 0.42em;
		height: 0.42em;
		border-radius: 50%;
		background: var(--on);
	}

	.box {
		display: grid;
		place-items: center;
		width: 1.15em;
		height: 1.15em;
		border: 1px solid var(--on);
		border-radius: 0.15em;
		font-size: 0.72em;
	}

	.box.used {
		opacity: 0.35;
	}

	/* === Event cards === */
	.card.event:not(.small) {
		padding: 0.38em;
		gap: 0.28em;
		background: linear-gradient(170deg, #d7aa2a, #ab7d15);
		border-color: #7c580b;
		color: #1f1810;
	}

	.card.event.permanent:not(.small) {
		background: linear-gradient(170deg, #2b4a86, #192d54);
		border-color: #11203d;
		color: #edf2fb;
	}

	.ev-top {
		display: flex;
		flex-direction: column;
		gap: 0.12em;
		padding: 0.26em 0.38em 0.3em;
		border-radius: 0.22em;
		background: linear-gradient(165deg, #1b221c, #111612);
		color: #a6e39d;
	}

	.card.event.permanent .ev-top {
		background: rgb(255 255 255 / 0.92);
		color: #1d3970;
	}

	.ev-kicker {
		font-size: 0.54em;
		font-weight: 800;
		font-style: italic;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #f4d678;
	}

	.card.event.permanent .ev-kicker {
		color: #466196;
	}

	.ev-title {
		font-family: var(--font-display);
		line-height: 1.04;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.ev-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 0.22em;
		padding: 0.36em 0.42em 0.32em;
		border-radius: 0.22em;
		background: #fbf6e8;
		color: #1d1711;
		overflow: hidden;
	}

	.ev-body.striped {
		background: repeating-linear-gradient(-32deg, transparent 0 0.7em, rgb(230 185 45 / 0.16) 0.7em 1.25em), #fbf6e8;
	}

	.card.event.permanent .ev-body {
		background: linear-gradient(165deg, #151b26, #0f141d);
		color: #f2cf78;
	}

	.ev-rules {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3em;
		overflow: hidden;
		line-height: 1.24;
	}

	.rule-line {
		display: block;
	}

	.ev-destroy {
		display: block;
		color: #b82e20;
		font-weight: 700;
	}

	.ev-timing {
		color: #b82e20;
		font-size: 0.5em;
		font-style: italic;
		font-weight: 600;
		line-height: 1.15;
		flex: none;
	}

	/* === Produce Supplies === */
	.card.produce:not(.small) {
		padding: 0.36em 0.42em 0.32em;
		gap: 0.22em;
		background: linear-gradient(170deg, #1e527a, #12334d);
		border-color: #0b2234;
		color: #f0f5f9;
		box-shadow:
			inset 0 0 0 0.18em rgb(230 198 62 / 0.22),
			0 0.15em 0.3em rgb(0 0 0 / 0.35),
			0 0.6em 1.4em rgb(0 0 0 / 0.25);
	}

	.prod-head {
		padding: 0.14em 0.25em;
		border: 1px solid rgb(240 245 249 / 0.32);
		border-radius: 0.16em;
		background: rgb(10 26 40 / 0.42);
		font-family: var(--font-display);
		font-size: 0.8em;
		letter-spacing: 0.05em;
		text-align: center;
		color: #ffffff;
	}

	.prod-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 0.2em;
		overflow: hidden;
		line-height: 1.18;
	}

	.prod-lead {
		font-weight: 700;
		color: #ffffff;
	}

	.prod-opt {
		display: block;
		color: rgb(240 245 249 / 0.94);
	}

	.prod-or {
		display: flex;
		align-items: center;
		gap: 0.35em;
		font-weight: 800;
		font-size: 0.92em;
		letter-spacing: 0.06em;
		color: #c2dff2;
	}

	.prod-or::before,
	.prod-or::after {
		content: '';
		flex: 1;
		height: 1px;
		background: rgb(194 223 242 / 0.4);
	}

	.prod-boxes {
		display: flex;
		justify-content: center;
		gap: 0.35em;
		flex: none;
	}

	.prod-box {
		width: 0.72em;
		height: 0.72em;
		border: 1px solid #e7f0f7;
		border-radius: 0.1em;
		background: rgb(255 255 255 / 0.92);
	}

	.prod-foot {
		padding-top: 0.14em;
		border-top: 1px solid rgb(240 245 249 / 0.25);
		color: #f3d74b;
		font-size: 0.48em;
		font-style: italic;
		font-weight: 600;
		text-align: center;
		line-height: 1.15;
		flex: none;
	}

	/* === Epidemic === */
	.card.epidemic:not(.small) {
		padding: 0.38em 0.42em 0.36em;
		gap: 0.26em;
		background:
			radial-gradient(circle at 50% 45%, rgb(130 210 95 / 0.16), transparent 65%),
			linear-gradient(168deg, #215729, #123318);
		border-color: #0e1d10;
		color: #f6ea8e;
	}

	.ep-top {
		padding: 0.16em 0.3em;
		border: 1px solid #f4eecc;
		border-radius: 0.16em;
		background: linear-gradient(180deg, #d86d24, #ecc63b);
		text-align: center;
	}

	.ep-title {
		font-family: var(--font-display);
		font-size: 1em;
		font-weight: 700;
		letter-spacing: 0.06em;
		color: #8f1d14;
		line-height: 1;
	}

	.ep-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3em;
		overflow: hidden;
		line-height: 1.2;
	}

	.ep-step {
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
