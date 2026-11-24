import { edgeKey, routeCourse } from "@repo/game";
import type { CityId, EdgeDef, LogEntry } from "@repo/game";
import type { BoardPoint } from "./projection";
import type { Travel } from "./types";

type Move = Extract<LogEntry, { t: "move" }>;

const SAILINGS = new Set(["sail", "charter", "captainSail"]);

/** The sea lanes from `from` to `to` with the fewest hops, or null when no chain of lanes joins them. */
function lanesBetween(edges: EdgeDef[], from: CityId, to: CityId): CityId[] | null {
  const previous = new Map<CityId, CityId>([[from, from]]);
  const queue = [from];
  while (queue.length) {
    const here = queue.shift()!;
    if (here === to) {
      const hops = [to];
      while (hops.at(-1) !== from) hops.push(previous.get(hops.at(-1)!)!);
      return hops.reverse();
    }
    for (const edge of edges) {
      if (edge.kind !== "sea") continue;
      const next = edge.a === here ? edge.b : edge.b === here ? edge.a : null;
      if (next && !previous.has(next)) {
        previous.set(next, here);
        queue.push(next);
      }
    }
  }
  return null;
}

/**
 * How a move crossed the board: by road or by ferry along the line it used, by boat along the lanes it
 * sailed, or by air for anything that jumps (a shuttle, an airlift, a runner, the administrator). The
 * course is the one the routes are drawn on, so the vehicle stays on its road or at sea; a flight has none.
 */
export function travelOf(
  move: Move,
  edges: EdgeDef[],
): { travel: Travel; course: BoardPoint[] | null } {
  const joined = edges.find((edge) => edgeKey(edge.a, edge.b) === edgeKey(move.from, move.to));
  if (move.by === "drive" && joined)
    return { travel: joined.kind, course: routeCourse(move.from, move.to, joined.kind) };
  if (SAILINGS.has(move.by)) {
    const hops = lanesBetween(edges, move.from, move.to);
    const course = hops?.flatMap((city, index) =>
      index ? routeCourse(hops[index - 1]!, city, "sea").slice(index > 1 ? 1 : 0) : [],
    );
    return { travel: "sea", course: course ?? null };
  }
  if (move.by === "drive") return { travel: "land", course: null };
  return { travel: "air", course: null };
}

/** How long a trip of that length takes: long ones take longer, up to a cap so a turn never drags. */
export const tripMs = (travel: Travel, distance: number) =>
  travel === "land"
    ? Math.min(1500, 520 + distance * 22)
    : travel === "sea"
      ? Math.min(1900, 700 + distance * 20)
      : Math.min(1800, 800 + distance * 11);

/** The pieces of a course, measured, so a point a given share of the way along can be found quickly. */
export function along(course: BoardPoint[]) {
  const lengths = [0];
  for (let i = 1; i < course.length; i++)
    lengths.push(
      lengths[i - 1]! +
        Math.hypot(course[i]!.x - course[i - 1]!.x, course[i]!.z - course[i - 1]!.z),
    );
  const total = lengths.at(-1)!;
  return {
    total,
    at(share: number): BoardPoint & { heading: number } {
      const distance = Math.max(0, Math.min(1, share)) * total;
      let i = 1;
      while (i < course.length - 1 && lengths[i]! < distance) i++;
      const a = course[i - 1]!;
      const b = course[i]!;
      const span = lengths[i]! - lengths[i - 1]!;
      const t = span ? (distance - lengths[i - 1]!) / span : 0;
      return {
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        heading: Math.atan2(-(b.z - a.z), b.x - a.x),
      };
    },
  };
}

/**
 * Whether a pawn that stood in the city at `home` and now stands in the one at `at` travelled along `course`. It is
 * judged from the cities, not from where the pawn stands: in a crowded city its slot can be over 3 units off the centre.
 */
export const follows = (
  course: BoardPoint[] | null,
  home: BoardPoint,
  at: BoardPoint,
): course is BoardPoint[] => {
  const first = course?.[0];
  const last = course?.at(-1);
  return Boolean(
    first &&
    last &&
    Math.hypot(first.x - home.x, first.z - home.z) < 0.01 &&
    Math.hypot(last.x - at.x, last.z - at.z) < 0.01,
  );
};
