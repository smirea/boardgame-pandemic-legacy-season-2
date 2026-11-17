#!/usr/bin/env bun
/**
 * Cuts the generated 4×4 action icon sheet (`art/action-icons.png`) into a strip of 16 icons, in sheet order, the dock and the map use.
 * Each cell is trimmed inside its ruled border, so no grid line shows at the edge of an icon. Needs ImageMagick.
 */
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const source = join(root, 'art/action-icons.png');
const target = join(root, 'static/actions/icons.webp');
const CELL = 128;
const INSET = 0.045;

const { width } = (await Bun.$`magick identify -format '{"width":%w}' ${source}`.json()) as { width: number };
const step = width / 4;
const trim = Math.round(step * INSET);
const tiles = Array.from({ length: 16 }, (_, index) => {
	const x = Math.round((index % 4) * step) + trim;
	const y = Math.round(Math.floor(index / 4) * step) + trim;
	const side = Math.floor(step - trim * 2);
	return ['(', source, '-crop', `${side}x${side}+${x}+${y}`, '+repage', '-resize', `${CELL}x${CELL}`, ')'];
});
await Bun.$`magick ${tiles.flat()} +append -quality 84 ${target}`.quiet();
console.log(`wrote ${target}`);
