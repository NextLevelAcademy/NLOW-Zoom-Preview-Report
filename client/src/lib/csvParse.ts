import Papa from "papaparse";

export async function parseCsv<T = Record<string, string>>(
  file: File
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<T>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          console.warn("CSV parse warnings:", results.errors.slice(0, 3));
        }
        resolve(results.data as T[]);
      },
      error: (err) => reject(err),
    });
  });
}

/**
 * Parse a CSV that has N metadata rows before the actual header row.
 * Reads the file as text, drops the first `skipRows` non-empty lines,
 * then feeds the rest to PapaParse with header=true.
 */
export async function parseCsvSkipRows<T = Record<string, string>>(
  file: File,
  skipRows: number
): Promise<T[]> {
  const text = await file.text();
  // Normalize BOM
  const clean = text.replace(/^\uFEFF/, "");
  // Drop the first `skipRows` lines as-is. We use a simple line splitter
  // because the metadata lines never contain embedded newlines in WATI/Zoom
  // exports (they're simple "Header,Value" rows).
  const lines = clean.split(/\r?\n/);
  const remaining = lines.slice(skipRows).join("\n");
  return new Promise((resolve, reject) => {
    Papa.parse<T>(remaining, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          console.warn(
            "CSV parse warnings (skipRows):",
            results.errors.slice(0, 3)
          );
        }
        resolve(results.data as T[]);
      },
      error: (err) => reject(err),
    });
  });
}

export function findCol(
  row: Record<string, any>,
  candidates: string[]
): string | undefined {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const norm = c.toLowerCase().replace(/[\s_]+/g, "");
    const match = keys.find(
      (k) => k.toLowerCase().replace(/[\s_]+/g, "") === norm
    );
    if (match) return match;
  }
  return undefined;
}

export function getVal(
  row: Record<string, any>,
  candidates: string[]
): string {
  const k = findCol(row, candidates);
  if (!k) return "";
  const v = row[k];
  return v == null ? "" : String(v).trim();
}
