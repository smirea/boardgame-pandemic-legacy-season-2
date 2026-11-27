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
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { $ } from "bun";

const ROOT = resolve(dirname(import.meta.path), "../../..");
const OUT_DIR = resolve(ROOT, "apps/ui/static/figures");
const CAST_DIR = resolve(ROOT, "apps/ui/static/cast");
const HEADS = resolve(ROOT, "apps/ui/src/lib/characters/figures.generated.ts");
const PARALLEL = 6;

const SAFE =
  "Stay away from everything the story cast wears: no lab coat, no round glasses, no headband, no red face stripes, no walkie-talkie or radio, no yellow raincoat with a black turtleneck, no goggles pushed up on the head, no gas mask, no red scarf with a dark trench coat, no naval officer coat.";

/** Who each figure is. The survivors are the portraits anyone may wear; the rest belong to an occupation. */
export const FIGURES: Record<string, string> = {
  "survivor-0":
    "A weathered pale glacial blue-grey Faded coastal scout in their thirties under a patched muted sea-slate hooded coat with brass dust goggles pushed onto the hood and a muted olive cloth wrap pulled up over nose and mouth. Dark tousled hair, guarded unsmiling eyes, carrying a canvas field satchel.",
  "survivor-1":
    "A broad-shouldered pale glacial blue-grey Faded harbor bosun in his late thirties with a close brown buzz cut and stubble, in a weathered rust-terracotta coat over a dark charcoal knit, a heavy coil of mooring rope slung over his right shoulder. Stoic, unsmiling, square-jawed grit.",
  "survivor-2":
    "A lanky pale glacial blue-grey Faded young woman with a wild mop of copper curls tied back with wire and slate-blue freckles, in an oversized weathered olive field jacket with rolled sleeves. A crowbar slung over one shoulder, the other hand on her hip, tilted head with a playful toothy grin.",
  "survivor-3":
    "A tall, gaunt pale glacial blue-grey Faded man in his forties with long straight black hair loose to the shoulders and hollow cheeks, wrapped in a heavy muted charcoal wool fringed poncho. Guarded, solemn, unsmiling sidelong gaze.",
  "survivor-4":
    "A stocky middle-aged pale glacial blue-grey Faded hull mechanic with grey-streaked brown hair tied back in a dusty rust bandana, in weathered dark navy coveralls with rolled sleeves and grease smudges. Resting a heavy pipe wrench across one shoulder with a fierce, unsmiling stare.",
  "survivor-5":
    "A weathered pale glacial blue-grey Faded sea navigator in his early thirties with windswept chestnut hair, light stubble, and three pale dots on his temple, in a weathered muted burgundy peacoat over a cream cable-knit sweater. Holding a brass sextant and leather chart tube with a subtle, confident smile.",
  "survivor-6":
    "A lean pale glacial blue-grey Faded field medic woman in her thirties with dark wavy hair under a weathered slate kerchief, in a dusty moss-olive quilted jacket under a stained canvas apron tucked with bandages and glass vials, leather satchel over her shoulder. Tired, steady, solemn unsmiling eyes.",
  "survivor-7":
    "An elderly pale glacial blue-grey Faded helmswoman with silver-streaked braids threaded with pale sea-glass beads and vertical ochre cheek markings, in a patched earth-brown wool storm coat. Gloved weathered hands resting on an aged brass-capped oak boathook, stern dignified unsmiling gaze.",
  "survivor-8":
    "An agile pale glacial blue-grey Faded courier woman in her twenties with lush wavy dark auburn hair swept into a windblown ponytail, stitched dull-ochre cloth face mask over nose and mouth, brass goggles at her throat, dark charcoal runner's vest and dusty khaki pack. Fierce, focused, unsmiling eyes.",
  "survivor-9":
    "A heavy-set elderly pale glacial blue-grey Faded sailor with a huge snow-white walrus moustache and bushy eyebrows, in a dark navy knit cap and a weathered dark pine sea-green oilskin coat. Holding an unlit aged iron storm lantern up at shoulder height with a grim, stoic scowl.",
  "survivor-10":
    "A lean pale glacial blue-grey Faded Black tinkerer in his thirties with short jet-black twists under a patched olive utility cap and a neat goatee, in a weathered burnt-orange utility jacket with a harness relay box. Holding pliers and a coil of copper wire with a wry, sardonic half-smile.",
  "survivor-11":
    "A lean pale glacial blue-grey Faded young sea courier in his early twenties with tousled dusty sandy-blonde windswept hair, in a weathered muted slate-grey hooded waxed anorak with brass goggles at his throat and a canvas satchel. Alert, watchful, unsmiling gaze.",
  "survivor-12":
    "A stern pale glacial blue-grey Faded quartermaster woman in her late forties with silver-streaked chestnut curls wrapped in a muted dusty-olive headscarf, in a weathered camel coat. Holding a worn leather manifest ledger and a dull brass pencil with a calm, exacting unsmiling expression.",
  "survivor-13":
    "A sharp-featured pale glacial blue-grey Faded salvage broker in his thirties with slicked-back dark mahogany wavy hair and a thin trimmed moustache, in a weathered umber leather dock coat over a dusty burgundy pinstripe waistcoat with a pocket-watch chain, holding an aged brass flare pistol with a sly crooked smirk.",
  "survivor-14":
    "A towering bald pale glacial blue-grey Faded rigger with a full dark brown beard and faded slate maritime compass-and-rope forearm tattoos, in a weathered slate-olive patched canvas vest over dark umber rolled sleeves. Heavy iron chain and grappling hook over one shoulder, stoic rock-steady unsmiling gaze.",
  "survivor-15":
    "A slender androgynous pale glacial blue-grey Faded mystic in their twenties with bleached ash-white hair swept over one side and shaved on the other, pale slate eyes and many small antique-gold earrings, in a muted dusty deep-plum robe with dull gold trim. Hands clasped around wooden beads, serene unsmiling stillness.",
  immunologist:
    "A 37-year-old Argentine male mainlander field immunologist from Buenos Aires (natural warm olive-tan skin, not Faded) with dark wavy hair in two loose shoulder braids and light stubble, wearing a weathered stained white lab coat over an olive field shirt and grey gloves, holding a metal specimen canister and glass vial. Focused, intense, driven.",
  "vector-control":
    "A 42-year-old rugged bearded mainlander pest-control specialist from Wellington (natural sun-weathered skin, not Faded) in a patterned dark maroon bandana, heavy dark charcoal field jacket and leather work gloves, with a battered metal pump-sprayer tank on his back and brass spray wand in hand. Grim, no-nonsense grit.",
  scientist:
    "A 35-year-old female mainlander field scientist from Johannesburg (natural warm skin, not Faded) with tousled dark brown wavy hair, wearing a stained weathered white lab coat over a muted rose-rust knit sweater, clutching a worn leather field notebook and a glass Erlenmeyer flask with pipette. Sharp, intense, resourceful.",
  "haven-worker":
    "A pale glacial blue-grey Faded haven supply worker in a weathered charcoal knit beanie, clear protective dust goggles, muted olive cloth wrap pulled up over nose and mouth, and patched brown canvas work coat, carrying a stenciled wooden supply crate against the chest in heavy gloves. Steady, anonymous, dependable.",
  unknown:
    "A generic placeholder person for a character not yet made: a plain figure in a long coat, standing square to the viewer, arms relaxed, no distinguishing features and no accessories. Render the whole figure as ONE flat solid near-black (#14110e) silhouette with no interior detail at all.",
};

