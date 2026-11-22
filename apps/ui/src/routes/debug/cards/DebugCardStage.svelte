<script lang="ts">
	import type { Snippet } from 'svelte';
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { scanUrl } from '#lib/scans.svelte.ts';
	import type { CardScan } from '#lib/scans.svelte.ts';

	export type CardControl = {
		id: string;
		label: string;
		active?: boolean;
		disabled?: boolean;
		onclick: () => void;
	};

	export type UpgradeControl = {
		id: string;
		label: string;
		active: boolean;
		onclick: () => void;
	};

	type Props = {
		id: string;
		kind: 'player' | 'infection' | 'character';
		scan?: CardScan | null;
		compare?: boolean;
		controlsLabel?: string;
		controls?: CardControl[];
		upgrades?: UpgradeControl[];
		onremoveUpgrade?: () => void;
		noSlotNote?: boolean;
		children: Snippet;
	};

	let {
		id,
		kind,
		scan = null,
		compare = false,
		controlsLabel = 'Card state',
		controls = [],
		upgrades = [],
		onremoveUpgrade,
		noSlotNote = false,
		children,
	}: Props = $props();

	const hasTray = $derived(controls.length > 0 || upgrades.length > 0);
	const hasActiveUpgrade = $derived(upgrades.some(item => item.active));
	let root = $state<HTMLElement>();
	let openLeft = $state(false);
	let pinned = $state(false);

	const TRAY_WIDTH_PX = 195;

	function checkSide() {
		if (!root) return;
		const rect = root.getBoundingClientRect();
		openLeft = rect.right + TRAY_WIDTH_PX > window.innerWidth && rect.left > TRAY_WIDTH_PX;
	}
</script>

<div
	class="stage {kind}"
	class:has-tray={hasTray}
	class:left={openLeft}
	class:pinned
	role="group"
	aria-label={`Card ${id}`}
	data-debug-card={id}
	bind:this={root}
	onpointerenter={checkSide}
	onfocusin={checkSide}
	{@attach feedback('Debug card stage', () => ({
		id,
		kind,
		controls: controls.length,
		upgrades: upgrades.length,
		compare,
	}))}
