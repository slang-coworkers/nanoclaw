/**
 * Core MCP tools: send_message, send_file, add_reaction.
 *
 * All outbound tools resolve destinations via the local destination map
 * (see destinations.ts). Agents reference destinations by name; the map
 * translates name → routing tuple. Permission enforcement happens on
 * the host side in delivery.ts via the agent_destinations table.
 */
import fs from 'fs';
import path from 'path';

import { findByName, findByRouting, getAllDestinations } from '../destinations.js';
import {
  getMessageInBySeq,
  getUnrespondedInboundsFromThread,
  hasInboundFromThread,
  type MessageInRow,
} from '../db/messages-in.js';
import { getMessageIdBySeq, getRoutingBySeq, hasOutboundToThread, writeMessageOut } from '../db/messages-out.js';
import { getCurrentInReplyTo } from '../db/session-state.js';
import { getSessionRouting } from '../db/session-routing.js';
import { auditCompletionMarkers, auditMetaAck } from './gate-audit.js';
import { registerTools } from './server.js';
import type { McpToolDefinition } from './types.js';

function log(msg: string): void {
  console.error(`[mcp-tools] ${msg}`);
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function err(text: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${text}` }], isError: true };
}

function destinationList(): string {
  const all = getAllDestinations();
  if (all.length === 0) return '(none)';
  return all.map((d) => d.name).join(', ');
}

/**
 * Resolve a destination name to routing fields.
 *
 * Look up the explicitly named destination. If it resolves to
 * the same channel the session is bound to, the session's thread_id is
 * preserved so replies land in the correct thread.
 *
 * For cross-channel sends and agent-to-agent (a2a) destinations, the
 * sender's current `thread_id` auto-propagates so parallel delegations
 * don't collapse into one shared recipient session ("I'm working on
 * PR-A in my thread, reviewer gets a PR-A-scoped session; I delegate
 * PR-B in a different thread, reviewer gets a PR-B-scoped session").
 *
 * `explicitThreadId`, if provided by the caller, always wins — enables
 * fan-out (sender sends N distinct sub-delegations from one thread) and
 * fan-in (two sender-threads collapse into one recipient session).
 * Pass `null` or `undefined` to fall through to the auto-propagation
 * rules above.
 */
function resolveRouting(
  to: string | undefined,
  explicitThreadId: string | null,
): { channel_type: string; platform_id: string; thread_id: string | null; resolvedName: string } | { error: string } {
  // nv-main keeps `to` OPTIONAL (upstream made it required): the fork's
  // chain-communication model relies on a bare send defaulting to the current
  // conversation + thread propagation (see CLAUDE.md "Sending messages").
  if (!to) {
    // Default: reply to whatever thread/channel this session is bound to.
    const session = getSessionRouting();
    if (session.channel_type && session.platform_id) {
      return {
        channel_type: session.channel_type,
        platform_id: session.platform_id,
        thread_id: explicitThreadId ?? session.thread_id,
        resolvedName: '(current conversation)',
      };
    }
    // No session routing (e.g., agent-shared or internal-only agent) —
    // fall back to the legacy single-destination shortcut.
    const all = getAllDestinations();
    if (all.length === 0) return { error: 'No destinations configured.' };
    if (all.length > 1) {
      return {
        error: `You have multiple destinations — specify "to". Options: ${all.map((d) => d.name).join(', ')}`,
      };
    }
    to = all[0].name;
  }
  const dest = findByName(to);
  if (!dest) return { error: `Unknown destination "${to}". Known: ${destinationList()}` };
  if (dest.type === 'channel') {
    // If the destination is the same channel the session is bound to,
    // preserve the thread_id so replies land in the correct thread.
    const session = getSessionRouting();
    const sameChannel = session.channel_type === dest.channelType && session.platform_id === dest.platformId;
    const threadId = explicitThreadId ?? (sameChannel ? session.thread_id : null);
    return {
      channel_type: dest.channelType!,
      platform_id: dest.platformId!,
      thread_id: threadId,
      resolvedName: to,
    };
  }
  // Agent-to-agent destination: auto-propagate sender's thread so each
  // sender-thread → one recipient-session. Explicit override wins for
  // fan-out / fan-in flows. Null → recipient's agent-shared root session
  // (back-compat with unthreaded installs).
  const session = getSessionRouting();
  const threadId = explicitThreadId ?? session.thread_id ?? null;
  return {
    channel_type: 'agent',
    platform_id: dest.agentGroupId!,
    thread_id: threadId,
    resolvedName: to,
  };
}

/** Normalise an optional thread_id tool argument. Matches the ingress
 *  contract: trim, empty → null, non-string → reject. */
function normalizeThreadIdArg(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, error: 'thread_id must be a string when provided' };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > 200) return { ok: false, error: 'thread_id too long (max 200 chars)' };
  return { ok: true, value: trimmed };
}

/**
 * Resolve `in_reply_to` arg → inbound row.
 *
 * Accepts the integer `seq` the agent sees as `<message id="N">`. Returns
 * `{ row: null }` when arg is omitted (caller falls through to the
 * batch-default in_reply_to from `getCurrentInReplyTo`). Rejects with a
 * specific error when arg is malformed or names a non-existent row, so
 * the model gets actionable feedback in a multi-thread batch instead of
 * silently mis-routing.
 */
function resolveInReplyTo(raw: unknown): { ok: true; row: MessageInRow | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, row: null };
  const seq = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(seq) || seq <= 0) {
    return { ok: false, error: 'in_reply_to must be the integer id shown on an inbound message (e.g. id="120" → 120)' };
  }
  const row = getMessageInBySeq(seq);
  if (!row) return { ok: false, error: `in_reply_to=${seq}: no inbound message with that id in this session` };
  return { ok: true, row };
}

/**
 * a2a runtime guard for bare writes to peer-owned threads.
 *
 * If an agent calls `send_message` to an a2a destination on a thread_id
 * the session has never originated AND has previously received from that
 * peer on that thread, the write is almost certainly a continuation — the
 * agent should be answering a specific inbound row, not blindly dropping
 * a message into an existing peer conversation. Without explicit
 * `in_reply_to`, the host can't reliably correlate the write with the
 * conversation it belongs to (the seq-129-class mis-tag bug).
 *
 * The guard rejects only when ALL of the following hold:
 *   - target channel is `agent` (a2a)
 *   - thread_id is set
 *   - agent did NOT pass `in_reply_to`
 *   - session has no prior outbound to (dest, thread)  [i.e. didn't originate]
 *   - session HAS a prior inbound from (dest, thread)  [peer is using it]
 *
 * Fresh dispatches (no prior inbound) are allowed without in_reply_to —
 * that's how new threads get started. Continuations of a thread we
 * originated (prior outbound exists) are allowed without in_reply_to —
 * we already own the thread.
 *
 * **Scope:** this guard catches *writes into peer-owned threads* without
 * explicit linkage. It does NOT detect content/thread mismatch on threads
 * the session originated — e.g. the seq-129 incident where the
 * orchestrator stamped slangpy-807 content onto thread_id=slang-11144
 * (both originated by the orchestrator) is NOT blocked here. That class
 * is addressed at the prevention layer: the formatter's `thread="…"`
 * attribute (so the agent sees thread context per inbound) plus the
 * `in_reply_to` arg on send_message/send_file (so the agent names the
 * exact inbound it's answering). Layering: prevention before 3b guard.
 */
function checkPeerThreadGuard(
  routing: { channel_type: string; platform_id: string; thread_id: string | null },
  inReplyRow: MessageInRow | null,
): { ok: true } | { ok: false; error: string } {
  if (routing.channel_type !== 'agent') return { ok: true };
  if (!routing.thread_id) return { ok: true };
  if (inReplyRow) return { ok: true };

  if (hasOutboundToThread(routing.channel_type, routing.platform_id, routing.thread_id)) {
    return { ok: true };
  }
  if (!hasInboundFromThread(routing.channel_type, routing.platform_id, routing.thread_id)) {
    return { ok: true };
  }
  return {
    ok: false,
    error:
      `Refusing to send to thread "${routing.thread_id}" without in_reply_to: this session has not originated this thread, ` +
      `but has received messages from the destination on it. Pass in_reply_to=<inbound id> to link to the message you're answering, ` +
      `or pick a different thread_id to start a new sub-conversation.`,
  };
}