function prompt(key: string, cast: string, out: string) {
  return `Use your built-in image generation tool (image_gen). Do not write code and do not draw with scripts.

First look at this reference with view_image: ${cast}
It shows the ART STYLE to match: inked graphic-novel illustration, bold black linework, flat muted colours with gritty print texture, a waist-up cutout on a transparent background.
The six people in it are the story's cast. The character you draw must look COMPLETELY DIFFERENT from every one of them: a different face, hair, build, outfit, colours and props. ${SAFE}

Generate ONE new image:
- Character, pose and personality: ${FIGURES[key]}
- Framing: portrait orientation (1024x1536). The figure from roughly the waist up, centred, filling most of the width. Leave a small empty margin above the head. The body runs off the bottom edge at the waist.
- The head must be clearly readable in the upper third, so that a square headshot can be cropped from it. The face looks front or three-quarter toward the viewer's RIGHT, never to the left: a figure standing on the right of the screen is mirrored to look across its card.
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
  if (!existsSync(png))
    throw new Error(`Codex drew nothing for ${key}:\n${result.stderr.toString().slice(-2000)}`);
  place(key, png);
  console.log(`drew ${key}`);
}

/** Trims a drawing to its figure, so each stands on the bottom edge scaled by its own body, and keeps it as webp. */
function place(key: string, png: string) {
  const run = (command: string, args: string[]) => {
    const result = spawnSync(command, args, { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`${command} failed for ${key}: ${result.stderr}`);
    return result.stdout.trim();
  };
  if (run("magick", [png, "-format", "%[opaque]", "info:"]) === "True")
    throw new Error(`${key} came back without a transparent background`);
  const trimmed = `${png}.trimmed.png`;
  run("magick", [png, "-trim", "+repage", "-resize", "800x1200>", trimmed]);
  run("cwebp", [
    "-quiet",
    "-q",
    "84",
    "-alpha_q",
    "90",
    trimmed,
    "-o",
    join(OUT_DIR, `${key}.webp`),
  ]);
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

// Fallback crop boxes when Vision cannot detect a face (cloth masks, goggles, wild hair/ponytail skewing top-of-body).
const HEAD_FALLBACKS: Record<string, { x: number; y: number; size: number }> = {
  "survivor-0": { x: 0.61, y: 0.165, size: 0.5 },
  "survivor-2": { x: 0.52, y: 0.155, size: 0.5 },
  "survivor-7": { x: 0.58, y: 0.17, size: 0.5 },
  "survivor-8": { x: 0.68, y: 0.175, size: 0.48 },
  "survivor-9": { x: 0.64, y: 0.165, size: 0.48 },
  "haven-worker": { x: 0.58, y: 0.175, size: 0.5 },
};

/**
 * The square a portrait is cut from, in fractions of the figure's width and height. A face Vision cannot find (a
 * hood, a mask) falls back to a calibrated box or the top of the body.
 */
async function heads(keys: string[], work: string) {
  const script = join(work, "detect.swift");
  writeFileSync(script, DETECT);
  const files = keys
    .map((key) => join(OUT_DIR, `${key}.webp`))
    .map((file) => {
      const png = join(work, `${file.split("/").at(-1)}.png`);
      spawnSync("magick", [file, png]);
      return png;
    });
  const lines = spawnSync("swift", [script, ...files], { encoding: "utf8" })
    .stdout.trim()
    .split("\n");
  const boxes: Record<string, { x: number; y: number; size: number; aspect: number }> = {};
  for (const [index, key] of keys.entries()) {
    const found = JSON.parse(lines[index] ?? "{}") as Found;
    let box;
    if (
      found.x !== undefined &&
      found.w !== undefined &&
      found.h !== undefined &&
      found.y !== undefined
    ) {
      // A face box covers brow to chin; a portrait shows the whole head and a little of the shoulders.
      const size = Math.max(found.w, found.h / found.aspect) * 2.1;
      box = { x: found.x, y: found.y - 0.16 * found.h, size };
    } else if (HEAD_FALLBACKS[key]) {
      box = HEAD_FALLBACKS[key];
      console.log(`no face found in ${key}: used calibrated head box`);
    } else {
      const top = await topOfBody(files[index]!);
      box = { x: top.x, y: top.y + 0.24 * found.aspect, size: 0.5 };
      console.log(`no face found in ${key}: guessed from the outline`);
    }
    boxes[key] = {
      x: round(box.x),
      y: round(box.y),
      size: round(Math.min(1, box.size)),
      aspect: round(found.aspect),
    };
  }
  return boxes;
}

/** The middle of the opaque pixels in the band just under the top of the figure, in fractions of its size. */
async function topOfBody(png: string) {
  const [width, height] = (await $`magick ${png} -format "%w %h" info:`.text())
    .trim()
    .split(" ")
    .map(Number) as [number, number];
  const alpha = await $`magick ${png} -alpha extract -depth 8 gray:-`.arrayBuffer();
  const pixels = new Uint8Array(alpha);
  let first = 0;
  while (
    first < height &&
    !pixels.subarray(first * width, (first + 1) * width).some((value) => value > 128)
  )
    first++;
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
const only = args.filter((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--from");
for (const key of only) if (!FIGURES[key]) throw new Error(`No figure called ${key}`);
mkdirSync(OUT_DIR, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "figures-"));
try {
  const from = args.includes("--from") ? args[args.indexOf("--from") + 1] : undefined;
  if (from) {
    for (const key of Object.keys(FIGURES))
      if (existsSync(join(from, `${key}.png`))) place(key, join(from, `${key}.png`));
  } else if (!args.includes("--heads")) {
    const cast = join(work, "cast.png");
    const faces = readdirSync(CAST_DIR).map((file) => join(CAST_DIR, file));
    spawnSync("magick", [
      "montage",
      "-background",
      "#556",
      "-tile",
      "6x1",
      "-geometry",
      "256x341+4+4",
      ...faces,
      cast,
    ]);
    if (!existsSync(cast)) throw new Error("Could not draw the sheet of the cast");
    const todo = only.length
      ? only
      : Object.keys(FIGURES).filter((key) => !existsSync(join(OUT_DIR, `${key}.webp`)));
    const queue = [...todo];
    const failures: string[] = [];
    await Promise.all(
      Array.from({ length: PARALLEL }, async () => {
        for (let key = queue.shift(); key; key = queue.shift())
          await draw(key, work, cast).catch((error: Error) => failures.push(error.message));
      }),
    );
    if (failures.length) console.error(failures.join("\n\n"));
  }
  const keys = Object.keys(FIGURES).filter(
    (key) => key !== "unknown" && existsSync(join(OUT_DIR, `${key}.webp`)),
  );
  const boxes = await heads(keys, work);
  writeFileSync(
    HEADS,
    `// Written by apps/ui/scripts/gen-figures.ts. The square each portrait is cut from, as fractions of its figure:\n// the centre (x, y) and the side as a fraction of the figure's width, and the figure's width over its height.\nexport const HEADS: Record<string, { x: number; y: number; size: number; aspect: number }> = ${JSON.stringify(boxes, null, "\t")};\n`,
  );
  console.log(`found ${keys.length} heads`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
