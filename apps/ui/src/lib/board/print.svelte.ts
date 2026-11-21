import { CanvasTexture, SRGBColorSpace } from 'three';

/** Something painted onto a transparent sheet, sized in board units, to lie flat on the chart. */
export type Print = { texture: CanvasTexture; width: number; height: number };

export type PrintedKind = 'center' | 'tower' | 'shelter' | 'lab' | 'infested';

const PX_PER_UNIT = 64;
const NAME_FONT = '"IM Fell English"';
const NAME_STYLE = `italic 400`;
const NUMBER_FONT = '"Barlow Semi Condensed"';
const INK = '#2a2017';
const PAPER = '#e9dcbd';

// A canvas paints with whatever font has loaded, and a fallback face would stay baked into the texture,
// so prints wait for the faces they use.
export const fonts = $state({ ready: false });
if (typeof document !== 'undefined')
	void Promise.all([
		document.fonts.load(`${NAME_STYLE} 64px ${NAME_FONT}`),
		document.fonts.load(`700 64px ${NUMBER_FONT}`),
	]).then(() => (fonts.ready = true));

function sheet(width: number, height: number, paint: (context: CanvasRenderingContext2D) => void): Print {
	const canvas = document.createElement('canvas');
	canvas.width = Math.ceil(width * PX_PER_UNIT);
	canvas.height = Math.ceil(height * PX_PER_UNIT);
	const context = canvas.getContext('2d')!;
	context.scale(PX_PER_UNIT, PX_PER_UNIT);
	paint(context);
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.anisotropy = 8;
	return { texture, width, height };
}

const measure = (() => {
	let context: CanvasRenderingContext2D | null = null;
	return (font: string, spacing: number, text: string) => {
		context ??= document.createElement('canvas').getContext('2d')!;
		context.font = font;
		context.letterSpacing = `${spacing}px`;
		return context.measureText(text).width;
	};
})();

const NAME_SPACING = 0.02;
/** The room a port's anchor takes ahead of its name, as a share of the name's size. */
const ANCHOR_ROOM = 0.95;

/** How wide a city's printed name runs, in board units, with a port's anchor ahead of it. */
export const nameWidth = (name: string, port: boolean, size: number) =>
	measure(`${NAME_STYLE} ${size}px ${NAME_FONT}`, size * NAME_SPACING, name) + size * (0.6 + (port ? ANCHOR_ROOM : 0));

/**
 * A city's name lettered on the chart in an engraver's italic, with a faint paper halo that only lifts it off
 * coastlines and lines. A port's name opens with an anchor, the way the board marks the places sea movement may
 * start and end. A lit name is the one under the pointer.
 */
export function printName(name: string, port: boolean, size: number, faded: boolean, lit: boolean): Print {
	const font = `${NAME_STYLE} ${size}px ${NAME_FONT}`;
	const pad = size * 0.3;
	const width = nameWidth(name, port, size);
	const height = size * 1.5;
	return sheet(width, height, context => {
		const baseline = height / 2 + size * 0.3;
		const text = pad + (port ? size * ANCHOR_ROOM : 0);
		context.textBaseline = 'alphabetic';
		context.lineJoin = 'round';
		context.font = font;
		context.letterSpacing = `${size * NAME_SPACING}px`;
		const glyph = (weight: number) => {
			if (!port) return;
			context.save();
			context.translate(pad + size * 0.4, baseline - size * 0.36);
			context.scale(size * 0.36, size * 0.36);
			anchor(context, weight);
			context.restore();
		};
		context.strokeStyle = PAPER;
		context.lineWidth = size * (lit ? 0.3 : 0.1);
		context.globalAlpha = lit ? 0.9 : 0.25;
		context.strokeText(name, text, baseline);
		glyph(lit ? 0.9 : 0.5);
		context.globalAlpha = faded && !lit ? 0.5 : 1;
		context.fillStyle = lit ? '#8e2a12' : INK;
		context.strokeStyle = context.fillStyle;
		context.fillText(name, text, baseline);
		// The face ships in one weight only, so a hairline of ink over the fill is what makes it bolder.
		context.lineWidth = size * 0.035;
		context.strokeText(name, text, baseline);
		glyph(0.2);
	});
}