/**
 * Apply in_reply_to overrides on top of `to`/`thread_id` args. When the
 * agent names an inbound row it's responding to, default both routing
 * destination and thread_id to the inbound's source — explicit args still
 * win. Returns the (possibly-rewritten) `to` and `thread_id` for
 * `resolveRouting`.
 */
function applyInReplyToDefaults(
  toArg: string | undefined,
  threadIdArg: string | null,
  inReplyRow: MessageInRow | null,
): { to: string | undefined; threadId: string | null } {
  if (!inReplyRow) return { to: toArg, threadId: threadIdArg };
  let resolvedTo = toArg;
  if (!resolvedTo && inReplyRow.channel_type && inReplyRow.platform_id) {
    const dest = findByRouting(inReplyRow.channel_type, inReplyRow.platform_id);
    if (dest) resolvedTo = dest.name;
  }
  // Pass inbound's thread_id as the "explicit" thread arg so resolveRouting
  // uses it instead of falling through to session-thread auto-propagation.
  // Caller's explicit thread_id arg always wins.
  const resolvedThread = threadIdArg !== null ? threadIdArg : (inReplyRow.thread_id ?? null);
  return { to: resolvedTo, threadId: resolvedThread };
}

/**
 * Auto-default `in_reply_to` when the agent sends to a peer-originated
 * thread without specifying which inbound it's answering. Returns:
 *   - { row, error: null } — caller's inReplyRow (explicit wins), OR a
 *     silent auto-resolve when exactly one unresponded inbound exists, OR
 *     null when the case isn't peer-thread-replying.
 *   - { row: null, error: string } — STRICT REJECTION when multiple
 *     unresponded inbounds exist. Forces the agent to pass `in_reply_to=<id>`
 *     explicitly so it can't silently re-attach the wrong message under
 *     ambiguity. The error names the candidate seqs so the agent can pick.
 *
 * "Unresponded" means no outbound row's `in_reply_to` points at the inbound's
 * id. If all candidates are responded, the helper returns null and falls
 * through to normal guard behavior.
 */
