<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { dossierView } from '@repo/game';
	import type { Campaign } from '@repo/game';
	import Crate from './Crate.svelte';
	import DossierDoor from './DossierDoor.svelte';

	type Props = { campaign: Campaign; onclose: () => void };

	let { campaign, onclose }: Props = $props();

	const view = $derived(dossierView(campaign));
	const doors = $derived(view.sheets.flat());
	const openDoors = $derived(doors.filter(door => door.open).length);
	const openPackages = $derived(view.packages.filter(slot => slot.open).length);

	/** What the pointer rests on, read out under the sheets. */
	let pointed = $state<string | null>(null);
	const describe = (kind: 'Package' | 'Door', slot: { id: string | number; open: boolean; opened: string | null }) =>
		`${kind} ${slot.id}: ${slot.open ? (slot.opened ?? 'opened') : 'sealed'}`;
</script>

<svelte:window onkeydown={event => event.key === 'Escape' && onclose()} />

<section
	class="box"
	aria-label="The box"
	{@attach feedback('The box', () => ({ openPackages, openDoors, doors: doors.length }))}
>
	<header>
		<h2>The box</h2>
		<p class="tally">
			{openPackages} of {view.packages.length} packages opened, {openDoors} of {doors.length} dossier doors torn open
		</p>
		<button class="close" onclick={onclose} aria-label="Close the box">×</button>
	</header>

	<h3>Packages</h3>
	<ol class="packages" {@attach feedback('Packages', () => ({ open: openPackages }))}>
		{#each view.packages as slot (slot.id)}
			<li
				class="package"
				class:open={slot.open}
				aria-label={describe('Package', slot)}
				onpointerenter={() => (pointed = describe('Package', slot))}
				onpointerleave={() => (pointed = null)}
			>
				<span class="crate"><Crate id={slot.id} open={slot.open} /></span>
				<span class="caption">{slot.open ? (slot.opened ?? 'Opened') : 'Sealed'}</span>
			</li>
		{/each}
	</ol>

	<h3>Dossier</h3>
	<ol class="sheets">
		{#each view.sheets as sheet, index (index)}
			<li
				class="sheet"
				{@attach feedback(`Dossier sheet ${index + 1}`, () => ({
					open: sheet.filter(door => door.open).map(door => door.id),
				}))}
			>
				<span class="tab">Sheet {index + 1}</span>
				<ol class="doors" aria-label={`Sheet ${index + 1}`}>
					{#each sheet as door (door.id)}
						<li
							aria-label={describe('Door', door)}
							onpointerenter={() => (pointed = describe('Door', door))}
							onpointerleave={() => (pointed = null)}
						>
							<DossierDoor id={door.id} open={door.open} />
						</li>
					{/each}
				</ol>
				<span class="count">{sheet.filter(door => door.open).length} of {sheet.length} open</span>
			</li>
		{/each}
	</ol>

	<p class="pointed" aria-live="polite">
		{pointed ?? 'Rest the pointer on a package or a door to see what it opened.'}
	</p>
</section>

<style>
	.box {
		display: flex;
		flex-direction: column;
		width: min(68rem, 96vw);
		max-height: calc(100vh - 2rem);
		padding: 1.2rem 1.6rem 1rem;
		overflow: auto;
		border-radius: 2px;
		background: var(--document);
		color: var(--paper-ink);
		box-shadow: var(--document-shadow);
	}

	header {
		display: flex;
		align-items: baseline;
		gap: 1.2rem;
	}

	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.9rem;
		font-weight: 400;
	}

	h3 {
		margin: 1rem 0 0.5rem;
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-weight: 400;
		color: var(--paper-muted);
	}

	.tally {
		margin: 0;
		color: var(--paper-muted);
	}

	.close {
		margin-left: auto;
		width: 2rem;
		height: 2rem;
		border: 1px solid rgb(60 44 28 / 0.35);
		border-radius: 50%;
		background: transparent;
		color: var(--paper-ink);
		font-size: 1.2rem;
		line-height: 1;
		cursor: pointer;
	}

	ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.packages {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 0.8rem;
	}

	.package {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.45rem;
		min-width: 0;
	}

	.crate {
		width: 100%;
		max-width: 6.5rem;
		font-size: 1rem;
	}

	.caption {
		max-width: 100%;
		font-size: 0.82rem;
		line-height: 1.15;
		text-align: center;
		color: var(--paper-muted);
	}

	.open .caption {
		color: var(--paper-ink);
	}

	.sheets {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 0.8rem;
	}

	/* A manila dossier sheet with a filing tab. */
	.sheet {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.9rem 0.6rem 0.6rem;
		border: 1px solid rgb(110 80 30 / 0.35);
		border-radius: 0 3px 3px 3px;
		background: linear-gradient(180deg, #e2c98f, #d6ba7c);
		box-shadow: 0 0.3rem 0.7rem rgb(40 24 8 / 0.25);
	}

	.tab {
		position: absolute;
		top: -1.15rem;
		left: -1px;
		padding: 0.1rem 0.6rem;
		border: 1px solid rgb(110 80 30 / 0.35);
		border-bottom: none;
		border-radius: 4px 4px 0 0;
		background: #e2c98f;
		font-size: 0.78rem;
		color: rgb(60 40 10 / 0.8);
	}

	.doors {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.3rem;
		font-size: 0.85rem;
	}

	.count {
		font-size: 0.78rem;
		color: rgb(60 40 10 / 0.7);
	}

	.pointed {
		min-height: 1.3rem;
		margin: 0.9rem 0 0;
		color: var(--paper-muted);
	}
</style>
