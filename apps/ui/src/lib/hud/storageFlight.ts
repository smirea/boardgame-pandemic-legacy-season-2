import { cityDef } from '@repo/game';
import type { CardId, World } from '@repo/game';
import { CITY_COLOR } from '#lib/board/CityMarker.svelte';
import { cardName, cityName } from './labels.svelte.ts';

/** More cards than this stored at once is a jump, such as a save being loaded, and nothing anyone watched. */
const MOST = 6;

/**
 * Flies each card just stored out of the deck it came from and into Package 6 in the top bar, one after another.
 * The cards are found on the page by their `data-deck` and `data-dest` marks, so nothing flies when either is not
 * on screen.
 */
export function flyToStorage(world: World, added: { id: CardId; pile: 'player' | 'infection' }[]) {
	if (added.length === 0 || added.length > MOST) return;
	const targetEl = document.querySelector<HTMLElement>('[data-dest="storage"]');
	if (!targetEl) return;
	const to = targetEl.getBoundingClientRect();
	if (!to.width) return;
	added.forEach(({ id, pile }, index) => {
		const sourceEl = document.querySelector<HTMLElement>(`[data-deck="${pile}"]`);
		if (!sourceEl) return;
		const from = sourceEl.getBoundingClientRect();
		const card = pile === 'player' ? world.campaign.playerCards[id] : world.campaign.infectionCards[id];
		const city = card && 'city' in card ? cityDef(card.city) : null;
		const band = city ? CITY_COLOR[city.color ?? 'haven'] : '#4e3b63';
		const label = city ? cityName(city.id) : cardName(world, id);
		const ghost = document.createElement('div');
		ghost.dataset.testid = 'inoculate-flight';
		Object.assign(ghost.style, {
			position: 'fixed',
			left: `${from.left + from.width / 2}px`,
			top: `${from.top + from.height / 2}px`,
			zIndex: '95',
			display: 'grid',
			placeItems: 'center',
			width: pile === 'infection' ? '4.8rem' : '3.6rem',
			height: pile === 'infection' ? '3.3rem' : '4.8rem',
			padding: '0.2rem 0.3rem',
			border: `2px solid ${band}`,
			borderRadius: '4px',
			background: pile === 'infection' ? `linear-gradient(90deg, ${band} 0 28%, #26212c 28%)` : band,
			color: '#fff8ec',
			fontSize: '0.62rem',
			fontWeight: '700',
			textAlign: 'center',
			lineHeight: '1.1',
			boxShadow: '0 0.7rem 1.8rem rgb(0 0 0 / 0.6)',
			pointerEvents: 'none',
			transform: 'translate(-50%, -50%)',
		});
		ghost.textContent = label;
		document.body.append(ghost);
		const dx = to.left + to.width / 2 - (from.left + from.width / 2);
		const dy = to.top + to.height / 2 - (from.top + from.height / 2);
		const anim = ghost.animate(
			[
				{ transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0.2 },
				{
					transform: `translate(calc(-50% + ${dx * 0.35}px), calc(-50% + ${dy * 0.35 + 64}px)) scale(1.12) rotate(-6deg)`,
					opacity: 1,
					offset: 0.38,
				},
				{
					transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.32) rotate(4deg)`,
					opacity: 0.9,
				},
			],
			{
				duration: 780,
				delay: index * 140,
				easing: 'cubic-bezier(0.35, 0, 0.2, 1)',
				fill: 'forwards',
			},
		);
		anim.onfinish = () => ghost.remove();
		anim.oncancel = () => ghost.remove();
	});
}