/**
 * A place on the chart that is not a city, lettered as a cartographer titles a sea: spaced italic between two fine
 * rules that end in lozenges. A lit title is the one under the pointer.
 */
export function printTitle(text: string, size: number, lit: boolean): Print {
	const font = `${NAME_STYLE} ${size}px ${NAME_FONT}`;
	const spacing = size * 0.16;
	const textWidth = measure(font, spacing, text) - spacing;
	const rule = size * 0.9;
	const gap = size * 0.35;
	const width = textWidth + 2 * (rule + gap) + size * 0.4;
	const height = size * 1.6;
	return sheet(width, height, context => {
		const middle = width / 2;
		const baseline = height / 2 + size * 0.3;
		const ink = lit ? '#8e2a12' : INK;
		context.font = font;
		context.letterSpacing = `${spacing}px`;
		context.textAlign = 'center';
		context.lineJoin = 'round';
		context.strokeStyle = PAPER;
		context.globalAlpha = lit ? 0.9 : 0.35;
		context.lineWidth = size * (lit ? 0.3 : 0.14);
		context.strokeText(text, middle + spacing / 2, baseline);
		context.globalAlpha = 1;
		context.fillStyle = ink;
		context.strokeStyle = ink;
		context.fillText(text, middle + spacing / 2, baseline);
		context.lineWidth = size * 0.035;
		context.strokeText(text, middle + spacing / 2, baseline);
		const y = height / 2;
		for (const side of [-1, 1]) {
			const inner = middle + side * (textWidth / 2 + gap);
			const outer = inner + side * rule;
			context.lineWidth = size * 0.05;
			context.beginPath();
			context.moveTo(inner, y);
			context.lineTo(outer - side * size * 0.2, y);
			context.stroke();
			const tip = outer - side * size * 0.1;
			context.beginPath();
			context.moveTo(tip - size * 0.14, y);
			context.lineTo(tip, y - size * 0.1);
			context.lineTo(tip + size * 0.14, y);
			context.lineTo(tip, y + size * 0.1);
			context.closePath();
			context.fill();
		}
	});
}

/** A berth ruled on the chart for a pile of pieces: a double rule with its corners cut. */
export function printBerth(width: number, height: number): Print {
	return sheet(width, height, context => {
		const frame = (inset: number, cut: number) => {
			const right = width - inset;
			const bottom = height - inset;
			context.beginPath();
			context.moveTo(inset + cut, inset);
			context.lineTo(right - cut, inset);
			context.lineTo(right, inset + cut);
			context.lineTo(right, bottom - cut);
			context.lineTo(right - cut, bottom);
			context.lineTo(inset + cut, bottom);
			context.lineTo(inset, bottom - cut);
			context.lineTo(inset, inset + cut);
			context.closePath();
		};
		frame(0.1, 0.7);
		context.fillStyle = 'rgb(233 220 189 / 0.35)';
		context.fill();
		context.strokeStyle = INK;
		context.lineWidth = 0.09;
		context.stroke();
		frame(0.32, 0.6);
		context.lineWidth = 0.035;
		context.stroke();
	});
}

export type DiscTone = 'plain' | 'infested' | 'forsaken';

const GRUNGE_PALETTE = {
	infested: {
		top: '#d2ff4d',
		mid: '#9ce022',
		bottom: '#70b812',
		outline: '#1b2e05',
		deep: 'rgb(44 88 6 / 0.44)',
		bright: 'rgb(235 255 140 / 0.52)',
		splatter: '#9ce022',
		splatterDark: '#3f7308',
	},
	forsaken: {
		top: '#ff5c4d',
		mid: '#ec2a20',
		bottom: '#b81610',
		outline: '#3b0806',
		deep: 'rgb(118 10 8 / 0.42)',
		bright: 'rgb(255 162 142 / 0.48)',
		splatter: '#e82c22',
		splatterDark: '#7d0e0a',
	},
} as const;

