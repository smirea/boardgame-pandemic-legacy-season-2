<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack } from '@repo/game';
	import type { Campaign } from '@repo/game';
	import { SCANNER_SLOTS } from '#lib/cards/playerPrint.ts';
	import { legacyScans } from '#lib/scans.generated.ts';
	import { originals, scanUrl } from '#lib/scans.svelte.ts';
	import RichText from './RichText.svelte';

	type Props = {
		campaign: Campaign;
		/** Frequencies legal to Monitor right now. Present when picking a frequency; absent when inspecting. */
		legal?: Set<number>;
		/** Engine reason why Monitor cannot be taken right now, shown in inspect mode. */
		reason?: string | null;
		onpick?: (frequency: number) => void;
		onclose: () => void;
	};

	let { campaign, legal, reason = null, onpick, onclose }: Props = $props();

	const picking = $derived(Boolean(onpick && legal && legal.size > 0));
	const remaining = $derived(pack.frequencies.length - campaign.frequenciesUsed.length);
	const triangulated = $derived(campaign.opened.includes('door:35'));
	const hinted = new Set(
		pack.frequencies.flatMap((reward, index) =>
			reward && ('seal' in reward || ('take' in reward && reward.take > 1)) ? [index] : [],
		),
	);
	const hintedLabels = [...hinted].map(index => pack.frequencyLabels[index]!);
	const originalSrc = legacyScans['08-04']?.src ? scanUrl(legacyScans['08-04'].src) : null;
</script>

<svelte:window onkeydown={event => event.key === 'Escape' && onclose()} />

<section
	class="scanner-dialog"
	aria-label="Frequency Scanner"
	data-testid="scanner-dialog"
	data-mode={picking ? 'monitor' : 'inspect'}
	{@attach feedback('Frequency Scanner dialog', () => ({
		mode: picking ? 'monitor' : 'inspect',
		used: campaign.frequenciesUsed,
		remaining,
		triangulated,
	}))}
