import { getAgentMailbox } from '../mailbox/index.js';
import type { MailboxOperations } from '../mailbox/types.js';

export function setContainerToolInFlight(tool: string, declaredTimeoutMs: number | null): void {
  getAgentMailbox().operations.setContainerToolInFlight(tool, declaredTimeoutMs);
}

export function clearContainerToolInFlight(): void {
  getAgentMailbox().operations.clearContainerToolInFlight();
}

export function clearStaleProcessingAcks(): void {
  getAgentMailbox().operations.clearStaleProcessingAcks();
}

export function gcOutboundHistory(cutoffIso: string): { messagesOut: number; acks: number } {
  return getAgentMailbox().operations.gcOutboundHistory(cutoffIso);
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