function autoResolveInReplyForPeerThread(
  routing: { channel_type: string; platform_id: string; thread_id: string | null },
  inReplyRow: MessageInRow | null,
): { row: MessageInRow | null; error: string | null } {
  if (inReplyRow) return { row: inReplyRow, error: null };
  if (routing.channel_type !== 'agent') return { row: null, error: null };
  if (!routing.thread_id) return { row: null, error: null };
  // NOTE: we do NOT short-circuit on hasOutboundToThread. An originated
  // thread can still accumulate unresponded peer replies (e.g. orchestrator
  // sends kickoff, peer replies multiple times); skipping auto-resolve in
  // that case lets bare writes go through and silently mis-attach. The
  // unresponded-inbound check below is the deterministic signal — it
  // already filters out inbounds we've already replied to, so continuation
  // (all replied) naturally returns 0 candidates and falls through.
  const candidates = getUnrespondedInboundsFromThread(routing.channel_type, routing.platform_id, routing.thread_id);
  if (candidates.length === 0) return { row: null, error: null };
  if (candidates.length === 1) return { row: candidates[0], error: null };
  // Multiple unresponded inbounds — REJECT to force the agent to disambiguate.
  // Auto-picking "latest" is convenient but unsafe: the agent may have intended
  // an older message. Strict mode prevents silent wrong-attachment.
  const seqs = candidates.map((c) => `#${c.seq}`).join(', ');
  const error =
    `Refusing to send to thread "${routing.thread_id}" without in_reply_to: ` +
    `${candidates.length} unresponded inbound rows exist on this peer thread (${seqs}). ` +
    `Pass in_reply_to=<seq> explicitly to name which inbound you're answering.`;
  return { row: null, error };
}

