<script lang="ts">
	import { pack } from '@repo/game';
	import type { Campaign, LegacyCardDef } from '@repo/game';
	import { fitText } from '#lib/cards/fit.ts';
	import { legacyScans } from '#lib/scans.generated.ts';
	import { originals, scanUrl } from '#lib/scans.svelte.ts';
	import { MONTHS } from '#lib/hud/labels.svelte.ts';
	import RichText from '#lib/hud/RichText.svelte';

	type Props = {
		card: LegacyCardDef;
		side: 'a' | 'b';
		campaign?: Campaign;
		/** Visual scale preset: `mini` (TopBar), `thumb` (scattered wing / deck list), `deck` (tabletop pile), `full` (spotlight). */
		size?: 'mini' | 'thumb' | 'deck' | 'full';
	};

	let { card, side, campaign, size = 'full' }: Props = $props();

	const LANDSCAPE_KINDS = new Set<LegacyCardDef['kind']>(['objective', 'scanner', 'plan', 'reckoning']);
	const landscape = $derived(side === 'b' && LANDSCAPE_KINDS.has(card.kind));
	const code = $derived(`${card.id}${side}`);
	const monthLabel = $derived(card.month === 0 ? 'Prologue' : (MONTHS[card.month] ?? 'Campaign'));

	const originalSrc = $derived.by(() => {
		const entry = legacyScans[card.id];
		if (!entry) return null;
		const rel = side === 'a' ? entry.back : entry.src;
		return rel ? scanUrl(rel) : null;
	});

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

	const openedSeals = $derived(
		card.unlocks.flatMap(u =>
			u.t === 'open' ? [u.seal.t === 'package' ? `Package ${u.seal.id}` : `Door ${u.seal.id}`] : [],
		),
	);

	const triggerHint = $derived.by(() => {
		if (card.id === '12-05') return 'Draw at the end of December';
		if (card.kind === 'stop') return `Draw at setup of ${monthLabel}`;
		if (card.kind === 'pause') return `Draw after the first game of ${monthLabel}`;
		if (card.kind === 'priorities') return 'Keep drawing';
		if (card.kind === 'objective') return 'Objective';
		if (card.kind === 'event') return 'Rationed Event';
		if (card.kind === 'epidemic') return 'Epidemic';
		return monthLabel;
	});

	const docText = $derived(eventDef ? eventDef.text : card.text);

	const KIND_LABEL: Record<LegacyCardDef['kind'], string> = {
		prologue: 'Prologue',
		stop: 'Stop',
		pause: 'Pause',
		archive: 'Journal',
		priorities: 'New Priorities',
		objective: 'Objective',
		turningPoint: 'Turning Point',
		event: 'Rationed Event',
		epidemic: 'Epidemic',
		scanner: 'Frequency Scanner',
		plan: 'The Plan',
		ending: 'Ending',
		reckoning: 'Final Reckoning',
		end: 'Campaign End',
	};

	const PLAN_ROWS = [
		{ id: 'hidden:plan-red', label: 'Locate hidden entrance', color: '#c44536', letters: ['A', 'B', 'C', 'D', 'E'] },
		{ id: 'hidden:plan-black', label: 'Decode access key', color: '#2b2826', letters: ['A', 'B', 'C', 'D'] },
		{ id: 'hidden:plan-yellow', label: 'Devise distraction', color: '#d4a62a', letters: ['A', 'B', 'C'] },
		{ id: 'hidden:plan-blue', label: 'Prepare containment units', color: '#3973a8', letters: ['A', 'B', 'C'] },
	] as const;

	const frequencies = pack.frequencyLabels;
</script>

<div
	class="legacy-card {card.kind} side-{side} size-{size}"
	class:landscape
	class:mandatory={Boolean(objectiveDef?.mandatory)}
	data-legacy-card={card.id}
	data-legacy-side={side}
	data-original-active={originals.held}
