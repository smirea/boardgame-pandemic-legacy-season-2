import { BufferGeometry, Mesh, MeshStandardMaterial } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type PieceModelKey = 'hollow' | 'tower' | 'station';

const URLS: Record<PieceModelKey, string> = {
	hollow: '/models/hollow-man.glb',
	tower: '/models/satellite-tower.glb',
	station: '/models/research-station.glb',
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
 * Shared materials for the imported pieces, matched to the Tabletop Simulator colours while keeping
 * crisp readability against the parchment chart and city discs.
 */
export const pieceMaterials = {
	center: new MeshStandardMaterial({ color: '#f3ede0', roughness: 0.62, metalness: 0.04 }),
	shelter: new MeshStandardMaterial({ color: '#7a441e', roughness: 0.68, metalness: 0.04 }),
	tower: new MeshStandardMaterial({ color: '#b06522', roughness: 0.46, metalness: 0.34 }),
	hollow: new MeshStandardMaterial({
		color: '#2b4222',
		emissive: '#0e1d0a',
		emissiveIntensity: 0.28,
		roughness: 0.68,
		metalness: 0.05,
	}),
};

function firstGeometry(root: Mesh | { traverse: (cb: (obj: unknown) => void) => void }): BufferGeometry | null {
	let found: BufferGeometry | null = null;
	root.traverse(obj => {
		if (!found && obj instanceof Mesh && obj.geometry instanceof BufferGeometry) {
			found = obj.geometry;
		}
	});
	return found;
}

if (typeof window !== 'undefined') {
	const loader = new GLTFLoader();
	const keys = Object.keys(URLS) as PieceModelKey[];
	let loaded = 0;
	for (const key of keys) {
		loader.load(
			URLS[key],
			gltf => {
				const geom = firstGeometry(gltf.scene);
				if (geom) pieceModels[key] = geom;
				loaded++;
				if (loaded === keys.length) pieceModels.ready = true;
			},
			undefined,
			error => console.error(`Failed to load model ${URLS[key]}:`, error),
		);
	}
}
