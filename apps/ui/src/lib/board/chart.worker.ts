import { paintChart } from './chart';
import type { BoardBounds } from './projection';

self.onmessage = async (event: MessageEvent<BoardBounds>) => {
	const chart = paintChart(event.data);
	// WebGL ignores flipY for bitmaps, so they are flipped here to land the right way up on the board.
	const flip = (canvas: OffscreenCanvas) => createImageBitmap(canvas, { imageOrientation: 'flipY' });
	const [known, unknown] = await Promise.all([flip(chart.known), flip(chart.unknown)]);
	self.postMessage({ known, unknown }, { transfer: [known, unknown] });
};
