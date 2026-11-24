<script lang="ts">
	import { edgeKey, groundCity, nearestGround, pack } from '@repo/game';
	import type { CityId } from '@repo/game';
	import { T, useThrelte } from '@threlte/core';
	import { interactivity, OrbitControls } from '@threlte/extras';
	import { onDestroy, untrack } from 'svelte';
	import { cubicInOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { MeshStandardMaterial, MOUSE, Plane, Raycaster, SRGBColorSpace, Texture, Vector2, Vector3 } from 'three';
	import type { PerspectiveCamera } from 'three';
	import type { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';
	import { sfxPiece } from '#lib/audio/sfx.ts';
	import { typing } from '#lib/keys.ts';
	import CityMarker from './CityMarker.svelte';
	import Drawings from './Drawings.svelte';
	import Flags from './Flags.svelte';
	import { FogMask } from './chart';
	import { loadChart } from './chartLoader';
	import { DEFAULT_TILT, fitBoard, focusBoard } from './fit';
	import { restWhenStill } from './frameLoop';
	import Fog from './Fog.svelte';
	import type { Part } from './hints';
	import { DISC_REACH, layoutLabels, layoutNotes, NAME_SIZE, WEST_ANGLES } from './labels';
	import type { Placement } from './labels';
	import { buildLandGeometry, mapToSheet } from './land';
	import { FRAME, LAND_HEIGHT } from './projection';
	import FlyingCube from './FlyingCube.svelte';
	import Shatter from './Shatter.svelte';
	import { pieceModels } from './models.svelte';
	import Pawn from './Pawn.svelte';
	import { fonts, nameWidth, noteSize } from './print.svelte';
	import type { BoardBounds, BoardPoint } from './projection';
	import MapPing from './MapPing.svelte';
	import Pulse from './Pulse.svelte';
	import MapNote, { NOTE } from './MapNote.svelte';
	import ReconBox from './ReconBox.svelte';
	import { placeReconBoxes } from './reconLayout';
	import type { ReconRect } from './reconLayout';
	import RemoteCursor from './RemoteCursor.svelte';
	import Ring from './Ring.svelte';
	import Skull from './Skull.svelte';
	import RouteTube from './RouteTube.svelte';
	import { reconciler } from '#lib/reconcile.ts';
	import { CITY_RADIUS, CITY_TOP } from './routes';
	import Stockpile from './Stockpile.svelte';
	import { CUBE, PILE, STOCKPILE, STOCKPILE_REACH, supplyMoves } from './stockpile';
	import type { Holder, SupplySnapshot } from './stockpile';
	import Trail from './Trail.svelte';
	import type { BoardView, Covered, CursorTool, Handover, ReconBoxView, ScreenSpot } from './types';
	import type { CameraPose } from '#lib/studio/scene.ts';

	type Props = {
		view: BoardView;
		oncity?: (city: CityId) => void;
		/** A click on a recon route's box. */
		onrecon?: (route: string) => void;
		onpointer?: (point: BoardPoint | null) => void;
		/** Active map drawing tool: pen (hold F) or eraser. Disables camera drag while active. */
		tool?: CursorTool | null;
		/** Local eraser ring preview shown on the board while eraser mode is active. */
		eraserAt?: { x: number; z: number; radius: number } | null;
		/** Bump to return the camera to the fitted view of everything explored. */
		resetView?: number;
		/** A pointer over part of a city, or off it when `event` is null, with where the city's name is printed. */
		onhint?: (city: CityId, part: Part, event: PointerEvent | null, name: Placement | undefined) => void;
		/** The city under the pointer, whose printed name lights up. */
		hoverCity?: CityId | null;
		/** A pointer over the stockpile, or off it when `event` is null. */
		onstockpile?: (event: PointerEvent | null) => void;
		hoverStockpile?: boolean;
		/** A click on a pawn that can be picked. */
		onpawn?: (id: string) => void;
		/** Screen rectangles, in pixels from the canvas corner, that HUD panels cover. The fitted view keeps cities out of them. */
		covered?: Covered[];
		/**
		 * A city to look at closely, landing at `x`, `y` (fractions of the canvas from its top left), in place of the
		 * fitted view. `glide` is how long the camera takes to get there, in milliseconds. `zoom` sets the distance as a
		 * share of the whole board's view, which holds still while panels come and go, in place of a share of the fitted one.
		 */
		focus?: { city: CityId; x: number; y: number; glide?: number; zoom?: number } | null;
		/** Flies a supply cube that leaves or joins a character between its seat and the board, over the screen. */
		handover?: (flight: Handover) => Promise<void>;
	};

	let {
		view,
		oncity,
		onpointer,
		tool = null,
		eraserAt = null,
		onhint,
		hoverCity = null,
		onrecon,
		onstockpile,
		hoverStockpile = false,
		onpawn,
		resetView = 0,
		covered = [],
		focus = null,
		handover,
	}: Props = $props();

	onDestroy(restWhenStill(useThrelte().renderer));
	interactivity();

	const FOV = 30;
	const middleOf = (cities: CityId[]) =>
		cities.length
			? {
					x: cities.reduce((sum, city) => sum + pack.positions[city]!.x, 0) / cities.length,
					z: cities.reduce((sum, city) => sum + pack.positions[city]!.z, 0) / cities.length,
				}
			: null;
	const { size, dpr, renderer, invalidate, scene: stage, camera: lens } = useThrelte();
	// The board keeps no drawing buffer, so a presented frame reads blank. Captures (Feedback, the studio) read the canvas
	// with one synchronous toDataURL, so drawing the frame again inside that call costs a frame per capture, not always.
	const readCanvas = renderer.domElement.toDataURL.bind(renderer.domElement);
	renderer.domElement.toDataURL = (type?: string, quality?: number) => {
		renderer.render(stage, lens.current);
		return readCanvas(type, quality);
	};
	// The canvas itself asks for a frame with the scheduler's own `invalidate`, which cannot wake a resting loop.
	$effect(() => {
		void $size;
		void $dpr;
		invalidate();
	});
	$effect(() => {
		void pieceModels.hollow;
		void pieceModels.tower;
		void pieceModels.station;
		invalidate();
	});
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
	let sheets = $state.raw<{ known: Texture } | null>(null);
	loadChart(bounds).then(
		images => {
			sheets = { known: texture(images.known) };
			invalidate();
		},
		error => console.error(error),
	);

	const fogMask = new FogMask(bounds);

	// The materials stay put and take the chart when it lands; swapping material objects under a mesh loses them.
	const sheetMaterial = new MeshStandardMaterial({ color: BLANK, alphaTest: 0.5, roughness: 0.92 });
	const landMaterial = new MeshStandardMaterial({ color: BLANK, roughness: 0.92 });
	$effect(() => {
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
	const MARKER_REACH = 3.5;
	// A string, so the cities shown, their names' places and the fitted view are worked out again only when the set
	// of revealed cities changes, and not each time something happens in one of them.
	const revealedKey = $derived(
		pack.cities
			.filter(city => view.cities[city.id]!.revealed)
			.map(city => city.id)
			.join(),
	);
	const visibleCities = $derived.by(() => {
		const revealed = new Set(revealedKey.split(','));
		return pack.cities.filter(city => revealed.has(city.id));
	});
	// The fitted view frames only what has been revealed (and the stockpile while a game is played). Before anything
	// is explored, it frames every location.
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
		if (!showStockpile) return citiesBounds;
		return {
			minX: Math.min(citiesBounds.minX, STOCKPILE.x - STOCKPILE_REACH.x),
			maxX: Math.max(citiesBounds.maxX, STOCKPILE.x + STOCKPILE_REACH.x),
			minZ: Math.min(citiesBounds.minZ, STOCKPILE.z - STOCKPILE_REACH.north),
			maxZ: Math.max(citiesBounds.maxZ, STOCKPILE.z + STOCKPILE_REACH.south),
		};
	});
	// Keep light breathing room for the top objectives strip and bottom hand while letting the revealed map fill the
	// screen; corner seats and the mid-side Actions panel float over the edges rather than shrinking the whole board.
	const sameInsets = reconciler<{ left: number; right: number; top: number; bottom: number }>();
	const insets = $derived.by(() => {
		const width = Math.max(1, $size.width);
		const height = Math.max(1, $size.height);
		let top = 0;
		let bottom = 0;
		for (const rect of covered) {
			if (rect.firm) continue;
			if (rect.x < width * 0.25 && rect.x + rect.width < width / 2) continue;
			if (rect.x + rect.width > width * 0.75 && rect.x > width / 2) continue;
			if (rect.y + rect.height / 2 < height / 2) top = Math.max(top, rect.y + rect.height);
			else bottom = Math.max(bottom, height - rect.y);
		}
		return sameInsets({
			left: 0.02,
			right: 0.02,
			top: Math.min(0.08, top / height),
			bottom: Math.min(0.11, bottom / height),
		});
	});
	// `$size` subscribes to the store. Reading `size.current` would not rerun when the canvas is resized.
	const aspect = $derived($size.width / Math.max(1, $size.height));
	const fit = $derived(fitBoard(explored, aspect, FOV, DEFAULT_TILT, { bounds: explored, ...insets }));
	const whole = $derived(fitBoard(bounds, aspect, FOV));
	const FOCUS_ZOOM = 0.6;
	const aim = $derived(
		focus
			? focusBoard(
					layout[focus.city]!,
					focus,
					aspect,
					FOV,
					focus.zoom ? whole.distance * focus.zoom : fit.distance * FOCUS_ZOOM,
				)
			: fit,
	);
	let lastFocus: CityId | null = null;
	// The first view snaps into place. After that, a newly explored region or a reset glides the camera over.
	const GLIDE = 900;
	const glide = new Tween(1, { duration: GLIDE, easing: cubicInOut });
	let path: { from: Vector3; to: Vector3; fromTarget: Vector3; toTarget: Vector3 } | null = null;
	$effect(() => {
		if (resetView !== lastReset) {
			lastReset = resetView;
			userMoved = false;
		}
		// Asking to look at a city, or to stop, takes the camera back from a drag, as a reset does.
		const focused = focus?.city ?? null;
		if (focused !== lastFocus) {
			lastFocus = focused;
			userMoved = false;
		}
		if (!camera || !controls || userMoved) return;
		const next = aim;
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
			const duration = focus?.glide ?? GLIDE;
			void glide.set(0, { duration: 0 }).then(() => glide.set(1, { duration }));
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

	// WASD and Arrow keys pan along the board plane relative to camera facing. The loop runs only while a key is held
	// so the board rests at 0 frames when idle.
	const PAN_KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
		w: 'up',
		s: 'down',
		a: 'left',
		d: 'right',
		arrowup: 'up',
		arrowdown: 'down',
		arrowleft: 'left',
		arrowright: 'right',
	};
	const panHeld = new Set<'up' | 'down' | 'left' | 'right'>();
	const panForward = new Vector3();
	const panRight = new Vector3();
	const panUp = new Vector3(0, 1, 0);
	const panMove = new Vector3();
	let panFrame = 0;
	let panLast = 0;

	function stopPan() {
		panHeld.clear();
		cancelAnimationFrame(panFrame);
		panFrame = 0;
		panLast = 0;
	}

	function stepPan(now: number) {
		panFrame = 0;
		if (!panHeld.size) {
			panLast = 0;
			return;
		}
		const dt = panLast ? Math.min(0.05, (now - panLast) / 1000) : 1 / 60;
		panLast = now;
		if (camera && controls) {
			const dx = (panHeld.has('right') ? 1 : 0) - (panHeld.has('left') ? 1 : 0);
			const dz = (panHeld.has('up') ? 1 : 0) - (panHeld.has('down') ? 1 : 0);
			if (dx || dz) {
				panForward.subVectors(controls.target, camera.position).setY(0);
				if (panForward.lengthSq() < 1e-6) panForward.set(0, 0, -1);
				else panForward.normalize();
				panRight.crossVectors(panForward, panUp).normalize();
				panMove.set(0, 0, 0).addScaledVector(panRight, dx).addScaledVector(panForward, dz).normalize();
				const distance = camera.position.distanceTo(controls.target);
				const step = distance * 0.85 * dt;
				const nextX = Math.max(bounds.minX, Math.min(bounds.maxX, controls.target.x + panMove.x * step));
				const nextZ = Math.max(bounds.minZ, Math.min(bounds.maxZ, controls.target.z + panMove.z * step));
				const shiftX = nextX - controls.target.x;
				const shiftZ = nextZ - controls.target.z;
				if (shiftX || shiftZ) {
					userMoved = true;
					controls.target.x += shiftX;
					controls.target.z += shiftZ;
					camera.position.x += shiftX;
					camera.position.z += shiftZ;
					controls.update();
					trackZoom();
					invalidate();
				}
			}
		}
		panFrame = requestAnimationFrame(stepPan);
	}

	$effect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.metaKey || event.ctrlKey || event.altKey || typing(event)) return;
			const dir = PAN_KEYS[event.key.toLowerCase()];
			if (!dir) return;
			if (document.querySelector('[aria-modal="true"], .tabletop-unboxing')) return;
			if (event.key.startsWith('Arrow')) event.preventDefault();
			panHeld.add(dir);
			if (!panFrame) {
				panLast = 0;
				panFrame = requestAnimationFrame(stepPan);
			}
		};
		const onKeyUp = (event: KeyboardEvent) => {
			const dir = PAN_KEYS[event.key.toLowerCase()];
			if (!dir) return;
			panHeld.delete(dir);
			if (!panHeld.size) stopPan();
		};
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		window.addEventListener('blur', stopPan);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			window.removeEventListener('blur', stopPan);
			stopPan();
		};
	});

	/** Where the camera is now, mid-glide or at rest. */
	export function where(): CameraPose | null {
		return camera && controls ? { position: camera.position.toArray(), target: controls.target.toArray() } : null;
	}
	/** Where a drag or zoom left the camera, or null while it keeps the fitted view. */
	export function pose(): CameraPose | null {
		return userMoved ? where() : null;
	}

	const raycaster = new Raycaster();
	const ndc = new Vector2();
	const drawPlane = new Plane(new Vector3(0, 1, 0), -(CITY_TOP + 0.45));
	const hitPoint = new Vector3();

	/** Projects screen client coordinates directly onto the drawing plane, unaffected by tall pieces or HTML overlays. */
	export function boardPoint(clientX: number, clientY: number): BoardPoint | null {
		if (!camera || !renderer) return null;
		const rect = renderer.domElement.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return null;
		ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
		raycaster.setFromCamera(ndc, camera);
		if (!raycaster.ray.intersectPlane(drawPlane, hitPoint)) return null;
		if (hitPoint.x < bounds.minX || hitPoint.x > bounds.maxX || hitPoint.z < bounds.minZ || hitPoint.z > bounds.maxZ)
			return null;
		return { x: hitPoint.x, z: hitPoint.z };
	}

	/** Board-unit eraser radius scaled gently to the current zoom distance. */
	export function eraserRadius(): number {
		const dist = cameraDistance > 0 ? cameraDistance : fit.distance;
		return Math.max(1.4, Math.min(3.8, dist * 0.02));
	}

	$effect(() => {
		void eraserAt;
		invalidate();
	});
	// A pose asked for before the camera exists waits for it.
	let wanted = $state.raw<{ pose: CameraPose | null } | null>(null);
	/** Puts the camera where a drag left it, or back on the fitted view, at once. */
	export function setPose(next: CameraPose | null) {
		wanted = { pose: next };
	}
	$effect(() => {
		if (!wanted || !camera || !controls) return;
		const next = wanted.pose;
		untrack(() => {
			wanted = null;
			userMoved = next !== null;
			const position = next ? camera!.position.clone().fromArray(next.position) : aim.position;
			const target = next ? controls!.target.clone().fromArray(next.target) : aim.target;
			camera!.position.copy(position);
			controls!.target.copy(target);
			path = { from: position, to: position, fromTarget: target, toTarget: target };
			controls!.enableDamping = false;
			controls!.update();
			controls!.enableDamping = true;
			trackZoom();
			invalidate();
		});
	});

	// Edges present at first render are part of the board. Anything that shows up later draws itself in.
	const routeKey = (route: { a: CityId; b: CityId; kind: string }) => `${route.kind}:${edgeKey(route.a, route.b)}`;
	const initialEdges = new Set(untrack(() => view.edges.map(routeKey)));

	// Names are printed at a fixed size on the chart, so their places depend only on which cities show and what
	// they are called. Placing them is a search over every pair of cities, so it runs only when one of those changes.
	const shownNames = $derived(visibleCities.map(city => view.cities[city.id]!.name).join('\n'));
	const anchors = $derived.by(() => {
		if (!fonts.ready) return new Map<CityId, Placement>();
		const names = shownNames.split('\n');
		return layoutLabels(
			visibleCities.map((city, index) => ({
				id: city.id,
				width: nameWidth(names[index]!, city.port, NAME_SIZE),
				at: layout[city.id]!,
			})),
		);
	});
	const UNPLACED: Placement = { x: 0, z: 3.4, leader: false };
	// Notes keep clear of every disc and printed name, so they are placed after the names.
	// Like the names, notes are placed again only when what shows, its names or the notes change, never as pieces move.
	const noteSpots = $derived.by(() => {
		if (!fonts.ready) return new Map<string, BoardPoint>();
		const names = shownNames.split('\n');
		const taken = visibleCities.flatMap((city, index) => {
			const at = layout[city.id]!;
			const disc = { x: at.x, z: at.z, width: DISC_REACH * 2, depth: DISC_REACH * 2 };
			const name = anchors.get(city.id);
			if (!name) return [disc];
			const width = nameWidth(names[index]!, city.port, NAME_SIZE);
			return [disc, { x: at.x + name.x, z: at.z + name.z, width, depth: NAME_SIZE * 1.1 }];
		});
		// Notes keep off the red lines they would hide, and off the stockpile's berth.
		for (const line of pack.redLines) for (const [x, z] of line) taken.push({ x, z, width: 0.6, depth: 0.6 });
		if (showStockpile)
			taken.push({
				x: STOCKPILE.x,
				z: STOCKPILE.z + (STOCKPILE_REACH.south - STOCKPILE_REACH.north) / 2,
				width: STOCKPILE_REACH.x * 2,
				depth: STOCKPILE_REACH.north + STOCKPILE_REACH.south,
			});
		const shown = new Set(visibleCities.map(city => city.id));
		const revealed = (point: BoardPoint) => {
			const city = groundCity(nearestGround(point));
			return city !== null && shown.has(city);
		};
		// The fog billows past the ground it hides, so ground counts as in sight only this far inside it.
		const SIGHT = 2.5;
		const inSight = (point: BoardPoint) =>
			point.x > FRAME.minX &&
			point.x < FRAME.maxX &&
			point.z > FRAME.minZ &&
			point.z < FRAME.maxZ &&
			[
				[0, 0],
				[SIGHT, 0],
				[-SIGHT, 0],
				[0, SIGHT],
				[0, -SIGHT],
			].every(([dx, dz]) => revealed({ x: point.x + dx!, z: point.z + dz! }));
		const onChart = (point: BoardPoint) =>
			point.x > FRAME.minX && point.x < FRAME.maxX && point.z > FRAME.minZ && point.z < FRAME.maxZ;
		/**
		 * Where a line's note stands: in the first stretch of it players can see, counting from where it is printed to
		 * start, at the middle of the part well clear of the fog, or of the whole stretch when none is.
		 */
		const lineAnchor = (line: BoardPoint[]) => {
			const first: BoardPoint[] = [];
			for (const point of line) {
				if (onChart(point) && revealed(point)) first.push(point);
				else if (first.length) break;
			}
			const clear = first.filter(inSight);
			const pick = clear.length ? clear : first;
			return pick[Math.floor(pick.length / 2)];
		};
		return layoutNotes(
			view.notes.flatMap(note => {
				const size = noteSize(note.text, NOTE.size, NOTE.width);
				if (!note.line) return [{ id: note.id, at: layout[note.city]!, ...size, hidden: !shown.has(note.city) }];
				const at = lineAnchor(note.line);
				return at ? [{ id: note.id, at, ...size, hidden: false, seen: true, angles: WEST_ANGLES }] : [];
			}),
			taken,
			inSight,
		);
	});
	const flagsByCity = $derived.by(() => {
		const map = new Map<CityId, NonNullable<BoardView['marks']>['flags']>();
		for (const flag of view.marks?.flags ?? []) map.set(flag.city, [...(map.get(flag.city) ?? []), flag]);
		return [...map];
	});
	// A box stays mounted after its route is taken, so it can fade out with the fog it pointed into.
	let printedBoxes = $state.raw<ReconBoxView[]>([]);
	const aimingCities = $derived(Object.values(view.cities).some(city => city.highlight === 'target'));
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
		void noteSpots;
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
			for (const note of view.notes) {
				const at = noteSpots.get(note.id);
				if (!at) continue;
				const { width, depth } = noteSize(note.text, NOTE.size, NOTE.width);
				for (const x of [-width / 2, 0, width / 2])
					for (const z of [-depth / 2, 0, depth / 2]) taken.push({ x: at.x + x, z: at.z + z });
			}
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
	type Flight = {
		id: number;
		from: Holder;
		to: Holder;
		delay: number;
		fromIndex: number;
		toIndex: number;
		/** Struck off the board: a cube a city lost goes back to the stockpile. */
		lost: boolean;
		/** Its place among the cubes of this batch that make the same sound, so a run of them is heard as a scale. */
		run: number;
		/** One of a deal: its run is its place in its city's share. */
		dealt: boolean;
	};
	const DEAL_FROM = 12;
	const DEAL_CITY_GAP = 230;
	/** However many cities share in it, the deal crosses the board in about this long. */
	const DEAL_MS = 2600;
	const DEAL_CUBE_GAP = 85;
	type Loss = { id: number; city: CityId; count: number; delay: number };
	let flights = $state.raw<Flight[]>([]);
	let losses = $state.raw<Loss[]>([]);
	// Struck cubes go one at a time, slowly enough for each to be seen and heard.
	const LOSS_GAP = 110;
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
			let handed = 0;
			let struck = 0;
			const struckAt = new Map<CityId, Loss>();
			// Many cubes leaving the stockpile at once is a deal, such as the one that opens a game: it crosses the board
			// from west to east, a city at a time, so each city is seen and heard taking its share.
			const toCities = moves.flatMap(move =>
				move.from.kind === 'pile' && move.to.kind === 'city' ? [move.to.city] : [],
			);
			const dealOrder =
				toCities.length >= DEAL_FROM
					? new Map(
							[...new Set(toCities)]
								.toSorted((a, b) => layout[a]!.x - layout[b]!.x)
								.map((city, index) => [city, index]),
						)
					: null;
			const dealtTo = new Map<CityId, number>();
			flights = [
				...flights,
				...moves.map((move): Flight => {
					const lost = move.from.kind === 'city' && move.to.kind === 'pile';
					const dealt = dealOrder && move.from.kind === 'pile' && move.to.kind === 'city' ? move.to.city : null;
					const share = dealt ? (dealtTo.get(dealt) ?? 0) : 0;
					if (dealt) dealtTo.set(dealt, share + 1);
					const delay = lost
						? struck * LOSS_GAP
						: dealt
							? dealOrder!.get(dealt)! * Math.min(DEAL_CITY_GAP, DEAL_MS / dealOrder!.size) + share * DEAL_CUBE_GAP
							: Math.min(handed, 40) * 28;
					if (move.from.kind === 'city' && lost) {
						const loss = struckAt.get(move.from.city) ?? { id: nextFlight++, city: move.from.city, count: 0, delay };
						loss.count++;
						struckAt.set(move.from.city, loss);
					}
					return {
						id: nextFlight++,
						...move,
						delay,
						fromIndex: move.from.kind === 'pile' ? before.stockpile - 1 - leaving++ : 0,
						toIndex: move.to.kind === 'pile' ? before.stockpile + arriving++ : 0,
						lost,
						run: lost ? struck++ : dealt ? (handed++, share) : handed++,
						dealt: dealt !== null,
					};
				}),
			];
			if (struckAt.size) losses = [...losses, ...struckAt.values()];
			for (const flight of flights) if (handedOver(flight) && !sentOver.has(flight.id)) sendOver(flight);
		});
	});
	// A cube a character gives or takes flies between the board and the character's seat, over the screen, not to
	// the pawn: it stays in the flights here only so where it lands on the board waits for it.
	const handedOver = (flight: Flight) =>
		Boolean(handover) && (flight.from.kind === 'pawn' || flight.to.kind === 'pawn');
	const sentOver = new Set<number>();
	const projected = new Vector3();
	function onScreen(point: { x: number; y: number; z: number }): ScreenSpot | null {
		if (!camera) return null;
		const box = renderer.domElement.getBoundingClientRect();
		const toScreen = () => ({
			x: box.left + ((projected.x + 1) / 2) * box.width,
			y: box.top + ((1 - projected.y) / 2) * box.height,
		});
		projected.set(point.x, point.y, point.z).project(camera);
		const at = toScreen();
		projected.set(point.x + CUBE, point.y, point.z).project(camera);
		return { ...at, size: Math.abs(toScreen().x - at.x) };
	}
	function sendOver(flight: Flight) {
		sentOver.add(flight.id);
		const end = (holder: Holder, index: number) => ({
			seat: holder.kind === 'pawn' ? holder.pawn : undefined,
			at: () => onScreen(spot(holder, index)),
		});
		void handover!({
			from: end(flight.from, flight.fromIndex),
			to: end(flight.to, flight.toIndex),
			delay: flight.delay,
			onlaunch: () => launched(flight),
			onarrive: () => {
				arrived(flight);
				sentOver.delete(flight.id);
				flights = flights.filter(other => other.id !== flight.id);
			},
		});
	}
	const landing = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const flight of flights) {
			const key = flight.to.kind === 'city' ? flight.to.city : flight.to.kind;
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
		return counts;
	});
	// A cube is heard as it leaves and as it lands, so the sound is always where the piece is.
	function launched(flight: Flight) {
		if (flight.lost) sfxPiece('supplyLost', flight.run);
		else if (flight.to.kind === 'pawn' && flight.from.kind !== 'pawn') sfxPiece('supplyLift', flight.run);
	}
	// Cubes land in the order of their distances, not of their launch, so a run of landings counts itself as it lands.
	let landed = { run: 0, at: 0 };
	function arrived(flight: Flight) {
		const now = performance.now();
		landed = { run: now - landed.at > 700 ? 0 : landed.run + 1, at: now };
		if (flight.to.kind === 'city') sfxPiece('supplyPlace', flight.dealt ? flight.run : landed.run);
		else if (flight.to.kind === 'pile') sfxPiece('supplyPile');
		else if (flight.from.kind === 'pawn') sfxPiece('supplyPass');
	}
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
		enabled={tool === null}
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

