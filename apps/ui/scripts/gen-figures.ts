#!/usr/bin/env bun
/**
 * Draws the characters players can be, each from the waist up on a transparent background, with Codex's built-in
 * image generation, into `apps/ui/static/figures/<key>.webp`, and finds the head in each for the square portraits
 * cropped from them (`#lib/characters/figures.generated.ts`). The story's cast is shown to Codex as people the
 * figures must not look like.
 *
 * Usage:
 *   ./apps/ui/scripts/gen-figures.ts                  # draw the figures that are missing, then find every head
 *   ./apps/ui/scripts/gen-figures.ts survivor-3 ...   # draw these again
 *   ./apps/ui/scripts/gen-figures.ts --heads          # only find the heads again
 *   ./apps/ui/scripts/gen-figures.ts --from <dir>     # keep the drawings <dir>/<key>.png made earlier
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { $ } from 'bun';

const ROOT = resolve(dirname(import.meta.path), '../../..');
const OUT_DIR = resolve(ROOT, 'apps/ui/static/figures');
const CAST_DIR = resolve(ROOT, 'apps/ui/static/cast');
const HEADS = resolve(ROOT, 'apps/ui/src/lib/characters/figures.generated.ts');
const PARALLEL = 6;

const SAFE =
	'Stay away from everything the story cast wears: no lab coat, no round glasses, no headband, no red face stripes, no walkie-talkie or radio, no yellow raincoat with a black turtleneck, no goggles pushed up on the head, no gas mask, no red scarf with a dark trench coat, no naval officer coat.';

/** Who each figure is. The survivors are the portraits anyone may wear; the rest belong to an occupation. */
export const FIGURES: Record<string, string> = {
	'survivor-0':
		'A wiry woman in her sixties with a close-cropped white buzz cut and deep laugh lines, in a patched teal fisherman smock under a knitted grey shawl. She holds a basket of salted fish on her hip with both arms and is chuckling. Warm, sharp-tongued grandmother of the docks.',
	'survivor-1':
		'A broad-shouldered young man with a shaved head, a thick neck and a small gold nose ring, in a sleeveless rust-red quilted vest over bare arms tattooed with simple wave lines. Arms folded across his chest, chin up, smirking. Cocky, unflappable bruiser.',
	'survivor-2':
		'A lanky teenage girl with a wild mop of copper curls tied back with wire, freckles, in an oversized olive army jacket with rolled sleeves. A crowbar slung over one shoulder, the other hand on her hip, head tilted with a crooked grin. Daring scavenger.',
	'survivor-3':
		'A tall, gaunt man in his forties with long straight black hair loose to the shoulders and hollow cheeks, wrapped in a heavy charcoal wool poncho. His hands are hidden under the poncho, shoulders hunched, watching the viewer sidelong. Guarded and mysterious.',
	'survivor-4':
		'A stocky middle-aged woman with a grey-streaked brown bob, in denim coveralls with the top half tied around her waist over a sleeveless white undershirt, grease smudges on her arms. Wiping her hands on a rag, a big wrench sticking out of a pocket. Practical mechanic, impatient to get back to work.',
	'survivor-5':
		'A young South Asian man with a neat side-parted haircut and a thin moustache, in a burgundy wool peacoat over a cream cable-knit sweater. He holds a brass sextant against his chest and looks off to one side with a determined gaze. Proud navigator, a visionary.',
	'survivor-6':
		'A plump, round-faced East Asian woman in her thirties with a high bun stuck through with pencils, in a quilted moss-green down jacket under a canvas apron full of pockets. One hand on the strap of a first-aid satchel, the other open, palm up, reassuring someone. Gentle field medic with tired eyes and a kind smile.',
	'survivor-7':
		'An elderly Indigenous woman with long silver hair in two braids wrapped in red cloth, deep-set eyes, in a heavy blanket coat woven with geometric patterns. Both weathered hands rest on top of a tall carved walking staff in front of her. Wise, stern elder everyone listens to.',
	'survivor-8':
		'A muscular woman in her twenties with a shaved undercut and a single top braid, in a black sleeveless judo-style jacket tied with a frayed belt, one forearm bandaged. One wrapped fist raised in front of her chest, leaning in. Fierce and defiant fighter.',
	'survivor-9':
		'A heavy-set old man with a huge white walrus moustache, bushy eyebrows and red-veined cheeks, clean chin, in a navy knit fisherman cap and a sea-green oilskin jacket. He holds a battered storm lantern up at shoulder height. Grim, stoic old sailor.',
	'survivor-10':
		'A skinny Black man in his thirties with short twists and a pencil-thin goatee, in a short-sleeved orange work shirt with a blank name patch and a tool belt. He holds a soldering iron and a coil of copper wire, glancing up with a sardonic half-smile. Wry tinkerer.',
	'survivor-11':
		'A small, wiry teenage boy with a shaggy blond bowl cut, in a too-big grey hooded sweatshirt with a messenger bag across his body. Leaning forward mid-stride, one arm swinging, looking back over his shoulder. Nervous, quick runner.',
	'survivor-12':
		'A Middle-Eastern woman in her fifties in a patterned olive headscarf, a strong nose and kohl-lined eyes, in a long camel-coloured coat. She holds up an open ledger and points into it with a pencil. Calm, exacting quartermaster who keeps the count.',
	'survivor-13':
		'A sharp-featured man in his thirties with slicked-back hair and a pencil moustache, in a scavenged pinstripe waistcoat over a collarless shirt, a pocket-watch chain. One hand on his hip, the other holding up a small coin between two fingers, one eyebrow raised. Shrewd bargainer.',
	'survivor-14':
		'A huge, bald Pacific Islander man with a full black beard and wave tattoos across his shoulders, in a sleeveless canvas work vest. A heavy coil of rope over one shoulder, the other hand giving a thumbs-up, laughing. Big, warm, jovial dockworker.',
	'survivor-15':
		'A slender androgynous person in their twenties with bleached white hair shaved on one side, pale grey eyes and many small earrings, in a long deep-purple robe-like coat. Hands clasped at the chest around a string of wooden beads, head slightly bowed, eyes on the viewer. Enigmatic, serene mystic.',
	immunologist:
		'A Latina woman in her forties with short curly black hair, in a pale-blue surgical gown and a cloth cap, rubber gloves pulled up to the elbows. She holds a syringe upright and flicks it with a finger to clear a bubble. Brilliant, intense immunologist.',
	'vector-control':
		'A rangy red-haired man in his thirties with a ginger stubble beard, in a bright orange coverall unzipped to the waist with the sleeves tied around it over a sweat-stained grey tank top. A metal pump-sprayer tank on his back, its spray wand in one hand. Determined, no-nonsense pest controller.',
	scientist:
		'A heavyset older East Asian man, bald with a grey fringe of hair and clean-shaven, in a moss-green knitted cardigan over a collared shirt and a bow tie. He holds a small chalk slate covered in abstract chalk marks (no legible text) and a stub of chalk, gazing upward, lost in thought. Absent-minded scientist.',
	'haven-worker':
		'An anonymous haven worker of unknown gender under the deep hood of a grey-green rubber rain cape, the face completely hidden in shadow and a wrapped dark cloth, no goggles. Carrying a wooden supply crate against the chest with both arms. Faceless, steady, dependable.',
	unknown:
		'A generic placeholder person for a character not yet made: a plain figure in a long coat, standing square to the viewer, arms relaxed, no distinguishing features and no accessories. Render the whole figure as ONE flat solid near-black (#14110e) silhouette with no interior detail at all.',
};

