/**
 * Where every piece of a Legacy reading lies on the table. The pieces of the opening being read stand large in the
 * middle; everything read before lies on the two sides, spread out as large as the side allows. Only when a side
 * runs out of room does it gather a group into a pile, the biggest group first, and only once every group is piled
 * does it shrink them further. A pile under the pointer fans its pieces out beside it (`peek`).
 */

export type Box = { x: number; y: number; w: number; h: number };

/** A piece at its own size, as it is drawn in the middle of the table. */
export type Sized = {
  key: string;
  w: number;
  h: number;
  group: string;
  /** Its size on the sides against its size in the middle: a Legacy card lies there as a thumbnail. */
  side: number;
  /** Its size in the middle against its own, smaller for a door a card opens than for the card. */
  spot: number;
  /** How much of a side it takes, to share the groups between the sides before anything is measured. */
  weight: number;
};

/** A piece's centre on the table, its scale and how far it is turned. */
export type Place = { cx: number; cy: number; scale: number; rot: number; z: number };

export type Label = {
  key: string;
  text: string;
  count: number;
  x: number;
  y: number;
  w: number;
  align: "left" | "right" | "center";
  pile: string | null;
};

export type Pile = { id: string; keys: string[]; box: Box; side: "left" | "right" };

export type Layout = {
  places: Map<string, Place>;
  labels: Label[];
  piles: Map<string, Pile>;
  /** Which pile each piled piece lies in. */
  pileOf: Map<string, string>;
  /** Where the pieces being peeked at were fanned out, to keep them open while the pointer is over them. */
  peekBox: Box | null;
  /** Where they lie when nobody is looking at them. */
  peekAnchor: Box | null;
  /** What the middle of the table holds, to set the opening's title over. */
  spotBox: Box | null;
};

export type TableRoom = {
  width: number;
  height: number;
  /** Kept clear over the middle, for the opening's title. */
  top: number;
  /** Where the deck stands, kept clear of the side it stands on. */
  deck: Box | null;
  /** Kept clear at the foot of the middle, as for the story's panel. */
  bottom: number;
};

const GAP = 14;
const LABEL = 30;
// A side grows its pieces into the room it has, up to `SIDE_MAX` of their size in the middle, before it shrinks them.
const SIDE_STEPS = [1.7, 1.55, 1.42, 1.3, 1.19, 1.09, 1, 0.92, 0.85, 0.78];
const SIDE_MAX = 0.7;
const SHRINK_STEPS = [0.7, 0.62, 0.55, 0.48, 0.42, 0.36, 0.3];

type Flowed = { at: { x: number; y: number }[]; w: number; h: number };

/** Lays sizes out in rows no wider than `maxW`, each row centred on its height. */
function flow(sizes: { w: number; h: number }[], maxW: number, align: Label["align"]): Flowed {
  const rows: { items: number[]; w: number; h: number }[] = [];
  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i]!;
    const row = rows.at(-1);
    if (row && row.w + GAP + size.w <= maxW) {
      row.items.push(i);
      row.w += GAP + size.w;
      row.h = Math.max(row.h, size.h);
    } else rows.push({ items: [i], w: size.w, h: size.h });
  }
  const w = Math.max(0, ...rows.map((row) => row.w));
  const at: { x: number; y: number }[] = [];
  let y = 0;
  for (const row of rows) {
    let x = align === "left" ? 0 : align === "right" ? w - row.w : (w - row.w) / 2;
    for (const i of row.items) {
      const size = sizes[i]!;
      at[i] = { x, y: y + (row.h - size.h) / 2 };
      x += size.w + GAP;
    }
    y += row.h + GAP;
  }
  return { at, w, h: Math.max(0, y - GAP) };
}

type Group = { heading: string; pieces: Sized[] };

function groupsOf(pieces: Sized[]): Group[] {
  const groups = new Map<string, Group>();
  for (const piece of pieces) {
    const group = groups.get(piece.group) ?? { heading: piece.group, pieces: [] };
    group.pieces.push(piece);
    groups.set(piece.group, group);
  }
  return [...groups.values()];
}

