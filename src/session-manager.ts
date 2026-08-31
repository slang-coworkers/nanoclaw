/**
 * Session lifecycle: folders, mailboxes, messages, and container status.
 * Storage layout and consistency belong to the registered mailbox.
 */
import { AsyncLocalStorage } from 'async_hooks';
import fs from 'fs';
import path from 'path';

import { deriveAttachmentName } from './attachment-naming.js';
import { isSafeAttachmentName } from './attachment-safety.js';
import type { OutboundFile } from './channels/adapter.js';
import { ensureContainedInboxDir } from './inbox-safety.js';
import { DATA_DIR } from './config.js';
import { getSourceFor as getA2aSourceFor } from './db/a2a-session-sources.js';
import { getMessagingGroup } from './db/messaging-groups.js';
import { isUniqueViolation } from './db/errors.js';
import {
  createSession,
  findSystemSession,
  findSessionByAgentGroup,
  findSessionByAgentThread,
  findSessionForAgent,
  getSession,
  taskThreadId,
  updateSession,
} from './db/sessions.js';
// Raw SQLite handles for the host paths the mailbox surface does not cover:
// the a2a bounce/redrive sweep reads and clears `processing_ack` bounce rows,
// which MailboxSession has no operation for. Upstream relocated this module
// out of src/db/ as part of isolating the SQLite driver internals.
import { inboundDbPath, outboundDbPath } from './mailbox/sqlite/paths.js';
import type { SessionDbHandle } from './mailbox/sqlite/session-db.js';
import {
  openInboundDb as openInboundDbRaw,
  openOutboundDb as openOutboundDbRaw,
  openOutboundDbWritable as openOutboundDbWritableRaw,
  migrateMessagesInTable,
} from './mailbox/sqlite/session-db.js';
import { log } from './log.js';
import { getAgentMailbox, type InboundMessage, type MailboxSession } from './mailbox/index.js';
import { enqueueSessionReconcile } from './reconcile-feeds.js';
import type { Session } from './types.js';

/** Root directory for all session data. */
export function sessionsBaseDir(): string {
  return path.join(DATA_DIR, 'v2-sessions');
}

/** Directory for a specific session: sessions/{agent_group_id}/{session_id}/ */
export function sessionDir(agentGroupId: string, sessionId: string): string {
  return path.join(sessionsBaseDir(), agentGroupId, sessionId);
}

/** Host-owned runner context, kept outside the agent-writable session directory. */
export function sessionContextPath(agentGroupId: string, sessionId: string): string {
  return path.join(DATA_DIR, 'v2-sessions', agentGroupId, '.context', `${sessionId}.json`);
}

