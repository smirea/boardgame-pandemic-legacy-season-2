<script lang="ts">
	import { worldMap } from '@repo/game';
	import type { CityId, RegionId, RouteId } from '@repo/game';
	import Board from '#lib/board/Board.svelte';
	import type { BoardView, CityView } from '#lib/board/types.ts';
	import { SvelteSet } from 'svelte/reactivity';

	const explored = new SvelteSet<RegionId>(
		worldMap.regions.filter(region => region.startsExplored).map(region => region.id),
	);
	const established = new SvelteSet<RouteId>(
		worldMap.routes.filter(route => route.startsEstablished).map(route => route.id),
	);
	let selected = $state<CityId | null>(null);
	let pawnCity = $state(worldMap.cities[0]!.id);
	let pointer = $state<{ x: number; z: number } | null>(null);

	const view = $derived<BoardView>({
		map: worldMap,
		explored,
		established,
		cities: Object.fromEntries(
			worldMap.cities.map((city, index): [CityId, CityView] => [
				city.id,
				{
					supplies: city.kind === 'haven' ? 0 : (index * 7) % 5,
					plague: index % 6 === 0 && city.kind === 'city' ? 2 : 0,
					population: city.population,
					onGrid:
						city.startsOnGrid ||
						worldMap.routes.some(route => established.has(route.id) && (route.a === city.id || route.b === city.id)),
					supplyCenter: index % 4 === 1,
					highlight: selected === city.id ? 'selected' : index % 3 === 0 ? 'reachable' : null,
				},
			]),
		) as Record<CityId, CityView>,
		pawns: [
			{ id: 'p1', city: pawnCity, color: '#f25c54', name: 'Ada', active: true },
			{ id: 'p2', city: worldMap.cities[0]!.id, color: '#b06ef2', name: 'Bo', active: false },
		],
		cursors: pointer ? [{ id: 'echo', name: 'echo', color: '#ffd166', x: pointer.x + 4, z: pointer.z }] : [],
	});
</script>

<Board
	{view}
	oncity={city => {
		selected = city;
		pawnCity = city;
	}}
	onpointer={point => (pointer = point)}
/>

<div class="panel">
	<button data-testid="explore" onclick={() => worldMap.regions.forEach(region => explored.add(region.id))}
		>Explore all</button
	>
	<button
		data-testid="establish"
		onclick={() => {
			const next = worldMap.routes.find(route => !established.has(route.id));
			if (next) established.add(next.id);
		}}>Establish next route</button
	>
	<span data-testid="selected">{selected ?? 'none'}</span>
</div>

<style>
	.panel {
		position: absolute;
		top: 1rem;
		left: 1rem;
		display: flex;
		gap: 0.5rem;
		align-items: center;
		color: white;
	}

	button {
		padding: 0.3rem 0.7rem;
		border-radius: 0.3rem;
		background: #f1ede2;
		color: #10161c;
		font-weight: 600;
	}
</style>
