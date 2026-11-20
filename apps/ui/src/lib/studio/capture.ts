import { domToCanvas } from 'modern-screenshot';

/** The arrow a pointer shows as, drawn into a capture where the pointer rested. */
function drawPointer(context: CanvasRenderingContext2D, x: number, y: number) {
	const arrow = new Path2D('M0 0 L0 17 L4.6 12.8 L7.6 19.6 L10.3 18.4 L7.4 11.8 L13 11.8 Z');
	context.save();
	context.translate(x, y);
	context.lineJoin = 'round';
	context.lineWidth = 1.6;
	context.strokeStyle = '#fff';
	context.fillStyle = '#111';
	context.shadowColor = 'rgb(0 0 0 / 0.45)';
	context.shadowBlur = 3;
	context.shadowOffsetY = 1;
	context.fill(arrow);
	context.shadowColor = 'transparent';
	context.stroke(arrow);
	context.restore();
}

/**
 * A picture of this page as it stands. A page cannot read its own pixels, so the DOM is drawn again into a canvas:
 * close to what the browser painted, not the same pixels. An agent that needs those takes a browser screenshot.
 */
export async function capturePage(pointer: { x: number; y: number } | null, scale = Math.min(2, devicePixelRatio)) {
	const canvas = await domToCanvas(document.documentElement, {
		width: innerWidth,
		height: innerHeight,
		scale,
		backgroundColor: getComputedStyle(document.body).backgroundColor,
	});
	if (pointer) {
		const context = canvas.getContext('2d')!;
		context.scale(scale, scale);
		drawPointer(context, pointer.x, pointer.y);
	}
	return new Promise<Blob>((resolve, reject) =>
		// WebP keeps a sharp double-density capture near a tenth of its PNG, and shots are stored and exported by the dozen.
		canvas.toBlob(
			blob => (blob ? resolve(blob) : reject(new Error('The capture could not be encoded'))),
			'image/webp',
			0.92,
		),
	);
}
