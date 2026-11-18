/**
 * Keep a session's conversation readable when the session moves to another
 * provider.
 *
 * Continuations are stored per provider (db/session-state.ts), so a session
 * that starts on a provider with no conversation of its own begins a new one,
 * and the conversation it had on the previous provider does not continue.
 * Consider a slang-fixer session that ran on Claude until 2026-10-30 and whose
 * group now resolves to OpenCode. Its next start has no OpenCode continuation,
 * so it begins a fresh conversation, while its Claude conversation stays under
 * `continuation:claude`. Before this module, the new conversation never learned
 * that the earlier one existed.
 *
 * At start-up, when the current provider has no usable continuation, we ask
 * every other provider that holds one for this session to archive it as a
 * readable file (`history.archiveContinuation` on its runtime contract), and we
 * queue one note for the first turn of the new conversation that says where the
 * archive is. The other provider's continuation is left in place, so switching
 * back still resumes it.
 *
 * A record per provider and continuation (`handoff:<provider>:<continuation>`)
 * makes this happen once: the archive is written once, and the note is marked
 * delivered only after a turn has established the new conversation, so a turn
 * that fails before that repeats the note at the next start instead of losing
 * it.
 */
import { archiveProviderContinuation } from './provider-contracts/realize.js';
import { listProviderNames } from './providers/provider-registry.js';
import {
  getContinuationRecord,
  getProviderHandoff,
  setProviderHandoff,
  type ProviderHandoffRecord,
} from './db/session-state.js';
import { TIMEZONE, formatLocalStamp } from './timezone.js';

export interface ProviderHandoffEntry {
  provider: string;
  continuation: string;
  record: ProviderHandoffRecord;
}

export interface PendingProviderHandoff {
  /** The `<system>` note for the first turn of the new conversation. */
  note: string;
  entries: ProviderHandoffEntry[];
}

export interface PrepareProviderHandoffInput {
  /** The provider this session starts on, which holds no usable continuation. */
  currentProvider: string;
  assistantName?: string;
  log(message: string): void;
}

/**
 * Archive the conversations other providers hold for this session and return
 * the note for the new conversation, or null when there is nothing to tell.
 * Call it only when the current provider starts without a continuation.
 */
export function prepareProviderHandoff(input: PrepareProviderHandoffInput): PendingProviderHandoff | null {
  const current = input.currentProvider.toLowerCase();
  const entries: ProviderHandoffEntry[] = [];
  for (const provider of listProviderNames()) {
    if (provider === current) continue;
    const stored = getContinuationRecord(provider);
    if (!stored) continue;
    let record = getProviderHandoff(provider, stored.continuation);
    if (record?.noted) continue;
    if (!record) {
      const path = archiveProviderContinuation(provider, {
        continuation: stored.continuation,
        assistantName: input.assistantName,
        log: input.log,
      });
      record = { path, lastUsedAt: stored.updatedAt, noted: false };
      setProviderHandoff(provider, stored.continuation, record);
      input.log(
        `Provider handoff: ${provider} conversation ${stored.continuation} ` +
          (path ? `archived to ${path}` : 'has no readable transcript'),
      );
    }
    entries.push({ provider, continuation: stored.continuation, record });
  }
  if (entries.length === 0) return null;
  entries.sort((a, b) => (b.record.lastUsedAt ?? '').localeCompare(a.record.lastUsedAt ?? ''));
  return { note: formatHandoffNote(current, entries), entries };
}

/** Record that the new conversation has seen the note, so no later start repeats it. */
export function markProviderHandoffNoted(pending: PendingProviderHandoff): void {
  for (const entry of pending.entries) {
    setProviderHandoff(entry.provider, entry.continuation, { ...entry.record, noted: true });
  }
}

/**
 * The note for the new conversation. For example: "This session ran on claude
 * until 2026-10-30. That conversation does not continue here, because the
 * session now runs on opencode. It is archived at
 * /workspace/agent/conversations/2026-11-17-claude-6ddf83a4-….md: search it for
 * what you need (for example with grep), and do not read it whole."
 */
export function formatHandoffNote(currentProvider: string, entries: readonly ProviderHandoffEntry[]): string {
  return entries
    .map(({ provider, record }) => {
      const until = record.lastUsedAt
        ? ` until ${formatLocalStamp(new Date(record.lastUsedAt), TIMEZONE).slice(0, 10)}`
        : '';
      const head =
        `This session ran on ${provider}${until}. That conversation does not continue here, ` +
        `because the session now runs on ${currentProvider}.`;
      return record.path
        ? `${head} It is archived at ${record.path}: search it for what you need (for example with grep), ` +
            'and do not read it whole.'
        : `${head} No readable copy of it exists, so rebuild context from your memory notes, ` +
            'your work notes and the issue or PR thread.';
    })
    .join('\n');
}
