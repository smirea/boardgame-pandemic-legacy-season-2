<script lang="ts">
	import { pack } from '@repo/game';
	import type { Campaign, LegacyCardDef } from '@repo/game';
	import type { LegacyPrint } from '#lib/cards/print.generated.ts';
	import { fitText } from '#lib/cards/fit.ts';
	import RichText from '#lib/hud/RichText.svelte';

	type Props = { card: LegacyCardDef; print: LegacyPrint; code: string; monthLabel: string; campaign?: Campaign };

	let { card, print, code, campaign }: Props = $props();

	const objectiveDef = $derived.by(() => {
		if (card.kind !== 'objective') return null;
		if (card.id === '00-02') return pack.objectives.find(o => o.id === 'prologueCenters') ?? null;
		const unlock = card.unlocks.find(u => u.t === 'objectives' && u.add?.length);
		const id = unlock?.t === 'objectives' ? unlock.add?.[0] : undefined;
		return id ? (pack.objectives.find(o => o.id === id) ?? null) : null;
	});

	const eventDef = $derived.by(() => {
		const unlock = card.unlocks.find(u => u.t === 'event');
		return unlock?.t === 'event' ? (pack.events.find(e => e.id === unlock.event) ?? null) : null;
	});

	const PLAN_ROWS = [
		{ id: 'hidden:plan-red', label: 'Locate hidden entrance', color: '#c44536', letters: ['A', 'B', 'C', 'D', 'E'] },
		{ id: 'hidden:plan-black', label: 'Decode access key', color: '#2b2826', letters: ['A', 'B', 'C', 'D'] },
		{ id: 'hidden:plan-yellow', label: 'Devise distraction', color: '#d4a62a', letters: ['A', 'B', 'C'] },
		{ id: 'hidden:plan-blue', label: 'Prepare containment units', color: '#3973a8', letters: ['A', 'B', 'C'] },
	] as const;

	const frequencies = pack.frequencyLabels;
</script>

