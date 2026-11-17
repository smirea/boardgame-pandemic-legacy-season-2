#!/usr/bin/env bun
/**
 * Opens /debug/cards and checks that every player card prints all its text, with no ellipsis and nothing cut off, at
 * the sizes the game uses. Needs `bun run dev` running. Pass `--shots` to keep screenshots in e2e/shots.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import env from '../../../packages/shared/src/env.ts';

const shotsDir = join(import.meta.dir, 'shots');
const browser = await chromium.launch();
try {
	const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
	page.setDefaultTimeout(90_000);
	await page.goto(`http://127.0.0.1:${env.UI_PORT}/debug/cards`);
	await page.getByTestId('player-cards').locator('.card').first().waitFor();
	await page.evaluate(() => document.fonts.ready);
	// The dock's hand, a seat's full hand, and the page's own default.
	for (const size of [0.82, 0.6, 1]) {
		await page.evaluate(size => {
			document.querySelector('main')!.style.setProperty('--card-size', `${size}rem`);
		}, size);
		await page.waitForTimeout(150);
		const report = await page.getByTestId('player-cards').evaluate(section =>
			[...section.querySelectorAll<HTMLElement>('.card')].flatMap(card => {
				const title = card.querySelector<HTMLElement>('.title')!;
				const text = card.querySelector<HTMLElement>('.text');
				const box = card.getBoundingClientRect();
				const cut = [
					// A title wraps downward, so only a word too wide for the card cuts it.
					...(title.scrollWidth > title.clientWidth + 1 ? ['title'] : []),
					...(text && (text.scrollHeight > text.clientHeight + 1 || text.scrollWidth > text.clientWidth + 1)
						? ['text']
						: []),
					...[title, text].flatMap(part =>
						part && getComputedStyle(part).textOverflow === 'ellipsis' ? ['ellipsis'] : [],
					),
					...(title.getBoundingClientRect().bottom > box.bottom ? ['title below the card'] : []),
				];
				const size = (part: HTMLElement) => parseFloat(getComputedStyle(part).fontSize);
				const base = size(card);
				const small = (text && size(text) < base * 0.8) || size(title) < base * 0.85;
				return cut.length || small ? [`${title.textContent}: ${cut.join(', ')}${small ? ' small' : ''}`] : [];
			}),
		);
		if (report.length) throw Error(`At ${size}rem these cards do not show all their text: ${report.join('; ')}`);
		console.log(`ok   every player card prints all its text at ${size}rem`);
		if (process.argv.includes('--shots')) {
			mkdirSync(shotsDir, { recursive: true });
			await page.screenshot({ path: join(shotsDir, `cards-${size}.png`), fullPage: true });
		}
	}
	console.log('PASS player card text fits');
} finally {
	await browser.close();
}
