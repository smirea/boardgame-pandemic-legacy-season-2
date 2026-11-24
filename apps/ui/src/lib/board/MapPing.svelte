<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import { HTML } from "@threlte/extras";
  import { onMount } from "svelte";
  import type { Mesh, MeshBasicMaterial } from "three";
  import { inkOn } from "#lib/color.ts";
  import { CITY_TOP } from "./routes";
  import type { PingView } from "./types";

  let { ping }: { ping: PingView } = $props();

  const { invalidate } = useThrelte();
  const Y = CITY_TOP + 0.55;
  const WAVE_MS = 1500;
  const FADE_MS = 650;
  const WAVES = [0, 1 / 3, 2 / 3] as const;

  let alive = $state(true);
  let tagOpacity = $state(1);

  const ringMeshes: (Mesh | undefined)[] = [undefined, undefined, undefined];
  const ringMats: (MeshBasicMaterial | undefined)[] = [undefined, undefined, undefined];
  const haloMeshes: (Mesh | undefined)[] = [undefined, undefined, undefined];
  const haloMats: (MeshBasicMaterial | undefined)[] = [undefined, undefined, undefined];
  let coreMesh = $state<Mesh>();
  let coreMat = $state<MeshBasicMaterial>();
  let centerRingMesh = $state<Mesh>();
  let centerRingMat = $state<MeshBasicMaterial>();
  let pinMesh = $state<Mesh>();
  let pinMat = $state<MeshBasicMaterial>();

  const labelInk = $derived(inkOn(ping.color));

  const task = useTask(
    () => {
      const elapsed = performance.now() - ping.createdAt;
      if (elapsed >= ping.duration) {
        alive = false;
        task.stop();
        invalidate();
        return;
      }
      const fade =
        elapsed > ping.duration - FADE_MS ? Math.max(0, (ping.duration - elapsed) / FADE_MS) : 1;
      if (fade < 1) tagOpacity = fade;

      for (let i = 0; i < WAVES.length; i++) {
        const phase = (elapsed / WAVE_MS + WAVES[i]!) % 1;
        const eased = 1 - (1 - phase) * (1 - phase);
        const scale = 0.7 + eased * 6.4;
        const opacity = (1 - phase) * 0.92 * fade;
        const ring = ringMeshes[i];
        const mat = ringMats[i];
        if (ring && mat) {
          ring.scale.setScalar(scale);
          mat.opacity = opacity;
        }
        const halo = haloMeshes[i];
        const hMat = haloMats[i];
        if (halo && hMat) {
          halo.scale.setScalar(scale);
          hMat.opacity = opacity * 0.5;
        }
      }

      const beat = 0.5 + 0.5 * Math.sin((elapsed / 260) * Math.PI);
      if (coreMesh && coreMat) {
        coreMesh.scale.setScalar(0.85 + beat * 0.35);
        coreMat.opacity = 0.95 * fade;
      }
      if (centerRingMesh && centerRingMat) {
        centerRingMesh.scale.setScalar(1 + beat * 0.22);
        centerRingMat.opacity = 0.9 * fade;
      }
      if (pinMesh && pinMat) {
        pinMesh.position.y = 1.45 + beat * 0.55;
        pinMat.opacity = 0.95 * fade;
      }
      invalidate();
    },
    { autoInvalidate: false },
  );

  onMount(() => {
    invalidate();
  });
</script>

{#if alive}
  <T.Group position={[ping.x, Y, ping.z]}>
    {#each WAVES as _phase, index (index)}
      <T.Mesh
        bind:ref={haloMeshes[index]}
        rotation.x={-Math.PI / 2}
        position.y={-0.01}
        renderOrder={11}
      >
        <T.RingGeometry args={[0.76, 1.06, 48]} />
        <T.MeshBasicMaterial
          bind:ref={haloMats[index]}
          color="#1a140e"
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </T.Mesh>
      <T.Mesh bind:ref={ringMeshes[index]} rotation.x={-Math.PI / 2} renderOrder={12}>
        <T.RingGeometry args={[0.82, 1.0, 48]} />
        <T.MeshBasicMaterial
          bind:ref={ringMats[index]}
          color={ping.color}
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </T.Mesh>
    {/each}

    <T.Mesh bind:ref={centerRingMesh} rotation.x={-Math.PI / 2} position.y={0.02} renderOrder={13}>
      <T.RingGeometry args={[0.55, 0.9, 32]} />
      <T.MeshBasicMaterial
        bind:ref={centerRingMat}
        color="#1a140e"
        transparent
        opacity={0.9}
        depthWrite={false}
      />
    </T.Mesh>
    <T.Mesh bind:ref={coreMesh} rotation.x={-Math.PI / 2} position.y={0.04} renderOrder={14}>
      <T.CircleGeometry args={[0.58, 24]} />
      <T.MeshBasicMaterial
        bind:ref={coreMat}
        color={ping.color}
        transparent
        opacity={0.95}
        depthWrite={false}
      />
    </T.Mesh>
    <T.Mesh bind:ref={pinMesh} position.y={1.5} rotation.x={Math.PI} renderOrder={14}>
      <T.ConeGeometry args={[0.45, 1.25, 12]} />
      <T.MeshBasicMaterial
        bind:ref={pinMat}
        color={ping.color}
        transparent
        opacity={0.95}
        depthWrite={false}
      />
    </T.Mesh>

    {#if ping.name}
      <HTML
        position.y={2.9}
        center
        pointerEvents="none"
        style="pointer-events: none"
        zIndexRange={[20, 11]}
      >
        <span
          class="ping-tag"
          style:background={ping.color}
          style:color={labelInk}
          style:opacity={tagOpacity}
        >
          {ping.name}
        </span>
      </HTML>
    {/if}
  </T.Group>
{/if}

<style>
  .ping-tag {
    display: block;
    padding: 0.06rem 0.42rem;
    border-radius: 2px;
    box-shadow: 0 2px 6px rgb(0 0 0 / 0.45);
    font: 600 0.68rem/1.45 var(--font-ui);
    white-space: nowrap;
  }
</style>
