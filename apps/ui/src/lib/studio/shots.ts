import { DEBUG_ID } from "#lib/storage.ts";
import { parseScene } from "./scene.ts";
import type { StudioScene } from "./scene.ts";

/** One capture: the scene and the picture taken of it. */
export type Shot = { id: string; at: number; name: string; scene: StudioScene; image: Blob };

/** A shot as it is written to a file, with the picture as a `data:` URL. */
export type ShotFile = { v: 1; shots: (Omit<Shot, "image"> & { image: string })[] };

const STORE = "shots";

// Pictures are too large for localStorage, so shots live in IndexedDB, apart per `?DEBUG_ID=` as `LS` is.
const database = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(`legacy-studio${DEBUG_ID ? `-DEBUG_ID=${DEBUG_ID}` : ""}`, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("The shot database could not be opened"));
  });

async function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = work(transaction.objectStore(STORE));
    transaction.oncomplete = () => {
      db.close();
      resolve(request ? request.result : (undefined as T));
    };
    transaction.onerror = transaction.onabort = () => {
      db.close();
      reject(transaction.error ?? new Error("The shot database refused the change"));
    };
  });
}

/** Every shot, newest first. */
export const allShots = async () =>
  (await run<Shot[]>("readonly", (store) => store.getAll())).toSorted((a, b) => b.at - a.at);

export const putShots = (shots: Shot[]) =>
  run<void>("readwrite", (store) => {
    for (const shot of shots) store.put(shot);
  });

export const removeShots = (ids: string[]) =>
  run<void>("readwrite", (store) => {
    for (const id of ids) store.delete(id);
  });

const dataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("The picture could not be read"));
    reader.readAsDataURL(blob);
  });

export async function shotFile(shots: Shot[]): Promise<ShotFile> {
  return {
    v: 1,
    shots: await Promise.all(
      shots.map(async (shot) => ({ ...shot, image: await dataUrl(shot.image) })),
    ),
  };
}

/** Reads a file written by `shotFile`, checking every scene in it. */
export async function readShotFile(raw: unknown): Promise<Shot[]> {
  const file = (typeof raw === "string" ? JSON.parse(raw) : raw) as Partial<ShotFile> | null;
  if (file?.v !== 1 || !Array.isArray(file.shots)) throw new Error("Not a studio shot file");
  return Promise.all(
    file.shots.map(async (shot) => {
      if (
        typeof shot.id !== "string" ||
        typeof shot.image !== "string" ||
        !shot.image.startsWith("data:image/")
      )
        throw new Error("A shot in the file has no id or no picture");
      return {
        id: shot.id,
        at: Number(shot.at),
        name: String(shot.name ?? ""),
        scene: parseScene(shot.scene),
        image: await (await fetch(shot.image)).blob(),
      };
    }),
  );
}
