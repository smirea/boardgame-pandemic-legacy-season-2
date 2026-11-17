#!/usr/bin/env bun
import { chromium } from 'playwright';
import { botCommand, campaignAt, cityDef, createGameActor, phaseOf, give, pack } from '@repo/game';
import { conjure } from '../../../packages/game/src/testkit.ts';
import type { CardId, PublicState, SeatId } from '@repo/game';
declare const window: { DEBUG: { setState(save: unknown): void; getState(): PublicState } };
import env from '../../../packages/shared/src/env.ts';
const actor = createGameActor({ seed: 11, save: campaignAt(1, 11) }).start();
const rng = { seed: 11 };
for (let i = 0; i < 200 && phaseOf(actor.getSnapshot()) !== 'playing.actions'; i++)
	actor.send(botCommand(actor.getSnapshot().context.world, phaseOf(actor.getSnapshot()), rng, 4));
const world = structuredClone(actor.getSnapshot().context.world);
const game = world.game!;
const productionSite = pack.cities.find(city => city.kind === 'city' && world.campaign.locations[city.id]?.revealed)!;
world.game!.locations[productionSite.id]!.center = true;
world.game!.pieces.center -= 1;

// Two hands that each stay within the hand limit, so neither is held up in the dock for a discard.
const [seat, second] = game.seats.filter(s => s !== game.active) as [SeatId, SeatId];
for (const s of [seat, second]) {
	game.playerDiscard.push(...game.players[s]!.hand);
	game.players[s]!.hand = [];
}
const revealedCities = Object.values(world.campaign.playerCards).filter(
	(c): c is Extract<typeof c, { kind: 'city' }> =>
		c.kind === 'city' && Boolean(world.campaign.locations[c.city]?.revealed) && cityDef(c.city).color !== null,
);
const city = revealedCities[0]!;
const color = cityDef(city.city).color!;
const sameColor = revealedCities.filter(c => c !== city && cityDef(c.city).color === color);
const twin = sameColor.find(c => c.city === city.city) ?? sameColor[0]!;
const other = sameColor.find(c => c.city !== city.city && c !== twin)!;
const improved = revealedCities.find(c => ![city, twin, other].includes(c))!;
improved.improvement = 'double';
const hidden = Object.values(world.campaign.playerCards).find(
	c => c.kind === 'city' && !world.campaign.locations[c.city]?.revealed,
);
const produce = Object.values(world.campaign.playerCards).find(c => c.kind === 'produce')!;
give(world, seat, [city.id, produce.id, twin.id, other.id, improved.id]);
const supplyDrop = conjure(world, seat, { kind: 'event', event: 'supplyDrop' });
conjure(world, seat, { kind: 'event', event: 'supplyDrop' });
give(world, second, hidden ? [hidden.id] : []);
const airlift = conjure(world, second, { kind: 'event', event: 'airlift' });
const quietNight = conjure(world, second, { kind: 'event', event: 'quietNight' });
const medic = conjure(world, second, { kind: 'companion', companion: 'medic' });
world.campaign.characters[game.players[game.active]!.character]!.slots[0] = { kind: 'scar', id: pack.scars[0]!.id };
const extra = Math.min(12, game.reserve);
game.players[game.active]!.supplies += extra;
game.reserve -= extra;
if (process.argv.includes('--max-cubes')) {
	let supplies = game.reserve + game.stockpile;
	game.reserve = 0;
	game.stockpile = 0;
	for (const location of Object.values(game.locations)) {
		supplies += location.supplies;
		location.supplies = 0;
	}
	for (const player of Object.values(game.players)) {
		supplies += player.supplies;
		player.supplies = 0;
	}
	game.players[game.active]!.supplies = supplies;
}
const browser = await chromium.launch({
	channel: process.argv.includes('--chrome') ? 'chrome' : undefined,
	args: process.argv.includes('--chrome')
		? ['--ignore-gpu-blocklist']
		: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
	// `--laptop` plays it on a 1280×800 screen instead.
	const laptop = process.argv.includes('--laptop');
	const page = await browser.newPage({
		viewport: laptop ? { width: 1280, height: 800 } : { width: 1440, height: 900 },
	});
	page.setDefaultTimeout(90_000);
	await page.goto(`http://127.0.0.1:${env.UI_PORT}/debug/game?DEBUG_ID=seat-cards`, { waitUntil: 'domcontentloaded' });
	await page.waitForFunction(() => Boolean(window.DEBUG), {}, { timeout: 90_000 });
	await page.evaluate(save => window.DEBUG.setState(save), { v: 1, phase: 'playing.actions', world });
	await page.waitForFunction(
		() =>
			document.querySelectorAll('.portrait img').length === 4 &&
			[...document.querySelectorAll('.portrait img')].every(i => (i as HTMLImageElement).naturalWidth > 0),
		{},
		{ timeout: 90_000 },
	);
	const srcs = await page.locator('.portrait img').evaluateAll(imgs => imgs.map(i => i.getAttribute('src')));
	if (new Set(srcs).size !== 4) throw Error('Portraits repeat');
	if (await page.locator('[data-testid=corner-turn]').count()) throw Error('Playing tab remains');
	if ((await page.locator('.slip.active').evaluate(el => getComputedStyle(el).animationName)) === 'none')
		throw Error('No active animation');
	if (await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)) throw Error('Page scrolls');
	const briefing = page.getByTestId('ack-briefing');
	if (await briefing.count()) await briefing.click();
	const cubesFit = await page.locator('.slip.active').evaluate(card => {
		const bounds = card.getBoundingClientRect();
		const name = card.querySelector('strong')!.getBoundingClientRect();
		return (
			name.width > 0 &&
			[...card.querySelectorAll('.cubes i')].every(cube => {
				const box = cube.getBoundingClientRect();
				return box.left >= name.right && box.right <= bounds.right && box.bottom <= bounds.bottom;
			})
		);
	});
	if (!cubesFit) throw Error('Carried cubes overlap the name or escape the seat card');
	await page.screenshot({ path: '/tmp/seat-table.png' });
	// Seat cards name their abilities; the full text opens beside the card while the pointer rests on it.
	const scarred = world.campaign.characters[game.players[game.active]!.character]!;
	const scar = pack.scars.find(s => s.id === (scarred.slots[0] as { id: string }).id)!;
	const traitTexts = await page.locator('.slip .trait').allInnerTexts();
	if (traitTexts.some(text => text.includes(':') || text.length > 40)) throw Error(`Traits print text: ${traitTexts}`);
	if (!(await page.locator('.slip .trait.scar svg').count())) throw Error('A scar has no icon');
	for (const s of game.seats) {
		const seatCorner = page.locator(
			`[data-testid=corner][data-player="${world.campaign.characters[game.players[s]!.character]!.name}"]`,
		);
		const portrait = seatCorner.locator('.portrait');
		if (!(await portrait.count())) continue;
		await portrait.hover();
		const sheet = seatCorner.getByTestId('character-sheet');
		await sheet.waitFor();
		await page.waitForFunction(el => el && !el.getAnimations().length, await sheet.elementHandle(), {
			timeout: 90_000,
		});
		const placed = await seatCorner.evaluate(corner => {
			const card = corner.querySelector('.slip')!.getBoundingClientRect();
			const box = corner.querySelector('[data-testid=character-sheet]')!.getBoundingClientRect();
			const onRight = card.left > innerWidth / 2;
			return {
				beside: onRight ? box.right <= card.left : box.left >= card.right,
				inside: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight,
				text: corner.querySelector('[data-testid=character-sheet]')!.textContent ?? '',
			};
		});
		const covered = await seatCorner.getByTestId('character-sheet').evaluate(box => {
			// The sheet ignores the pointer, so it is made hit-testable just to ask what lies on top of it.
			(box as HTMLElement).style.pointerEvents = 'auto';
			const at = box.getBoundingClientRect();
			const hits = [0.1, 0.5, 0.9].flatMap(x =>
				[0.1, 0.5, 0.9].flatMap(y => {
					const hit = document.elementFromPoint(at.left + at.width * x, at.top + at.height * y);
					return hit && !box.contains(hit) ? [hit.className] : [];
				}),
			);
			(box as HTMLElement).style.pointerEvents = '';
			return hits;
		});
		if (covered.length) throw Error(`Something covers the character sheet: ${covered.join(', ')}`);
		if (!placed.beside || !placed.inside) throw Error(`Character sheet misplaced: ${JSON.stringify(placed)}`);
		if (s === game.active && !(placed.text.includes(scar.text) && placed.text.includes(scar.name)))
			throw Error(`Sheet lacks the scar: ${placed.text}`);
		await page.screenshot({ path: `/tmp/seat-sheet-${s}.png` });
	}
	await page.mouse.move(700, 450);
	await page.getByTestId('character-sheet').waitFor({ state: 'detached' });
	console.log('PASS ability names, scar icon, character sheet on hover');
	const corner = page.locator(
		`[data-testid=corner][data-player="${world.campaign.characters[game.players[seat]!.character]!.name}"]`,
	);
	const cornerOf = (s: SeatId) =>
		page.locator(`[data-testid=corner][data-player="${world.campaign.characters[game.players[s]!.character]!.name}"]`);
	const hand = corner.getByTestId('corner-hand');
	const secondHand = cornerOf(second).getByTestId('corner-hand');
	const names = [city, twin, other, improved].map(c => pack.cities.find(p => p.id === c.city)!.name);
	const printed = await hand.innerText();
	if (names.some(name => printed.includes(name))) throw Error(`Hand spines still print names: ${printed}`);
	const group = (key: string) => hand.or(secondHand).locator(`.mini[data-group="${key}"]`);
	const colorGroup = group(`color:${color}`);
	if (
		(await colorGroup.getAttribute('data-count')) !== '3' ||
		(await colorGroup.locator('.face b').innerText()) !== '3'
	)
		throw Error(`The ${color} cities are not one pile of 3`);
	const colorTitle = (await colorGroup.getAttribute('title')) ?? '';
	if (![names[0]!, names[2]!].every(name => colorTitle.includes(name))) throw Error(`Pile tooltip: ${colorTitle}`);
	if ((await group('event:supplyDrop:rationed').locator('.face b').innerText()) !== '2')
		throw Error('Two Supply Drops are not one pile of 2');
	for (const key of [`card:${improved.id}`, `card:${medic}`, 'event:airlift:rationed', 'event:quietNight:rationed']) {
		if ((await group(key).getAttribute('data-count')) !== '1') throw Error(`${key} is not on its own`);
		if (await group(key).locator('.face b').count()) throw Error(`${key} prints a count of 1`);
	}
	if ((await hand.or(secondHand).locator('.mini svg').count()) < 5) throw Error('Events and specials lack icons');
	await page.screenshot({ path: '/tmp/seat-hand.png' });
	if ((await colorGroup.locator('.face').boundingBox())!.height > 75) throw Error('Seat piles are as tall as before');
	// Resting on the seat card, or on its piles, lays the whole hand out as real cards in the one hand order, clear of
	// the character sheet and on screen.
	const spread = corner.getByTestId('corner-full-hand');
	for (const target of ['portrait', 'piles'] as const) {
		await page.mouse.move(700, 450);
		await spread.waitFor({ state: 'detached' });
		if (target === 'portrait') await corner.locator('.portrait').hover();
		else {
			// The full hand opens over the piles, so the pointer goes to where the pile was, as a player's would.
			const pile = (await colorGroup.boundingBox())!;
			await page.mouse.move(pile.x + pile.width / 2, pile.y + pile.height / 2, { steps: 4 });
		}
		await spread.waitFor();
		await page.waitForFunction(el => el && !el.getAnimations().length, await spread.elementHandle(), {
			timeout: 90_000,
		});
		const laid = await corner.evaluate(corner => {
			const box = (el: Element | null) => el?.getBoundingClientRect() ?? null;
			const spread = box(corner.querySelector('[data-testid=corner-full-hand]'))!;
			const sheet = box(corner.querySelector('[data-testid=character-sheet]'));
			const clear = (a: DOMRect, b: DOMRect | null) =>
				!b || a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
			const cards = [...corner.querySelectorAll<HTMLElement>('[data-testid=corner-full-hand] .card')];
			return {
				ids: cards.map(card => card.dataset['card']!),
				sheet: Boolean(sheet),
				clear: clear(spread, sheet),
				inside: spread.left >= 0 && spread.right <= innerWidth && spread.top >= 0 && spread.bottom <= innerHeight,
				ellipsis: cards.some(card =>
					[...card.querySelectorAll('*')].some(el => getComputedStyle(el).textOverflow === 'ellipsis'),
				),
			};
		});
		const held = game.players[seat]!.hand.length;
		if (laid.ids.length !== held) throw Error(`The full hand shows ${laid.ids.length} of ${held} cards`);
		const kinds = laid.ids.map(id => world.campaign.playerCards[id as CardId]!.kind);
		if (kinds.slice(kinds.findIndex(kind => kind !== 'city')).includes('city'))
			throw Error(`City cards are not first: ${kinds.join(', ')}`);
		if (target === 'portrait' && !laid.sheet) throw Error('The character sheet did not open beside the full hand');
		if (!laid.clear || !laid.inside || laid.ellipsis) throw Error(`Full hand misplaced: ${JSON.stringify(laid)}`);
		await page.screenshot({ path: `/tmp/seat-full-hand-${target}${laptop ? '-laptop' : ''}.png` });
		console.log(`PASS resting on the ${target} lays out the whole hand, sorted, clear of the sheet`);
	}
	await page.mouse.move(700, 450);
	await spread.waitFor({ state: 'detached' });
	// Over the full hand, each card lights where it can be used, as its pile did.
	for (const [id, owner, kind] of [
		[city.id, seat, 'city'],
		[produce.id, seat, 'city'],
		[airlift, second, 'seats'],
		[quietNight, second, 'anywhere'],
	] as const) {
		const at = cornerOf(owner);
		await at.locator('.portrait').hover();
		await at.locator(`[data-testid=corner-full-hand] [data-card="${id}"]`).hover();
		await page.waitForFunction(
			kind => {
				const el = document.querySelector('.game')!;
				const cities = el.getAttribute('data-card-cities');
				const seats = el.getAttribute('data-card-seats');
				return kind === 'seats' ? Boolean(seats) : kind === 'anywhere' ? !cities && !seats : Boolean(cities);
			},
			kind,
			{ timeout: 90_000 },
		);
		if (id === city.id) {
			const lit = (await page.locator('.game').getAttribute('data-card-cities'))!.split(' ');
			if (!lit.includes(city.city)) throw Error(`The card lights only ${lit.join(', ')}`);
		}
		await page.screenshot({ path: `/tmp/seat-${kind}.png` });
		console.log(`PASS ${id} hover`);
	}
	await page.mouse.move(700, 450);
	// A fourth card joins the colour pile and one Supply Drop leaves its pile, which then stands as a single card.
	const later = structuredClone(world);
	const fourth = sameColor.find(c => ![twin, other, improved].includes(c) && !c.improvement && !c.search.length)!;
	give(later, seat, [fourth.id]);
	later.game!.players[seat]!.hand = later.game!.players[seat]!.hand.filter(id => id !== supplyDrop);
	await page.evaluate(save => window.DEBUG.setState(save), { v: 1, phase: 'playing.actions', world: later });
	await page
		.waitForFunction(
			() => document.querySelector('.mini[data-group^="color:"] .face b')?.textContent === '4',
			{},
			{ timeout: 90_000 },
		)
		.catch(async error => {
			const piles = await page
				.locator('.mini')
				.evaluateAll(els => els.map(el => `${el.getAttribute('data-group')}=${el.getAttribute('data-count')}`));
			throw Error(`The colour pile did not grow to 4: ${piles.join(' ')}`, { cause: error });
		});
	await page.screenshot({ path: '/tmp/seat-regroup.png' });
	if ((await group('event:supplyDrop:rationed').getAttribute('data-count')) !== '1')
		throw Error('The Supply Drop left behind is not a single card');
	console.log('PASS cards join and leave piles');
	// Loading a state shows its briefing again.
	if (await briefing.count()) await briefing.click();
	await corner.locator('.slip').click();
	// The fan overlaps its cards on a narrow screen, so the pointer rests on the first card's uncovered left edge.
	await page
		.locator('.dock .card.city')
		.first()
		.hover({ position: { x: 8, y: 30 } });
	await page.waitForFunction(
		() => Boolean(document.querySelector('.game')?.getAttribute('data-card-cities')),
		{},
		{ timeout: 90_000 },
	);
	console.log('PASS dock card hover');
	await page.setViewportSize({ width: 1366, height: 768 });
	if (await page.evaluate(() => document.documentElement.scrollHeight > innerHeight))
		throw Error('Small laptop scrolls');
	await page.screenshot({ path: '/tmp/seat-laptop.png' });
	await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 });
	await page.waitForFunction(() => Boolean(window.DEBUG?.getState()?.world.game), {}, { timeout: 90_000 });
	console.log('PASS four portraits, cubes, active border, no scroll, reload');
} finally {
	await browser.close();
	actor.stop();
}
