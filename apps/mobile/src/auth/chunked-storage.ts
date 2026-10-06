export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// expo-secure-store warns above ~2KB per value and Supabase sessions can be
// larger, so values are split across numbered keys.
export const CHUNK_SIZE = 1800;

function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, "_");
}

function countKey(key: string): string {
  return `${safeKey(key)}.n`;
}

function chunkKey(key: string, index: number): string {
  return `${safeKey(key)}.${index}`;
}

export function createChunkedStorage(store: KeyValueStore): KeyValueStore {
  async function removeChunks(key: string): Promise<void> {
    const raw = await store.getItem(countKey(key));
    const count = raw ? Number.parseInt(raw, 10) : 0;
    for (let index = 0; index < (Number.isFinite(count) ? count : 0); index += 1) {
      await store.removeItem(chunkKey(key, index));
    }
    await store.removeItem(countKey(key));
  }

  return {
    async getItem(key) {
      const raw = await store.getItem(countKey(key));
      if (!raw) {
        return null;
      }
      const count = Number.parseInt(raw, 10);
      if (!Number.isFinite(count) || count < 0) {
        return null;
      }
      const parts: string[] = [];
      for (let index = 0; index < count; index += 1) {
        const part = await store.getItem(chunkKey(key, index));
        if (part === null) {
          return null;
        }
        parts.push(part);
      }
      return parts.join("");
    },
    async setItem(key, value) {
      await removeChunks(key);
      const count = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
      for (let index = 0; index < count; index += 1) {
        await store.setItem(
          chunkKey(key, index),
          value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
        );
      }
      await store.setItem(countKey(key), String(count));
    },
    async removeItem(key) {
      await removeChunks(key);
    },
  };
}
