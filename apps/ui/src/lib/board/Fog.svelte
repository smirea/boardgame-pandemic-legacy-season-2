<script lang="ts" module>
	const VERTEX = /* glsl */ `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}
	`;

	/*
	 * Smoke over unexplored ground, in two layers: a dense bank on the chart and thin wisps drifting above
	 * it, so the fog has depth as the camera tilts. The outline comes from a blurred copy of the exact
	 * mask, pushed about by domain-warped noise: the noise bends the field's contour into billows, and the
	 * contour sits just outside the true boundary, so unexplored ground is always fully hidden while the
	 * edge curls over charted ground. A location being explored shrinks its field, and the billows erode
	 * with it.
	 */
	const FRAGMENT = /* glsl */ `
		uniform sampler2D uMask;
		uniform sampler2D uField;
		uniform float uTime;
		uniform float uAspect;
		uniform float uLayer;
		uniform vec2 uTexel;
		uniform vec4 uFrame;
		varying vec2 vUv;

		// 1 inside the chart's frame, fading to 0 by the edge of the paper: smoke never thins over the map itself.
		float onSheet() {
			vec2 outside = max( max( uFrame.xy - vUv, vUv - uFrame.zw ), 0.0 );
			vec2 room = max( uFrame.xy, 1.0 - uFrame.zw );
			return 1.0 - smoothstep( 0.0, 1.0, max( outside.x / room.x, outside.y / room.y ) );
		}

		float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
		float noise( vec2 p ) {
			vec2 i = floor( p );
			vec2 f = fract( p );
			vec2 u = f * f * ( 3.0 - 2.0 * f );
			return mix( mix( hash( i ), hash( i + vec2( 1.0, 0.0 ) ), u.x ),
				mix( hash( i + vec2( 0.0, 1.0 ) ), hash( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
		}
		// Each octave is rotated, which hides the grid that value noise otherwise shows.
		const mat2 turn = mat2( 0.8, 0.6, -0.6, 0.8 );
		float fbm( vec2 p ) {
			float value = 0.0;
			float amplitude = 0.5;
			for ( int i = 0; i < 4; i++ ) {
				value += amplitude * noise( p );
				p = turn * p * 2.03 + vec2( 17.3, 9.1 );
				amplitude *= 0.5;
			}
			return value;
		}

		void main() {
			float field = texture2D( uField, vUv ).g;
			if ( field < 0.01 ) discard;
			float t = uTime;
			vec2 q = vUv * vec2( uAspect, 1.0 ) * ( uLayer > 0.5 ? 4.2 : 2.6 );

			// Domain warping: noise displaces the coordinates of more noise, which turns fbm's even grain into folds and curls.
			vec2 w1 = vec2( fbm( q + vec2( 0.0, t * 0.021 ) ), fbm( q + vec2( 5.2, 1.3 ) - t * 0.017 ) );
			vec2 w2 = vec2( fbm( q + 1.8 * w1 + vec2( 1.7, 9.2 ) + t * 0.028 ), fbm( q + 1.8 * w1 + vec2( 8.3, 2.8 ) - t * 0.023 ) );
			float n = fbm( q + 1.5 * w2 + vec2( t * 0.012, 0.0 ) );

			// The field is read where the warp points, so the outline swirls with the smoke inside it.
			float shaped = texture2D( uField, vUv + ( w2 - 0.5 ) * uTexel * 3.0 ).g;

			if ( uLayer > 0.5 ) {
				float wisp = smoothstep( 0.48, 0.82, n ) * smoothstep( 0.2, 0.55, shaped ) * onSheet();
				gl_FragColor = vec4( vec3( 0.9, 0.88, 0.84 ), wisp * 0.4 );
				return;
			}

			// Larger, slower billows set the outline; the fine noise only roughens it.
			float swell = fbm( q * 0.45 + vec2( -t * 0.01, t * 0.006 ) );
			float contour = shaped + ( n - 0.5 ) * 0.22 + ( swell - 0.5 ) * 0.3;
			float cloud = smoothstep( 0.17, 0.32, contour );
			// The exact mask under it all: whatever the noise does, unexplored ground never shows through.
			cloud = max( cloud, texture2D( uMask, vUv ).g );

			// Light from the upper left: a fold brighter than the smoke just toward the light faces it.
			float toward = fbm( q + 1.5 * w2 + vec2( t * 0.012, 0.0 ) + vec2( -0.08, -0.11 ) );
			float light = clamp( 0.5 + ( n - toward ) * 2.2, 0.0, 1.0 );
			vec3 shadowed = vec3( 0.47, 0.47, 0.49 );
			vec3 lit = vec3( 0.87, 0.85, 0.81 );
			vec3 color = mix( shadowed, lit, smoothstep( 0.05, 0.95, 0.15 + n * 0.75 + ( light - 0.5 ) * 0.45 ) );
			// Deep in the bank the smoke is thicker and darker; at its edge the thin billows catch the light.
			color *= mix( 1.0, 0.82, smoothstep( 0.55, 1.0, field ) );
			float rim = smoothstep( 0.17, 0.26, contour ) * ( 1.0 - smoothstep( 0.26, 0.46, contour ) );
			color = mix( color, vec3( 0.95, 0.93, 0.88 ), rim * 0.35 );

			// A soft shadow falls on the chart just beyond the bank, down and away from the light.
			float caster = texture2D( uField, vUv + vec2( -0.006, 0.01 ) ).g;
			float shade = ( 1.0 - cloud ) * smoothstep( 0.05, 0.45, caster ) * 0.3;

			gl_FragColor = vec4( mix( vec3( 0.1, 0.08, 0.06 ), color, cloud ), max( cloud, shade ) * onSheet() );
		}
	`;
