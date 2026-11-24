import { CanvasTexture, SRGBColorSpace } from "three";

/** Something painted onto a transparent sheet, sized in board units, to lie flat on the chart. */
export type Print = { texture: CanvasTexture; width: number; height: number };

export type PrintedKind = "center" | "tower" | "shelter" | "lab" | "infested";

const PX_PER_UNIT = 64;
const NAME_FONT = '"IM Fell English"';
const NAME_STYLE = `italic 400`;
const NUMBER_FONT = '"Barlow Semi Condensed"';
const INK = "#2a2017";
const PAPER = "#e9dcbd";

// A canvas paints with whatever font has loaded, and a fallback face would stay baked into the texture,
// so prints wait for the faces they use.
export const fonts = $state({ ready: false });
if (typeof document !== "undefined")
  void Promise.all([
    document.fonts.load(`${NAME_STYLE} 64px ${NAME_FONT}`),
    document.fonts.load(`700 64px ${NUMBER_FONT}`),
  ]).then(() => (fonts.ready = true));

function sheet(
  width: number,
  height: number,
  paint: (context: CanvasRenderingContext2D) => void,
): Print {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * PX_PER_UNIT);
  canvas.height = Math.ceil(height * PX_PER_UNIT);
  // Kept in memory, not on the graphics card: a print is painted once and read once, into its texture, and reading
  // a canvas back from the card stalls the frame for a few milliseconds each time a name lights up.
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
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
    context ??= document.createElement("canvas").getContext("2d")!;
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
  measure(`${NAME_STYLE} ${size}px ${NAME_FONT}`, size * NAME_SPACING, name) +
  size * (0.6 + (port ? ANCHOR_ROOM : 0));

/**
 * A city's name lettered on the chart in an engraver's italic, with a faint paper halo that only lifts it off
 * coastlines and lines. A port's name opens with an anchor, the way the board marks the places sea movement may
 * start and end. A lit name is the one under the pointer.
 */