/** A group as a block: its label over its pieces, spread in rows or gathered in a pile. */
type Block = {
  group: Group;
  piled: boolean;
  w: number;
  h: number;
  /** Each piece's top-left and scale inside the block, under the label. */
  items: { key: string; x: number; y: number; scale: number; w: number; h: number; rot: number }[];
};

function spreadBlock(
  group: Group,
  scale: number,
  maxW: number,
  align: Label["align"],
  cap = SIDE_MAX,
): Block {
  const scales = group.pieces.map((piece) => Math.min(cap, piece.side * scale));
  const sizes = group.pieces.map((piece, i) => ({
    w: piece.w * scales[i]!,
    h: piece.h * scales[i]!,
  }));
  const laid = flow(sizes, maxW, align);
  return {
    group,
    piled: false,
    w: laid.w,
    h: LABEL + laid.h,
    items: group.pieces.map((piece, i) => ({
      key: piece.key,
      x: laid.at[i]!.x,
      y: LABEL + laid.at[i]!.y,
      scale: scales[i]!,
      w: sizes[i]!.w,
      h: sizes[i]!.h,
      rot: 0,
    })),
  };
}

function pileBlock(group: Group, scale: number): Block {
  const scales = group.pieces.map((piece) => Math.min(SIDE_MAX, piece.side * scale));
  const sizes = group.pieces.map((piece, i) => ({
    w: piece.w * scales[i]!,
    h: piece.h * scales[i]!,
  }));
  const n = sizes.length;
  const stepX = n > 1 ? Math.min(14, 56 / (n - 1)) : 0;
  const stepY = n > 1 ? Math.min(5, 20 / (n - 1)) : 0;
  const maxW = Math.max(...sizes.map((size) => size.w));
  const maxH = Math.max(...sizes.map((size) => size.h));
  return {
    group,
    piled: true,
    w: maxW + stepX * (n - 1),
    h: LABEL + maxH + stepY * (n - 1),
    items: group.pieces.map((piece, i) => ({
      key: piece.key,
      x: i * stepX + (maxW - sizes[i]!.w) / 2,
      y: LABEL + i * stepY + (maxH - sizes[i]!.h) / 2,
      scale: scales[i]!,
      w: sizes[i]!.w,
      h: sizes[i]!.h,
      rot: ((i % 3) - 1) * 2.5,
    })),
  };
}

type Packed = {
  /** Each block and how wide its label may run before it meets the next block or the edge. */
  blocks: { block: Block; x: number; y: number; room: number }[];
  w: number;
  h: number;
};

/** Blocks in shelves across `width`, each shelf pushed to the side `align` names. */
function shelve(blocks: Block[], width: number, align: Label["align"]): Packed {
  const shelves: { blocks: Block[]; w: number; h: number }[] = [];
  for (const block of blocks) {
    const shelf = shelves.at(-1);
    if (shelf && shelf.w + GAP + block.w <= width) {
      shelf.blocks.push(block);
      shelf.w += GAP + block.w;
      shelf.h = Math.max(shelf.h, block.h);
    } else shelves.push({ blocks: [block], w: block.w, h: block.h });
  }
  const placed: Packed["blocks"] = [];
  let y = 0;
  let w = 0;
  for (const shelf of shelves) {
    let x = align === "left" ? 0 : align === "right" ? width - shelf.w : (width - shelf.w) / 2;
    // Blocks stand on the shelf's top, so the labels of a shelf read as one line.
    shelf.blocks.forEach((block, i) => {
      const room =
        align === "left"
          ? (i + 1 < shelf.blocks.length ? block.w - 4 : width - x)
          : align === "right"
            ? (i > 0 ? block.w - 4 : x + block.w)
            : block.w;
      placed.push({ block, x, y, room });
      x += block.w + GAP;
    });
    y += shelf.h + GAP * 1.4;
    w = Math.max(w, shelf.w);
  }
  return { blocks: placed, w, h: Math.max(0, y - GAP * 1.4) };
}

