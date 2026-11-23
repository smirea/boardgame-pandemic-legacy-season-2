<script lang="ts">
	import { T } from '@threlte/core';
	import { onMount, untrack } from 'svelte';
	import { cubicInOut, cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { cubeGeometries, cubeMaterials } from './models.svelte';

	type Point = { x: number; y: number; z: number };
	type Props = {
		from: Point;
		to: Point;
		delay: number;
		/** Struck off the board, not handed over: the cube is knocked into the air, glowing, before it is flung home. */
		lost?: boolean;
		/** The cube has left where it stood. */
		onlaunch?: () => void;
		/** The cube has come down where it was going. */
		onarrive?: () => void;
		/** The flight is over, whether the cube landed or the board went away under it. */
		onland: () => void;
	};

	let { from, to, delay, lost = false, onlaunch, onarrive, onland }: Props = $props();

	// A flight keeps the ends it was launched with.
	const distance = untrack(() => Math.hypot(to.x - from.x, to.z - from.z));
	const struck = untrack(() => lost);
	const STRIKE_MS = 320;
	const flightMs = Math.min(1100, 420 + distance * 9);
	const t = new Tween(0, { duration: flightMs, easing: cubicInOut });
	const strike = new Tween(0, { duration: STRIKE_MS, easing: cubicOut });
	// A struck cube carries its own material, since it glows and the cubes standing on the board must not.
	const material = struck ? cubeMaterials.supply.clone() : cubeMaterials.supply;
	if (struck) material.emissive.set('#ff3b1f');
	onMount(() => {
		let landed = false;
		const timer = setTimeout(async () => {
			onlaunch?.();
			if (struck) await strike.set(1);
			await t.set(1);
			landed = true;
			onarrive?.();
			onland();
		}, delay);
		return () => {
			clearTimeout(timer);
			if (struck) material.dispose();
			if (!landed) onland();
		};
	});

	// A cube is tossed in an arc, higher the further it goes, and tumbles on the way. A struck one first jumps
	// straight up, swollen and shaking, and is flung from there.
	const JUMP = 3.2;
	const position = $derived.by((): [number, number, number] => {
		const k = t.current;
		const jump = strike.current * JUMP * (1 - k);
		const shake = struck ? Math.sin(strike.current * 40) * 0.22 * (1 - strike.current) : 0;
		const lift = Math.sin(Math.PI * k) * Math.min(9, 2 + distance * 0.18);
		return [
			from.x + (to.x - from.x) * k + shake,
			from.y + (to.y - from.y) * k + lift + jump,
			from.z + (to.z - from.z) * k,
		];
	});
	const glow = $derived(struck ? Math.sin(Math.PI * Math.min(1, strike.current)) * 2.4 + (1 - t.current) * 0.5 : 0);
	const swell = $derived(1 + (struck ? Math.sin(Math.PI * strike.current) * 0.7 : 0));
	const spin = $derived(t.current * Math.PI * (struck ? 3 : 1) + strike.current * 1.4);
	$effect(() => {
		if (struck) material.emissiveIntensity = glow;
	});
</script>

<!-- It waits its turn where it starts, so a cube that has left the pile is still seen there. -->
<T.Mesh
	geometry={cubeGeometries.supply}
	{material}
	{position}
	scale={swell}
	rotation={[spin, spin * 1.5, 0]}
	castShadow
	dispose={false}
/>
