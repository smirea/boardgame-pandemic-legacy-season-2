import type { CityId } from "@repo/game";
import type { BoardPoint } from "./projection";

/** Where a city's printed name is centred, relative to the city, and whether a leader line ties it back: any name not straight above or below its city gets one. */
export type Placement = { x: number; z: number; leader: boolean };

type Rect = { x: number; z: number; halfWidth: number; halfHeight: number };

/** Cap height of a printed name, in board units. */
export const NAME_SIZE = 2.7;
/** The disc's reach, which a leader line starts from. */
export const DISC_REACH = 2.2;

type Slot = { offset: (width: number) => { x: number; z: number }; cost: number; leader?: boolean };

// The pieces around a city have fixed places (cubes east, plague west, buildings on the corners, Hollow Men
// south), so a name beside the city clears them. Names may still run under pieces, as on a printed board.
const SLOTS: Slot[] = [
  { offset: () => ({ x: 0, z: 3.6 }), cost: 0 },
  { offset: () => ({ x: 0, z: -4.2 }), cost: 0.6 },
  { offset: (width) => ({ x: 1.2 + width / 2, z: 3.8 }), cost: 1, leader: true },
  { offset: (width) => ({ x: -1.2 - width / 2, z: 3.8 }), cost: 1, leader: true },
  { offset: (width) => ({ x: 1.2 + width / 2, z: -4.2 }), cost: 1.5, leader: true },
  { offset: (width) => ({ x: -1.2 - width / 2, z: -4.2 }), cost: 1.5, leader: true },
  { offset: (width) => ({ x: 4.4 + width / 2, z: 0.3 }), cost: 2, leader: true },
  { offset: (width) => ({ x: -5.2 - width / 2, z: 0.3 }), cost: 2, leader: true },
  { offset: () => ({ x: 0, z: 6.2 }), cost: 5, leader: true },
  { offset: () => ({ x: 0, z: -6.8 }), cost: 5, leader: true },
];

function overlap(a: Rect, b: Rect): number {
  const width =
    Math.min(a.x + a.halfWidth, b.x + b.halfWidth) - Math.max(a.x - a.halfWidth, b.x - b.halfWidth);
  const height =
    Math.min(a.z + a.halfHeight, b.z + b.halfHeight) -
    Math.max(a.z - a.halfHeight, b.z - b.halfHeight);
  return width > 0 && height > 0 ? width * height : 0;
}

/** How far a point lies from a rectangle's nearest edge. */
function reach(rect: Rect, point: BoardPoint) {
  const dx = Math.max(0, Math.abs(point.x - rect.x) - rect.halfWidth);
  const dz = Math.max(0, Math.abs(point.z - rect.z) - rect.halfHeight);
  return Math.hypot(dx, dz);
}

/**
 * Places every printed name so that it covers neither another name nor another city's disc, and so that no
 * name sits nearer some other city than its own. A name that has to stand off gets a leader line. Crowded
 * cities choose first, then a few passes let early choices give way to later ones.
 */
export function layoutLabels(
  cities: { id: CityId; width: number; at: BoardPoint }[],
): Map<CityId, Placement> {
  const crowding = (city: (typeof cities)[number]) =>
    cities.filter((other) => Math.hypot(other.at.x - city.at.x, other.at.z - city.at.z) < 16)
      .length;
  const order = cities.toSorted((a, b) => crowding(b) - crowding(a) || a.id.localeCompare(b.id));
  const rectOf = (city: (typeof cities)[number], slot: Slot): Rect => {
    const offset = slot.offset(city.width);
    return {
      x: city.at.x + offset.x,
      z: city.at.z + offset.z,
      halfWidth: city.width / 2,
      halfHeight: NAME_SIZE * 0.55,
    };
  };
  const chosen = new Map<CityId, { slot: Slot; rect: Rect }>();
  const cost = (city: (typeof cities)[number], slot: Slot, rect: Rect) => {
    let total = slot.cost;
    for (const [id, other] of chosen) if (id !== city.id) total += overlap(rect, other.rect) * 5;
    const own = reach(rect, city.at);
    for (const other of cities) {
      if (other.id === city.id) continue;
      const disc = { x: other.at.x, z: other.at.z, halfWidth: DISC_REACH, halfHeight: DISC_REACH };
      total += overlap(rect, disc) * 4;
      // A name nearer another city than its own reads as that city's.
      const theirs = reach(rect, other.at);
      if (theirs < own + 2) total += (own + 2 - theirs) * 6;
    }
    return total;
  };
  for (let pass = 0; pass < 4; pass++) {
    for (const city of order) {
      let best: { slot: Slot; rect: Rect; cost: number } | null = null;
      for (const slot of SLOTS) {
        const rect = rectOf(city, slot);
        const value = cost(city, slot, rect);
        if (!best || value < best.cost - 1e-6) best = { slot, rect, cost: value };
      }
      chosen.set(city.id, best!);
    }
  }
  return new Map(
    cities.map((city) => {
      const { slot, rect } = chosen.get(city.id)!;
      return [
        city.id,
        { x: rect.x - city.at.x, z: rect.z - city.at.z, leader: slot.leader ?? false },
      ];
    }),
  );
}