>
	{#if originals.held && originalSrc}
		<img class="original-img" src={originalSrc} alt={`${card.title} (original ${code})`} />
	{:else if side === 'a'}
		<div class="inner back">
			<div class="frame-line"></div>
			{#if card.kind === 'stop'}
				<div class="hazard"></div>
				<div class="stop-emblem" aria-hidden="true">
					<svg viewBox="0 0 64 64"><polygon points="19,4 45,4 60,19 60,45 45,60 19,60 4,45 4,19" /></svg>
					<span>STOP</span>
				</div>
				<strong class="back-title">{monthLabel}</strong>
				<p class="back-sub">{triggerHint}</p>
			{:else if card.kind === 'pause'}
				<div class="hazard amber"></div>
				<div class="pause-emblem" aria-hidden="true">
					<i></i><i></i>
				</div>
				<strong class="back-title">PAUSE</strong>
				<p class="back-sub">{triggerHint}</p>
			{:else if card.kind === 'objective'}
				<div class="star-crest" aria-hidden="true">★</div>
				<strong class="back-title">OBJECTIVE</strong>
				<p class="back-sub">Legacy Deck</p>
			{:else if card.kind === 'epidemic'}
				<div class="bio-crest" aria-hidden="true">☣</div>
				<strong class="back-title">LEGACY</strong>
				<p class="back-sub">{monthLabel}</p>
			{:else}
				<div class="compass-crest" aria-hidden="true">
					<svg viewBox="0 0 48 48">
						<circle cx="24" cy="24" r="19" />
						<polygon points="24,6 28,20 42,24 28,28 24,42 20,28 6,24 20,20" />
					</svg>
				</div>
				<span class="back-kicker">LEGACY DECK</span>
				<strong class="back-title">{monthLabel}</strong>
				<p class="back-sub">{KIND_LABEL[card.kind]}</p>
			{/if}
			<span class="code">{code}</span>
		</div>
	{:else if card.kind === 'objective'}
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
	{:else}
		<div class="inner doc-face">
			<header class="doc-head">
				<span class="doc-kicker">{KIND_LABEL[card.kind]}</span>
				<span class="doc-month">{monthLabel}</span>
			</header>
			<h3 {@attach fitText(card.title, { max: 1.9, min: 1.25, across: true })}>{card.title}</h3>
			<div class="doc-body">
				<div class="doc-copy" {@attach fitText(docText, { max: 1.38, min: 0.78 })}>
					<p><RichText text={docText} /></p>
				</div>
				{#if openedSeals.length}
					<div class="seal-pills">
						{#each openedSeals as seal (seal)}
							<span class="seal-pill"><RichText text={`Open ${seal}`} /></span>
						{/each}
					</div>
				{/if}
			</div>
			<span class="code">{code}</span>
		</div>
	{/if}
</div>

<style>
	.legacy-card {
		--w: 14.8rem;
		--h: 20.4rem;
		--fs: 1.02rem;
		position: relative;
		width: var(--w);
		height: var(--h);
		border-radius: 7px;
		overflow: hidden;
		font-size: var(--fs);
		font-family: var(--font-ui);
		box-shadow: 0 1rem 2.4rem rgb(0 0 0 / 0.58);
		user-select: none;
		flex: none;
	}

	.legacy-card.landscape {
		--w: 23.5rem;
		--h: 16.5rem;
	}

	.legacy-card.size-deck {
		--w: 7.6rem;
		--h: 10.5rem;
		--fs: 0.54rem;
		border-radius: 5px;
	}

	.legacy-card.size-thumb {
		--w: 6.8rem;
		--h: 9.4rem;
		--fs: 0.48rem;
		border-radius: 4px;
	}

	.legacy-card.size-thumb.landscape {
		--w: 10rem;
		--h: 7rem;
	}

	.legacy-card.size-mini {
		--w: 1.45rem;
		--h: 2rem;
		--fs: 0.16rem;
		border-radius: 2px;
		box-shadow:
			1px 1px 0 rgb(0 0 0 / 0.5),
			2px 2px 0 rgb(231 220 198 / 0.25);
	}

	.legacy-card.size-mini .back-sub,
	.legacy-card.size-mini .back-kicker,
	.legacy-card.size-mini .code {
		display: none;
	}

	.original-img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.inner {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		padding: 1.1em 1em 1.4em;
		box-sizing: border-box;
	}

	.code {
		position: absolute;
		right: 0.65em;
		bottom: 0.45em;
		padding: 0.08em 0.45em;
		border-radius: 999px;
		background: rgb(255 252 245 / 0.9);
		color: #1c1712;
		font-size: 0.68em;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.02em;
	}

	/* === Side A (Card Backs) === */
	.back {
		align-items: center;
		justify-content: center;
		gap: 0.55em;
		background:
			radial-gradient(ellipse at 50% 35%, rgb(255 240 200 / 0.09), transparent 65%),
			linear-gradient(165deg, #2b2520, #161310);
		color: #efe6d2;
		text-align: center;
	}

	.frame-line {
		position: absolute;
		inset: 0.45em;
		border: 1.5px solid rgb(231 220 198 / 0.25);
		border-radius: 4px;
		pointer-events: none;
	}

	.hazard {
		position: absolute;
		inset: 0 0 auto 0;
		height: 0.9em;
		background: repeating-linear-gradient(-45deg, #a8261c 0 0.55em, #1a1612 0.55em 1.1em);
	}

	.hazard.amber {
		background: repeating-linear-gradient(-45deg, #d99b26 0 0.55em, #1a1612 0.55em 1.1em);
	}

	.stop-emblem {
		position: relative;
		display: grid;
		place-items: center;
		width: 5.4em;
		height: 5.4em;
	}

	.stop-emblem svg {
		width: 100%;
		height: 100%;
		fill: #a8261c;
		stroke: #f4ebd8;
		stroke-width: 2.5;
	}

	.stop-emblem span {
		position: absolute;
		font-family: var(--font-display);
		font-size: 1.55em;
		letter-spacing: 0.06em;
		color: #fff8eb;
	}

	.pause-emblem {
		display: flex;
		gap: 0.7em;
		padding: 0.8em 1.1em;
		border: 2px solid #e3b23c;
		border-radius: 50%;
	}

	.pause-emblem i {
		display: block;
		width: 0.65em;
		height: 2.1em;
		border-radius: 2px;
		background: #e3b23c;
	}

	.star-crest {
		display: grid;
		place-items: center;
		width: 3.4em;
		height: 3.4em;
		border: 2px solid #5985b8;
		border-radius: 50%;
		color: #7eb0e8;
		font-size: 1.6em;
	}

	.bio-crest {
		color: #c84232;
		font-size: 3.6em;
		line-height: 1;
	}

	.compass-crest svg {
		width: 3.8em;
		height: 3.8em;
		fill: rgb(227 178 60 / 0.25);
		stroke: #d4b886;
		stroke-width: 1.5;
	}

	.back-kicker {
		font-size: 0.78em;
		letter-spacing: 0.14em;
		color: rgb(231 220 198 / 0.72);
	}

	.back-title {
		font-family: var(--font-display);
		font-size: 1.9em;
		font-weight: 400;
		line-height: 1.05;
		color: #f4ebd8;
	}

	.back-sub {
		margin: 0;
		max-width: 92%;
		font-size: 0.96em;
		color: rgb(231 220 198 / 0.85);
		line-height: 1.3;
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

	.mandatory .obj-kicker {
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

	.mandatory .obj-star {
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

	/* === Side B: Standard Dossier / Stop / Pause / Priorities / Journal / Turning Point / Event === */
	.doc-face {
		gap: 0.65em;
		background: linear-gradient(170deg, #f3ead4, #e5d8b8);
		color: #241c14;
		border: 2px solid #7e6c52;
	}

	.turningPoint .doc-face {
		background: linear-gradient(170deg, #2d1b18, #1a0f0d);
		color: #f3e6d0;
		border-color: #b54534;
	}

	.event .doc-face {
		background: linear-gradient(170deg, #f6eed9, #e7d5a8);
		border-color: #b08628;
	}

	.doc-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 0.35em;
		border-bottom: 1.5px solid currentColor;
		opacity: 0.78;
		font-size: 0.72em;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.stop .doc-kicker {
		color: #a8261c;
	}

	.pause .doc-kicker {
		color: #a16b10;
	}

	.turningPoint .doc-kicker {
		color: #e8624d;
	}

	.event .doc-kicker {
		color: #8f6814;
	}

	.doc-face h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.9em;
		font-weight: 400;
		line-height: 1.06;
		overflow: hidden;
	}

	.doc-body {
		display: flex;
		flex-direction: column;
		gap: 0.65em;
		flex: 1;
		min-height: 0;
		padding-bottom: 0.9em;
		overflow: hidden;
		line-height: 1.35;
	}

	.doc-copy {
		display: flex;
		align-items: center;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.doc-body p {
		margin: 0;
		width: 100%;
	}

	.seal-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35em;
		flex: none;
	}

	.seal-pill {
		padding: 0.22em 0.6em;
		border-radius: 3px;
		background: rgb(36 28 20 / 0.12);
		border: 1px solid rgb(36 28 20 / 0.28);
		font-size: 0.9em;
		font-weight: 700;
	}

	.turningPoint .seal-pill {
		background: rgb(255 235 215 / 0.12);
		border-color: rgb(255 235 215 / 0.3);
	}
</style>
