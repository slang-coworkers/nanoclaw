import { getAgentMailbox } from '../mailbox/index.js';
import type { MailboxOperations } from '../mailbox/types.js';

export function setContainerToolInFlight(tool: string, declaredTimeoutMs: number | null): void {
  getAgentMailbox().operations.setContainerToolInFlight(tool, declaredTimeoutMs);
}

/**
 * Return the timeout a tool call declares for itself, in ms, or null. Bash
 * declares one in `tool_input.timeout`; no other tool does. The host's stuck
 * check widens its tolerance to a running Bash call's declared timeout.
 */
export function declaredToolTimeoutMs(tool: string, toolInput: Record<string, unknown> | undefined): number | null {
  return tool === 'Bash' && typeof toolInput?.timeout === 'number' ? toolInput.timeout : null;
}

export function clearContainerToolInFlight(): void {
  getAgentMailbox().operations.clearContainerToolInFlight();
}

export function clearStaleProcessingAcks(): void {
  getAgentMailbox().operations.clearStaleProcessingAcks();
}

export function gcOutboundHistory(
  cutoffIso: string,
  maxRows?: number,
): { messagesOut: number; acks: number; more?: boolean } {
  return getAgentMailbox().operations.gcOutboundHistory(cutoffIso, maxRows);
}

/** Null when the active mailbox has no on-disk file to reclaim. */
export function reclaimOutboundSpace(): ReturnType<NonNullable<MailboxOperations['reclaimOutboundSpace']>> | null {
  const ops = getAgentMailbox().operations;
  return ops.reclaimOutboundSpace ? ops.reclaimOutboundSpace() : null;
}

/**
 * Mailbox history retention in days. Mirrors the host's
 * resolveMailboxRetentionDays (src/reconcile-session.ts): unset/blank/invalid →
 * 30, 0 → off, otherwise the number given.
 */
export const DEFAULT_MAILBOX_RETENTION_DAYS = 30;
export function resolveMailboxRetentionDays(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_MAILBOX_RETENTION_DAYS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MAILBOX_RETENTION_DAYS;
  return n;
}