export const sendMessage: McpToolDefinition = {
  tool: {
    name: 'send_message',
    description:
      'Send a message to a named destination. If you have only one destination, you can omit `to`. For threaded contexts, thread_id auto-propagates from the sender\'s current thread unless explicitly overridden. When responding to a specific inbound message in a multi-message batch, pass `in_reply_to=<id>` (the integer id from `<message id="…">`) so routing/thread_id default to that inbound — avoids cross-thread mis-tagging when the batch contains several distinct conversations.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        to: {
          type: 'string',
          description:
            'Destination name (e.g., "family", "worker-1"). Optional if you have only one destination, or if `in_reply_to` is set (defaults to that inbound\'s source).',
        },
        text: { type: 'string', description: 'Message content' },
        thread_id: {
          type: 'string',
          description:
            'Optional thread identifier. Defaults to `in_reply_to`\'s thread when set, otherwise the current session\'s thread_id. Pass an explicit value for fan-out ("review-PR-A") or fan-in (shared id).',
        },
        in_reply_to: {
          type: 'integer',
          description:
            'Optional inbound message id (the integer from `<message id="…">`). When set: routes to that inbound\'s source by default, copies its thread_id, and stamps the host\'s reply-correlation column so multi-hop a2a return paths land in the originating session. Use this whenever you reply to a specific inbound in a batch with several threads.',
        },
        target_session_id: {
          type: 'string',
          description:
            'Optional recipient session id (e.g. "sess-1779608995355-ltmvni"). When set, routing delivers to that exact session within the resolved destination if it is active and belongs to that destination — useful to wake a specific paused session whose context you want to resume rather than letting routing mint a fresh per-thread session. Falls through to default routing on any mismatch (warning logged host-side). The pin only narrows session selection within an already-authorized recipient; it does NOT bypass destination authorization.',
        },
      },
      required: ['text'],
    },
  },
  async handler(args) {
    const text = args.text as string;
    if (!text) return err('text is required');

    const threadIdArg = normalizeThreadIdArg(args.thread_id);
    if (!threadIdArg.ok) return err(threadIdArg.error);

    const inReplyTo = resolveInReplyTo(args.in_reply_to);
    if (!inReplyTo.ok) return err(inReplyTo.error);
    const inReplyRow = inReplyTo.row;

    const { to: effectiveTo, threadId: effectiveThread } = applyInReplyToDefaults(
      typeof args.to === 'string' ? args.to : undefined,
      threadIdArg.value,
      inReplyRow,
    );
    const routing = resolveRouting(effectiveTo, effectiveThread);
    if ('error' in routing) return err(routing.error);

    const auto = autoResolveInReplyForPeerThread(routing, inReplyRow);
    if (auto.error) return err(auto.error);
    const effectiveInReplyRow = auto.row;

    const guard = checkPeerThreadGuard(routing, effectiveInReplyRow);
    if (!guard.ok) return err(guard.error);

    const targetSessionId =
      typeof args.target_session_id === 'string' && args.target_session_id.trim() !== ''
        ? args.target_session_id.trim()
        : null;

    const id = generateId();
    const seq = writeMessageOut({
      id,
      kind: 'chat',
      platform_id: routing.platform_id,
      channel_type: routing.channel_type,
      thread_id: routing.thread_id,
      content: JSON.stringify(targetSessionId ? { text, target_session_id: targetSessionId } : { text }),
      in_reply_to: effectiveInReplyRow ? effectiveInReplyRow.id : getCurrentInReplyTo(),
    });

    const wasAutoResolved = effectiveInReplyRow && effectiveInReplyRow !== inReplyRow;
    log(
      `send_message: #${seq} → ${routing.resolvedName}${routing.thread_id ? ` (thread=${routing.thread_id})` : ''}${effectiveInReplyRow ? ` (in_reply_to=${effectiveInReplyRow.seq}${wasAutoResolved ? ' auto' : ''})` : ''}`,
    );
    const baseMsg = `Message sent to ${routing.resolvedName} (id: ${seq})`;
    const audits: string[] = [];
    const completionAudit = auditCompletionMarkers(text);
    if (completionAudit) audits.push(completionAudit);
    const metaAckAudit = auditMetaAck(text, routing.channel_type);
    if (metaAckAudit) audits.push(metaAckAudit);
    if (audits.length > 0) log(audits.join('\n'));
    return ok(audits.length > 0 ? `${baseMsg}\n${audits.join('\n')}` : baseMsg);
  },
};