function mulberry32(seed: number) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Draws a tiny jagged polygon shard around `(x, y)` for organic chipped-paint grunge instead of smooth circles. */
function jaggedChip(context: CanvasRenderingContext2D, x: number, y: number, radius: number, rand: () => number) {
	const sides = 5 + Math.floor(rand() * 3);
	const start = rand() * Math.PI * 2;
	context.beginPath();
	for (let i = 0; i < sides; i++) {
		const angle = start + (i / sides) * Math.PI * 2 + (rand() - 0.5) * 0.35;
		const r = radius * (0.45 + rand() * 0.75);
		const px = x + Math.cos(angle) * r;
		const py = y + Math.sin(angle) * r;
		if (i === 0) context.moveTo(px, py);
		else context.lineTo(px, py);
	}
	context.closePath();
	context.fill();
}

/** The face of a city's disc: its population as a large numeral, distressed in green or red when infested or forsaken. */
export function printDisc(population: number, size: number, color: string, tone: DiscTone = 'plain'): Print {
	return sheet(size, size, context => {
		const text = String(population);
		if (tone === 'plain') {
			context.textAlign = 'center';
			context.textBaseline = 'middle';
			context.fillStyle = color;
			context.font = `700 ${size * 0.82}px ${NUMBER_FONT}`;
			context.fillText(text, size / 2, size * 0.54);
			return;
		}

		const palette = GRUNGE_PALETTE[tone];
		const rand = mulberry32(((population + 3) * 2654435761) ^ (tone === 'forsaken' ? 0x9e3779b9 : 0x517cc1b7));
		const cx = size / 2;
		const cy = size * 0.535;
		const tilt = (rand() - 0.5) * 0.08 + (tone === 'forsaken' ? -0.035 : 0.025);
		const font = `700 ${size * 0.86}px ${NUMBER_FONT}`;

		// Paint the distressed numeral on an offscreen layer so erosion cutouts never nibble the surrounding flecks.
		const glyphCanvas = document.createElement('canvas');
		glyphCanvas.width = Math.ceil(size * PX_PER_UNIT);
		glyphCanvas.height = Math.ceil(size * PX_PER_UNIT);
		const g = glyphCanvas.getContext('2d')!;
		g.scale(PX_PER_UNIT, PX_PER_UNIT);

		g.save();
		g.translate(cx, cy);
		g.rotate(tilt);
		g.textAlign = 'center';
		g.textBaseline = 'middle';
		g.lineJoin = 'round';
		g.lineCap = 'round';
		g.font = font;

		// Thin dark rough-stamped rim keeps green readable on yellow/red discs and red crisp on stone gray
		// without darkening the numeral's color at full-map zoom.
		g.strokeStyle = palette.outline;
		g.lineWidth = size * 0.068;
		g.strokeText(text, size * 0.012, size * 0.014);
		g.lineWidth = size * 0.052;
		g.strokeText(text, -size * 0.008, -size * 0.006);

		const fill = g.createLinearGradient(0, -size * 0.4, 0, size * 0.4);
		fill.addColorStop(0, palette.top);
		fill.addColorStop(0.55, palette.mid);
		fill.addColorStop(1, palette.bottom);
		g.fillStyle = fill;
		g.fillText(text, 0, 0);

		// Organic paint mottling inside the numeral using saturated dark/light tones of the same hue.
		g.globalCompositeOperation = 'source-atop';
		for (let i = 0; i < 42; i++) {
			g.fillStyle = i % 3 === 0 ? palette.bright : palette.deep;
			const x = (rand() - 0.5) * size * 0.66;
			const y = (rand() - 0.5) * size * 0.74;
			jaggedChip(g, x, y, size * (0.022 + rand() * 0.055), rand);
		}
		// Subtle weathered brush-grain scuffs in the deeper hue.
		g.strokeStyle = palette.deep;
		for (let i = 0; i < 9; i++) {
			const x0 = (rand() - 0.5) * size * 0.45;
			const y0 = (rand() - 0.5) * size * 0.65;
			const angle = (rand() - 0.5) * 1.1;
			const len = size * (0.1 + rand() * 0.22);
			g.lineWidth = size * (0.007 + rand() * 0.012);
			g.beginPath();
			g.moveTo(x0 - Math.cos(angle) * len * 0.5, y0 - Math.sin(angle) * len * 0.5);
			g.lineTo(x0 + Math.cos(angle) * len * 0.5, y0 + Math.sin(angle) * len * 0.5);
			g.stroke();
		}

		// Porous stamped-paint erosion, micro-pitting, and ragged chipped notches (kept fine so digits read clearly at map scale).
		g.globalCompositeOperation = 'destination-out';
		g.fillStyle = '#000';
		for (let i = 0; i < 64; i++) {
			const x = (rand() - 0.5) * size * 0.64;
			const y = (rand() - 0.5) * size * 0.74;
			jaggedChip(g, x, y, size * (0.006 + rand() * 0.015), rand);
		}
		// Fine short organic hairline cracks.
		g.strokeStyle = '#000';
		for (let i = 0; i < 4; i++) {
			let px = (rand() - 0.5) * size * 0.42;
			let py = (rand() - 0.5) * size * 0.58;
			const baseAngle = rand() * Math.PI * 2;
			g.lineWidth = size * (0.006 + rand() * 0.008);
			g.beginPath();
			g.moveTo(px, py);
			for (let seg = 0; seg < 3; seg++) {
				const step = size * (0.045 + rand() * 0.055);
				const a = baseAngle + (rand() - 0.5) * 0.9;
				px += Math.cos(a) * step;
				py += Math.sin(a) * step;
				g.lineTo(px, py);
			}
			g.stroke();
		}
		g.restore();

		// Organic fine grunge flecks near the numeral, kept well inside the disc's inner ring.
		for (let i = 0; i < 22; i++) {
			const angle = rand() * Math.PI * 2;
			const dist = size * (0.23 + rand() * 0.17);
			const x = cx + Math.cos(angle) * dist;
			const y = cy + Math.sin(angle) * dist;
			context.fillStyle = i % 4 === 0 ? palette.splatterDark : palette.splatter;
			context.globalAlpha = 0.5 + rand() * 0.4;
			jaggedChip(context, x, y, size * (0.009 + rand() * 0.018), rand);
		}
		context.globalAlpha = 1;
		context.drawImage(glyphCanvas, 0, 0, size, size);
	});
}