/** Materialize the immutable context the runner receives at startup. */
export function writeSessionContext(agentGroupId: string, sessionId: string, mailbox: unknown): void {
  const contextPath = sessionContextPath(agentGroupId, sessionId);
  fs.mkdirSync(path.dirname(contextPath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(contextPath, JSON.stringify({ agentGroupId, sessionId, mailbox }), { mode: 0o600 });
  fs.chmodSync(contextPath, 0o600);
}

/** Path to the container heartbeat file (touched instead of DB writes). */
export function heartbeatPath(agentGroupId: string, sessionId: string): string {
  return path.join(sessionDir(agentGroupId, sessionId), '.heartbeat');
}

function mailboxKey(agentGroupId: string, sessionId: string) {
  return { agentGroupId, sessionId };
}

function generateId(): string {
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const sessionCreationLocks = new Map<string, Promise<void>>();

async function withSessionCreationLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = sessionCreationLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  sessionCreationLocks.set(key, tail);
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (sessionCreationLocks.get(key) === tail) sessionCreationLocks.delete(key);
  }
}

function sessionCreationKey(
  agentGroupId: string,
  messagingGroupId: string | null,
  threadId: string | null,
  sessionMode: 'shared' | 'per-thread' | 'agent-shared',
): string {
  if (sessionMode === 'agent-shared') return `agent\0${agentGroupId}`;
  return `route\0${agentGroupId}\0${messagingGroupId ?? ''}\0${sessionMode === 'shared' ? '' : (threadId ?? '')}`;
}

/**
 * Find or create a session for a messaging group + thread.
 *
 * Session modes:
 * - 'shared': one session per messaging group (ignores threadId)
 * - 'per-thread': one session per (messaging group, thread)
 * - 'agent-shared': one session per agent group — all messaging groups
 *   wired with this mode share a single session (e.g. GitHub + Slack)
 */
export async function resolveSession(
  agentGroupId: string,
  messagingGroupId: string | null,
  threadId: string | null,
  sessionMode: 'shared' | 'per-thread' | 'agent-shared',
): Promise<{ session: Session; created: boolean }> {
  const key = sessionCreationKey(agentGroupId, messagingGroupId, threadId, sessionMode);
  return withSessionCreationLock(key, async () => {
    // Canonical GitHub issue/PR chains: exactly one real conversation per
    // (agent, gh-issue/pr thread) globally. Collapse all a2a senders + the
    // webhook session into ONE canonical session, so a handoff from the triager
    // and a follow-up from main on the same issue share one container memory
    // instead of fragmenting into a session per (sender→recipient) pair.
    //
    // Runs ABOVE the messaging-group branch and regardless of whether
    // messagingGroupId is set: a webhook-origin caller (messagingGroupId=null)
    // must reuse an existing canonical session too, otherwise it could mint a
    // split when an a2a delegation created the gh session first. (Today the
    // webhook path resolves sessions directly via findSessionByAgentThread, not
    // resolveSession — but this guards any future null-mg gh caller.)
    //
    // Inside the creation lock, not before it: two senders racing on the same
    // gh thread arrive with different sessionCreationKeys (the key includes
    // messagingGroupId), so the lock alone does not serialize them — but the
    // lookup must still see any session a concurrent caller just committed.
    //
    // Scoped to ^gh-(issue|pr)- ONLY, and only when this is a per-thread lookup
    // (sessionMode !== 'shared'). Generic a2a threads (named threads, Slack
    // thread_ts, msg-* ids) keep their per-source isolation — broadening this to
    // all a2a threads was tried and reverted in #301 because it merged unrelated
    // sources that happened to collide on a thread_id. GitHub issue/PR ids are
    // globally canonical (one repo+number = one conversation everywhere), so the
    // collision concern doesn't apply.
    //
    // Reply routing stays correct after the collapse: it is per-message via
    // messages_in.source_session_id + in_reply_to (resolveExplicitReplyTarget),
    // not per-session — each inbound row still records who sent it, so the merged
    // session routes every reply home to the right peer.
    if (sessionMode !== 'shared' && sessionMode !== 'agent-shared' && threadId && /^gh-(issue|pr)-/.test(threadId)) {
      const canonical = await findSessionByAgentThread(agentGroupId, threadId);
      if (canonical) {
        return { session: canonical, created: false };
      }
    }

    // agent-shared: single session per agent group, regardless of messaging group
    if (sessionMode === 'agent-shared') {
      const existing = await findSessionByAgentGroup(agentGroupId);
      if (existing) {
        return { session: existing, created: false };
      }
    } else if (messagingGroupId) {
      const lookupThreadId = sessionMode === 'shared' ? null : threadId;
      // Scope lookup by agent_group_id so fan-out to multiple agents in the
      // same chat doesn't accidentally deliver to the wrong agent's session.
      const existing = await findSessionForAgent(agentGroupId, messagingGroupId, lookupThreadId);
      if (existing) {
        return { session: existing, created: false };
      }
      // Fallback: when a dashboard message targets a thread owned by an a2a session,
      // reuse that session. Only for dashboard channels — a2a sources with the same
      // thread_id must stay isolated per-source (the messaging_group scopes them).
      if (lookupThreadId) {
        const mg = await getMessagingGroup(messagingGroupId);
        if (mg && mg.channel_type === 'dashboard') {
          const crossChannel = await findSessionByAgentThread(agentGroupId, lookupThreadId);
          if (crossChannel) {
            return { session: crossChannel, created: false };
          }
        }
      }
    }

    const id = generateId();
    const lookupThreadId = sessionMode === 'per-thread' ? threadId : null;
    const session: Session = {
      id,
      agent_group_id: agentGroupId,
      messaging_group_id: messagingGroupId,
      thread_id: lookupThreadId,
      display_title: null,
      title_source: null,
      title_updated_at: null,
      agent_provider: null,
      status: 'active',
      container_status: 'stopped',
      last_active: null,
      created_at: new Date().toISOString(),
    };

    try {
      await createSession(session);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const existing =
        sessionMode === 'agent-shared'
          ? await findSessionByAgentGroup(agentGroupId)
          : messagingGroupId
            ? await findSessionForAgent(agentGroupId, messagingGroupId, lookupThreadId)
            : undefined;
      if (!existing) throw error;
      return { session: existing, created: false };
    }
    initSessionFolder(agentGroupId, id);
    log.info('Session created', { id, agentGroupId, messagingGroupId, threadId: lookupThreadId, sessionMode });

    return { session, created: true };
  });
}

/** Find or create the per-agent-group session used for scheduled tasks. */
/** Find or create the isolated session for one task series (thread `system:tasks:<seriesId>`). */
export async function resolveTaskSession(
  agentGroupId: string,
  seriesId: string,
): Promise<{ session: Session; created: boolean }> {
  const threadId = taskThreadId(seriesId);
  return withSessionCreationLock(`system\0${agentGroupId}\0${threadId}`, async () => {
    const existing = await findSystemSession(agentGroupId, threadId);
    if (existing) return { session: existing, created: false };

    const id = generateId();
    const session: Session = {
      id,
      agent_group_id: agentGroupId,
      messaging_group_id: null,
      thread_id: threadId,
      agent_provider: null,
      status: 'active',
      container_status: 'stopped',
      last_active: null,
      created_at: new Date().toISOString(),
    };

    try {
      await createSession(session);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const raced = await findSystemSession(agentGroupId, threadId);
      if (!raced) throw error;
      return { session: raced, created: false };
    }
    initSessionFolder(agentGroupId, id);
    log.info('Task session created', { id, agentGroupId, seriesId });

    return { session, created: true };
  });
}

/** Create the workspace folders and synchronously prepare the registered mailbox. */
export function initSessionFolder(agentGroupId: string, sessionId: string): void {
  const dir = sessionDir(agentGroupId, sessionId);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'outbox'), { recursive: true });
  getAgentMailbox().prepare(mailboxKey(agentGroupId, sessionId));
}

