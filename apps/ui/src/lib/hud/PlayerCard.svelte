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
		producePrint,
	} from '#lib/cards/playerPrint.ts';
	import { inkOn } from '#lib/color.ts';
	import { originals, playerCardScan, scanUrl } from '#lib/scans.svelte.ts';
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
		return { name: def.name, print };
	});

	const produceInfo = $derived.by(() => {
		if (card.kind !== 'produce') return null;
		const print = producePrint(card.boxesLeft);
		const plain = `${print.cost}. ${print.localTitle}: ${print.local} OR ${print.systemTitle}: ${print.system} ${print.footer}`;
		return { print, plain, boxes: Math.max(0, card.boxesLeft) };
	});

	const face = $derived.by(() => {
		switch (card.kind) {
			case 'city': {
				const { city, companion } = cityDetails!;
				return {
					title: city.name,
					kicker: companion ? `${city.port ? 'Port' : 'City'} · ${companion.name}` : city.port ? 'Port' : 'City',
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
					kicker: `${card.boxesLeft} system-wide left`,
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
>
	{#if originals.held && originalScan}
		<img class="original-swap" src={scanUrl(originalScan.card.src)} alt={face.title} />
		{#if originalScan.sticker}
			<img class="original-sticker" src={scanUrl(originalScan.sticker.src)} alt={originalScan.sticker.title} />
		{/if}
	{:else if small}
		<span class="head">
			<span class="kicker">{face.kicker}</span>
			<span class="title" {@attach fitText(face.title, { max: 1.18, min: 0.7, across: true })}>{face.title}</span>
		</span>
	{:else if card.kind === 'city' && cityDetails}
		<span class="head">
			<span class="kicker">{face.kicker}</span>
			<span class="title" {@attach fitText(face.title, { max: 1.2, min: 0.72, across: true })}>{face.title}</span>
		</span>
		<span
			class="art"
			class:compact={Boolean(cityDetails.improvement || cityDetails.companion)}
			class:both={Boolean(cityDetails.improvement && cityDetails.companion)}
		>
			<MapArt city={card.city} accent={face.color} />
		</span>
		{#if cityDetails.improvement || cityDetails.companion}
			<span class="city-slip" {@attach fitText(cityDetails.plain, { max: 0.78, min: 0.44 })}>
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
							<strong>{cityDetails.companion.name}:</strong>
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
			<span class="pips" role="img" aria-label={`Population ${cityDetails.city.population}`}>
				{#each { length: cityDetails.city.population } as _, index (index)}<i></i>{/each}
			</span>
			{#each card.search as box, index (index)}
				<span
					class="box"
					class:used={box.scratched}
					role="img"
					aria-label={`${box.scope} search${box.scratched ? ', used' : ''}`}>{box.scope === 'sea' ? '≈' : '⌕'}</span
				>
			{/each}
		</span>
	{:else if card.kind === 'event' && eventInfo}
		<span class="ev-top">
			<span class="ev-kicker">{eventInfo.print.banner}</span>
			<span class="ev-title" {@attach fitText(eventInfo.name, { max: 1.08, min: 0.54, across: true })}
				>{eventInfo.name}</span
			>
		</span>
		<span class="ev-body" class:unrationed={eventInfo.print.mode === 'unrationed'}>
			{#if eventInfo.print.mode === 'unrationed'}
				<span class="ev-hazard" aria-hidden="true"></span>
			{/if}
			<span class="ev-rules" {@attach fitText(eventInfo.print.rules.join(' '), { max: 0.88, min: 0.48 })}>
				{#each eventInfo.print.rules as line, idx (idx)}
					<span class="rule-line"><RichText text={line} /></span>
				{/each}
			</span>
			{#if eventInfo.print.timing || eventInfo.print.destroy}
				<span class="ev-foot">
					{#if eventInfo.print.timing}
						<span class="ev-timing">{eventInfo.print.timing}</span>
					{/if}
					{#if eventInfo.print.destroy}
						<span class="ev-destroy">Destroy</span>
					{/if}
				</span>
			{/if}
		</span>
	{:else if card.kind === 'produce' && produceInfo}
		<span class="prod-top">
			<span class="prod-head" {@attach fitText('PRODUCE SUPPLIES', { max: 0.96, min: 0.62, across: true })}
				>PRODUCE SUPPLIES</span
			>
			<span class="prod-cost">{produceInfo.print.cost}</span>
		</span>
		<span class="prod-body" {@attach fitText(produceInfo.plain, { max: 0.78, min: 0.48 })}>
			<span class="prod-choice">
				<span class="prod-label">{produceInfo.print.localTitle}</span>
				<span class="prod-text"><RichText text={produceInfo.print.local} /></span>
			</span>
			<span class="prod-or">OR</span>
			<span class="prod-choice system">
				<span class="prod-label-row">
					<span class="prod-label">{produceInfo.print.systemTitle}</span>
					<span class="prod-boxes" aria-label={`${produceInfo.boxes} unchecked boxes`}>
						{#each { length: produceInfo.boxes } as _, idx (idx)}<i class="prod-box"></i>{/each}
					</span>
				</span>
				<span class="prod-text"><RichText text={produceInfo.print.system} /></span>
			</span>
		</span>
		<span class="prod-foot" class:last={produceInfo.boxes <= 1}>{produceInfo.print.footer}</span>
	{:else if card.kind === 'epidemic'}
		<span class="ep-top">
			<span class="ep-title">EPIDEMIC</span>
		</span>
		<span class="ep-body" {@attach fitText(EPIDEMIC_PLAIN, { max: 0.74, min: 0.46 })}>
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
		flex: 0 0 1.65em;
	}

	.art.compact.both {
		flex: 0 0 1.2em;
	}

	.city-slip {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.28em;
		margin: 0.25em 0.38em 0;
		padding: 0.34em 0.44em;
		border-left: 0.22em solid color-mix(in srgb, var(--band) 85%, #140c06);
		border-radius: 0.2em;
		background: rgb(252 248 237 / 0.96);
		color: #19140e;
		line-height: 1.24;
		overflow: hidden;
	}

	.slip-block {
		display: block;
	}

	.slip-block + .slip-block {
		padding-top: 0.26em;
		border-top: 1px solid rgb(25 20 14 / 0.14);
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
		width: 1.24em;
		height: 1.24em;
		border: 1px solid var(--on);
		border-radius: 0.16em;
		font-size: 0.78em;
	}

	.box.used {
		opacity: 0.35;
	}

	/* === Event cards === */
	.card.event:not(.small) {
		padding: 0.34em;
		gap: 0.26em;
		background: linear-gradient(170deg, #d7aa2a, #ab7d15);
		border-color: #7c580b;
		color: #1f1810;
	}

	.card.event.unrationed:not(.small) {
		background: linear-gradient(170deg, #c77b24, #934a14);
		border-color: #69300a;
	}

	.card.event.permanent:not(.small) {
		background: linear-gradient(170deg, #2b4a86, #192d54);
		border-color: #11203d;
		color: #edf2fb;
	}

	.ev-top {
		display: flex;
		flex-direction: column;
		gap: 0.08em;
		padding: 0.22em 0.36em 0.24em;
		border-radius: 0.22em;
		background: linear-gradient(165deg, #1b221c, #111612);
		color: #a6e39d;
	}

	.card.event.unrationed .ev-top {
		color: #ffd89b;
	}

	.card.event.permanent .ev-top {
		background: rgb(255 255 255 / 0.94);
		color: #1d3970;
	}

	.ev-kicker {
		font-size: 0.56em;
		font-weight: 800;
		font-style: italic;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: #f4d678;
	}

	.card.event.unrationed .ev-kicker {
		color: #f2a25c;
	}

	.card.event.permanent .ev-kicker {
		color: #466196;
	}

	.ev-title {
		font-family: var(--font-display);
		line-height: 0.98;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.ev-body {
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 0.26em;
		padding: 0.4em 0.44em 0.32em;
		border-radius: 0.22em;
		background: #fcf8ed;
		color: #19140e;
		overflow: hidden;
	}

	.ev-hazard {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 0.26em;
		background: repeating-linear-gradient(-45deg, #c24b1c 0 0.34em, #241910 0.34em 0.68em);
	}

	.ev-body.unrationed {
		padding-top: 0.54em;
	}

	.card.event.permanent .ev-body {
		background: linear-gradient(165deg, #151b26, #0f141d);
		color: #f5d684;
	}

	.ev-rules {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.35em;
		overflow: hidden;
		line-height: 1.24;
	}

	.rule-line {
		display: block;
	}

	.ev-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.25em;
		padding-top: 0.24em;
		border-top: 1px solid rgb(29 23 17 / 0.14);
		flex: none;
	}

	.ev-destroy {
		flex: none;
		padding: 0.1em 0.34em;
		border-radius: 0.18em;
		background: #b82e20;
		color: #fff8f0;
		font-size: 0.52em;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		line-height: 1.15;
	}

	.ev-timing {
		color: #7c2c1d;
		font-size: 0.56em;
		font-weight: 700;
		line-height: 1.15;
		white-space: nowrap;
	}

	/* === Produce Supplies === */
	.card.produce:not(.small) {
		padding: 0.3em 0.34em 0.28em;
		gap: 0.22em;
		background: linear-gradient(170deg, #1e557e, #12344f);
		border-color: #0b2234;
		color: #f2f7fb;
		box-shadow:
			inset 0 0 0 0.16em rgb(230 198 62 / 0.24),
			0 0.15em 0.3em rgb(0 0 0 / 0.35),
			0 0.6em 1.4em rgb(0 0 0 / 0.25);
	}

	.prod-top {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.05em;
		padding: 0.18em 0.24em 0.18em;
		border: 1px solid rgb(240 245 249 / 0.28);
		border-radius: 0.2em;
		background: rgb(9 24 38 / 0.52);
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

	.prod-cost {
		font-size: 0.55em;
		font-weight: 600;
		color: #bddcf2;
		line-height: 1.1;
	}

	.prod-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 0.18em;
		overflow: hidden;
		line-height: 1.2;
	}

	.prod-choice {
		display: flex;
		flex-direction: column;
		gap: 0.12em;
		padding: 0.24em 0.34em;
		border: 1px solid rgb(226 241 252 / 0.22);
		border-radius: 0.2em;
		background: rgb(8 24 38 / 0.36);
	}

	.prod-choice.system {
		border-color: rgb(243 215 75 / 0.42);
		background: rgb(8 24 38 / 0.5);
	}

	.prod-label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.3em;
	}

	.prod-label {
		font-size: 0.86em;
		font-weight: 800;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: #f3d74b;
		line-height: 1.1;
	}

	.prod-text {
		display: block;
		color: #f4f9fd;
	}

	.prod-or {
		display: flex;
		align-items: center;
		gap: 0.35em;
		font-weight: 800;
		font-size: 0.82em;
		letter-spacing: 0.08em;
		color: #b7daf0;
		line-height: 1;
	}

	.prod-or::before,
	.prod-or::after {
		content: '';
		flex: 1;
		height: 1px;
		background: rgb(183 218 240 / 0.38);
	}

	.prod-boxes {
		display: inline-flex;
		align-items: center;
		gap: 0.28em;
		flex: none;
	}

	.prod-box {
		width: 1.05em;
		height: 1.05em;
		border: 1.5px solid #f3d74b;
		border-radius: 0.16em;
		background: rgb(255 255 255 / 0.94);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.35);
	}

	.prod-foot {
		padding: 0.16em 0.25em;
		border-radius: 0.16em;
		background: rgb(8 24 38 / 0.4);
		color: #f3d74b;
		font-size: 0.55em;
		font-weight: 700;
		text-align: center;
		line-height: 1.15;
		flex: none;
	}

	.prod-foot.last {
		background: #b82e20;
		color: #fff6ea;
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