/** An anchor about two units tall around the origin, stroked in the context's current colour. */
function anchor(context: CanvasRenderingContext2D, weight: number) {
	context.lineCap = 'round';
	context.lineWidth = weight;
	context.beginPath();
	context.arc(0, -0.85, 0.22, 0, Math.PI * 2);
	context.moveTo(0, -0.63);
	context.lineTo(0, 0.95);
	context.moveTo(-0.5, -0.3);
	context.lineTo(0.5, -0.3);
	context.moveTo(-0.85, 0.25);
	context.quadraticCurveTo(-0.7, 0.95, 0, 0.95);
	context.quadraticCurveTo(0.7, 0.95, 0.85, 0.25);
	context.stroke();
}

/**
 * A sticker printed on the board, like the ones the campaign adds: a paper roundel with a glyph for what
 * stands there for good.
 */
export function printSticker(kind: PrintedKind, size: number): Print {
	return sheet(size, size, context => {
		const r = size / 2;
		context.translate(r, r);
		context.beginPath();
		context.arc(0, 0, r * 0.94, 0, Math.PI * 2);
		context.fillStyle = kind === 'lab' ? '#dfe8ef' : kind === 'infested' ? '#dde4cb' : '#f1e7cf';
		context.fill();
		context.lineWidth = r * 0.1;
		context.strokeStyle = kind === 'lab' ? '#3d618f' : kind === 'infested' ? '#3b5210' : '#7a3a22';
		context.stroke();
		context.beginPath();
		context.arc(0, 0, r * 0.78, 0, Math.PI * 2);
		context.lineWidth = r * 0.03;
		context.stroke();
		context.fillStyle = context.strokeStyle;
		context.lineCap = 'round';
		context.lineJoin = 'round';
		context.scale(r, r);
		glyph(context, kind);
	});
}

