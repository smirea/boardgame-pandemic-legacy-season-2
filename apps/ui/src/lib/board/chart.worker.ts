import { paintChart } from './chart';
import type { BoardBounds } from './projection';

self.onmessage = async (event: MessageEvent<BoardBounds>) => {
	const chart = paintChart(event.data);
	// WebGL ignores flipY for bitmaps, so the sheets are flipped here to land the right way up on the board.
	const [known, lines] = await Promise.all([
		createImageBitmap(chart.known, { imageOrientation: 'flipY' }),
		createImageBitmap(chart.lines, { imageOrientation: 'flipY' }),
	]);
	self.postMessage({ known, lines }, { transfer: [known, lines] });
};
