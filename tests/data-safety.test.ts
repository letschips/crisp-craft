import { describe, expect, it } from "vitest";
import { preserveUnreadableData, verifyDataWrite } from "../src/data-safety";

function memoryAdapter(files: Map<string, string>) {
  return {
    exists: async (path: string) => files.has(path),
    read: async (path: string) => { const v = files.get(path); if (v === undefined) throw new Error("ENOENT"); return v; },
    write: async (path: string, data: string) => { files.set(path, data); },
  };
}

describe("data safety", () => {
  it("copies an unreadable data.json aside and leaves the original untouched", async () => {
    const files = new Map([["p/data.json", "{ broken"]]);
    const result = await preserveUnreadableData(memoryAdapter(files), "p/data.json", new Date(2026, 8, 30, 8, 5, 9));
    expect(result).toEqual({ state: "preserved", backupPath: "p/data.json.unreadable-20260930-080509" });
    expect(files.get("p/data.json")).toBe("{ broken");
    expect(files.get("p/data.json.unreadable-20260930-080509")).toBe("{ broken");
  });

  it("reports a missing file and a failed copy separately", async () => {
    expect(await preserveUnreadableData(memoryAdapter(new Map()), "p/data.json")).toEqual({ state: "missing" });
    const adapter = { ...memoryAdapter(new Map([["p/data.json", "x"]])), write: async () => { throw new Error("EACCES"); } };
    expect((await preserveUnreadableData(adapter, "p/data.json")).state).toBe("failed");
    expect((await preserveUnreadableData(null, "p/data.json")).state).toBe("failed");
  });

  it("accepts a written payload and rejects a write that never reached the disk", async () => {
    const files = new Map([["p/data.json", JSON.stringify({ a: 1 }, null, 2)]]);
    await expect(verifyDataWrite(memoryAdapter(files), "p/data.json", { a: 1 })).resolves.toBeUndefined();
    await expect(verifyDataWrite(memoryAdapter(files), "p/data.json", { a: 2 })).rejects.toThrow(/not written/);
    await expect(verifyDataWrite(memoryAdapter(new Map()), "p/data.json", { a: 1 })).rejects.toThrow();
  });
});