/** A side of the table: spread at the largest size that fits, then piled group by group, then shrunk. */
function layoutSide(pieces: Sized[], zone: Box, align: "left" | "right"): Packed {
  const groups = groupsOf(pieces);
  if (!groups.length) return { blocks: [], w: 0, h: 0 };
  const attempt = (scale: number, piled: Set<string>) =>
    shelve(
      groups.map((group) =>
        piled.has(group.heading) && group.pieces.length > 1
          ? pileBlock(group, scale)
          : spreadBlock(group, scale, zone.w, align),
      ),
      zone.w,
      align,
    );
  const fits = (packed: Packed) =>
    packed.h <= zone.h && packed.blocks.every(({ block }) => block.w <= zone.w + 0.5);

  for (const scale of SIDE_STEPS) {
    const packed = attempt(scale, new Set());
    if (fits(packed)) return packed;
  }
  const scale = SIDE_STEPS.at(-1)!;
  const piled = new Set<string>();
  const biggest = [...groups]
    .filter((group) => group.pieces.length > 1)
    .sort(
      (a, b) =>
        b.pieces.reduce((sum, piece) => sum + piece.w * piece.h * piece.side ** 2, 0) -
        a.pieces.reduce((sum, piece) => sum + piece.w * piece.h * piece.side ** 2, 0),
    );
  for (const group of biggest) {
    piled.add(group.heading);
    const packed = attempt(scale, piled);
    if (fits(packed)) return packed;
  }
  let packed = attempt(scale, piled);
  for (const smaller of SHRINK_STEPS) {
    packed = attempt(smaller, piled);
    if (fits(packed)) return packed;
  }
  // Nothing fits: the shelves overlap, each a little under the one before, rather than run off the table.
  const squeeze = zone.h / Math.max(1, packed.h);
  for (const entry of packed.blocks) entry.y *= squeeze;
  packed.h = zone.h;
  return packed;
}

/** The opening being read, as large as the middle allows: its card or seal, and what came out beside it. */
function layoutSpot(main: Sized | null, rest: Sized[], zone: Box) {
  const groups = groupsOf(rest);
  const tryAt = (scale: number) => {
    const mainW = main ? main.w * main.spot * scale : 0;
    const mainH = main ? main.h * main.spot * scale : 0;
    if (!groups.length) return { scale, mainW, mainH, rest: null, beside: true, w: mainW, h: mainH };
    const besideW = zone.w - mainW - GAP * 2.5;
    const beside = !main || besideW >= Math.min(320, zone.w * 0.35);
    const room = main ? (beside ? besideW : zone.w) : zone.w;
    const blocks = groups.map((group) => {
      const block = spreadBlock(
        { heading: group.heading, pieces: group.pieces.map((p) => ({ ...p, side: p.spot })) },
        scale,
        room,
        "center",
        Infinity,
      );
      return block;
    });
    const packed = shelve(blocks, room, "center");
    const packedW = Math.max(...packed.blocks.map(({ x, block }) => x + block.w)) - Math.min(...packed.blocks.map(({ x }) => x));
    const w = main ? (beside ? mainW + GAP * 2.5 + packedW : Math.max(mainW, packedW)) : packedW;
    const h = main ? (beside ? Math.max(mainH, packed.h) : mainH + GAP * 2 + packed.h) : packed.h;
    return { scale, mainW, mainH, rest: packed, beside, w, h };
  };
  let best = tryAt(0.2);
  for (let scale = 1.15; scale >= 0.2; scale -= 0.025) {
    const found = tryAt(scale);
    if (found.w <= zone.w && found.h <= zone.h) {
      best = found;
      break;
    }
  }
  return best;
}

