<script lang="ts">
	import type { Campaign, EventId, LegacyCardDef } from '@repo/game';
	import type { LegacyPrint } from '#lib/cards/print.generated.ts';
	import {
		EPIDEMIC_STEPS,
		EVENT_PRINT,
		OBJECTIVE_PRINT,
		RECKONING_ROWS,
		SCANNER_SLOTS,
		eventPlainText,
	} from '#lib/cards/playerPrint.ts';
	import { fitText } from '#lib/cards/fit.ts';
	import RichText from '#lib/hud/RichText.svelte';

	type Props = { card: LegacyCardDef; print: LegacyPrint; code: string; monthLabel: string; campaign?: Campaign };

	let { card, code, campaign }: Props = $props();

	const objectivePrint = $derived(card.kind === 'objective' ? OBJECTIVE_PRINT[card.id] : null);

	const eventId = $derived.by((): EventId | null => {
		const unlock = card.unlocks.find(u => u.t === 'event');
		return unlock?.t === 'event' ? unlock.event : null;
	});
	const eventPrint = $derived(eventId ? EVENT_PRINT[eventId] : null);
	const eventFitKey = $derived(eventId ? eventPlainText(eventId) : card.text);

	const epidemicFitKey = EPIDEMIC_STEPS.map(s => `${s.heading} ${s.text}`).join(' ');

	const PLAN_ROWS = [
		{
			id: 'hidden:plan-red',
			label: 'Locate hidden entrance',
			color: '#c44536',
			ink: '#fff',
			letters: ['A', 'B', 'C', 'D', 'E'],
		},
		{
			id: 'hidden:plan-black',
			label: 'Decode access key',
			color: '#24211f',
			ink: '#fff',
			letters: ['A', 'B', 'C', 'D'],
		},
		{
			id: 'hidden:plan-yellow',
			label: 'Devise distraction',
			color: '#e5bc34',
			ink: '#1d1812',
			letters: ['A', 'B', 'C'],
		},
		{
			id: 'hidden:plan-blue',
			label: 'Prepare containment units',
			color: '#3973a8',
			ink: '#fff',
			letters: ['A', 'B', 'C'],
		},
	] as const;

	const objectiveFitKey = $derived.by(() => {
		if (!objectivePrint?.details) return '';
		return objectivePrint.details
			.map(d =>
				d.kind === 'text'
					? d.text
					: d.kind === 'door'
						? `${d.before}${d.door}${d.after}`
						: `${d.intro} ${d.items.join(' ')}`,
			)
			.join(' ');
	});
</script>

