<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { characterCardIndex } from '@repo/game';
	import type { ExposureBox } from '@repo/game';
	import CardIcon from '#lib/cards/CardIcon.svelte';
	import { SCAR_ICON } from '#lib/cards/icons.ts';
	import { characterCardScan, originals, scanUrl } from '#lib/scans.svelte.ts';

	type Props = {
		exposureTrack: readonly ExposureBox[];
		exposure: number;
		label?: string;
		name?: string;
		occupation?: string;
		home?: string;
	};

	let { exposureTrack, exposure, label, name = '', occupation = '', home = '' }: Props = $props();

	const cardNumber = $derived(characterCardIndex(exposureTrack) + 1);
	const cardTitle = $derived(
		label ?? (cardNumber > 0 ? `Character ${String(cardNumber).padStart(2, '0')}` : 'Character'),
	);
	const clamped = $derived(Math.max(0, Math.min(exposureTrack.length, exposure)));
	const boxes = $derived(
		exposureTrack.map((result, index) => ({
			index,
			revealed: index < clamped,
			result: index < clamped ? result : ('hidden' as const),
		})),
	);
	const revealedScars = $derived(boxes.filter(box => box.result === 'scar').length);
	const deceased = $derived(boxes.some(box => box.result === 'skull'));
	const summary = $derived(
		clamped === 0
			? `0 / ${exposureTrack.length} exposed`
			: deceased
				? `${clamped} / ${exposureTrack.length} exposed · Deceased`
				: `${clamped} / ${exposureTrack.length} exposed${revealedScars ? ` · ${revealedScars} scar${revealedScars === 1 ? '' : 's'}` : ''}`,
	);
	const originalScan = $derived(characterCardScan(exposureTrack, clamped));
</script>

<article
	class="char-card"
	class:deceased
	data-character-card={cardNumber || undefined}
	data-exposure={clamped}
	data-original-active={originals.held && Boolean(originalScan)}
	{@attach feedback('Character card', () => ({ card: cardTitle, exposure: clamped, deceased }))}
>
	{#if originals.held && originalScan}
		<img class="original-swap" src={scanUrl(originalScan.src)} alt={`${cardTitle}, ${summary}`} />
	{:else}
		<header class="head">
			<span class="kicker">{cardTitle}</span>
			<span class="name">{name || 'Name'}</span>
			<span class="meta">
				{occupation || 'Occupation'}{home ? ` · ${home}` : ''}
			</span>
		</header>

		<div class="slots" aria-hidden="true">
			<div class="slot-box"><span>Occupation / Ability</span></div>
			<div class="slot-box"><span>Ability / Scar</span></div>
			<div class="slot-box"><span>Ability / Scar</span></div>
		</div>

		<section class="exposure" aria-label={`Exposure track, ${summary}`}>
			<span class="track-label">Exposure</span>
			<ol class="boxes">
				{#each boxes as box (box.index)}
					<li
						class="box {box.result}"
						data-box={box.index + 1}
						data-box-state={box.result}
						aria-label={`Box ${box.index + 1}: ${
							box.result === 'hidden'
								? 'unscratched'
								: box.result === 'empty'
									? 'safe'
									: box.result === 'scar'
										? 'scar'
										: 'skull'
						}`}
					>
						{#if box.result === 'hidden'}
							<span class="num">{box.index + 1}</span>
						{:else if box.result === 'empty'}
							<span class="safe-mark" aria-hidden="true">○</span>
						{:else if box.result === 'scar'}
							<CardIcon path={SCAR_ICON} size="1.05em" />
						{:else}
							<span class="skull-mark" aria-hidden="true">☠</span>
						{/if}
					</li>
				{/each}
			</ol>
			<span class="summary" class:dead={deceased}>{summary}</span>
		</section>
	{/if}
</article>

<style>
	.char-card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.42em;
		width: 9.2em;
		height: 13.1em;
		flex: none;
		padding: 0.48em;
		border: 1px solid #6b5a42;
		border-radius: 0.4em;
		background:
			radial-gradient(ellipse at 18% 0%, rgb(255 250 236 / 0.55), transparent 62%),
			linear-gradient(172deg, #efe4ca, #dccba9);
		color: #241b12;
		font-family: var(--font-ui);
		font-size: var(--card-size, 0.73rem);
		overflow: hidden;
		box-shadow:
			inset 0 0 0 0.2em rgb(120 98 68 / 0.16),
			0 0.18em 0.35em rgb(0 0 0 / 0.35),
			0 0.6em 1.4em rgb(0 0 0 / 0.24);
	}

	.char-card.deceased {
		border-color: #7c2019;
	}

	.char-card[data-original-active='true'] {
		padding: 0;
	}

	.original-swap {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.head {
		display: flex;
		flex-direction: column;
		gap: 0.08em;
		padding-bottom: 0.32em;
		border-bottom: 1px solid rgb(56 42 26 / 0.24);
	}

	.kicker {
		color: #6b5840;
		font-size: 0.6em;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.name {
		font-family: var(--font-display);
		font-size: 1.05em;
		line-height: 1.04;
	}

	.meta {
		color: #5c4b37;
		font-size: 0.62em;
		line-height: 1.2;
	}

	.slots {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.26em;
		min-height: 0;
	}

	.slot-box {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		border: 1px dashed rgb(64 49 32 / 0.34);
		border-radius: 0.18em;
		background: rgb(255 251 242 / 0.38);
		color: rgb(88 71 52 / 0.65);
		font-size: 0.54em;
		font-weight: 600;
		letter-spacing: 0.03em;
		text-transform: uppercase;
	}

	.exposure {
		display: flex;
		flex-direction: column;
		gap: 0.24em;
		padding-top: 0.28em;
		border-top: 1px solid rgb(56 42 26 / 0.24);
	}

	.track-label {
		color: #5a4630;
		font-size: 0.58em;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.boxes {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 0.16em;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.box {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		border: 1px solid rgb(56 42 26 / 0.45);
		border-radius: 0.14em;
		font-size: 0.68em;
		font-weight: 800;
		line-height: 1;
	}

	.box.hidden {
		border-color: #7c776e;
		background:
			repeating-linear-gradient(-45deg, rgb(255 255 255 / 0.22) 0 2px, transparent 2px 4px),
			linear-gradient(135deg, #c7c3ba, #a39e95);
		color: #3a352e;
	}

	.box.empty {
		background: #faf4e6;
		color: #5a6b52;
	}

	.box.scar {
		border-color: #9e271f;
		background: #b92f25;
		color: #fff5ee;
	}

	.box.skull {
		border-color: #3a0d0a;
		background: #231110;
		color: #f6b2aa;
	}

	.num {
		font-size: 0.78em;
		opacity: 0.7;
	}

	.safe-mark {
		font-size: 0.92em;
	}

	.skull-mark {
		font-size: 1.05em;
	}

	.summary {
		color: #5c4b37;
		font-size: 0.58em;
		font-weight: 700;
		line-height: 1.15;
	}

	.summary.dead {
		color: #9e271f;
	}
</style>
