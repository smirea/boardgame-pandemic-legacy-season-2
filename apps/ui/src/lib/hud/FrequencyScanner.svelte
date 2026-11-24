<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack } from '@repo/game';
	import type { Campaign } from '@repo/game';
	import { untrack } from 'svelte';
	import { fly } from 'svelte/transition';
	import LegacyCard from '#lib/cards/LegacyCard.svelte';
	import TopTip from './TopTip.svelte';

	type Props = {
		campaign: Campaign;
		canMonitor?: boolean;
		monitorReason?: string | null;
		onopen?: () => void;
	};

	let { campaign, canMonitor = false, monitorReason = null, onopen }: Props = $props();

	let buttonEl = $state<HTMLElement>();

	const scannerCard = pack.legacyDeck.find(card => card.kind === 'scanner')!;
	const total = pack.frequencies.length;
	const remaining = $derived(total - campaign.frequenciesUsed.length);

	let prevUsed = untrack(() => campaign.frequenciesUsed.length);
	$effect(() => {
		const now = campaign.frequenciesUsed.length;
		untrack(() => {
			if (now > prevUsed && buttonEl) {
				buttonEl.animate([{ scale: '1' }, { scale: '1.22' }, { scale: '1' }], {
					duration: 420,
					easing: 'cubic-bezier(0.3, 1.6, 0.5, 1)',
				});
			}
			prevUsed = now;
		});
	});
</script>

<TopTip
	name="frequency-scanner"
	testid="frequency-scanner"
	dest="scanner"
	label={`Frequency Scanner: ${remaining} of ${total} frequencies unscratched`}
	frame
	onopen={() => onopen?.()}
	bind:element={buttonEl}
	{@attach feedback('Frequency Scanner', () => ({
		used: campaign.frequenciesUsed.length,
		remaining,
		canMonitor,
	}))}
>
	{#snippet counter()}
		<span class="dial-icon" class:ready={canMonitor} aria-hidden="true">
			<span class="band">
				<span class="ticks"></span>
				<span class="needle"></span>
			</span>
		</span>
		{#key remaining}<strong data-testid="frequency-scanner-count" in:fly={{ y: -8, duration: 260 }}>{remaining}</strong
			>{/key}
	{/snippet}
	<LegacyCard card={scannerCard} side="b" size="full" {campaign} />
	<span class="tip-note">
		{#if canMonitor}
			Click to Monitor · {remaining} of {total} frequencies left
		{:else if monitorReason}
			{monitorReason} · click to inspect
		{:else}
			{remaining} of {total} frequencies left · click to inspect
		{/if}
	</span>
</TopTip>

<style>
	.dial-icon {
		position: relative;
		display: grid;
		place-items: center;
		width: 1.65rem;
		height: 1.15rem;
		margin-right: 0.05rem;
		padding: 0.16rem;
		box-sizing: border-box;
		border: 1px solid #526269;
		border-radius: 2px;
		background: linear-gradient(170deg, #25282c, #141619);
		box-shadow:
			inset 0 0 0 1px rgb(121 210 217 / 0.12),
			0 1px 2px rgb(0 0 0 / 0.45);
		transition:
			border-color 180ms ease,
			box-shadow 180ms ease;
	}

	.dial-icon.ready {
		border-color: #79d2d9;
		box-shadow:
			inset 0 0 0 1px rgb(121 210 217 / 0.3),
			0 0 0.5rem rgb(121 210 217 / 0.35);
	}

	.band {
		position: relative;
		display: block;
		width: 100%;
		height: 100%;
		border-radius: 1px;
		background: linear-gradient(180deg, #1b2826, #283a35);
		border: 1px solid #3c524d;
		overflow: hidden;
	}

	.ticks {
		position: absolute;
		inset: 2px 2px auto;
		height: 3px;
		background: repeating-linear-gradient(90deg, rgb(235 228 214 / 0.72) 0 1px, transparent 1px 3px);
	}

	.needle {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 58%;
		width: 1.5px;
		background: #79d2d9;
		box-shadow: 0 0 4px rgb(121 210 217 / 0.85);
	}

	.tip-note {
		color: var(--ink);
		font-size: 0.76rem;
		letter-spacing: 0.02em;
	}
</style>
