const VISIBLE_POLLING_MS = 2000;
const HIDDEN_POLLING_MS = 3000;

export function getPollingIntervalMs(isDocumentHidden: boolean): number {
  return isDocumentHidden ? HIDDEN_POLLING_MS : VISIBLE_POLLING_MS;
}

export function shouldApplySnapshot(currentVersion: number, nextVersion: number): boolean {
  return nextVersion > currentVersion;
}
