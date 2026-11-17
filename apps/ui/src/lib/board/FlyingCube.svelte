<script lang="ts">
	import { T } from '@threlte/core';
	import { onMount, untrack } from 'svelte';
	import { cubicInOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { CUBE } from './stockpile';

	type Point = { x: number; y: number; z: number };
	type Props = { from: Point; to: Point; delay: number; onland: () => void };

	let { from, to, delay, onland }: Props = $props();

	// A flight keeps the ends it was launched with.
	const distance = untrack(() => Math.hypot(to.x - from.x, to.z - from.z));
	const t = new Tween(0, { duration: Math.min(1100, 420 + distance * 9), easing: cubicInOut });
	onMount(() => {
		let landed = false;
		const timer = setTimeout(() => void t.set(1).then(() => ((landed = true), onland())), delay);
		return () => {
			clearTimeout(timer);
			if (!landed) onland();
		};
	});

	// A cube is tossed in an arc, higher the further it goes, and tumbles on the way.
	const position = $derived.by((): [number, number, number] => {
		const k = t.current;
		const lift = Math.sin(Math.PI * k) * Math.min(9, 2 + distance * 0.18);
		return [from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k + lift, from.z + (to.z - from.z) * k];
	});
</script>

<!-- It waits its turn where it starts, so a cube that has left the pile is still seen there. -->
<T.Mesh {position} rotation={[t.current * Math.PI, t.current * Math.PI * 1.5, 0]} castShadow>
	<T.BoxGeometry args={[CUBE, CUBE, CUBE]} />
	<T.MeshStandardMaterial color="#efe6d2" roughness={0.65} />
</T.Mesh>
