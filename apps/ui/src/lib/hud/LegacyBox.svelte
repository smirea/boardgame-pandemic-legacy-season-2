<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { dossierView, rulebook, stickerStock } from '@repo/game';
	import type { Campaign, DossierSlot } from '@repo/game';
	import Crate from './Crate.svelte';
	import DossierDoor from './DossierDoor.svelte';

	type Props = { campaign: Campaign; onclose: () => void };

	let { campaign, onclose }: Props = $props();

	const view = $derived(dossierView(campaign));
	const book = $derived(rulebook(campaign));
	const stock = $derived(stickerStock(campaign));
	const TABS = [
		{ id: 'box', label: 'Packages and dossier' },
		{ id: 'rulebook', label: 'Rulebook' },
		{ id: 'stickers', label: 'Stickers' },
	] as const;
	let tab = $state<(typeof TABS)[number]['id']>('box');
	const STRUCTURE = { center: 'Permanent supply center', tower: 'Permanent tower', shelter: 'Permanent shelter' };
	const doors = $derived(view.sheets.flat());
	const openDoors = $derived(doors.filter(door => door.open).length);
	const openPackages = $derived(view.packages.filter(slot => slot.open).length);

	type Read = { kind: 'Package' | 'Door'; slot: DossierSlot<number | string> };
	/** What the pointer rests on, or else what was last clicked, read out in full under the sheets. */
	let pointed = $state<Read | null>(null);
	let chosen = $state<Read | null>(null);
	const reading = $derived(pointed ?? chosen);
	const describe = (kind: Read['kind'], slot: Read['slot']) =>
		`${kind} ${slot.id}: ${slot.open ? (slot.name ?? 'opened') : 'sealed'}`;
	const look = (kind: Read['kind'], slot: Read['slot']) => ({
		onpointerenter: () => (pointed = { kind, slot }),
		onpointerleave: () => (pointed = null),
		onfocus: () => (chosen = { kind, slot }),
		onclick: () => (chosen = { kind, slot }),
	});
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

	<div class="tabs" role="tablist" aria-label="What to look at">
		{#each TABS as entry (entry.id)}
			<button role="tab" aria-selected={tab === entry.id} onclick={() => (tab = entry.id)}>{entry.label}</button>
		{/each}
	</div>

	{#if tab === 'box'}
		<h3>Packages</h3>
		<ol class="packages" {@attach feedback('Packages', () => ({ open: openPackages }))}>
			{#each view.packages as slot (slot.id)}
				<li class="package" class:open={slot.open}>
					<button aria-label={describe('Package', slot)} {...look('Package', slot)}>
						<span class="crate"><Crate id={slot.id} open={slot.open} /></span>
						<span class="caption">{slot.open ? slot.name : 'Sealed'}</span>
					</button>
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
							<li>
								<button aria-label={describe('Door', door)} {...look('Door', door)}>
									<DossierDoor id={door.id} open={door.open} />
								</button>
							</li>
						{/each}
					</ol>
					<span class="count">{sheet.filter(door => door.open).length} of {sheet.length} open</span>
				</li>
			{/each}
		</ol>

		<div class="reading" aria-live="polite" {@attach feedback('Box reading', () => reading)}>
			{#if !reading}
				<p class="hint">Point at a package or a door, or click one, to read what it held.</p>
			{:else if !reading.slot.open}
				<p><b>{reading.kind} {reading.slot.id}</b> is still sealed.</p>
			{:else}
				<p>
					<b>{reading.kind} {reading.slot.id}: {reading.slot.name}</b>
					{#if reading.slot.forced}<span class="forced">forced open by a perimeter report</span>{/if}
				</p>
				{#if reading.slot.contents.length}
					<ul>
						{#each reading.slot.contents as line, index (index)}<li>{line}</li>{/each}
					</ul>
				{:else}
					<p class="hint">A reference for the board or the player aid, with no rule of its own.</p>
				{/if}
			{/if}
		</div>
	{:else if tab === 'rulebook'}
		<div class="pages" {@attach feedback('Rulebook', () => book)}>
			<section>
				<h3>Rules in force</h3>
				{#each book.rules as rule (rule.id)}<p>{rule.text}</p>{:else}<p class="hint">Only the printed rules.</p>{/each}
			</section>
			<section>
				<h3>Actions unlocked</h3>
				{#each book.actions as action (action.id)}<p>{action.text}</p>{:else}<p class="hint">None yet.</p>{/each}
				<h3>Turning points</h3>
				{#each book.turningPoints as point (point.id)}<p>{point.text}</p>{:else}<p class="hint">None waiting.</p>{/each}
			</section>
		</div>
	{:else}
		<div class="pages" {@attach feedback('Stickers', () => stock)}>
			{#snippet list(title: string, items: { id: string; name: string; text: string; left: number }[])}
				<h3>{title}</h3>
				{#each items as item (item.id)}
					<p>
						<b>{item.name}</b>{#if item.left > 1}<span class="left">×{item.left}</span>{/if}
						{item.text}
					</p>
				{:else}
					<p class="hint">None left.</p>
				{/each}
			{/snippet}
			<section>
				{@render list('Abilities', stock.abilities)}
				{@render list('City card improvements', stock.cityImprovements)}
				{@render list('Infection card improvements', stock.infectionImprovements)}
			</section>
			<section>
				{@render list('Scars', stock.scars)}
				<h3>Permanent structures</h3>
				{#each stock.permanent as [structure, left] (structure)}
					<p><b>{STRUCTURE[structure]}</b><span class="left">×{left}</span></p>
				{:else}
					<p class="hint">None left.</p>
				{/each}
				{#if stock.jobsWaiting.length}
					<h3>Characters waiting for a free card</h3>
					<p>{stock.jobsWaiting.join(', ')}</p>
				{/if}
			</section>
		</div>
	{/if}
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

	.tabs {
		display: flex;
		gap: 0.4rem;
		margin-top: 0.7rem;
	}

	.tabs button {
		width: auto;
		padding: 0.3rem 0.8rem;
		border: 1px solid rgb(60 44 28 / 0.35);
		border-radius: 2px;
	}

	.tabs button[aria-selected='true'] {
		background: var(--paper-ink);
		color: var(--paper);
	}

	.pages {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0 2rem;
		max-height: 34rem;
		overflow: auto;
		font-size: 0.9rem;
		line-height: 1.35;
	}

	.pages p {
		margin: 0 0 0.45rem;
	}

	.left {
		margin: 0 0.3rem;
		color: var(--paper-muted);
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

	button {
		display: block;
		width: 100%;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.reading {
		height: 7.5rem;
		margin-top: 0.9rem;
		padding: 0.6rem 0.8rem;
		overflow: auto;
		border-top: 1px solid var(--slip-line);
		font-size: 0.9rem;
		line-height: 1.35;
	}

	.reading p {
		margin: 0 0 0.3rem;
	}

	.reading ul {
		margin: 0;
		padding-left: 1.1rem;
	}

	.hint,
	.forced {
		color: var(--paper-muted);
	}

	.forced {
		margin-left: 0.5rem;
		font-style: italic;
	}
</style>
