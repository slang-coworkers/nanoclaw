/**
 * NanoClaw v2 — main entry point.
 *
 * Thin orchestrator: init DB, run migrations, start channel adapters,
 * start delivery polls, start sweep, handle shutdown.
 */
import path from 'path';

import { DASHBOARD_INGRESS_HOST, DASHBOARD_INGRESS_PORT, DATA_DIR, MCP_PROXY_PORT, PROXY_BIND_HOST } from './config.js';
import { initDb, getDb } from './db/connection.js';
import { runMigrations } from './db/migrations/index.js';
import { getMessagingGroupsByChannel, getMessagingGroupAgents } from './db/messaging-groups.js';
import { ensureContainerRuntimeRunning, cleanupOrphans } from './container-runtime.js';
import { startActiveDeliveryPoll, startSweepDeliveryPoll, setDeliveryAdapter, stopDeliveryPolls } from './delivery.js';
import { startHostSweep, stopHostSweep } from './host-sweep.js';
import {
  ONECLI_ACTION,
  resolveOneCLIApproval,
  startOneCLIApprovalHandler,
  stopOneCLIApprovalHandler,
} from './onecli-approvals.js';
import {
  getCredentialForModal,
  handleCredentialChannelUnsupported,
  handleCredentialReject,
  handleCredentialSubmit,
  setCredentialDeliveryAdapter,
} from './credentials.js';
import { routeInbound } from './router.js';
import {
  getPendingQuestion,
  deletePendingQuestion,
  getPendingApproval,
  deletePendingApproval,
  getSession,
} from './db/sessions.js';
import { getAgentGroup, updateAgentGroup } from './db/agent-groups.js';
import { writeSessionMessage } from './session-manager.js';
import { wakeContainer, buildAgentGroupImage, killContainer } from './container-runner.js';
import { log } from './log.js';
import { startMcpServers, getRunningServerNames, getServerUpstreamPort } from './mcp-registry.js';
import { startMcpAuthProxy, setUpstreamPortResolver, discoverTools } from './mcp-auth-proxy.js';
import { startDashboardIngress } from './dashboard-ingress.js';

// Channel barrel — each enabled channel self-registers on import.
// Channel skills uncomment lines in channels/index.ts to enable them.
import './channels/index.js';

import type { ChannelAdapter, ChannelSetup, ConversationConfig } from './channels/adapter.js';
import {
  initChannelAdapters,
  teardownChannelAdapters,
  getChannelAdapter,
  getActiveAdapters,
} from './channels/channel-registry.js';

// Module-level so shutdown() can access
let mcpStackHandle: { stop: () => void } | null = null;
let mcpProxyHandle: { stop: () => void } | null = null;
let dashboardIngressHandle: { stop: () => Promise<void> } | null = null;

