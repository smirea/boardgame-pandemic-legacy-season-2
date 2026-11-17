<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { T } from '@threlte/core';
	import type { IntersectionEvent } from '@threlte/extras';
	import { HTML } from '@threlte/extras';
	import Pop from './Pop.svelte';
	import { fonts, printBerth, printTitle } from './print.svelte';
	import Printed from './Printed.svelte';
	import { LAND_HEIGHT } from './projection';
	import { CUBE, PILE, STOCKPILE, STOCKPILE_TITLE_Z } from './stockpile';

	type Props = {
		/** Every cube in the stockpile, which the hover reports. */
		count: number;
		/** The cubes standing in the pile: the count less any still flying home. */
		shown: number;
		lit: boolean;
		onhint: (event: PointerEvent | null) => void;
	};

	let { count, shown, lit, onhint }: Props = $props();

	const TITLE_SIZE = 1.8;
	const HTML_PX = 40;
	const title = $derived(fonts.ready ? printTitle('Stockpile', TITLE_SIZE, lit) : null);
	// The pile stands on a berth ruled on the chart, so the spot reads as the stockpile's even when it is empty.
	const berth = printBerth(6.4, 5.6);
	const cubes = $derived(PILE.slice(0, Math.max(0, shown)));
	const hover = {
		onpointerenter: (event: IntersectionEvent<PointerEvent>) => {
			event.stopPropagation();
			onhint(event.nativeEvent);
		},
		onpointermove: (event: IntersectionEvent<PointerEvent>) => {
			event.stopPropagation();
			onhint(event.nativeEvent);
		},
		onpointerleave: () => onhint(null),
	};
</script>

<T.Group position={[STOCKPILE.x, LAND_HEIGHT, STOCKPILE.z]}>
	{#each cubes as cube, index (index)}
		<Pop position={[cube.x, cube.y, cube.z]}>
			<T.Mesh rotation.y={cube.turn} castShadow receiveShadow>
				<T.BoxGeometry args={[CUBE, CUBE, CUBE]} />
				<T.MeshStandardMaterial color="#efe6d2" roughness={0.65} />
			</T.Mesh>
		</Pop>
	{/each}
	<Printed print={berth} position={[0, 0.2, 0]} opacity={0.75} order={4} />
	{#if title}
		<Printed print={title} position={[0, 0.2, STOCKPILE_TITLE_Z]} order={4} />
	{/if}
	<!-- One box over the pile and its title that draws nothing, so the hover holds across both. -->
	<T.Mesh position={[0, 1, (STOCKPILE_TITLE_Z + 1.45 - 2.8) / 2]} {...hover}>
		<T.BoxGeometry args={[Math.max(6.4, title?.width ?? 0), 2, STOCKPILE_TITLE_Z + 1.45 + 2.8]} />
		<T.MeshBasicMaterial colorWrite={false} depthWrite={false} />
	</T.Mesh>
	<HTML transform position.y={0.2} rotation.x={-Math.PI / 2} pointerEvents="none" zIndexRange={[1, 0]}>
		<span
			class="anchor"
			style:--size="{6 * HTML_PX}px"
			data-stockpile={count}
			aria-hidden="true"
			{@attach feedback('Stockpile', () => ({ count, shown }))}
		></span>
	</HTML>
</T.Group>

<style>
	.anchor {
		display: block;
		width: var(--size);
		height: var(--size);
		pointer-events: none;
	}
</style>
