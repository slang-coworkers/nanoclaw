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
  DASHBOARD_INGRESS_HOST,
  DASHBOARD_INGRESS_PORT,
  DATA_DIR,
  MCP_PROXY_PORT,
  PROXY_BIND_HOST,
  validateContainerTimeouts,
} from './config.js';
import { enforceStartupBackoff, resetCircuitBreaker } from './circuit-breaker.js';
import { initDb, getDb } from './db/connection.js';
import { runMigrations } from './db/migrations/index.js';
import { runGlobalToSharedMigration } from './migrations/global-to-shared.js';
import { getMessagingGroupsByChannel, getMessagingGroupAgents } from './db/messaging-groups.js';
import { ensureContainerRuntimeRunning, cleanupOrphans } from './container-runtime.js';
import { startActiveDeliveryPoll, startSweepDeliveryPoll, setDeliveryAdapter, stopDeliveryPolls } from './delivery.js';
import { startHostSweep, stopHostSweep } from './host-sweep.js';
import { registerCostApproval } from './modules/cost-approval/index.js';
import { routeInbound } from './router.js';
import { log } from './log.js';
import { startMcpServers, getRunningServerNames, getServerUpstreamPort } from './mcp-registry.js';
import { startMcpAuthProxy, setUpstreamPortResolver, discoverTools } from './mcp-auth-proxy.js';
import { startDashboardIngress } from './dashboard-ingress.js';
import { startGitHubWebhookServer, type GitHubWebhookServerHandle } from './github-webhook-server.js';
import { enforceUpgradeTripwire } from './upgrade-state.js';

// Response + shutdown registries live in response-registry.ts to break the
// circular import cycle: src/index.ts imports src/modules/index.js for side
// effects, and the modules call registerResponseHandler/onShutdown at top
// level — which would hit a TDZ error if the arrays lived here. Re-exported
// here so existing callers see the same surface.
import { getResponseHandlers, getShutdownCallbacks, type ResponsePayload } from './response-registry.js';

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

// Modules barrel — default modules (typing, mount-security) ship here; skills
// append registry-based modules. Imported for side effects (registrations).
import './modules/index.js';

// CLI command barrel — populates the `ncl` registry before the CLI server
// accepts connections.
import './cli/commands/index.js';
import './cli/delivery-action.js';
import { startCliServer, stopCliServer } from './cli/socket-server.js';

import type { ChannelAdapter, ChannelSetup } from './channels/adapter.js';
import {
  initChannelAdapters,
  teardownChannelAdapters,
  getChannelAdapter,
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
  const dbPath = path.join(DATA_DIR, 'v2.db');
  const db = initDb(dbPath);
  runMigrations(db);
  log.info('Central DB ready', { path: dbPath });

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
  backfillContainerConfigs();

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
  getDb()
    .prepare("UPDATE sessions SET container_status = 'stopped' WHERE container_status IN ('running', 'idle')")
    .run();

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
    const res = reconcileGhSessions({
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
    logOrphanGroupDirs(db);
  } catch (err) {
    log.warn('orphan-groups scan threw', { err: String(err) });
  }

  // 2. Container runtime
  ensureContainerRuntimeRunning();
  cleanupOrphans();
  // Reset stale container_status from previous host runs. Also done earlier
  // (before the gh-session reconcile) so its live-session preflight sees clean
  // status; repeated here as the canonical post-runtime reset — idempotent.
  getDb().prepare("UPDATE sessions SET container_status = 'stopped' WHERE container_status = 'running'").run();

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
      const { routeCostOverrideToSession } = await import('./router.js');
      await routeCostOverrideToSession({ sessionId, decision });
    },
  });

  // 3c. GitHub webhook server (publicly exposed, HMAC-validated)
  githubWebhookHandle = startGitHubWebhookServer();

  // 4. Delivery adapter bridge — dispatches to channel adapters
  const deliveryAdapter = {
    async deliver(
      channelType: string,
      platformId: string,
      threadId: string | null,
      kind: string,
      content: string,
      files?: import('./channels/adapter.js').OutboundFile[],
    ): Promise<string | undefined> {
      const adapter = getChannelAdapter(channelType);
      if (!adapter) {
        log.warn('No adapter for channel type', { channelType });
        return;
      }
      return adapter.deliver(platformId, threadId, { kind, content: JSON.parse(content), files });
    },
    async setTyping(channelType: string, platformId: string, threadId: string | null): Promise<void> {
      const adapter = getChannelAdapter(channelType);
      await adapter?.setTyping?.(platformId, threadId);
    },
  };
  setDeliveryAdapter(deliveryAdapter);

  // 5. Start delivery polls
  startActiveDeliveryPoll();
  startSweepDeliveryPoll();
  log.info('Delivery polls started');

  // 6. Start host sweep
  startHostSweep();
  log.info('Host sweep started');

  // Cost-approval escalation card: log the active mode (S1 read-only vs S2 interactive).
  // The ingest handler (delivery.ts), reconciler (host-sweep), and bridge interceptor are
  // wired independently; this is the single place the flag state is announced at boot.
  registerCostApproval();

  // 7. Start the `ncl` CLI socket server (data/ncl.sock).
  await startCliServer();

  log.info('NanoClaw running');
}

/**
 * Refresh all active adapters with updated conversation configs from the DB.
 * Called when messaging_group_agents wiring changes (e.g., create_agent).
 */
export function refreshAdapterConversations(): void {
  for (const adapter of getActiveAdapters()) {
    const a = adapter as ChannelAdapter & { updateConversations?(configs: ConversationConfig[]): void };
    if (a.updateConversations) {
      const configs = buildConversationConfigs(a.channelType);
      a.updateConversations(configs);
      log.debug('Adapter conversations refreshed', { channel: a.channelType, count: configs.length });
    }
  }
}

/** Build ConversationConfig[] for a channel type from the central DB. */
function buildConversationConfigs(channelType: string): ConversationConfig[] {
  const groups = getMessagingGroupsByChannel(channelType);
  const configs: ConversationConfig[] = [];

  for (const mg of groups) {
    const agents = getMessagingGroupAgents(mg.id);
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
  for (const cb of getShutdownCallbacks()) {
    try {
      await cb();
    } catch (err) {
      log.error('Shutdown callback threw', { err });
    }
  }
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
    resetCircuitBreaker();
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((err) => {
  log.fatal('Startup failed', { err });
  process.exit(1);
});
