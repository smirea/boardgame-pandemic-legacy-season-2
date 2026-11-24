import type { EdgeDef } from "@repo/game";
import { routeCourse } from "@repo/game";
import { CatmullRomCurve3, Vector3 } from "three";
import { LAND_HEIGHT } from "./projection";
import type { BoardPoint } from "./projection";

export const CITY_RADIUS = 1.9;
export const CITY_TOP = LAND_HEIGHT + 0.5;

/** The course trimmed back to each city's rim, so a line leaves a marker at its edge rather than its centre. */
export function trimmed(course: BoardPoint[], inset: number): BoardPoint[] {
  const cut = (points: BoardPoint[]) => {
    let left = inset;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      const span = Math.hypot(b.x - a.x, b.z - a.z);
      if (span > left) {
        const t = left / span;
        return [{ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, ...points.slice(i)];
      }
      left -= span;
    }
    return points.slice(-1);
  };
  return cut(cut(course).toReversed()).toReversed();
}

function length(course: BoardPoint[]) {
  let sum = 0;
  for (let i = 1; i < course.length; i++)
    sum += Math.hypot(course[i]!.x - course[i - 1]!.x, course[i]!.z - course[i - 1]!.z);
  return sum;
}

/**
 * A route on the board follows the course the rules test, from rim to rim. Supply lines lie flat on the
 * chart; sea lanes rise a little at their middle, low enough that the camera's tilt does not carry them
 * visibly off course.
 */
export function routeCurve(route: EdgeDef) {
  const course = routeCourse(route.a, route.b, route.kind);
  const full = length(course);
  const points = trimmed(course, Math.min(CITY_RADIUS, full / 3));
  const span = length(points);
  const peak = route.kind === "sea" ? Math.min(0.9, 0.2 + span * 0.015) : 0;
  let along = 0;
  return new CatmullRomCurve3(
    points.map((point, index) => {
      if (index)
        along += Math.hypot(point.x - points[index - 1]!.x, point.z - points[index - 1]!.z);
      return new Vector3(
        point.x,
        CITY_TOP - 0.25 + peak * Math.sin(Math.PI * (span ? along / span : 0)),
        point.z,
      );
    }),
    false,
    "centripetal",
  );
}