export function layoutTable({
  room,
  spot,
  sides,
  peek,
}: {
  room: TableRoom;
  /** The opening being read: its main piece and the rest. */
  spot: { main: Sized | null; rest: Sized[] };
  /** Everything read before, each assigned to its side. */
  sides: { left: Sized[]; right: Sized[] };
  /** The pile or the piece the pointer rests on, to fan out. */
  peek: { pile: string } | { key: string } | null;
}): Layout {
  const places = new Map<string, Place>();
  const labels: Label[] = [];
  const piles = new Map<string, Pile>();
  const pileOf = new Map<string, string>();
  const { width, height } = room;
  const centerW = Math.min(width - 2 * 220, Math.max(width * 0.5, 560));
  const sideW = Math.max(120, (width - centerW) / 2 - GAP * 2);

  let z = 1;
  const clear = (zone: Box): Box => {
    const deck = room.deck;
    if (!deck || deck.x + deck.w < zone.x || deck.x > zone.x + zone.w) return zone;
    const below = deck.y + deck.h + GAP;
    return { ...zone, y: below, h: zone.y + zone.h - below };
  };
  const sideZones = {
    left: clear({ x: GAP, y: GAP, w: sideW, h: height - GAP * 2 }),
    right: clear({ x: width - GAP - sideW, y: GAP, w: sideW, h: height - GAP * 2 }),
  };
  for (const side of ["left", "right"] as const) {
    const zone = sideZones[side];
    const packed = layoutSide(sides[side], zone, side === "left" ? "right" : "left");
    const top = zone.y + Math.max(0, (zone.h - packed.h) / 2);
    for (const { block, x, y, room: labelRoom } of packed.blocks) {
      const bx = zone.x + x;
      const by = top + y;
      const pileId = block.piled ? `${side}:${block.group.heading}` : null;
      labels.push({
        key: `${side}:${block.group.heading}`,
        text: block.group.heading,
        count: block.group.pieces.length,
        x: side === "left" ? bx + block.w : bx,
        y: by,
        w: Math.max(labelRoom, 60),
        align: side === "left" ? "right" : "left",
        pile: pileId,
      });
      if (pileId)
        piles.set(pileId, {
          id: pileId,
          keys: block.items.map((item) => item.key),
          box: { x: bx, y: by, w: block.w, h: block.h },
          side,
        });
      for (const item of block.items) {
        if (pileId) pileOf.set(item.key, pileId);
        places.set(item.key, {
          cx: bx + item.x + item.w / 2,
          cy: by + item.y + item.h / 2,
          scale: item.scale,
          rot: item.rot,
          z: z++,
        });
      }
    }
  }

  const spotZone = {
    x: (width - centerW) / 2,
    y: room.top,
    w: centerW,
    h: Math.max(120, height - room.top - room.bottom - GAP),
  };
  let spotBox: Box | null = null;
  if (spot.main || spot.rest.length) {
    const laid = layoutSpot(spot.main, spot.rest, spotZone);
    const left = spotZone.x + (spotZone.w - laid.w) / 2;
    const top = spotZone.y + (spotZone.h - laid.h) / 2;
    spotBox = { x: left, y: top, w: laid.w, h: laid.h };
    if (spot.main)
      places.set(spot.main.key, {
        cx: left + laid.mainW / 2,
        cy: laid.beside ? top + laid.h / 2 : top + laid.mainH / 2,
        scale: spot.main.spot * laid.scale,
        rot: 0,
        z: 200,
      });
    if (laid.rest) {
      const restX = spot.main ? (laid.beside ? left + laid.mainW + GAP * 2.5 : left) : left;
      const restW = spot.main && laid.beside ? laid.w - laid.mainW - GAP * 2.5 : laid.w;
      const restY = spot.main
        ? laid.beside
          ? top + (laid.h - laid.rest.h) / 2
          : top + laid.mainH + GAP * 2
        : top;
      const minX = Math.min(...laid.rest.blocks.map(({ x }) => x));
      const usedW = Math.max(...laid.rest.blocks.map(({ x, block }) => x + block.w)) - minX;
      const shiftX = restX + (restW - usedW) / 2 - minX;
      for (const { block, x, y } of laid.rest.blocks) {
        labels.push({
          key: `spot:${block.group.heading}`,
          text: block.group.heading,
          count: block.group.pieces.length,
          x: shiftX + x + block.w / 2,
          y: restY + y,
          w: Math.max(block.w, 200),
          align: "center",
          pile: null,
        });
        for (const item of block.items)
          places.set(item.key, {
            cx: shiftX + x + item.x + item.w / 2,
            cy: restY + y + item.y + item.h / 2,
            scale: item.scale,
            rot: 0,
            z: 210 + places.size,
          });
      }
    }
  }

  let peekBox: Box | null = null;
  let peekAnchor: Box | null = null;
  const peeked = peek
    ? "pile" in peek
      ? piles.get(peek.pile)
      : places.has(peek.key) && !pileOf.has(peek.key)
        ? { keys: [peek.key], box: null, side: null }
        : null
    : null;
  if (peeked) {
    const all = [...sides.left, ...sides.right];
    const pieces = peeked.keys.flatMap((key) => all.filter((piece) => piece.key === key));
    if (pieces.length) {
      const anchor =
        peeked.box ??
        (() => {
          const place = places.get(pieces[0]!.key)!;
          const w = pieces[0]!.w * place.scale;
          const h = pieces[0]!.h * place.scale;
          return { x: place.cx - w / 2, y: place.cy - h / 2, w, h };
        })();
      const onLeft = anchor.x + anchor.w / 2 < width / 2;
      const maxW = width * 0.62;
      const maxH = height * 0.78;
      // As large as reads well, a Legacy card near its own size, and no larger than the table can show beside the pile.
      let scale = 0.92;
      let laid = flow(
        pieces.map((piece) => ({ w: piece.w * piece.spot * scale, h: piece.h * piece.spot * scale })),
        maxW,
        "left",
      );
      while (scale > 0.3 && (laid.w > maxW || laid.h > maxH)) {
        scale -= 0.04;
        laid = flow(
          pieces.map((piece) => ({ w: piece.w * piece.spot * scale, h: piece.h * piece.spot * scale })),
          maxW,
          "left",
        );
      }
      const x = Math.min(
        Math.max(GAP, onLeft ? anchor.x : anchor.x + anchor.w - laid.w),
        width - GAP - laid.w,
      );
      const y = Math.min(
        Math.max(GAP, anchor.y + anchor.h / 2 - laid.h / 2),
        height - GAP - laid.h,
      );
      peekBox = { x, y, w: laid.w, h: laid.h };
      peekAnchor = anchor;
      pieces.forEach((piece, i) => {
        const w = piece.w * piece.spot * scale;
        const h = piece.h * piece.spot * scale;
        places.set(piece.key, {
          cx: x + laid.at[i]!.x + w / 2,
          cy: y + laid.at[i]!.y + h / 2,
          scale: piece.spot * scale,
          rot: 0,
          z: 500 + i,
        });
      });
    }
  }

  return { places, labels, piles, pileOf, peekBox, peekAnchor, spotBox };
}

/**
 * Which side each group lies on, decided as the groups first come and never changed after: a new group goes to the
 * side holding less, so nothing jumps across the table as the reading grows.
 */
export function assignSides(read: Sized[], deck = 0): { left: Sized[]; right: Sized[] } {
  const side = new Map<string, "left" | "right">();
  // The deck stands on the right, which so starts with less room.
  const weight = { left: 0, right: deck };
  const out = { left: [] as Sized[], right: [] as Sized[] };
  for (const piece of read) {
    const at = side.get(piece.group) ?? (weight.left <= weight.right ? "left" : "right");
    side.set(piece.group, at);
    weight[at] += piece.weight;
    out[at].push(piece);
  }
  return out;
}
