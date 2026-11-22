<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack } from '@repo/game';
	import type { Campaign } from '@repo/game';
	import { untrack } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import LegacyCard from '#lib/cards/LegacyCard.svelte';

	type Props = {
		campaign: Campaign;
		canMonitor?: boolean;
		monitorReason?: string | null;
		onopen?: () => void;
	};

	let { campaign, canMonitor = false, monitorReason = null, onopen }: Props = $props();

	let open = $state(false);
	let buttonEl = $state<HTMLButtonElement>();

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

<div
	class="scanner-wrap"
	{@attach feedback('Frequency Scanner', () => ({
		used: campaign.frequenciesUsed.length,
		remaining,
		canMonitor,
	}))}
>
	<button
		class="scanner"
		class:ready={canMonitor}
		bind:this={buttonEl}
		onclick={() => {
			open = false;
			onopen?.();
		}}
		data-testid="frequency-scanner"
		data-dest="scanner"
		aria-label={`Frequency Scanner: ${remaining} of ${total} frequencies unscratched`}
		aria-expanded={open}
		onpointerenter={() => (open = true)}
		onpointerleave={() => (open = false)}
		onfocus={() => (open = true)}
		onblur={() => (open = false)}
	>
		<span class="dial-icon" aria-hidden="true">
			<span class="band">
				<span class="ticks"></span>
				<span class="needle"></span>
			</span>
		</span>
		{#key remaining}<strong data-testid="frequency-scanner-count" in:fly={{ y: -8, duration: 260 }}>{remaining}</strong
			>{/key}
	</button>

	{#if open}
		<div class="tip" role="tooltip" data-testid="frequency-scanner-tip" transition:fade={{ duration: 140 }}>
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
		</div>
	{/if}
</div>

<style>
	.scanner-wrap {
		position: relative;
		display: inline-flex;
		align-items: center;
		flex: none;
	}

	.scanner {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.15rem 0.3rem;
		border: 0;
		border-radius: 4px;
		background: transparent;
		color: var(--ink);
		font: inherit;
		cursor: pointer;
	}

	.scanner:hover {
		background: rgb(231 220 198 / 0.08);
	}

	.scanner strong {
		font-size: 1.02rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.dial-icon {
		position: relative;
		display: grid;
		place-items: center;
		width: 1.65rem;
		height: 1.15rem;
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

	.scanner.ready .dial-icon {
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

	.tip {
		position: absolute;
		top: calc(100% + 0.55rem);
		right: 0;
		z-index: 65;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.45rem;
		padding: 0.55rem 0.55rem 0.5rem;
		border: 1px solid var(--line-strong);
		border-radius: 6px;
		background: rgb(20 18 14 / 0.97);
		box-shadow: 0 1.2rem 3rem rgb(0 0 0 / 0.65);
		pointer-events: none;
		white-space: normal;
	}

	.tip-note {
		color: var(--ink);
		font-size: 0.76rem;
		letter-spacing: 0.02em;
	}
</style>
