import { CHUNK_SIZE, createChunkedStorage, type KeyValueStore } from "../auth/chunked-storage";

function memoryStore(): KeyValueStore & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
    removeItem: async (key) => void data.delete(key),
  };
}

describe("chunked secure storage", () => {
  it("round-trips large values and cleans up old chunks", async () => {
    const backing = memoryStore();
    const storage = createChunkedStorage(backing);
    const big = "x".repeat(CHUNK_SIZE * 2 + 5);
    await storage.setItem("sb-auth:token", big);
    expect(await storage.getItem("sb-auth:token")).toBe(big);
    expect([...backing.data.keys()].every((key) => /^[A-Za-z0-9._-]+$/.test(key))).toBe(true);
    await storage.setItem("sb-auth:token", "small");
    expect(backing.data.size).toBe(2);
    await storage.removeItem("sb-auth:token");
    expect(backing.data.size).toBe(0);
    expect(await storage.getItem("sb-auth:token")).toBeNull();
  });
});