/** A rectangle on the board by its centre and full size. */
export type Box = { x: number; z: number; width: number; depth: number };

const NOTE_GAP = 0.6;
/** The directions a note tries, in degrees with south (below) at 90: below and above first, fanning out to the sides. */
const NOTE_ANGLES = [
  90, 270, 67.5, 112.5, 292.5, 247.5, 45, 135, 315, 225, 22.5, 157.5, 337.5, 202.5, 0, 180,
];
/** West first: a note on a red line stands to its left, over the sea it governs, as players look for it. */
export const WEST_ANGLES = [
  180, 157.5, 202.5, 135, 225, 112.5, 247.5, 90, 270, 67.5, 292.5, 45, 315, 22.5, 337.5, 0,
];

/**
 * Where each map note is centred: beside its location, as close as it can stand while covering no disc, name or
 * earlier note, trying every direction at each distance before stepping further out (below and above first). Where
 * nowhere near is clear it takes the spot it overlaps least. A location still hidden has nothing printed round it, so
 * its note stands on its own ground, as a sticker's words do over the region it covers. A note that marks something
 * players can see (`seen`) keeps to ground `revealed` says they can see, off the fog.
 */
export function layoutNotes(
  notes: {
    id: string;
    at: BoardPoint;
    width: number;
    depth: number;
    hidden: boolean;
    seen?: boolean;
    angles?: number[];
  }[],
  taken: Box[],
  revealed: (point: BoardPoint) => boolean = () => true,
): Map<string, BoardPoint> {
  const placed = new Map<string, BoardPoint>();
  const blocked = [...taken];
  const covered = (box: Box) =>
    blocked.reduce((total, other) => {
      const width = (box.width + other.width + NOTE_GAP) / 2 - Math.abs(box.x - other.x);
      const depth = (box.depth + other.depth + NOTE_GAP) / 2 - Math.abs(box.z - other.z);
      return total + (width > 0 && depth > 0 ? width * depth : 0);
    }, 0);
  for (const note of notes) {
    const size = { width: note.width, depth: note.depth };
    const candidates: BoardPoint[] = note.hidden ? [note.at] : [];
    for (let reach = DISC_REACH; reach <= DISC_REACH + (note.seen ? 30 : 16); reach += 1.5)
      for (const degrees of note.angles ?? NOTE_ANGLES) {
        const ux = Math.cos((degrees * Math.PI) / 180);
        const uz = Math.sin((degrees * Math.PI) / 180);
        const span = reach + (Math.abs(ux) * note.width) / 2 + (Math.abs(uz) * note.depth) / 2;
        candidates.push({ x: note.at.x + ux * span, z: note.at.z + uz * span });
      }
    const inSight = (at: BoardPoint) =>
      [-0.5, 0, 0.5].every((fx) =>
        [-0.5, 0, 0.5].every((fz) =>
          revealed({ x: at.x + fx * note.width, z: at.z + fz * note.depth }),
        ),
      );
    let best = candidates[0]!;
    let least = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      // Out of sight counts as worse than any overlap, so it is taken only when nothing in sight is near.
      const overlap =
        covered({ ...candidate, ...size }) + (note.seen && !inSight(candidate) ? 1e6 : 0);
      if (overlap < least) {
        least = overlap;
        best = candidate;
      }
      if (overlap === 0) break;
    }
    placed.set(note.id, best);
    blocked.push({ ...best, ...size });
  }
  return placed;
}
