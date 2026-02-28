import { ApiClientError } from "./gameApi";

const MAX_POLLING_RETRY_DELAY_MS = 15000;

export function isRetryableNetworkError(error: unknown): boolean {
  return error instanceof ApiClientError && (error.code === "NETWORK_ERROR" || error.status === 0);
}

export function computePollingRetryDelayMs(baseIntervalMs: number, failureCount: number): number {
  const normalizedFailureCount = Math.max(0, failureCount);
  const delay = baseIntervalMs * 2 ** normalizedFailureCount;
  return Math.min(delay, MAX_POLLING_RETRY_DELAY_MS);
}
