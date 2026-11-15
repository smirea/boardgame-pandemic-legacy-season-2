#!/usr/bin/env bun
/**
 * Records part of a real game in the built app, then plays it back at /replay in a headless
 * browser: stepping, scrubbing, turn jumps and autoplay. Pass `--shots` to keep screenshots.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { botCommand, framesOf } from '@repo/game';
import type { Command, GameRecord, PublicState } from '@repo/game';

declare const window: {
	DEBUG: { getState(): PublicState; send(command: Command): string | null; getRecord(): GameRecord | null };
};

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
	args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const errors: string[] = [];
const watch = (page: Awaited<ReturnType<typeof context.newPage>>) => {
	page.on('pageerror', error => errors.push(error.message));
	page.on('console', message => {
		if (message.type() === 'error' && !message.text().includes('WebGL')) errors.push(message.text());
	});
	return page;
};
const shot = async (page: Awaited<ReturnType<typeof context.newPage>>, name: string) => {
	if (!keepShots) return;
	mkdirSync(shotsDir, { recursive: true });
	await page.screenshot({ path: join(shotsDir, `${name}.png`) });
};

try {
	const game = watch(await context.newPage());
	await game.goto(`http://127.0.0.1:${server.port}/debug/game?DEBUG_ID=replay-e2e`);
	await game.locator('.bar button', { hasText: 'Menu' }).click();
	await game.locator('[data-testid=scenario-october]').click();
	await game.locator('.lobby h1', { hasText: 'October' }).waitFor();

	const rng = { seed: 77 };
	let sent = 0;
	for (let tries = 0; tries < 400 && sent < 90; tries++) {
		const state = await game.evaluate(() => window.DEBUG.getState());
		if (state.phase === 'over') break;
		const command = botCommand(state.world, state.phase, rng, 3);
		const refused = await game.evaluate(next => window.DEBUG.send(next), command);
		assert(refused === null, `the game refused ${command.type}: ${refused}`);
		sent++;
	}
	const record = await game.evaluate(() => window.DEBUG.getRecord());
	const live = await game.evaluate(() => window.DEBUG.getState());
	assert(record, 'the host kept no recording');
	assert(
		record.steps.length > 40 && record.steps.length <= sent,
		`recorded ${record.steps.length} steps for ${sent} commands`,
	);
	assert(
		record.steps.every(step => step.command !== null),
		'a step lost its command',
	);
	assert(
		record.id.startsWith('g') && record.month === 10,
		`the recording is named ${record.id}, month ${record.month}`,
	);
	const frames = framesOf(record);
	assert(JSON.stringify(frames.at(-1)) === JSON.stringify(live), 'the last frame is not the live state');
	ok(
		'the host records every command of the game',
		`${record.steps.length} steps, ${Math.round(JSON.stringify(record).length / 1024)} kB`,
	);

	await game.reload();
	await game.waitForFunction(() => Boolean(window.DEBUG?.getRecord()));
	const kept = await game.evaluate(() => window.DEBUG.getRecord()!.steps.length);
	assert(kept === record.steps.length, `after a reload the recording has ${kept} steps`);
	ok('the recording survives a reload');

	await game.locator('.bar button', { hasText: 'Menu' }).click();
	await game.locator('[data-testid=save-recording]').waitFor();
	const [download] = await Promise.all([
		game.waitForEvent('download'),
		game.locator('[data-testid=save-recording]').click(),
	]);
	assert(
		download.suggestedFilename() === `recording-${record.id}.json`,
		`the file is named ${download.suggestedFilename()}`,
	);
	ok('the menu saves the recording as a file', download.suggestedFilename());

	const replay = watch(await context.newPage());
	await replay.goto(`http://127.0.0.1:${server.port}/replay?src=local&DEBUG_ID=replay-e2e`);
	const where = replay.locator('[data-testid=where] strong');
	await where.waitFor();
	const total = record.steps.length;
	assert((await where.innerText()) === `0 / ${total}`, `the replay opens at ${await where.innerText()}`);
	await replay.locator('.lobby h1', { hasText: 'October' }).waitFor();
	await shot(replay, 'replay-0-start');
	ok('the replay opens on the first state, the lobby');

	for (let step = 0; step < 12; step++) await replay.locator('[data-testid=step-forward]').click();
	assert((await where.innerText()) === `12 / ${total}`, `after 12 steps the replay is at ${await where.innerText()}`);
	assert((await replay.locator('.timeline .step.now').count()) === 1, 'no timeline row is marked as the current step');
	await shot(replay, 'replay-1-stepped');
	ok('stepping forward advances the board and the timeline');

	await replay.keyboard.press('ArrowLeft');
	assert((await where.innerText()) === `11 / ${total}`, 'the left arrow did not step back');
	await replay.locator('[data-testid=scrub]').fill(String(total));
	assert((await where.innerText()) === `${total} / ${total}`, 'the scrubber did not reach the end');
	const topBar = (page: typeof replay) => page.locator('.bar').first().innerText();
	assert((await topBar(replay)).replace(/\d+ online|solo/g, '') !== '', 'the replay shows no top bar');
	const liveDeck = await game
		.locator('[data-testid=deck-count]')
		.innerText()
		.catch(() => null);
	const replayDeck = await replay
		.locator('[data-testid=deck-count]')
		.innerText()
		.catch(() => null);
	assert(liveDeck === replayDeck, `the replay's end shows deck ${replayDeck}, the live game ${liveDeck}`);
	await shot(replay, 'replay-2-end');
	ok('scrubbing to the end shows the same board as the live game');

	await replay.locator('.timeline .step button').nth(20).click();
	assert((await where.innerText()) === `21 / ${total}`, 'clicking a timeline row did not jump there');
	await replay.locator('[data-testid=play]').click();
	await replay.waitForFunction(
		start => Number(document.querySelector('[data-testid=where] strong')!.textContent!.split(' / ')[0]) >= start + 2,
		21,
		{ timeout: 8000 },
	);
	await replay.locator('[data-testid=play]').click();
	ok('clicking a row jumps to it, and play advances on its own');

	for (const id of ['end-actions', 'draw', 'infect', 'continue'])
		assert(!(await replay.locator(`[data-testid=${id}]`).isVisible()), `the replay shows the live ${id} button`);
	assert(errors.length === 0, `page errors:\n${errors.join('\n')}`);
	ok('no live controls and no page errors');
	console.log('\nPASS');
} finally {
	await browser.close();
	await server.stop(true);
}
