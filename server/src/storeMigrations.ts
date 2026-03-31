import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { splitSqlStatements } from "./storeDbUtils";

let migrationScriptsPromise: Promise<string[]> | null = null;

async function loadMigrationScripts(): Promise<string[]> {
  const migrationDir = fileURLToPath(new URL("../db/migrations", import.meta.url));
  const files = (await readdir(migrationDir)).filter((file) => file.endsWith(".sql")).sort();
  return Promise.all(files.map((file) => readFile(path.join(migrationDir, file), "utf8")));
}

export async function getMigrationScripts(): Promise<string[]> {
  if (!migrationScriptsPromise) {
    migrationScriptsPromise = loadMigrationScripts();
  }
  return migrationScriptsPromise;
}
