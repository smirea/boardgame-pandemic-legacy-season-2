import type { CityImprovementId, CompanionId } from '@repo/game';

/** Line icons on a 16-unit square, stroked in the card's ink. Hand spines carry these instead of names. */
export const COMPANION_ICON: Record<CompanionId, string> = {
	builder: 'M2.5 13.5 9 7M7.5 4.5 10 2l4 4-2.5 2.5z',
	lineman:
		'M4.5 11.5l1.5-1.5M7.25 8.75l1.5-1.5M10 6l1.5-1.5M3 11.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM13 1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
	rigger: 'M4.5 14 8 2l3.5 12M5.8 9.5h4.4M6.9 5.5h2.2',
	tracker: 'M8 3a5 5 0 1 0 0 10A5 5 0 0 0 8 3zM8 1v4M8 11v4M1 8h4M11 8h4',
	medic: 'M8 3v10M3 8h10',
	fieldSurgeon: 'M6 2.5h4v3.5h3.5v4H10v3.5H6V10H2.5V6H6z',
	purifier: 'M8 2c3 4 4.5 6 4.5 8a4.5 4.5 0 0 1-9 0C3.5 8 5 6 8 2z',
	shelterWright: 'M1.5 13.5 8 3l6.5 10.5zM8 3v10.5',
	marksman: 'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
	trader: 'M2.5 5.5h9M9 3l2.5 2.5L9 8M13.5 10.5h-9M7 8l-2.5 2.5L7 13',
	porter:
		'M2 10.5h8.5V6H2zM10.5 8h2.5l1 2.5M4 12.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM11.5 12.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
	quartermaster: 'M2.5 8.5 8 3l5.5 5.5M4 7v6.5h8V7M6.5 10.5h3',
	doubleAgent:
		'M5.5 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM10.5 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM2 13c.6-2.2 2-3.5 3.5-3.5S8.4 10.8 9 13M7 13c.6-2.2 2-3.5 3.5-3.5S13.4 10.8 14 13',
	informant: 'M2.5 6.5a5.5 5.5 0 0 1 11 0v2a5.5 5.5 0 0 1-11 0zM5 7.5h2M9 7.5h2M6 11h4',
};

export const PRODUCE_ICON = 'M3 3h10v10H3zM3 8h10M8 3v10';
export const EPIDEMIC_ICON = 'M8 2l6.5 11.5h-13zM8 6.5V10M8 12v.01';
export const SEARCH_ICON = 'M7 2.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM10.3 10.3 14 14';
export const WILD_ICON = 'M8 1.5l1.9 4.2 4.6.5-3.4 3.1 1 4.5L8 11.5l-4.1 2.3 1-4.5L1.5 6.2l4.6-.5z';

/** A city improvement printed as a short mark: how many cards it counts as, or a star for a wild. */
export const IMPROVEMENT_MARK: Record<CityImprovementId, { text?: string; icon?: string }> = {
	double: { text: '×2' },
	triple: { text: '×3' },
	wild: { icon: WILD_ICON },
	redWild: { icon: WILD_ICON },
};

/** A stitched cut, marking a scar on a character card. */
export const SCAR_ICON = 'M2 12.5 14 3.5M4.2 8.6l2 2.6M7.2 6.4l2 2.6M10.2 4.2l2 2.6';
export const SKULL_ICON =
	'M8 2.2a5 5 0 0 0-5 5c0 1.7.8 3 2 3.7v2.6h6v-2.6c1.2-.7 2-2 2-3.7a5 5 0 0 0-5-5zM5.4 7.4a1 1 0 1 0 2 0 1 1 0 1 0-2 0M8.6 7.4a1 1 0 1 0 2 0 1 1 0 1 0-2 0M7 13.5v-1.6M9 13.5v-1.6';
