<script lang="ts">
	import { edgeKey, pack } from '@repo/game';
	import type { CityId } from '@repo/game';
	import { T, useThrelte } from '@threlte/core';
	import { interactivity, OrbitControls } from '@threlte/extras';
	import { untrack } from 'svelte';
	import { cubicInOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { CanvasTexture, LinearFilter, MeshStandardMaterial, MOUSE, SRGBColorSpace, Texture } from 'three';
	import type { PerspectiveCamera, Vector3 } from 'three';
	import type { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';
	import CityMarker from './CityMarker.svelte';
	import Flags from './Flags.svelte';
	import { FogMask } from './chart';
	import { loadChart } from './chartLoader';
	import { DEFAULT_TILT, fitBoard } from './fit';
	import Fog from './Fog.svelte';
	import type { Part } from './hints';
	import { layoutLabels, NAME_SIZE } from './labels';
	import type { Placement } from './labels';
	import { buildLandGeometry, mapToSheet } from './land';
	import { LAND_HEIGHT } from './projection';
	import FlyingCube from './FlyingCube.svelte';
	import Pawn from './Pawn.svelte';
	import { fonts, nameWidth } from './print.svelte';
	import type { BoardBounds, BoardPoint } from './projection';
	import Pulse from './Pulse.svelte';
	import ReconBox from './ReconBox.svelte';
	import { placeReconBoxes } from './reconLayout';
	import type { ReconRect } from './reconLayout';
	import RemoteCursor from './RemoteCursor.svelte';
	import Ring from './Ring.svelte';
	import RouteTube from './RouteTube.svelte';
	import { CITY_RADIUS, CITY_TOP } from './routes';
	import Stockpile from './Stockpile.svelte';
	import { PILE, STOCKPILE, STOCKPILE_REACH, supplyMoves } from './stockpile';
	import type { Holder, SupplySnapshot } from './stockpile';
	import Trail from './Trail.svelte';
	import type { BoardView, Covered, ReconBoxView } from './types';

	type Props = {
		view: BoardView;
		oncity?: (city: CityId) => void;
		/** A click on a recon route's box. */
		onrecon?: (route: string) => void;
		onpointer?: (point: BoardPoint | null) => void;
		/** Bump to return the camera to the fitted view of everything explored. */
		resetView?: number;
		/** A pointer over part of a city, or off it when `event` is null, with where the city's name is printed. */
		onhint?: (city: CityId, part: Part, event: PointerEvent | null, name: Placement | undefined) => void;
		/** The city under the pointer, whose printed name lights up. */
		hoverCity?: CityId | null;
		/** A pointer over the stockpile, or off it when `event` is null. */
		onstockpile?: (event: PointerEvent | null) => void;
		hoverStockpile?: boolean;
		/** Screen rectangles, in pixels from the canvas corner, that HUD panels cover. The fitted view keeps cities out of them. */
		covered?: Covered[];
	};

	let {
		view,
		oncity,
		onpointer,
		onhint,
		hoverCity = null,
		onrecon,
		onstockpile,
		hoverStockpile = false,
		resetView = 0,
		covered = [],
	}: Props = $props();

	interactivity();

	const FOV = 30;
	const middleOf = (cities: CityId[]) =>
		cities.length
			? {
					x: cities.reduce((sum, city) => sum + pack.positions[city]!.x, 0) / cities.length,
					z: cities.reduce((sum, city) => sum + pack.positions[city]!.z, 0) / cities.length,
				}
			: null;
	const { size, renderer, invalidate } = useThrelte();
	const layout = pack.positions;
	const BLANK = '#d2c3a1';
	const landGeometry = buildLandGeometry();
	const bounds: BoardBounds = (() => {
		const land = landGeometry.boundingBox!;
		const points = Object.values(layout);
		const margin = 4;
		return {
			minX: Math.min(land.min.x, ...points.map(point => point.x)) - margin,
			maxX: Math.max(land.max.x, ...points.map(point => point.x)) + margin,
			minZ: Math.min(land.min.z, ...points.map(point => point.z)) - margin,
			maxZ: Math.max(land.max.z, ...points.map(point => point.z)) + margin,
		};
	})();
	const boardSize = { width: bounds.maxX - bounds.minX, depth: bounds.maxZ - bounds.minZ };
	const boardCentre = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };
	mapToSheet(landGeometry, bounds);
	const texture = (bitmap: ImageBitmap) => {
		const map = new Texture(bitmap);
		map.colorSpace = SRGBColorSpace;
		map.flipY = false;
		map.anisotropy = renderer.capabilities.getMaxAnisotropy();
		map.needsUpdate = true;
		return map;
	};
	// Until the worker hands the chart back, the board is a blank sheet of the same paper.
	let sheets = $state.raw<{ known: Texture; lines: Texture } | null>(null);
	loadChart(bounds).then(
		images => {
			sheets = { known: texture(images.known), lines: texture(images.lines) };
			invalidate();
		},
		error => console.error(error),
	);

	// Region lines mark the edge of what is known, so a line shows only beside a location still hidden and
	// fades out with the fog as the regions on both sides are revealed.
	const fogMask = new FogMask(bounds);
	const lineMask = new CanvasTexture(fogMask.lines);
	lineMask.minFilter = LinearFilter;
	lineMask.generateMipmaps = false;
	const regionLines = { uLines: { value: null as Texture | null }, uLineMask: { value: lineMask } };
	const inkRegionLines = (material: MeshStandardMaterial) => {
		material.onBeforeCompile = shader => {
			Object.assign(shader.uniforms, regionLines);
			shader.fragmentShader = shader.fragmentShader
				.replace('#include <common>', '#include <common>\nuniform sampler2D uLines;\nuniform sampler2D uLineMask;')
				.replace(
					'#include <map_fragment>',
					`#include <map_fragment>
					#ifdef USE_MAP
						vec4 regionInk = texture2D( uLines, vMapUv );
						diffuseColor.rgb = mix( diffuseColor.rgb, regionInk.rgb, regionInk.a * texture2D( uLineMask, vMapUv ).r );
					#endif`,
				);
		};
		return material;
	};

	// The materials stay put and take the chart when it lands; swapping material objects under a mesh loses them.
	const sheetMaterial = inkRegionLines(new MeshStandardMaterial({ color: BLANK, alphaTest: 0.5, roughness: 0.92 }));
	const landMaterial = inkRegionLines(new MeshStandardMaterial({ color: BLANK, roughness: 0.92 }));
	$effect(() => {
		regionLines.uLines.value = sheets?.lines ?? null;
		for (const material of [sheetMaterial, landMaterial]) {
			material.map = sheets?.known ?? null;
			material.color.set(sheets ? '#ffffff' : BLANK);
			material.needsUpdate = true;
		}
		invalidate();
	});

	let camera = $state<PerspectiveCamera>();
	let controls = $state<OrbitControlsImpl>();
	let userMoved = $state(false);
	let dragging = false;
	let lastReset = 0;
	// A city's pieces and its printed name reach this far from its centre, so a fitted view keeps them on screen.
	const MARKER_REACH = 6;
	const visibleCities = $derived(pack.cities.filter(city => view.cities[city.id]!.revealed));
	// A string, so the fitted view is worked out again only when the set of revealed cities changes.
	const revealedKey = $derived(visibleCities.map(city => city.id).join());
	// The fitted view frames what has been explored, the recon boxes reaching out of it, and the stockpile while a
	// game is played. Before anything is explored, it frames every location.
	const showStockpile = $derived(view.stockpile !== null);
	const reach = (points: BoardPoint[], margin: number): BoardBounds => ({
		minX: Math.min(...points.map(point => point.x)) - margin,
		maxX: Math.max(...points.map(point => point.x)) + margin,
		minZ: Math.min(...points.map(point => point.z)) - margin,
		maxZ: Math.max(...points.map(point => point.z)) + margin,
	});
	const citiesBounds: BoardBounds = $derived.by(() => {
		const ids = revealedKey ? (revealedKey.split(',') as CityId[]) : pack.cities.map(city => city.id);
		return reach(
			ids.map(id => layout[id]!),
			MARKER_REACH,
		);
	});
	const explored: BoardBounds = $derived.by(() => {
		const corners = [...boxLayout.rects.values()].flatMap(rect => [
			{ x: rect.x - rect.width / 2, z: rect.z - rect.depth / 2 },
			{ x: rect.x + rect.width / 2, z: rect.z + rect.depth / 2 },
		]);
		const boxes = corners.length ? reach(corners, 1) : citiesBounds;
		const frame = {
			minX: Math.min(citiesBounds.minX, boxes.minX),
			maxX: Math.max(citiesBounds.maxX, boxes.maxX),
			minZ: Math.min(citiesBounds.minZ, boxes.minZ),
			maxZ: Math.max(citiesBounds.maxZ, boxes.maxZ),
		};
		if (!showStockpile) return frame;
		return {
			minX: Math.min(frame.minX, STOCKPILE.x - STOCKPILE_REACH.x),
			maxX: Math.max(frame.maxX, STOCKPILE.x + STOCKPILE_REACH.x),
			minZ: Math.min(frame.minZ, STOCKPILE.z - STOCKPILE_REACH.north),
			maxZ: Math.max(frame.maxZ, STOCKPILE.z + STOCKPILE_REACH.south),
		};
	});
	// Panels hugging a side push the view in from that side. Anything else, like the objectives along the top or
	// the dock's cards rising from the bottom, pushes it in from the top or bottom.
	const insets = $derived.by(() => {
		const width = Math.max(1, $size.width);
		const height = Math.max(1, $size.height);
		let left = 0;
		let right = 0;
		let firmLeft = 0;
		let firmRight = 0;
		let top = 0;
		let bottom = 0;
		for (const rect of covered) {
			if (rect.x < width * 0.25 && rect.x + rect.width < width / 2) {
				if (rect.firm) firmLeft = Math.max(firmLeft, rect.x + rect.width);
				else left = Math.max(left, rect.x + rect.width);
			} else if (rect.x + rect.width > width * 0.75 && rect.x > width / 2) {
				if (rect.firm) firmRight = Math.max(firmRight, width - rect.x);
				else right = Math.max(right, width - rect.x);
			} else if (rect.y + rect.height / 2 < height / 2) top = Math.max(top, rect.y + rect.height);
			else bottom = Math.max(bottom, height - rect.y);
		}
		// On a narrow stage, such as the replay's, panels may not squeeze the board below 70% of its width. The
		// seats sit in the corners, where the board is mostly open sea, but a firm panel is never slid under.
		const squeeze = Math.min(1, 0.3 / Math.max(0.001, (left + right) / width));
		return {
			left: Math.max(left * squeeze, firmLeft) / width,
			right: Math.max(right * squeeze, firmRight) / width,
			top: Math.min(0.2, top / height),
			bottom: Math.min(0.25, bottom / height),
		};
	});
	// `$size` subscribes to the store. Reading `size.current` would not rerun when the canvas is resized.
	const aspect = $derived($size.width / Math.max(1, $size.height));
	const fit = $derived(fitBoard(explored, aspect, FOV, DEFAULT_TILT, { bounds: explored, ...insets }));
	const whole = $derived(fitBoard(bounds, aspect, FOV));
	// The first view snaps into place. After that, a newly explored region or a reset glides the camera over.
	const glide = new Tween(1, { duration: 900, easing: cubicInOut });
	let path: { from: Vector3; to: Vector3; fromTarget: Vector3; toTarget: Vector3 } | null = null;
	$effect(() => {
		if (resetView !== lastReset) {
			lastReset = resetView;
			userMoved = false;
		}
		if (!camera || !controls || userMoved) return;
		const next = fit;
		untrack(() => {
			if (!path) {
				camera!.position.copy(next.position);
				controls!.target.copy(next.target);
				controls!.update();
				path = { from: next.position, to: next.position, fromTarget: next.target, toTarget: next.target };
				return;
			}
			// A drag leaves damping momentum in the controls, which would carry the glide past its mark. One update
			// without damping spends it before the glide takes over.
			controls!.enableDamping = false;
			controls!.update();
			controls!.enableDamping = true;
			path = {
				from: camera!.position.clone(),
				to: next.position,
				fromTarget: controls!.target.clone(),
				toTarget: next.target,
			};
			void glide.set(0, { duration: 0 }).then(() => glide.set(1));
		});
	});
	$effect(() => {
		const t = glide.current;
		if (!path || !camera || !controls || untrack(() => userMoved)) return;
		camera.position.lerpVectors(path.from, path.to, t);
		controls.target.lerpVectors(path.fromTarget, path.toTarget, t);
		controls.update();
		trackZoom();
		invalidate();
	});

	// Edges present at first render are part of the board. Anything that shows up later draws itself in.
	const routeKey = (route: { a: CityId; b: CityId; kind: string }) => `${route.kind}:${edgeKey(route.a, route.b)}`;
	const initialEdges = new Set(untrack(() => view.edges.map(routeKey)));

	// Names are printed at a fixed size on the chart, so their places depend only on which cities show.
	const anchors = $derived(
		fonts.ready
			? layoutLabels(
					visibleCities.map(city => ({
						id: city.id,
						width: nameWidth(view.cities[city.id]!.name, city.port, NAME_SIZE),
						at: layout[city.id]!,
					})),
				)
			: new Map<CityId, Placement>(),
	);
	const flagsByCity = $derived.by(() => {
		const map = new Map<CityId, NonNullable<BoardView['marks']>['flags']>();
		for (const flag of view.marks?.flags ?? []) map.set(flag.city, [...(map.get(flag.city) ?? []), flag]);
		return [...map];
	});
	// A box stays mounted after its route is taken, so it can fade out with the fog it pointed into.
	let printedBoxes = $state.raw<ReconBoxView[]>([]);
	$effect(() => {
		const known = new Map(untrack(() => printedBoxes).map(box => [box.route, box]));
		for (const box of view.recon) known.set(box.route, box);
		printedBoxes = [...known.values()];
	});
	const liveRoutes = $derived(new Set(view.recon.map(box => box.route)));
	// A string, like `revealedKey`, so boxes are placed again only when one comes or goes.
	const boxKey = $derived(view.recon.map(box => box.route).join());
	/** A box's size on screen in rem, a little generous for a status line that wraps. */
	const BOX_REM = { width: 12, height: 7.4 };
	const boxLayout = $derived.by(() => {
		void boxKey;
		void revealedKey;
		void anchors;
		void aspect;
		void showStockpile;
		return untrack(() => {
			// A box keeps one size on screen, so its footprint on the board follows the zoom of the fitted view.
			const zoom = fitBoard(citiesBounds, aspect, FOV, DEFAULT_TILT, { bounds: citiesBounds, ...insets });
			// The boxes widen the view a little, which makes them a little larger on the board than this.
			const plannedDistance = zoom.distance * 1.15;
			const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
			const unitsPerPixel = (2 * plannedDistance * Math.tan((FOV * Math.PI) / 360)) / Math.max(1, $size.height);
			const taken = visibleCities.flatMap(city => {
				const at = layout[city.id]!;
				const name = anchors.get(city.id);
				if (!name) return [at];
				const half = nameWidth(view.cities[city.id]!.name, city.port, NAME_SIZE) / 2;
				return [at, ...[-half, 0, half].map(dx => ({ x: at.x + name.x + dx, z: at.z + name.z }))];
			});
			if (showStockpile)
				for (const x of [-STOCKPILE_REACH.x, 0, STOCKPILE_REACH.x])
					for (const z of [-STOCKPILE_REACH.north, 0, STOCKPILE_REACH.south])
						taken.push({ x: STOCKPILE.x + x, z: STOCKPILE.z + z });
			const rects = placeReconBoxes(
				view.recon.map(box => ({ route: box.route, from: layout[box.city]!, toward: middleOf(box.reveals) })),
				taken,
				{ width: BOX_REM.width * rem * unitsPerPixel, depth: BOX_REM.height * rem * unitsPerPixel },
			);
			return { rects, plannedDistance };
		});
	});
	// A taken box fades out where it last stood.
	const lastRects = new Map<string, ReconRect>();
	$effect(() => {
		for (const [route, rect] of boxLayout.rects) lastRects.set(route, rect);
	});
	// Boxes were placed for the fitted view's zoom. Zoomed out past it, the map shrinks under them, so they shrink with
	// it and keep to the ground they were placed on. Zoomed in, they keep their size.
	let cameraDistance = $state(0);
	const trackZoom = () => {
		if (camera && controls) cameraDistance = camera.position.distanceTo(controls.target);
	};
	const boxScale = $derived(cameraDistance > 0 ? Math.min(1, boxLayout.plannedDistance / cameraDistance) : 1);
	const pawnSlots = $derived.by(() => {
		const perCity = new Map<CityId, number>();
		for (const pawn of view.pawns) perCity.set(pawn.city, (perCity.get(pawn.city) ?? 0) + 1);
		const placed = new Map<CityId, number>();
		return view.pawns.map(pawn => {
			const slot = placed.get(pawn.city) ?? 0;
			placed.set(pawn.city, slot + 1);
			return { pawn, slot, of: perCity.get(pawn.city)!, at: layout[pawn.city]! };
		});
	});

	// Supply cubes are pieces that travel: each one placed, taken or returned flies between the stockpile, the
	// cities and the pawns, and joins where it lands only when it lands.
	type Flight = { id: number; from: Holder; to: Holder; delay: number; fromIndex: number; toIndex: number };
	let flights = $state.raw<Flight[]>([]);
	let held: SupplySnapshot | null = null;
	let nextFlight = 1;
	const snapshot = $derived.by((): SupplySnapshot | null =>
		view.stockpile === null
			? null
			: {
					stockpile: view.stockpile,
					cities: Object.fromEntries(Object.entries(view.cities).map(([id, city]) => [id, city.supplies])),
					pawns: view.pawns.map(pawn => ({ id: pawn.id, city: pawn.city, carried: pawn.carried })),
				},
	);
	$effect(() => {
		const now = snapshot;
		untrack(() => {
			const before = held;
			held = now;
			if (!before || !now) return;
			const moves = supplyMoves(before, now);
			// A jump, such as a replay skipping ahead or a new game being dealt, is not a sequence anyone watched.
			if (moves.length > 60) return;
			let leaving = 0;
			let arriving = 0;
			flights = [
				...flights,
				...moves.map((move, index) => ({
					id: nextFlight++,
					...move,
					delay: Math.min(index, 40) * 28,
					fromIndex: move.from.kind === 'pile' ? before.stockpile - 1 - leaving++ : 0,
					toIndex: move.to.kind === 'pile' ? before.stockpile + arriving++ : 0,
				})),
			];
		});
	});
	const landing = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const flight of flights) {
			const key = flight.to.kind === 'city' ? flight.to.city : flight.to.kind;
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
		return counts;
	});
	function spot(holder: Holder, index: number) {
		if (holder.kind === 'pile') {
			const slot = PILE[Math.min(Math.max(0, index), PILE.length - 1)]!;
			return { x: STOCKPILE.x + slot.x, y: LAND_HEIGHT + slot.y, z: STOCKPILE.z + slot.z };
		}
		const at = layout[holder.city]!;
		// A city's cubes stand in a block east of its disc; a pawn holds its cubes at chest height.
		return holder.kind === 'city'
			? { x: at.x + CITY_RADIUS + 1.18, y: LAND_HEIGHT + 0.35, z: at.z - 0.42 }
			: { x: at.x, y: CITY_TOP + 1.8, z: at.z - 1.25 };
	}
