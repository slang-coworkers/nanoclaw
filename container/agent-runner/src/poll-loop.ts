import fs from 'fs';
import path from 'path';

import {
  buildSystemPromptAddendum,
  findByName,
  getAllDestinations,
  getDestinationsFingerprint,
  type DestinationEntry,
} from './destinations.js';
import { getPendingMessages, markProcessing, markCompleted, type MessageInRow } from './db/messages-in.js';
import { writeMessageOut } from './db/messages-out.js';
import { getInboundDb, touchHeartbeat, clearStaleProcessingAcks } from './db/connection.js';
import { clearContinuation, migrateLegacyContinuation, setContinuation } from './db/session-state.js';
import { clearCurrentInReplyTo, setCurrentInReplyTo } from './current-batch.js';
import {
  formatMessages,
  extractRouting,
  categorizeMessage,
  isClearCommand,
  isRunnerCommand,
  stripInternalTags,
  type RoutingContext,
} from './formatter.js';
import { classifyAndPrepend } from './intent-router-bridge.js';
import { isUploadTraceCommand, uploadTrace } from './upload-trace.js';
import type { AgentProvider, AgentQuery, ProviderEvent, ProviderExchange } from './providers/types.js';

const POLL_INTERVAL_MS = 1000;
const ACTIVE_POLL_INTERVAL_MS = 500;
// End stream after this many ms with no SDK events.
// Set NANOCLAW_IDLE_END_MS in the container env to override per-agent-group.
const IDLE_END_MS = process.env.NANOCLAW_IDLE_END_MS
  ? Math.max(60_000, parseInt(process.env.NANOCLAW_IDLE_END_MS, 10))
  : 1_200_000;

/**
 * Number of consecutive `database disk image is malformed` errors after which
 * the follow-up poll gives up and exits the process. At ACTIVE_POLL_INTERVAL_MS
 * = 500ms this is roughly 5 seconds — long enough to dodge a transient torn
 * read during a host write, short enough to recover quickly from a poisoned
 * page cache (host-sweep then respawns with a fresh mount).
 */
const CORRUPTION_STREAK_EXIT = 10;

/**
 * True for SQLite errors that indicate a corrupt READ view — almost always a
 * cross-mount page-cache coherency issue on Docker Desktop macOS rather than
 * actual file damage (host-side integrity_check passes). Reopening the DB
 * handle inside this process does NOT recover; only a fresh container mount
 * does. Caller's job is to exit so host-sweep respawns the container.
 */
export function isCorruptionError(msg: string): boolean {
  return (
    msg.includes('database disk image is malformed') ||
    msg.includes('SQLITE_CORRUPT') ||
    msg.includes('file is not a database')
  );
}

function log(msg: string): void {
  console.error(`[poll-loop] ${msg}`);
}

/**
 * Mirror an overlay event to the dashboard's hook-event ingest. Same
 * shape the universal SDK PostToolUse curl uses, with `tool_name="overlay"`
 * and an `event` namespace prefix so the timeline can filter / colorize.
 *
 * Container-runner sets `NANOCLAW_HOOK_URL` when the dashboard is
 * configured; empty value → silent no-op (dashboards don't exist on every
 * install). Errors are swallowed: this is observability, not control flow.
 */
function postOverlayEvent(event: string, extra: Record<string, unknown> = {}): void {
  const url = process.env.NANOCLAW_HOOK_URL;
  if (!url) return;
  const payload = JSON.stringify({
    hook_event_name: event,
    tool_name: 'overlay',
    session_id: process.env.NANOCLAW_SESSION_ID ?? '',
    thread_id: process.env.NANOCLAW_SESSION_THREAD_ID ?? '',
    group: process.env.NANOCLAW_GROUP_FOLDER ?? '',
    ...extra,
  });
  // Fire-and-forget — do not await, do not block dispatch on a slow
  // dashboard. The host curl runs as a child process so we get the same
  // proxy-bypass behavior as the universal hook.
  try {
    const { spawn } = require('child_process') as typeof import('child_process');
    const child = spawn(
      'curl',
      [
        '-sf',
        '--proxy',
        '',
        '-X',
        'POST',
        url,
        '-H',
        'Content-Type: application/json',
        '-H',
        `X-Group-Folder: ${process.env.NANOCLAW_GROUP_FOLDER ?? ''}`,
        '-H',
        `X-NanoClaw-Session-Id: ${process.env.NANOCLAW_SESSION_ID ?? ''}`,
        '-H',
        `X-NanoClaw-Session-Thread-Id: ${process.env.NANOCLAW_SESSION_THREAD_ID ?? ''}`,
        '-d',
        payload,
        '--max-time',
        '3',
      ],
      { stdio: 'ignore', detached: true },
    );
    child.unref();
    child.on('error', () => {});
  } catch {
    // ignore — observability is best-effort
  }
}

/**
 * True iff the message is a scheduled task that explicitly OPTS OUT of the
 * fresh-session default by setting `content.new_session === false`. The
 * default across the system is now fresh-session-on for recurring task
 * batches (see isNewSessionBatch); tasks that genuinely need the stored
 * continuation (chained workflows that carry state in conversation memory,
 * rather than in files) must opt out explicitly.
 *
 * Strict `=== false` matters — an absent key or `true` both participate in
 * the default; only an explicit `false` blocks it. Swallows malformed JSON
 * rather than throwing.
 */
export function taskOptsOutOfNewSession(m: { kind: string; content: string }): boolean {
  if (m.kind !== 'task') return false;
  try {
    return (JSON.parse(m.content) as Record<string, unknown>).new_session === false;
  } catch {
    return false;
  }
}

/**
 * Default-on fresh-session policy for recurring task batches:
 *   - Empty batch: false (defensive — no spurious fresh sessions).
 *   - Any chat in the batch: false (mixed batches preserve chat history).
 *   - All-tasks AND at least one opts out via `new_session: false`: false
 *     (safer to preserve continuity than drop it when any task asks).
 *   - All-tasks AND none opts out: true (the common heartbeat/cron case,
 *     now the default without any flag needing to be set).
 *
 * Historical note: PR #58 introduced opt-in (`new_session: true`); PR #106
 * fixed the follow-up-push bypass; empirical prod rollout (slang-discord-
 * support: $0.57 after flip vs $1.00 before, on 11 turns vs 3) confirmed
 * the delta is real enough to make opt-out the sane default.
 */
