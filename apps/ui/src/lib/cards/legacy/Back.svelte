<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import type { Campaign, LegacyCardDef } from '@repo/game';
	import { fitText } from '#lib/cards/fit.ts';
	import type { LegacyPrint } from '#lib/cards/print.generated.ts';
	import RichText from '#lib/hud/RichText.svelte';

	type Props = { card: LegacyCardDef; print: LegacyPrint; code: string; monthLabel: string; campaign?: Campaign };

	let { card, print, code }: Props = $props();

	type Family = 'stop' | 'pause' | 'keep' | 'turning' | 'rules' | 'journal' | 'ending' | 'blank';
	type Block =
		| { kind: 'line'; text: string }
		| { kind: 'band'; text: string }
		| { kind: 'rule'; text: string }
		| { kind: 'list'; items: string[] };

	const MONTHS = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/g;
	const TERMS: [RegExp, string][] = [
		[/\blegacy deck\b/g, 'Legacy deck'],
		[/\bgame end\b/g, 'Game End'],
		[/\bprologue objective\b/g, 'Prologue Objective'],
		[/\bprologue\b/g, 'Prologue'],
		[/\brecon\b/g, 'Recon'],
	];

	/** The print sets many instructions in capitals; our cards set them in sentence case. */
	const sentence = (line: string) => {
		if (!/[A-Z]/.test(line) || line !== line.toUpperCase()) return line;
		let out = line.toLowerCase().replace(MONTHS, month => month[0]!.toUpperCase() + month.slice(1));
		for (const [term, cased] of TERMS) out = out.replace(term, cased);
		return out.replace(/(^|[.!?:]\s+|•\s*)([a-z])/g, (_, lead: string, letter: string) => lead + letter.toUpperCase());
	};

	const BAND = /^(DID NOT DELIVER|DELIVERED):/;

	// The last card is printed upside down at the bottom of the deck: its back is the archive's side B.
	const side = $derived(card.kind === 'end' ? print.b : print.a);

	const family = $derived.by((): Family => {
		if (side.stopOrPause === 'STOP') return 'stop';
		if (side.stopOrPause === 'PAUSE') return 'pause';
		if (side.stopOrPause === 'CONTINUE') return 'keep';
		if (side.header === 'TURNING POINT') return 'turning';
		if (/journal entry/i.test(side.header)) return 'journal';
		if (card.kind === 'ending' && (side.header || side.text)) return 'ending';
		if (side.header || side.text) return 'rules';
		return 'blank';
	});

	const title = $derived.by(() => {
		if (family === 'ending' && side.text.split('\n').some(line => BAND.test(line.trim()))) return '';
		return side.header ? sentence(side.header.trim()) : '';
	});

	const paragraphs = $derived.by(() => {
		const header = side.header.trim().toUpperCase();
		return side.text
			.split(/\n\s*\n/)
			.map(part => part.trim())
			.filter(part => part && part.toUpperCase() !== header);
	});

	/** The first card warns before its STOP, the rest of the stop or pause card is its trigger. */
	const warning = $derived(
		family === 'stop' && paragraphs.length > 1 && !paragraphs[0]!.startsWith('DRAW') ? sentence(paragraphs[0]!) : '',
	);

	const blocks = $derived.by((): Block[] => {
		if (family === 'blank') return [];
		if (family === 'stop' || family === 'pause') {
			const trigger = side.trigger || paragraphs.at(-1) || '';
			return [{ kind: 'line', text: sentence(trigger) }];
		}
		const out: Block[] = [];
		for (const part of paragraphs) {
			if (family === 'journal' && /^Immediately spend up to 3 production units/i.test(part)) {
				out.push({ kind: 'rule', text: part });
				continue;
			}
			for (const rawLine of part.split('\n')) {
				const text = rawLine.trim();
				if (!text) continue;
				if (family === 'ending' && BAND.test(text)) {
					out.push({ kind: 'band', text: sentence(text).replace(/(\d)-(\d)/, '$1\u2013\u2060$2') });
				} else if (text.startsWith('•')) {
					const item = sentence(text.replace(/^•\s*/, ''));
					const last = out.at(-1);
					if (last?.kind === 'list') last.items.push(item);
					else out.push({ kind: 'list', items: [item] });
				} else {
					out.push({ kind: 'line', text: sentence(text) });
				}
			}
		}
		return out;
	});

	const fitKey = $derived(
		blocks.map(block => (block.kind === 'list' ? block.items.join(' ') : block.text)).join(' ') + warning + side.footer,
	);
</script>

<div
	class="inner back {family}"
	class:alarm={card.kind === 'end'}
	{@attach feedback('Legacy card back', () => ({ card: card.id, family }))}
	data-back-family={family}