</script>

<T.PerspectiveCamera makeDefault fov={FOV} near={1} far={900} bind:ref={camera}>
	<OrbitControls
		bind:ref={controls}
		enableDamping
		dampingFactor={0.12}
		minDistance={25}
		maxDistance={Math.max(whole.distance * 1.15, fit.distance)}
		minPolarAngle={0.05}
		maxPolarAngle={1.2}
		screenSpacePanning={false}
		zoomToCursor
		mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }}
		onstart={() => (dragging = true)}
		onend={() => (dragging = false)}
		onchange={() => {
			trackZoom();
			// A plain click on a city also starts a controls gesture. Only a gesture that moves the camera counts.
			if (dragging) userMoved = true;
		}}
	/>
</T.PerspectiveCamera>

<T.HemisphereLight args={['#fff4dc', '#3a2e20', 2.6]} />
<T.DirectionalLight
	position={[-60, 120, 50]}
	color="#fff1d6"
	intensity={2.9}
	castShadow
	shadow.mapSize={[4096, 4096]}
	shadow.camera.left={-120}
	shadow.camera.right={120}
	shadow.camera.top={80}
	shadow.camera.bottom={-80}
	shadow.camera.far={320}
	shadow.bias={-0.0004}
/>

<T.Mesh
	rotation.x={-Math.PI / 2}
	position={[boardCentre.x, 0, boardCentre.z]}
	receiveShadow
	onpointermove={event => onpointer?.({ x: event.point.x, z: event.point.z })}