function prompt(key: string, cast: string, out: string) {
	return `Use your built-in image generation tool (image_gen). Do not write code and do not draw with scripts.

First look at this reference with view_image: ${cast}
It shows the ART STYLE to match: inked graphic-novel illustration, bold black linework, flat muted colours with gritty print texture, a waist-up cutout on a transparent background.
The six people in it are the story's cast. The character you draw must look COMPLETELY DIFFERENT from every one of them: a different face, hair, build, outfit, colours and props. ${SAFE}

Generate ONE new image:
- Character, pose and personality: ${FIGURES[key]}
- Framing: portrait orientation (1024x1536). The figure from roughly the waist up, centred, filling most of the width. Leave a small empty margin above the head. The body runs off the bottom edge at the waist.
- The head must be clearly readable in the upper third, in front or three-quarter view, so that a square headshot can be cropped from it.
- Background: fully transparent (a real alpha channel). No backdrop, no floor, no frame, no shadow, no glow, no text, no logo.

When the image is generated, copy the PNG file to exactly: ${out}
Then reply with just the path.`;
}

async function draw(key: string, work: string, cast: string) {
	const png = join(work, `${key}.png`);
	const result =
		await $`codex exec --skip-git-repo-check -c model_reasoning_effort=low -C ${work} ${prompt(key, cast, png)} < /dev/null`
			.quiet()
			.nothrow();
	if (!existsSync(png)) throw new Error(`Codex drew nothing for ${key}:\n${result.stderr.toString().slice(-2000)}`);
	place(key, png);
	console.log(`drew ${key}`);
}

