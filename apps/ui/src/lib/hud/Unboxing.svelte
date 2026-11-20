<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { openings, pack } from '@repo/game';
	import type { BriefedUnlock, BriefingEntry, Campaign, Opening } from '@repo/game';
	import { onDestroy, onMount } from 'svelte';
	import BriefPiece from './BriefPiece.svelte';
	import Briefing from './Briefing.svelte';
	import Crate from './Crate.svelte';
	import DossierDoor from './DossierDoor.svelte';
	import { destination, flyTo } from './flight.ts';
	import ObjectiveTag from './ObjectiveTag.svelte';

	type Props = { briefing: BriefingEntry[]; campaign: Campaign; oncontinue: () => void };

	let { briefing, campaign, oncontinue }: Props = $props();

	/**
	 * Where each kind of unlock is put away once it is out: new actions into the Actions panel, cards into their
	 * deck, anything the map shows onto the map, and what the group keeps for later (stickers for sale, rules, jobs)
	 * into the box. Each list falls back in order to what is on screen. Objectives wait for the end, where the
	 * board's objective row lifts them off.
	 */
	const PUT_AWAY: Record<BriefedUnlock['t'], string[] | null> = {
		objectives: null,
		action: ['actions', 'box'],
		rule: ['box'],
		event: ['playerDeck', 'box'],
		ability: ['box'],
		cityImprovement: ['box'],
		infectionImprovement: ['box'],
		permanentStructure: ['box'],
		job: ['box'],
		lab: ['map'],
		region: ['map'],
		route: ['map'],
		haven: ['map'],
		frequencyHint: ['box'],
		gather: ['infectionDeck', 'box'],
		assemble: ['infectionDeck', 'box'],
		freeAbilityUnits: ['box'],
		stockpileBonus: ['map'],
	};
	const putAway = (unlock: BriefedUnlock) =>
		unlock.t === 'event' && unlock.mode === 'rationed' ? ['box'] : PUT_AWAY[unlock.t];

	const steps = $derived(openings(briefing));
	const objectives = $derived(pack.objectives.filter(objective => campaign.objectives.includes(objective.id)));
	const namesObjectives = $derived(steps.some(step => step.items.some(item => item.unlock.t === 'objectives')));
	const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	type Phase = 'enter' | 'open' | 'reveal' | 'read' | 'stow' | 'done';
	let index = $state(0);
	let phase = $state<Phase>('enter');
	let revealed = $state(0);
	let paused = $state(false);
	let reading = $state(false);
	let readLeft = $state(1);
	let stage = $state<HTMLElement>();
	let trash = $state<HTMLElement>();

	const current = $derived<Opening | undefined>(steps[index]);
	const containers = $derived.by(() => {
		const from = current?.from;
		if (!from) return [];
		const doors = 'doors' in from ? from.doors.map(id => ({ t: 'door' as const, id })) : [];
		const box = from.t === 'bundle' && from.package ? [{ t: 'package' as const, id: from.package }] : [];
		return from.t === 'legacy' ? [{ t: 'card' as const }, ...doors] : [...doors, ...box];
	});
	const shown = $derived(current?.items.filter(item => item.unlock.t !== 'objectives') ?? []);

	// The sequence is one async run; a new run (Watch again) or leaving cancels the one before it.
	let run = 0;
	let skip = false;
	const tick = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
	/** Waits `ms` of unpaused time, by the clock, cut short by Next. */
	async function hold(ms: number, token: number, progress = false) {
		let left = still ? Math.min(ms, 400) : ms;
		let last = performance.now();
		while (left > 0 && !skip && token === run) {
			await tick(50);
			const now = performance.now();
			if (!paused) left -= now - last;
			last = now;
			if (progress) readLeft = Math.max(0, left / ms);
		}
		skip = false;
	}
	const words = (text: string | null | undefined) => (text ? text.split(/\s+/).length : 0);
	const readingTime = (step: Opening) =>
		Math.max(
			2600,
			1400 + 260 * (words(step.title) + words(step.text) + step.items.reduce((n, item) => n + words(item.text), 0)),
		);

	async function play(from = 0) {
		const token = ++run;
		for (let at = from; at < steps.length && token === run; at++) {
			index = at;
			revealed = 0;
			phase = 'enter';
			await hold(450, token);
			phase = 'open';
			await hold(still ? 0 : 900, token);
			phase = 'reveal';
			for (let item = 1; item <= shown.length && token === run; item++) {
				revealed = item;
				await hold(still ? 0 : 320, token);
			}
			phase = 'read';
			reading = true;
			await hold(readingTime(steps[at]!), token, true);
			reading = false;
			if (token !== run) return;
			phase = 'stow';
			await stow();
		}
		if (token === run) phase = 'done';
	}

	/** Sends every piece out of the stage to its place, and the emptied packaging into the trash. */
	async function stow() {
		if (!stage) return;
		const flights: Promise<void>[] = [];
		const pieces = [...stage.querySelectorAll<HTMLElement>('[data-put]')];
		pieces.forEach((piece, order) => {
			const target = destination(...(piece.dataset.put ?? 'box').split(' ')) ?? trash;
			if (!target || still) return;
			flights.push(flyTo(piece, target, { delay: order * 170 }).then(() => void 0));
			setTimeout(() => (piece.style.visibility = 'hidden'), order * 170);
		});
		const shells = [...stage.querySelectorAll<HTMLElement>('[data-shell]')];
		shells.forEach((shell, order) => {
			if (!trash || still) return;
			const delay = (pieces.length + order) * 170;
			flights.push(flyTo(shell, trash, { delay, duration: 900 }));
			setTimeout(() => (shell.style.visibility = 'hidden'), delay);
		});
		await Promise.all(flights);
	}

	function next() {
		if (phase === 'done') return;
		skip = true;
	}
	function finish() {
		run++;
		phase = 'done';
	}
	function again() {
		phase = 'enter';
		void play(0);
	}

	let full = $state(false);
	onMount(() => void play(0));
	onDestroy(() => run++);
