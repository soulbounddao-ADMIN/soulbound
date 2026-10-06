import { runReapPersonaClipsCli } from "./reap-persona-clips-cli";

describe("reap-persona-clips CLI", () => {
  it("prints only counts and deleted asset ids", async () => {
    const lines: string[] = [];
    const storagePath = "private-owner/raw-clip.webm";
    const signedUrl = "https://storage.local/private?token=secret-token";

    await expect(runReapPersonaClipsCli({
      writeLine: (line) => lines.push(line),
      reap: async () => ({
        scanned: 1,
        deleted: 1,
        failed: 0,
        deletedAssetIds: ["asset-1"],
      }),
    })).resolves.toEqual({
      scanned: 1,
      deleted: 1,
      failed: 0,
      deletedAssetIds: ["asset-1"],
    });

    expect(lines).toEqual([
      "persona-clip reap scanned=1 deleted=1 failed=0 deletedAssetIds=[\"asset-1\"]",
    ]);
    expect(lines.join("\n")).not.toContain(storagePath);
    expect(lines.join("\n")).not.toContain(signedUrl);
    expect(lines.join("\n")).not.toContain("secret-token");
  });
});
