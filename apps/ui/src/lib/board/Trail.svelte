<script lang="ts">
  import { T } from "@threlte/core";
  import { untrack } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { Tween } from "svelte/motion";
  import {
    CatmullRomCurve3,
    Quaternion,
    QuadraticBezierCurve3,
    TubeGeometry,
    Vector3,
  } from "three";
  import type { BoardPoint } from "./projection";
  import { CITY_RADIUS, CITY_TOP, trimmed } from "./routes";
  import type { Travel } from "./types";

  type Props = {
    from: BoardPoint;
    to: BoardPoint;
    color: string;
    travel: Travel;
    course: BoardPoint[] | null;
    fresh: boolean;
  };

  let { from, to, color, travel, course, fresh }: Props = $props();

  const RADIAL = 6;
  // A drive or a sailing traces the route it used just above it; a flight arcs high over the chart so it never reads as a road.
  const curve = $derived.by(() => {
    if (course && course.length > 1)
      return new CatmullRomCurve3(
        trimmed(course, CITY_RADIUS * 0.8).map(
          (point) => new Vector3(point.x, CITY_TOP + 0.2, point.z),
        ),
        false,
        "centripetal",
      );
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    const inset = Math.min(CITY_RADIUS * 0.8, length / 3) / length;
    const start = new Vector3(
      from.x + (to.x - from.x) * inset,
      CITY_TOP + 0.2,
      from.z + (to.z - from.z) * inset,
    );
    const end = new Vector3(
      to.x - (to.x - from.x) * inset,
      CITY_TOP + 0.2,
      to.z - (to.z - from.z) * inset,
    );
    const lift = travel === "air" ? Math.min(14, 2.5 + length * 0.22) : 0.6 + length * 0.02;
    const middle = start
      .clone()
      .lerp(end, 0.5)
      .setY(CITY_TOP + lift * 2);
    return new QuadraticBezierCurve3(start, middle, end);
  });
  const segments = $derived(Math.max(16, Math.round(curve.getLength() * 1.5)));
  const tube = $derived(new TubeGeometry(curve, segments, fresh ? 0.34 : 0.16, RADIAL));
  const tip = $derived(curve.getPoint(1));
  const heading = $derived(
    new Quaternion()
      .setFromUnitVectors(new Vector3(0, 1, 0), curve.getTangent(1).normalize())
      .toArray() as [number, number, number, number],
  );

  // The path pencils itself in at about the pace the pawn travels it.
  const drawn = new Tween(
    untrack(() => (fresh ? 0 : 1)),
    { duration: 900, easing: cubicOut },
  );
  $effect(() => {
    drawn.target = 1;
  });
  $effect(() => {
    tube.setDrawRange(0, Math.round(drawn.current * segments) * RADIAL * 6);
  });
  $effect(() => {
    const geometry = tube;
    return () => geometry.dispose();
  });
</script>

<T.Mesh geometry={tube}>
  <T.MeshBasicMaterial {color} transparent opacity={fresh ? 0.95 : 0.4} depthWrite={false} />
</T.Mesh>
{#if fresh && drawn.current > 0.98}
  <T.Mesh position={[tip.x, tip.y, tip.z]} quaternion={heading}>
    <T.ConeGeometry args={[0.7, 1.6, 16]} />
    <T.MeshBasicMaterial {color} />
  </T.Mesh>
{/if}