>
	{#if warning}<p class="warning">{warning}</p>{/if}
	{#if family !== 'journal' && family !== 'ending'}
		<div class="emblem" aria-hidden="true">
			{#if family === 'stop'}
				<svg viewBox="0 0 64 64">
					<polygon points="19,3 45,3 61,19 61,45 45,61 19,61 3,45 3,19" />
					<text x="32" y="38.5">STOP</text>
				</svg>
			{:else if family === 'pause'}
				<svg viewBox="0 0 64 64">
					<circle cx="32" cy="32" r="29" />
					<rect x="22" y="19" width="7" height="26" rx="1.5" />
					<rect x="35" y="19" width="7" height="26" rx="1.5" />
				</svg>
			{:else if family === 'keep'}
				<svg viewBox="0 0 64 64">
					<rect x="12" y="10" width="28" height="38" rx="3" class="ghost" />
					<rect x="24" y="16" width="28" height="38" rx="3" />
					<path d="M31 35h14M39 29l6 6-6 6" class="cut" />
				</svg>
			{:else if family === 'turning'}
				<svg viewBox="0 0 64 64">
					<circle cx="32" cy="32" r="27" class="ring" />
					<path d="M20 38a13 13 0 0 1 22-15l3-4 2 14-13-3 4-3a8 8 0 0 0-13 10z" />
				</svg>
			{:else if family === 'blank'}
				<svg viewBox="0 0 64 64">
					<circle cx="32" cy="32" r="27" class="ring" />
					<circle cx="32" cy="32" r="19" class="ring thin" />
					<path d="M32 9l4 19 19 4-19 4-4 19-4-19-19-4 19-4z" />
				</svg>
			{/if}
		</div>
	{/if}
	{#if family === 'journal'}
		<header class="paper-head">
			<span class="paper-kicker">Journal entry</span>
		</header>
	{:else if family === 'ending'}
		<header class="paper-head">
			<span class="paper-kicker">Ending</span>
			{#if title}<strong class="title">{title}</strong>{/if}
		</header>
	{:else if title}
		<strong class="title">{title}</strong>
	{/if}
	{#if blocks.length}
		<div
			class="body"
			{@attach fitText(fitKey, {
				max: family === 'journal' || family === 'ending' ? 0.92 : 1.05,
				min: 0.44,
			})}
		>
			{#each blocks as block, index (index)}
				{#if block.kind === 'band'}
					<p class="band-title">{block.text}</p>
				{:else if block.kind === 'rule'}
					<p class="rule-callout"><RichText text={block.text} /></p>
				{:else if block.kind === 'line'}
					<p><RichText text={block.text} /></p>
				{:else}
					<ul>
						{#each block.items as item (item)}<li><RichText text={item} /></li>{/each}
					</ul>
				{/if}
			{/each}
		</div>
	{/if}
	{#if side.footer && (family === 'journal' || family === 'ending')}
		<p class="paper-foot">{side.footer}</p>
	{/if}
	<span class="code">{code}</span>
</div>

<style>
	.back {
		--mark: #d4b886;
		--ground: #1d1915;
		align-items: center;
		gap: 0.6em;
		padding: 1.4em 1.1em 1.9em;
		background:
			radial-gradient(ellipse at 50% 30%, color-mix(in srgb, var(--mark) 18%, transparent), transparent 70%),
			linear-gradient(170deg, color-mix(in srgb, var(--mark) 12%, var(--ground)), var(--ground));
		color: #f4ebd8;
		text-align: center;
	}

	.back::before {
		position: absolute;
		inset: 0.5em;
		border: 1px solid color-mix(in srgb, var(--mark) 40%, transparent);
		border-radius: 0.3em;
		content: '';
		pointer-events: none;
	}

	.stop {
		--mark: #e0503d;
		--ground: #1f1512;
	}

	.pause {
		--mark: #e9b23f;
		--ground: #1f1a12;
	}

	.keep {
		--mark: #6fa3df;
		--ground: #131a24;
	}

	.turning {
		--mark: #4fb3a5;
		--ground: #10201e;
	}

	.rules {
		--mark: #9fb2c6;
		--ground: #171b20;
	}

	.back.alarm {
		--mark: #f0503c;
		--ground: #3a0f0b;
	}

	.back.alarm .title {
		font-size: 2.4em;
	}

	.back.alarm .body {
		font-weight: 700;
		text-align: center;
	}

	.blank {
		justify-content: center;
	}

	.journal,
	.ending {
		align-items: stretch;
		gap: 0.45em;
		padding: 1.05em 1em 1.5em;
		background:
			radial-gradient(ellipse at 20% 0%, rgb(255 250 238 / 0.5), transparent 62%),
			linear-gradient(175deg, #f3ead6, #e5d6b7);
		color: #241b13;
		box-shadow: inset 0 0 0 1.5px rgb(42 32 23 / 0.35);
		text-align: left;
	}

	.ending {
		background: radial-gradient(ellipse at 50% 0%, rgb(255 248 232 / 0.45), transparent 65%), #f6efe4;
		box-shadow: inset 0 0 0 2px #9d2c22;
	}

	.journal::before,
	.ending::before {
		display: none;
	}

	.paper-head {
		display: flex;
		flex-direction: column;
		gap: 0.12em;
		flex: none;
		padding-bottom: 0.3em;
		border-bottom: 1px solid rgb(42 32 23 / 0.22);
	}

	.paper-kicker {
		font-size: 0.68em;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #5b452d;
	}

	.ending .paper-kicker {
		color: #9d2c22;
	}

	.ending .title {
		color: #9d2c22;
		font-size: 1.25em;
	}

	.journal .body,
	.ending .body {
		color: #241b13;
		text-align: left;
		line-height: 1.34;
	}

	.band-title {
		margin: 0.35em 0 0.2em;
		font-family: var(--font-display);
		font-size: 1.15em;
		line-height: 1.12;
		color: #9d2c22;
	}

	.band-title:first-child {
		margin-top: 0;
	}

	.rule-callout {
		padding: 0.42em 0.55em;
		border-radius: 0.24em;
		border-left: 3px solid #24578a;
		background: rgb(36 87 138 / 0.13);
		color: #16304c;
		font-weight: 700;
	}

	.paper-foot {
		margin: 0;
		flex: none;
		padding-right: 3.4em;
		color: #6b563c;
		font-size: 0.66em;
		font-style: italic;
		line-height: 1.22;
	}

	.stop,
	.pause {
		justify-content: center;
	}

	.warning {
		margin: 0 0 0.4em;
		padding: 0.45em 0.6em;
		border-radius: 0.25em;
		background: #e9c43a;
		color: #1d1712;
		font-size: 0.82em;
		font-weight: 700;
		font-style: italic;
		line-height: 1.25;
	}

	.emblem {
		flex: none;
		width: 4.2em;
		height: 4.2em;
	}

	.stop .emblem,
	.pause .emblem {
		width: 6em;
		height: 6em;
	}

	.rules .emblem,
	.keep .emblem,
	.turning .emblem {
		width: 3em;
		height: 3em;
	}

	.emblem svg {
		width: 100%;
		height: 100%;
		fill: var(--mark);
		stroke: none;
	}

	.stop polygon {
		fill: var(--mark);
		stroke: #f8efe0;
		stroke-width: 2.5;
	}

	.stop text {
		fill: #fff8eb;
		font-family: var(--font-display);
		font-size: 15px;
		letter-spacing: 0.04em;
		text-anchor: middle;
	}

	.pause circle {
		fill: none;
		stroke: var(--mark);
		stroke-width: 3;
	}

	.ghost {
		opacity: 0.35;
	}

	.cut {
		fill: none;
		stroke: var(--ground);
		stroke-width: 3.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.ring {
		fill: none !important;
		stroke: var(--mark);
		stroke-width: 2.5;
	}

	.ring.thin {
		stroke-width: 1;
		opacity: 0.6;
	}

	.title {
		font-family: var(--font-display);
		font-size: 1.7em;
		font-weight: 400;
		line-height: 1.05;
		color: color-mix(in srgb, var(--mark) 55%, #fff8eb);
	}

	.body {
		flex: 1;
		min-height: 0;
		width: 100%;
		overflow: hidden;
		line-height: 1.32;
		color: rgb(244 235 216 / 0.92);
	}

	.stop .body,
	.pause .body {
		flex: none;
		max-height: 40%;
		font-weight: 600;
	}

	.rules .body,
	.keep .body,
	.turning .body {
		text-align: left;
	}

	.body p {
		margin: 0 0 0.5em;
	}

	.body ul {
		margin: 0 0 0.6em;
		padding-left: 1.1em;
		list-style: disc;
	}

	.body li {
		margin-bottom: 0.2em;
	}

	:global(.legacy-card.size-mini) .back {
		padding: 0;
		justify-content: center;
	}

	:global(.legacy-card.size-mini) .back::before,
	:global(.legacy-card.size-mini) .warning,
	:global(.legacy-card.size-mini) .paper-head,
	:global(.legacy-card.size-mini) .paper-foot,
	:global(.legacy-card.size-mini) .title,
	:global(.legacy-card.size-mini) .body {
		display: none;
	}

	:global(.legacy-card.size-mini) .emblem {
		width: 7.5em;
		height: 7.5em;
	}
</style>