export const sendFile: McpToolDefinition = {
  tool: {
    name: 'send_file',
    description:
      'Send a file to a named destination. If you have only one destination, you can omit `to`. Same in_reply_to semantics as send_message — pass `in_reply_to=<id>` to attach the file as a reply to a specific inbound message.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        to: {
          type: 'string',
          description: 'Destination name. Optional if you have only one destination, or if `in_reply_to` is set.',
        },
        path: { type: 'string', description: 'File path (relative to /workspace/agent/ or absolute)' },
        text: { type: 'string', description: 'Optional accompanying message' },
        filename: { type: 'string', description: 'Display name (default: basename of path)' },
        thread_id: {
          type: 'string',
          description:
            "Optional thread identifier. Same semantics as send_message: defaults to `in_reply_to`'s thread when set, otherwise the current session's thread_id.",
        },
        in_reply_to: {
          type: 'integer',
          description:
            'Optional inbound message id (the integer from `<message id="…">`). Routes to that inbound\'s source by default and copies its thread_id; stamps the host\'s reply-correlation column.',
        },
        target_session_id: {
          type: 'string',
          description:
            'Optional recipient session id (same semantics as send_message). When set, the file delivers to that exact session within the resolved destination if active and owned by it; falls through on mismatch.',
        },
      },
      required: ['path'],
    },
  },
  async handler(args) {
    const filePath = args.path as string;
    if (!filePath) return err('path is required');

    const threadIdArg = normalizeThreadIdArg(args.thread_id);
    if (!threadIdArg.ok) return err(threadIdArg.error);

    const inReplyTo = resolveInReplyTo(args.in_reply_to);
    if (!inReplyTo.ok) return err(inReplyTo.error);
    const inReplyRow = inReplyTo.row;

    const { to: effectiveTo, threadId: effectiveThread } = applyInReplyToDefaults(
      typeof args.to === 'string' ? args.to : undefined,
      threadIdArg.value,
      inReplyRow,
    );
    const routing = resolveRouting(effectiveTo, effectiveThread);
    if ('error' in routing) return err(routing.error);

    const auto = autoResolveInReplyForPeerThread(routing, inReplyRow);
    if (auto.error) return err(auto.error);
    const effectiveInReplyRow = auto.row;

    const guard = checkPeerThreadGuard(routing, effectiveInReplyRow);
    if (!guard.ok) return err(guard.error);

    const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve('/workspace/agent', filePath);
    if (!fs.existsSync(resolvedPath)) return err(`File not found: ${filePath}`);

    const targetSessionId =
      typeof args.target_session_id === 'string' && args.target_session_id.trim() !== ''
        ? args.target_session_id.trim()
        : null;

    const id = generateId();
    const filename = (args.filename as string) || path.basename(resolvedPath);

    const outboxDir = path.join('/workspace/outbox', id);
    fs.mkdirSync(outboxDir, { recursive: true });
    fs.copyFileSync(resolvedPath, path.join(outboxDir, filename));

    const fileContent: Record<string, unknown> = {
      text: (args.text as string) || '',
      files: [filename],
    };
    if (targetSessionId) fileContent.target_session_id = targetSessionId;

    writeMessageOut({
      id,
      kind: 'chat',
      platform_id: routing.platform_id,
      channel_type: routing.channel_type,
      thread_id: routing.thread_id,
      content: JSON.stringify(fileContent),
      in_reply_to: effectiveInReplyRow ? effectiveInReplyRow.id : getCurrentInReplyTo(),
    });

    const wasAutoResolvedFile = effectiveInReplyRow && effectiveInReplyRow !== inReplyRow;
    log(
      `send_file: ${id} → ${routing.resolvedName} (${filename})${effectiveInReplyRow ? ` (in_reply_to=${effectiveInReplyRow.seq}${wasAutoResolvedFile ? ' auto' : ''})` : ''}`,
    );
    return ok(`File sent to ${routing.resolvedName} (id: ${id}, filename: ${filename})`);
  },
};

export const addReaction: McpToolDefinition = {
  tool: {
    name: 'add_reaction',
    description: 'Add an emoji reaction to a message.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        messageId: { type: 'integer', description: 'Message ID (the numeric id shown in messages)' },
        emoji: { type: 'string', description: 'Emoji name (e.g., thumbs_up, heart, check)' },
      },
      required: ['messageId', 'emoji'],
    },
  },
  async handler(args) {
    const seq = Number(args.messageId);
    const emoji = args.emoji as string;
    if (!seq || !emoji) return err('messageId and emoji are required');

    const platformId = getMessageIdBySeq(seq);
    if (!platformId) return err(`Message #${seq} not found`);

    const routing = getRoutingBySeq(seq);
    if (!routing || !routing.channel_type || !routing.platform_id) {
      return err(`Cannot determine destination for message #${seq}`);
    }

    const id = generateId();
    writeMessageOut({
      id,
      kind: 'chat',
      platform_id: routing.platform_id,
      channel_type: routing.channel_type,
      thread_id: routing.thread_id,
      content: JSON.stringify({ operation: 'reaction', messageId: platformId, emoji }),
    });

    log(`add_reaction: #${seq} → ${emoji} on ${platformId}`);
    return ok(`Reaction queued for #${seq}`);
  },
};