export function printName(
  name: string,
  port: boolean,
  size: number,
  faded: boolean,
  lit: boolean,
): Print {
  const font = `${NAME_STYLE} ${size}px ${NAME_FONT}`;
  const pad = size * 0.3;
  const width = nameWidth(name, port, size);
  const height = size * 1.5;
  return sheet(width, height, (context) => {
    const baseline = height / 2 + size * 0.3;
    const text = pad + (port ? size * ANCHOR_ROOM : 0);
    context.textBaseline = "alphabetic";
    context.lineJoin = "round";
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
    context.fillStyle = lit ? "#8e2a12" : INK;
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
  return sheet(width, height, (context) => {
    const middle = width / 2;
    const baseline = height / 2 + size * 0.3;
    const ink = lit ? "#8e2a12" : INK;
    context.font = font;
    context.letterSpacing = `${spacing}px`;
    context.textAlign = "center";
    context.lineJoin = "round";
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

/** Words broken into lines no wider than `width` board units in `font`. */
function wrap(font: string, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(" ")) {
    const last = lines.at(-1);
    if (last !== undefined && measure(font, 0, `${last} ${word}`) <= width)
      lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

/** The footprint of `printNote` in board units, to place it before it is painted. */
export function noteSize(text: string, size: number, width: number) {
  const font = `${NAME_STYLE} ${size}px ${NAME_FONT}`;
  const lines = wrap(font, text, width);
  const pad = size * 0.35;
  return {
    width: Math.max(...lines.map((line) => measure(font, 0, line))) + pad * 2,
    depth: lines.length * size * 1.2 + pad * 2,
  };
}

/**
 * Rules text a map sticker prints on the board, set in the names' italic as a short centred block no wider than
 * `width`, with the same faint paper halo so it reads over coasts and lines.
 */
export function printNote(text: string, size: number, width: number): Print {
  const font = `${NAME_STYLE} ${size}px ${NAME_FONT}`;
  const lines = wrap(font, text, width);
  const leading = size * 1.2;
  const pad = size * 0.35;
  const { width: sheetWidth, depth: sheetHeight } = noteSize(text, size, width);
  return sheet(sheetWidth, sheetHeight, (context) => {
    context.font = font;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    lines.forEach((line, index) => {
      const y = pad + leading * (index + 0.5);
      context.strokeStyle = PAPER;
      context.globalAlpha = 0.45;
      context.lineWidth = size * 0.22;
      context.strokeText(line, sheetWidth / 2, y);
      context.globalAlpha = 1;
      context.fillStyle = INK;
      context.fillText(line, sheetWidth / 2, y);
    });
  });
}

/** A berth ruled on the chart for a pile of pieces: a double rule with its corners cut. */
export function printBerth(width: number, height: number): Print {
  return sheet(width, height, (context) => {
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
    context.fillStyle = "rgb(233 220 189 / 0.35)";
    context.fill();
    context.strokeStyle = INK;
    context.lineWidth = 0.09;
    context.stroke();
    frame(0.32, 0.6);
    context.lineWidth = 0.035;
    context.stroke();
  });
}

export type DiscTone = "plain" | "infested" | "forsaken" | "inoculated";

const TONE_COLOR: Record<Exclude<DiscTone, "plain">, { fill: string; outline: string }> = {
  infested: { fill: "#9ce022", outline: "#1b2e05" },
  forsaken: { fill: "#ec2a20", outline: "#3b0806" },
  inoculated: { fill: "#6cc4ff", outline: "#061b38" },
};

/** The face of a city's disc: its population as a numeral, in green, red or blue when infested, forsaken or inoculated. */
export function printDisc(
  population: number,
  size: number,
  color: string,
  tone: DiscTone = "plain",
): Print {
  return sheet(size, size, (context) => {
    const text = String(population);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `700 ${size * 0.82}px ${NUMBER_FONT}`;
    if (tone !== "plain") {
      const styled = TONE_COLOR[tone];
      context.lineJoin = "round";
      context.strokeStyle = styled.outline;
      context.lineWidth = size * 0.06;
      context.strokeText(text, size / 2, size * 0.54);
      context.fillStyle = styled.fill;
    } else {
      context.fillStyle = color;
    }
    context.fillText(text, size / 2, size * 0.54);
  });
}

/** A soft blue halo around a disc's numeral, laid under it while an inoculated city's number shimmers. */
export function printDiscGlow(population: number, size: number): Print {
  return sheet(size, size, (context) => {
    const text = String(population);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `700 ${size * 0.82}px ${NUMBER_FONT}`;
    context.lineJoin = "round";
    // Canvas blur is in pixels of the sheet, not board units.
    context.shadowBlur = size * 0.12 * PX_PER_UNIT;
    context.shadowColor = "rgb(110 200 255 / 1)";
    context.strokeStyle = "rgb(190 232 255 / 0.95)";
    context.lineWidth = size * 0.1;
    context.strokeText(text, size / 2, size * 0.54);
  });
}

/** An anchor about two units tall around the origin, stroked in the context's current colour. */
function anchor(context: CanvasRenderingContext2D, weight: number) {
  context.lineCap = "round";
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
  return sheet(size, size, (context) => {
    const r = size / 2;
    context.translate(r, r);
    context.beginPath();
    context.arc(0, 0, r * 0.94, 0, Math.PI * 2);
    context.fillStyle = kind === "lab" ? "#dfe8ef" : kind === "infested" ? "#dde4cb" : "#f1e7cf";
    context.fill();
    context.lineWidth = r * 0.1;
    context.strokeStyle = kind === "lab" ? "#3d618f" : kind === "infested" ? "#3b5210" : "#7a3a22";
    context.stroke();
    context.beginPath();
    context.arc(0, 0, r * 0.78, 0, Math.PI * 2);
    context.lineWidth = r * 0.03;
    context.stroke();
    context.fillStyle = context.strokeStyle;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.scale(r, r);
    glyph(context, kind);
  });
}

/** Draws in a unit circle around the origin. */
function glyph(context: CanvasRenderingContext2D, kind: PrintedKind) {
  context.beginPath();
  switch (kind) {
    case "center":
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
    case "tower":
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
    case "shelter":
      context.arc(0, 0.28, 0.46, Math.PI, 0);
      context.closePath();
      context.fill();
      context.beginPath();
      context.fillStyle = "#f1e7cf";
      context.rect(-0.1, 0.06, 0.2, 0.22);
      context.fill();
      return;
    case "lab":
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
    case "infested": {
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
      context.fillStyle = "#dde4cb";
      context.arc(0.32, 0.05, 0.038, 0, Math.PI * 2);
      context.fill();
      return;
    }
  }
}
