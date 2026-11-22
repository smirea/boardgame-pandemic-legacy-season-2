<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack } from '@repo/game';
	import type { ObjectiveId, PublicState } from '@repo/game';
	import { untrack } from 'svelte';
	import { backOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import ObjectiveTag from './ObjectiveTag.svelte';

	type Props = {
		snap: PublicState;
		onwaive: (objective: ObjectiveId) => void;
		/** The briefing is showing these objectives, so they wait there and fly here once it closes. */
		held?: boolean;
		/** Incidents the state holds that the infection show has not put on the track yet. */
		heldIncidents?: number;
		/** The track is drawn large while the infection show puts a marker on it. */
		surge?: boolean;
	};

	let { snap, onwaive, held = false, heldIncidents = 0, surge = false }: Props = $props();

	const campaign = $derived(snap.world.campaign);
	const game = $derived(snap.world.game);
	const objectives = $derived(pack.objectives.filter(objective => campaign.objectives.includes(objective.id)));
	const open = $derived(objectives.filter(objective => !game?.waived.includes(objective.id)));
	const needed = $derived(Math.min(campaign.required, open.length));
	const limit = pack.numbers.incidentLimit;

	// A pip fills when its marker lands, so the track lags the game by the markers held back or still in the air.
	const revealed = $derived(Math.max(0, (game?.incidents ?? 0) - heldIncidents));
	let flying = $state(0);
	const filled = $derived(Math.max(0, revealed - flying));
	let pips = $state<HTMLElement[]>([]);
	let flights = $state.raw<{ id: number; from: DOMRect; to: DOMRect; delay: number }[]>([]);
	let seen = untrack(() => revealed);
	let nextId = 1;
	/** The track flashes red as a marker lands on it. */
	let flash = $state(0);

	const left = (count: number) =>
		count <= 0 ? 'The incident track is full' : `${count} incident${count === 1 ? '' : 's'} left`;

	$effect(() => {
		const now = revealed;
		untrack(() => {
			const log = game?.log ?? [];
			const fresh = log.filter(entry => entry.t === 'incident' && entry.total > seen && entry.total <= now);
			// A jump through a replay or a reload brings many at once, and those simply fill in.
			const live = now > seen && now - seen <= 3;
			seen = now;
			if (!live) return;
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
						delay: (surge ? 0 : 350) + index * 500,
					},
				];
			});
			flying += launched.length;
			flights = [...flights, ...launched];
		});
	});

	let slots = $state<Partial<Record<ObjectiveId, HTMLElement>>>({});
	let inAir = $state.raw<ObjectiveId[]>([]);
	// The track stays empty while the briefing is open, and its diamonds come in once the objectives have landed.
	let dealt = $state(untrack(() => !held));
	let ghosts: Animation[] = [];

	$effect(() => {
		if (held) {
			untrack(() => (dealt = false));
			return;
		}
		untrack(() => {
			if (!dealt) deliver();
		});
	});

	$effect(() => () => {
		for (const ghost of ghosts) ghost.cancel();
	});

	/** Lifts each objective off the closing briefing and carries it to its place over the board. */
	function deliver() {
		const sources = new Map(
			[...document.querySelectorAll<HTMLElement>('[data-brief-objective]')].map(node => [
				node.dataset.briefObjective,
				node,
			]),
		);
		const legs = objectives.flatMap(objective => {
			const from = sources.get(objective.id);
			const to = slots[objective.id];
			return from && to ? [{ id: objective.id, from, to }] : [];
		});
		inAir = legs.map(leg => leg.id);
		if (!legs.length) return deal();
		legs.forEach((leg, index) => {
			const from = leg.from.getBoundingClientRect();
			const to = leg.to.getBoundingClientRect();
			const ghost = leg.from.cloneNode(true) as HTMLElement;
			ghost.removeAttribute('data-brief-objective');
			Object.assign(ghost.style, {
				position: 'fixed',
				top: `${from.top}px`,
				left: `${from.left}px`,
				width: `${from.width}px`,
				height: `${from.height}px`,
				margin: '0',
				zIndex: '90',
				pointerEvents: 'none',
				transformOrigin: '0 0',
				fontSize: getComputedStyle(leg.from).fontSize,
			});
			document.body.append(ghost);
			const dx = to.left - from.left;
			const dy = to.top - from.top;
			const size = to.width / from.width;
			const at = (x: number, y: number, scale: number, turn: number) =>
				`translate(${x}px, ${y}px) scale(${scale}) rotate(${turn}deg)`;
			const flight = ghost.animate(
				[
					{ transform: at(0, 0, 1, 0), filter: 'drop-shadow(0 0 0 rgb(0 0 0 / 0))' },
					{ transform: at(-4, -12, 1.08, -3), filter: 'drop-shadow(0 0.8rem 1rem rgb(0 0 0 / 0.45))', offset: 0.25 },
					{ transform: at(dx * 0.5, dy * 0.5 - 50, (1 + size) * 0.55, 4), offset: 0.62 },
					{ transform: at(dx, dy + 3, size * 1.06, 0), offset: 0.88 },
					{ transform: at(dx, dy, size, 0), filter: 'drop-shadow(0 0 0 rgb(0 0 0 / 0))' },
				],
				{ duration: 1250, delay: index * 160, easing: 'cubic-bezier(0.5, 0, 0.25, 1)', fill: 'both' },
			);
			ghosts.push(flight);
			flight.onfinish = () => {
				ghost.remove();
				ghosts = ghosts.filter(other => other !== flight);
				leg.to.animate([{ scale: '1.18' }, { scale: '1' }], {
					duration: 380,
					easing: 'cubic-bezier(0.3, 1.6, 0.5, 1)',
				});
				inAir = inAir.filter(id => id !== leg.id);
				if (!inAir.length) deal();
			};
			flight.oncancel = () => ghost.remove();
		});
	}

	/** Brings the incident diamonds in one at a time. */
	function deal() {
		dealt = true;
		pips.forEach((pip, index) =>
			pip?.animate(
				[
					{ scale: '0', opacity: 0, rotate: '-90deg' },
					{ scale: '1.5', opacity: 1, rotate: '60deg', offset: 0.6 },
				],
				{ duration: 460, delay: 120 + index * 110, easing: 'cubic-bezier(0.3, 1.4, 0.5, 1)', fill: 'backwards' },
			),
		);
	}

	function land(id: number) {
		flights = flights.filter(flight => flight.id !== id);
		flying = Math.max(0, flying - 1);
		flash++;
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
			{ duration: surge ? 950 : 1300, delay: flight.delay, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'both' },
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

<section
	class="objectives"
	data-testid="objectives"
	data-dest="objectives"
	{@attach feedback(undefined, () => ({
		objectives: objectives.map(objective => objective.id),
		progress: game?.progress,
		completed: game?.completed,
		waived: game?.waived,
		needed,
		incidents: game?.incidents,
	}))}
>
	<div class="tags">
		{#each objectives as objective, index (objective.id)}
			<span
				class="slot"
				class:away={held || inAir.includes(objective.id)}
				bind:this={slots[objective.id]}
				in:fly={{ y: -40, duration: 520, delay: 250 + index * 120, easing: backOut }}
			>
				<ObjectiveTag
					{objective}
					{campaign}
					progress={game?.progress[objective.id] ?? 0}
					done={game?.completed.includes(objective.id) ?? false}
					waived={game?.waived.includes(objective.id) ?? false}
					onclick={game ? () => onwaive(objective.id) : undefined}
				/>
			</span>
		{/each}
	</div>

	{#if game}
		<!-- The incident track: a marker for every incident, and the game is lost when the last is reached. -->
		<div class="incidents" class:surge data-testid="incidents" data-flash={flash} aria-label={left(limit - filled)}>
			{#key flash}{#if flash}<span class="flash" aria-hidden="true"></span>{/if}{/key}
			{#each { length: limit } as _, index (index)}
				<i bind:this={pips[index]} class:on={index < filled} class:last={index === limit - 1} class:away={!dealt}>
					{#if index === limit - 1}
						<svg class="skull-pip" viewBox="0 0 24 24" aria-hidden="true" data-testid="incident-skull">
							<path
								d="M12 2.5C7.3 2.5 4 5.7 4 10c0 2.4 1.1 4.4 2.8 5.6V18c0 .8.7 1.5 1.5 1.5h7.4c.8 0 1.5-.7 1.5-1.5v-2.4C18.9 14.4 20 12.4 20 10c0-4.3-3.3-7.5-8-7.5Zm-3.1 9.2a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Zm6.2 0a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Zm-4.6 6.3v-2h1.2v2h-1.2Zm2.3 0v-2H14v2h-1.2Z"
							/>
						</svg>
					{/if}
				</i>
			{/each}
			<span class="left" class:hot={limit - filled <= 2}>{left(limit - filled)}. The game is lost when it fills.</span>
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

	.slot {
		display: flex;
	}

	.slot.away {
		visibility: hidden;
	}

	/* Bare diamonds over the chart; the slip and its count appear only under the pointer. */
	.incidents {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.3rem 0.6rem;
		border-radius: 2px;
		transform-origin: 50% 0;
		transition:
			background 200ms ease,
			box-shadow 200ms ease,
			scale 380ms cubic-bezier(0.3, 1.3, 0.5, 1);
	}

	/* Grown so every eye at the table finds it while a marker goes on, then back to its place. */
	.incidents.surge {
		z-index: 30;
		background: rgb(20 14 10 / 0.72);
		box-shadow: var(--slip-shadow);
		scale: 2.4;
	}

	.flash {
		position: absolute;
		inset: 0;
		border-radius: 2px;
		background: var(--danger);
		pointer-events: none;
		animation: flash 900ms ease-out both;
	}

	@keyframes flash {
		0%,
		60% {
			opacity: 0.85;
		}
		30% {
			opacity: 0.35;
		}
		100% {
			opacity: 0;
		}
	}

	.incidents:hover {
		background: rgb(20 14 10 / 0.72);
		box-shadow: var(--slip-shadow);
	}

	.incidents i {
		position: relative;
		width: 0.95rem;
		height: 0.95rem;
		margin: 0 0.08rem;
		border: 2px solid rgb(42 32 23 / 0.7);
		background: rgb(239 230 210 / 0.55);
		box-shadow: 0 1px 2px rgb(20 14 10 / 0.35);
		rotate: 45deg;
		transition:
			background 260ms ease,
			border-color 260ms ease,
			scale 360ms cubic-bezier(0.3, 1.8, 0.5, 1);
	}

	.incidents i.on {
		border-color: #3b5210;
		background: #93b236;
		scale: 1.12;
	}

	.incidents i.away {
		visibility: hidden;
	}

	.incidents i.last {
		border-color: #3b5210;
		display: grid;
		place-items: center;
	}

	.skull-pip {
		width: 0.78rem;
		height: 0.78rem;
		rotate: -45deg;
		fill: #241b13;
		pointer-events: none;
	}

	.incidents i.last.on .skull-pip {
		fill: #1b2608;
	}

	.left {
		position: absolute;
		top: calc(100% + 0.3rem);
		left: 50%;
		padding: 0.15rem 0.6rem;
		border-radius: 2px;
		background: rgb(20 14 10 / 0.85);
		box-shadow: var(--slip-shadow);
		color: var(--muted);
		font-size: 0.74rem;
		white-space: nowrap;
		translate: -50% -0.2rem;
		opacity: 0;
		pointer-events: none;
		transition:
			opacity 180ms ease,
			translate 180ms ease;
	}

	.incidents:hover .left {
		opacity: 1;
		translate: -50% 0;
	}

	.left.hot {
		color: var(--danger);
		font-weight: 700;
	}

	/* The marker in flight, drawn above everything: it starts at the struck city and ends in its pip. */
	.marker {
		position: fixed;
		top: 0;
		left: 0;
		z-index: 80;
		width: 0.95rem;
		height: 0.95rem;
		border: 2px solid #f4fbe2;
		background: #93b236;
		box-shadow: 0 0 0.8rem rgb(147 178 54 / 0.85);
		pointer-events: none;
	}
</style>
