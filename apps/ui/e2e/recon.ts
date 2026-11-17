#!/usr/bin/env bun
/**
 * Plays January alone on the dev server and checks the recon boxes on the board: each route the players know has its
 * box, a box that cannot be taken is greyed with the engine's reason, and clicking one that can reveals its region
 * and fades the box out with the fog. Needs `bun run dev` running. Pass `--shots` to keep screenshots in e2e/shots.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { botCommand, campaignAt, cityDef, give } from '@repo/game';
import type { CardId, Command, PublicState, Save, World } from '@repo/game';
import env from '../../../packages/shared/src/env.ts';

declare const window: {
	DEBUG: { getState(): PublicState; send(command: Command): string | null; setState(state: unknown): void };
};

const keepShots = process.argv.includes('--shots');
const shotsDir = join(import.meta.dir, 'shots');
const url = `http://127.0.0.1:${env.UI_PORT}`;
if (
	!(await fetch(url).then(
		response => response.ok,
		() => false,
	))
)
	throw new Error(`No dev server at ${url}. Start it with \`bun run dev\`.`);

const ok = (label: string, detail = '') => console.log(`ok   ${label}${detail ? ` (${detail})` : ''}`);
function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
// The board draws WebGL in software here, so a loaded machine can take a while to answer a click.
page.setDefaultTimeout(90000);
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
const state = () => page.evaluate(() => window.DEBUG.getState());
const shot = async (name: string) => {
	if (!keepShots) return;
	mkdirSync(shotsDir, { recursive: true });
	await page.screenshot({ path: join(shotsDir, `${name}.png`) });
};
const boxes = () =>
	page.$$eval('[data-recon]', nodes =>
		nodes.map(node => ({
			route: (node as HTMLElement).dataset['recon']!,
			state: (node as HTMLElement).dataset['state']!,
			reason: node.getAttribute('title'),
			gone: node.closest('.recon')!.classList.contains('gone'),
		})),
	);
async function load(save: Save) {
	await Promise.all([
		page.waitForEvent('load'),
		page.evaluate(next => window.DEBUG.setState(next), save).catch(() => {}),
	]);
	await page
		.waitForFunction(() => Boolean(window.DEBUG?.getState()?.world), undefined)
		.catch(async error => {
			console.log(errors, (await page.textContent('body'))?.slice(0, 300));
			throw error;
		});
}

try {
	await page.goto(`${url}/?DEBUG_ID=recon-e2e-${Date.now()}`);
	await page.locator('[data-testid=solo]').click();
	await page.waitForFunction(() => window.DEBUG?.getState()?.phase === 'lobby');
	await load(campaignAt(1));

	const rng = { seed: 5 };
	for (let step = 0; step < 200; step++) {
		const snap = await state();
		if (snap.phase === 'playing.actions') break;
		const refused = await page.evaluate(next => window.DEBUG.send(next), botCommand(snap.world, snap.phase, rng, 2));
		assert(refused === null, `the game refused a setup command: ${refused}`);
	}
	let snap = await state();
	assert(snap.phase === 'playing.actions' && snap.world.campaign.month === 1, `setup ended in ${snap.phase}`);
	await page.getByRole('button', { name: 'Continue' }).click({ noWaitAfter: true });
	await page.waitForTimeout(2500);

	const january = await boxes();
	assert(
		january
			.map(box => box.route)
			.toSorted()
			.join() === 'africa,europe,middle-east,north-america,south-america',
		`January shows ${january.map(box => box.route).join(', ')}`,
	);
	assert(
		january.every(box => box.state === 'blocked' && box.reason === "Stand in the route's city"),
		`a box away from the pawn is not greyed with the engine's reason: ${JSON.stringify(january)}`,
	);
	ok("January prints the five recon routes, greyed with the engine's reason", january.map(box => box.route).join(', '));
	await shot('recon-january');

	await page.locator('[data-recon=europe]').click({ force: true });
	assert((await state()).world.campaign.opened.length === snap.world.campaign.opened.length, 'a greyed box acted');
	ok('clicking a greyed box does nothing');

	const covering = () =>
		page.evaluate(() => {
			const rects = [...document.querySelectorAll('[data-recon]')].map(node => node.getBoundingClientRect());
			const cities = [...document.querySelectorAll<HTMLElement>('.anchor[data-city]')].map(node => {
				const box = node.getBoundingClientRect();
				return { name: node.dataset['name']!, x: box.x + box.width / 2, y: box.y + box.height / 2 };
			});
			const hits = cities.filter(city =>
				rects.some(box => city.x > box.left && city.x < box.right && city.y > box.top && city.y < box.bottom),
			);
			return { width: Math.round(rects[0]!.width), hits: hits.map(city => city.name) };
		});
	const fitted = await covering();
	assert(fitted.hits.length === 0, `at the fitted zoom a recon box covers ${fitted.hits.join(', ')}`);
	await page.mouse.move(720, 420);
	for (let notch = 0; notch < 6; notch++) await page.mouse.wheel(0, 400);
	await page.waitForTimeout(2000);
	const far = await covering();
	assert(far.width < fitted.width, `zoomed out, the boxes kept their size (${far.width}px)`);
	assert(far.hits.length === 0, `zoomed out, a recon box covers ${far.hits.join(', ')}`);
	ok('zoomed out, the boxes shrink with the map and still cover no city', `${fitted.width}px → ${far.width}px`);
	await shot('recon-zoomed-out');
	await page.getByRole('button', { name: 'Fit map' }).click({ noWaitAfter: true });
	await page.waitForTimeout(1500);

	// Stand the active pawn in Washington with a supply center and three blue cards, as a player would arrive there.
	const world = structuredClone(snap.world) as World;
	const game = world.game!;
	const blue = Object.values(world.campaign.playerCards)
		.filter(card => card.kind === 'city' && cityDef(card.city).color === 'blue' && card.city !== 'washington')
		.slice(0, 3)
		.map(card => card.id as CardId);
	const me = game.players[game.active]!;
	game.playerDiscard.push(...me.hand.splice(0));
	give(world, game.active, blue);
	game.players[game.active]!.location = 'washington' as never;
	game.locations['washington' as never]!.center = true;
	await load({ v: 1, phase: 'playing.actions', world } as Save);
	await page.waitForSelector('[data-recon=north-america][data-state=ready]').catch(async error => {
		throw new Error(`North America is not ready: ${JSON.stringify(await boxes())}`, { cause: error });
	});
	if (await page.getByRole('button', { name: 'Continue' }).count())
		await page.getByRole('button', { name: 'Continue' }).click({ noWaitAfter: true });
	await page.waitForTimeout(2500);
	ok('standing at Washington with a supply center and 3 blue cards readies the North America box');
	await shot('recon-ready');

	const onTop = await page.evaluate(() => {
		const box = document.querySelector('[data-recon=north-america]')!.getBoundingClientRect();
		const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
		return hit?.closest('[data-recon]')?.getAttribute('data-recon') ?? `${hit?.tagName}.${hit?.className}`;
	});
	assert(onTop === 'north-america', `the North America box is covered by ${onTop}`);
	await page.locator('[data-recon=north-america]').click({ noWaitAfter: true });
	const opened = () =>
		page.waitForFunction(
			() => window.DEBUG.getState().world.campaign.opened.includes('north-america' as never),
			undefined,
			{
				timeout: 5000,
			},
		);
	await opened().catch(async () => {
		const chooser = page.locator('[data-testid=chooser]');
		assert(await chooser.count(), 'clicking the ready box neither reconnoitred nor asked how to pay');
		await chooser.locator('button').filter({ hasNotText: '×' }).first().click({ noWaitAfter: true });
		await opened();
	});
	const after = await state();
	assert(after.world.campaign.locations['chicago' as never]!.revealed, 'North America was not revealed');
	await page.waitForSelector('.recon.gone [data-recon=north-america]');
	assert((await page.locator('[data-recon=north-america]').isDisabled()) === true, 'the taken box still acts');
	ok('clicking it reconnoitres: North America is revealed and its box fades out');
	await page.waitForTimeout(2800);
	await shot('recon-revealed');

	assert(errors.length === 0, `the page threw: ${errors.join(' | ')}`);
	console.log('PASS recon boxes print, grey out, and reveal their region');
} finally {
	await browser.close();
}
