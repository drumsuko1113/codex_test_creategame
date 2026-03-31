export function shouldApplySnapshot(currentVersion: number, nextVersion: number): boolean {
  return nextVersion > currentVersion;
}
