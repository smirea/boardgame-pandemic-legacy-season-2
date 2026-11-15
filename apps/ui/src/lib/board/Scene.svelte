<script lang="ts">
	import type { CityId } from '@repo/game';
	import { T, useThrelte } from '@threlte/core';
	import { interactivity, OrbitControls } from '@threlte/extras';
	import { MOUSE } from 'three';
	import type { PerspectiveCamera } from 'three';
	import type { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';
	import CityMarker from './CityMarker.svelte';
	import { fitBoard } from './fit';
	import Cloud from './Cloud.svelte';
	import { buildLandGeometry } from './land';
	import Pawn from './Pawn.svelte';
	import { layoutCities } from './projection';
	import type { BoardBounds, BoardPoint } from './projection';
	import RemoteCursor from './RemoteCursor.svelte';
	import RouteTube from './RouteTube.svelte';
	import type { BoardView } from './types';

	type Props = {
		view: BoardView;
		oncity?: (city: CityId) => void;
		onpointer?: (point: BoardPoint | null) => void;
		/** Bump to return the camera to the whole-board view. */
		resetView?: number;
	};

	let { view, oncity, onpointer, resetView = 0 }: Props = $props();

	interactivity();

	const FOV = 30;
	const { size } = useThrelte();
	let camera = $state<PerspectiveCamera>();
	let controls = $state<OrbitControlsImpl>();
	let userMoved = $state(false);
	let lastReset = 0;
	$effect(() => {
		if (resetView !== lastReset) {
			lastReset = resetView;
			userMoved = false;
		}
		if (!camera || !controls || userMoved) return;
		camera.position.copy(fit.position);
		controls.target.copy(fit.target);
		controls.update();
	});

	const landGeometry = buildLandGeometry();
	const layout = $derived(layoutCities(view.map));
	const bounds = $derived.by((): BoardBounds => {
		const land = landGeometry.boundingBox!;
		const points = [...layout.values()];
		const margin = 4;
		return {
			minX: Math.min(land.min.x, ...points.map(point => point.x)) - margin,
			maxX: Math.max(land.max.x, ...points.map(point => point.x)) + margin,
			minZ: Math.min(land.min.z, ...points.map(point => point.z)) - margin,
			maxZ: Math.max(land.max.z, ...points.map(point => point.z)) + margin,
		};
	});
	const fit = $derived(fitBoard(bounds, size.current.width / Math.max(1, size.current.height), FOV));
	const boardSize = $derived({ width: bounds.maxX - bounds.minX, depth: bounds.maxZ - bounds.minZ });
	const boardCentre = $derived({ x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 });
	const cityById = $derived(new Map(view.map.cities.map(city => [city.id, city])));
	const visibleCities = $derived(view.map.cities.filter(city => view.explored.has(city.region)));
	const foggedCities = $derived(view.map.cities.filter(city => !view.explored.has(city.region)));
	const visibleRoutes = $derived(
		view.map.routes.filter(
			route => view.explored.has(cityById.get(route.a)!.region) && view.explored.has(cityById.get(route.b)!.region),
		),
	);
	// A city whose closest neighbour sits just north of it hangs its label below, so the two labels part instead of stacking.
	const labelsBelow = $derived.by(() => {
		const below = new Set<CityId>();
		for (const city of visibleCities) {
			const at = layout.get(city.id)!;
			let nearest: { dz: number; distance: number } | null = null;
			for (const other of visibleCities) {
				if (other.id === city.id) continue;
				const point = layout.get(other.id)!;
				const distance = Math.hypot(point.x - at.x, point.z - at.z);
				if (distance < 13 && (!nearest || distance < nearest.distance)) nearest = { dz: point.z - at.z, distance };
			}
			if (nearest && nearest.dz < 0) below.add(city.id);
		}
		return below;
	});
	const pawnSlots = $derived.by(() => {
		const perCity = new Map<CityId, number>();
		return view.pawns.map(pawn => {
			const slot = perCity.get(pawn.city) ?? 0;
			perCity.set(pawn.city, slot + 1);
			return { pawn, slot, at: layout.get(pawn.city)! };
		});
	});
</script>

<T.PerspectiveCamera makeDefault fov={FOV} near={1} far={900} bind:ref={camera}>
	<OrbitControls
		bind:ref={controls}
		enableDamping
		dampingFactor={0.12}
		minDistance={25}
		maxDistance={fit.distance * 1.15}
		minPolarAngle={0.05}
		maxPolarAngle={1.2}
		screenSpacePanning={false}
		zoomToCursor
		mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }}
		onstart={() => (userMoved = true)}
	/>
</T.PerspectiveCamera>

<T.HemisphereLight args={['#dfeaf5', '#1c2630', 1.1]} />
<T.DirectionalLight
	position={[-60, 120, 50]}
	intensity={2.2}
	castShadow
	shadow.mapSize={[4096, 4096]}
	shadow.camera.left={-120}
	shadow.camera.right={120}
	shadow.camera.top={80}
	shadow.camera.bottom={-80}
	shadow.camera.far={320}
	shadow.bias={-0.0004}
/>

<T.Mesh position={[boardCentre.x, -1.6, boardCentre.z]} receiveShadow>
	<T.BoxGeometry args={[boardSize.width + 3, 3, boardSize.depth + 3]} />
	<T.MeshStandardMaterial color="#1a1f25" roughness={0.9} />
</T.Mesh>

<T.Mesh
	rotation.x={-Math.PI / 2}
	position={[boardCentre.x, 0, boardCentre.z]}
	receiveShadow
	onpointermove={event => onpointer?.({ x: event.point.x, z: event.point.z })}
>
	<T.PlaneGeometry args={[boardSize.width, boardSize.depth]} />
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
	<CityMarker
		{city}
		at={layout.get(city.id)!}
		state={view.cities[city.id]!}
		labelBelow={labelsBelow.has(city.id)}
		onselect={() => oncity?.(city.id)}
	/>
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