<div class="special" class:mandatory={Boolean(objectivePrint?.mandatory)}>
	{#if card.kind === 'objective' && objectivePrint}
		<div
			class="inner obj-face"
			class:has-track={Boolean(objectivePrint.trackMax)}
			class:has-details={Boolean(objectivePrint.details)}
		>
			<div class="obj-frame" aria-hidden="true"></div>
			<div class="obj-head">
				<div class="obj-words">
					<span class="obj-kicker">{objectivePrint.mandatory ? 'MANDATORY OBJECTIVE' : 'OBJECTIVE'}</span>
					<h3 class:large={!objectivePrint.trackMax && !objectivePrint.details}>
						{#if objectivePrint.italicWord}
							{@const [before, after] = objectivePrint.sentence.split(objectivePrint.italicWord)}
							{before}<em>{objectivePrint.italicWord}</em>{after}
						{:else}
							{objectivePrint.sentence}
						{/if}
					</h3>
				</div>
				<div class="obj-star" aria-hidden="true">★</div>
			</div>

			{#if objectivePrint.trackMax}
				<div class="obj-track" aria-label={`Progress track 0 to ${objectivePrint.trackMax}`}>
					{#each { length: objectivePrint.trackMax + 1 } as _, n (n)}
						<span class="track-node">
							<i class="circle"></i>
							<b>{n}</b>
						</span>
					{/each}
				</div>
			{:else if objectivePrint.details}
				<div class="obj-details" {@attach fitText(objectiveFitKey, { max: 0.96, min: 0.62 })}>
					{#each objectivePrint.details as detail, idx (idx)}
						{#if detail.kind === 'text'}
							<p><RichText text={detail.text} /></p>
						{:else if detail.kind === 'door'}
							<p>
								<RichText text={detail.before} /><span class="door-badge">{detail.door}</span>{detail.after}
							</p>
						{:else}
							<p class="bullet-intro">{detail.intro}</p>
							<div class="bullet-group">
								{#each detail.items as item, itemIdx (itemIdx)}
									{#if itemIdx > 0 && detail.joiner}
										<span class="bullet-joiner">{detail.joiner}</span>
									{/if}
									<p class="bullet-item"><i class="dot" aria-hidden="true"></i><span><RichText text={item} /></span></p>
								{/each}
							</div>
						{/if}
					{/each}
				</div>
			{/if}

			{#if objectivePrint.footer?.length}
				<div class="obj-foot">
					{#each objectivePrint.footer as line, idx (idx)}
						<p>{line}</p>
					{/each}
				</div>
			{/if}
			<span class="code">{code}</span>
		</div>
	{:else if card.kind === 'event' && eventPrint}
		<div class="inner event-face">
			<header class="ev-banner">{eventPrint.banner}</header>
			<div class="ev-screen">
				<h3 {@attach fitText(card.title, { max: 1.4, min: 0.85, across: true })}>{card.title}</h3>
				<div class="ev-rule-bar" aria-hidden="true"></div>
			</div>
			<div class="ev-panel">
				<div class="ev-rules" {@attach fitText(eventFitKey, { max: 1.04, min: 0.52 })}>
					{#each eventPrint.rules as line, idx (idx)}
						<p><RichText text={line} /></p>
					{/each}
				</div>
				{#if eventPrint.timing}
					<p class="ev-timing">{eventPrint.timing}</p>
				{/if}
			</div>
			<span class="code">{code}</span>
		</div>
	{:else if card.kind === 'scanner'}
		<div class="inner scanner-face">
			<div class="scanner-head">
				<h3>FREQUENCY SCANNER</h3>
				<p>When you do the Monitor action, scratch a box, then refer to the text below.</p>
			</div>
			<div class="dial-band" aria-label="Frequency dial">
				<div class="dial-slots">
					{#each SCANNER_SLOTS as slot, idx (slot.label)}
						{@const scratched = Boolean(campaign?.frequenciesUsed.includes(idx))}
						<div class="freq" class:used={scratched} class:stagger={idx % 2 === 1}>
							<span class="scratch" aria-label={scratched ? `${slot.label} scratched` : `${slot.label} covered`}>
								{#if scratched}
									{#if slot.reveal.kind === 'door'}
										<span class="door-badge sm">{slot.reveal.door}</span>
									{:else if slot.reveal.count === 2}
										<svg class="cards-ico" viewBox="0 0 24 22" aria-label="2 cards">
											<rect x="2" y="4" width="12" height="15" rx="1.5" />
											<rect x="9" y="1.5" width="12" height="15" rx="1.5" />
										</svg>
									{:else}
										<svg class="cards-ico" viewBox="0 0 24 22" aria-label="1 card">
											<rect x="6" y="3" width="12" height="16" rx="1.5" />
										</svg>
									{/if}
								{/if}
							</span>
							<i class="tick" aria-hidden="true"></i>
							<b>{slot.label}</b>
						</div>
					{/each}
				</div>
			</div>
			<div class="scanner-bottom">
				<div class="scanner-legend">
					<strong>IF YOU REVEAL:</strong>
					<ul>
						<li>
							<span class="door-badge sm">#</span>: Open the dossier door.
						</li>
						<li>
							<span class="ico-inline" aria-hidden="true">
								<svg class="cards-ico inline" viewBox="0 0 24 22"
									><rect x="6" y="3" width="12" height="16" rx="1.5" /></svg
								>
								or
								<svg class="cards-ico inline" viewBox="0 0 24 22"
									><rect x="2" y="4" width="12" height="15" rx="1.5" /><rect
										x="9"
										y="1.5"
										width="12"
										height="15"
										rx="1.5"
									/></svg
								>
							</span>: <RichText
								text="Take 1 or 2 cards from the top of the Player discard pile and add them to your hand. (You may not take Epidemic cards.)"
							/>
						</li>
					</ul>
				</div>
				<div class="scanner-knobs" aria-hidden="true">
					<span class="knob big"></span>
					<span class="jack"></span>
					<span class="knob"></span>
				</div>
			</div>
			<span class="code">{code}</span>
		</div>
	{:else if card.kind === 'plan'}
		<div class="inner plan-face">
			<h3>The Plan</h3>
			<div class="plan-intro">
				<p>
					<RichText
						text="Do the Recon action in Shanghai with the cards indicated below to check off a part of the plan."
					/>
				</p>
				<p class="plan-note">A supply center is not required to do this.</p>
			</div>
			<div class="plan-grid">
				{#each PLAN_ROWS as row (row.id)}
					<div class="plan-row" class:done={campaign?.planRecons.includes(row.id)}>
						<span class="plan-label">• {row.label}</span>
						<span class="plan-cards">
							<i class="check">{campaign?.planRecons.includes(row.id) ? '✓' : ''}</i>
							{#each row.letters as letter (letter)}
								<b style:--swatch={row.color} style:--ink={row.ink}>{letter}</b>
							{/each}
						</span>
					</div>
				{/each}
			</div>
			<div class="plan-foot">
				<p>When everything is checked, you have completed the plan.</p>
				<p><RichText text="Open Package 8 and destroy this card." /></p>
			</div>
			<span class="code">{code}</span>
		</div>
	{:else if card.kind === 'reckoning'}
		<div class="inner reckoning-face">
			<div class="reck-banner">THE FINAL RECKONING</div>
			<div class="reck-table">
				{#each RECKONING_ROWS as row, idx (idx)}
					<div class="reck-row" class:highlight={row.highlight}>
						<span class="reck-label">{row.label}</span>
						<span class="reck-box" class:gold={row.highlight} aria-hidden="true"></span>
						<span class="reck-rule"><RichText text={row.rule} /></span>
					</div>
				{/each}
			</div>
			<span class="code">{code}</span>
		</div>
	{:else if card.kind === 'epidemic'}
		<div class="inner epidemic-face">
			<div class="ep-head">
				<h3>EPIDEMIC</h3>
				<div class="ep-scale" aria-hidden="true"></div>
			</div>
			<div class="ep-body" {@attach fitText(epidemicFitKey, { max: 0.96, min: 0.58 })}>
				<ol class="ep-steps">
					{#each EPIDEMIC_STEPS as step (step.heading)}
						<li>
							<strong>{step.heading}</strong>
							<span><RichText text={step.text} /></span>
						</li>
					{/each}
				</ol>
			</div>
			<span class="code">{code}</span>
		</div>
	{/if}
</div>

<style>
	.special {
		display: contents;
	}

	/* Keep inline glyphs proportional to the card's em scale (full, deck, thumb). */
	.special :global(.glyph.supplies),
	.special :global(.glyph.plague) {
		width: 0.68em;
		height: 0.68em;
	}

	.special :global(.glyph.hollow) {
		width: 0.68em;
		height: 0.86em;
	}

	.special :global(.glyph.card) {
		width: 0.64em;
		height: 0.88em;
	}

	.special :global(.glyph.infection) {
		width: 0.88em;
		height: 0.64em;
	}

	.special :global(.glyph.center) {
		width: 0.9em;
		height: 0.9em;
	}

	.special :global(.glyph.tower) {
		width: 0.72em;
		height: 0.96em;
		background:
			radial-gradient(circle at 50% 18%, currentColor 0 0.17em, transparent 0.18em),
			linear-gradient(currentColor, currentColor) center 0.22em / 0.12em 100% no-repeat;
	}

	.special :global(.glyph.shelter) {
		width: 0.92em;
		height: 0.5em;
		border-radius: 0.5em 0.5em 0 0;
	}

	.door-badge {
		display: inline-grid;
		place-items: center;
		min-width: 1.65em;
		padding: 0.02em 0.32em;
		border: 1.5px solid #e06d38;
		border-radius: 3px;
		background: #fbf4e4;
		color: #c24222;
		font-weight: 800;
		font-size: 0.9em;
		line-height: 1.15;
		vertical-align: 0.04em;
	}

	.door-badge.sm {
		min-width: 1.4em;
		padding: 0 0.22em;
		font-size: 0.78em;
		border-width: 1.5px;
	}

	/* === Side B: Objective (Landscape) === */
	.obj-face {
		justify-content: space-between;
		gap: 0.35em;
		padding: 0.95em 1.15em 1.1em;
		background:
			radial-gradient(circle at 86% 18%, rgb(255 255 255 / 0.06), transparent 52%),
			linear-gradient(155deg, #2d2b29, #181716);
		color: #f3ede0;
		border: 2px solid rgb(235 227 210 / 0.42);
	}

	.obj-frame {
		position: absolute;
		inset: 0.42em;
		border: 1.5px solid rgb(235 227 210 / 0.32);
		border-radius: 4px;
		pointer-events: none;
	}

	.obj-head {
		position: relative;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.8em;
	}

	.obj-words {
		min-width: 0;
		flex: 1;
	}

	.obj-kicker {
		display: block;
		font-size: 0.95em;
		font-weight: 800;
		font-style: italic;
		letter-spacing: 0.05em;
		color: #e8c63a;
	}

	:global(.mandatory) .obj-kicker {
		color: #e44a38;
	}

	.obj-words h3 {
		margin: 0.16em 0 0;
		font-family: var(--font-display);
		font-size: 1.78em;
		font-weight: 400;
		line-height: 1.08;
	}

	.obj-words h3.large {
		margin-top: 0.9em;
		font-size: 2.05em;
	}

	.obj-words h3 em {
		font-style: italic;
	}

	.obj-star {
		display: grid;
		place-items: center;
		width: 2.2em;
		height: 2.2em;
		border: 2px solid rgb(235 227 210 / 0.72);
		border-radius: 50%;
		box-shadow: inset 0 0 0 0.18em rgb(235 227 210 / 0.14);
		color: #e8c63a;
		font-size: 1.5em;
		flex: none;
	}

	:global(.mandatory) .obj-star {
		color: #e44a38;
	}

	.obj-track {
		position: relative;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		gap: 1.35em;
		margin: auto 0;
		padding: 0.2em 0;
	}

	.track-node {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35em;
	}

	.track-node:not(:last-child)::after {
		content: '';
		position: absolute;
		left: 50%;
		bottom: 0.72em;
		width: calc(100% + 1.35em);
		height: 0.22em;
		background: rgb(243 237 224 / 0.75);
		z-index: 0;
	}

	.track-node .circle {
		width: 3.1em;
		height: 3.1em;
		border: 2px solid rgb(243 237 224 / 0.78);
		border-radius: 50%;
	}

	.track-node b {
		position: relative;
		z-index: 1;
		display: grid;
		place-items: center;
		width: 1.6em;
		height: 1.6em;
		border-radius: 50%;
		background: #ebe4d5;
		color: #181716;
		font-size: 0.92em;
		font-weight: 800;
	}

	.obj-details {
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.35em;
		overflow: hidden;
		line-height: 1.32;
		color: rgb(243 237 224 / 0.94);
	}

	.obj-details p {
		margin: 0;
	}

	.bullet-intro {
		font-weight: 600;
	}

	.bullet-group {
		display: flex;
		flex-direction: column;
		gap: 0.18em;
		padding-left: 0.15em;
	}

	.bullet-item {
		display: flex;
		align-items: baseline;
		gap: 0.4em;
	}

	.bullet-item .dot {
		width: 0.42em;
		height: 0.42em;
		border-radius: 50%;
		background: #e44a38;
		flex: none;
		transform: translateY(-0.1em);
	}

	.bullet-joiner {
		font-size: 0.88em;
		font-weight: 800;
		letter-spacing: 0.04em;
		color: #f3ede0;
	}

	.obj-foot {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.15em;
		padding-right: 3.2em;
		font-size: 0.82em;
		font-style: italic;
		line-height: 1.28;
		color: rgb(243 237 224 / 0.84);
	}

	.obj-foot p {
		margin: 0;
	}

	/* === Side B: Rationed Event (Portrait) === */
	.event-face {
		gap: 0.48em;
		padding: 0.7em 0.8em 0.85em;
		background:
			radial-gradient(ellipse at 20% 0%, rgb(255 245 200 / 0.25), transparent 55%),
			linear-gradient(170deg, #d7aa2a, #ab7d15);
		color: #211910;
		border: 2px solid #8a630d;
	}

	.ev-banner {
		color: #fffdf6;
		font-size: 0.98em;
		font-weight: 800;
		font-style: italic;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		text-shadow: 0 1px 2px rgb(30 20 0 / 0.45);
	}

	.ev-screen {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 0.35em;
		min-height: 3.6em;
		padding: 0.55em 0.65em;
		border: 1.5px solid #6e5210;
		border-radius: 4px;
		background: linear-gradient(165deg, #1b221c, #111612);
		color: #8fd98e;
		text-align: center;
	}

	.ev-screen h3 {
		margin: 0;
		width: 100%;
		font-family: var(--font-display);
		font-weight: 400;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		line-height: 1.08;
		color: #a6e39d;
	}

	.ev-rule-bar {
		width: 45%;
		height: 2px;
		background: rgb(166 227 157 / 0.35);
		border-radius: 1px;
	}

	.ev-panel {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 0.45em;
		padding: 0.65em 0.7em 0.6em;
		border: 1px solid rgb(60 44 10 / 0.25);
		border-radius: 4px;
		background: linear-gradient(175deg, #fbf6e8, #f2e8cf);
		color: #1e1812;
	}

	.ev-rules {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5em;
		overflow: hidden;
		line-height: 1.32;
	}

	.ev-rules p {
		margin: 0;
	}

	.ev-timing {
		margin: 0;
		padding-right: 3.2em;
		color: #b83024;
		font-size: 0.78em;
		font-style: italic;
		font-weight: 600;
		line-height: 1.22;
	}

	/* === Side B: Frequency Scanner (Landscape) === */
	.scanner-face {
		justify-content: space-between;
		gap: 0.3em;
		padding: 0.65em 0.85em 0.72em;
		background: linear-gradient(160deg, #1d1a1e, #110f12);
		color: #ebe4d6;
		border: 2px solid #4d5a60;
	}

	.scanner-head h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.42em;
		font-weight: 400;
		font-style: italic;
		letter-spacing: 0.04em;
		color: #79d2d9;
		line-height: 1.02;
	}

	.scanner-head p {
		margin: 0.12em 0 0;
		font-size: 0.78em;
		color: rgb(235 228 214 / 0.9);
		line-height: 1.22;
	}

	.dial-band {
		padding: 0.3em 0.38em 0.26em;
		border-radius: 4px;
		background: linear-gradient(180deg, #1b2221, #27322e);
		border: 1.5px solid #485b57;
		flex: none;
	}

	.dial-slots {
		display: grid;
		grid-template-columns: repeat(10, 1fr);
		gap: 0.24em;
	}

	.freq {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.scratch {
		display: grid;
		place-items: center;
		width: 100%;
		height: 1.5em;
		border-radius: 2px;
		background: linear-gradient(135deg, #d6d3cb, #b8b3a9);
		border: 1px solid rgb(255 255 255 / 0.3);
	}

	.freq.used .scratch {
		background: #2c282a;
		border-color: rgb(121 210 217 / 0.55);
	}

	.tick {
		width: 1.5px;
		height: 0.38em;
		background: rgb(235 228 214 / 0.72);
	}

	.freq.stagger .tick {
		height: 0.18em;
	}

	.freq b {
		font-size: 0.58em;
		font-variant-numeric: tabular-nums;
		color: #f0ece2;
		line-height: 1.1;
		margin-top: 0.08em;
	}

	.freq:not(.stagger) b {
		margin-top: 0.18em;
	}

	.cards-ico {
		width: 72%;
		height: 78%;
		fill: #f4f1ea;
		stroke: #2c282a;
		stroke-width: 1.4;
	}

	.cards-ico.inline {
		width: 1.1em;
		height: 1.05em;
		vertical-align: -0.18em;
	}

	.scanner-bottom {
		display: flex;
		align-items: flex-end;
		gap: 0.75em;
		min-height: 0;
	}

	.scanner-legend {
		flex: 1;
		padding: 0.38em 0.55em;
		border-radius: 3px;
		background: #ede6d6;
		color: #1c1814;
		font-size: 0.68em;
		line-height: 1.24;
	}

	.scanner-legend strong {
		display: block;
		font-style: italic;
		letter-spacing: 0.03em;
		margin-bottom: 0.14em;
	}

	.scanner-legend ul {
		margin: 0;
		padding: 0 0 0 1em;
		display: flex;
		flex-direction: column;
		gap: 0.16em;
	}

	.ico-inline {
		display: inline-flex;
		align-items: center;
		gap: 0.16em;
		white-space: nowrap;
	}

	.scanner-knobs {
		display: flex;
		align-items: center;
		gap: 0.4em;
		padding: 0 0.25em 1.2em 0;
		flex: none;
	}

	.knob {
		width: 1.4em;
		height: 1.4em;
		border-radius: 50%;
		border: 1.5px solid #6b767c;
		background: radial-gradient(circle at 35% 35%, #5b6368, #23272a);
	}

	.knob.big {
		width: 1.85em;
		height: 1.85em;
	}

	.jack {
		width: 0.6em;
		height: 0.6em;
		border-radius: 50%;
		border: 1.5px solid #8a9498;
		background: #0d0e10;
	}

	/* === Side B: The Plan (Landscape) === */
	.plan-face {
		justify-content: space-between;
		gap: 0.22em;
		padding: 0.65em 0.9em 0.72em;
		background:
			repeating-linear-gradient(180deg, transparent 0 1.38em, rgb(120 155 190 / 0.24) 1.38em 1.45em),
			linear-gradient(170deg, #e9f0f5, #d9e4ec);
		color: #1c242b;
		border: 2px solid #9db2c4;
	}

	.plan-face h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.48em;
		font-weight: 400;
		line-height: 1.02;
	}

	.plan-intro,
	.plan-foot {
		display: flex;
		flex-direction: column;
		gap: 0.1em;
		font-size: 0.76em;
		line-height: 1.24;
	}

	.plan-intro p,
	.plan-foot p {
		margin: 0;
	}

	.plan-note {
		color: #b83024;
		font-weight: 600;
	}

	.plan-foot {
		padding-right: 3.1em;
	}

	.plan-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.34em 0.8em;
	}

	.plan-row {
		display: flex;
		flex-direction: column;
		gap: 0.18em;
	}

	.plan-label {
		font-size: 0.8em;
		font-weight: 700;
	}

	.plan-cards {
		display: flex;
		align-items: center;
		gap: 0.2em;
	}

	.plan-cards .check {
		display: inline-grid;
		place-items: center;
		width: 1.18em;
		height: 1.18em;
		border: 1.5px solid #1c242b;
		background: #fff;
		font-style: normal;
		font-size: 0.74em;
		font-weight: 700;
		margin-right: 0.12em;
	}

	.plan-cards b {
		display: inline-grid;
		place-items: center;
		width: 1.12em;
		height: 1.42em;
		border-radius: 2px;
		border: 1px solid rgb(0 0 0 / 0.28);
		background: var(--swatch);
		color: var(--ink);
		font-size: 0.7em;
		font-weight: 800;
	}

	/* === Side B: Final Reckoning (Landscape) === */
	.reckoning-face {
		gap: 0.28em;
		padding: 0.55em 0.82em 0.62em;
		background: linear-gradient(165deg, #f5eedf, #e8dcc2);
		color: #241c15;
		border: 2px solid #8a785d;
	}

	.reck-banner {
		padding: 0.18em 0.55em;
		border-radius: 3px;
		background: #1b1815;
		color: #e44a38;
		font-family: var(--font-display);
		font-size: 1.22em;
		font-style: italic;
		letter-spacing: 0.05em;
		text-align: center;
		flex: none;
	}

	.reck-table {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	.reck-row {
		display: grid;
		grid-template-columns: 4.7em 1.32em 1fr;
		align-items: center;
		gap: 0.38em;
		padding: 0.09em 0;
		border-bottom: 1px dotted rgb(36 28 21 / 0.38);
		font-size: 0.69em;
		line-height: 1.16;
	}

	.reck-row:last-child {
		border-bottom: 0;
		padding-right: 3.4em;
	}

	.reck-label {
		font-weight: 800;
		color: #1f1710;
	}

	.reck-box {
		width: 1.24em;
		height: 1.16em;
		border: 1.5px solid #4a4035;
		background: rgb(255 253 248 / 0.65);
		border-radius: 1px;
	}

	.reck-box.gold {
		border-color: #d6a224;
		border-width: 2px;
	}

	.reck-rule {
		color: #2b221a;
	}

	.reck-rule :global(.glyph.lab) {
		color: #b8840e;
	}

	/* === Side B: Epidemic (Portrait) === */
	.epidemic-face {
		gap: 0.65em;
		padding: 0.75em 0.85em 1.15em;
		background:
			radial-gradient(circle at 50% 45%, rgb(130 210 95 / 0.14), transparent 65%),
			linear-gradient(168deg, #215729, #123318);
		color: #f4eecc;
		border: 2.5px solid #162317;
		box-shadow: inset 0 0 0 2px rgb(244 238 204 / 0.18);
	}

	.ep-head {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.35em 0.5em 0.25em;
		border: 1.5px solid #f4eecc;
		border-radius: 3px;
		background: linear-gradient(180deg, #d86d24, #ecc63b);
		color: #8f1d14;
	}

	.ep-head h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.78em;
		font-weight: 700;
		letter-spacing: 0.06em;
		line-height: 1;
	}

	.ep-scale {
		width: 92%;
		height: 0.32em;
		margin-top: 0.12em;
		border-bottom: 1.5px solid #6b2212;
		background: repeating-linear-gradient(90deg, #6b2212 0 1px, transparent 1px 0.45em);
		opacity: 0.65;
	}

	.ep-body {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.ep-steps {
		display: flex;
		flex-direction: column;
		gap: 0.72em;
		margin: 0;
		padding: 0;
		list-style: none;
		line-height: 1.32;
	}

	.ep-steps li {
		display: flex;
		flex-direction: column;
		gap: 0.12em;
	}

	.ep-steps strong {
		color: #ffffff;
		font-style: italic;
		font-size: 1.05em;
		letter-spacing: 0.03em;
	}

	.ep-steps span {
		color: #f6ea8e;
	}
</style>