/** Trims a drawing to its figure, so each stands on the bottom edge scaled by its own body, and keeps it as webp. */
function place(key: string, png: string) {
	const run = (command: string, args: string[]) => {
		const result = spawnSync(command, args, { encoding: 'utf8' });
		if (result.status !== 0) throw new Error(`${command} failed for ${key}: ${result.stderr}`);
		return result.stdout.trim();
	};
	if (run('magick', [png, '-format', '%[opaque]', 'info:']) === 'True')
		throw new Error(`${key} came back without a transparent background`);
	const trimmed = `${png}.trimmed.png`;
	run('magick', [png, '-trim', '+repage', '-resize', '800x1200>', trimmed]);
	run('cwebp', ['-quiet', '-q', '84', '-alpha_q', '90', trimmed, '-o', join(OUT_DIR, `${key}.webp`)]);
}

const DETECT = `
import Foundation
import Vision
import AppKit
for path in CommandLine.arguments.dropFirst() {
	guard let image = NSImage(contentsOfFile: path), let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print("{}"); continue }
	let request = VNDetectFaceRectanglesRequest()
	try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([request])
	let faces = (request.results ?? []).sorted { $0.boundingBox.width * $0.boundingBox.height > $1.boundingBox.width * $1.boundingBox.height }
	if let face = faces.first?.boundingBox {
		print("{\\"x\\":\\(face.midX),\\"y\\":\\(1 - face.midY),\\"w\\":\\(face.width),\\"h\\":\\(face.height),\\"aspect\\":\\(Double(cg.width) / Double(cg.height))}")
	} else {
		print("{\\"aspect\\":\\(Double(cg.width) / Double(cg.height))}")
	}
}`;

type Found = { x?: number; y?: number; w?: number; h?: number; aspect: number };

/**
 * The square a portrait is cut from, in fractions of the figure's width and height. A face Vision cannot find (a
 * hood, a mask) is taken to be where the top of the body is.
 */
