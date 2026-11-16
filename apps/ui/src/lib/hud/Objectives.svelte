<script lang="ts" module>
	import type { ObjectiveId } from '@repo/game';

	type Glyph = 'center' | 'recon' | 'connect' | 'haven' | 'search' | 'tower' | 'figure' | 'plan' | 'vial';

	/** What each objective is about, drawn as a small symbol beside its name and on each step of its track. */
	const GLYPH: Record<ObjectiveId, Glyph> = {
		prologueCenters: 'center',
		buildCenters: 'center',
		reconRegion: 'recon',
		reconNewArea: 'recon',
		reconEastAsia: 'recon',
		connectCities: 'connect',
		lostHaven: 'haven',
		searches: 'search',
		triangulate: 'tower',
		defect: 'figure',
		plan: 'plan',
		deliverSample: 'vial',
	};
</script>

<script lang="ts">
	import { pack } from '@repo/game';
	import type { PublicState } from '@repo/game';
	import { untrack } from 'svelte';
	import { backOut } from 'svelte/easing';
	import { fly, scale } from 'svelte/transition';

	type Props = { snap: PublicState; onwaive: (objective: ObjectiveId) => void };

	let { snap, onwaive }: Props = $props();

	const campaign = $derived(snap.world.campaign);
	const game = $derived(snap.world.game);
	const objectives = $derived(pack.objectives.filter(objective => campaign.objectives.includes(objective.id)));
	const open = $derived(objectives.filter(objective => !game?.waived.includes(objective.id)));
	const needed = $derived(Math.min(campaign.required, open.length));
	const limit = pack.numbers.incidentLimit;

	// A pip fills when its marker lands, so the track lags the game by the markers still in the air.
	let flying = $state(0);
	const filled = $derived(Math.max(0, (game?.incidents ?? 0) - flying));
	let pips = $state<HTMLElement[]>([]);
	let flights = $state.raw<{ id: number; from: DOMRect; to: DOMRect; delay: number }[]>([]);
	let notice = $state.raw<{ id: number; text: string } | null>(null);
	let seen = untrack(() => game?.log.at(-1)?.seq ?? 0);
	let nextId = 1;

	const left = (count: number) =>
		count <= 0 ? 'The incident track is full' : `${count} incident${count === 1 ? '' : 's'} left`;

	$effect(() => {
		const log = game?.log ?? [];
		const newest = log.at(-1)?.seq ?? 0;
		untrack(() => {
			const fresh = newest > seen ? log.filter(entry => entry.seq > seen && entry.t === 'incident') : [];
			// A jump through a replay or a reload brings many at once, and those simply fill in.
			const live = newest >= seen && fresh.length <= 3;
			seen = newest;
			if (!live || fresh.length === 0) return;
			const launched = fresh.flatMap((entry, index) => {
				if (entry.t !== 'incident') return [];
				const city = document.querySelector(`.anchor[data-city="${entry.city}"]`);
				const pip = pips[entry.total - 1];
				if (!city || !pip) return [];
				return [
					{
						id: nextId++,
						from: city.getBoundingClientRect(),
						to: pip.getBoundingClientRect(),
						delay: 350 + index * 500,
					},
				];
			});
			flying += launched.length;
			flights = [...flights, ...launched];
		});
	});

	function land(id: number) {
		flights = flights.filter(flight => flight.id !== id);
		flying = Math.max(0, flying - 1);
		const noticeId = nextId++;
		notice = { id: noticeId, text: left(limit - filled) };
		setTimeout(() => notice?.id === noticeId && (notice = null), 2600);
	}

	/** Sends a marker from the city it was struck in, up and over the board, into its pip. */
	function travel(node: HTMLElement, flight: (typeof flights)[number]) {
		// The objectives hang from a transformed element, which would make a fixed position relative to it.
		document.body.append(node);
		const from = { x: flight.from.x + flight.from.width / 2, y: flight.from.y + flight.from.height / 2 };
		const to = { x: flight.to.x + flight.to.width / 2, y: flight.to.y + flight.to.height / 2 };
		const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 60 };
		const at = (point: { x: number; y: number }, size: number, turn: number) =>
			`translate(${point.x}px, ${point.y}px) translate(-50%, -50%) rotate(${45 + turn}deg) scale(${size})`;
		const animation = node.animate(
			[
				{ transform: at(from, 0.2, 0), opacity: 0 },
				{ transform: at(from, 1.8, 0), opacity: 1, offset: 0.18 },
				{ transform: at(mid, 1.4, 180), opacity: 1, offset: 0.6 },
				{ transform: at(to, 1, 360), opacity: 1 },
			],
			{ duration: 1300, delay: flight.delay, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'both' },
		);
		animation.onfinish = () => land(flight.id);
		return {
			destroy: () => {
				animation.cancel();
				node.remove();
			},
		};
	}