</script>

<svelte:window
	onkeydown={event => {
		if (event.key === ' ' && phase !== 'done') {
			event.preventDefault();
			next();
		}
	}}
/>

{#if full}
	<Briefing {briefing} {campaign} passive={false} {oncontinue} />
{:else}
	<div
		class="unboxing"
		data-phase={phase}
		data-step={index}
		{@attach feedback('Unboxing', () => ({ step: index, of: steps.length, phase, title: current?.title }))}
	>
		{#if phase !== 'done' && current}
			<div class="stage" bind:this={stage} role="group" aria-label={current.title}>
				{#key index}
					<div class="containers">
						{#each containers as box, order (order)}
							<span class="shell {box.t}" data-shell style:--order={order}>
								{#if box.t === 'package'}
									<Crate id={box.id} open={phase !== 'enter'} />
								{:else if box.t === 'door'}
									<DossierDoor id={box.id} open={phase !== 'enter'} tearing={phase === 'open'} />
								{:else}
									<span class="legacy" class:turned={phase !== 'enter'}><b>Legacy</b></span>
								{/if}
							</span>
						{/each}
					</div>
					<header>
						<h2>{current.title}</h2>
						{#if current.text}<p>{current.text}</p>{/if}
					</header>
					<ul class="items">
						{#each shown as item, order (order)}
							{@const put = putAway(item.unlock)}
							<li
								class="item"
								class:out={order < revealed}
								class:away={phase === 'stow'}
								{@attach feedback('Unpacked', () => item.unlock)}
							>
								<span class="token" data-put={put?.join(' ')}>
									<BriefPiece unlock={item.unlock} {campaign} size="2.4rem" />
								</span>
								<p>{item.text}</p>
							</li>
						{/each}
					</ul>
				{/key}
			</div>
		{:else}
			<div class="stage done">
				<h2>Everything is in its place</h2>
				{#if namesObjectives}
					<div class="objectives">
						{#each objectives as objective (objective.id)}
							<span class="tag" data-brief-objective={objective.id}><ObjectiveTag {objective} /></span>
						{/each}
					</div>
					<p class="note">Complete {Math.min(campaign.required, objectives.length)} of {objectives.length} to win.</p>
				{/if}
			</div>
		{/if}

		<footer>
			<span class="trash" bind:this={trash} data-dest="trash" aria-label="Trash" role="img">
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg
				>
			</span>
			<ol class="progress" aria-label="Opened this time">
				{#each steps as step, order (order)}
					<li class:now={order === index && phase !== 'done'} class:past={order < index || phase === 'done'}>
						{step.title}
					</li>
				{/each}
			</ol>
			{#if phase === 'done'}
				<button onclick={again}>Watch again</button>
				<button onclick={() => (full = true)}>Read everything</button>
				<button class="primary" onclick={oncontinue} data-testid="ack-briefing">Continue</button>
			{:else}
				{#if reading}<span class="timer" style:--left={readLeft} aria-hidden="true"></span>{/if}
				<button onclick={() => (paused = !paused)}>{paused ? 'Resume' : 'Pause'}</button>
				<button onclick={next} title="Space">Next</button>
				<button onclick={finish}>Skip</button>
			{/if}
		</footer>
	</div>
{/if}

<style>
	.unboxing {
		display: flex;
		flex-direction: column;
		width: min(64rem, 94vw);
		max-height: calc(100vh - 2rem);
		padding: 1.4rem 1.6rem 1rem;
		border-radius: 2px;
		background: var(--document);
		color: var(--paper-ink);
		box-shadow: var(--document-shadow);
	}

	.stage {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.9rem;
		min-height: 24rem;
		overflow: auto;
	}

	.containers {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		gap: 1rem;
		min-height: 6.5rem;
	}

	.shell {
		display: block;
		animation: arrive 500ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
		animation-delay: calc(var(--order) * 90ms);
	}

	.shell.package {
		width: 7rem;
		font-size: 1.15rem;
	}

	.shell.door {
		width: 3.6rem;
		font-size: 1.1rem;
	}

	@keyframes arrive {
		from {
			opacity: 0;
			transform: translateY(-1.5rem) scale(0.9);
		}
	}

	.legacy {
		display: grid;
		place-items: center;
		width: 4.4rem;
		aspect-ratio: 0.7;
		border: 1px solid rgb(60 44 28 / 0.4);
		border-radius: 4px;
		background: linear-gradient(160deg, #3d3326, #241d14);
		color: var(--paper);
		font-family: var(--font-display);
		transition: transform 700ms cubic-bezier(0.2, 0.9, 0.3, 1.1);
	}

	.legacy.turned {
		transform: rotateY(180deg) scaleX(-1);
		background: var(--slip);
		color: var(--paper-ink);
	}

	header {
		text-align: center;
	}

	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.8rem;
		font-weight: 400;
	}

	header p {
		max-width: 44rem;
		margin: 0.3rem auto 0;
	}

	.items {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
		gap: 0.7rem 1.1rem;
		width: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* Each piece rises out of the opened container, one after another. */
	.item {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		opacity: 0;
		transform: translateY(2.5rem) scale(0.85);
		transition:
			opacity 380ms ease,
			transform 520ms cubic-bezier(0.2, 0.9, 0.3, 1.25);
	}

	.item.out {
		opacity: 1;
		transform: none;
	}

	.token {
		display: flex;
		flex: none;
	}

	/* The piece flies to its place; its words stay behind and fade. */
	.item p {
		transition: opacity 500ms ease;
	}

	.item.away p {
		opacity: 0;
	}

	.item p {
		margin: 0;
		font-size: 0.92rem;
		line-height: 1.35;
	}

	.done {
		justify-content: center;
	}

	.objectives {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.6rem;
	}

	.note {
		margin: 0;
		color: var(--paper-muted);
	}

	footer {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 1rem;
		padding-top: 0.8rem;
		border-top: 1px solid var(--slip-line);
	}

	.progress {
		display: flex;
		flex: 1;
		flex-wrap: wrap;
		gap: 0.3rem 0.8rem;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.8rem;
		color: var(--paper-muted);
	}

	.progress .past {
		text-decoration: line-through;
	}

	.progress .now {
		color: var(--paper-ink);
		font-weight: 700;
	}

	.timer {
		width: 4rem;
		height: 3px;
		background: linear-gradient(90deg, var(--paper-ink) calc(var(--left) * 100%), var(--slip-line) 0);
	}

	footer button {
		padding: 0.35rem 0.9rem;
		border: 1px solid rgb(60 44 28 / 0.4);
		border-radius: 2px;
		background: transparent;
		color: var(--paper-ink);
		font: inherit;
		cursor: pointer;
	}

	footer .primary {
		background: var(--paper-ink);
		color: var(--paper);
		font-weight: 700;
	}

	.trash {
		flex: none;
		display: grid;
		place-items: center;
		width: 2.4rem;
		height: 2.4rem;
		border-radius: 50%;
		background: rgb(28 25 21 / 0.85);
		color: var(--muted);
	}

	.trash svg {
		width: 1.5rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
