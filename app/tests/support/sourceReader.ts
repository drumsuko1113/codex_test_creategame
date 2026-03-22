import { readFileSync } from "node:fs";
import { join } from "node:path";

export function normalizeSource(source: string): string {
  return source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
}

export function readSource(relativePath: string): string {
  return normalizeSource(readFileSync(join(process.cwd(), relativePath), "utf8"));
}
