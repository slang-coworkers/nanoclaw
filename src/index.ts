/**
 * NanoClaw — main entry point.
 *
 * Thin orchestrator: init DB, run migrations, start channel adapters,
 * start delivery polls, start sweep, handle shutdown.
 */
import fs from 'fs';
import path from 'path';

import { backfillAgentsSymlinks } from './agents-symlink-backfill.js';
import { backfillContainerConfigs } from './backfill-container-configs.js';
import {
  CENTRAL_DB_PATH,
  DASHBOARD_INGRESS_HOST,
  DASHBOARD_INGRESS_PORT,
  DATA_DIR,
  MCP_PROXY_PORT,
  PROXY_BIND_HOST,
  validateContainerTimeouts,
} from './config.js';
import { enforceStartupBackoff, resetCircuitBreaker } from './circuit-breaker.js';
import { adoptRunningSessions } from './container-runner.js';
import { closeDb, initDb, getDb } from './db/connection.js';
import { runMigrations } from './db/migrations/index.js';
import { getSessionDriver } from './drivers/index.js';
import { runGlobalToSharedMigration } from './migrations/global-to-shared.js';
import { getMessagingGroupsByChannel, getMessagingGroupAgents } from './db/messaging-groups.js';
import { startActiveDeliveryPoll, startSweepDeliveryPoll, setDeliveryAdapter, stopDeliveryPolls } from './delivery.js';
import { startHostInstanceLease, stopHostInstanceLease } from './host-instance.js';
import { startHostSweep, stopHostSweep } from './host-sweep.js';
import { startHostModules, stopHostModules } from './host-lifecycle.js';
import { registerCostApproval } from './modules/cost-approval/index.js';
import { routeInbound } from './router.js';
import { log } from './log.js';
import { startMcpServers, getRunningServerNames, getServerUpstreamPort } from './mcp-registry.js';
import { startMcpAuthProxy, setUpstreamPortResolver, discoverTools } from './mcp-auth-proxy.js';
import { startDashboardIngress } from './dashboard-ingress.js';
import { startGitHubWebhookServer, type GitHubWebhookServerHandle } from './github-webhook-server.js';
import { enforceUpgradeTripwire } from './upgrade-state.js';

// Response registry lives in response-registry.ts to break the
// circular import cycle: src/index.ts imports src/modules/index.js for side
// effects, and the modules call registerResponseHandler at top level — which
// would hit a TDZ error if the array lived here.
import { getResponseHandlers, type ResponsePayload } from './response-registry.js';

const hostAbortController = new AbortController();

async function dispatchResponse(payload: ResponsePayload): Promise<void> {
  for (const handler of getResponseHandlers()) {
    try {
      const claimed = await handler(payload);
      if (claimed) return;
    } catch (err) {
      log.error('Response handler threw', { questionId: payload.questionId, err });
    }
  }
  log.warn('Unclaimed response', { questionId: payload.questionId, value: payload.value });
}

// Channel barrel — each enabled channel self-registers on import.
// Channel skills uncomment lines in channels/index.ts to enable them.
import './channels/index.js';

// Modules barrel — imports registration modules, including the singular
// mailbox composition slot. Imported for side effects.
import './modules/index.js';

// CLI command barrel — populates the `ncl` registry before the CLI server
// accepts connections.
import './cli/commands/index.js';
import './cli/delivery-action.js';
import { startCliServer, stopCliServer } from './cli/socket-server.js';

import type { ChannelAdapter, ChannelSetup } from './channels/adapter.js';
import {
  createChannelDeliveryAdapter,
  initChannelAdapters,
  teardownChannelAdapters,
  getActiveAdapters,
} from './channels/channel-registry.js';

/**
 * Per-wiring configuration pushed to adapters so they can pre-filter
 * messages client-side (engage_mode / engage_pattern). Adapters that
 * implement the optional `updateConversations` method receive these when
 * wiring changes (e.g., create_agent).
 */