>
	<div class="visual">
		{@render children()}
		{#if compare && scan}
			<div class="scan-box {kind}" data-scan-compare={id}>
				<img
					class="scan-img"
					class:rotated={Boolean(scan.card.rotated)}
					src={scanUrl(scan.card.src)}
					alt={`${scan.card.title} printed`}
				/>
				{#if scan.sticker}
					<img
						class="scan-sticker {kind}"
						src={scanUrl(scan.sticker.src)}
						alt={scan.sticker.title}
						data-scan-sticker={scan.sticker.title}
					/>
				{/if}
			</div>
		{/if}
	</div>

	{#if hasTray}
		<button
			type="button"
			class="pin-dot"
			aria-label={pinned ? 'Hide card controls' : 'Show card controls'}
			aria-pressed={pinned}
			onclick={() => {
				checkSide();
				pinned = !pinned;
			}}
		>
			{pinned ? '×' : '⋯'}
		</button>

		<div class="tray" role="group" aria-label={`Controls for ${id}`} data-card-controls={id}>
			{#if controls.length > 0}
				<div class="group">
					<span class="group-label">{controlsLabel}</span>
					<div class="btns">
						{#each controls as ctrl (ctrl.id)}
							<button
								type="button"
								class:on={Boolean(ctrl.active)}
								aria-pressed={ctrl.active !== undefined ? ctrl.active : undefined}
								disabled={ctrl.disabled}
								data-control={ctrl.id}
								onclick={ctrl.onclick}
							>
								{ctrl.label}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			{#if upgrades.length > 0}
				<div class="group">
					<span class="group-label">
						Upgrade
						{#if noSlotNote}<small>no slot</small>{/if}
					</span>
					<div class="btns">
						{#each upgrades as upg (upg.id)}
							<button
								type="button"
								class:on={upg.active}
								aria-pressed={upg.active}
								data-upgrade={upg.id}
								onclick={upg.onclick}
							>
								{upg.label}
							</button>
						{/each}
						{#if hasActiveUpgrade && onremoveUpgrade}
							<button type="button" class="remove" data-upgrade="remove" onclick={onremoveUpgrade}
								>Remove upgrade</button
							>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.stage {
		position: relative;
		display: inline-flex;
		align-items: flex-start;
	}

	.stage:hover,
	.stage:focus-within,
	.stage.pinned {
		z-index: 30;
	}

	.visual {
		display: inline-flex;
		align-items: flex-end;
		gap: 0.45rem;
	}

	.scan-box {
		position: relative;
		flex: none;
		overflow: hidden;
		border-radius: 0.4em;
		font-size: var(--card-size, 0.73rem);
		background: #14110e;
		box-shadow: 0 0.2em 0.7em rgb(0 0 0 / 0.35);
	}

	.scan-box.player {
		width: 7.6em;
		height: 10.6em;
	}

	.scan-box.character {
		width: 9.2em;
		height: 13.1em;
	}

	.scan-box.infection {
		width: 11em;
		height: 7.9em;
	}

	.scan-img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* Base-game infection scans are stored portrait (rotated 90deg clockwise). */
	.scan-img.rotated {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 7.9em;
		height: 11em;
		transform: translate(-50%, -50%) rotate(-90deg);
		object-fit: cover;
	}

	.scan-sticker {
		position: absolute;
		pointer-events: none;
		border-radius: 0.16em;
		box-shadow: 0 1px 4px rgb(0 0 0 / 0.55);
	}

	.scan-sticker.player {
		left: 11%;
		top: 50%;
		width: 78%;
		height: auto;
		transform: translateY(-50%);
	}

	.scan-sticker.infection {
		left: 11%;
		top: 58%;
		width: 78%;
		height: auto;
		transform: translateY(-50%);
	}

	.pin-dot {
		position: absolute;
		top: 0.25rem;
		right: 0.25rem;
		z-index: 4;
		display: grid;
		place-items: center;
		width: 1.35rem;
		height: 1.35rem;
		padding: 0;
		border: 1px solid rgb(231 220 198 / 0.45);
		border-radius: 999px;
		background: rgb(20 16 12 / 0.78);
		color: #f3e9d4;
		font-size: 0.78rem;
		line-height: 1;
		cursor: pointer;
		opacity: 0.7;
		transition:
			opacity 140ms ease,
			background 140ms ease;
	}

	@media (hover: hover) {
		.pin-dot {
			opacity: 0;
		}
	}

	.stage:hover .pin-dot,
	.stage:focus-within .pin-dot,
	.stage.pinned .pin-dot {
		opacity: 1;
		background: rgb(26 21 16 / 0.94);
	}

	/* Floating side rail beside the card; invisible bridge padding keeps hover steady from card to tray. */
	.tray {
		position: absolute;
		top: 0;
		left: 100%;
		display: none;
		flex-direction: column;
		gap: 0.45rem;
		min-width: 10.2rem;
		max-width: 12.2rem;
		padding: 0.5rem 0.55rem;
		margin-left: 0.3rem;
		border: 1px solid rgb(231 220 198 / 0.35);
		border-radius: 0.35rem;
		background: rgb(22 18 14 / 0.96);
		color: #efe6d2;
		box-shadow: 0 0.5rem 1.4rem rgb(0 0 0 / 0.55);
	}

	.tray::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		right: 100%;
		width: 0.45rem;
	}

	.stage.left .tray {
		left: auto;
		right: 100%;
		margin-left: 0;
		margin-right: 0.3rem;
	}

	.stage.left .tray::before {
		right: auto;
		left: 100%;
	}

	.stage:hover .tray,
	.stage:focus-within .tray,
	.stage.pinned .tray {
		display: flex;
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: 0.24rem;
	}

	.group-label {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.4rem;
		color: #b7aa93;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.group-label small {
		color: #c9925a;
		font-size: 0.64rem;
		font-weight: 600;
		text-transform: none;
		letter-spacing: 0;
	}

	.btns {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.btns button {
		padding: 0.24rem 0.45rem;
		border: 1px solid rgb(231 220 198 / 0.26);
		border-radius: 0.22rem;
		background: rgb(255 248 228 / 0.05);
		color: #f3e9d4;
		font: inherit;
		font-size: 0.74rem;
		font-weight: 600;
		line-height: 1.2;
		text-align: left;
		cursor: pointer;
		transition:
			background 120ms ease,
			border-color 120ms ease;
	}

	.btns button:hover:not(:disabled) {
		border-color: rgb(231 220 198 / 0.65);
		background: rgb(255 248 228 / 0.14);
	}

	.btns button.on {
		border-color: #e2be56;
		background: rgb(226 190 86 / 0.22);
		color: #ffefc0;
	}

	.btns button.remove {
		margin-top: 0.1rem;
		border-color: rgb(217 104 92 / 0.5);
		background: rgb(184 46 32 / 0.18);
		color: #ffd3cc;
	}

	.btns button.remove:hover:not(:disabled) {
		border-color: #e87e72;
		background: rgb(184 46 32 / 0.34);
	}

	.btns button:disabled {
		opacity: 0.38;
		cursor: default;
	}

	@media (max-width: 640px) {
		.tray,
		.stage.left .tray {
			top: calc(100% + 0.3rem);
			left: 0;
			right: auto;
			margin: 0;
		}

		.tray::before,
		.stage.left .tray::before {
			top: -0.45rem;
			left: 0;
			right: 0;
			bottom: auto;
			width: auto;
			height: 0.45rem;
		}
	}
</style>