<Fog {bounds} mask={fogMask} hidden={city => !view.cities[city]!.revealed} onpaint={() => invalidate()} />

{#each view.ghostEdges as route (`ghost:${routeKey(route)}`)}
	<RouteTube {route} ghost />
{/each}

{#each view.edges as route (routeKey(route))}
	<RouteTube {route} animate={!initialEdges.has(routeKey(route))} />
{/each}

{#each visibleCities as city (city.id)}
	<!-- Each is its own value, so a city whose state and place did not change is not handed anything new. -->
	{@const cityState = view.cities[city.id]!}
	{@const placement = anchors.get(city.id) ?? UNPLACED}
	<CityMarker
		{city}
		at={layout[city.id]!}
		state={cityState}
		{placement}
		lit={hoverCity === city.id}
		landing={landing.get(city.id) ?? 0}
		onselect={() => oncity?.(city.id)}
		onhint={(part, event) => onhint?.(city.id, part, event, anchors.get(city.id))}
	/>
{/each}

{#each view.notes as note (note.id)}
	{@const at = noteSpots.get(note.id)}
	{#if at}<MapNote text={note.text} {at} />{/if}
{/each}

{#each printedBoxes as box (box.route)}
	<ReconBox
		{box}
		from={layout[box.city]!}
		at={boxLayout.rects.get(box.route) ?? lastRects.get(box.route) ?? layout[box.city]!}
		shown={liveRoutes.has(box.route)}
		scale={boxScale}
		passive={aimingCities || tool !== null}
		onrecon={() => onrecon?.(box.route)}
	/>
{/each}

{#each pawnSlots as { pawn, slot, of, at } (pawn.id)}
	<Pawn {pawn} {slot} {of} {at} onpick={() => onpawn?.(pawn.id)} />
{/each}

{#if view.stockpile !== null}
	<Stockpile
		count={view.stockpile}
		shown={view.stockpile - (landing.get('pile') ?? 0)}
		lit={hoverStockpile}
		onhint={event => onstockpile?.(event)}
	/>
{/if}

{#each flights.filter(flight => !handedOver(flight)) as flight (flight.id)}
	<FlyingCube
		from={spot(flight.from, flight.fromIndex)}
		to={spot(flight.to, flight.toIndex)}
		delay={flight.delay}
		lost={flight.lost}
		onlaunch={() => launched(flight)}
		onarrive={() => arrived(flight)}
		onland={() => (flights = flights.filter(other => other.id !== flight.id))}
	/>
{/each}

{#each losses as loss (loss.id)}
	<Shatter
		at={spot({ kind: 'city', city: loss.city }, 0)}
		count={loss.count}
		delay={loss.delay}
		ondone={() => (losses = losses.filter(other => other.id !== loss.id))}
	/>
{/each}

{#each view.cursors as cursor (cursor.id)}
	<RemoteCursor {cursor} />
{/each}

{#if view.drawings?.length}
	<Drawings drawings={view.drawings} />
{/if}

{#each view.pings ?? [] as ping (ping.id)}
	<MapPing {ping} />
{/each}

{#if eraserAt}
	<T.Group position={[eraserAt.x, CITY_TOP + 0.5, eraserAt.z]}>
		<T.Mesh rotation.x={-Math.PI / 2} renderOrder={12}>
			<T.CircleGeometry args={[eraserAt.radius, 36]} />
			<T.MeshBasicMaterial color="#1a140e" transparent opacity={0.18} depthWrite={false} />
		</T.Mesh>
		<T.Mesh rotation.x={-Math.PI / 2} position.y={0.01} renderOrder={13}>
			<T.RingGeometry args={[Math.max(0.2, eraserAt.radius - 0.16), eraserAt.radius, 36]} />
			<T.MeshBasicMaterial color="#f5ecd8" transparent opacity={0.9} depthWrite={false} />
		</T.Mesh>
	</T.Group>
{/if}

{#each view.marks?.rings ?? [] as ring (`${ring.city}:${ring.color}`)}
	<Ring at={layout[ring.city]!} color={ring.color} faint={ring.faint} />
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

{#if view.skull}
	{#key view.skull.key}
		<Skull at={layout[view.skull.city]!} slot={view.skull.at} />
	{/key}
{/if}

{#each view.fx as fx (fx.id)}
	<Pulse at={layout[fx.city]!} kind={fx.kind} delay={fx.delay} />
{/each}
