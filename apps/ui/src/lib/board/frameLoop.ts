import { useScheduler } from '@threlte/core';
import type { WebGLRenderer } from 'three';

const REST_AFTER_FRAMES = 30;

/**
 * Threlte's frame loop runs whether or not anything is drawn, and sixty empty frames a second still keep a core
 * awake. This stops the loop once nothing has asked for a frame for a while, and the next `invalidate()` starts
 * it again. A hidden tab draws nothing: the loop stops when the tab is hidden and draws once when it is shown.
 * Call it before any component under the canvas is created: each one keeps the `invalidate` it finds on the
 * scheduler at that moment, and one that kept the old function could not wake the loop.
 */
export function restWhenStill(renderer: WebGLRenderer): () => void {
	const context = useScheduler();
	let running = false;
	let quiet = 0;
	const rest = () => {
		running = false;
		renderer.setAnimationLoop(null);
	};
	const frame = (time: number) => {
		context.scheduler.run(time);
		quiet = context.shouldRender() ? 0 : quiet + 1;
		context.resetFrameInvalidation();
		if (quiet >= REST_AFTER_FRAMES) rest();
	};
	const wake = () => {
		if (running || document.hidden) return;
		running = true;
		quiet = 0;
		renderer.setAnimationLoop(frame);
	};
	const invalidate = context.invalidate;
	context.invalidate = () => {
		invalidate();
		wake();
	};
	const seen = () => {
		if (document.hidden) return rest();
		context.invalidate();
	};
	document.addEventListener('visibilitychange', seen);
	wake();
	return () => {
		document.removeEventListener('visibilitychange', seen);
		context.invalidate = invalidate;
		rest();
	};
}
