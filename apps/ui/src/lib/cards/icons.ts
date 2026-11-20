import type { CityImprovementId, CompanionId, EventId } from '@repo/game';

/** Line icons on a 16-unit square, stroked in the card's ink. Hand spines carry these instead of names. */
export const EVENT_ICON: Record<EventId, string> = {
	airlift: 'M2 8.5 14 3l-4 11-2.2-4.6zM7.8 9.4 14 3',
	quietNight: 'M11 2.5a6 6 0 1 0 2.8 8.8A5 5 0 0 1 11 2.5z',
	resilience: 'M8 2l5 2v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4z',
	handout: 'M2.5 9.5h11V14h-11zM5 6l3-3 3 3M8 3v6.5',
	spreadOut: 'M8 8V2M8 8l5.5 4M8 8l-5.5 4M6 3.5l2-2 2 2',
	cleanse: 'M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M4 12l2-2',
	forecast: 'M3 3h7v4H3zM6 9h7v4H6zM12 3.5v3l-1.5-1.5M4 12.5v-3l1.5 1.5',
	cache: 'M2.5 5.5h11v8h-11zM2.5 5.5 5 2.5h6l2.5 3M8 7.5v4M6 9.5h4',
	encore: 'M12.5 8A4.5 4.5 0 1 1 8 3.5h3M9.5 1.5l2 2-2 2',
	massInoculation: 'M2 14l3-3M4 10l6-6 2 2-6 6zM9 3l4 4M11.5 1.5l3 3',
	exile: 'M4 2.5h8v11H4zM6 6l4 4M10 6l-4 4',
	antidote: 'M6 2h4M6.5 2v4L3.5 12.5a1 1 0 0 0 1 1.5h7a1 1 0 0 0 1-1.5L9.5 6V2M5 10h6',
	mentor: 'M8 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3 14c.8-2.6 2.7-4 5-4s4.2 1.4 5 4',
	secondWind: 'M3 4l4 4-4 4M9 4l4 4-4 4',
	scavenge: 'M3 5.5h6.5V14H3zM6 5.5V2.5h6.5V11H9.5',
	openWaters: 'M2 6c2-2 4 2 6 0s4 2 6 0M2 10.5c2-2 4 2 6 0s4 2 6 0',
	safeHouses: 'M2.5 8.5 8 3l5.5 5.5M4 7v6.5h8V7M7 13.5v-3h2v3',
	purge: 'M8 2c3 3 4.5 5 4.5 7.5a4.5 4.5 0 0 1-9 0C3.5 7 5.5 5.5 8 2zM6 8.5l4 4M10 8.5l-4 4',
	stockUp: 'M2.5 9.5V14h11V9.5M8 2v8.5M5 7.5l3 3 3-3',
	cardSwap: 'M3 5.5h10M10 2.5l3 3-3 3M13 10.5H3M6 7.5l-3 3 3 3',
	surplus: 'M7 3.5l4.5 2.5v5L7 13.5 2.5 11V6zM2.5 6 7 8.5 11.5 6M7 8.5v5M13.5 1.5v4M11.5 3.5h4',
};

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