async function main(): Promise<void> {
  log.info('NanoClaw v2 starting');

  // 1. Init central DB
  const dbPath = path.join(DATA_DIR, 'v2.db');
  const db = initDb(dbPath);
  runMigrations(db);
  log.info('Central DB ready', { path: dbPath });

  // 2. Container runtime
  ensureContainerRuntimeRunning();
  cleanupOrphans();
  // Reset stale container_status from previous host runs
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
    const conversations = buildConversationConfigs(adapter.channelType);
    return {
      conversations,
      onInbound(platformId, threadId, message) {
        routeInbound({
          channelType: adapter.channelType,
          platformId,
          threadId,
          message: {
            id: message.id,
            kind: message.kind,
            content: JSON.stringify(message.content),
            timestamp: message.timestamp,
          },
        }).catch((err) => {
          log.error('Failed to route inbound message', { channelType: adapter.channelType, err });
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
        handleQuestionResponse(questionId, selectedOption, userId).catch((err) => {
          log.error('Failed to handle question response', { questionId, err });
        });
      },
      getCredentialForModal,
      onCredentialReject(credentialId) {
        handleCredentialReject(credentialId).catch((err) =>
          log.error('Failed to handle credential reject', { credentialId, err }),
        );
      },
      onCredentialSubmit(credentialId, value) {
        handleCredentialSubmit(credentialId, value).catch((err) =>
          log.error('Failed to handle credential submit', { credentialId, err }),
        );
      },
      onCredentialChannelUnsupported(credentialId) {
        handleCredentialChannelUnsupported(credentialId).catch((err) =>
          log.error('Failed to handle credential channel-unsupported', { credentialId, err }),
        );
      },
    };
  });

  // 3b. Dashboard inbound bridge — standalone dashboard server sends browser
  // chat here so routing still happens inside the host process.
  dashboardIngressHandle = startDashboardIngress({
    host: DASHBOARD_INGRESS_HOST,
    port: DASHBOARD_INGRESS_PORT,
    onActionFn: async (questionId, selectedOption, userId) => {
      await handleQuestionResponse(questionId, selectedOption, userId);
    },
    onQuestionFn: async (questionId, selectedOption, userId) => {
      await handleQuestionResponse(questionId, selectedOption, userId);
    },
    onCredentialSubmitFn: async (credentialId, value) => {
      await handleCredentialSubmit(credentialId, value);
    },
    onCredentialRejectFn: async (credentialId) => {
      await handleCredentialReject(credentialId);
    },
  });

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
  setCredentialDeliveryAdapter(deliveryAdapter);

  // 5. Start delivery polls
  startActiveDeliveryPoll();
  startSweepDeliveryPoll();
  log.info('Delivery polls started');

  // 6. Start host sweep
  startHostSweep();
  log.info('Host sweep started');

  // 7. Start OneCLI manual-approval handler
  startOneCLIApprovalHandler(deliveryAdapter);

  log.info('NanoClaw v2 running');
}

/**
 * Refresh all active adapters with updated conversation configs from the DB.
 * Called when messaging_group_agents wiring changes (e.g., create_agent).
 */
export function refreshAdapterConversations(): void {
  for (const adapter of getActiveAdapters()) {
    if (adapter.updateConversations) {
      const configs = buildConversationConfigs(adapter.channelType);
      adapter.updateConversations(configs);
      log.debug('Adapter conversations refreshed', { channel: adapter.channelType, count: configs.length });
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
      let triggerRules: { pattern?: string; requiresTrigger?: boolean } | null = null;
      if (agent.trigger_rules) {
        try {
          triggerRules = JSON.parse(agent.trigger_rules);
        } catch {
          log.warn('Invalid trigger_rules JSON, skipping', { agentGroupId: agent.agent_group_id });
        }
      }
      configs.push({
        platformId: mg.platform_id,
        agentGroupId: agent.agent_group_id,
        triggerPattern: triggerRules?.pattern,
        requiresTrigger: triggerRules?.requiresTrigger ?? false,
        sessionMode: agent.session_mode,
      });
    }
  }

  return configs;
}

/** Handle a user's response to an ask_user_question card or an approval card. */
async function handleQuestionResponse(questionId: string, selectedOption: string, userId: string): Promise<void> {
  // OneCLI credential approvals — resolved via in-memory Promise, not session DB
  if (resolveOneCLIApproval(questionId, selectedOption)) {
    return;
  }

  // Check if this is a pending approval (install_packages, request_rebuild)
  const approval = getPendingApproval(questionId);
  if (approval) {
    if (approval.action === ONECLI_ACTION) {
      // Row exists but the in-memory resolver is gone (timer fired or process
      // was in a weird state). Nothing to do — just drop the row.
      deletePendingApproval(questionId);
      return;
    }
    await handleApprovalResponse(approval, selectedOption, userId);
    return;
  }

  const pq = getPendingQuestion(questionId);
  if (!pq) {
    log.warn('Pending question not found (may have expired)', { questionId });
    return;
  }

  const session = getSession(pq.session_id);
  if (!session) {
    log.warn('Session not found for pending question', { questionId, sessionId: pq.session_id });
    deletePendingQuestion(questionId);
    return;
  }

  // Write the response to the session DB as a system message
  writeSessionMessage(session.agent_group_id, session.id, {
    id: `qr-${questionId}-${Date.now()}`,
    kind: 'system',
    timestamp: new Date().toISOString(),
    platformId: pq.platform_id,
    channelType: pq.channel_type,
    threadId: pq.thread_id,
    content: JSON.stringify({
      type: 'question_response',
      questionId,
      selectedOption,
      userId,
    }),
  });

  deletePendingQuestion(questionId);
  log.info('Question response routed', { questionId, selectedOption, sessionId: session.id });

  // Wake the container so the MCP tool's poll picks up the response
  await wakeContainer(session);
}