const reportPrCreated: McpToolDefinition = {
  tool: {
    name: 'report_pr_created',
    description:
      'Report that you created a GitHub PR. Enables webhook events (review comments, CI status) for this PR to route back to your current session instead of creating an orphan.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        repo: { type: 'string', description: 'Repository in owner/name format (e.g. shader-slang/slangpy)' },
        pr_number: { type: 'number', description: 'PR number' },
      },
      required: ['repo', 'pr_number'],
    },
  },
  async handler(args) {
    const repo = typeof args.repo === 'string' ? args.repo.trim() : '';
    const prNumber = typeof args.pr_number === 'number' ? args.pr_number : NaN;
    if (!repo || !Number.isFinite(prNumber)) {
      return err('repo (string) and pr_number (number) are required');
    }

    const seq = writeMessageOut({
      id: generateId(),
      kind: 'system',
      platform_id: null,
      channel_type: null,
      thread_id: null,
      content: JSON.stringify({ action: 'map_pr_session', repo, pr_number: prNumber }),
    });

    log(`report_pr_created: #${seq} → ${repo}#${prNumber} mapped to this session`);
    return ok(`PR ${repo}#${prNumber} mapped to this session. Webhook events will route here.`);
  },
};

const recordDecision: McpToolDefinition = {
  tool: {
    name: 'record_decision',
    description:
      'Record one PR-approval decision to the host approval_decisions ledger. Host-owned + auditable; survives container exit. The host ENFORCES that your agent group holds the ledger-writer capability — a call from any other group is denied and you are told so; this is not an honour-system restriction. APPEND-ONLY: one row per (repo, pr, commit_sha), first write wins. Repeating an identical decision is a harmless no-op; a DIFFERENT decision for the same commit is refused — record the new head instead. This is the ledger append gated by the critique stages; call it only after the recorded verdicts exist. The human review outcome is joined automatically by the host from GitHub, so there is nothing for you to report about it.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        repo: { type: 'string', description: 'Repository in owner/name format (e.g. shader-slang/slang)' },
        pr_number: { type: 'number', description: 'PR number' },
        commit_sha: { type: 'string', description: 'The reviewed commit (R0 in historical mode; head in live)' },
        mode: { type: 'string', description: 'historical | live | live_late' },
        decision: {
          type: 'string',
          description: 'Closed enum: WOULD_APPROVE | BLOCK | ABSTAIN_POLICY',
        },
        reason_code: { type: 'string', description: 'e.g. CLAUSE_FAIL:<name>, OPEN_GAP, REVIEW_DOC_MISSING' },
        review_diff_hash: { type: 'string', description: 'The diff_hash the review doc reported reviewing' },
        policy_version: { type: 'string', description: 'APPROVAL_POLICY policy_version' },
        clauses: { description: 'The clauses.json evidence (object or JSON string)' },
        challenger: { description: 'Challenger finding or CHALLENGER_CLEAN (object or JSON string)' },
        ts: { type: 'string', description: 'ISO timestamp of the decision' },
      },
      required: ['repo', 'pr_number', 'commit_sha', 'decision'],
    },
  },
  async handler(args) {
    const repo = typeof args.repo === 'string' ? args.repo.trim() : '';
    const prNumber = typeof args.pr_number === 'number' ? args.pr_number : NaN;
    const commitSha = typeof args.commit_sha === 'string' ? args.commit_sha.trim() : '';
    const decision = typeof args.decision === 'string' ? args.decision.trim() : '';
    if (!repo || !Number.isFinite(prNumber) || !commitSha || !decision) {
      return err('repo (string), pr_number (number), commit_sha (string), decision (string) are required');
    }

    const seq = writeMessageOut({
      id: generateId(),
      kind: 'system',
      platform_id: null,
      channel_type: null,
      thread_id: null,
      content: JSON.stringify({
        action: 'record_decision',
        repo,
        pr_number: prNumber,
        commit_sha: commitSha,
        mode: args.mode,
        decision,
        reason_code: args.reason_code,
        review_diff_hash: args.review_diff_hash,
        policy_version: args.policy_version,
        clauses: args.clauses,
        challenger: args.challenger,
        ts: args.ts,
      }),
    });

    log(`record_decision: #${seq} → ${repo}#${prNumber}@${commitSha.slice(0, 12)} = ${decision}`);
    return ok(`Decision recorded: ${repo}#${prNumber}@${commitSha.slice(0, 12)} = ${decision}`);
  },
};

// `record_human_verdict` is deliberately NOT registered. The human review
// outcome is stamped host-side from the GitHub webhook that observed it
// (notifyApproverOfTerminalPr), keyed by the delivery id; the host guard denies
// the container-originated action outright. Offering a tool whose every call is
// refused would just burn approver turns. The host-side denial remains as
// defence in depth for container images built before this change.
registerTools([sendMessage, sendFile, addReaction, reportPrCreated, recordDecision]);