<div class="special" class:mandatory={Boolean(objectiveDef?.mandatory)}>
	{#if card.kind === 'objective'}
		<div class="inner obj-face">
			<div class="obj-head">
				<div class="obj-words">
					<span class="obj-kicker">{objectiveDef?.mandatory ? 'MANDATORY OBJECTIVE' : 'OBJECTIVE'}</span>
					<h3>{card.title}</h3>
				</div>
				<div class="obj-star" aria-hidden="true">★</div>
			</div>
			{#if objectiveDef && objectiveDef.target > 1}
				<div class="obj-track" aria-label={`Progress track 0 to ${objectiveDef.target}`}>
					{#each { length: objectiveDef.target + 1 } as _, n (n)}
						<span class="track-node">
							<i class="circle"></i>
							<b>{n}</b>
						</span>
					{/each}
				</div>
			{:else}
				<p class="obj-body" {@attach fitText(card.text, { max: 1.3, min: 0.8 })}><RichText text={card.text} /></p>
			{/if}
			<p class="obj-foot">Add this card to your pool of objectives.</p>
			<span class="code">{code}</span>
		</div>
	{:else if card.kind === 'event'}
		<div class="inner event-face">
			<header class="doc-head"><span>Rationed Event</span></header>
			<h3 {@attach fitText(card.title, { max: 1.9, min: 1.25, across: true })}>{card.title}</h3>
			<p {@attach fitText(eventDef?.text ?? card.text, { max: 1.38, min: 0.78 })}>
				<RichText text={eventDef?.text ?? card.text} />
			</p>
			<span class="code">{code}</span>
		</div>
	{:else if card.kind === 'scanner'}
		<div class="inner scanner-face">
			<div class="scanner-head">
				<h3>FREQUENCY SCANNER</h3>
				<p><RichText text="When you do the Monitor action, scratch a box, then refer to the result." /></p>
			</div>
			<div class="dial">
				{#each frequencies as freq, idx (freq)}
					<span class="freq" class:used={campaign?.frequenciesUsed.includes(idx)}>
						<i></i>
						<b>{freq}</b>
					</span>
				{/each}
			</div>
			<p class="scanner-foot"><RichText text={card.text} /></p>
			<span class="code">{code}</span>
		</div>
	{:else if card.kind === 'plan'}
		<div class="inner plan-face">
			<h3>The Plan</h3>
			<p class="plan-intro">
				<RichText
					text="Do the Recon action in Shanghai with the cards indicated below. A supply center is not required."
				/>
			</p>
			<div class="plan-grid">
				{#each PLAN_ROWS as row (row.id)}
					<div class="plan-row" class:done={campaign?.planRecons.includes(row.id)}>
						<span class="plan-label">• {row.label}</span>
						<span class="plan-cards">
							<i class="check">{campaign?.planRecons.includes(row.id) ? '✓' : ''}</i>
							{#each row.letters as letter (letter)}
								<b style:--swatch={row.color}>{letter}</b>
							{/each}
						</span>
					</div>
				{/each}
			</div>
			<p class="plan-foot"><RichText text="When everything is checked, open Package 8 and destroy this card." /></p>
			<span class="code">{code}</span>
		</div>
	{:else if card.kind === 'reckoning'}
		<div class="inner reckoning-face">
			<div class="reck-banner">THE FINAL RECKONING</div>
			<dl class="reck-rows">
				<dt>Games Won (1st half)</dt>
				<dd>+50 each</dd>
				<dt>Games Won (2nd half)</dt>
				<dd>+30 each</dd>
				<dt>Population on grid</dt>
				<dd>+1 each</dd>
				<dt>Sample delivered</dt>
				<dd>+100</dd>
				<dt>Labs found</dt>
				<dd>+25 each</dd>
				<dt>Forsaken cities</dt>
				<dd>−5 each</dd>
			</dl>
			<span class="code">{code}</span>
		</div>
	{:else if card.kind === 'epidemic'}
		<div class="inner epidemic-face">
			<div class="ep-head">
				<span class="ep-bio" aria-hidden="true">☣</span>
				<h3>EPIDEMIC</h3>
			</div>
			<ol class="ep-steps">
				<li><strong>1. Increase</strong> — Move the Infection rate marker forward 1 space.</li>
				<li>
					<strong>2. Infect</strong> — <RichText text="Draw the bottom Infection card and remove all supply cubes." />
				</li>
				<li>
					<strong>3. Intensify</strong> — <RichText
						text="Shuffle the Infection discard pile onto the Infection deck."
					/>
				</li>
			</ol>
			<span class="code">{code}</span>
		</div>
	{/if}
</div>

<style>
	.special {
		display: contents;
	}

	/* === Side B: Objective (Landscape) === */
	.obj-face {
		justify-content: space-between;
		background:
			radial-gradient(circle at 85% 20%, rgb(255 255 255 / 0.06), transparent 55%),
			linear-gradient(155deg, #2d2b2a, #191817);
		color: #f3ede0;
		border: 2px solid rgb(235 227 210 / 0.35);
	}

	.obj-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.8em;
	}

	.obj-kicker {
		display: block;
		font-size: 0.82em;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: #e6c338;
	}

	:global(.mandatory) .obj-kicker {
		color: #e04f3e;
	}

	.obj-words h3 {
		margin: 0.15em 0 0;
		font-family: var(--font-display);
		font-size: 1.85em;
		font-weight: 400;
		line-height: 1.08;
	}

	.obj-star {
		display: grid;
		place-items: center;
		width: 2.3em;
		height: 2.3em;
		border: 2px solid #e6c338;
		border-radius: 50%;
		color: #e6c338;
		font-size: 1.5em;
		flex: none;
	}

	:global(.mandatory) .obj-star {
		border-color: #e04f3e;
		color: #e04f3e;
	}

	.obj-track {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.2em;
		margin: 0.4em 0;
	}

	.track-node {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3em;
	}

	.track-node .circle {
		width: 2.5em;
		height: 2.5em;
		border: 2px solid rgb(243 237 224 / 0.7);
		border-radius: 50%;
	}

	.track-node b {
		display: grid;
		place-items: center;
		width: 1.45em;
		height: 1.45em;
		border-radius: 50%;
		background: rgb(243 237 224 / 0.88);
		color: #191817;
		font-size: 0.82em;
	}

	.obj-body {
		display: flex;
		align-items: center;
		flex: 1;
		min-height: 0;
		margin: 0.3em 0;
		line-height: 1.35;
		color: rgb(243 237 224 / 0.9);
		overflow: hidden;
	}

	.obj-foot {
		margin: 0;
		font-size: 0.84em;
		font-style: italic;
		color: rgb(243 237 224 / 0.7);
	}

	/* === Side B: Frequency Scanner (Landscape) === */
	.scanner-face {
		justify-content: space-between;
		background: linear-gradient(160deg, #1b181b, #100e10);
		color: #ebe4d6;
		border: 2px solid #48545a;
	}

	.scanner-head h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.65em;
		font-weight: 400;
		letter-spacing: 0.06em;
		color: #79d2d9;
	}

	.scanner-head p,
	.scanner-foot {
		margin: 0.2em 0 0;
		font-size: 0.88em;
		color: rgb(235 228 214 / 0.85);
		line-height: 1.32;
	}

	.dial {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 0.35em;
		padding: 0.45em;
		border-radius: 4px;
		background: rgb(121 210 217 / 0.08);
		border: 1px solid rgb(121 210 217 / 0.3);
	}

	.freq {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15em;
	}

	.freq i {
		width: 100%;
		height: 1.15em;
		border-radius: 2px;
		background: #c8c4bc;
	}

	.freq.used i {
		background: #3a3632;
		border: 1px solid #79d2d9;
	}

	.freq b {
		font-size: 0.7em;
		font-variant-numeric: tabular-nums;
		color: #9fe0e6;
	}

	/* === Side B: The Plan (Landscape) === */
	.plan-face {
		justify-content: space-between;
		background:
			repeating-linear-gradient(180deg, transparent 0 1.45em, rgb(120 155 190 / 0.22) 1.45em 1.52em),
			linear-gradient(170deg, #e9f0f5, #d9e4ec);
		color: #1c242b;
		border: 2px solid #9db2c4;
	}

	.plan-face h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.65em;
		font-weight: 400;
	}

	.plan-intro,
	.plan-foot {
		margin: 0;
		font-size: 0.86em;
		line-height: 1.32;
	}

	.plan-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.45em 0.8em;
	}

	.plan-row {
		display: flex;
		flex-direction: column;
		gap: 0.2em;
	}

	.plan-label {
		font-size: 0.86em;
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
		width: 1.15em;
		height: 1.15em;
		border: 1.5px solid #1c242b;
		background: #fff;
		font-style: normal;
		font-size: 0.75em;
		font-weight: 700;
	}

	.plan-cards b {
		display: inline-grid;
		place-items: center;
		width: 1.15em;
		height: 1.45em;
		border-radius: 2px;
		background: var(--swatch);
		color: #fff;
		font-size: 0.72em;
	}

	/* === Side B: Final Reckoning (Landscape) === */
	.reckoning-face {
		gap: 0.5em;
		background: linear-gradient(165deg, #f3ebda, #e5d8bc);
		color: #261e16;
		border: 2px solid #8a785d;
	}

	.reck-banner {
		padding: 0.28em 0.6em;
		border-radius: 3px;
		background: #1d1a17;
		color: #e04f3e;
		font-family: var(--font-display);
		font-size: 1.35em;
		letter-spacing: 0.05em;
		text-align: center;
	}

	.reck-rows {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.28em 0.8em;
		margin: 0;
		font-size: 0.92em;
	}

	.reck-rows dt {
		border-bottom: 1px dotted rgb(38 30 22 / 0.3);
	}

	.reck-rows dd {
		margin: 0;
		font-weight: 700;
		text-align: right;
	}

	/* === Side B: Epidemic === */
	.epidemic-face {
		gap: 0.8em;
		background: linear-gradient(165deg, #4b1512, #250a08);
		color: #f6e8d5;
		border: 2px solid #c84232;
	}

	.ep-head {
		display: flex;
		align-items: center;
		gap: 0.5em;
		padding-bottom: 0.45em;
		border-bottom: 1px solid rgb(246 232 213 / 0.25);
	}

	.ep-bio {
		font-size: 2.2em;
		color: #e85c4a;
		line-height: 1;
	}

	.ep-head h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.75em;
		font-weight: 400;
		letter-spacing: 0.06em;
	}

	.ep-steps {
		display: flex;
		flex-direction: column;
		gap: 0.75em;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.96em;
		line-height: 1.38;
	}

	.event-face {
		gap: 0.65em;
		background: linear-gradient(170deg, #f6eed9, #e7d5a8);
		color: #241c14;
		border: 2px solid #b08628;
	}

	.event-face h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.9em;
		font-weight: 400;
		line-height: 1.06;
	}

	.event-face p {
		margin: 0;
		flex: 1;
		min-height: 0;
		overflow: hidden;
		line-height: 1.35;
	}

	.doc-head {
		padding-bottom: 0.35em;
		border-bottom: 1.5px solid currentColor;
		color: #8f6814;
		font-size: 0.72em;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
</style>
