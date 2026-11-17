#!/usr/bin/env bun
import { chromium } from 'playwright';
import { botCommand, campaignAt, createGameActor, phaseOf, give, pack } from '@repo/game';
import { conjure } from '../../../packages/game/src/testkit.ts';
import type { PublicState } from '@repo/game';
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

const seat = game.seats.find(s => s !== game.active)!;
const city = Object.values(world.campaign.playerCards).find(
	c => c.kind === 'city' && world.campaign.locations[c.city]?.revealed,
)!;
const hidden = Object.values(world.campaign.playerCards).find(
	c => c.kind === 'city' && !world.campaign.locations[c.city]?.revealed,
);
const produce = Object.values(world.campaign.playerCards).find(c => c.kind === 'produce')!;
give(world, seat, [city.id, produce.id, ...(hidden ? [hidden.id] : [])]);
conjure(world, seat, { kind: 'event', event: 'airlift' });
conjure(world, seat, { kind: 'event', event: 'quietNight' });
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
	const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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
	const corner = page.locator(
		`[data-testid=corner][data-player="${world.campaign.characters[game.players[seat]!.character]!.name}"]`,
	);
	for (const [label, kind] of [
		[city.kind === 'city' ? pack.cities.find(c => c.id === city.city)!.name : '', 'city'],
		['Produce Supplies', 'produce'],
		['Airlift', 'seats'],
		['Quiet Night', 'anywhere'],
	] as const) {
		const button = corner.locator('.mini').filter({ hasText: label }).first();
		await button.hover();
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
		await page.screenshot({ path: `/tmp/seat-${kind}.png` });
		console.log(`PASS ${kind} hover`);
	}
	await corner.locator('.slip').click();
	await page.locator('.dock .card.city').first().hover();
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