export function isNewSessionBatch(keep: Array<{ kind: string; content: string }>): boolean {
  return keep.length > 0 && keep.every((m) => m.kind === 'task') && !keep.some(taskOptsOutOfNewSession);
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build a per-loop refresher for the destinations section of the system
 * prompt. The host re-projects `inbound.db::destinations` whenever a new
 * coworker is wired up (dashboard/server.ts → refreshRunningSessions),
 * but Claude SDK pins the system prompt at the initial query and never
 * re-reads it for `query.push()` follow-ups. Two-part fix:
 *
 *   1. Always update `systemContext.instructions` so the NEXT fresh query
 *      starts with the current destinations list.
 *   2. Return an inline `[System: destinations updated …]` block that the
 *      caller prepends to the pushed prompt so the agent sees the live
 *      list even while the frozen system prompt is stale.
 *
 * Returns null (no inline note needed) when destinations haven't changed
 * since the last call, or on the very first call (seed observation —
 * otherwise every container's first push carries a redundant note).
 */
function makeDestinationsRefresher(
  systemContext: PollLoopConfig['systemContext'],
): () => string | null {
  let last: string | null = null;
  return () => {
    const fp = getDestinationsFingerprint();
    if (fp === last) return null;
    const firstCall = last === null;
    last = fp;
    if (systemContext) systemContext.instructions = buildSystemPromptAddendum();
    if (firstCall) return null;
    log('Destinations changed — refreshed system prompt + push-block');
    return buildDestinationsPushNote();
  };
}

/** Inline system note listing current destinations; prepended to pushed prompts. */
function buildDestinationsPushNote(): string {
  const all = getAllDestinations();
  if (all.length === 0) {
    return '\n[System: destinations updated — you currently have no configured destinations.]\n\n';
  }
  const names = all
    .map((d) => (d.displayName && d.displayName !== d.name ? `${d.name} (${d.displayName})` : d.name))
    .map((s) => `  - ${s}`)
    .join('\n');
  return (
    '\n[System: destinations list updated since your previous turn. Current list:\n' +
    names +
    '\nUse THIS list, not any earlier mention. No restart is needed.]\n\n'
  );
}


export interface PollLoopConfig {
  provider: AgentProvider;
  /**
   * Name of the provider (e.g. "claude", "codex", "opencode"). Used to key
   * the stored continuation per-provider so flipping providers doesn't
   * resurrect a stale id from a different backend.
   */
  providerName: string;
  cwd: string;
  systemContext?: {
    instructions?: string;
  };
  /**
   * Optional stop signal. In production the loop runs until the container
   * dies; tests pass a signal so an abandoned loop actually exits instead of
   * polling forever and stealing messages from the next test's DB.
   */
  signal?: AbortSignal;
}

/**
 * Main poll loop. Runs indefinitely until the process is killed.
 *
 * 1. Poll messages_in for pending rows
 * 2. Format into prompt, call provider.query()
 * 3. While query active: continue polling, push new messages via provider.push()
 * 4. On result: write messages_out
 * 5. Mark messages completed
 * 6. Loop
 */
export async function runPollLoop(config: PollLoopConfig): Promise<void> {
  // Resume the agent's prior session from a previous container run if one
  // was persisted. The continuation is opaque to the poll-loop — the
  // provider decides how to use it (Claude resumes a .jsonl transcript,
  // other providers may reload a thread ID, etc.). Keyed per-provider so
  // a Codex thread id never gets handed to Claude or vice versa.
  let continuation: string | undefined = migrateLegacyContinuation(config.providerName);

  // Before resuming, drop a session whose on-disk transcript has grown too
  // large/old to cold-resume within the host's idle ceiling. Without this a
  // long-lived hub keeps trying to reload an ever-growing .jsonl, hangs the
  // first turn, and gets killed before it can reply (then repeats forever).
  if (continuation) {
    const rotateReason = config.provider.maybeRotateContinuation?.(continuation, config.cwd);
    if (rotateReason) {
      log(`Rotating session — ${rotateReason}; starting fresh`);
      clearContinuation(config.providerName);
      continuation = undefined;
    }
  }

  if (continuation) {
    log(`Resuming agent session ${continuation}`);
  }

  // Clear leftover 'processing' acks from a previous crashed container.
  // This lets the new container re-process those messages.
  clearStaleProcessingAcks();

  const refreshDestinations = makeDestinationsRefresher(config.systemContext);

  let pollCount = 0;
  let isFirstPoll = true;
  while (true) {
    if (config.signal?.aborted) return;
    // Skip system messages — they're responses for MCP tools (e.g., ask_user_question)
    const messages = getPendingMessages(isFirstPoll).filter((m) => m.kind !== 'system');
    isFirstPoll = false;
    pollCount++;

    // Periodic heartbeat so we know the loop is alive
    if (pollCount % 30 === 0) {
      log(`Poll heartbeat (${pollCount} iterations, ${messages.length} pending)`);
    }

    if (messages.length === 0) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    // Accumulate gate: if the batch contains only trigger=0 rows
    // (context-only, router-stored under ignored_message_policy='accumulate'),
    // don't wake the agent. Leave them `pending` — they'll ride along the
    // next time a real trigger=1 message lands via this same getPendingMessages
    // query. Without this gate, a warm container keeps processing
    // (and potentially responding to) every accumulate-only batch, defeating
    // the "store as context, don't engage" contract. Host-side countDueMessages
    // gates the same way for wake-from-cold (see src/db/session-db.ts).
    if (!messages.some((m) => m.trigger === 1)) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    const ids = messages.map((m) => m.id);
    markProcessing(ids);

    const routing = extractRouting(messages);

    // Command handling: the host router gates filtered and unauthorized
    // admin commands before they reach the container. The only command
    // the runner handles directly is /clear (session reset).
    const normalMessages: MessageInRow[] = [];
    const commandIds: string[] = [];

    for (const msg of messages) {
      if ((msg.kind === 'chat' || msg.kind === 'chat-sdk') && isClearCommand(msg)) {
        log('Clearing session (resetting continuation)');
        continuation = undefined;
        clearContinuation(config.providerName);
        writeMessageOut({
          id: generateId(),
          kind: 'chat',
          platform_id: routing.platformId,
          channel_type: routing.channelType,
          thread_id: routing.threadId,
          content: JSON.stringify({ text: 'Session cleared.' }),
        });
        commandIds.push(msg.id);
        continue;
      }
      if ((msg.kind === 'chat' || msg.kind === 'chat-sdk') && isUploadTraceCommand(msg)) {
        log('Uploading session trace to Hugging Face');
        writeMessageOut({
          id: generateId(),
          kind: 'chat',
          platform_id: routing.platformId,
          channel_type: routing.channelType,
          thread_id: routing.threadId,
          content: JSON.stringify({ text: uploadTrace() }),
        });
        commandIds.push(msg.id);
        continue;
      }
      normalMessages.push(msg);
    }

    if (commandIds.length > 0) {
      markCompleted(commandIds);
    }

    if (normalMessages.length === 0) {
      const remainingIds = ids.filter((id) => !commandIds.includes(id));
      if (remainingIds.length > 0) markCompleted(remainingIds);
      log(`All ${messages.length} message(s) were commands, skipping query`);
      continue;
    }

    // Pre-task scripts: for any task rows with a `script`, run it before the
    // provider call. Scripts returning wakeAgent=false (or erroring) gate
    // their own task row only — surviving messages still go to the agent.
    // Without the scheduling module, the marker block is empty, `keep`
    // falls back to `normalMessages`, and no gating happens.
    let keep: MessageInRow[] = normalMessages;
    let skipped: string[] = [];
    // MODULE-HOOK:scheduling-pre-task:start
    const { applyPreTaskScripts } = await import('./scheduling/task-script.js');
    const preTask = await applyPreTaskScripts(normalMessages);
    keep = preTask.keep;
    skipped = preTask.skipped;
    if (skipped.length > 0) {
      markCompleted(skipped);
      log(`Pre-task script skipped ${skipped.length} task(s): ${skipped.join(', ')}`);
    }
    // MODULE-HOOK:scheduling-pre-task:end

    if (keep.length === 0) {
      log(`All ${normalMessages.length} non-command message(s) gated by script, skipping query`);
      continue;
    }

    // Scheduled tasks with new_session:true run in a fresh context so
    // heartbeat/cron history doesn't accumulate across runs. Only applies
    // when the entire batch is tasks (no chat messages mixed in) — mixed
    // batches default to the stored continuation so chat history is preserved.
    const newSessionBatch = isNewSessionBatch(keep);

    // Format messages: passthrough commands get raw text (only if the
    // provider natively handles slash commands), others get XML.
    let prompt = formatMessagesWithCommands(keep, config.provider.supportsNativeSlashCommands);

    // Non-native providers: run intent router on the initial prompt too.
    // Claude SDK fires UserPromptSubmit hooks natively; for Codex/OpenCode
    // we call the same bridge so workflow classification applies to every
    // user message regardless of provider.
    if (!config.provider.supportsNativeSlashCommands) {
      prompt = await classifyAndPrepend(prompt);
    }

    log(`Processing ${keep.length} message(s), kinds: ${[...new Set(keep.map((m) => m.kind))].join(',')}`);
    if (newSessionBatch) log('new_session flag set — running task in fresh context');

    // Pick up destination changes the host wrote mid-session so the agent
    // sees new coworkers without requiring a container restart.
    refreshDestinations();

    const query = config.provider.query({
      prompt,
      continuation: newSessionBatch ? undefined : continuation,
      cwd: config.cwd,
      systemContext: config.systemContext,
    });

    // Process the query while concurrently polling for new messages
    const skippedSet = new Set(skipped);
    const processingIds = ids.filter((id) => !commandIds.includes(id) && !skippedSet.has(id));
    // Publish the batch's in_reply_to so MCP tools (send_message, send_file)
    // can stamp it on outbound rows — needed for a2a return-path routing.
    setCurrentInReplyTo(routing.inReplyTo);
    try {
      const result = await processQuery(
        query,
        routing,
        processingIds,
        config.providerName,
        newSessionBatch,
        refreshDestinations,
        config.provider.onExchangeComplete?.bind(config.provider),
        prompt,
        continuation,
      );
      // Don't overwrite the stored chat continuation with a task's ephemeral session.
      if (!newSessionBatch && result.continuation && result.continuation !== continuation) {
        continuation = result.continuation;
        setContinuation(config.providerName, continuation);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log(`Query error: ${errMsg}`);

      // Stale/corrupt continuation recovery: ask the provider whether
      // this error means the stored continuation is unusable, and clear
      // it so the next attempt starts fresh.
      if (continuation && config.provider.isSessionInvalid(err)) {
        log(`Stale session detected (${continuation}) — clearing for next retry`);
        continuation = undefined;
        clearContinuation(config.providerName);
      }

      // Write error response so the user knows something went wrong
      writeMessageOut({
        id: generateId(),
        kind: 'chat',
        platform_id: routing.platformId,
        channel_type: routing.channelType,
        thread_id: routing.threadId,
        content: JSON.stringify({ text: `Error: ${errMsg}` }),
      });
    } finally {
      clearCurrentInReplyTo();
    }

    // Ensure completed even if processQuery ended without a result event
    // (e.g. stream closed unexpectedly).
    markCompleted(processingIds);
    log(`Completed ${ids.length} message(s)`);
  }
}

/**
 * For non-native providers, resolve a slash command to its SKILL.md body.
 * Claude Code's SDK loads SKILL.md on demand via its Skill tool; for Codex
 * and other providers we inject the body directly into the prompt so the
 * agent gets the same information without needing to `cat` the file.
 */
function resolveSkillBody(command: string): string | null {
  const skillName = command.replace(/^\//, '').split(/\s/)[0];
  if (!skillName) return null;

  const agentDirs: string[] = [];
  try {
    agentDirs.push(...fs.readdirSync('/workspace/agent'));
  } catch { /* /workspace/agent may not exist */ }

  const candidates = [
    path.join('/home/node/.claude/skills', skillName, 'SKILL.md'),
    // Additional dirs: cloned repos may put skills under the agent workspace
    ...agentDirs.flatMap((dir) => {
      const p = path.join('/workspace/agent', dir, '.claude', 'skills', skillName, 'SKILL.md');
      return fs.existsSync(p) ? [p] : [];
    }),
  ];

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      let body = fs.readFileSync(candidate, 'utf-8');
      // Strip YAML frontmatter
      body = body.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
      return body.trim();
    } catch { /* skip */ }
  }
  return null;
}

/**
 * Format messages, handling passthrough commands differently.
 * When the provider handles slash commands natively (Claude Code),
 * passthrough commands are sent raw (no XML wrapping) so the SDK can
 * dispatch them. For non-native providers, skill bodies are resolved and
 * injected so the agent gets the full SKILL.md content on invocation.
 */
function formatMessagesWithCommands(messages: MessageInRow[], nativeSlashCommands: boolean): string {
  const parts: string[] = [];
  const normalBatch: MessageInRow[] = [];

  for (const msg of messages) {
    if ((msg.kind === 'chat' || msg.kind === 'chat-sdk')) {
      const cmdInfo = categorizeMessage(msg);
      if (cmdInfo.category === 'passthrough' || cmdInfo.category === 'admin') {
        if (nativeSlashCommands) {
          // Flush normal batch first
          if (normalBatch.length > 0) {
            parts.push(formatMessages(normalBatch));
            normalBatch.length = 0;
          }
          // Pass raw command text (no XML wrapping) — SDK handles it natively
          parts.push(cmdInfo.text);
          continue;
        }

        // Non-native provider: resolve SKILL.md body and inject it
        if (cmdInfo.category === 'passthrough') {
          const body = resolveSkillBody(cmdInfo.command);
          if (body) {
            if (normalBatch.length > 0) {
              parts.push(formatMessages(normalBatch));
              normalBatch.length = 0;
            }
            const args = cmdInfo.text.slice(cmdInfo.command.length).trim();
            parts.push(
              `<skill-invocation name="${cmdInfo.command.slice(1)}"${args ? ` args="${args}"` : ''}>\n${body}\n</skill-invocation>`,
            );
            continue;
          }
        }
      }
    }
    normalBatch.push(msg);
  }

  if (normalBatch.length > 0) {
    parts.push(formatMessages(normalBatch));
  }

  return parts.join('\n\n');
}

interface QueryResult {
  continuation?: string;
}

export async function processQuery(
  query: AgentQuery,
  routing: RoutingContext,
  initialBatchIds: string[],
  providerName: string,
  skipPersistContinuation = false,
  refreshDestinations: () => string | null = () => null,
  onExchangeComplete: ((exchange: ProviderExchange) => void) | undefined = undefined,
  initialPrompt = '',
  initialContinuation: string | undefined = undefined,
): Promise<QueryResult> {
  let queryContinuation: string | undefined;
  let done = false;
  let lastEventTime = Date.now();
  let unwrappedNudged = false;
  // Prompt queue for the exchange hook — each result event consumes the
  // oldest unanswered prompt, except a wrapping-retry result, which answers
  // the same prompt again. Unused (and unmaintained) when the provider
  // doesn't implement `onExchangeComplete`.
  const archivePrompts: string[] = [initialPrompt];

  // Concurrent polling: push follow-ups into the active query as they arrive.
  // We do NOT force-end the stream on silence — keeping the query open avoids
  // re-spawning the SDK subprocess (~few seconds) and re-loading the .jsonl
  // transcript on every turn. The Anthropic prompt cache is server-side with
  // a 5-min TTL keyed on prefix hash, so stream lifecycle does NOT affect
  // cache lifetime — close+reopen within 5 min still gets cache hits.
  // Stream liveness is decided host-side via the heartbeat file + processing
  // claim age (see src/host-sweep.ts); if something is truly stuck, the host
  // will kill the container and messages get reset to pending.
  let pollInFlight = false;
  let endedForCommand = false;
  let corruptionStreak = 0;
  const pollHandle = setInterval(() => {
    if (done || pollInFlight || endedForCommand) return;
    pollInFlight = true;

    void (async () => {
      try {
        const pending = getPendingMessages();

        // Slash commands need a fresh query: /clear resets the SDK's
        // resume id (fixed at sdkQuery() time); admin/passthrough commands
        // (/compact, /cost, …) only dispatch when they're the first input
        // of a query — pushed mid-stream they arrive as plain text and
        // the SDK never runs them. Abort the active stream and leave the
        // rows pending; the outer loop handles them on next iteration via
        // the canonical command path + formatMessagesWithCommands. Abort,
        // not end: end() lets an in-flight turn run to completion, which
        // can block the command (e.g. /clear during a long task) for as
        // long as the turn takes.
        if (pending.some((m) => isRunnerCommand(m))) {
          log('Pending slash command — aborting active stream so outer loop can process');
          endedForCommand = true;
          query.abort();
          return;
        }

        // Skip system messages (MCP tool responses) and /clear (needs fresh query).
        // Thread routing is the router's concern — if a message landed in this
        // session, the agent should see it. Per-thread sessions already isolate
        // threads into separate containers; shared sessions intentionally merge
        // everything. Filtering on thread_id here caused deadlocks when the
        // initial batch and follow-ups had mismatched thread_ids (e.g. a
        // host-generated welcome trigger with null thread vs a Discord DM reply).
        const newMessages = pending.filter((m) => {
          if (m.kind === 'system') return false;
          if ((m.kind === 'chat' || m.kind === 'chat-sdk') && isClearCommand(m)) return false;
          return true;
        });
        if (newMessages.length === 0) {
          // End stream when agent is idle: no SDK events and no pending messages
          if (Date.now() - lastEventTime > IDLE_END_MS) {
            log(`No SDK events for ${IDLE_END_MS / 1000}s, ending query`);
            query.end();
          }
          return;
        }

        // new_session bypass guard: if any arriving task defaults to fresh
        // session (a task kind with no `new_session: false` opt-out), DO NOT
        // push into the active query — that would resume the stored
        // continuation and defeat the default. End the active query instead;
        // the next poll iteration's initial-batch path will pick up the
        // pending rows via the fresh-session path. Leave rows as 'pending'.
        const wantsFreshSession = (m: { kind: string; content: string }) =>
          m.kind === 'task' && !taskOptsOutOfNewSession(m);
        if (newMessages.some(wantsFreshSession)) {
          log(
            `fresh-session task arrived mid-query (${newMessages.length} msg) — ending active query to route through fresh-session path`,
          );
          query.end();
          done = true;
          return;
        }

        // Update the shared routing when a follow-up brings richer routing
        // than the initial batch had.
        const followUpRouting = extractRouting(newMessages);
        if (followUpRouting.channelType && followUpRouting.platformId) {
          if (!routing.channelType || !routing.platformId) {
            log(
              `Promoting routing from follow-up (${followUpRouting.channelType}:${followUpRouting.platformId}); initial routing was null`,
            );
          }
          routing = followUpRouting;
        }

        const newIds = newMessages.map((m) => m.id);
        markProcessing(newIds);

        // Run pre-task scripts on follow-ups too — without this, a task that
        // arrives during an active query (e.g. a */10 monitoring cron) bypasses
        // its script gate and always wakes the agent, defeating the gate.
        let keep = newMessages;
        let skipped: string[] = [];
        // MODULE-HOOK:scheduling-pre-task-followup:start
        const { applyPreTaskScripts } = await import('./scheduling/task-script.js');
        const preTask = await applyPreTaskScripts(newMessages);
        keep = preTask.keep;
        skipped = preTask.skipped;
        if (skipped.length > 0) {
          markCompleted(skipped);
          log(`Pre-task script skipped ${skipped.length} follow-up task(s): ${skipped.join(', ')}`);
        }
        // MODULE-HOOK:scheduling-pre-task-followup:end

        if (keep.length === 0) return;
        // Re-check done — the outer query may have finished while the script
        // was awaited.
        if (done) return;

        const keptIds = keep.map((m) => m.id);
        const prompt = formatMessages(keep);
        // The SDK fires UserPromptSubmit (and the intent-router hook) only on
        // the initial query prompt. Mid-query pushes bypass the hook, so run
        // the router ourselves here so workflow classification is applied to
        // every user message — not just the first.
        let routedPrompt = await classifyAndPrepend(prompt);
        // Claude SDK pins the system prompt to the initial query — pushed
        // follow-ups don't re-read it. If destinations changed since the
        // last push, inline the current list so the agent sees it alongside
        // this user message even though its frozen system prompt is stale.
        const destNote = refreshDestinations();
        if (destNote) routedPrompt = destNote + routedPrompt;
        log(`Pushing ${keep.length} follow-up message(s) into active query`);
        unwrappedNudged = false;
        query.push(routedPrompt);
        archivePrompts.push(prompt);
        markCompleted(keptIds);
        lastEventTime = Date.now(); // new input counts as activity
      } catch (err) {
        // Without this catch the rejection escapes the void IIFE and Node
        // terminates the container on unhandled-rejection.
        const errMsg = err instanceof Error ? err.message : String(err);
        log(`Follow-up poll error: ${errMsg}`);

        // Detect SQLite cross-mount corruption (Docker Desktop macOS virtiofs /
        // gRPC-FUSE coherency bug — the kernel page cache for the inbound.db
        // bind mount can latch a torn snapshot mid-host-write, after which
        // every fresh openInboundDb() in this process sees the same broken
        // view. Reopening inside the container does NOT recover; only a fresh
        // container mount does. Exit so the host sweep respawns us.
        if (isCorruptionError(errMsg)) {
          corruptionStreak += 1;
          if (corruptionStreak >= CORRUPTION_STREAK_EXIT) {
            log(
              `Follow-up poll: ${corruptionStreak} consecutive '${errMsg}' errors — ` +
                `inbound.db page cache is poisoned. Exiting so host respawns with a fresh mount.`,
            );
            // Stop touching the heartbeat so host-sweep stale detection fires
            // promptly even if exit() races with in-flight async work.
            done = true;
            clearInterval(pollHandle);
            // Defer exit one tick so this log line flushes through Docker's
            // log driver before the process dies.
            setTimeout(() => process.exit(75), 100);
          }
        } else {
          corruptionStreak = 0;
        }
      } finally {
        pollInFlight = false;
      }
    })();
  }, ACTIVE_POLL_INTERVAL_MS);

  try {
    for await (const event of query.events) {
      lastEventTime = Date.now();
      handleEvent(event, routing);
      touchHeartbeat();

      if (event.type === 'init') {
        queryContinuation = event.continuation;
        // Persist immediately so a mid-turn container crash still lets the
        // next wake resume the conversation. Without this, the session id
        // was only written after the full stream completed — if the
        // container died between `init` and `result`, the SDK session was
        // effectively orphaned and the next message started a blank
        // Claude session with no prior context.
        if (!skipPersistContinuation) setContinuation(providerName, event.continuation);
      } else if (event.type === 'result') {
        // A result — with or without text — means the turn is done. Mark
        // the initial batch completed now so the host sweep doesn't see
        // stale 'processing' claims while the query stays open for
        // follow-up pushes. The agent may have responded via MCP
        // (send_message) mid-turn, or the message may not need a response
        // at all — either way the turn is finished.
        markCompleted(initialBatchIds);
        if (event.text) {
          const { sent, hasUnwrapped, danglingOpen, gateRefusals } = dispatchResultText(event.text, routing);
          // Gate refusals are sender feedback — push them back to the emitting
          // agent so it re-sends correctly (parity with the bash-hook gates).
          // The gates' own 3-denial soft-cap bounds the re-send loop.
          if (gateRefusals?.length) {
            query.push(`<system>${gateRefusals.join('\n\n')}</system>`);
          }
          if (sent === 0 && event.isError === true) {
            // Non-retryable error turn (e.g. a 403 billing_error) with no
            // <message> envelope: deliver the notice instead of dropping it as
            // scratchpad, and skip the re-wrap nudge — it would just re-hammer
            // the failing gateway turn after turn.
            deliverErrorResult(event.text, routing);
            notifyExchangeComplete(onExchangeComplete, {
              prompt: archivePrompts[0] ?? initialPrompt,
              result: event.text,
              continuation: queryContinuation ?? initialContinuation,
              status: 'error',
            });
            archivePrompts.shift();
          } else {
            const willRetryWrapping = hasUnwrapped && !unwrappedNudged;
            notifyExchangeComplete(onExchangeComplete, {
              prompt: archivePrompts[0] ?? initialPrompt,
              result: event.text,
              continuation: queryContinuation ?? initialContinuation,
              status: hasUnwrapped ? 'undelivered' : 'completed',
            });
            if (willRetryWrapping) {
              unwrappedNudged = true;
              const destinations = getAllDestinations();
              const names = destinations.map((d) => d.name).join(', ');
              // Fork: distinguish a dangling-open <message> tag from a fully
              // unwrapped response so the nudge tells the agent which to fix.
              const reason = danglingOpen
                ? `Your response was not delivered — you opened a <message to="…"> tag but never emitted the matching </message> close tag. ` +
                  `Each block must be self-contained in the same response: <message to="name">…</message>. ` +
                  `Re-send the full block with both tags.`
                : `Your response was not delivered — it was not wrapped in <message to="name">...</message> blocks. ` +
                  `All output must be wrapped: use <message to="name"> for content to send, or <internal> for scratchpad. ` +
                  `Please re-send your response with the correct wrapping.`;
              query.push(`<system>${reason} Your destinations: ${names}.</system>`);
            }
            // The wrapping-retry result answers the SAME user prompt — keep it
            // queued so the retry archives against it, not the nudge text.
            if (!willRetryWrapping) archivePrompts.shift();
          }
        } else {
          archivePrompts.shift();
        }
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    notifyExchangeComplete(onExchangeComplete, {
      prompt: archivePrompts[0] ?? initialPrompt,
      result: `Error: ${errMsg}`,
      continuation: queryContinuation ?? initialContinuation,
      status: 'error',
    });
    throw err;
  } finally {
    done = true;
    clearInterval(pollHandle);
  }

  return { continuation: queryContinuation };
}

function notifyExchangeComplete(
  hook: ((exchange: ProviderExchange) => void) | undefined,
  exchange: ProviderExchange,
): void {
  if (!hook) return;
  try {
    hook(exchange);
  } catch (err) {
    log(`onExchangeComplete failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function handleEvent(event: ProviderEvent, _routing: RoutingContext): void {
  switch (event.type) {
    case 'init':
      log(`Session: ${event.continuation}`);
      break;
    case 'result':
      log(`Result: ${event.text ? event.text.slice(0, 200) : '(empty)'}`);
      break;
    case 'error':
      log(
        `Error: ${event.message} (retryable: ${event.retryable}${event.classification ? `, ${event.classification}` : ''})`,
      );
      break;
    case 'progress':
      log(`Progress: ${event.message}`);
      break;
    case 'usage':
      // Structured per-turn accounting. Grep-friendly: every field is a
      // bare keyword=value token, same line. Stable schema so downstream
      // tooling (ccusage / ad-hoc awk / the 2×2 stress-test harness)
      // can parse without JSON.
      log(
        `Usage: sessionId=${event.sessionId ?? 'null'} ` +
          `durationMs=${event.durationMs} ` +
          `numTurns=${event.numTurns} ` +
          `input=${event.inputTokens} ` +
          `output=${event.outputTokens} ` +
          `cacheCreate=${event.cacheCreationInputTokens} ` +
          `cacheRead=${event.cacheReadInputTokens} ` +
          `ephemeral1h=${event.ephemeral1hInputTokens} ` +
          `ephemeral5m=${event.ephemeral5mInputTokens} ` +
          `costUsd=${event.totalCostUsd}`,
      );
      break;
  }
}

/**
 * Critique-gate scope-extender: the bash hook
 * (container/hooks/gate-critique-on-deliver.sh) is wired as a PreToolUse
 * matcher on `mcp__nanoclaw__send_message|Bash`, so it only catches
 * delivery-marker traffic that goes through those tools. The most common
 * delivery path — the agent emitting `<message to="X">[Fix Report]…</message>`
 * as plain text and letting `dispatchResultText` parse it — uses neither
 * tool, so the hook never fires and the gate is silently bypassed.
 *
 * This in-process check mirrors the bash hook's logic (same MARKER file,
 * same workflow-state.json, same delivery-marker regex) and runs at the
 * one chokepoint left for text-output dispatch.
 *
 * Returns null when the gate either doesn't apply or permits the body.
 * Returns a string (the explanation) when the gate refuses delivery —
 * the caller substitutes that explanation for the original body so the
 * destination sees a clear refusal note instead of the gated content.
 *
 * Paths overridable for tests via the optional opts.
 */
const DELIVERY_MARKER_RE = /\[(Fix Report|Resolution|Triage Resolution|Review Verdict|handoff)\]/;
const ROUTING_HANDOFF_MARKER_RE = DELIVERY_MARKER_RE;

// Soft-cap shared by the in-process gates, mirroring the bash hooks
// (gate-critique-on-deliver.sh:73-89). After GATE_DENIAL_CAP refusals on a
// single session the gate stops denying and yields — without this, a gate
// whose precondition the agent can't satisfy (e.g. a workflow step that
// genuinely has no inbound to reply to, or a misconfigured critique-less
// orchestrator) would thrash the agent's entire turn budget retrying. The
// counter is persisted in workflow-state.json under `<key>`; the file is
// CREATED if absent, so a coworker that never runs critique still escapes.
const GATE_DENIAL_CAP = 3;

// Returns true if the gate should yield (soft-cap reached) rather than deny.
// Mirrors gate-critique-on-deliver.sh: check the persisted count BEFORE
// incrementing, so after GATE_DENIAL_CAP denials the counter stays pinned at
// the cap and the gate yields without bumping further. Best-effort persistence
// — a state-write failure never blocks delivery, it just disables the cap.
function gateShouldYield(statePath: string, key: string): boolean {
  const fs = require('fs') as typeof import('fs');
  let state: Record<string, unknown> = {};
  try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as Record<string, unknown>;
  } catch {
    state = {};
  }
  const current = typeof state[key] === 'number' ? (state[key] as number) : 0;
  if (current >= GATE_DENIAL_CAP) return true;
  state[key] = current + 1;
  try {
    const path = require('path') as typeof import('path');
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(state));
  } catch {
    // Best-effort; see note above.
  }
  return false;
}

// The chain-routing check is ALWAYS ON — not an overlay. It enforces a pure
// structural invariant ("a chain handoff must name the inbound it answers",
// the [MUST] in chain-reporting.md), and it is self-scoping: it only fires on
// bodies carrying a chain delivery marker, which is the chain protocol's own
// vocabulary — non-chain coworkers never emit those markers, so they never
// trip it. There is nothing to select and nothing to opt into.
export function checkRoutingGate(
  body: string,
  attrs: { threadIdOverride?: string; inReplyToOverride?: string },
  opts: { workflowStatePath?: string } = {},
): { blocked: boolean; reason?: string } {
  if (!ROUTING_HANDOFF_MARKER_RE.test(body)) return { blocked: false };
  // in_reply_to is the canonical routing primitive: it resolves the inbound
  // row → source_session_id → the exact edge, and the runtime auto-derives
  // thread_id from it (see applyInReplyToDefaults in mcp-tools/core.ts). So
  // in_reply_to alone is sufficient; thread_id is optional. Requiring both
  // would reject the spec's canonical upstream report form
  // (send_message(to="parent", in_reply_to=<id>, ...)).
  if (attrs.inReplyToOverride) return { blocked: false };
  const statePath =
    opts.workflowStatePath ?? process.env.ROUTING_GATE_STATE_PATH ?? '/workspace/.claude/workflow-state.json';
  if (gateShouldYield(statePath, 'routing_gate_denials')) {
    return { blocked: false };
  }
  const marker = body.match(ROUTING_HANDOFF_MARKER_RE)?.[1] ?? '<handoff>';
  return {
    blocked: true,
    reason:
      `[chain-routing-gate] REFUSED — your message contained a [${marker}] handoff/delivery marker but the <message> tag omitted in_reply_to. ` +
      `Re-send the original body in a <message to="..." in_reply_to="...">...</message> block linked to the inbound message you are answering ` +
      `(thread_id is optional — the runtime derives it from in_reply_to). ` +
      `Do not describe the routing in prose; set the attribute on the tag. The original body was retained in the container scratchpad log only — it was not delivered to the destination.`,
  };
}

export function checkCritiqueGate(
  body: string,
  opts: { overlayMarkerPath?: string; workflowStatePath?: string } = {},
): { blocked: boolean; reason?: string } {
  const fs = require('fs') as typeof import('fs');
  // Path resolution mirrors the bash hook's two-stage override (env var
  // wins over default), with an opts-arg layer on top for unit tests.
  const markerPath =
    opts.overlayMarkerPath ?? process.env.CRITIQUE_GATE_OVERLAY_PATH ?? '/workspace/agent/.overlay-critique-gate';
  if (!fs.existsSync(markerPath)) return { blocked: false };
  if (!DELIVERY_MARKER_RE.test(body)) return { blocked: false };
  const statePath =
    opts.workflowStatePath ?? process.env.CRITIQUE_GATE_STATE_PATH ?? '/workspace/.claude/workflow-state.json';
  let rounds = 0;
  try {
    const raw = fs.readFileSync(statePath, 'utf-8');
    const parsed = JSON.parse(raw) as { critique_rounds?: number };
    rounds = typeof parsed.critique_rounds === 'number' ? parsed.critique_rounds : 0;
  } catch {
    rounds = 0;
  }
  if (rounds >= 1) return { blocked: false };
  // Soft-cap parity with gate-critique-on-deliver.sh:73-89 — the bash hook
  // (send_message/Bash tool path) caps denials but this text-output path
  // previously refused indefinitely, so an agent that couldn't run critique
  // (e.g. an orchestrator with no codex wired) thrashed forever.
  if (gateShouldYield(statePath, 'critique_gate_denials')) {
    return { blocked: false };
  }
  const marker = body.match(DELIVERY_MARKER_RE)?.[1] ?? '<delivery>';
  return {
    blocked: true,
    reason:
      `[critique-gate] REFUSED — your message contained a [${marker}] marker but no /codex-critique round has been recorded for this session (critique_rounds=${rounds}). ` +
      `Run /codex-critique on the work first, then resend. The original delivery body was retained in the container scratchpad log only — it was not delivered to the destination.`,
  };
}

/**
 * Deliver a turn's text straight to the channel the batch arrived on. Used when
 * a turn ends in a provider error (e.g. a non-retryable 403 billing_error) with
 * no <message> envelope: the notice would otherwise be dropped as scratchpad.
 * This is the same user-facing write the outer catch block does, minus the
 * `Error:` prefix — the provider's text is already a user-facing message.
 */
function deliverErrorResult(text: string, routing: RoutingContext): void {
  log('Error result with no <message> envelope — delivering to channel');
  writeMessageOut({
    id: generateId(),
    in_reply_to: routing.inReplyTo,
    kind: 'chat',
    platform_id: routing.platformId,
    channel_type: routing.channelType,
    thread_id: routing.threadId,
    content: JSON.stringify({ text }),
  });
}

/**
 * Parse the agent's final text for <message to="name">...</message> blocks
 * and dispatch each one to its resolved destination. Text outside of blocks
 * (including <internal>...</internal>) is scratchpad — logged but not sent.
 *
 * The agent must always wrap output in <message to="name">...</message>
 * blocks, even with a single destination. Bare text is scratchpad only.
 */
export function dispatchResultText(
  text: string,
  routing: RoutingContext,
): { sent: number; hasUnwrapped: boolean; danglingOpen?: boolean; gateRefusals?: string[] } {
  // Capture the destination name (group 1), any additional attributes as one
  // string (group 2), and the body (group 3). Extra attributes — `thread_id`,
  // `in_reply_to`, plus unknown ones — are tolerated. Earlier versions of
  // this regex demanded `>` immediately after `to="..."`, so any agent
  // emitting `<message to="X" thread_id="Y">` saw the entire markup fall
  // through to the scratchpad path and get dumped to the inbound channel
  // instead of routed to the chain target. Branching workflows need the
  // explicit thread_id channel because `resolveDestinationThread` only
  // recovers a thread from prior inbound history — it has no way to
  // synthesize a NEW thread.
  const MESSAGE_RE = /<message\s+to="([^"]+)"((?:\s+\w+="[^"]*")*)\s*>([\s\S]*?)<\/message>/g;
  const ATTR_RE = /(\w+)="([^"]*)"/g;

  let match: RegExpExecArray | null;
  let sent = 0;
  let blocked = 0;
  let lastIndex = 0;
  const scratchpadParts: string[] = [];
  // Gate refusals are feedback for the SENDER, not the peer destination — the
  // caller pushes these back to the emitting agent as a <system> nudge (parity
  // with the bash-hook gates, which exit 2 and surface the error to the sender).
  const gateRefusals: string[] = [];

  while ((match = MESSAGE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      scratchpadParts.push(text.slice(lastIndex, match.index));
    }
    const toName = match[1];
    const attrsStr = match[2] ?? '';
    const body = match[3].trim();
    lastIndex = MESSAGE_RE.lastIndex;

    let threadIdOverride: string | undefined;
    let inReplyToOverride: string | undefined;
    for (const am of attrsStr.matchAll(ATTR_RE)) {
      if (am[1] === 'thread_id') threadIdOverride = am[2];
      else if (am[1] === 'in_reply_to') inReplyToOverride = am[2];
      // Unknown attributes are tolerated and ignored — keeps the parser
      // forward-compatible with future protocol extensions.
    }

    const dest = findByName(toName);
    if (!dest) {
      log(`Unknown destination in <message to="${toName}">, dropping block`);
      scratchpadParts.push(`[dropped: unknown destination "${toName}"] ${body}`);
      continue;
    }
    const routingGate = checkRoutingGate(body, { threadIdOverride, inReplyToOverride });
    if (routingGate.blocked) {
      log(`Chain-routing gate refused delivery to "${toName}": handoff marker missing thread_id/in_reply_to`);
      // Keep the body in the scratchpad log (the refusal text claims it's
      // "retained in the container scratchpad log only") and emit the overlay
      // event for measurement, but do NOT deliver the refusal to the peer —
      // collect it for the sender-directed nudge instead.
      scratchpadParts.push(`[chain-routing-gate refused delivery to "${toName}"] ${body}`);
      postOverlayEvent('chain-routing-gate.refused', { destination: toName, reason: routingGate.reason });
      gateRefusals.push(routingGate.reason!);
      blocked++;
      continue;
    }

    // Critique-gate scope extension (#67): the bash PreToolUse hook only
    // catches send_message/Bash invocations; this text-output path is
    // where most delivery markers actually land. Same gate, same state,
    // re-applied here. When gated, the body is withheld from the peer and the
    // refusal is routed back to the SENDER (see the routing-gate block above) —
    // delivering it to the peer mis-routed gate feedback into the chain.
    const gate = checkCritiqueGate(body);
    if (gate.blocked) {
      log(`Critique-gate refused delivery to "${toName}": body contained delivery marker, critique_rounds=0`);
      scratchpadParts.push(`[critique-gate refused delivery to "${toName}"] ${body}`);
      postOverlayEvent('critique-gate.refused', { destination: toName, reason: gate.reason });
      gateRefusals.push(gate.reason!);
      blocked++;
      continue;
    }
    sendToDestination(dest, body, routing, { threadIdOverride, inReplyToOverride });
    sent++;
  }
  if (lastIndex < text.length) {
    scratchpadParts.push(text.slice(lastIndex));
  }

  const scratchpad = stripInternalTags(scratchpadParts.join(''));

  // Refuse to deliver when an opening `<message to="…">` was emitted with no
  // matching close tag — the regex above silently skipped the block, and the
  // single-destination/auto-route shortcut below would otherwise dump the
  // entire half-finished payload onto the inbound channel (the case that
  // mis-routed an a2a "Review Resume" dispatch to the dashboard in May 2026).
  // Treat it as undelivered so the nudge fires and the agent re-sends.
  const danglingOpen = /<message\s+to="[^"]+"[^>]*>/.test(scratchpad);

  // Single-destination shortcut: plain text is auto-routed.
  // 'system' is blocked — its inbound carries platformId=null, so there's
  // nowhere to send anyway; explicit gate as defense-in-depth.
  // 'agent' auto-routes to platformId (the source agent group). Same-session
  // protection lives in agent-route.ts's same-session guard, which catches
  // any write that resolves back to the emitting session regardless of how
  // it was emitted (auto-route, <message to=…>, or send_message).
  if (sent === 0 && blocked === 0 && scratchpad && !danglingOpen) {
    const internalChannel = routing.channelType === 'system';
    if (routing.channelType && routing.platformId && !internalChannel) {
      writeMessageOut({
        id: generateId(),
        in_reply_to: routing.inReplyTo,
        kind: 'chat',
        platform_id: routing.platformId,
        channel_type: routing.channelType,
        thread_id: routing.threadId,
        content: JSON.stringify({ text: scratchpad }),
      });
      return { sent: 1, hasUnwrapped: false };
    }
    if (!internalChannel) {
      const all = getAllDestinations();
      if (all.length === 1) {
        sendToDestination(all[0], scratchpad, routing);
        return { sent: 1, hasUnwrapped: false };
      }
    }
  }

  if (scratchpad) {
    log(`[scratchpad] ${scratchpad.slice(0, 500)}${scratchpad.length > 500 ? '…' : ''}`);
  }

  // A purely-gated batch (blocked > 0, sent === 0) is NOT "unwrapped" — the
  // agent wrapped its output correctly; the gate withheld it. It gets the
  // gate-specific refusal nudge instead of the generic "wrap your output" one.
  const hasUnwrapped = sent === 0 && blocked === 0 && (!!scratchpad || danglingOpen);
  if (hasUnwrapped) {
    if (danglingOpen) {
      log(`WARNING: agent emitted <message to="..."> with no closing </message>; nothing was sent`);
    } else {
      log(`WARNING: agent output had no <message to="..."> blocks — nothing was sent`);
    }
  }
  return { sent, hasUnwrapped, danglingOpen, gateRefusals: gateRefusals.length ? gateRefusals : undefined };
}

function sendToDestination(
  dest: DestinationEntry,
  body: string,
  routing: RoutingContext,
  overrides?: { threadIdOverride?: string; inReplyToOverride?: string },
): void {
  const platformId = dest.type === 'channel' ? dest.platformId! : dest.agentGroupId!;
  const channelType = dest.type === 'channel' ? dest.channelType! : 'agent';
  // Resolve thread_id per-destination from the most recent inbound message
  // that came from this same channel+platform. In agent-shared sessions,
  // different destinations have different thread contexts — using a single
  // routing.threadId would stamp one channel's thread onto another.
  // Agent-supplied overrides win: a `<message to="X" thread_id="...">` is
  // explicit branching intent (e.g. starting a new chain on a destination
  // we've never received from), and inbound-history resolution can't
  // produce a thread we've never seen.
  const destRouting = resolveDestinationThread(channelType, platformId);
  const threadId = overrides?.threadIdOverride ?? destRouting?.threadId ?? null;
  const inReplyTo = overrides?.inReplyToOverride ?? destRouting?.inReplyTo ?? routing.inReplyTo;
  writeMessageOut({
    id: generateId(),
    in_reply_to: inReplyTo,
    kind: 'chat',
    platform_id: platformId,
    channel_type: channelType,
    thread_id: threadId,
    content: JSON.stringify({ text: body }),
  });
}

/**
 * Find the thread_id and message id from the most recent inbound message
 * matching the given channel+platform. Returns null if no match found.
 */
function resolveDestinationThread(
  channelType: string,
  platformId: string,
): { threadId: string | null; inReplyTo: string | null } | null {
  try {
    const db = getInboundDb();
    const row = db
      .prepare(
        `SELECT thread_id, id FROM messages_in
         WHERE channel_type = ? AND platform_id = ?
         ORDER BY seq DESC LIMIT 1`,
      )
      .get(channelType, platformId) as { thread_id: string | null; id: string } | undefined;
    if (row) return { threadId: row.thread_id, inReplyTo: row.id };
  } catch (err) {
    log(`resolveDestinationThread error: ${err instanceof Error ? err.message : String(err)}`);
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
