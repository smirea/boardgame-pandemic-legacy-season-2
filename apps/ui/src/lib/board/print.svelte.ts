import { CanvasTexture, SRGBColorSpace } from 'three';

/** Something painted onto a transparent sheet, sized in board units, to lie flat on the chart. */
export type Print = { texture: CanvasTexture; width: number; height: number };

export type PrintedKind = 'center' | 'tower' | 'shelter' | 'lab';

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

/** The face of a city's disc: its population as a large numeral. */
export function printDisc(population: number, size: number, color: string): Print {
	return sheet(size, size, context => {
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.fillStyle = color;
		context.font = `700 ${size * 0.82}px ${NUMBER_FONT}`;
		context.fillText(String(population), size / 2, size * 0.54);
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
		context.fillStyle = kind === 'lab' ? '#dfe8ef' : '#f1e7cf';
		context.fill();
		context.lineWidth = r * 0.1;
		context.strokeStyle = kind === 'lab' ? '#3d618f' : '#7a3a22';
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
	}
}