</script>

{#snippet glyph(kind: Glyph)}
	<svg viewBox="0 0 16 16" aria-hidden="true" class="glyph">
		{#if kind === 'center'}
			<path d="M2 8 8 2.5 14 8h-2v5.5H4V8Z" />
		{:else if kind === 'recon'}
			<circle cx="8" cy="8" r="5.5" fill="none" stroke-width="1.6" />
			<path d="M8 3.5 9.6 8 8 12.5 6.4 8Z" />
		{:else if kind === 'connect'}
			<circle cx="3.5" cy="12" r="2.2" /><circle cx="12.5" cy="4" r="2.2" />
			<path d="M3.5 12 12.5 4" fill="none" stroke-width="1.6" />
		{:else if kind === 'haven'}
			<path d="M8 1.8 13.4 4.9v6.2L8 14.2 2.6 11.1V4.9Z" />
		{:else if kind === 'search'}
			<circle cx="6.8" cy="6.8" r="4" fill="none" stroke-width="1.8" />
			<path d="m9.8 9.8 4 4" fill="none" stroke-width="2.2" stroke-linecap="round" />
		{:else if kind === 'tower'}
			<path d="M8 6 5 14h1.6L8 10l1.4 4H11Z" />
			<path d="M5 4.5a4 4 0 0 1 6 0M3.2 2.6a6.5 6.5 0 0 1 9.6 0" fill="none" stroke-width="1.3" />
		{:else if kind === 'figure'}
			<path d="M8 2 12.5 14h-9Z" />
		{:else if kind === 'plan'}
			<path d="M3 2h10v12H3Z" fill="none" stroke-width="1.5" />
			<path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" fill="none" stroke-width="1.3" />
		{:else}
			<path d="M6.5 2h3v4.2l3.4 6.2a1.2 1.2 0 0 1-1 1.6H4.1a1.2 1.2 0 0 1-1-1.6l3.4-6.2Z" />
		{/if}
	</svg>
{/snippet}

<section class="objectives" data-testid="objectives">
	<div class="tags">
		<span class="need" title="Objectives completed out of the number needed to win"
			>{game?.completed.length ?? 0} / {needed}</span
		>
		{#each objectives as objective, index (objective.id)}
			{@const progress = game?.progress[objective.id] ?? 0}
			{@const done = game?.completed.includes(objective.id) ?? false}
			{@const waived = game?.waived.includes(objective.id) ?? false}
			<button
				in:fly={{ y: -40, duration: 520, delay: 250 + index * 120, easing: backOut }}
				class="objective"
				class:done
				class:waived
				class:mandatory={objective.mandatory}
				disabled={!game || done || waived}
				title={`${objective.name}. ${objective.rule}${objective.mandatory ? ' Mandatory.' : ''}${progress && objective.target > 1 ? ` ${progress} of ${objective.target} done.` : ''} Click to mark it impossible this game.`}
				onclick={() => onwaive(objective.id)}
			>
				{@render glyph(GLYPH[objective.id])}
				<span class="name">{objective.name}</span>
				{#if objective.target > 1}
					<span class="steps" aria-label={`${progress} of ${objective.target}`}>
						{#each { length: objective.target } as _, step (step)}
							<i class:on={step < progress}>{@render glyph(GLYPH[objective.id])}</i>
						{/each}
					</span>
				{:else}
					<span class="box" class:on={done} aria-label={done ? 'done' : 'not yet'}></span>
				{/if}
			</button>
		{/each}
	</div>

	{#if game}
		<!-- The incident track: a marker for every incident, and the game is lost when the last is reached. -->
		<div class="incidents" title="Incidents: the game is lost when the track is full" data-testid="incidents">
			{#each { length: limit } as _, index (index)}
				<i bind:this={pips[index]} class:on={index < filled} class:last={index === limit - 1}></i>
			{/each}
			<span class="left" class:hot={limit - filled <= 2}>{left(limit - filled)}</span>
			{#if notice}
				{#key notice.id}
					<span class="notice" in:scale={{ start: 0.6, duration: 320, easing: backOut }}>{notice.text}</span>
				{/key}
			{/if}
		</div>
	{/if}
</section>

{#each flights as flight (flight.id)}
	<i class="marker" use:travel={flight}></i>
{/each}

<style>
	.objectives {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.78rem;
		white-space: nowrap;
	}

	.tags {
		display: flex;
		align-items: stretch;
		gap: 0.35rem;
	}

	.need {
		display: flex;
		align-items: center;
		padding: 0 0.5rem;
		border-radius: 2px;
		background: var(--slip-ink);
		color: var(--slip);
		font-weight: 700;
		box-shadow: var(--slip-shadow);
	}

	/* Each objective is a paper tag: its symbol, its name, then its track. A finished one gets stamped. */
	.objective {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.18rem 0.55rem 0.18rem 0.45rem;
		border: 0;
		border-radius: 2px;
		background: var(--slip);
		color: var(--slip-ink);
		font: inherit;
		box-shadow: var(--slip-shadow);
		cursor: pointer;
		transition:
			translate 300ms cubic-bezier(0.2, 0.9, 0.3, 1.3),
			background 400ms ease,
			color 400ms ease;
	}

	.objective:hover:not(:disabled) {
		translate: 0 2px;
	}

	.objective:disabled {
		cursor: default;
	}

	.objective.mandatory {
		background: #f0dfb4;
	}

	.objective.done {
		background: #c9dccd;
		color: var(--ink-good);
		animation: stamped 500ms cubic-bezier(0.2, 1.4, 0.4, 1);
	}

	@keyframes stamped {
		from {
			scale: 1.25;
		}
	}

	.objective.waived {
		opacity: 0.45;
		text-decoration: line-through;
	}

	.glyph {
		width: 0.95rem;
		height: 0.95rem;
		flex: none;
		fill: currentcolor;
		stroke: currentcolor;
	}

	.steps {
		display: inline-flex;
		gap: 1px;
	}

	.steps i {
		display: flex;
		opacity: 0.28;
		transition:
			opacity 300ms ease,
			transform 300ms cubic-bezier(0.3, 1.6, 0.5, 1);
	}

	.steps i .glyph {
		width: 0.78rem;
		height: 0.78rem;
	}

	.steps i.on {
		opacity: 1;
		transform: scale(1.1);
	}

	.box {
		width: 0.7rem;
		height: 0.7rem;
		border: 1.5px solid currentcolor;
		border-radius: 1px;
		opacity: 0.6;
	}

	.box.on {
		background: currentcolor;
		opacity: 1;
	}

	.incidents {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.15rem 0.55rem;
		border-radius: 2px;
		background: rgb(20 14 10 / 0.72);
		box-shadow: var(--slip-shadow);
	}

	.incidents i {
		width: 0.62rem;
		height: 0.62rem;
		margin: 0 0.06rem;
		border: 1.5px solid rgb(236 227 207 / 0.55);
		rotate: 45deg;
		transition:
			background 260ms ease,
			border-color 260ms ease,
			scale 360ms cubic-bezier(0.3, 1.8, 0.5, 1);
	}

	.incidents i.on {
		border-color: var(--danger);
		background: var(--danger);
		scale: 1.12;
	}

	.incidents i.last {
		border-color: var(--danger);
		box-shadow: 0 0 0 1.5px rgb(207 91 62 / 0.35);
	}

	.left {
		margin-left: 0.35rem;
		color: var(--muted);
		font-size: 0.74rem;
	}

	.left.hot {
		color: var(--danger);
		font-weight: 700;
	}

	.notice {
		position: absolute;
		top: calc(100% + 0.3rem);
		left: 50%;
		padding: 0.15rem 0.6rem;
		border-radius: 2px;
		background: var(--danger);
		color: #fff4ec;
		font-weight: 700;
		translate: -50% 0;
		pointer-events: none;
	}

	/* The marker in flight, drawn above everything: it starts at the struck city and ends in its pip. */
	.marker {
		position: fixed;
		top: 0;
		left: 0;
		z-index: 80;
		width: 0.62rem;
		height: 0.62rem;
		border: 1.5px solid #fff4ec;
		background: var(--danger);
		box-shadow: 0 0 0.8rem rgb(207 91 62 / 0.8);
		pointer-events: none;
	}
</style>