/** Destroy one session's implementation-owned mailbox after its container stops. */
export async function destroySessionMailbox(agentGroupId: string, sessionId: string): Promise<void> {
  await getAgentMailbox().destroy(mailboxKey(agentGroupId, sessionId));
  fs.rmSync(sessionContextPath(agentGroupId, sessionId), { force: true });
}

/**
 * Write the current chat/thread routing for a session into its inbound mailbox.
 *
 * The container uses this to preserve thread_id when an explicitly named
 * destination resolves to the conversation this session is bound to.
 * Derived from session.messaging_group_id → messaging_groups row + session.thread_id.
 *
 * Called on every container wake alongside the agent-to-agent module's
 * writeDestinations() (when installed) so the latest routing is always in
 * place, including after admin rewiring.
 */
export async function writeSessionRouting(agentGroupId: string, sessionId: string): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) return;

  let channelType: string | null = null;
  let platformId: string | null = null;
  let threadId: string | null = session.thread_id;

  // a2a recipient sessions: override the synthetic `agent:<src>:<rcp>` mg
  // platform_id with the real source agent group id, so the container's
  // bare `send_message({text})` produces an outbound addressed at the
  // original source — which routeAgentMessage's reply-detection branch
  // then delivers into source_session_id.
  const a2aSrc = await getA2aSourceFor(sessionId);
  if (a2aSrc && a2aSrc.source_agent_group_id !== agentGroupId) {
    channelType = 'agent';
    platformId = a2aSrc.source_agent_group_id;
    threadId = a2aSrc.source_thread_id;
  } else if (session.messaging_group_id) {
    const mg = await getMessagingGroup(session.messaging_group_id);
    if (mg) {
      channelType = mg.channel_type;
      platformId = mg.platform_id;
    }
  }

  await withMailboxSession(agentGroupId, sessionId, (mailbox) => {
    mailbox.setRouting({
      channelType,
      platformId,
      threadId,
    });
  });
  log.debug('Session routing written', { sessionId, channelType, platformId, threadId });
}

/**
 * Write a message to a session's inbound mailbox. Host-only.
 */