>
	<header class="dialog-head">
		<div>
			<h2>Frequency Scanner</h2>
			<p class="subtitle">
				{#if picking}
					Select an unscratched frequency — discards 4 Player cards from the deck.
				{:else if reason}
					{reason}
				{:else}
					{remaining} of {pack.frequencies.length} frequencies unscratched.
				{/if}
			</p>
		</div>
		<button class="close" onclick={onclose} aria-label="Close Frequency Scanner">×</button>
	</header>

	{#if originals.held && originalSrc}
		<div class="original-frame">
			<img src={originalSrc} alt="Frequency Scanner (printed original 08-04b)" />
		</div>
	{:else}
		<div class="scanner-card">
			<div class="scanner-head">
				<h3>FREQUENCY SCANNER</h3>
				<p>When you do the Monitor action, scratch a box, then refer to the text below.</p>
			</div>

			<div class="dial-band" role="group" aria-label="Frequency dial">
				<div class="dial-slots">
					{#each SCANNER_SLOTS as slot, idx (slot.label)}
						{@const scratched = campaign.frequenciesUsed.includes(idx)}
						{@const canPick = picking && !scratched && Boolean(legal?.has(idx))}
						{@const isHinted = triangulated && hinted.has(idx)}
						{#if canPick}
							<button
								type="button"
								class="freq pickable"
								class:stagger={idx % 2 === 1}
								class:hinted={isHinted}
								data-frequency={idx}
								data-testid={`scanner-freq-${slot.label}`}
								aria-label={`Monitor frequency ${slot.label}${isHinted ? ' (triangulated signal)' : ''}`}
								onclick={() => onpick?.(idx)}
							>
								<span class="scratch" aria-hidden="true">
									{#if isHinted}<span class="beacon"></span>{/if}
								</span>
								<i class="tick" aria-hidden="true"></i>
								<b>{slot.label}</b>
							</button>
						{:else}
							<div
								class="freq"
								class:used={scratched}
								class:stagger={idx % 2 === 1}
								class:hinted={isHinted && !scratched}
								data-frequency={idx}
								data-testid={`scanner-freq-${slot.label}`}
							>
								<span
									class="scratch"
									aria-label={scratched
										? slot.reveal.kind === 'door'
											? `${slot.label} scratched: open door ${slot.reveal.door}`
											: `${slot.label} scratched: take ${slot.reveal.count} card${slot.reveal.count === 1 ? '' : 's'}`
										: `${slot.label} covered`}
								>
									{#if scratched}
										{#if slot.reveal.kind === 'door'}
											<span class="door-badge">{slot.reveal.door}</span>
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
									{:else if isHinted}
										<span class="beacon" aria-hidden="true"></span>
									{/if}
								</span>
								<i class="tick" aria-hidden="true"></i>
								<b>{slot.label}</b>
							</div>
						{/if}
					{/each}
				</div>
			</div>

			<div class="scanner-bottom">
				<div class="scanner-legend">
					<strong>IF YOU REVEAL:</strong>
					<ul>
						<li><span class="door-badge sm">#</span>: Open the dossier door.</li>
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
			<span class="code">08-04b</span>
		</div>
	{/if}

	<footer class="dialog-foot">
		{#if triangulated}
			<p class="triangulated">
				<span class="beacon inline" aria-hidden="true"></span>
				Door 35 — Triangulated signals: <b>{hintedLabels.join(', ')}</b>
			</p>
		{/if}
		<span class="hold-o">Hold O for printed card</span>
	</footer>
</section>

<style>
	.scanner-dialog {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: min(42rem, 94vw);
		padding: 1rem 1.25rem 0.9rem;
		box-sizing: border-box;
		border: 1px solid var(--line-strong);
		border-radius: 6px;
		background: rgb(20 18 15 / 0.96);
		color: var(--ink);
		box-shadow: 0 1.8rem 4.2rem rgb(0 0 0 / 0.72);
	}

	.dialog-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.dialog-head h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.55rem;
		font-weight: 400;
		line-height: 1.05;
	}

	.subtitle {
		margin: 0.2rem 0 0;
		color: var(--muted);
		font-size: 0.85rem;
	}

	.scanner-dialog[data-mode='monitor'] .subtitle {
		color: #9be0e6;
	}

	.close {
		flex: none;
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--line-strong);
		border-radius: 50%;
		background: transparent;
		color: var(--ink);
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
	}

	.close:hover {
		border-color: var(--paper);
		background: var(--wash);
	}

	.original-frame {
		border-radius: 7px;
		overflow: hidden;
		box-shadow: 0 1rem 2.4rem rgb(0 0 0 / 0.55);
	}

	.original-frame img {
		display: block;
		width: 100%;
		height: auto;
	}

	.scanner-card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.95rem;
		padding: 1.1rem 1.35rem 1.25rem;
		border: 2px solid #4d5a60;
		border-radius: 7px;
		background: linear-gradient(160deg, #1d1a1e, #110f12);
		color: #ebe4d6;
		box-shadow: 0 1rem 2.4rem rgb(0 0 0 / 0.58);
	}

	.scanner-head h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.85rem;
		font-weight: 400;
		font-style: italic;
		letter-spacing: 0.04em;
		color: #79d2d9;
		line-height: 1.02;
	}

	.scanner-head p {
		margin: 0.22rem 0 0;
		font-size: 0.94rem;
		color: rgb(235 228 214 / 0.9);
		line-height: 1.28;
	}

	.dial-band {
		padding: 0.55rem 0.65rem 0.45rem;
		border-radius: 5px;
		background: linear-gradient(180deg, #1b2221, #27322e);
		border: 1.5px solid #485b57;
	}

	.dial-slots {
		display: grid;
		grid-template-columns: repeat(10, 1fr);
		gap: 0.35rem;
	}

	.freq {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.15rem 0.05rem;
		border: 0;
		border-radius: 4px;
		background: none;
		color: inherit;
		font: inherit;
	}

	button.freq.pickable {
		cursor: pointer;
		transition:
			transform 150ms ease,
			background 150ms ease;
	}

	button.freq.pickable:hover,
	button.freq.pickable:focus-visible {
		background: rgb(121 210 217 / 0.14);
		transform: translateY(-2px);
		outline: none;
	}

	button.freq.pickable:focus-visible {
		box-shadow: 0 0 0 2px #79d2d9;
	}

	.scratch {
		position: relative;
		display: grid;
		place-items: center;
		width: 100%;
		height: 2.35rem;
		border-radius: 3px;
		background: linear-gradient(135deg, #d6d3cb, #b8b3a9);
		border: 1.5px solid rgb(255 255 255 / 0.32);
		transition:
			border-color 150ms ease,
			box-shadow 150ms ease,
			background 150ms ease;
	}

	button.freq.pickable .scratch {
		box-shadow: 0 2px 6px rgb(0 0 0 / 0.35);
	}

	button.freq.pickable:hover .scratch,
	button.freq.pickable:focus-visible .scratch {
		background: linear-gradient(135deg, #f0ede5, #d5d0c4);
		border-color: #79d2d9;
		box-shadow: 0 0 0.75rem rgb(121 210 217 / 0.65);
	}

	.freq.hinted:not(.used) .scratch {
		border-color: var(--warn);
		box-shadow: 0 0 0.55rem rgb(214 165 73 / 0.45);
	}

	.freq.used .scratch {
		background: #2c282a;
		border-color: rgb(121 210 217 / 0.55);
	}

	.beacon {
		width: 0.48rem;
		height: 0.48rem;
		border-radius: 50%;
		background: var(--warn);
		box-shadow: 0 0 0.4rem rgb(214 165 73 / 0.85);
	}

	.beacon.inline {
		display: inline-block;
		vertical-align: middle;
		margin-right: 0.35rem;
	}

	.tick {
		width: 2px;
		height: 0.55rem;
		background: rgb(235 228 214 / 0.72);
	}

	.freq.stagger .tick {
		height: 0.28rem;
	}

	button.freq.pickable:hover .tick {
		background: #79d2d9;
	}

	.freq b {
		margin-top: 0.14rem;
		font-size: 0.8rem;
		font-variant-numeric: tabular-nums;
		color: #f0ece2;
		line-height: 1.1;
	}

	.freq:not(.stagger) b {
		margin-top: 0.28rem;
	}

	button.freq.pickable:hover b {
		color: #79d2d9;
	}

	.freq.used b {
		color: rgb(240 236 226 / 0.5);
		text-decoration: line-through;
	}

	.door-badge {
		display: inline-grid;
		place-items: center;
		min-width: 1.45rem;
		height: 1.45rem;
		padding: 0 0.22rem;
		border-radius: 3px;
		background: linear-gradient(160deg, #df7224, #b94e16);
		color: #fffaf0;
		font-size: 0.82rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}

	.door-badge.sm {
		min-width: 1.15rem;
		height: 1.15rem;
		font-size: 0.72rem;
		vertical-align: -0.1em;
	}

	.cards-ico {
		width: 72%;
		height: 78%;
		fill: #f4f1ea;
		stroke: #2c282a;
		stroke-width: 1.4;
	}

	.cards-ico.inline {
		width: 1.15em;
		height: 1.1em;
		vertical-align: -0.18em;
	}

	.scanner-bottom {
		display: flex;
		align-items: flex-end;
		gap: 1rem;
	}

	.scanner-legend {
		flex: 1;
		padding: 0.55rem 0.75rem;
		border-radius: 4px;
		background: #ede6d6;
		color: #1c1814;
		font-size: 0.84rem;
		line-height: 1.3;
	}

	.scanner-legend strong {
		display: block;
		font-style: italic;
		letter-spacing: 0.03em;
		margin-bottom: 0.22rem;
	}

	.scanner-legend ul {
		margin: 0;
		padding: 0 0 0 1.15rem;
		display: flex;
		flex-direction: column;
		gap: 0.24rem;
	}

	.ico-inline {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		white-space: nowrap;
	}

	.scanner-knobs {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0 0.35rem 1.45rem 0;
		flex: none;
	}

	.knob {
		width: 1.85rem;
		height: 1.85rem;
		border-radius: 50%;
		border: 2px solid #6b767c;
		background: radial-gradient(circle at 35% 35%, #5b6368, #23272a);
	}

	.knob.big {
		width: 2.45rem;
		height: 2.45rem;
	}

	.jack {
		width: 0.8rem;
		height: 0.8rem;
		border-radius: 50%;
		border: 2px solid #8a9498;
		background: #0d0e10;
	}

	.code {
		position: absolute;
		right: 0.85rem;
		bottom: 0.55rem;
		padding: 0.1rem 0.55rem;
		border-radius: 999px;
		background: rgb(255 252 245 / 0.9);
		color: #1c1712;
		font-size: 0.74rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.dialog-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		font-size: 0.78rem;
		color: var(--muted);
	}

	.triangulated {
		margin: 0;
		color: var(--paper);
	}

	.hold-o {
		margin-left: auto;
	}
</style>
