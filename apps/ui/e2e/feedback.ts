#!/usr/bin/env bun
/**
 * Scores how precisely Feedback can point at the game: plays a solo game a few turns in on the dev server, opens the
 * editor with Alt+Cmd+click, exports the JSON tree, prints it, and replays a tap on every point of the screen with
 * Feedback's own `taps.py`. Needs `bun run dev` running, since only a development build has Feedback and `file:line`.
 * Pass `--lobby` to score the lobby instead, and `--keep` to keep the export and a screenshot in e2e/shots.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { botCommand } from '@repo/game';
import type { Command, PublicState } from '@repo/game';
import env from '../../../packages/shared/src/env.ts';

declare const window: {
	DEBUG: { getState(): PublicState; send(command: Command): string | null };
	__feedbackEngine?: { lastExport: { name: string; blob: Blob }[] };
};

const lobby = process.argv.includes('--lobby');
const keep = process.argv.includes('--keep');
const url = `http://127.0.0.1:${env.UI_PORT}`;
if (
	!(await fetch(url).then(
		response => response.ok,
		() => false,
	))
) {
	throw new Error(`No dev server at ${url}. Start it with \`bun run dev\`.`);
}

const browser = await chromium.launch({ channel: process.argv.includes('--chrome') ? 'chrome' : undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(90_000);
const errors: string[] = [];
page.on('pageerror', error => {
	errors.push(error.message);
	console.error(error.message);
});

try {
	await page.goto(`${url}/?DEBUG_ID=feedback-e2e-${Date.now()}`, { waitUntil: 'domcontentloaded' });
	await page.locator('[data-testid=solo]').click({ noWaitAfter: true });
	await page.waitForFunction(() => window.DEBUG?.getState()?.phase === 'lobby');

	const rng = { seed: 7 };
	for (let step = 0; step < (lobby ? 0 : 400); step++) {
		const snap = await page.evaluate(() => window.DEBUG.getState());
		if (snap.phase === 'playing.actions' && snap.world.game!.turn >= 3) break;
		const refused = await page.evaluate(next => window.DEBUG.send(next), botCommand(snap.world, snap.phase, rng, 3));
		if (refused) throw new Error(`The game refused a bot command: ${refused}`);
	}
	const briefing = page.getByTestId('ack-briefing');
	if (await briefing.count()) await briefing.click();
	await page.waitForFunction(() => window.__feedbackEngine);
	// Long enough for pieces to settle after the last move.
	await page.waitForTimeout(2500);

	// In the lobby a modal dialog covers the board, so a click there rightly selects the dialog, not a city.
	const cities = await page.$$eval(lobby ? '.anchor[data-city="none"]' : '.anchor[data-city]', nodes =>
		nodes.map(node => {
			const box = node.getBoundingClientRect();
			return { name: (node as HTMLElement).dataset['name']!, x: box.x + box.width / 2, y: box.y + box.height / 2 };
		}),
	);
	const viewport = page.viewportSize()!;

	await page.getByRole('button', { name: 'Menu' }).click({ modifiers: ['Alt', 'Meta'] });
	const field = page.getByRole('textbox', { name: 'Feedback text' });
	await field.waitFor({ timeout: 90_000 });

	// A click on a city's disc in the screenshot must select that city, never the board or a neighbour.
	const shot = (await page.getByRole('img', { name: 'Screenshot' }).boundingBox())!;
	const missed: string[] = [];
	for (const city of cities) {
		await page.mouse.click(
			shot.x + (city.x / viewport.width) * shot.width,
			shot.y + (city.y / viewport.height) * shot.height,
		);
		const selected = await page.locator('.selected').innerText();
		if (selected !== city.name) missed.push(`${city.name} selected ${selected}`);
	}
	if (missed.length) throw new Error(`Cities a click does not select:\n${missed.join('\n')}`);
	if (cities.length) console.log(`ok   a click on each of ${cities.length} cities selects it`);
	// Typed key by key: Space, Z and F are the game's shortcuts, and they must reach the field, not the table.
	const before = await page.evaluate(() => JSON.stringify(window.DEBUG.getState()));
	const note = 'fix zoom fit';
	await field.pressSequentially(note);
	const typed = await field.inputValue();
	if (typed !== note) throw new Error(`The note field got "${typed}" for "${note}"`);
	if ((await page.evaluate(() => JSON.stringify(window.DEBUG.getState()))) !== before) {
		throw new Error('Typing in the feedback editor changed the game');
	}
	await field.press('Enter');
	await page.getByRole('button', { name: 'Share', exact: true }).click();
	await page.getByRole('menuitem', { name: 'JSON', exact: true }).click();
	await page.getByRole('dialog', { name: 'Share JSON' }).waitFor();
	const json = await page.evaluate(() => window.__feedbackEngine!.lastExport[0]!.blob.text());

	const out = keep ? join(import.meta.dir, 'shots') : tmpdir();
	mkdirSync(out, { recursive: true });
	const file = join(out, `feedback-${lobby ? 'lobby' : 'game'}.json`);
	writeFileSync(file, json);
	if (keep) await page.screenshot({ path: join(out, `feedback-${lobby ? 'lobby' : 'game'}.png`) });

	type Node = { id: number; parent?: number; name: string; label?: string; source?: string };
	const depth = new Map<number, number>();
	for (const node of JSON.parse(json).nodes as Node[]) {
		depth.set(node.id, node.parent === undefined ? 0 : depth.get(node.parent)! + 1);
		const title = node.label ? `${node.name} "${node.label.slice(0, 60)}"` : node.name;
		console.log(`${'  '.repeat(depth.get(node.id)!)}${title}${node.source ? `  ${node.source}` : ''}`);
	}
	const taps =
		await Bun.$`gh api repos/smirea/feedback-engine/contents/skills/feedback-accessibility/scripts/taps.py -H ${'Accept: application/vnd.github.raw'}`.text();
	console.log(await Bun.$`python3 - ${file} < ${new Response(taps)}`.text());
	if (errors.length) throw new Error(`The page threw:\n${errors.join('\n')}`);
} finally {
	await browser.close();
}