async function heads(keys: string[], work: string) {
	const script = join(work, 'detect.swift');
	writeFileSync(script, DETECT);
	const files = keys
		.map(key => join(OUT_DIR, `${key}.webp`))
		.map(file => {
			const png = join(work, `${file.split('/').at(-1)}.png`);
			spawnSync('magick', [file, png]);
			return png;
		});
	const lines = spawnSync('swift', [script, ...files], { encoding: 'utf8' })
		.stdout.trim()
		.split('\n');
	const boxes: Record<string, { x: number; y: number; size: number; aspect: number }> = {};
	for (const [index, key] of keys.entries()) {
		const found = JSON.parse(lines[index] ?? '{}') as Found;
		let box;
		if (found.x !== undefined && found.w !== undefined && found.h !== undefined && found.y !== undefined) {
			// A face box covers brow to chin; a portrait shows the whole head and a little of the shoulders.
			const size = Math.max(found.w, found.h / found.aspect) * 2.1;
			box = { x: found.x, y: found.y - 0.16 * found.h, size };
		} else {
			const top = await topOfBody(files[index]!);
			box = { x: top.x, y: top.y + 0.24 * found.aspect, size: 0.5 };
			console.log(`no face found in ${key}: guessed from the outline`);
		}
		boxes[key] = { x: round(box.x), y: round(box.y), size: round(Math.min(1, box.size)), aspect: round(found.aspect) };
	}
	return boxes;
}

/** The middle of the opaque pixels in the band just under the top of the figure, in fractions of its size. */
async function topOfBody(png: string) {
	const [width, height] = (await $`magick ${png} -format "%w %h" info:`.text()).trim().split(' ').map(Number) as [
		number,
		number,
	];
	const alpha = await $`magick ${png} -alpha extract -depth 8 gray:-`.arrayBuffer();
	const pixels = new Uint8Array(alpha);
	let first = 0;
	while (first < height && !pixels.subarray(first * width, (first + 1) * width).some(value => value > 128)) first++;
	let sum = 0;
	let count = 0;
	for (let y = first; y < Math.min(height, first + height * 0.12); y++)
		for (let x = 0; x < width; x++)
			if (pixels[y * width + x]! > 128) {
				sum += x;
				count++;
			}
	return { x: count ? sum / count / width : 0.5, y: first / height };
}

const round = (value: number) => Math.round(value * 1000) / 1000;

const args = process.argv.slice(2);
const only = args.filter((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--from');
for (const key of only) if (!FIGURES[key]) throw new Error(`No figure called ${key}`);
mkdirSync(OUT_DIR, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'figures-'));
try {
	const from = args.includes('--from') ? args[args.indexOf('--from') + 1] : undefined;
	if (from) {
		for (const key of Object.keys(FIGURES))
			if (existsSync(join(from, `${key}.png`))) place(key, join(from, `${key}.png`));
	} else if (!args.includes('--heads')) {
		const cast = join(work, 'cast.png');
		const faces = readdirSync(CAST_DIR).map(file => join(CAST_DIR, file));
		spawnSync('magick', ['montage', '-background', '#556', '-tile', '6x1', '-geometry', '256x341+4+4', ...faces, cast]);
		if (!existsSync(cast)) throw new Error('Could not draw the sheet of the cast');
		const todo = only.length ? only : Object.keys(FIGURES).filter(key => !existsSync(join(OUT_DIR, `${key}.webp`)));
		const queue = [...todo];
		const failures: string[] = [];
		await Promise.all(
			Array.from({ length: PARALLEL }, async () => {
				for (let key = queue.shift(); key; key = queue.shift())
					await draw(key, work, cast).catch((error: Error) => failures.push(error.message));
			}),
		);
		if (failures.length) console.error(failures.join('\n\n'));
	}
	const keys = Object.keys(FIGURES).filter(key => key !== 'unknown' && existsSync(join(OUT_DIR, `${key}.webp`)));
	const boxes = await heads(keys, work);
	writeFileSync(
		HEADS,
		`// Written by apps/ui/scripts/gen-figures.ts. The square each portrait is cut from, as fractions of its figure:\n// the centre (x, y) and the side as a fraction of the figure's width, and the figure's width over its height.\nexport const HEADS: Record<string, { x: number; y: number; size: number; aspect: number }> = ${JSON.stringify(boxes, null, '\t')};\n`,
	);
	console.log(`found ${keys.length} heads`);
} finally {
	rmSync(work, { recursive: true, force: true });
}
