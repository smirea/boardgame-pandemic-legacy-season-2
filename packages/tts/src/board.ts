import type { Vec } from './census';

/**
 * Where each location's disc lies on the mod's table, in table units, measured from a render of the save.
 * The mod's map is drawn by hand, so a location's latitude and longitude place it a unit or two off.
 */
export const anchors: Record<string, [x: number, z: number]> = {
	'haven-north-atlantic': [-14.1, 9.2],
	'haven-mediterranean': [-1.4, 6.4],
	'haven-south-atlantic': [-11.0, -3.4],
	'haven-eastern-pacific': [-26.2, -7.2],
	'new-york': [-20.9, 7.75],
	washington: [-22.7, 5.6],
	jacksonville: [-23.9, 2.7],
	'sao-paulo': [-14.85, -12.0],
	london: [-3.0, 10.1],
	istanbul: [4.1, 6.8],
	tripoli: [0.45, 3.4],
	cairo: [4.7, 3.1],
	lagos: [-2.6, -3.1],
	chicago: [-26.3, 8.8],
	'san-francisco': [-35.0, 7.7],
	denver: [-29.8, 6.5],
	atlanta: [-25.8, 5.2],
	'los-angeles': [-32.6, 4.9],
	'mexico-city': [-28.5, 0.9],
	bogota: [-21.6, -4.65],
	lima: [-22.1, -8.7],
	santiago: [-20.1, -13.1],
	'buenos-aires': [-17.7, -14.05],
	paris: [0.1, 10.0],
	frankfurt: [2.6, 10.6],
	'st-petersburg': [3.9, 13.2],
	moscow: [6.7, 11.5],
	kinshasa: [1.05, -4.25],
	khartoum: [5.1, -1.9],
	'dar-es-salaam': [7.3, -4.6],
	antananarivo: [8.05, -9.55],
	johannesburg: [4.0, -11.35],
	baghdad: [8.85, 5.3],
	riyadh: [9.45, 2.45],
	tehran: [11.8, 6.2],
	delhi: [16.7, 5.1],
	'new-mumbai': [15.05, 2.4],
	kolkata: [18.95, 2.4],
};

/** The location whose disc is nearest a point on the table, and how far away it is. */
export function nearestAnchor(point: Pick<Vec, 'x' | 'z'>): { city: string; distance: number } {
	let best = { city: '', distance: Number.POSITIVE_INFINITY };
	for (const [city, [x, z]] of Object.entries(anchors)) {
		const distance = Math.hypot(point.x - x, point.z - z);
		if (distance < best.distance) best = { city, distance };
	}
	return best;
}

/** The map itself: the part of the table image where locations lie. */
export const onMap = (point: Pick<Vec, 'x' | 'z'>) =>
	point.x > -38.5 && point.x < 37 && point.z > -16.5 && point.z < 14.2;
