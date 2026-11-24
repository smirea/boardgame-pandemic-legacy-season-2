<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { onDestroy } from "svelte";
  import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";
  import type { BoardPoint } from "./projection";
  import { CITY_TOP } from "./routes";
  import type { DrawingView } from "./types";

  let { drawings }: { drawings: DrawingView[] } = $props();

  const { invalidate } = useThrelte();
  const Y = CITY_TOP + 0.45;
  const RADIAL = 6;

  type CachedStroke = {
    key: string;
    color: string;
    points: BoardPoint[];
    dot: BoardPoint | null;
    tube: TubeGeometry | null;
    outline: TubeGeometry | null;
  };

  const cache = new Map<string, CachedStroke>();

  function buildStroke(key: string, color: string, points: BoardPoint[]): CachedStroke {
    const clean: BoardPoint[] = [];
    for (const point of points) {
      const prev = clean[clean.length - 1];
      if (!prev || Math.hypot(point.x - prev.x, point.z - prev.z) > 1e-4) clean.push(point);
    }
    if (clean.length < 2) {
      return { key, color, points, dot: clean[0] ?? null, tube: null, outline: null };
    }
    const curve = new CatmullRomCurve3(
      clean.map((point) => new Vector3(point.x, Y, point.z)),
      false,
      "centripetal",
    );
    const length = curve.getLength();
    const segments = Math.max(8, Math.min(260, Math.round(length * 2.5)));
    return {
      key,
      color,
      points,
      dot: null,
      tube: new TubeGeometry(curve, segments, 0.24, RADIAL),
      outline: new TubeGeometry(curve, segments, 0.35, RADIAL),
    };
  }

  function disposeItem(item: CachedStroke) {
    item.tube?.dispose();
    item.outline?.dispose();
  }

  let rendered = $state.raw<CachedStroke[]>([]);

  $effect(() => {
    const seen = new Set<string>();
    const next: CachedStroke[] = [];
    for (const entry of drawings) {
      for (const stroke of entry.strokes) {
        const key = `${entry.id}:${stroke.id}`;
        seen.add(key);
        const prev = cache.get(key);
        if (prev && prev.points === stroke.points && prev.color === entry.color) {
          next.push(prev);
          continue;
        }
        if (prev) disposeItem(prev);
        const built = buildStroke(key, entry.color, stroke.points);
        cache.set(key, built);
        next.push(built);
      }
    }
    for (const [key, item] of cache) {
      if (!seen.has(key)) {
        disposeItem(item);
        cache.delete(key);
      }
    }
    rendered = next;
    invalidate();
  });

  onDestroy(() => {
    for (const item of cache.values()) disposeItem(item);
    cache.clear();
    invalidate();
  });
</script>

{#each rendered as item (item.key)}
  {#if item.tube && item.outline}
    <T.Mesh geometry={item.outline} renderOrder={8}>
      <T.MeshBasicMaterial color="#1a140e" transparent opacity={0.5} depthWrite={false} />
    </T.Mesh>
    <T.Mesh geometry={item.tube} renderOrder={9}>
      <T.MeshBasicMaterial color={item.color} />
    </T.Mesh>
  {:else if item.dot}
    <T.Mesh position={[item.dot.x, Y, item.dot.z]} renderOrder={8}>
      <T.SphereGeometry args={[0.38, 10, 10]} />
      <T.MeshBasicMaterial color="#1a140e" transparent opacity={0.5} depthWrite={false} />
    </T.Mesh>
    <T.Mesh position={[item.dot.x, Y, item.dot.z]} renderOrder={9}>
      <T.SphereGeometry args={[0.28, 10, 10]} />
      <T.MeshBasicMaterial color={item.color} />
    </T.Mesh>
  {/if}
{/each}
