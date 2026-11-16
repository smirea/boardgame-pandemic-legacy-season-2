import { paintChart } from './chart';
import type { BoardBounds } from './projection';

self.onmessage = async (event: MessageEvent<BoardBounds>) => {
	// WebGL ignores flipY for bitmaps, so the sheet is flipped here to land the right way up on the board.
	const known = await createImageBitmap(paintChart(event.data).known, { imageOrientation: 'flipY' });
	self.postMessage({ known }, { transfer: [known] });
};
