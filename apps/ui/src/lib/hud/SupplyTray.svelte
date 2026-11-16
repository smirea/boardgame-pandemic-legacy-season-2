<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import type { CityId, Game } from '@repo/game';
	import { untrack } from 'svelte';

	type Props = { game: Game };

	let { game }: Props = $props();

	type Flight = { id: number; city: CityId; back: boolean; delay: number };

	let tray = $state<HTMLElement>();
	let flights = $state.raw<Flight[]>([]);
	// A cube taken back joins the tray only when it lands, so the tray never shows it twice.
	let incoming = $state(0);
	let held = untrack(() => supplyByCity());
	let nextId = 1;

	const shown = $derived(Math.max(0, game.stockpile - incoming));

	function supplyByCity() {
		return new Map(Object.entries(game.locations).map(([city, location]) => [city as CityId, location.supplies]));
	}

	$effect(() => {
		const now = supplyByCity();
		untrack(() => {
			const launched: Flight[] = [];
			for (const [city, count] of now) {
				const delta = count - (held.get(city) ?? 0);
				for (let step = 0; step < Math.abs(delta); step++)
					launched.push({ id: nextId++, city, back: delta < 0, delay: Math.min(launched.length, 40) * 28 });
			}
			held = now;
			incoming += launched.filter(flight => flight.back).length;
			flights = [...flights, ...launched];
		});
	});

	function land(flight: Flight) {
		flights = flights.filter(other => other.id !== flight.id);
		if (flight.back) incoming = Math.max(0, incoming - 1);
	}

	/** Flies one cube between the tray and the city's disc, out on a click and home on a right click. */
	function travel(node: HTMLElement, flight: Flight) {
		const anchor = document.querySelector(`.anchor[data-city="${flight.city}"]`);
		const slot = tray?.lastElementChild ?? tray;
		if (!anchor || !slot) {
			queueMicrotask(() => land(flight));
			return;
		}
		document.body.append(node);
		const centre = (box: DOMRect) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
		const home = centre(slot.getBoundingClientRect());
		const city = centre(anchor.getBoundingClientRect());
		const [from, to] = flight.back ? [city, home] : [home, city];
		const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 80 };
		const at = (point: { x: number; y: number }, size: number, turn: number) =>
			`translate(${point.x}px, ${point.y}px) translate(-50%, -50%) rotate(${turn}deg) scale(${size})`;
		const animation = node.animate(
			[
				{ transform: at(from, flight.back ? 0.4 : 1, 0), opacity: flight.back ? 0 : 1 },
				{ transform: at(mid, 1.25, 90), opacity: 1, offset: 0.5 },
				{ transform: at(to, flight.back ? 1 : 0.5, 180), opacity: flight.back ? 1 : 0 },
			],
			{ duration: 520, delay: flight.delay, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'both' },
		);
		animation.onfinish = () => land(flight);
		return {
			destroy: () => {
				animation.cancel();
				node.remove();
			},
		};
	}
</script>

<div
	class="tray"
	bind:this={tray}
	title="Supply cubes left. Click a city to place one, right-click to take it back."
	aria-label={`${game.stockpile} supply cubes left`}
	data-testid="supply-tray"
	data-left={game.stockpile}
	{@attach feedback(undefined, () => ({ stockpile: game.stockpile, shown }))}
>
	{#each { length: shown } as _, index (index)}
		<i class="cube"></i>
	{/each}
</div>

{#each flights as flight (flight.id)}
	<i class="cube flying" use:travel={flight}></i>
{/each}

<style>
	.tray {
		display: grid;
		grid-auto-flow: column;
		grid-template-rows: repeat(3, 0.8rem);
		gap: 0.22rem;
		min-width: 2rem;
		min-height: 2.8rem;
		padding: 0.3rem 0.45rem;
		border-radius: 3px;
		background: rgb(0 0 0 / 0.22);
		box-shadow: inset 0 1px 3px rgb(0 0 0 / 0.45);
	}

	.cube {
		display: block;
		width: 0.8rem;
		height: 0.8rem;
		border-radius: 1.5px;
		background: linear-gradient(145deg, #fbf5e6 0%, #efe6d2 55%, #cfc3a6 100%);
		box-shadow:
			inset 0 -2px 0 rgb(120 100 70 / 0.35),
			0 1px 2px rgb(0 0 0 / 0.45);
	}

	.tray .cube {
		animation: settle 260ms cubic-bezier(0.3, 1.8, 0.5, 1);
	}

	@keyframes settle {
		from {
			scale: 0.4;
		}
	}

	.flying {
		position: fixed;
		top: 0;
		left: 0;
		z-index: 80;
		pointer-events: none;
	}
</style>
