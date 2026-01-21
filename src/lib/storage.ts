/**
 * IndexedDB storage for persisting user data
 * Uses IndexedDB instead of localStorage for larger storage capacity (50MB+)
 */

const DB_NAME = "avatar3d";
const DB_VERSION = 1;
const STORE_NAME = "renders";

export interface SavedRender {
  id: string;
  createdAt: number;
  mode: "cursor" | "3d-model";
  originalImageBase64: string;
  processedImageBase64: string;
  previewThumbnail: string;
  glbBase64?: string; // Now stored in IndexedDB
  generatedFrames?: string[]; // Base64 frames for cursor mode
  frameCount?: number;
  xSteps?: number;
  ySteps?: number;
  stylePrompt?: string;
}

export interface UserSettings {
  defaultMode: "cursor" | "3d-model";
  defaultXSteps: number;
  defaultYSteps: number;
  defaultTextureSize: number;
  defaultMeshQuality: number;
}

export const MAX_RENDERS = 10;
const THUMBNAIL_SIZE = 200;

/**
 * Open the IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
  });
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a thumbnail from a base64 image
 */
export async function createThumbnail(base64: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(base64);
        return;
      }

      const ratio = Math.min(THUMBNAIL_SIZE / img.width, THUMBNAIL_SIZE / img.height);
      const width = img.width * ratio;
      const height = img.height * ratio;

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => resolve(base64);
    img.src = base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`;
  });
}

/**
 * Get all saved renders from IndexedDB
 */
export async function getSavedRendersAsync(): Promise<SavedRender[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const renders = request.result as SavedRender[];
        // Sort by createdAt descending (newest first)
        renders.sort((a, b) => b.createdAt - a.createdAt);
        resolve(renders);
      };
    });
  } catch {
    return [];
  }
}

/**
 * Synchronous version for initial render (returns cached or empty)
 */
let cachedRenders: SavedRender[] = [];
let cacheLoaded = false;

export function getSavedRenders(): SavedRender[] {
  if (typeof window === "undefined") return [];

  // Load async in background if not loaded
  if (!cacheLoaded) {
    getSavedRendersAsync().then((renders) => {
      cachedRenders = renders;
      cacheLoaded = true;
    });
  }

  return cachedRenders;
}

/**
 * Refresh the cache
 */
export async function refreshRenderCache(): Promise<SavedRender[]> {
  cachedRenders = await getSavedRendersAsync();
  cacheLoaded = true;
  return cachedRenders;
}

/**
 * Save a new render to IndexedDB
 */
export async function saveRender(
  render: Omit<SavedRender, "id" | "createdAt" | "previewThumbnail">
): Promise<SavedRender> {
  const thumbnail = await createThumbnail(render.processedImageBase64);

  const newRender: SavedRender = {
    ...render,
    id: generateId(),
    createdAt: Date.now(),
    previewThumbnail: thumbnail,
  };

  try {
    const db = await openDB();

    // Get current renders to enforce limit
    const currentRenders = await getSavedRendersAsync();

    // If at limit, delete oldest
    if (currentRenders.length >= MAX_RENDERS) {
      const oldestId = currentRenders[currentRenders.length - 1].id;
      await deleteRenderAsync(oldestId);
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(newRender);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        // Update cache
        cachedRenders = [newRender, ...cachedRenders.filter(r => r.id !== newRender.id)].slice(0, MAX_RENDERS);
        resolve(newRender);
      };
    });
  } catch (err) {
    console.error("Failed to save render:", err);
    throw err;
  }
}

/**
 * Delete a render from IndexedDB
 */
async function deleteRenderAsync(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.error("Failed to delete render:", err);
  }
}

/**
 * Delete a render (updates cache)
 */
export function deleteRender(id: string): void {
  deleteRenderAsync(id).then(() => {
    cachedRenders = cachedRenders.filter((r) => r.id !== id);
  });
}

/**
 * Clear all renders from IndexedDB
 */
export function clearAllRenders(): void {
  if (typeof window === "undefined") return;

  openDB().then((db) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    cachedRenders = [];
  }).catch(console.error);
}

/**
 * Get user settings from localStorage (small data, localStorage is fine)
 */
export function getUserSettings(): UserSettings | null {
  if (typeof window === "undefined") return null;

  try {
    const data = localStorage.getItem("avatar3d_settings");
    if (!data) return null;
    return JSON.parse(data) as UserSettings;
  } catch {
    return null;
  }
}

/**
 * Save user settings
 */
export function saveUserSettings(settings: UserSettings): void {
  localStorage.setItem("avatar3d_settings", JSON.stringify(settings));
}

/**
 * Image cache for preprocessed images (session only)
 */
const imageCache = new Map<string, string>();

/**
 * Generate a cache key from image content
 */
async function hashImage(base64: string): Promise<string> {
  const sample = base64.slice(0, 100) + base64.slice(-100) + base64.length;
  return btoa(sample).slice(0, 32);
}

/**
 * Get cached preprocessed image
 */
export async function getCachedPreprocessed(
  originalBase64: string,
  stylePrompt: string,
  fullBody: boolean
): Promise<string | null> {
  const key = await hashImage(originalBase64 + stylePrompt + fullBody);
  return imageCache.get(key) || null;
}

/**
 * Cache a preprocessed image
 */
export async function cachePreprocessed(
  originalBase64: string,
  stylePrompt: string,
  fullBody: boolean,
  processedBase64: string
): Promise<void> {
  const key = await hashImage(originalBase64 + stylePrompt + fullBody);
  imageCache.set(key, processedBase64);

  if (imageCache.size > 10) {
    const firstKey = imageCache.keys().next().value;
    if (firstKey) imageCache.delete(firstKey);
  }
}
