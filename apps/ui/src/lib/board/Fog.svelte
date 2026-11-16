<script lang="ts">
	import { pack } from '@repo/game';
	import type { CityId } from '@repo/game';
	import { T, useTask } from '@threlte/core';
	import { untrack } from 'svelte';
	import { cubicInOut } from 'svelte/easing';
	import { CanvasTexture, LinearFilter } from 'three';
	import type { Texture } from 'three';
	import { FogMask } from './chart';
	import type { FogSource } from './chart';
	import { LAND_HEIGHT } from './projection';
	import type { BoardBounds } from './projection';

	type Props = { bounds: BoardBounds; sheet: Texture; hidden: (city: CityId) => boolean };

	let { bounds, sheet, hidden }: Props = $props();

	const REVEAL_SECONDS = 1.6;
	const mask = new FogMask(untrack(() => bounds));
	const alpha = new CanvasTexture(mask.canvas);
	alpha.minFilter = LinearFilter;
	alpha.generateMipmaps = false;

	const cities = pack.cities.filter(city => !city.lost);
	const sources = new Map<CityId, FogSource & { progress: number; target: number; wait: number }>(
		cities.map(city => {
			const covered = hidden(city.id) ? 1 : 0;
			return [city.id, { at: pack.positions[city.id]!, cover: covered, progress: covered, target: covered, wait: 0 }];
		}),
	);
	const links = cities.flatMap((a, index) =>
		cities
			.slice(index + 1)
			.filter(b => b.region === a.region)
			.map(b => [sources.get(a.id)!, sources.get(b.id)!] as [FogSource, FogSource]),
	);
	const paint = () => {
		mask.draw([...sources.values()], links);
		alpha.needsUpdate = true;
	};
	paint();

	// A region being revealed wears away city by city, the way the clouds used to lift one after another.
	const { start, stop } = useTask(
		delta => {
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
			if (!moving) return stop();
			paint();
		},
		{ autoStart: false },
	);

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
	position={[(bounds.minX + bounds.maxX) / 2, LAND_HEIGHT + 0.03, (bounds.minZ + bounds.maxZ) / 2]}
	receiveShadow
>
	<T.PlaneGeometry args={[bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ]} />
	<T.MeshStandardMaterial map={sheet} alphaMap={alpha} transparent depthWrite={false} roughness={1} />
</T.Mesh>
