import { BufferGeometry, ExtrudeGeometry, Mesh, MeshStandardMaterial, Shape } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CUBE } from "./stockpile";

export type PieceModelKey = "hollow" | "tower" | "station";

const URLS: Record<PieceModelKey, string> = {
  hollow: "/models/hollow-man.glb",
  tower: "/models/satellite-tower.glb",
  station: "/models/research-station.glb",
};

/**
 * Fortified bunker shelter inspired by the base game's Shelter piece/sticker: a flat-topped sloped trapezoid
 * with stepped side buttresses and a recessed central blast archway, grounded at y=0 and normalized to unit height.
 */
function buildShelterGeometry(): BufferGeometry {
  const shape = new Shape();
  shape.moveTo(-0.56, 0);
  shape.lineTo(-0.5, 0.34);
  shape.lineTo(-0.4, 0.36);
  shape.lineTo(-0.26, 0.78);
  shape.lineTo(0.26, 0.78);
  shape.lineTo(0.4, 0.36);
  shape.lineTo(0.5, 0.34);
  shape.lineTo(0.56, 0);
  shape.lineTo(0.16, 0);
  shape.lineTo(0.16, 0.42);
  shape.lineTo(-0.16, 0.42);
  shape.lineTo(-0.16, 0);
  shape.closePath();

  const geometry = new ExtrudeGeometry(shape, {
    depth: 0.74,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelSegments: 2,
    curveSegments: 1,
  });
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const height = box.max.y - box.min.y;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  geometry.translate(-cx, -box.min.y, -cz);
  geometry.scale(1 / height, 1 / height, 1 / height);
  geometry.computeVertexNormals();
  return geometry;
}

export const shelterGeometry = buildShelterGeometry();

/** Shared beveled cube geometries for Supply cubes (cities, stockpile, flights) and Plague cubes. */
export const cubeGeometries = {
  supply: new RoundedBoxGeometry(CUBE, CUBE, CUBE, 2, CUBE * 0.13),
  plague: new RoundedBoxGeometry(1, 1, 1, 2, 0.13),
};

export const cubeMaterials = {
  supply: new MeshStandardMaterial({ color: "#efe6d2", roughness: 0.52, metalness: 0.04 }),
  plague: new MeshStandardMaterial({
    color: "#93b236",
    emissive: "#3b5210",
    emissiveIntensity: 0.55,
    roughness: 0.46,
    metalness: 0.06,
  }),
};

/**
 * Piece meshes imported from Tabletop Simulator (`apps/ui/scripts/import-tts-models.ts`).
 * Loaded once in the browser and shared across every city marker on the board.
 */
export const pieceModels = $state<{
  hollow: BufferGeometry | null;
  tower: BufferGeometry | null;
  station: BufferGeometry | null;
  ready: boolean;
}>({
  hollow: null,
  tower: null,
  station: null,
  ready: false,
});

/**
 * Shared materials for the board pieces, keeping crisp readability against the parchment chart and city discs.
 */
export const pieceMaterials = {
  center: new MeshStandardMaterial({ color: "#f3ede0", roughness: 0.62, metalness: 0.04 }),
  shelter: new MeshStandardMaterial({ color: "#6b5335", roughness: 0.72, metalness: 0.08 }),
  tower: new MeshStandardMaterial({ color: "#b06522", roughness: 0.46, metalness: 0.34 }),
  hollow: new MeshStandardMaterial({
    color: "#2b4222",
    emissive: "#0e1d0a",
    emissiveIntensity: 0.28,
    roughness: 0.68,
    metalness: 0.05,
  }),
};

function firstGeometry(
  root: Mesh | { traverse: (cb: (obj: unknown) => void) => void },
): BufferGeometry | null {
  let found: BufferGeometry | null = null;
  root.traverse((obj) => {
    if (!found && obj instanceof Mesh && obj.geometry instanceof BufferGeometry) {
      found = obj.geometry;
    }
  });
  return found;
}

if (typeof window !== "undefined") {
  const loader = new GLTFLoader();
  const keys = Object.keys(URLS) as PieceModelKey[];
  let loaded = 0;
  for (const key of keys) {
    loader.load(
      URLS[key],
      (gltf) => {
        const geom = firstGeometry(gltf.scene);
        if (geom) pieceModels[key] = geom;
        loaded++;
        if (loaded === keys.length) pieceModels.ready = true;
      },
      undefined,
      (error) => console.error(`Failed to load model ${URLS[key]}:`, error),
    );
  }
}
