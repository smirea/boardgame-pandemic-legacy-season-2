<script lang="ts" module>
	const NOISE = /* glsl */ `
		uniform float uTime;
		uniform float uReveal;
		uniform float uAspect;
		float fogHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
		float fogNoise( vec2 p ) {
			vec2 i = floor( p );
			vec2 f = fract( p );
			vec2 u = f * f * ( 3.0 - 2.0 * f );
			return mix( mix( fogHash( i ), fogHash( i + vec2( 1.0, 0.0 ) ), u.x ),
				mix( fogHash( i + vec2( 0.0, 1.0 ) ), fogHash( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
		}
		float fogFbm( vec2 p ) {
			float value = 0.0;
			float amplitude = 0.5;
			for ( int i = 0; i < 4; i++ ) {
				value += amplitude * fogNoise( p );
				p *= 2.03;
				amplitude *= 0.5;
			}
			return value;
		}
	`;

	// Mist drifts over the unknown sheet in two layers. Where a region is being revealed, its edge
	// glows like scorched paper, so the eye follows the world being charted.
	const FOG = /* glsl */ `
		float fogMask = texture2D( alphaMap, vAlphaMapUv ).g;
		vec2 fogUv = vAlphaMapUv * vec2( uAspect, 1.0 );
		float mist = fogFbm( fogUv * 5.0 + vec2( uTime * 0.035, uTime * 0.012 ) );
		float wisp = fogFbm( fogUv * 13.0 - vec2( uTime * 0.05, -uTime * 0.02 ) );
		diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.84, 0.85, 0.83 ), 0.1 + 0.36 * mist );
		float fogEdge = smoothstep( 0.02, 0.3, fogMask ) * ( 1.0 - smoothstep( 0.3, 0.8, fogMask ) );
		diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.45, 0.24, 0.09 ), fogEdge * ( 0.15 + 0.65 * uReveal ) );
		// Settled fog is fully opaque; only a lifting edge frays with the mist.
		diffuseColor.a *= smoothstep( 0.15, 0.6, fogMask * ( 0.75 + 0.5 * wisp ) );
	`;
</script>

<script lang="ts">
	import { pack } from '@repo/game';
	import type { CityId } from '@repo/game';
	import { T, useTask } from '@threlte/core';
	import { untrack } from 'svelte';
	import { cubicInOut } from 'svelte/easing';
	import { CanvasTexture, LinearFilter, MeshStandardMaterial } from 'three';
	import type { Texture } from 'three';
	import { FogMask } from './chart';
	import { LAND_HEIGHT } from './projection';
	import type { BoardBounds } from './projection';

	type Props = { bounds: BoardBounds; sheet: Texture | null; hidden: (city: CityId) => boolean };

	let { bounds, sheet, hidden }: Props = $props();

	const REVEAL_SECONDS = 1.8;
	const area = untrack(() => bounds);
	const mask = new FogMask(area);
	const alpha = new CanvasTexture(mask.canvas);
	alpha.minFilter = LinearFilter;
	alpha.generateMipmaps = false;

	const uniforms = {
		uTime: { value: 0 },
		uReveal: { value: 0 },
		uAspect: { value: (area.maxX - area.minX) / (area.maxZ - area.minZ) },
	};
	const material = new MeshStandardMaterial({
		alphaMap: alpha,
		transparent: true,
		depthWrite: false,
		roughness: 1,
	});
	// The sheet arrives from a worker after the board is up; until then the fog is plain bleached paper.
	$effect(() => {
		material.map = sheet;
		material.color.set(sheet ? '#ffffff' : '#e3dac6');
		material.needsUpdate = true;
	});
	material.onBeforeCompile = shader => {
		Object.assign(shader.uniforms, uniforms);
		shader.fragmentShader = shader.fragmentShader
			.replace('#include <common>', `#include <common>\n${NOISE}`)
			.replace('#include <alphamap_fragment>', FOG);
	};

	// Every location owns ground, lost havens included: the rules count theirs as unexplored too.
	const cities = pack.cities;
	const sources = new Map<CityId, { cover: number; progress: number; target: number; wait: number }>(
		cities.map(city => {
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

	// One clock drives the drifting mist while any fog is left, and the reveal while a region is lifting.
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
			uniforms.uReveal.value = moving
				? Math.min(1, uniforms.uReveal.value + delta * 3)
				: Math.max(0, uniforms.uReveal.value - delta * 0.8);
			if (moving) paint();
			if (!moving && !foggy() && uniforms.uReveal.value === 0) stop();
		},
		{ autoStart: false },
	);
	if (foggy()) start();

	$effect(() => {
		let changed = false;
		cities.forEach((city, index) => {
			const source = sources.get(city.id)!;
			const target = hidden(city.id) ? 1 : 0;
			if (source.target === target) return;
			source.target = target;
			source.wait = (index % 9) * 0.09;
			changed = true;
		});
		if (changed) start();
	});
</script>

<T.Mesh
	rotation.x={-Math.PI / 2}
	position={[(bounds.minX + bounds.maxX) / 2, LAND_HEIGHT + 0.12, (bounds.minZ + bounds.maxZ) / 2]}
	receiveShadow
>
	<T.PlaneGeometry args={[bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ]} />
	<T is={material} />
</T.Mesh>
