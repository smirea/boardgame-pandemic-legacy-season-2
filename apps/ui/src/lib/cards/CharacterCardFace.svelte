<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { characterCardIndex } from '@repo/game';
	import type { ExposureBox, JobId } from '@repo/game';
	import CardIcon from '#lib/cards/CardIcon.svelte';
	import { SCAR_ICON } from '#lib/cards/icons.ts';
	import Portrait from '#lib/hud/Portrait.svelte';
	import { characterCardScan, originals, scanUrl } from '#lib/scans.svelte.ts';

	type Props = {
		exposureTrack: readonly ExposureBox[];
		exposure: number;
		label?: string;
		name?: string;
		occupation?: string;
		job?: JobId | null;
		home?: string;
		age?: string;
		placeOfDeath?: string;
		portrait?: number;
		hooded?: boolean;
	};

	let {
		exposureTrack,
		exposure,
		label,
		name = '',
		occupation = '',
		job = null,
		home = '',
		age = '',
		placeOfDeath = '',
		portrait,
		hooded = false,
	}: Props = $props();

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
	const portraitIndex = $derived(portrait ?? Math.max(0, cardNumber - 1));
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
		<header class="dossier-head">
			<span class="photo" aria-hidden="true">
				<Portrait portrait={portraitIndex} color="#283645" {job} {hooded} dead={deceased} />
			</span>
			<div class="identity">
				<span class="kicker">
					<svg class="anchor-crest" viewBox="0 0 16 16" aria-hidden="true">
						<circle cx="8" cy="3.4" r="1.5" fill="none" stroke="currentColor" stroke-width="1.3" />
						<path
							d="M8 5v8.2M5 7h6M3.4 9.8a4.6 4.6 0 0 0 9.2 0"
							fill="none"
							stroke="currentColor"
							stroke-width="1.3"
							stroke-linecap="round"
						/>
					</svg>
					{cardTitle}
				</span>
				<span class="field-name">{name || 'Name'}</span>
				<div class="meta-grid">
					<span class="field"><em>Home</em><b>{home || 'Haven'}</b></span>
					<span class="field"><em>Age</em><b>{age || '—'}</b></span>
				</div>
				{#if deceased || placeOfDeath}
					<span class="field death"><em>Place of Death</em><b>{placeOfDeath || 'Lost on the grid'}</b></span>
				{/if}
			</div>
		</header>

		<div class="slots" aria-hidden="true">
			<div class="slot-box job-slot">
				<span>{occupation || 'Occupation'}</span>
			</div>
			<div class="slot-box"><span>Ability / Scar</span></div>
			<div class="slot-box"><span>Ability / Scar</span></div>
			<div class="slot-box"><span>Ability / Scar</span></div>
			<div class="slot-box"><span>Ability / Scar</span></div>
		</div>

		<section class="exposure" aria-label={`Exposure track, ${summary}`}>
			<div class="track-banner">
				<span class="track-label">Exposure</span>
				<span class="summary" class:dead={deceased}>{summary}</span>
			</div>
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
		</section>
	{/if}
</article>

<style>
	.char-card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.34em;
		width: 9.8em;
		height: 13.8em;
		flex: none;
		padding: 0;
		border: 1.5px solid #2b3a4b;
		border-radius: 0.42em;
		background:
			radial-gradient(ellipse at 18% 0%, rgb(255 250 236 / 0.55), transparent 62%),
			linear-gradient(172deg, #efe4ca, #d8c6a2);
		color: #211912;
		font-family: var(--font-ui);
		font-size: var(--card-size, 0.73rem);
		overflow: hidden;
		box-shadow:
			0 0.22em 0.45em rgb(0 0 0 / 0.42),
			0 0.65em 1.5em rgb(0 0 0 / 0.28);
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

	.dossier-head {
		display: grid;
		grid-template-columns: 3.1em minmax(0, 1fr);
		gap: 0.42em;
		padding: 0.42em 0.46em 0.38em;
		background: linear-gradient(170deg, #1b2a3c, #121c29);
		border-bottom: 2px solid #a98e5e;
		color: #efe6d0;
	}

	.photo {
		position: relative;
		display: block;
		width: 3.1em;
		height: 3.55em;
		border: 1px solid rgb(239 230 208 / 0.45);
		border-radius: 0.2em;
		overflow: hidden;
		background: #101822;
		box-shadow: 0 0.12em 0.3em rgb(0 0 0 / 0.45);
	}

	.identity {
		display: flex;
		flex-direction: column;
		gap: 0.1em;
		min-width: 0;
	}

	.kicker {
		display: inline-flex;
		align-items: center;
		gap: 0.22em;
		color: #c8b282;
		font-size: 0.54em;
		font-weight: 800;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}

	.anchor-crest {
		width: 1.05em;
		height: 1.05em;
		flex: none;
	}

	.field-name {
		font-family: var(--font-display);
		font-size: 1.04em;
		line-height: 1.02;
		color: #fbf5e6;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.5fr) minmax(0, 0.7fr);
		gap: 0.24em;
		margin-top: 0.06em;
	}

	.field {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.field em {
		font-style: normal;
		font-size: 0.44em;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #9ba9b8;
		line-height: 1;
	}

	.field b {
		font-size: 0.56em;
		font-weight: 700;
		color: #ece2cb;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		line-height: 1.18;
	}

	.field.death b {
		color: #f39a8e;
	}

	.slots {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.2em;
		min-height: 0;
		padding: 0 0.44em;
	}

	.slot-box {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		border: 1px dashed rgb(48 39 28 / 0.36);
		border-radius: 0.16em;
		background: rgb(255 251 242 / 0.42);
		color: rgb(74 60 44 / 0.72);
		font-size: 0.5em;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.slot-box.job-slot {
		border-style: solid;
		border-color: rgb(32 48 68 / 0.45);
		background: rgb(27 42 60 / 0.12);
		color: #1b2a3c;
	}

	.exposure {
		display: flex;
		flex-direction: column;
		gap: 0.22em;
		padding: 0 0.44em 0.4em;
	}

	.track-banner {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.3em;
		padding: 0.14em 0.34em;
		border-radius: 0.16em;
		background: #92261e;
		color: #fff5e6;
	}

	.track-label {
		font-size: 0.54em;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.boxes {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 0.14em;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.box {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		border: 1px solid rgb(56 42 26 / 0.48);
		border-radius: 0.14em;
		font-size: 0.66em;
		font-weight: 800;
		line-height: 1;
	}

	.box.hidden {
		border-color: #7c776e;
		background:
			repeating-linear-gradient(-45deg, rgb(255 255 255 / 0.24) 0 2px, transparent 2px 4px),
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
		font-size: 0.48em;
		font-weight: 700;
		letter-spacing: 0.02em;
		opacity: 0.92;
		white-space: nowrap;
	}

	.summary.dead {
		color: #ffd0c6;
	}
</style>
