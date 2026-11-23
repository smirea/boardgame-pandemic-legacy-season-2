import type { CubeEnd, Handover, ScreenSpot } from '#lib/board/types.ts';

const cubeOf = (seat: string, which: 'solid' | 'coming') => {
	const cubes = document.querySelectorAll<HTMLElement>(`.place[data-seat="${seat}"] [data-cube="${which}"]`);
	return (which === 'solid' ? cubes[cubes.length - 1] : cubes[0]) ?? null;
};

const spotOf = (end: CubeEnd, which: 'solid' | 'coming'): ScreenSpot | null => {
	const cube = end.seat ? cubeOf(end.seat, which) : null;
	if (!cube) return end.at();
	const box = cube.getBoundingClientRect();
	return { x: box.left + box.width / 2, y: box.top + box.height / 2, size: box.width };
};

/**
 * Supply cubes a character hands to the board or takes from it are the cubes on its card: one leaves the card when it
 * takes off and one joins it only when it lands. While they fly, a seat shows its cubes as they were, which `of` says.
 */
export function createCubeFlights() {
	const leaving = $state<Record<string, number>>({});
	const arriving = $state<Record<string, number>>({});
	const bump = (counts: Record<string, number>, seat: string | undefined, by: number) => {
		if (seat) counts[seat] = (counts[seat] ?? 0) + by;
	};

	function fly({ from, to, delay, onlaunch, onarrive }: Handover): Promise<void> {
		bump(leaving, from.seat, 1);
		bump(arriving, to.seat, 1);
		return new Promise(resolve => {
			setTimeout(() => {
				const start = spotOf(from, 'solid');
				bump(leaving, from.seat, -1);
				onlaunch?.();
				const end = spotOf(to, 'coming');
				const land = () => {
					bump(arriving, to.seat, -1);
					onarrive?.();
					resolve();
				};
				if (!start || !end) return land();
				const ghost = cubeGhost(start);
				const dx = end.x - start.x;
				const dy = end.y - start.y;
				const distance = Math.hypot(dx, dy);
				const lift = Math.min(160, 30 + distance * 0.25);
				const grow = end.size / start.size;
				const at = (k: number, height: number, turn: number) =>
					`translate(${dx * k}px, ${dy * k - height}px) scale(${1 + (grow - 1) * k}) rotate(${turn}deg)`;
				const flight = ghost.animate(
					[{ transform: at(0, 0, 0) }, { transform: at(0.5, lift, 140), offset: 0.5 }, { transform: at(1, 0, 300) }],
					{ duration: Math.min(1000, 380 + distance * 0.6), easing: 'cubic-bezier(0.45, 0, 0.35, 1)' },
				);
				const done = () => {
					ghost.remove();
					land();
				};
				flight.onfinish = done;
				flight.oncancel = done;
			}, delay);
		});
	}

	return {
		fly,
		/** The cubes still flying off a seat's card, and those flying onto it. */
		of: (seat: string) => ({ leaving: leaving[seat] ?? 0, arriving: arriving[seat] ?? 0 }),
	};
}

export type CubeFlights = ReturnType<typeof createCubeFlights>;
export const CUBE_FLIGHTS = Symbol('cube-flights');

// Drawn as the cubes on a character's card are, so the one that flies is the one that left.
function cubeGhost(spot: ScreenSpot) {
	const ghost = document.createElement('div');
	const size = Math.max(6, spot.size);
	Object.assign(ghost.style, {
		position: 'fixed',
		left: `${spot.x - size / 2}px`,
		top: `${spot.y - size / 2}px`,
		width: `${size}px`,
		height: `${size}px`,
		zIndex: '95',
		pointerEvents: 'none',
		filter: 'drop-shadow(0 0.3rem 0.35rem rgb(0 0 0 / 0.45))',
	});
	const cube = document.createElement('i');
	Object.assign(cube.style, {
		display: 'block',
		width: '100%',
		height: '100%',
		background: 'conic-gradient(from 30deg at 50% 35%, #b1a38a 0deg 120deg, #e0d5bb 120deg 240deg, #fff5dc 240deg)',
		clipPath: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)',
	});
	ghost.append(cube);
	document.body.append(ghost);
	return ghost;
}