export async function writeSessionMessage(
  agentGroupId: string,
  sessionId: string,
  message: {
    id: string;
    kind: InboundMessage['kind'];
    timestamp: string;
    platformId?: string | null;
    channelType?: string | null;
    threadId?: string | null;
    content: string;
    processAfter?: string | null;
    recurrence?: string | null;
    /**
     * true = this message should wake the agent (the default); false = accumulate
     * as context only, don't wake. Host's countDueMessages gates on this
     * column; the container still reads all prior messages as context when
     * a triggering message does arrive.
     */
    trigger?: boolean;
    /**
     * For agent-to-agent inbound: the source session id that emitted the
     * outbound message which became this inbound row. Used as the return
     * path so the target's reply routes back to that exact session.
     */
    sourceSessionId?: string | null;
    /**
     * true = only deliver on the container's first poll (fresh start).
     * Dying containers (past first poll) skip these rows.
     */
    onWake?: boolean;
  },
): Promise<void> {
  // Documented reset: operators `rm -rf` a session folder to clear a stuck
  // session. The sessions row survives, so the next message takes the
  // existing-session path and lands here with a missing mailbox — the open
  // below would throw and the message would be logged-and-dropped forever.
  // Re-provision the folder + mailbox (initSessionFolder is idempotent) so the
  // documented reset actually re-provisions instead of killing the chat.
  initSessionFolder(agentGroupId, sessionId);

  // Extract base64 attachment data, save to inbox, replace with file paths
  const content = extractAttachmentFiles(agentGroupId, sessionId, message.id, message.content);

  await withMailboxSession(agentGroupId, sessionId, async (mailbox) => {
    await mailbox.insertMessage({
      id: message.id,
      kind: message.kind,
      timestamp: message.timestamp,
      platformId: message.platformId ?? null,
      channelType: message.channelType ?? null,
      threadId: message.threadId ?? null,
      content,
      processAfter: message.processAfter ?? null,
      recurrence: message.recurrence ?? null,
      trigger: message.trigger ?? true,
      sourceSessionId: message.sourceSessionId ?? null,
      onWake: message.onWake ?? false,
    });
  });
  await updateSession(sessionId, { last_active: new Date().toISOString() });
  // Ask for a prompt reconcile now that the message is durable: a wake that
  // fails transiently is retried within the queue's cadence instead of
  // waiting for the next resync tick. No-op when the sweep isn't running.
  enqueueSessionReconcile(sessionId);
}

/**
 * If message content has attachments with base64 `data`, save them to
 * the session's inbox directory and replace with `localPath`.
 */
function extractAttachmentFiles(
  agentGroupId: string,
  sessionId: string,
  messageId: string,
  contentStr: string,
): string {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(contentStr);
  } catch {
    return contentStr;
  }

  const attachments = parsed.attachments as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(attachments)) return contentStr;

  if (!isSafeAttachmentName(messageId)) {
    log.warn('Rejecting unsafe inbound message id', { messageId });
    return contentStr;
  }

  const inboxRoot = path.join(sessionDir(agentGroupId, sessionId), 'inbox');
  // Resolved lazily on the first attachment that actually carries bytes, so a
  // message whose attachments have no inline `data` never creates an inbox dir.
  // ensureContainedInboxDir refuses a pre-placed symlink at the inbox root or
  // the per-message subdir before any write lands outside the sandbox (#2828).
  let inboxDir: string | null = null;
  let inboxResolved = false;

  let changed = false;
  for (const att of attachments) {
    if (typeof att.data !== 'string') continue;

    const rawName = deriveAttachmentName(att);
    const filename = isSafeAttachmentName(rawName) ? rawName : `attachment-${Date.now()}`;
    if (filename !== rawName) {
      log.warn('Refused unsafe attachment filename, would escape inbox', {
        messageId,
        rawName,
        replacement: filename,
      });
    }

    if (!inboxResolved) {
      inboxDir = ensureContainedInboxDir(inboxRoot, messageId, { messageId });
      inboxResolved = true;
    }
    // Unsafe inbox (symlink / escape) — no attachment can be written safely.
    if (!inboxDir) break;

    const filePath = path.join(inboxDir, filename);
    try {
      // wx = exclusive create. Refuses to follow a pre existing symlink or
      // overwrite any existing file. The host expects to be the sole writer
      // of these attachments.
      fs.writeFileSync(filePath, Buffer.from(att.data as string, 'base64'), { flag: 'wx' });
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === 'EEXIST') {
        log.warn('Inbox attachment target already exists, refusing to overwrite', {
          messageId,
          filename,
        });
        continue;
      }
      throw err;
    }

    att.name = filename;
    att.localPath = `inbox/${messageId}/${filename}`;
    delete att.data;
    changed = true;
    log.debug('Saved attachment to inbox', { messageId, filename, size: att.size });
  }

  return changed ? JSON.stringify(parsed) : contentStr;
}

