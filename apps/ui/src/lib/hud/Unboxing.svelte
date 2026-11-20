<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { openings, pack, tablePlayers } from '@repo/game';
	import type { BriefedUnlock, BriefingEntry, Campaign, Command, Opening, PlayerId, Table } from '@repo/game';
	import { onDestroy, onMount, tick } from 'svelte';
	import { fade, fly, scale } from 'svelte/transition';
	import { legacyScans } from '#lib/scans.generated.ts';
	import { scan, scanUrl, sealScans, sourceScans } from '#lib/scans.svelte.ts';
	import BriefPiece from './BriefPiece.svelte';
	import Briefing from './Briefing.svelte';
	import Crate from './Crate.svelte';
	import DossierDoor from './DossierDoor.svelte';
	import { destination, flyTo } from './flight.ts';
	import ObjectiveTag from './ObjectiveTag.svelte';
	import { keep } from './viewState.ts';

	type Props = {
		briefing: BriefingEntry[];
		campaign: Campaign;
		table: Table;
		player: PlayerId;
		solo: boolean;
		send: (command: Command) => void;
		ondeckout?: (out: boolean) => void;
	};

	let { briefing, campaign, table, player, solo, send, ondeckout }: Props = $props();

	type StowClass = 'trash' | 'infectionDeck' | 'playerDeck' | 'map' | 'box' | 'mechanic';
	const STOW_ORDER: StowClass[] = ['trash', 'infectionDeck', 'playerDeck', 'map', 'box', 'mechanic'];

	function stowInfo(unlock: BriefedUnlock): { cls: StowClass; dest: string[] } | null {
		switch (unlock.t) {
			case 'objectives':
				return null;
			case 'gather':
			case 'assemble':
				return { cls: 'infectionDeck', dest: ['infectionDeck', 'box'] };
			case 'event':
				if (unlock.now?.[0] === 'hand') return { cls: 'playerDeck', dest: ['hand', 'playerDeck', 'box'] };
				if (unlock.mode === 'rationed') return { cls: 'box', dest: ['box'] };
				return { cls: 'playerDeck', dest: ['playerDeck', 'box'] };
			case 'lab':
			case 'region':
			case 'route':
			case 'haven':
			case 'stockpileBonus':
				return { cls: 'map', dest: ['map'] };
			case 'action':
			case 'actions':
				return { cls: 'mechanic', dest: ['actions', 'box'] };
			case 'rule':
				return { cls: 'mechanic', dest: ['box'] };
			default:
				return { cls: 'box', dest: ['box'] };
		}
	}

	const steps = $derived(openings(briefing));
	const progress = $derived(table.briefing);
	const hasLegacy = $derived(steps.some(step => step.from.t === 'legacy'));
	const drawn = $derived(Math.min(progress.drawn, steps.length));
	const flipped = $derived(progress.flipped);
	const remaining = $derived(Math.max(0, steps.length - drawn));
	const canDraw = $derived(!progress.stowing && remaining > 0 && (drawn === 0 || flipped));
	const needsFlip = $derived(!progress.stowing && drawn > 0 && !flipped);
	const allDrawn = $derived(steps.length > 0 && drawn >= steps.length && flipped);

	const current = $derived<Opening | null>(drawn > 0 ? (steps[drawn - 1] ?? null) : null);
	const settled = $derived(drawn > 1 ? steps.slice(0, drawn - 1).map((step, index) => ({ step, index })) : []);
	const leftWing = $derived(settled.filter((_, idx) => idx % 2 === 0));
	const rightWing = $derived(settled.filter((_, idx) => idx % 2 === 1));

	const objectives = $derived(pack.objectives.filter(objective => campaign.objectives.includes(objective.id)));
	const objectiveSteps = $derived(
		new Set(steps.flatMap((step, index) => (step.items.some(item => item.unlock.t === 'objectives') ? [index] : []))),
	);
	const showObjectives = $derived([...objectiveSteps].some(idx => idx < drawn - 1 || (idx === drawn - 1 && flipped)));

	// The back image shown on top of the Legacy deck pile on the table.
	const deckBack = $derived.by(() => {
		const nextStep = steps[drawn];
		if (nextStep?.from.t === 'legacy' && legacyScans[nextStep.from.card]?.back) {
			return scanUrl(legacyScans[nextStep.from.card]!.back!);
		}
		const nextCard = pack.legacyDeck[campaign.legacyIndex];
		return nextCard && legacyScans[nextCard.id]?.back ? scanUrl(legacyScans[nextCard.id]!.back!) : null;
	});
	const deckCount = $derived(remaining > 0 ? remaining : pack.legacyDeck.length - campaign.legacyIndex);

	const cardImages = (step: Opening) => {
		if (step.from.t === 'legacy' && legacyScans[step.from.card]) {
			const entry = legacyScans[step.from.card]!;
			return { back: entry.back ? scanUrl(entry.back) : null, face: scanUrl(entry.src) };
		}
		if (step.from.t === 'turningPoint' && legacyScans['02-06']) {
			const entry = legacyScans['02-06']!;
			return { back: entry.back ? scanUrl(entry.back) : null, face: scanUrl(entry.src) };
		}
		return null;
	};

	const players = $derived(tablePlayers(table));
	const multi = $derived(!solo && players.length > 1);
	const myReady = $derived(progress.ready.includes(player));
	const nameOf = (who: PlayerId) => table.seats.find(entry => entry.player === who)?.name ?? 'Player';
	const waitingOn = $derived(players.filter(who => !progress.ready.includes(who)).map(nameOf));

	const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, still ? Math.min(ms, 80) : ms));

	let root = $state<HTMLElement>();
	let deckEl = $state<HTMLElement>();
	let trashEl = $state<HTMLElement>();
	let deckReturned = $state(false);
	let stowStarted = false;
	let full = $state(false);
	let destroyed = false;

	keep(
		'unboxing',
		() => ({ full }),
		saved => {
			full = saved.full;
		},
	);

	function step() {
		if (progress.stowing || allDrawn) return;
		send({ type: 'BRIEFING_STEP' });
	}

	function toggleReady() {
		if (!allDrawn || progress.stowing) return;
		send({ type: 'BRIEFING_READY', player, ready: !myReady });
	}

	onMount(async () => {
		if (!hasLegacy) return;
		ondeckout?.(true);
		await tick();
		const source = destination('legacyDeck');
		if (!source || !deckEl || still) return;
		const from = source.getBoundingClientRect();
		const to = deckEl.getBoundingClientRect();
		if (!from.width || !to.width) return;
		const dx = from.left + from.width / 2 - (to.left + to.width / 2);
		const dy = from.top + from.height / 2 - (to.top + to.height / 2);
		const sx = from.width / to.width;
		const sy = from.height / to.height;
		deckEl.animate(
			[
				{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.9 },
				{ transform: 'translate(0, 0) scale(1, 1)', opacity: 1 },
			],
			{ duration: 680, easing: 'cubic-bezier(0.2, 0.9, 0.25, 1.06)', fill: 'both' },
		);
	});

	onDestroy(() => {
		destroyed = true;
		ondeckout?.(false);
	});

	$effect(() => {
		if (progress.stowing && !stowStarted) {
			stowStarted = true;
			void runStow();
		}
	});

	async function runStow() {
		await tick();
		if (destroyed) return;

		// 1. Return the Legacy deck to its slot in the top bar first.
		if (hasLegacy && deckEl && !deckReturned) {
			const target = destination('legacyDeck');
			if (target && !still) {
				const from = deckEl.getBoundingClientRect();
				const to = target.getBoundingClientRect();
				const dx = to.left + to.width / 2 - (from.left + from.width / 2);
				const dy = to.top + to.height / 2 - (from.top + from.height / 2);
				const sx = to.width / Math.max(1, from.width);
				const sy = to.height / Math.max(1, from.height);
				const anim = deckEl.animate(
					[
						{ transform: 'translate(0, 0) scale(1, 1)', opacity: 1 },
						{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.95 },
					],
					{ duration: 680, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' },
				);
				await anim.finished.catch(() => {});
			}
			if (destroyed) return;
			deckReturned = true;
			ondeckout?.(false);
			const slot = destination('legacyDeck');
			if (slot && !still) {
				slot.animate([{ scale: '1' }, { scale: '1.16' }, { scale: '1' }], {
					duration: 360,
					easing: 'cubic-bezier(0.3, 1.6, 0.5, 1)',
				});
			}
			await wait(240);
		}

		// 2. Stow each class of items one at a time, giving new mechanics extra emphasis and time.
		if (root) {
			for (const cls of STOW_ORDER) {
				if (destroyed) return;
				const nodes = [...root.querySelectorAll<HTMLElement>(`[data-stow-class="${cls}"]`)].filter(
					node => getComputedStyle(node).visibility !== 'hidden',
				);
				if (!nodes.length) continue;

				const isMechanic = cls === 'mechanic';
				if (isMechanic && !still) {
					await Promise.all(
						nodes.map(node => {
							const pulse = node.animate(
								[
									{ transform: 'scale(1)', filter: 'drop-shadow(0 0 0 rgb(227 178 60 / 0))' },
									{
										transform: 'scale(1.18)',
										filter: 'drop-shadow(0 0 1.4rem rgb(227 178 60 / 0.95))',
										offset: 0.55,
									},
									{ transform: 'scale(1.1)', filter: 'drop-shadow(0 0 0.8rem rgb(227 178 60 / 0.7))' },
								],
								{ duration: 620, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.1)', fill: 'forwards' },
							);
							return pulse.finished.catch(() => {});
						}),
					);
					await wait(240);
				}

				const stagger = isMechanic ? 240 : 90;
				const duration = isMechanic ? 1550 : 880;
				const flights: Promise<void>[] = [];
				nodes.forEach((node, order) => {
					const destNames = (node.dataset.put ?? (cls === 'trash' ? 'trash' : 'box')).split(' ').filter(Boolean);
					const target = cls === 'trash' ? (trashEl ?? destination('trash')) : (destination(...destNames) ?? trashEl);
					if (!target || still) {
						node.style.visibility = 'hidden';
						return;
					}
					const delay = order * stagger;
					flights.push(flyTo(node, target, { delay, duration }));
					setTimeout(() => {
						if (!destroyed) node.style.visibility = 'hidden';
					}, delay);
				});
				await Promise.all(flights);
				await wait(isMechanic ? 320 : 200);
			}
		}

		if (!destroyed) send({ type: 'ACK_BRIEFING' });
	}
</script>

<svelte:window
	onkeydown={event => {
		if (full) return;
		if (event.key === ' ' && !progress.stowing) {
			event.preventDefault();
			if (allDrawn) toggleReady();
			else step();
		}
	}}
/>

{#if full}
	<div class="summary-wrap">
		<Briefing {briefing} {campaign} passive={false} oncontinue={() => (full = false)} />
	</div>
{:else}
	<div
		class="tabletop-unboxing"
		class:stowing={progress.stowing}
		bind:this={root}
		data-drawn={drawn}
		data-total={steps.length}
		data-flipped={flipped}
		{@attach feedback('Legacy tabletop', () => ({
			drawn,
			of: steps.length,
			flipped,
			stowing: progress.stowing,
			ready: progress.ready,
		}))}
	>
		<!-- Top-middle Legacy deck (or package/door pile when no Legacy card is in this briefing) -->
		<div class="top-dock">
			{#if hasLegacy && !deckReturned}
				<button
					class="deck-pile"
					class:pulsing={canDraw}
					class:idle={!canDraw}
					bind:this={deckEl}
					disabled={!canDraw && !needsFlip}
					onclick={step}
					data-testid="legacy-draw-deck"
					aria-label={canDraw
						? `Draw from the Legacy deck (${remaining} left)`
						: needsFlip
							? 'Flip the drawn card'
							: 'Legacy deck'}
				>
					<span class="stack">
						{#if deckBack}
							<img src={deckBack} alt="Legacy deck" />
						{:else}
							<span class="fallback-card">Legacy</span>
						{/if}
					</span>
					<span class="badge">
						{#if canDraw}
							Draw · {remaining} left
						{:else if needsFlip}
							Flip card
						{:else}
							{deckCount} in deck
						{/if}
					</span>
				</button>
			{:else if !hasLegacy && canDraw && !progress.stowing}
				{@const next = steps[drawn]}
				<button
					class="seal-trigger pulsing"
					onclick={step}
					data-testid="legacy-draw-deck"
					aria-label={`Open ${next?.title ?? 'package'}`}
				>
					<span class="seal-icon">
						{#if next?.seals[0]?.t === 'package'}
							<Crate id={next.seals[0].id} open={false} />
						{:else if next?.seals[0]?.t === 'door'}
							<DossierDoor id={next.seals[0].id} open={false} />
						{/if}
					</span>
					<span class="badge">Click to open · {next?.title}</span>
				</button>
			{/if}
		</div>

		<!-- Main tabletop spread over the map -->
		<div class="spread">
			<!-- Left wing of previously drawn & opened items -->
			<div class="wing left">
				{#each leftWing as { step: item, index } (index)}
					{@const imgs = cardImages(item)}
					{@const pieces = item.items.filter(entry => entry.unlock.t !== 'objectives')}
					<div class="scattered" style:--tilt={`${(index % 3) * 2 - 2}deg`} in:fly={{ x: 60, y: -20, duration: 420 }}>
						<div class="scattered-head">
							{#if imgs}
								<span
									class="mini-card"
									data-stow-class="trash"
									data-put="trash"
									{@attach scan(() => sourceScans(item.from), `unbox:settled:${index}`)}
								>
									<img src={imgs.face} alt={item.title} />
								</span>
							{/if}
							{#each item.seals as seal, sIdx (`${seal.t}:${seal.id}:${sIdx}`)}
								<span
									class="mini-shell {seal.t}"
									data-stow-class="trash"
									data-put="trash"
									{@attach scan(() => sealScans(seal), `unbox:settled-seal:${index}:${sIdx}`)}
								>
									{#if seal.t === 'package'}
										<Crate id={seal.id} open={true} />
									{:else}
										<DossierDoor id={seal.id} open={true} />
									{/if}
								</span>
							{/each}
						</div>
						{#if pieces.length}
							<div class="scattered-pieces">
								{#each pieces as entry, pIdx (pIdx)}
									{@const stow = stowInfo(entry.unlock)}
									<div
										class="piece-chip"
										class:mechanic={stow?.cls === 'mechanic'}
										data-stow-class={stow?.cls}
										data-put={stow?.dest.join(' ')}
										title={entry.text}
									>
										<BriefPiece unlock={entry.unlock} {campaign} size="2.2rem" />
										<span class="chip-label">{entry.text}</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>

			<!-- Center spotlight: the active card / package / door -->
			<div class="center">
				{#if current}
					{#key drawn}
						{@const imgs = cardImages(current)}
						{@const pieces = current.items.filter(entry => entry.unlock.t !== 'objectives')}
						<div class="spotlight" in:fly={{ y: -90, duration: 460 }}>
							<div class="spotlight-top">
								{#if imgs}
									<button
										class="flip-card"
										class:flipped
										class:clickable={needsFlip}
										onclick={() => needsFlip && step()}
										data-testid="legacy-active-card"
										data-stow-class={flipped ? 'trash' : undefined}
										data-put="trash"
										aria-label={needsFlip ? `Flip ${current.title}` : current.title}
										{@attach scan(() => (flipped ? sourceScans(current.from) : []), `unbox:active:${drawn}`)}
									>
										<span class="flipper" class:flipped={flipped || !imgs.back}>
											{#if imgs.back}
												<span class="card-side front">
													<img class="card-img back" src={imgs.back} alt="Back of Legacy card" />
												</span>
											{/if}
											<span class="card-side back-face">
												<img class="card-img face" src={imgs.face} alt={current.title} />
											</span>
										</span>
										{#if needsFlip && imgs.back}
											<span class="flip-hint">Click to flip</span>
										{/if}
									</button>
								{:else if current.seals.length}
									<button
										class="seal-spotlight"
										class:clickable={needsFlip}
										onclick={() => needsFlip && step()}
										data-testid="legacy-active-card"
										aria-label={needsFlip ? `Open ${current.title}` : current.title}
									>
										{#each current.seals as seal, sIdx (`${seal.t}:${seal.id}:${sIdx}`)}
											<span
												class="big-shell {seal.t}"
												data-stow-class={flipped ? 'trash' : undefined}
												data-put="trash"
												{@attach scan(() => (flipped ? sealScans(seal) : []), `unbox:seal:${drawn}:${sIdx}`)}
											>
												{#if seal.t === 'package'}
													<Crate id={seal.id} open={flipped} />
												{:else}
													<DossierDoor id={seal.id} open={flipped} tearing={flipped} />
												{/if}
											</span>
										{/each}
										{#if needsFlip}<span class="flip-hint">Click to open</span>{/if}
									</button>
								{:else}
									<button
										class="note-spotlight"
										class:clickable={needsFlip}
										onclick={() => needsFlip && step()}
										data-testid="legacy-active-card"
										data-stow-class={flipped ? 'trash' : undefined}
										data-put="trash"
										aria-label={needsFlip ? `Reveal ${current.title}` : current.title}
									>
										<strong>{current.title}</strong>
										{#if flipped && current.text}<span>{current.text}</span>{/if}
										{#if needsFlip}<span class="flip-hint">Click to reveal</span>{/if}
									</button>
								{/if}

								{#if flipped && imgs && current.seals.length}
									<div class="opened-seals" in:scale={{ start: 0.8, duration: 380 }}>
										{#each current.seals as seal, sIdx (`${seal.t}:${seal.id}:${sIdx}`)}
											<span
												class="med-shell {seal.t}"
												data-stow-class="trash"
												data-put="trash"
												{@attach scan(() => sealScans(seal), `unbox:card-seal:${drawn}:${sIdx}`)}
											>
												{#if seal.t === 'package'}
													<Crate id={seal.id} open={true} />
												{:else}
													<DossierDoor id={seal.id} open={true} tearing={true} />
												{/if}
											</span>
										{/each}
									</div>
								{/if}
							</div>

							{#if flipped}
								<div class="caption-plate" in:fade={{ duration: 240 }}>
									<h2>{current.title}</h2>
									{#if current.text && !imgs}<p>{current.text}</p>{/if}
								</div>

								{#if pieces.length}
									<ul class="spotlight-pieces">
										{#each pieces as entry, pIdx (pIdx)}
											{@const stow = stowInfo(entry.unlock)}
											<li
												class="big-piece"
												class:mechanic={stow?.cls === 'mechanic'}
												in:fly={{ y: 28, duration: 380, delay: pIdx * 90 }}
											>
												<span class="piece-token" data-stow-class={stow?.cls} data-put={stow?.dest.join(' ')}>
													<BriefPiece unlock={entry.unlock} {campaign} size="2.8rem" />
												</span>
												<p>{entry.text}</p>
											</li>
										{/each}
									</ul>
								{/if}
							{/if}
						</div>
					{/key}
				{/if}

				{#if showObjectives && objectives.length}
					<div class="table-objectives" in:fly={{ y: 20, duration: 360 }}>
						{#each objectives as objective (objective.id)}
							<span class="obj-tag" data-brief-objective={objective.id}><ObjectiveTag {objective} /></span>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Right wing of previously drawn & opened items -->
			<div class="wing right">
				{#each rightWing as { step: item, index } (index)}
					{@const imgs = cardImages(item)}
					{@const pieces = item.items.filter(entry => entry.unlock.t !== 'objectives')}
					<div
						class="scattered"
						style:--tilt={`${((index + 1) % 3) * 2 - 2}deg`}
						in:fly={{ x: -60, y: -20, duration: 420 }}
					>
						<div class="scattered-head">
							{#if imgs}
								<span
									class="mini-card"
									data-stow-class="trash"
									data-put="trash"
									{@attach scan(() => sourceScans(item.from), `unbox:settled:${index}`)}
								>
									<img src={imgs.face} alt={item.title} />
								</span>
							{/if}
							{#each item.seals as seal, sIdx (`${seal.t}:${seal.id}:${sIdx}`)}
								<span
									class="mini-shell {seal.t}"
									data-stow-class="trash"
									data-put="trash"
									{@attach scan(() => sealScans(seal), `unbox:settled-seal:${index}:${sIdx}`)}
								>
									{#if seal.t === 'package'}
										<Crate id={seal.id} open={true} />
									{:else}
										<DossierDoor id={seal.id} open={true} />
									{/if}
								</span>
							{/each}
						</div>
						{#if pieces.length}
							<div class="scattered-pieces">
								{#each pieces as entry, pIdx (pIdx)}
									{@const stow = stowInfo(entry.unlock)}
									<div
										class="piece-chip"
										class:mechanic={stow?.cls === 'mechanic'}
										data-stow-class={stow?.cls}
										data-put={stow?.dest.join(' ')}
										title={entry.text}
									>
										<BriefPiece unlock={entry.unlock} {campaign} size="2.2rem" />
										<span class="chip-label">{entry.text}</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<!-- Bottom action bar: Trash receptacle + Done button with multiplayer agreement -->
		<footer class="bottom-bar">
			<span
				class="trash"
				class:active={progress.stowing}
				bind:this={trashEl}
				data-dest="trash"
				aria-label="Trash"
				role="img"
			>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
				</svg>
			</span>

			<div class="controls">
				{#if allDrawn && !progress.stowing}
					<button class="done-btn" class:voted={myReady} onclick={toggleReady} data-testid="ack-briefing">
						{#if multi}
							{myReady ? 'Ready ✓' : 'Done'} ({progress.ready.length}/{players.length})
						{:else}
							Done
						{/if}
					</button>
					{#if multi && waitingOn.length}
						<span class="waiting">Waiting for {waitingOn.join(', ')}</span>
					{/if}
				{:else if !progress.stowing}
					<span class="prompt">
						{#if canDraw}
							Click the Legacy deck to draw ({remaining} remaining)
						{:else if needsFlip}
							Click the card to flip it over
						{/if}
					</span>
				{/if}
			</div>

			{#if !progress.stowing && allDrawn}
				<button class="summary-btn" onclick={() => (full = true)}>Read summary</button>
			{/if}
		</footer>
	</div>
{/if}

<style>
	.summary-wrap {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
	}

	.tabletop-unboxing {
		position: relative;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		width: 100%;
		height: 100%;
		padding: 0.6rem 1.2rem 1rem;
		color: var(--ink);
		pointer-events: auto;
	}

	.top-dock {
		display: flex;
		justify-content: center;
		align-items: flex-start;
		min-height: 7.4rem;
		z-index: 4;
	}

	.deck-pile,
	.seal-trigger {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem;
		border: 0;
		border-radius: 8px;
		background: none;
		color: var(--ink);
		font: inherit;
		cursor: pointer;
		transition: transform 220ms ease;
	}

	.deck-pile:disabled {
		cursor: default;
	}

	.deck-pile.pulsing,
	.seal-trigger.pulsing {
		animation: deckPulse 1.7s ease-in-out infinite;
	}

	.deck-pile.pulsing:hover,
	.seal-trigger.pulsing:hover {
		transform: scale(1.06);
	}

	@keyframes deckPulse {
		0%,
		100% {
			transform: scale(1);
			filter: drop-shadow(0 0.4rem 1.1rem rgb(227 178 60 / 0.35));
		}
		50% {
			transform: scale(1.06);
			filter: drop-shadow(0 0.6rem 1.8rem rgb(227 178 60 / 0.85));
		}
	}

	.stack {
		display: block;
		border-radius: 6px;
		box-shadow:
			3px 3px 0 #c9bc9c,
			6px 6px 0 #8f8266,
			0 0.9rem 2rem rgb(0 0 0 / 0.65);
	}

	.stack img {
		display: block;
		height: 6.4rem;
		width: auto;
		border-radius: 5px;
	}

	.fallback-card {
		display: grid;
		place-items: center;
		width: 4.6rem;
		height: 6.4rem;
		border-radius: 5px;
		background: linear-gradient(160deg, #3d3326, #241d14);
		font-family: var(--font-display);
	}

	.seal-icon {
		width: 6.5rem;
	}

	.badge {
		padding: 0.2rem 0.7rem;
		border-radius: 999px;
		background: rgb(16 13 10 / 0.86);
		border: 1px solid rgb(227 178 60 / 0.55);
		color: var(--paper);
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}

	.deck-pile.idle .badge {
		border-color: var(--line);
		color: var(--muted);
	}

	.spread {
		display: grid;
		grid-template-columns: minmax(14rem, 1fr) minmax(24rem, auto) minmax(14rem, 1fr);
		align-items: center;
		gap: 1.2rem;
		min-height: 0;
		overflow: hidden;
	}

	.wing {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		max-height: 100%;
		overflow: auto;
		padding: 0.4rem;
	}

	.wing.left {
		align-items: flex-end;
	}

	.wing.right {
		align-items: flex-start;
	}

	.scattered {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		max-width: 22rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid rgb(231 220 198 / 0.2);
		border-radius: 6px;
		background: rgb(18 15 11 / 0.78);
		backdrop-filter: blur(6px);
		box-shadow: 0 0.7rem 1.8rem rgb(0 0 0 / 0.45);
		transform: rotate(var(--tilt, 0deg));
	}

	.scattered-head {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex-wrap: wrap;
	}

	.mini-card img {
		display: block;
		max-height: 7.5rem;
		max-width: 10.5rem;
		width: auto;
		height: auto;
		border-radius: 4px;
		box-shadow: 0 0.35rem 0.9rem rgb(0 0 0 / 0.5);
	}

	.mini-shell.package {
		width: 4.2rem;
	}

	.mini-shell.door {
		width: 2.6rem;
	}

	.scattered-pieces {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.piece-chip {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.3rem 0.45rem;
		border-radius: 4px;
		background: rgb(231 220 198 / 0.1);
		color: var(--ink);
		font-size: 0.78rem;
		line-height: 1.25;
	}

	.piece-chip.mechanic {
		border: 1px solid rgb(227 178 60 / 0.5);
		background: rgb(227 178 60 / 0.14);
	}

	.chip-label {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.center {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.85rem;
		min-height: 0;
		max-height: 100%;
		overflow: auto;
		padding: 0.4rem;
	}

	.spotlight {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		max-width: min(44rem, 56vw);
	}

	.spotlight-top {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.2rem;
	}

	.flip-card,
	.seal-spotlight {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 0;
		border: 0;
		background: none;
		color: var(--ink);
		font: inherit;
		cursor: default;
		perspective: 1200px;
	}

	.flip-card.clickable,
	.seal-spotlight.clickable,
	.note-spotlight.clickable {
		cursor: pointer;
	}

	.note-spotlight {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		max-width: 24rem;
		padding: 1.2rem 1.6rem;
		border: 1px solid rgb(231 220 198 / 0.35);
		border-radius: 6px;
		background: rgb(22 18 14 / 0.9);
		color: var(--paper);
		font: inherit;
		box-shadow: 0 1.2rem 2.8rem rgb(0 0 0 / 0.6);
	}

	.note-spotlight strong {
		font-family: var(--font-display);
		font-size: 1.6rem;
		font-weight: 400;
	}

	.flip-card.clickable:hover .flipper,
	.seal-spotlight.clickable:hover {
		transform: translateY(-4px) scale(1.02);
	}

	.flipper {
		display: grid;
		place-items: center;
		transform-style: preserve-3d;
		transition: transform 640ms cubic-bezier(0.2, 0.9, 0.3, 1.08);
	}

	.flipper.flipped {
		transform: rotateY(180deg);
	}

	.card-side {
		grid-area: 1 / 1;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}

	.card-side.back-face {
		transform: rotateY(180deg);
	}

	.card-img {
		display: block;
		max-height: min(24rem, 48vh);
		max-width: min(30rem, 46vw);
		width: auto;
		height: auto;
		border-radius: 7px;
		box-shadow: 0 1.4rem 3.2rem rgb(0 0 0 / 0.65);
	}

	.flip-card.clickable .card-img.back {
		box-shadow:
			0 0 0 2px rgb(227 178 60 / 0.75),
			0 1.4rem 3.2rem rgb(0 0 0 / 0.65);
	}

	.flip-hint {
		padding: 0.25rem 0.85rem;
		border-radius: 999px;
		background: var(--paper);
		color: var(--paper-ink);
		font-size: 0.85rem;
		font-weight: 700;
		box-shadow: 0 0.4rem 1.2rem rgb(0 0 0 / 0.5);
	}

	.big-shell.package {
		width: 10rem;
		font-size: 1.5rem;
	}

	.big-shell.door {
		width: 6.5rem;
		font-size: 1.6rem;
	}

	.opened-seals {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.med-shell.package {
		width: 6.5rem;
		font-size: 1.1rem;
	}

	.med-shell.door {
		width: 3.8rem;
		font-size: 1.1rem;
	}

	.caption-plate {
		padding: 0.35rem 1rem;
		border-radius: 6px;
		background: rgb(16 13 10 / 0.82);
		backdrop-filter: blur(6px);
		text-align: center;
	}

	.caption-plate h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 400;
		color: var(--paper);
	}

	.caption-plate p {
		margin: 0.2rem 0 0;
		color: var(--muted);
		font-size: 0.88rem;
	}

	.spotlight-pieces {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.7rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.big-piece {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		max-width: 24rem;
		padding: 0.55rem 0.75rem;
		border: 1px solid rgb(231 220 198 / 0.24);
		border-radius: 6px;
		background: rgb(18 15 11 / 0.86);
		backdrop-filter: blur(6px);
		box-shadow: 0 0.7rem 1.8rem rgb(0 0 0 / 0.5);
	}

	.big-piece.mechanic {
		border-color: rgb(227 178 60 / 0.7);
		background: rgb(32 25 14 / 0.92);
	}

	.big-piece p {
		margin: 0;
		font-size: 0.86rem;
		line-height: 1.35;
		color: var(--ink);
	}

	.piece-token {
		display: flex;
		flex: none;
	}

	.table-objectives {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.6rem;
	}

	.obj-tag {
		display: flex;
		font-size: 1.05rem;
		box-shadow: 0 0.6rem 1.4rem rgb(0 0 0 / 0.5);
	}

	.bottom-bar {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1rem;
		padding-top: 0.5rem;
		z-index: 4;
	}

	.trash {
		justify-self: start;
		display: grid;
		place-items: center;
		width: 2.8rem;
		height: 2.8rem;
		border: 1px solid rgb(231 220 198 / 0.2);
		border-radius: 50%;
		background: rgb(22 18 14 / 0.85);
		color: var(--muted);
		opacity: 0.65;
		transition:
			opacity 250ms ease,
			transform 250ms ease;
	}

	.trash.active {
		opacity: 1;
		transform: scale(1.1);
		border-color: rgb(231 220 198 / 0.5);
		color: var(--paper);
	}

	.trash svg {
		width: 1.5rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.controls {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
	}

	.done-btn {
		padding: 0.55rem 2.2rem;
		border: 2px solid var(--paper);
		border-radius: 4px;
		background: var(--paper);
		color: var(--paper-ink);
		font: inherit;
		font-size: 1.05rem;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 0 0.7rem 1.8rem rgb(0 0 0 / 0.55);
		transition:
			transform 160ms ease,
			background 160ms ease;
	}

	.done-btn:hover {
		transform: translateY(-2px);
		background: #efe5cf;
	}

	.done-btn.voted {
		background: var(--good);
		border-color: var(--good);
		color: #141a12;
	}

	.waiting,
	.prompt {
		padding: 0.25rem 0.8rem;
		border-radius: 999px;
		background: rgb(16 13 10 / 0.78);
		color: var(--paper);
		font-size: 0.85rem;
	}

	.summary-btn {
		justify-self: end;
		padding: 0.35rem 0.9rem;
		border: 1px solid rgb(231 220 198 / 0.35);
		border-radius: 3px;
		background: rgb(18 15 11 / 0.78);
		color: var(--ink);
		font: inherit;
		font-size: 0.82rem;
		cursor: pointer;
	}

	.summary-btn:hover {
		border-color: var(--paper);
	}
</style>