>
	<T.PlaneGeometry args={[boardSize.width, boardSize.depth]} />
	<T is={sheetMaterial} />
</T.Mesh>

<T.Mesh geometry={landGeometry} receiveShadow castShadow>
	<T is={landMaterial} />
</T.Mesh>

<Fog
	{bounds}
	mask={fogMask}
	hidden={city => !view.cities[city]!.revealed}
	onpaint={() => {
		lineMask.needsUpdate = true;
		invalidate();
	}}
/>

{#each view.ghostEdges as route (`ghost:${routeKey(route)}`)}
	<RouteTube {route} ghost />
{/each}

{#each view.edges as route (routeKey(route))}
	<RouteTube {route} animate={!initialEdges.has(routeKey(route))} />
{/each}

{#each visibleCities as city (city.id)}
	<CityMarker
		{city}
		at={layout[city.id]!}
		state={view.cities[city.id]!}
		placement={anchors.get(city.id) ?? { x: 0, z: 3.4, leader: false }}
		lit={hoverCity === city.id}
		landing={landing.get(city.id) ?? 0}
		onselect={() => oncity?.(city.id)}
		onhint={(part, event) => onhint?.(city.id, part, event, anchors.get(city.id))}
	/>
{/each}

{#each printedBoxes as box (box.route)}
	<ReconBox
		{box}
		from={layout[box.city]!}
		at={boxLayout.rects.get(box.route) ?? lastRects.get(box.route) ?? layout[box.city]!}
		shown={liveRoutes.has(box.route)}
		scale={boxScale}
		onrecon={() => onrecon?.(box.route)}
	/>
{/each}

{#each pawnSlots as { pawn, slot, of, at } (pawn.id)}
	<Pawn {pawn} {slot} {of} {at} />
{/each}

{#if view.stockpile !== null}
	<Stockpile
		count={view.stockpile}
		shown={view.stockpile - (landing.get('pile') ?? 0)}
		lit={hoverStockpile}
		onhint={event => onstockpile?.(event)}
	/>
{/if}

{#each flights as flight (flight.id)}
	<FlyingCube
		from={spot(flight.from, flight.fromIndex)}
		to={spot(flight.to, flight.toIndex)}
		delay={flight.delay}
		onland={() => (flights = flights.filter(other => other.id !== flight.id))}
	/>
{/each}

{#each view.cursors as cursor (cursor.id)}
	<RemoteCursor {cursor} />
{/each}

{#each view.marks?.rings ?? [] as ring (`${ring.city}:${ring.color}`)}
	<Ring at={layout[ring.city]!} color={ring.color} />
{/each}

{#each view.marks?.trails ?? [] as trail (trail.id)}
	<Trail
		from={layout[trail.from]!}
		to={layout[trail.to]!}
		color={trail.color}
		travel={trail.travel}
		course={trail.course}
		fresh={trail.fresh}
	/>
{/each}

{#each flagsByCity as [city, flags] (city)}
	<Flags at={layout[city]!} {flags} name={anchors.get(city)} />
{/each}

{#each view.fx as fx (fx.id)}
	<Pulse at={layout[fx.city]!} kind={fx.kind} delay={fx.delay} />
{/each}