/**
 * Handle an admin's response to an approval card.
 * Fire-and-forget model: the agent doesn't poll for this — we write a chat
 * notification to its session DB, and optionally kill the container so the
 * next wake picks up new config/images.
 */
async function handleApprovalResponse(
  approval: import('./types.js').PendingApproval,
  selectedOption: string,
  userId: string,
): Promise<void> {
  if (!approval.session_id) {
    deletePendingApproval(approval.approval_id);
    return;
  }
  const session = getSession(approval.session_id);
  if (!session) {
    deletePendingApproval(approval.approval_id);
    return;
  }

  const notify = (text: string): void => {
    writeSessionMessage(session.agent_group_id, session.id, {
      id: `appr-note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: 'chat',
      timestamp: new Date().toISOString(),
      platformId: session.agent_group_id,
      channelType: 'agent',
      threadId: null,
      content: JSON.stringify({ text, sender: 'system', senderId: 'system' }),
    });
  };

  if (selectedOption !== 'Approve') {
    notify(`Your ${approval.action} request was rejected by admin.`);
    log.info('Approval rejected', { approvalId: approval.approval_id, action: approval.action, userId });
    deletePendingApproval(approval.approval_id);
    await wakeContainer(session);
    return;
  }

  const payload = JSON.parse(approval.payload);

  if (approval.action === 'install_packages') {
    const agentGroup = getAgentGroup(session.agent_group_id);
    const containerConfig = agentGroup?.container_config ? JSON.parse(agentGroup.container_config) : {};
    if (!containerConfig.packages) containerConfig.packages = { apt: [], npm: [] };
    if (payload.apt) containerConfig.packages.apt.push(...payload.apt);
    if (payload.npm) containerConfig.packages.npm.push(...payload.npm);
    updateAgentGroup(session.agent_group_id, { container_config: JSON.stringify(containerConfig) });

    const pkgs = [...(payload.apt || []), ...(payload.npm || [])].join(', ');
    notify(`Packages approved (${pkgs}). Call request_rebuild to apply them.`);
    log.info('Package install approved', { approvalId: approval.approval_id, userId });
  } else if (approval.action === 'request_rebuild') {
    try {
      await buildAgentGroupImage(session.agent_group_id);
      // Kill the container so the next wake uses the new image
      killContainer(session.id, 'rebuild applied');
      notify('Container image rebuilt. Your container will restart with the new image on the next message.');
      log.info('Container rebuild approved and completed', { approvalId: approval.approval_id, userId });
    } catch (e) {
      notify(`Rebuild failed: ${e instanceof Error ? e.message : String(e)}`);
      log.error('Container rebuild failed', { approvalId: approval.approval_id, err: e });
    }
  } else if (approval.action === 'add_mcp_server') {
    const agentGroup = getAgentGroup(session.agent_group_id);
    const containerConfig = agentGroup?.container_config ? JSON.parse(agentGroup.container_config) : {};
    if (!containerConfig.mcpServers) containerConfig.mcpServers = {};
    containerConfig.mcpServers[payload.name] = {
      command: payload.command,
      args: payload.args || [],
      env: payload.env || {},
    };
    updateAgentGroup(session.agent_group_id, { container_config: JSON.stringify(containerConfig) });

    // Kill the container so next wake loads the new MCP server config
    killContainer(session.id, 'mcp server added');
    notify(`MCP server "${payload.name}" added. Your container will restart with it on the next message.`);
    log.info('MCP server add approved', { approvalId: approval.approval_id, userId });
  }

  deletePendingApproval(approval.approval_id);
  await wakeContainer(session);
}

/** Graceful shutdown. */
async function shutdown(signal: string): Promise<void> {
  log.info('Shutdown signal received', { signal });
  stopOneCLIApprovalHandler();
  stopDeliveryPolls();
  stopHostSweep();
  mcpProxyHandle?.stop();
  mcpStackHandle?.stop();
  await dashboardIngressHandle?.stop();
  await teardownChannelAdapters();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((err) => {
  log.fatal('Startup failed', { err });
  process.exit(1);
});
