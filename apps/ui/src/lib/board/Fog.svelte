<script lang="ts" module>
	const VERTEX = /* glsl */ `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}
	`;

	// Opaque smoke over every unexplored location's ground. The mask says where the fog is (1) and,
	// while a location is being explored, how far it has opened from the city (0 at the city). Thin
	// smoke burns off first and dense puffs last, so the fog clears in billows rather than a wipe.
	const FRAGMENT = /* glsl */ `
		uniform sampler2D uMask;
		uniform float uTime;
		uniform float uAspect;
		uniform vec2 uTexel;
		varying vec2 vUv;

		float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
		float noise( vec2 p ) {
			vec2 i = floor( p );
			vec2 f = fract( p );
			vec2 u = f * f * ( 3.0 - 2.0 * f );
			return mix( mix( hash( i ), hash( i + vec2( 1.0, 0.0 ) ), u.x ),
				mix( hash( i + vec2( 0.0, 1.0 ) ), hash( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
		}
		float fbm( vec2 p, int octaves ) {
			float value = 0.0;
			float amplitude = 0.5;
			for ( int i = 0; i < 5; i++ ) {
				if ( i >= octaves ) break;
				value += amplitude * noise( p );
				p = p * 2.07 + vec2( 17.3, 9.1 );
				amplitude *= 0.5;
			}
			return value;
		}

		void main() {
			float mask = texture2D( uMask, vUv ).g;
			// A soft copy of the mask: it rounds the fog bank's edge inward and casts its shadow outward.
			float soft = 0.0;
			for ( int i = 0; i < 8; i++ ) {
				float a = float( i ) * 0.785398;
				soft += texture2D( uMask, vUv + vec2( cos( a ), sin( a ) ) * uTexel * 9.0 ).g;
			}
			soft /= 8.0;
			if ( mask < 0.002 && soft < 0.002 ) discard;

			vec2 p = vUv * vec2( uAspect, 1.0 ) * 3.4;
			float t = uTime;
			vec2 warp = vec2( fbm( p * 0.6 + vec2( t * 0.015, -t * 0.01 ), 3 ), fbm( p * 0.6 - vec2( t * 0.012, t * 0.017 ) + 5.2, 3 ) );
			float density = fbm( p + warp * 1.1 + vec2( t * 0.03, t * 0.012 ), 5 );
			float lit = fbm( p + warp * 1.1 + vec2( t * 0.03, t * 0.012 ) + vec2( -0.07, -0.1 ), 3 );
			float swell = fbm( p * 0.35 - vec2( t * 0.006, 0.0 ), 2 );
			density = clamp( ( density - 0.2 ) * 1.5 * 0.75 + swell * 0.35, 0.0, 1.0 );

			// Light from the upper left: a puff brighter than the smoke behind it toward the light is lit.
			float light = clamp( 0.55 + ( density - lit ) * 1.8, 0.0, 1.0 );
			vec3 shadowed = vec3( 0.44, 0.43, 0.41 );
			vec3 sunlit = vec3( 0.84, 0.82, 0.78 );
			vec3 color = mix( shadowed, sunlit, smoothstep( 0.1, 0.95, density * 0.55 + light * 0.55 ) );
			// The bank darkens toward its edge, as smoke thins over the ground.
			color *= mix( 0.95, 1.0, smoothstep( 0.5, 1.0, soft ) );

			// Settled fog (mask 1) is fully opaque. While a location opens, smoke thinner than the opening survives less.
			float opening = 1.0 - mask;
			float cloud = mask >= 0.999 ? 1.0 : smoothstep( opening - 0.12, opening + 0.12, density * 0.85 + 0.15 * mask );
			cloud *= step( 0.002, mask );
			// Around the bank, a faint shadow falls on charted ground; the ground itself stays fully readable.
			float shade = ( 1.0 - cloud ) * soft * 0.18;
			// Past the chart's frame the bank thins out over the paper's edge and the table.
			vec2 edge = min( vUv, 1.0 - vUv );
			float fade = smoothstep( 0.0, 0.028, min( edge.x * uAspect, edge.y ) );
			gl_FragColor = vec4( mix( vec3( 0.12, 0.1, 0.08 ), color, cloud ), max( cloud, shade ) * fade );
		}
	`;
</script>

<script lang="ts">
	import { pack } from '@repo/game';
	import type { CityId } from '@repo/game';
	import { T, useTask } from '@threlte/core';
	import { untrack } from 'svelte';
	import { cubicInOut } from 'svelte/easing';
	import { CanvasTexture, LinearFilter, ShaderMaterial, Vector2 } from 'three';
	import { FogMask } from './chart';
	import { LAND_HEIGHT } from './projection';
	import type { BoardBounds } from './projection';

	type Props = { bounds: BoardBounds; hidden: (city: CityId) => boolean };

	let { bounds, hidden }: Props = $props();

	const REVEAL_SECONDS = 2.4;
	const area = untrack(() => bounds);
	const mask = new FogMask(area);
	const alpha = new CanvasTexture(mask.canvas);
	alpha.minFilter = LinearFilter;
	alpha.generateMipmaps = false;

	const material = new ShaderMaterial({
		vertexShader: VERTEX,
		fragmentShader: FRAGMENT,
		uniforms: {
			uMask: { value: alpha },
			uTime: { value: 0 },
			uAspect: { value: (area.maxX - area.minX) / (area.maxZ - area.minZ) },
			uTexel: { value: new Vector2(1 / mask.canvas.width, 1 / mask.canvas.height) },
		},
		transparent: true,
		depthWrite: false,
	});

	// Every location owns ground, lost havens included: the rules count theirs as unexplored too.
	const sources = new Map<CityId, { cover: number; progress: number; target: number; wait: number }>(
		pack.cities.map(city => {
			const covered = hidden(city.id) ? 1 : 0;
			return [city.id, { cover: covered, progress: covered, target: covered, wait: 0 }];
		}),
	);
	const paint = () => {
		mask.draw(id => sources.get(id)?.cover ?? 0);
		alpha.needsUpdate = true;
	};
	paint();
	const foggy = () => [...sources.values()].some(source => source.cover > 0);

	// One clock drifts the smoke while any is left and opens locations as they are explored.
	const { start, stop } = useTask(
		delta => {
			material.uniforms['uTime']!.value += delta;
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
</script>

<T.Mesh
	rotation.x={-Math.PI / 2}
	position={[(bounds.minX + bounds.maxX) / 2, LAND_HEIGHT + 0.12, (bounds.minZ + bounds.maxZ) / 2]}
>
	<T.PlaneGeometry args={[bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ]} />
	<T is={material} />
</T.Mesh>
