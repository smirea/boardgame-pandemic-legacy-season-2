#!/usr/bin/env bun
/**
 * Plays a campaign alone in the built app through "Play on this screen": one browser controls every character,
 * and each turn the table turns so the active character sits at the bottom right with their hand in the dock.
 * Pass `--shots` to keep screenshots.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import type { Page } from 'playwright';
import { botCommand } from '@repo/game';
import type { Command, PublicState } from '@repo/game';

declare const window: { DEBUG: { getState(): PublicState; send(command: Command): string | null } };

const root = join(import.meta.dir, '..');
const buildDir = join(root, 'build');
const shotsDir = join(import.meta.dir, 'shots');
const keepShots = process.argv.includes('--shots');

const ok = (label: string, detail = '') => console.log(`ok   ${label}${detail ? ` (${detail})` : ''}`);
function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

await Bun.$`bun run build`.cwd(root).quiet();
const server = Bun.serve({
	hostname: '127.0.0.1',
	port: 0,
	async fetch(request) {
		const path = new URL(request.url).pathname;
		const file = Bun.file(join(buildDir, path));
		return new Response(path !== '/' && (await file.exists()) ? file : Bun.file(join(buildDir, 'index.html')));
	},
});
await Bun.$`bun x playwright install chromium-headless-shell`.cwd(root).quiet();
const browser = await chromium.launch({
	channel: process.argv.includes('--chrome') ? 'chrome' : undefined,
	args: process.argv.includes('--chrome')
		? ['--ignore-gpu-blocklist']
		: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
// The board renders WebGL in software here, so a busy machine can take far longer than Playwright's 30 s default.
page.setDefaultTimeout(90_000);
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
const shot = async (name: string) => {
	if (!keepShots) return;
	mkdirSync(shotsDir, { recursive: true });
	await page.screenshot({ path: join(shotsDir, `${name}.png`) });
};

const state = () => page.evaluate(() => window.DEBUG.getState());
const activeName = (snap: PublicState) => {
	const game = snap.world.game!;
	return snap.world.campaign.characters[game.players[game.active]!.character]!.name;
};
/** Which character each corner holds, read from the screen. */
async function corners(names: string[]) {
	const read = async (place: string) => {
		const node = page.locator(`.place.${place}`);
		const text = (await node.count()) ? ((await node.textContent()) ?? '') : '';
		return names.find(name => new RegExp(`\\b${name}\\b`).test(text)) ?? null;
	};
	return { br: await read('br'), bl: await read('bl'), tl: await read('tl'), tr: await read('tr') };
}

try {
	await page.goto(`http://127.0.0.1:${server.port}/?DEBUG_ID=solo-e2e`);
	await page.locator('[data-testid=solo]').click({ noWaitAfter: true });
	await page.waitForFunction(() => window.DEBUG?.getState()?.phase === 'lobby');

	const rng = { seed: 11 };
	for (let tries = 0; tries < 200; tries++) {
		const snap = await state();
		if (snap.phase === 'playing.actions') break;
		const refused = await page.evaluate(next => window.DEBUG.send(next), botCommand(snap.world, snap.phase, rng, 3));
		assert(refused === null, `the game refused a setup command: ${refused}`);
	}
	const briefing = page.getByTestId('ack-briefing');
	if (await briefing.count()) await briefing.click();
	await page.locator('.game').click({ position: { x: 1, y: 350 } });
	let snap = await state();
	assert(snap.phase === 'playing.actions', `setup ended in ${snap.phase}`);
	const game = snap.world.game!;
	const names = game.seats.map(seat => snap.world.campaign.characters[game.players[seat]!.character]!.name);
	assert(names.length === 3, `${names.length} characters at the table`);
	ok('one browser seats three characters', names.join(', '));

	assert(
		!(await page.locator('header.bar').textContent())?.includes('Stockpile'),
		'the top bar still counts the stockpile',
	);
	const pile = page.locator('[data-stockpile]');
	assert(
		Number(await pile.getAttribute('data-stockpile')) === game.stockpile,
		"the stockpile on the board does not hold the game's count",
	);
	const pileBox = (await pile.boundingBox())!;
	await page.mouse.move(pileBox.x + pileBox.width / 2, pileBox.y + pileBox.height / 2);
	const pileHint = await page.locator('[data-testid=board-hint]').textContent();
	assert(pileHint?.includes(`Supply cubes left ${game.stockpile}`), `the stockpile's hover says ${pileHint}`);
	await page.mouse.move(5, 450);
	ok('the stockpile stands on the board and its hover gives the count', String(game.stockpile));

	const seen = new Set<string>();
	for (let turn = 0; turn < 5; turn++) {
		snap = await state();
		const active = activeName(snap);
		await page.waitForFunction(
			name => new RegExp(`\\b${name}\\b`).test(document.querySelector('.place.br')?.textContent ?? ''),
			active,
			{ timeout: 60_000 },
		);
		const table = await corners(names);
		const order = snap.world.game!.seats.map(seat => names[snap.world.game!.seats.indexOf(seat)]!);
		const from = order.indexOf(active);
		assert(
			table.bl === order[(from + 1) % 3] && table.tl === order[(from + 2) % 3] && table.tr === null,
			`turn order does not run clockwise from ${active}: ${JSON.stringify(table)}`,
		);
		const docked = await page.locator('.dock').textContent();
		assert(docked?.includes(active), `the dock does not hold ${active}'s hand`);
		seen.add(active);
		await shot(`solo-turn-${turn}`);

		// Space ends the actions, draws and infects, the way a player ends a turn. Anything else, a discard or a
		// decision, is answered by the bot.
		for (let steps = 0; steps < 40; steps++) {
			const now = await state();
			if (
				now.phase === 'over' ||
				(now.phase === 'playing.actions' && now.world.game!.active !== snap.world.game!.active)
			)
				break;
			if (['playing.actions', 'playing.draw', 'playing.infect'].includes(now.phase)) {
				const before = JSON.stringify(now);
				await page.keyboard.press('Space');
				await page.waitForFunction(text => JSON.stringify(window.DEBUG.getState()) !== text, before, {
					timeout: 60_000,
				});
				continue;
			}
			const refused = await page.evaluate(next => window.DEBUG.send(next), botCommand(now.world, now.phase, rng, 3));
			assert(refused === null, `the game refused ${now.phase}: ${refused}`);
		}
		if ((await state()).phase === 'over') break;
	}
	assert(seen.size === 3, `only ${[...seen].join(', ')} took the bottom right seat`);
	ok('each turn the active character takes the bottom right, with their hand in the dock', [...seen].join(' → '));

	snap = await state();
	await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 });
	await page.waitForFunction(() => Boolean(window.DEBUG?.getState()?.world.game));
	await page.waitForFunction(
		name => new RegExp(`\\b${name}\\b`).test(document.querySelector('.place.br')?.textContent ?? ''),
		activeName(snap),
		{ timeout: 60_000 },
	);
	assert((await page.locator('[data-testid=whoami]').count()) === 0, 'a reload asks which pawn this browser plays');
	ok('after a reload the campaign resumes at the active character', activeName(snap));

	assert(errors.length === 0, `the page threw: ${errors.join(' | ')}`);
	console.log('PASS a campaign played alone, the table following the active character');
} finally {
	await browser.close();
	server.stop();
}
