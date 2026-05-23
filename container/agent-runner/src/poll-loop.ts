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
import type { AgentProvider, AgentQuery, ProviderEvent } from './providers/types.js';

const POLL_INTERVAL_MS = 1000;
const ACTIVE_POLL_INTERVAL_MS = 500;
// End stream after this many ms with no SDK events.
// Set NANOCLAW_IDLE_END_MS in the container env to override per-agent-group.
const IDLE_END_MS = process.env.NANOCLAW_IDLE_END_MS
  ? Math.max(60_000, parseInt(process.env.NANOCLAW_IDLE_END_MS, 10))
  : 1_200_000;

function log(msg: string): void {
  console.error(`[poll-loop] ${msg}`);
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

async function processQuery(
  query: AgentQuery,
  routing: RoutingContext,
  initialBatchIds: string[],
  providerName: string,
  skipPersistContinuation = false,
  refreshDestinations: () => string | null = () => null,
): Promise<QueryResult> {
  let queryContinuation: string | undefined;
  let done = false;
  let lastEventTime = Date.now();
  let unwrappedNudged = false;

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
        // the SDK never runs them. End the stream and leave the rows
        // pending; the outer loop handles them on next iteration via the
        // canonical command path + formatMessagesWithCommands.
        if (pending.some((m) => isRunnerCommand(m))) {
          log('Pending slash command — ending stream so outer loop can process');
          endedForCommand = true;
          query.end();
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
        markCompleted(keptIds);
        lastEventTime = Date.now(); // new input counts as activity
      } catch (err) {
        // Without this catch the rejection escapes the void IIFE and Node
        // terminates the container on unhandled-rejection.
        const errMsg = err instanceof Error ? err.message : String(err);
        log(`Follow-up poll error: ${errMsg}`);
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
          const { hasUnwrapped } = dispatchResultText(event.text, routing);
          if (hasUnwrapped && !unwrappedNudged) {
            unwrappedNudged = true;
            const destinations = getAllDestinations();
            const names = destinations.map((d) => d.name).join(', ');
            query.push(
              `<system>Your response was not delivered — it was not wrapped in <message to="name">...</message> blocks. ` +
                `All output must be wrapped: use <message to="name"> for content to send, or <internal> for scratchpad. ` +
                `Your destinations: ${names}. ` +
                `Please re-send your response with the correct wrapping.</system>`,
            );
          }
        }
      }
    }
  } finally {
    done = true;
    clearInterval(pollHandle);
  }

  return { continuation: queryContinuation };
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
 * Parse the agent's final text for <message to="name">...</message> blocks
 * and dispatch each one to its resolved destination. Text outside of blocks
 * (including <internal>...</internal>) is scratchpad — logged but not sent.
 *
 * The agent must always wrap output in <message to="name">...</message>
 * blocks, even with a single destination. Bare text is scratchpad only.
 */
export function dispatchResultText(text: string, routing: RoutingContext): { sent: number; hasUnwrapped: boolean } {
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
  let lastIndex = 0;
  const scratchpadParts: string[] = [];

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
    sendToDestination(dest, body, routing, { threadIdOverride, inReplyToOverride });
    sent++;
  }
  if (lastIndex < text.length) {
    scratchpadParts.push(text.slice(lastIndex));
  }

  const scratchpad = stripInternalTags(scratchpadParts.join(''));

  // Single-destination shortcut: plain text is auto-routed.
  // 'system' is blocked — its inbound carries platformId=null, so there's
  // nowhere to send anyway; explicit gate as defense-in-depth.
  // 'agent' auto-routes to platformId (the source agent group). Same-session
  // protection lives in agent-route.ts's same-session guard, which catches
  // any write that resolves back to the emitting session regardless of how
  // it was emitted (auto-route, <message to=…>, or send_message).
  if (sent === 0 && scratchpad) {
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

  const hasUnwrapped = sent === 0 && !!scratchpad;
  if (hasUnwrapped) {
    log(`WARNING: agent output had no <message to="..."> blocks — nothing was sent`);
  }
  return { sent, hasUnwrapped };
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