/**
 * Detects same-key session() nesting, which is forbidden: implementations may
 * serialize session() per key, so a nested call may deadlock. Tracked per async context so
 * legitimately concurrent top-level sessions on the same key don't trip it.
 */
const activeMailboxKeys = new AsyncLocalStorage<ReadonlySet<string>>();

/** Run one host operation against a session mailbox. The implementation owns persistence.
 *
 * Never call this (directly or via helpers like writeSessionMessage) from
 * inside another withMailboxSession action on the same session — finish the
 * open session first. See AgentMailbox.session in src/mailbox/types.ts.
 */
export function withMailboxSession<T>(
  agentGroupId: string,
  sessionId: string,
  action: (mailbox: MailboxSession) => T | Promise<T>,
): Promise<T> {
  return runMailboxSession(agentGroupId, sessionId, action, true) as Promise<T>;
}

/** Run against an already-provisioned mailbox without creating storage. */
export function withExistingMailboxSession<T>(
  agentGroupId: string,
  sessionId: string,
  action: (mailbox: MailboxSession) => T | Promise<T>,
): Promise<T | undefined> {
  return runMailboxSession(agentGroupId, sessionId, action, false);
}

async function runMailboxSession<T>(
  agentGroupId: string,
  sessionId: string,
  action: (mailbox: MailboxSession) => T | Promise<T>,
  provision: boolean,
): Promise<T | undefined> {
  const store = getAgentMailbox();
  const key = mailboxKey(agentGroupId, sessionId);
  const keyId = `${agentGroupId}/${sessionId}`;
  const held = activeMailboxKeys.getStore();
  if (held?.has(keyId)) {
    throw new Error(`Nested mailbox session for ${keyId} — serialized implementations would deadlock here`);
  }
  if (provision) store.prepare(key);
  else if (!(await store.exists(key))) return undefined;
  return activeMailboxKeys.run(new Set(held).add(keyId), () => store.session(key, action));
}

/**
 * Raw SQLite escape hatches for the a2a bounce/redrive sweep.
 *
 * `MailboxSession` has no bounce operation — its `ProcessingStatus` union
 * cannot express 'bounced-transient'/'bounced-unknown' — so the sweep reads
 * and clears those `processing_ack` rows through direct handles. Everything
 * else on the host goes through the mailbox.
 */

/** Open the inbound DB for a session (host reads/writes). */
export function openInboundDb(agentGroupId: string, sessionId: string): SessionDbHandle {
  const db = openInboundDbRaw(inboundDbPath(agentGroupId, sessionId));
  migrateMessagesInTable(db);
  return db;
}

