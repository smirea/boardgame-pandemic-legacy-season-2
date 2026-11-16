<script lang="ts">
	import { geoGraticule } from 'd3-geo';
	import { feature } from 'topojson-client';
	import type { Topology } from 'topojson-specification';
	import landTopology from 'world-atlas/land-110m.json';
	import { boardPath, FRAME } from './projection';

	// The world engraved faintly into the table, for screens that come before the chart is laid out.
	const topology = landTopology as unknown as Topology;
	const land = boardPath(feature(topology, topology.objects['land']!)) ?? '';
	const sphere = boardPath({ type: 'Sphere' }) ?? '';
	const graticule = boardPath(geoGraticule().step([15, 15])()) ?? '';
	const pad = 6;
	const viewBox = `${FRAME.minX - pad} ${FRAME.minZ - pad} ${FRAME.maxX - FRAME.minX + pad * 2} ${FRAME.maxZ - FRAME.minZ + pad * 2}`;
</script>

<svg {viewBox} aria-hidden="true">
	<path class="graticule" d={graticule} />
	<path class="sphere" d={sphere} />
	<path class="land" d={land} />
</svg>

<style>
	svg {
		position: absolute;
		inset: 50% auto auto 50%;
		width: min(118vw, 210vh);
		translate: -50% -50%;
		pointer-events: none;
		animation: surface 1600ms ease-out both;
	}

	@keyframes surface {
		from {
			opacity: 0;
			scale: 1.03;
		}
	}

	path {
		fill: none;
		vector-effect: non-scaling-stroke;
	}

	.graticule {
		stroke: rgb(231 220 198 / 0.05);
		stroke-width: 1;
	}

	.sphere {
		stroke: rgb(231 220 198 / 0.12);
		stroke-width: 1.5;
	}

	.land {
		fill: rgb(231 220 198 / 0.035);
		stroke: rgb(231 220 198 / 0.13);
		stroke-width: 1;
	}
</style>