export interface ConversationConfig {
  platformId: string;
  agentGroupId: string;
  engageMode: 'pattern' | 'mention' | 'mention-sticky';
  engagePattern?: string | null;
  ignoredMessagePolicy?: 'drop' | 'accumulate';
  sessionMode: 'shared' | 'per-thread' | 'agent-shared';
}

// Module-level so shutdown() can access
let mcpStackHandle: { stop: () => void } | null = null;
let mcpProxyHandle: { stop: () => void } | null = null;
let dashboardIngressHandle: { stop: () => Promise<void> } | null = null;
let githubWebhookHandle: GitHubWebhookServerHandle | null = null;

async function main(): Promise<void> {
  // Singleton guard: prevent duplicate orchestrators on the same data directory
  const pidfilePath = path.join(DATA_DIR, 'nanoclaw.pid');
  if (fs.existsSync(pidfilePath)) {
    const existingPid = parseInt(fs.readFileSync(pidfilePath, 'utf-8').trim(), 10);
    try {
      process.kill(existingPid, 0);
      log.fatal('Another NanoClaw instance is already running', { existingPid, pidfilePath });
      process.exit(1);
    } catch {
      log.warn('Removing stale pidfile', { existingPid });
      fs.unlinkSync(pidfilePath);
    }
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, 'shared', 'learnings'), { recursive: true });

  fs.writeFileSync(pidfilePath, String(process.pid));
  const cleanPidfile = () => {
    try {
      fs.unlinkSync(pidfilePath);
    } catch {
      /* ignore */
    }
  };
  process.on('exit', cleanPidfile);

  log.info('NanoClaw starting');

  // 0a. Validate critical env invariants. Warn (don't crash) — see Issue #2:
  //     an idle timeout >= container timeout means idle-sweep never fires
  //     before the hard kill, producing orphaned-container churn.
  const timeoutCheck = validateContainerTimeouts();
  if (!timeoutCheck.ok && timeoutCheck.warning) {
    log.warn(timeoutCheck.warning);
  }

  // 0b. Circuit breaker — backoff on rapid restarts
  await enforceStartupBackoff();

  // 0.5 Upgrade tripwire — refuse to start if this install was updated
  // outside the sanctioned path (raw `git pull` instead of /update-nanoclaw).
  enforceUpgradeTripwire();

  // 1. Init central DB
  const db = await initDb(CENTRAL_DB_PATH, { role: 'host' });
  await runMigrations(db, undefined, { mode: 'auto' });
  log.info('Central DB ready', { dialect: db.dialect });

  // 1b. One-time filesystem+DB migration: demote groups/global/ to
  // data/shared/. Idempotent via marker file. Must run AFTER schema
  // migrations — it UPDATEs/DELETEs rows in agent_groups, so the
  // table has to exist and be on the latest schema.
  try {
    runGlobalToSharedMigration(process.cwd());
  } catch (err) {
    log.warn('global-to-shared migration threw', { err: String(err) });
  }

  // 1c. Backfill container_configs from legacy container.json files.
  // Idempotent — skips groups that already have a config row.
  if (db.dialect === 'sqlite') await backfillContainerConfigs();
  else log.info('Skipping local container.json backfill for non-local central DB');

  // 1c-bis. Backfill AGENTS.md / .agents symlinks for codex-mode skill
  // discovery. group-init.ts creates these for new groups; this catches
  // older groups created before that scaffolding existed. Idempotent —
  // skips groups that already have the symlinks.
  try {
    backfillAgentsSymlinks(process.cwd());
  } catch (err) {
    log.warn('agents-symlink-backfill threw', { err: String(err) });
  }

  // Reset stale container_status from a previous host run BEFORE the reconcile
  // below. On an unclean shutdown, sessions are left at container_status
  // 'running'/'idle'; no container is actually alive this early in startup
  // (the runtime + spawns happen in section 2), so the rows are stale. The
  // reconcile's live-session preflight keys on this column, so without the
  // reset it would spuriously abort on every first restart after a crash.
  // Idempotent and safe to run here — duplicated cheaply below is harmless,
  // but doing it first is what makes the auto-reconcile reliable.
  await getDb().run("UPDATE sessions SET container_status = 'stopped' WHERE container_status IN ('running', 'idle')");

  // 1c-ter. Reconcile split gh-issue/gh-pr coworker sessions. Older installs
  // accumulated multiple sessions per coworker for one GitHub issue/PR (a
  // webhook session + one a2a session per sender); the `resolveSession`
  // `^gh-(issue|pr)-` collapse stops new splits, this merges the existing ones
  // into the canonical session. Idempotent (a no-op once collapsed) and safe to
  // run at startup: containers haven't spawned yet AND stale running-status was
  // just cleared above, so the live-session preflight passes; it backs up
  // v2.db + mutated session DBs before writing. Never blocks startup — a
  // failure is logged and swallowed.
  try {
    const { reconcileGhSessions } = await import('./reconcile-gh-sessions.js');
    const res = await reconcileGhSessions({
      dataDir: DATA_DIR,
      apply: true,
      log: (line) => log.info('reconcile-gh-sessions', { line }),
    });
    if (res.merged > 0) {
      log.info('Reconciled split gh sessions', {
        groups: res.groups,
        merged: res.merged,
        inRows: res.inRows,
        outRows: res.outRows,
      });
    }
  } catch (err) {
    log.warn('reconcile-gh-sessions threw', { err: String(err) });
  }

  // 1d. Orphan-dir reconciler (task #40). `groups/<folder>/` directories
  // can be left behind when a coworker is deleted via the dashboard API
  // with `deleteData=false` (the default — the delete path preserves WIP
  // reports/critiques). This is by design, but without visibility the
  // orphans accumulate silently. We log them at startup so an operator
  // can decide what to keep; we do NOT auto-delete, since user work may
  // be in there.
  try {
    const { logOrphanGroupDirs } = await import('./orphan-groups.js');
    await logOrphanGroupDirs(db);
  } catch (err) {
    log.warn('orphan-groups scan threw', { err: String(err) });
  }

  // 2. Session runtime: prove it is reachable, then reconcile what survived a
  // restart. Adoption replaces the old reap-everything cleanup — a session that
  // is still running keeps running, and only true orphans are stopped.
  await getSessionDriver().ensureReady?.();
  await adoptRunningSessions();
  // Reset stale container_status from previous host runs. Kept AFTER adoption so
  // it only clears rows adoption did not claim; repeated from the pre-reconcile
  // reset above as the canonical post-runtime reset — idempotent.
  await getDb().run("UPDATE sessions SET container_status = 'stopped' WHERE container_status = 'running'");

  // 2b. MCP server stack (registry + auth proxy)
  const mcpStack = await startMcpServers(MCP_PROXY_PORT + 100);
  mcpStackHandle = mcpStack;
  setUpstreamPortResolver((serverName) => {
    if (serverName) return mcpStack.getUpstreamPort(serverName);
    const names = getRunningServerNames();
    return names.length > 0 ? getServerUpstreamPort(names[0]) : null;
  });
  mcpProxyHandle = startMcpAuthProxy(PROXY_BIND_HOST, MCP_PROXY_PORT);

  // Discover tools from all running MCP servers
  for (const name of getRunningServerNames()) {
    const port = mcpStack.getUpstreamPort(name);
    if (port) {
      await discoverTools(name, port).catch((err) => {
        log.warn('MCP tool discovery failed', { server: name, err });
      });
    }
  }

  // 3. Channel adapters
  await initChannelAdapters((adapter: ChannelAdapter): ChannelSetup => {
    return {
      onInbound(platformId, threadId, message) {
        routeInbound({
          channelType: adapter.channelType,
          // The one host-side stamping seam: adapters stay instance-blind,
          // the host stamps the receiving instance on every inbound event.
          instance: adapter.instance ?? adapter.channelType,
          platformId,
          threadId,
          message: {
            id: message.id,
            kind: message.kind,
            content: JSON.stringify(message.content),
            timestamp: message.timestamp,
            isMention: message.isMention,
            isGroup: message.isGroup,
          },
        }).catch((err) => {
          log.error('Failed to route inbound message', { channelType: adapter.channelType, err });
        });
      },
      onInboundEvent(event) {
        routeInbound(event).catch((err) => {
          log.error('Failed to route inbound event', {
            sourceAdapter: adapter.channelType,
            targetChannelType: event.channelType,
            err,
          });
        });
      },
      onMetadata(platformId, name, isGroup) {
        log.info('Channel metadata discovered', {
          channelType: adapter.channelType,
          platformId,
          name,
          isGroup,
        });
      },
      onAction(questionId, selectedOption, userId) {
        dispatchResponse({
          questionId,
          value: selectedOption,
          userId,
          channelType: adapter.channelType,
          // platformId/threadId aren't surfaced by the current onAction
          // signature — registered handlers look them up from the
          // pending_question / pending_approval row.
          platformId: '',
          threadId: null,
        }).catch((err) => {
          log.error('Failed to handle question response', { questionId, err });
        });
      },
    };
  });

  // 3b. Dashboard inbound bridge — standalone dashboard server sends browser
  // chat here so routing still happens inside the host process.
  dashboardIngressHandle = startDashboardIngress({
    host: DASHBOARD_INGRESS_HOST,
    port: DASHBOARD_INGRESS_PORT,
    onActionFn: async (questionId: string, selectedOption: string, userId: string) => {
      const { getResponseHandlers } = await import('./response-registry.js');
      for (const handler of getResponseHandlers()) {
        if (
          await handler({
            questionId,
            value: selectedOption,
            userId,
            channelType: 'dashboard',
            platformId: 'dashboard',
            threadId: null,
          })
        )
          break;
      }
    },
    onQuestionFn: async (questionId: string, selectedOption: string, userId: string) => {
      const { getResponseHandlers } = await import('./response-registry.js');
      for (const handler of getResponseHandlers()) {
        if (
          await handler({
            questionId,
            value: selectedOption,
            userId,
            channelType: 'dashboard',
            platformId: 'dashboard',
            threadId: null,
          })
        )
          break;
      }
    },
    onCredentialSubmitFn: async (_credentialId: string, _value: string) => {
      log.debug('Dashboard credential submit — response registry not yet implemented');
    },
    onCredentialRejectFn: async (_credentialId: string) => {
      log.debug('Dashboard credential reject — response registry not yet implemented');
    },
    onCostOverrideFn: async (sessionId: string, decision: 'continue' | 'stop') => {
      // Pill = the SECONDARY surface, but with the SAME money-safety as the card.
      //  1. A live PENDING episode → route through its CAS (at-most-once decision + fence).
      //  2. No pending, but the session HAS a (resolved) episode → route with THAT episode's
      //     epoch as the fence. This is the P0 fix: a bare unfenced override here would let a
      //     pill Continue double-grant after a card Continue already rotated the generation.
      //     The fence makes a duplicate/stale press a no-op, while a genuine reversal (the
      //     generation is unchanged after a Stop) still applies.
      //  3. No episode ever (stale runner / never escalated) → the legacy unconditional
      //     override — the ONLY place an unfenced override is allowed.
      const { getPendingEpisodeForSession, getLatestEpisodeForSession } =
        await import('./db/cost-escalation-episodes.js');
      const pending = await getPendingEpisodeForSession(sessionId);
      if (pending) {
        const { decideCostEpisode } = await import('./modules/cost-approval/index.js');
        await decideCostEpisode(pending.episode_id, decision, 'dashboard:pill');
        return;
      }
      const { routeCostOverrideToSession } = await import('./router.js');
      const latest = await getLatestEpisodeForSession(sessionId);
      await routeCostOverrideToSession({
        sessionId,
        decision,
        ...(latest ? { epochKey: latest.epoch_key } : {}),
      });
    },
    onSetCeilingFn: async (raw: unknown) => {
      const { submitCostCeilingAdjustment } = await import('./modules/cost-ceiling-adjustment/index.js');
      return submitCostCeilingAdjustment(raw);
    },
  });

  // 3c. GitHub webhook server (publicly exposed, HMAC-validated)
  githubWebhookHandle = startGitHubWebhookServer();

  // 4. Delivery adapter bridge — dispatches to channel adapters. The registry
  // factory owns exact-instance resolution (a named instance never sends
  // through a sibling bot of the same platform) and raises
  // MissingChannelAdapterError so an offline adapter takes the retry path.
  setDeliveryAdapter(createChannelDeliveryAdapter());

  // 5. Start registered host modules. Imports only registered callbacks; the
  // actual work begins here, after DB + delivery are ready and before polls.
  await startHostModules({ db, signal: hostAbortController.signal });

  // 5b. Register this host process in durable state and keep its lease fresh
  // (shadow state — observability across restarts, no behavior reads it).
  await startHostInstanceLease();

  // 6. Start delivery polls
  startActiveDeliveryPoll();
  startSweepDeliveryPoll();
  log.info('Delivery polls started');

  // 7. Start host sweep
  startHostSweep();
  log.info('Host sweep started');

  // Cost-approval escalation card: log the active mode (S1 read-only vs S2 interactive).
  // The ingest handler (delivery.ts), reconciler (host-sweep), and bridge interceptor are
  // wired independently; this is the single place the flag state is announced at boot.
  await registerCostApproval();

  // 8. Start the `ncl` CLI socket server (data/ncl.sock).
  await startCliServer();

  log.info('NanoClaw running');
}