</script>

<script lang="ts">
	import { pack } from '@repo/game';
	import type { CityId } from '@repo/game';
	import { T, useTask } from '@threlte/core';
	import { untrack } from 'svelte';
	import { cubicInOut } from 'svelte/easing';
	import { CanvasTexture, LinearFilter, ShaderMaterial, Vector2, Vector4 } from 'three';
	import type { FogMask } from './chart';
	import { FRAME, LAND_HEIGHT } from './projection';
	import type { BoardBounds } from './projection';

	type Props = {
		bounds: BoardBounds;
		mask: FogMask;
		hidden: (city: CityId) => boolean;
		/** After each repaint of the mask, so whatever else reads it can upload it. */
		onpaint?: () => void;
	};

	let { bounds, mask: initialMask, hidden, onpaint }: Props = $props();

	const REVEAL_SECONDS = 2.6;
	const area = untrack(() => bounds);
	const mask = untrack(() => initialMask);
	const texture = (canvas: OffscreenCanvas) => {
		const map = new CanvasTexture(canvas);
		map.minFilter = LinearFilter;
		map.generateMipmaps = false;
		return map;
	};
	const maskTexture = texture(mask.canvas);
	const fieldTexture = texture(mask.field);

	const uniforms = {
		uMask: { value: maskTexture },
		uField: { value: fieldTexture },
		uTime: { value: 0 },
		uAspect: { value: (area.maxX - area.minX) / (area.maxZ - area.minZ) },
		uFrame: {
			value: new Vector4(
				(FRAME.minX - area.minX) / (area.maxX - area.minX),
				1 - (FRAME.maxZ - area.minZ) / (area.maxZ - area.minZ),
				(FRAME.maxX - area.minX) / (area.maxX - area.minX),
				1 - (FRAME.minZ - area.minZ) / (area.maxZ - area.minZ),
			),
		},
		uTexel: { value: new Vector2(1 / mask.canvas.width, 1 / mask.canvas.height).multiplyScalar(mask.blur * 4) },
	};
	const layer = (index: number) =>
		new ShaderMaterial({
			vertexShader: VERTEX,
			fragmentShader: FRAGMENT,
			uniforms: { ...uniforms, uLayer: { value: index } },
			transparent: true,
			depthWrite: false,
		});
	const bank = layer(0);
	const wisps = layer(1);

	// Every location owns ground, lost havens included: the rules count theirs as unexplored too.
	const sources = new Map<CityId, { cover: number; progress: number; target: number; wait: number }>(
		pack.cities.map(city => {
			const covered = hidden(city.id) ? 1 : 0;
			return [city.id, { cover: covered, progress: covered, target: covered, wait: 0 }];
		}),
	);
	const paint = () => {
		mask.draw(id => sources.get(id)?.cover ?? 0);
		maskTexture.needsUpdate = true;
		fieldTexture.needsUpdate = true;
		onpaint?.();
	};
	paint();
	const foggy = () => [...sources.values()].some(source => source.cover > 0);

	// One clock drifts the smoke while any is left and opens locations as they are explored.
	const { start, stop } = useTask(
		delta => {
			uniforms.uTime.value += delta;
			let moving = false;
			for (const source of sources.values()) {
				if (source.progress === source.target) continue;
				moving = true;
				if (source.wait > 0) {
					source.wait -= delta;
					continue;
				}
				const step = delta / REVEAL_SECONDS;
				source.progress =
					source.target > source.progress
						? Math.min(source.target, source.progress + step)
						: Math.max(source.target, source.progress - step);
				source.cover = cubicInOut(source.progress);
			}
			if (moving) paint();
			if (!moving && !foggy()) stop();
		},
		{ autoStart: false },
	);
	if (foggy()) start();

	$effect(() => {
		let changed = false;
		pack.cities.forEach((city, index) => {
			const source = sources.get(city.id)!;
			const target = hidden(city.id) ? 1 : 0;
			if (source.target === target) return;
			source.target = target;
			source.wait = (index % 9) * 0.12;
			changed = true;
		});
		if (changed) start();
	});

	const centre = $derived([(bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2] as const);
</script>

<T.Mesh rotation.x={-Math.PI / 2} position={[centre[0], LAND_HEIGHT + 0.12, centre[1]]} renderOrder={1}>
	<T.PlaneGeometry args={[bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ]} />
	<T is={bank} />
</T.Mesh>
<T.Mesh rotation.x={-Math.PI / 2} position={[centre[0], LAND_HEIGHT + 2.2, centre[1]]} renderOrder={2}>
	<T.PlaneGeometry args={[bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ]} />
	<T is={wisps} />
</T.Mesh>
