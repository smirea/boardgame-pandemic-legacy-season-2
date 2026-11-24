import type { Color } from "@repo/game";
import { CITY_COLOR } from "#lib/board/CityMarker.svelte";
import type { Glyph } from "#lib/board/hints.ts";

/**
 * A glyph set in a line of text, with the words printed after it, which never break from it. `alt` stands in for a
 * glyph with no words where the line is read as plain text.
 */
export type GlyphPart = { glyph: Glyph; color?: string; text?: string; alt?: string };

/** A line of text with game objects drawn as glyphs in it. */
export type Rich = (string | GlyphPart)[];

export const plain = (rich: Rich | string): string =>
  typeof rich === "string"
    ? rich
    : rich
        .map((part) => (typeof part === "string" ? part : (part.text ?? part.alt ?? "")))
        .join("");

/** The colour of the Hollow Men, their pieces and their Infection cards. */
export const HOLLOW_COLOR = "#93b236";

const COLORS = new Set<string>(["blue", "yellow", "black", "red"]);

// The nouns written in rules text, cards and the engine's reasons, each given the glyph of what it names.
// A colour named before a card gives the card that colour.
const NOUNS =
  /\b(?:(blue|yellow|black|red) )?(?:City )?cards? of (?:its|this) colour\b|\b(?:(blue|yellow|black|red) )?City cards?\b|\b(blue|yellow|black|red) cards?\b|\bPlayer cards?\b|\bProduce Supplies(?: cards?)?\b|\b(?:Infection|Gather|Assemble) cards?\b|\b(?:Rationed |Unrationed )?Events?(?: cards?)?\b|\bEpidemics?(?: cards?)?\b|\bPlague cubes?\b|\b(?:Supply |supply |reserve )?cubes?\b|\bHollow M[ae]n\b|\bsupply centers?\b|\bsatellite towers?\b|\bshelters?\b|\bhavens?\b|\blabs?\b|\bscars?\b|\bobjectives?\b|\bPackages? \d+\b|\bdoors? [A-Z0-9]+\b/gi;

/** Text from the rules, cards or engine, with a sharp symbol before every game object it names. */
export function withGlyphs(text: string): Rich {
  const parts: Rich = [];
  let from = 0;
  for (const match of text.matchAll(NOUNS)) {
    const words = match[0];
    const lower = words.toLowerCase();
    const color = [match[1], match[2], match[3]]
      .map((name) => name?.toLowerCase())
      .find((name) => name && COLORS.has(name)) as Color | undefined;
    let glyph: Glyph;
    let glyphColor: string | undefined = color ? CITY_COLOR[color] : undefined;
    if (
      lower.startsWith("infection") ||
      lower.startsWith("gather") ||
      lower.startsWith("assemble")
    ) {
      glyph = "infection";
      if (lower.startsWith("gather") || lower.startsWith("assemble")) glyphColor = HOLLOW_COLOR;
    } else if (lower.startsWith("plague")) {
      glyph = "plague";
    } else if (lower.startsWith("hollow")) {
      glyph = "hollow";
    } else if (lower.includes("cube")) {
      glyph = "supplies";
    } else if (lower.startsWith("epidemic")) {
      glyph = "epidemic";
    } else if (lower.includes("event")) {
      glyph = "event";
    } else if (lower.startsWith("supply center")) {
      glyph = "center";
    } else if (lower.startsWith("satellite tower")) {
      glyph = "tower";
    } else if (lower.startsWith("shelter")) {
      glyph = "shelter";
    } else if (lower.startsWith("haven")) {
      glyph = "haven";
    } else if (lower.startsWith("lab")) {
      glyph = "lab";
    } else if (lower.startsWith("scar")) {
      glyph = "scar";
    } else if (lower.startsWith("objective")) {
      glyph = "objective";
    } else if (lower.startsWith("package")) {
      glyph = "package";
    } else if (lower.startsWith("door")) {
      glyph = "door";
    } else {
      glyph = "card";
    }
    if (match.index > from) parts.push(text.slice(from, match.index));
    parts.push({ glyph, ...(glyphColor ? { color: glyphColor } : {}), text: words });
    from = match.index + words.length;
  }
  if (from < text.length) parts.push(text.slice(from));
  return parts;
}