/** Draws in a unit circle around the origin. */
function glyph(context: CanvasRenderingContext2D, kind: PrintedKind) {
	context.beginPath();
	switch (kind) {
		case 'center':
			context.moveTo(-0.42, -0.02);
			context.lineTo(0, -0.44);
			context.lineTo(0.42, -0.02);
			context.lineTo(0.3, -0.02);
			context.lineTo(0.3, 0.4);
			context.lineTo(-0.3, 0.4);
			context.lineTo(-0.3, -0.02);
			context.closePath();
			context.fill();
			return;
		case 'tower':
			context.lineWidth = 0.09;
			context.moveTo(-0.22, 0.44);
			context.lineTo(0, -0.12);
			context.lineTo(0.22, 0.44);
			context.moveTo(-0.13, 0.22);
			context.lineTo(0.13, 0.22);
			context.stroke();
			context.beginPath();
			context.arc(0, -0.2, 0.09, 0, Math.PI * 2);
			context.fill();
			context.beginPath();
			context.arc(0, -0.2, 0.26, -Math.PI * 0.85, -Math.PI * 0.15);
			context.moveTo(Math.cos(-Math.PI * 0.88) * 0.42, -0.2 + Math.sin(-Math.PI * 0.88) * 0.42);
			context.arc(0, -0.2, 0.42, -Math.PI * 0.88, -Math.PI * 0.12);
			context.stroke();
			return;
		case 'shelter':
			context.arc(0, 0.28, 0.46, Math.PI, 0);
			context.closePath();
			context.fill();
			context.beginPath();
			context.fillStyle = '#f1e7cf';
			context.rect(-0.1, 0.06, 0.2, 0.22);
			context.fill();
			return;
		case 'lab':
			context.moveTo(-0.13, -0.44);
			context.lineTo(0.13, -0.44);
			context.lineTo(0.13, -0.12);
			context.lineTo(0.4, 0.36);
			context.quadraticCurveTo(0.42, 0.44, 0.32, 0.44);
			context.lineTo(-0.32, 0.44);
			context.quadraticCurveTo(-0.42, 0.44, -0.4, 0.36);
			context.lineTo(-0.13, -0.12);
			context.closePath();
			context.fill();
			return;
		case 'infested': {
			// Plague rat silhouette: arched haunch, pointed snout, upright ear, tucked paws, and S-curved tail.
			context.moveTo(-0.34, 0.22);
			context.bezierCurveTo(-0.36, -0.14, -0.06, -0.32, 0.16, -0.14);
			context.quadraticCurveTo(0.24, -0.28, 0.32, -0.2);
			context.quadraticCurveTo(0.34, -0.1, 0.28, -0.04);
			context.lineTo(0.5, 0.1);
			context.quadraticCurveTo(0.48, 0.18, 0.34, 0.2);
			context.lineTo(0.24, 0.28);
			context.lineTo(0.18, 0.28);
			context.lineTo(0.16, 0.22);
			context.lineTo(-0.12, 0.22);
			context.lineTo(-0.18, 0.3);
			context.lineTo(-0.28, 0.3);
			context.closePath();
			context.fill();
			// Tail curling up behind the haunch.
			context.beginPath();
			context.lineWidth = 0.085;
			context.moveTo(-0.32, 0.2);
			context.bezierCurveTo(-0.56, 0.24, -0.58, -0.16, -0.34, -0.32);
			context.stroke();
			// Pale eye dot.
			context.beginPath();
			context.fillStyle = '#dde4cb';
			context.arc(0.32, 0.05, 0.038, 0, Math.PI * 2);
			context.fill();
			return;
		}
	}
}