/** Open a session's inbound DB, run `fn`, and always close it. */
export function withInboundDb<T>(agentGroupId: string, sessionId: string, fn: (db: SessionDbHandle) => T): T {
  const db = openInboundDb(agentGroupId, sessionId);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

/** Open the outbound DB for a session (host reads only). */
export function openOutboundDb(agentGroupId: string, sessionId: string): SessionDbHandle {
  return openOutboundDbRaw(outboundDbPath(agentGroupId, sessionId));
}

/** Open the outbound DB read-write. Only safe when no container is running (e.g. kill-and-respawn cleanup path). */
export function openOutboundDbRw(agentGroupId: string, sessionId: string): SessionDbHandle {
  return openOutboundDbWritableRaw(outboundDbPath(agentGroupId, sessionId));
}

/**
 * Write a message directly to a session's outbound mailbox so the host delivery
 * loop picks it up. Used by the command gate to send denial responses
 * without waking a container.
 *
 * The selected mailbox owns persistence and sequencing.
 */
export function writeOutboundDirect(
  agentGroupId: string,
  sessionId: string,
  message: {
    id: string;
    kind: string;
    platformId: string | null;
    channelType: string | null;
    threadId: string | null;
    content: string;
  },
): Promise<void> {
  return withMailboxSession(agentGroupId, sessionId, (mailbox) => mailbox.writeDirect(message));
}

/**
 * Load outbox attachments for a delivered message.
 *
 * Symmetric with `extractAttachmentFiles` on the inbound side: the container
 * writes files into the session's `outbox/<messageId>/` directory alongside
 * its outbound message, and the host reads them back at delivery time.
 *
 * Returns undefined when the outbox dir is missing or no declared file was
 * actually on disk — delivery continues without attachments rather than
 * failing the whole message.
 */
export function readOutboxFiles(
  agentGroupId: string,
  sessionId: string,
  messageId: string,
  filenames: string[],
): OutboundFile[] | undefined {
  if (!isSafeAttachmentName(messageId)) {
    log.warn('Refused unsafe outbox messageId', { messageId });
    return undefined;
  }
  const sessDir = sessionDir(agentGroupId, sessionId);
  const outboxRoot = path.join(sessDir, 'outbox');
  const outboxDir = path.join(outboxRoot, messageId);
  if (!fs.existsSync(outboxDir)) return undefined;
  // Reject if outboxDir is a symlink escaping outboxRoot.
  try {
    if (fs.lstatSync(outboxDir).isSymbolicLink()) {
      log.warn('Refused outbox dir that is a symlink', { messageId });
      return undefined;
    }
    const realOutbox = fs.realpathSync(outboxDir);
    if (!isPathInside(realOutbox, fs.realpathSync(outboxRoot))) {
      log.warn('Outbox dir resolves outside session outbox root', { messageId });
      return undefined;
    }
  } catch (err) {
    log.warn('Outbox dir stat failed', { messageId, err });
    return undefined;
  }
  const files: OutboundFile[] = [];
  for (const filename of filenames) {
    if (!isSafeAttachmentName(filename)) {
      log.warn('Refused unsafe outbox filename', { messageId, filename });
      continue;
    }
    const filePath = path.join(outboxDir, filename);
    if (!fs.existsSync(filePath)) {
      log.warn('Outbox file not found', { messageId, filename });
      continue;
    }
    try {
      if (fs.lstatSync(filePath).isSymbolicLink()) {
        log.warn('Refused outbox attachment that is a symlink', { messageId, filename });
        continue;
      }
      const realFile = fs.realpathSync(filePath);
      if (!isPathInside(realFile, fs.realpathSync(outboxDir))) {
        log.warn('Outbox attachment resolves outside outbox dir', { messageId, filename });
        continue;
      }
    } catch (err) {
      log.warn('Outbox attachment stat failed', { messageId, filename, err });
      continue;
    }
    files.push({ filename, data: fs.readFileSync(filePath) });
  }
  return files.length > 0 ? files : undefined;
}

function isPathInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel.length > 0 && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Remove a message's outbox directory after successful delivery. Best-effort:
 * failures log and swallow. A cleanup failure must NOT propagate to the
 * delivery caller — the message is already on the user's screen, and a
 * thrown error would trigger the delivery retry path and deliver twice.
 */
export function clearOutbox(agentGroupId: string, sessionId: string, messageId: string): void {
  if (!isSafeAttachmentName(messageId)) {
    log.warn('Refused to clear outbox for unsafe messageId', { messageId });
    return;
  }
  const sessDir = sessionDir(agentGroupId, sessionId);
  const outboxRoot = path.join(sessDir, 'outbox');
  const outboxDir = path.join(outboxRoot, messageId);
  if (!fs.existsSync(outboxDir)) return;
  try {
    if (fs.lstatSync(outboxDir).isSymbolicLink()) {
      log.warn('Refused to rmSync outbox dir that is a symlink', { messageId });
      return;
    }
    const realOutbox = fs.realpathSync(outboxDir);
    if (!isPathInside(realOutbox, fs.realpathSync(outboxRoot))) {
      log.warn('Refused to rmSync outbox dir outside outbox root', { messageId });
      return;
    }
    fs.rmSync(outboxDir, { recursive: true, force: true });
  } catch (err) {
    log.warn('Outbox cleanup failed (message already delivered)', { messageId, err });
  }
}

/** Mark a container as running for a session. */
export async function markContainerRunning(sessionId: string): Promise<void> {
  await updateSession(sessionId, { container_status: 'running', last_active: new Date().toISOString() });
}

/** Mark a container as idle for a session. */
export async function markContainerIdle(sessionId: string): Promise<void> {
  await updateSession(sessionId, { container_status: 'idle' });
}

/** Mark a container as stopped for a session. */
export async function markContainerStopped(sessionId: string): Promise<void> {
  await updateSession(sessionId, { container_status: 'stopped' });
}
