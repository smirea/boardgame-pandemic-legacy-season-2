<script lang="ts">
	import type { Campaign, LegacyCardDef } from '@repo/game';
	import type { LegacyPrint } from '#lib/cards/print.generated.ts';
	import { fitText } from '#lib/cards/fit.ts';
	import RichText from '#lib/hud/RichText.svelte';

	type Props = { card: LegacyCardDef; print: LegacyPrint; code: string; monthLabel: string; campaign?: Campaign };

	let { card, print, code, monthLabel }: Props = $props();

	const docText = $derived(card.text);

	const openedSeals = $derived(
		card.unlocks.flatMap(u =>
			u.t === 'open' ? [u.seal.t === 'package' ? `Package ${u.seal.id}` : `Door ${u.seal.id}`] : [],
		),
	);

	const KIND_LABEL: Partial<Record<LegacyCardDef['kind'], string>> = {
		prologue: 'Prologue',
		stop: 'Stop',
		pause: 'Pause',
		archive: 'Journal',
		priorities: 'New Priorities',
		turningPoint: 'Turning Point',
		ending: 'Ending',
		end: 'Campaign End',
	};
</script>

<div class="doc {card.kind}">
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
</div>

<style>
	.doc {
		display: contents;
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
