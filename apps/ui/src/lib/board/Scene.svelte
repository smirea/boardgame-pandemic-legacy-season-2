<script lang="ts">
	import type { CityId } from '@repo/game';
	import { T } from '@threlte/core';
	import { interactivity, OrbitControls } from '@threlte/extras';
	import { MOUSE } from 'three';
	import CityMarker from './CityMarker.svelte';
	import Cloud from './Cloud.svelte';
	import { buildLandGeometry } from './land';
	import Pawn from './Pawn.svelte';
	import { BOARD_HEIGHT, BOARD_WIDTH, layoutCities } from './projection';
	import type { BoardPoint } from './projection';
	import RemoteCursor from './RemoteCursor.svelte';
	import RouteTube from './RouteTube.svelte';
	import type { BoardView } from './types';

	type Props = {
		view: BoardView;
		oncity?: (city: CityId) => void;
		onpointer?: (point: BoardPoint | null) => void;
	};

	let { view, oncity, onpointer }: Props = $props();

	interactivity();

	const landGeometry = buildLandGeometry();
	const layout = $derived(layoutCities(view.map));
	const cityById = $derived(new Map(view.map.cities.map(city => [city.id, city])));
	const visibleCities = $derived(view.map.cities.filter(city => view.explored.has(city.region)));
	const foggedCities = $derived(view.map.cities.filter(city => !view.explored.has(city.region)));
	const visibleRoutes = $derived(
		view.map.routes.filter(
			route => view.explored.has(cityById.get(route.a)!.region) && view.explored.has(cityById.get(route.b)!.region),
		),
	);
	const pawnSlots = $derived.by(() => {
		const perCity = new Map<CityId, number>();
		return view.pawns.map(pawn => {
			const slot = perCity.get(pawn.city) ?? 0;
			perCity.set(pawn.city, slot + 1);
			return { pawn, slot, at: layout.get(pawn.city)! };
		});
	});
</script>

<T.PerspectiveCamera makeDefault position={[-30, 95, 80]} fov={32} near={1} far={600}>
	<OrbitControls
		target={[-30, 0, 2]}
		enableDamping
		dampingFactor={0.12}
		minDistance={25}
		maxDistance={230}
		minPolarAngle={0.1}
		maxPolarAngle={1.25}
		screenSpacePanning={false}
		zoomToCursor
		mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }}
	/>
</T.PerspectiveCamera>

<T.HemisphereLight args={['#dfeaf5', '#1c2630', 1.1]} />
<T.DirectionalLight
	position={[-60, 120, 50]}
	intensity={2.2}
	castShadow
	shadow.mapSize={[4096, 4096]}
	shadow.camera.left={-130}
	shadow.camera.right={130}
	shadow.camera.top={80}
	shadow.camera.bottom={-80}
	shadow.camera.far={320}
	shadow.bias={-0.0004}
/>

<T.Mesh position={[0, -1.6, 0]} receiveShadow>
	<T.BoxGeometry args={[BOARD_WIDTH + 14, 3, BOARD_HEIGHT + 14]} />
	<T.MeshStandardMaterial color="#1a1f25" roughness={0.9} />
</T.Mesh>

<T.Mesh
	rotation.x={-Math.PI / 2}
	position.y={0}
	receiveShadow
	onpointermove={event => onpointer?.({ x: event.point.x, z: event.point.z })}
>
	<T.PlaneGeometry args={[BOARD_WIDTH + 6, BOARD_HEIGHT + 6]} />
	<T.MeshStandardMaterial color="#17425c" roughness={0.35} metalness={0.15} />
</T.Mesh>

<T.Mesh geometry={landGeometry} receiveShadow castShadow>
	<T.MeshStandardMaterial color="#b9b08f" roughness={0.95} flatShading />
</T.Mesh>

{#each visibleRoutes as route (route.id)}
	<RouteTube
		{route}
		from={layout.get(route.a)!}
		to={layout.get(route.b)!}
		established={view.established.has(route.id)}
	/>
{/each}

{#each visibleCities as city (city.id)}
	<CityMarker {city} at={layout.get(city.id)!} state={view.cities[city.id]!} onselect={() => oncity?.(city.id)} />
{/each}

{#each foggedCities as city, index (city.id)}
	<Cloud at={layout.get(city.id)!} seed={index} />
{/each}

{#each pawnSlots as { pawn, slot, at } (pawn.id)}
	<Pawn {pawn} {slot} {at} />
{/each}

{#each view.cursors as cursor (cursor.id)}
	<RemoteCursor {cursor} />
{/each}