/**
 * Refresh all active adapters with updated conversation configs from the DB.
 * Called when messaging_group_agents wiring changes (e.g., create_agent).
 */
export async function refreshAdapterConversations(): Promise<void> {
  for (const adapter of getActiveAdapters()) {
    const a = adapter as ChannelAdapter & { updateConversations?(configs: ConversationConfig[]): void };
    if (a.updateConversations) {
      const configs = await buildConversationConfigs(a.channelType);
      a.updateConversations(configs);
      log.debug('Adapter conversations refreshed', { channel: a.channelType, count: configs.length });
    }
  }
}

/** Build ConversationConfig[] for a channel type from the central DB. */
async function buildConversationConfigs(channelType: string): Promise<ConversationConfig[]> {
  const groups = await getMessagingGroupsByChannel(channelType);
  const configs: ConversationConfig[] = [];

  for (const mg of groups) {
    const agents = await getMessagingGroupAgents(mg.id);
    for (const agent of agents) {
      configs.push({
        platformId: mg.platform_id,
        agentGroupId: agent.agent_group_id,
        engageMode: agent.engage_mode === 'always' || agent.engage_mode === 'never' ? 'pattern' : agent.engage_mode,
        engagePattern: agent.engage_pattern,
        ignoredMessagePolicy: agent.ignored_message_policy ?? undefined,
        sessionMode: agent.session_mode,
      });
    }
  }

  return configs;
}

/** Graceful shutdown. */
async function shutdown(signal: string): Promise<void> {
  log.info('Shutdown signal received', { signal });
  // Remove pidfile immediately before any async work that might hang
  try {
    fs.unlinkSync(path.join(DATA_DIR, 'nanoclaw.pid'));
  } catch {
    /* ignore */
  }
  hostAbortController.abort();
  await stopHostModules();
  // Stamp the durable stop before the DB closes below.
  await stopHostInstanceLease();
  stopDeliveryPolls();
  stopHostSweep();
  mcpProxyHandle?.stop();
  mcpStackHandle?.stop();
  await dashboardIngressHandle?.stop();
  await githubWebhookHandle?.stop();
  await stopCliServer();
  try {
    await teardownChannelAdapters();
  } finally {
    await closeDb();
    // Always reset on graceful shutdown — even if teardown threw, we got here
    // via SIGTERM/SIGINT, not a crash, so the next start shouldn't be counted
    // as one.
    resetCircuitBreaker();
    process.exit(0);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

main().catch((err) => {
  log.fatal('Startup failed', { err });
  process.exit(1);
});
