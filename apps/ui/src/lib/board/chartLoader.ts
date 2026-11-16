import type { BoardBounds } from './projection';

export type ChartImages = { known: ImageBitmap };

const loads = new Map<string, Promise<ChartImages>>();

/** The chart sheets, painted off the main thread so the game is usable while the paper is still being inked. */
export function loadChart(bounds: BoardBounds): Promise<ChartImages> {
	const key = `${bounds.minX}:${bounds.maxX}:${bounds.minZ}:${bounds.maxZ}`;
	const known = loads.get(key);
	if (known) return known;
	const load = new Promise<ChartImages>((resolve, reject) => {
		const worker = new Worker(new URL('./chart.worker.ts', import.meta.url), { type: 'module' });
		worker.onmessage = (event: MessageEvent<ChartImages>) => {
			resolve(event.data);
			worker.terminate();
		};
		worker.onerror = event => {
			reject(new Error(`the chart could not be painted: ${event.message}`));
			worker.terminate();
		};
		worker.postMessage(bounds);
	});
	loads.set(key, load);
	return load;
}
