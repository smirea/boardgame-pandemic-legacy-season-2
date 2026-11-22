import { writeFileSync } from 'node:fs';
import type { Browser, Page } from 'playwright';
import { launch } from './tabs.ts';
import type { Tab } from './tabs.ts';

declare const document: Document;

export const VIEW = { width: 1440, height: 900 };

type Point = { x: number; y: number };

const inView = ({ x, y }: Point) =>
	Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x < VIEW.width && y < VIEW.height;

const OUTSIDE = `Coordinates are screen pixels: x from 0 to ${VIEW.width - 1}, y from 0 to ${VIEW.height - 1}.`;

export function point(x: string | undefined, y: string | undefined): Point | string {
	const at = { x: Number(x), y: Number(y) };
	return x !== undefined && y !== undefined && inView(at) ? at : OUTSIDE;
}

/**
 * What the pointer landed on, in a few words. A person sees what they hit; a player aiming by
 * numbers needs to be told, or a near miss reads as a button that does nothing.
 */
async function under(page: Page, at: Point): Promise<string> {
	return page.evaluate(({ x, y }) => {
		const hit = document.elementFromPoint(x, y);
		if (!hit) return 'nothing';
		const city = hit.closest<HTMLElement>('.anchor[data-city]');
		if (city) return `the city ${city.dataset['name'] ?? city.dataset['city']}`;
		const control = hit.closest<HTMLElement>('button, a, select, input, textarea, label, [role="button"]');
		if (control) {
			const field = control as HTMLInputElement;
			const text = (control.innerText || control.getAttribute('aria-label') || field.placeholder || '')
				.replace(/\s+/g, ' ')
				.trim()
				.slice(0, 50);
			const off = field.disabled || control.getAttribute('aria-disabled') === 'true' ? ', which is disabled' : '';
			return `a ${control.tagName.toLowerCase()}${text ? ` "${text}"` : ''}${off}`;
		}
		if (hit.tagName === 'CANVAS') return 'the board';
		return 'something that is not a control';
	}, at);
}

let tool: { browser: Browser; page: Page } | null = null;

export const closeTool = async () => void (await tool?.browser.close().catch(() => {}));

/** Draws a labelled grid over a screenshot, in a browser of its own so the game's page is never touched. */
async function withGrid(png: Buffer): Promise<Buffer> {
	if (!tool) {
		const { browser, context } = await launch(false);
		tool = { browser, page: await context.newPage() };
	}
	const data = await tool.page.evaluate(
		async ({ source, width, height }) => {
			const image = new Image();
			image.src = source;
			await image.decode();
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const pen = canvas.getContext('2d')!;
			pen.drawImage(image, 0, 0);
			pen.font = 'bold 11px sans-serif';
			for (let x = 0; x < width; x += 100) {
				pen.fillStyle = 'rgba(255, 0, 200, 0.55)';
				pen.fillRect(x, 0, 1, height);
				for (let y = 0; y < height; y += 100) {
					pen.fillStyle = 'rgba(255, 0, 200, 0.55)';
					if (x === 0) pen.fillRect(0, y, width, 1);
					const label = `${x},${y}`;
					pen.fillStyle = 'rgba(0, 0, 0, 0.75)';
					pen.fillRect(x + 2, y + 2, pen.measureText(label).width + 4, 13);
					pen.fillStyle = '#fff';
					pen.fillText(label, x + 4, y + 12);
				}
			}
			return canvas.toDataURL('image/png');
		},
		{ source: `data:image/png;base64,${png.toString('base64')}`, ...VIEW },
	);
	return Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
}

export async function shot(tab: Tab, path: string, grid = false): Promise<string> {
	const png = await tab.page.screenshot({ type: 'png' });
	writeFileSync(path, grid ? await withGrid(png) : png);
	return path;
}

/** A part of the screen at three times the size, drawn again by the browser so its text stays sharp. */
export async function zoom(tab: Tab, path: string, box: { x: number; y: number; width: number; height: number }) {
	const session = await tab.page.context().newCDPSession(tab.page);
	try {
		const { data } = await session.send('Page.captureScreenshot', {
			format: 'png',
			clip: { ...box, scale: 3 },
		});
		writeFileSync(path, Buffer.from(data, 'base64'));
	} finally {
		await session.detach().catch(() => {});
	}
	return path;
}

export async function clickAt(tab: Tab, at: Point, button: 'left' | 'right', count: number): Promise<string> {
	await tab.page.mouse.move(at.x, at.y, { steps: 6 });
	await tab.page.waitForTimeout(120);
	const hit = await under(tab.page, at);
	await tab.page.mouse.click(at.x, at.y, { button, clickCount: count });
	return `${button === 'right' ? 'Right-clicked' : count === 2 ? 'Double-clicked' : 'Clicked'} (${at.x}, ${at.y}), on ${hit}.`;
}

export async function moveTo(tab: Tab, at: Point): Promise<string> {
	await tab.page.mouse.move(at.x, at.y, { steps: 10 });
	return `The pointer rests at (${at.x}, ${at.y}), on ${await under(tab.page, at)}.`;
}

export async function dragTo(tab: Tab, from: Point, to: Point): Promise<string> {
	await tab.page.mouse.move(from.x, from.y, { steps: 6 });
	await tab.page.mouse.down();
	await tab.page.mouse.move(to.x, to.y, { steps: 16 });
	await tab.page.waitForTimeout(80);
	await tab.page.mouse.up();
	return `Dragged from (${from.x}, ${from.y}) to (${to.x}, ${to.y}).`;
}

export async function scrollAt(tab: Tab, at: Point, dy: number): Promise<string> {
	await tab.page.mouse.move(at.x, at.y, { steps: 4 });
	await tab.page.mouse.wheel(0, dy);
	return `Scrolled ${dy > 0 ? 'down' : 'up'} by ${Math.abs(dy)} at (${at.x}, ${at.y}).`;
}

export async function typeText(tab: Tab, text: string): Promise<string> {
	await tab.page.keyboard.type(text, { delay: 15 });
	return `Typed "${text}".`;
}

export async function pressCombo(tab: Tab, key: string): Promise<string> {
	try {
		await tab.page.keyboard.press(key);
	} catch {
		return `No key "${key}". Name keys as Escape, Enter, Space, Tab, Backspace, ArrowLeft, a, A, 1, or a combination such as Shift+Tab.`;
	}
	return `Pressed ${key}.`;
}
