// Obsidian's Plugin.loadData() returns null for a missing data.json but undefined when the file exists
// and cannot be read or parsed (sync conflict, interrupted write), and Plugin.saveData() swallows write
// errors. These helpers keep such a file from being overwritten by defaults and make lost writes visible.

export interface DataSafetyAdapter {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, data: string): Promise<void>;
}

export type UnreadableDataResult =
  | { state: "missing" }
  | { state: "preserved"; backupPath: string }
  | { state: "failed"; error: unknown };

function stamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/** Copies an unreadable data.json aside. On "failed" the caller must not write data.json this session. */
export async function preserveUnreadableData(
  adapter: DataSafetyAdapter | null | undefined,
  dataPath: string,
  now: Date = new Date(),
): Promise<UnreadableDataResult> {
  try {
    if (!adapter) throw new Error("vault adapter unavailable");
    if (!(await adapter.exists(dataPath))) return { state: "missing" };
    const backupPath = `${dataPath}.unreadable-${stamp(now)}`;
    await adapter.write(backupPath, await adapter.read(dataPath));
    return { state: "preserved", backupPath };
  } catch (error) {
    return { state: "failed", error };
  }
}

/** Throws when data.json does not hold `payload` after a save (saveData() never reports failures). */
export async function verifyDataWrite(
  adapter: DataSafetyAdapter | null | undefined,
  dataPath: string,
  payload: unknown,
): Promise<void> {
  if (!adapter) return;
  // A read or parse error propagates as is: either way the save cannot be confirmed.
  const onDisk = JSON.stringify(JSON.parse(await adapter.read(dataPath)));
  if (onDisk !== JSON.stringify(payload)) throw new Error("data.json was not written: its contents differ from the saved data");
}
