<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { dossierView } from '@repo/game';
	import type { Campaign } from '@repo/game';

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
				<span class="crate" aria-hidden="true">
					<span class="lid"></span>
					<span class="front"><b>{slot.id}</b></span>
					{#if !slot.open}<span class="tape"></span>{/if}
				</span>
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
							class="door"
							class:open={door.open}
							aria-label={describe('Door', door)}
							onpointerenter={() => (pointed = describe('Door', door))}
							onpointerleave={() => (pointed = null)}
						>
							{door.id}
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

	/* A cardboard package, front face and lid. Sealed ones are taped shut; an opened one has its lid lifted. */
	.crate {
		position: relative;
		width: 100%;
		max-width: 6.5rem;
		aspect-ratio: 1.25;
		margin-top: 0.9rem;
	}

	.front,
	.lid {
		position: absolute;
		left: 0;
		right: 0;
		border: 1px solid rgb(70 46 20 / 0.55);
		background:
			repeating-linear-gradient(90deg, rgb(255 255 255 / 0.04) 0 3px, transparent 3px 7px),
			linear-gradient(180deg, #b48a57, #9a7243);
	}

	.front {
		top: 22%;
		bottom: 0;
		display: grid;
		place-items: center;
		border-radius: 0 0 3px 3px;
		box-shadow: 0 0.4rem 0.8rem rgb(40 24 8 / 0.3);
	}

	.front b {
		font-family: var(--font-display);
		font-size: 2.2rem;
		font-weight: 400;
		color: rgb(40 24 8 / 0.75);
	}

	.lid {
		top: 6%;
		height: 22%;
		z-index: 1;
		border-radius: 3px 3px 0 0;
		background: linear-gradient(180deg, #c49b66, #a77d4b);
		transform-origin: 0 100%;
		transition: transform 400ms cubic-bezier(0.2, 0.9, 0.3, 1.1);
	}

	.open .lid {
		transform: translateY(-38%) rotate(-11deg);
	}

	/* The inside shows once the lid is off. */
	.open .front {
		background:
			linear-gradient(180deg, rgb(30 18 6 / 0.65), transparent 38%), linear-gradient(180deg, #b48a57, #9a7243);
	}

	.tape {
		position: absolute;
		top: 2%;
		bottom: 8%;
		left: 50%;
		z-index: 2;
		width: 22%;
		translate: -50% 0;
		background: rgb(236 228 206 / 0.82);
		box-shadow: 0 0 0 1px rgb(60 44 28 / 0.12);
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
	}

	/* Sealed: a perforated door with its number. Open: torn out, the hole behind it shows. */
	.door {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		border: 1.5px dashed rgb(90 60 20 / 0.5);
		border-radius: 2px;
		background: #ecd9a8;
		font-weight: 700;
		font-size: 0.85rem;
		color: rgb(60 40 10 / 0.85);
	}

	.door.open {
		border: 1px solid rgb(40 24 8 / 0.5);
		background: radial-gradient(ellipse at 50% 30%, #4a3a26, #2b2014);
		box-shadow: inset 0 0.2rem 0.4rem rgb(0 0 0 / 0.55);
		color: rgb(236 222 190 / 0.75);
		font-weight: 500;
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
