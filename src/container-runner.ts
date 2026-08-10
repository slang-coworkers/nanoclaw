/**
 * Container Runner v2
 * Spawns agent containers with session folder + agent group folder mounts.
 * The container runs the v2 agent-runner which polls the session DB.
 */
import { ChildProcess, exec, execSync, spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import { OneCLI } from '@onecli-sh/sdk';

import {
  composeCoworkerSpine,
  getAppliedOverlayNames,
  materializeCritiqueDeliveryMarkers,
  materializeCritiqueRequiredStages,
  materializeOverlayMarkers,
  readCoworkerTypes,
  readSkillCatalog,
  resolveCoworkerManifest,
  type CoworkerTypeEntry,
  type SkillMeta,
} from './claude-composer.js';
import {
  CONTAINER_CPU_LIMIT,
  CONTAINER_IMAGE,
  CONTAINER_IMAGE_BASE,
  CONTAINER_INSTALL_LABEL,
  CONTAINER_MEMORY_LIMIT,
  CONTAINER_PIDS_LIMIT,
  CONTAINER_PREFIX,
  DASHBOARD_PORT,
  DATA_DIR,
  GROUPS_DIR,
  IDLE_TIMEOUT,
  MAX_MESSAGES_PER_PROMPT,
  MCP_PROXY_PORT,
  ONECLI_URL,
  TIMEZONE,
} from './config.js';
import { materializeContainerJson, resolveGroupTimezone } from './container-config.js';
import { getContainerConfig, updateContainerConfigScalars } from './db/container-configs.js';
import { CONTAINER_RUNTIME_BIN, hostGatewayArgs, readonlyMountArgs, stopContainer } from './container-runtime.js';
import { EGRESS_NETWORK, egressNetworkArgs, ensureEgressNetwork } from './egress-lockdown.js';
import { getAgentGroup } from './db/agent-groups.js';
import { getDb, hasTable } from './db/connection.js';
import { getSession } from './db/sessions.js';
import { initGroupFilesystem } from './group-init.js';
import { stopTypingRefresh } from './modules/typing/index.js';
import { log } from './log.js';
import {
  registerContainerToken,
  revokeContainerToken,
  getDiscoveredToolInventory,
  getDiscoveredToolAnnotations,
} from './mcp-auth-proxy.js';
import {
  resolveMcpAllowlist,
  serverHasAllowedTools,
  toMcpPolicyWire,
  type McpAllowlistResolution,
} from './mcp-allowlist.js';
import { validateAdditionalMounts } from './modules/mount-security/index.js';
// Provider host-side config barrel — each provider that needs host-side
// container setup self-registers on import.
import './providers/index.js';
import {
  getProviderContainerConfig,
  providerProvidesAgentSurfaces,
  type ProviderContainerContribution,
  type VolumeMount,
} from './providers/provider-container-registry.js';
import {
  heartbeatPath,
  markContainerRunning,
  markContainerStopped,
  sessionDir,
  writeSessionRouting,
} from './session-manager.js';
import type { AgentGroup, Session } from './types.js';

const onecli = new OneCLI({ url: ONECLI_URL });

/**
 * Cached coworker types + skill catalog — reloaded when any coworker-types.yaml
 * or SKILL.md mtime changes. Tool derivation walks the catalog so both inputs
 * participate in the fingerprint.
 */
let registryCache: {
  types: Record<string, CoworkerTypeEntry>;
  catalog: Record<string, SkillMeta>;
  fingerprint: number;
} | null = null;

function registryFingerprint(): number {
  const root = process.cwd();
  // Mirror discovery roots in src/claude-composer/registry.ts. Any change to a
  // spine, workflow, overlay, or capability skill file invalidates the cache.
  const roots: { dir: string; files: string[] }[] = [
    { dir: path.join(root, 'container', 'skills'), files: ['coworker-types.yaml', 'SKILL.md'] },
    { dir: path.join(root, 'container', 'workflows'), files: ['WORKFLOW.md'] },
    { dir: path.join(root, 'container', 'overlays'), files: ['OVERLAY.md'] },
    { dir: path.join(root, 'container', 'spines'), files: ['coworker-types.yaml'] },
  ];
  let maxMtime = 0;
  for (const { dir, files } of roots) {
    try {
      for (const entry of fs.readdirSync(dir)) {
        for (const file of files) {
          try {
            maxMtime = Math.max(maxMtime, fs.statSync(path.join(dir, entry, file)).mtimeMs);
          } catch {
            /* file does not exist */
          }
        }
      }
    } catch {
      /* root dir does not exist */
    }
  }
  return maxMtime;
}

function loadRegistry(): { types: Record<string, CoworkerTypeEntry>; catalog: Record<string, SkillMeta> } {
  try {
    const fp = registryFingerprint();
    if (registryCache && registryCache.fingerprint === fp) {
      return { types: registryCache.types, catalog: registryCache.catalog };
    }
    const projectRoot = process.cwd();
    const types = readCoworkerTypes(projectRoot);
    const catalog = readSkillCatalog(projectRoot);
    registryCache = { types, catalog, fingerprint: fp };
    return { types, catalog };
  } catch (err) {
    log.warn('Failed to load coworker registry', { err });
    return { types: {}, catalog: {} };
  }
}

export function resetCoworkerTypesCacheForTests(): void {
  registryCache = null;
}

type GpuMode = 'runtime-nvidia' | 'gpus-all' | 'none';
let gpuModeCache: GpuMode | null = null;

function detectGpuMode(): GpuMode {
  if (gpuModeCache) return gpuModeCache;
  if (process.env.ENABLE_GPU !== '1' && !fs.existsSync('/usr/bin/nvidia-smi')) {
    return (gpuModeCache = 'none');
  }
  const forced = process.env.GPU_RUNTIME_MODE as GpuMode | undefined;
  if (forced === 'runtime-nvidia' || forced === 'gpus-all') return (gpuModeCache = forced);
  try {
    const runtimes = execSync('docker info --format "{{json .Runtimes}}"', { timeout: 3000 }).toString();
    if (/\bnvidia\b/.test(runtimes)) return (gpuModeCache = 'runtime-nvidia');
  } catch {}
  return (gpuModeCache = 'gpus-all');
}

/** Active containers tracked by session ID. */
const activeContainers = new Map<string, { process: ChildProcess; containerName: string }>();

/** SHA-256 hash of CLAUDE.md at spawn time, keyed by session ID. */
const spawnedClaudeMdHash = new Map<string, string>();

/**
 * In-flight wake promises, keyed by session id. Deduplicates concurrent
 * `wakeContainer` calls while the first spawn is still mid-setup (async
 * buildContainerArgs, OneCLI gateway apply, etc.) — otherwise a second
 * wake in that window passes the `activeContainers.has` check and spawns
 * a duplicate container against the same session directory, producing
 * racy double-replies.
 */
const wakePromises = new Map<string, Promise<boolean>>();

/**
 * Compose CLAUDE.md from the lego coworker model: spine fragments + skills +
 * workflows + overlays + trait bindings, discovered under
 * `container/{spines,skills,workflows,overlays}/`. See docs/lego-coworker-workflows.md.
 *
 * Runs for ALL non-admin coworkers on every container wake. CLAUDE.md is
 * system-owned (regenerated from the manifest + .instructions.md on every
 * wake). User edits go in .instructions.md and are appended after the spine.
 */
function composeCoworkerClaudeMd(agentGroup: AgentGroup): void {
  const groupDir = path.resolve(GROUPS_DIR, agentGroup.folder);
  const claudeMdPath = path.join(groupDir, 'CLAUDE.md');
  const instructionsPath = path.join(groupDir, '.instructions.md');

  if (!agentGroup.coworker_type && !fs.existsSync(instructionsPath) && fs.existsSync(claudeMdPath)) {
    fs.renameSync(claudeMdPath, instructionsPath);
    log.info('Auto-migrated CLAUDE.md to .instructions.md', { folder: agentGroup.folder });
  }

  if (!agentGroup.coworker_type) {
    // Untyped coworker: compose via the 'default' typed leaf + .instructions.md.
    // 'default' extends base-common with no project skills, so it's the bare
    // spine — minimum operational guidance for a coworker that needs no
    // project-specific knowledge. This goes through the same composer
    // pipeline as typed coworkers.
    try {
      let extraInstructions: string | null = null;
      try {
        extraInstructions = fs.readFileSync(instructionsPath, 'utf-8');
      } catch {
        /* no instructions */
      }

      const overlays = agentGroup.overlays ? JSON.parse(agentGroup.overlays) : undefined;
      const composeOpts = {
        coworkerType: 'default',
        extraInstructions,
        disableOverlays: agentGroup.disable_overlays === 1,
        overlays,
        cliScope: (getContainerConfig(agentGroup.id)?.cli_scope ?? 'group') as 'disabled' | 'group' | 'global',
      };
      const composed = composeCoworkerSpine(composeOpts);
      fs.mkdirSync(groupDir, { recursive: true });
      fs.writeFileSync(claudeMdPath, composed);
      // Materialize MARKER files for overlays carrying one (e.g. buddy-monitor).
      // Containers see /workspace/agent/.overlay-<name> via the standard mount;
      // hooks like spawn-buddy.sh test for these files to gate themselves.
      const appliedOverlays = getAppliedOverlayNames(process.cwd(), 'default', composeOpts);
      materializeOverlayMarkers(appliedOverlays, process.cwd(), groupDir);
      materializeCritiqueRequiredStages('default', readCoworkerTypes(process.cwd()), appliedOverlays, groupDir);
      materializeCritiqueDeliveryMarkers('default', readCoworkerTypes(process.cwd()), appliedOverlays, groupDir);
      log.debug('CLAUDE.md composed for untyped coworker via default type', { folder: agentGroup.folder });
    } catch (err) {
      log.warn('Failed to compose CLAUDE.md for untyped coworker', { folder: agentGroup.folder, err });
    }
    return;
  }

  try {
    let extraInstructions: string | null = null;
    try {
      extraInstructions = fs.readFileSync(instructionsPath, 'utf-8');
    } catch {
      /* no explicit instructions */
    }

    const overlays = agentGroup.overlays ? JSON.parse(agentGroup.overlays) : undefined;
    const composeOpts = {
      coworkerType: agentGroup.coworker_type,
      extraInstructions,
      disableOverlays: agentGroup.disable_overlays === 1,
      overlays,
      cliScope: (getContainerConfig(agentGroup.id)?.cli_scope ?? 'group') as 'disabled' | 'group' | 'global',
    };
    const composed = composeCoworkerSpine(composeOpts);

    fs.mkdirSync(groupDir, { recursive: true });
    fs.writeFileSync(claudeMdPath, composed);
    const appliedOverlays = getAppliedOverlayNames(process.cwd(), agentGroup.coworker_type, composeOpts);
    materializeOverlayMarkers(appliedOverlays, process.cwd(), groupDir);
    materializeCritiqueRequiredStages(
      agentGroup.coworker_type,
      readCoworkerTypes(process.cwd()),
      appliedOverlays,
      groupDir,
    );
    materializeCritiqueDeliveryMarkers(
      agentGroup.coworker_type,
      readCoworkerTypes(process.cwd()),
      appliedOverlays,
      groupDir,
    );
    log.debug('CLAUDE.md composed from lego spine', { folder: agentGroup.folder });
  } catch (err) {
    log.warn('Failed to compose CLAUDE.md from lego spine', { folder: agentGroup.folder, err });
  }
}

/** Resolve the coworker manifest once; returns tools, mcpServers, overlay names, and workflow summaries. */
function resolveTypeManifest(agentGroup: AgentGroup): {
  tools: string[];
  mcpServers: Record<string, unknown>;
  overlayNames: string[];
  workflows: { name: string; description: string }[];
} {
  // Untyped coworker → resolve as 'default' so it gets the same tool
  // allowlist, MCP servers, and overlays as its composed CLAUDE.md
  // (composeCoworkerClaudeMd above also renders via 'default').
  const effectiveType = agentGroup.coworker_type || 'default';
  try {
    const { types, catalog } = loadRegistry();
    const manifest = resolveCoworkerManifest(types, effectiveType, catalog, process.cwd());
    const overlayNames = [
      ...new Set(
        manifest.customizations.filter((c) => c.kind === 'overlay' && c.overlayName).map((c) => c.overlayName!),
      ),
    ];
    return {
      tools: manifest.tools.filter((t) => t.startsWith('mcp__')),
      mcpServers: manifest.mcpServers ?? {},
      overlayNames,
      workflows: manifest.workflows.map((w) => ({ name: w.name, description: w.description })),
    };
  } catch (err) {
    log.warn('Failed to resolve coworker manifest', { coworkerType: effectiveType, err });
    return { tools: [], mcpServers: {}, overlayNames: [], workflows: [] };
  }
}

/**
 * Whether the runtime overlay hooks (gate-plan, gate-critique-on-deliver,
 * track-edits, track-critique, intent-router, workflow-state-reset) should
 * be injected into the container's settings.json for this agent group.
 *
 * Critique enforcement under Model A is overlay-marker-gated at the hook
 * level (gate-critique-on-deliver.sh first-line `[ -f .overlay-critique-gate ]`),
 * so wiring the hook universally is safe — coworkers without the overlay
 * are no-op'd by the hook itself. The flags returned here decide whether to
 * wire the hook configuration AT ALL into settings.json; we keep it
 * unconditional now (always wire), matching the symmetric opt-in design.
 *
 * `disable_overlays=1` still wins as a hard kill switch: when set, neither
 * gate runs, mirroring the compose-time strip of overlay prose.
 *
 * Exported for the R20 runtime-side counterpart of the R19 compose-time test.
 */
export function resolveOverlayHookFlags(agentGroup: AgentGroup): { hasPlan: boolean; hasCritique: boolean } {
  if (agentGroup.disable_overlays === 1) return { hasPlan: false, hasCritique: false };
  // Hooks are wired unconditionally; per-coworker activation lives in the
  // hook's marker check (`/workspace/agent/.overlay-<name>`), materialized by
  // the composer when the coworker's `overlays:` list includes the relevant
  // overlay. See container/overlays/{buddy-monitor,critique-gate}/MARKER.
  return { hasPlan: true, hasCritique: true };
}

/**
 * The tools this group's container may call, per the single allow-list policy
 * in mcp-allowlist.ts — the same resolver `ncl groups mcp-tools get/set` reads,
 * so what an operator is shown is what the next spawn enforces.
 *
 * The coworker manifest is passed in because this path already resolves it
 * (behind the registry fingerprint cache) and would otherwise re-read the
 * registry on every spawn.
 */
export function resolveAllowedMcpTools(agentGroup: AgentGroup): string[] {
  return resolveMcpPolicy(agentGroup).tools;
}

/**
 * The full allow-list resolution for a group — state included, not just the
 * list. Enforcement needs the state: an empty `explicit` list has zero tools
 * and denies everything, while an `inherited` group has whatever the inventory
 * happens to hold and denies nothing. Length cannot tell those apart.
 */
export function resolveMcpPolicy(agentGroup: AgentGroup): McpAllowlistResolution {
  return resolveMcpAllowlist(agentGroup);
}

export function getActiveContainerCount(): number {
  return activeContainers.size;
}

/**
 * Tail of a session id used in container names (strips the `sess-` prefix).
 * Exported so the dashboard can reconstruct the `<prefix>-<folder>-<tail>`
 * shape when matching `docker ps` output to a specific NanoClaw session.
 */
export function containerSessionTail(sessionId: string): string {
  return sessionId.startsWith('sess-') ? sessionId.slice(5) : sessionId;
}

export function isContainerRunning(sessionId: string): boolean {
  return activeContainers.has(sessionId);
}

/**
 * Wake up a container for a session. If already running or mid-spawn, no-op
 * (the in-flight wake promise is reused).
 *
 * The container runs the v2 agent-runner which polls the session DB.
 *
 * Returns `true` if the container is (or becomes) running, `false` on a
 * skipped wake (closed session) or a transient spawn failure (e.g. the
 * container runtime / OneCLI gateway is unreachable). Callers don't need to
 * wrap — the inbound row stays pending and host-sweep retries on its next
 * tick — but callers that care (e.g. a typing indicator) can branch on it.
 */
export function wakeContainer(session: Session): Promise<boolean> {
  if (activeContainers.has(session.id)) {
    log.debug('Container already running', { sessionId: session.id });
    return Promise.resolve(true);
  }
  // Never respawn a session that has been closed (e.g. admin clicked Stop on a
  // runaway card). The approval response-handler fires wakeContainer after
  // every card response, and the sweep can race; re-read the authoritative
  // status here so a Stop is final. getActiveSessions already filters the
  // sweep, but this guards the direct-wake paths too.
  const current = getSession(session.id);
  if (current && current.status === 'closed') {
    log.debug('Skipping wake of closed session', { sessionId: session.id });
    return Promise.resolve(false);
  }
  const existing = wakePromises.get(session.id);
  if (existing) {
    log.debug('Container wake already in-flight — joining existing promise', { sessionId: session.id });
    return existing;
  }
  const promise = spawnContainer(session)
    .then(() => true)
    .catch((err) => {
      log.warn('wakeContainer failed — host-sweep will retry', { sessionId: session.id, err });
      return false;
    })
    .finally(() => {
      wakePromises.delete(session.id);
    });
  wakePromises.set(session.id, promise);
  return promise;
}

async function spawnContainer(session: Session): Promise<void> {
  const agentGroup = getAgentGroup(session.agent_group_id);
  if (!agentGroup) {
    log.error('Agent group not found', { agentGroupId: session.agent_group_id });
    return;
  }

  // Initialize per-group filesystem + container_configs row before any code
  // path that reads container config (composeCoworkerClaudeMd reads cli_scope;
  // resolveProviderContribution calls materializeContainerJson which throws
  // when the row is missing). initGroupFilesystem is documented idempotent
  // (group-init.ts:91) so this is a no-op for groups that have spawned
  // before. Running it here makes spawn self-healing for any creation path
  // that didn't pre-create the row (e.g. the dashboard create-coworker
  // handler) — without this, a brand-new coworker stays jammed in a
  // 1-per-minute "Container config not found" sweep retry until the next
  // host restart triggers backfillContainerConfigs from container.json.
  initGroupFilesystem(agentGroup);

  // Compose CLAUDE.md for typed coworkers (lego spine model).
  composeCoworkerClaudeMd(agentGroup);

  // Store a hash of the just-composed CLAUDE.md so the host sweep can detect
  // staleness if skills/overlays/workflows change while the container is running.
  try {
    const claudeContent = fs.readFileSync(path.join(GROUPS_DIR, agentGroup.folder, 'CLAUDE.md'));
    const hash = crypto.createHash('sha256').update(claudeContent).digest('hex');
    spawnedClaudeMdHash.set(session.id, hash);
    log.debug('CLAUDE.md hash stored at spawn', { sessionId: session.id, hash: hash.slice(0, 12) });
  } catch {
    /* composition failed — no hash to track */
  }

  // Refresh the destination map and current-thread routing so any admin
  // changes take effect on wake. Destinations come from the agent-to-agent
  // module — skip when the module isn't installed (table absent).
  if (hasTable(getDb(), 'agent_destinations')) {
    const { writeDestinations } = await import('./modules/agent-to-agent/write-destinations.js');
    writeDestinations(agentGroup.id, session.id);
  }
  writeSessionRouting(agentGroup.id, session.id);

  // Materialize container.json from DB — writes fresh file and returns
  // the config object, threaded through provider resolution, buildMounts,
  // and buildContainerArgs so we don't re-read.
  const containerConfig = materializeContainerJson(agentGroup.id);

  // Per-group filesystem state lives forever after first creation. Init is
  // idempotent: it only writes paths that don't already exist, so this call
  // is a no-op for groups that have spawned before. Runs before the provider
  // contribution so a surfaces-providing provider finds the group dir ready.
  const providerName = resolveProviderName(session.agent_provider, containerConfig.provider);
  initGroupFilesystem(agentGroup, { provider: providerName });

  // Resolve the effective provider + any host-side contribution it declares
  // (extra mounts, env passthrough). Computed once and threaded through both
  // buildMounts and buildContainerArgs so side effects (mkdir, etc.) fire once.
  const { provider, contribution } = resolveProviderContribution(session, agentGroup);

  const mounts = buildMounts(agentGroup, session, containerConfig, provider, contribution);
  // Container name embeds the NanoClaw session id tail so the dashboard can
  // route shell-exec requests to the right container when a coworker has
  // multiple live sessions (root + thread sessions). Without the tail, every
  // container for a folder collapsed into one namespace and shell-exec landed
  // in an arbitrary session. Timestamp keeps rapid respawns unique.
  const containerName = `${CONTAINER_PREFIX}-${agentGroup.folder}-${containerSessionTail(session.id)}-${Date.now()}`;
  // OneCLI agent identifier is always the agent group id — stable across
  // sessions and reversible via getAgentGroup() for approval routing.
  const agentIdentifier = agentGroup.id;

  // Register an MCP proxy token so the container can access host MCP servers.
  // The token carries the resolved list; an empty one authorises nothing,
  // which is what an explicit `[]` (or an unresolvable policy) must mean.
  const mcpPolicy = resolveMcpPolicy(agentGroup);
  const proxyToken = registerContainerToken(agentGroup.folder, mcpPolicy.externalTools);

  // Operator-visible, not a debug line. The policy is still correct — a
  // configuration fault never narrows a group, by design — but something the
  // resolver wanted to read was unreadable and somebody has to fix it.
  if (mcpPolicy.configurationError) {
    log.error('MCP allow-list resolved with a configuration fault — policy unchanged, fix the fault', {
      sessionId: session.id,
      agentGroup: agentGroup.name,
      coworkerType: agentGroup.coworker_type,
      state: mcpPolicy.state,
      configurationError: mcpPolicy.configurationError,
    });
  }

  const args = await buildContainerArgs(
    mounts,
    containerName,
    agentGroup,
    session,
    provider,
    contribution,
    agentIdentifier,
    {
      proxyToken,
      policy: mcpPolicy,
    },
  );

  log.info('Spawning container', {
    sessionId: session.id,
    agentGroup: agentGroup.name,
    containerName,
    mcpPolicyState: mcpPolicy.state,
    mcpExternalToolCount: mcpPolicy.externalTools.length,
    hasProxyToken: !!proxyToken,
  });

  // Clear any orphan heartbeat from a previous container instance — the
  // sweep's ceiling check treats a missing file as "fresh spawn, give grace"
  // (host-sweep.ts line 87). Without this, the stale mtime can trigger an
  // immediate kill before the new container touches the file itself.
  fs.rmSync(heartbeatPath(agentGroup.id, session.id), { force: true });

  const container = spawn(CONTAINER_RUNTIME_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  activeContainers.set(session.id, { process: container, containerName });
  markContainerRunning(session.id);

  // Tee for dashboard's Container Logs admin panel — reads groups/<folder>/logs/container-*.log
  const ts = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const tsStr = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
  const containerLogDir = path.join(GROUPS_DIR, agentGroup.folder, 'logs');
  let containerLogStream: fs.WriteStream | undefined;
  try {
    fs.mkdirSync(containerLogDir, { recursive: true });
    const containerLogPath = path.join(containerLogDir, `container-${session.id}-${tsStr}.log`);
    containerLogStream = fs.createWriteStream(containerLogPath, { flags: 'a' });
    container.stdout?.pipe(containerLogStream, { end: false });
    container.stderr?.pipe(containerLogStream, { end: false });
  } catch (err) {
    log.warn('Failed to open container log file', { folder: agentGroup.folder, err });
  }

  // Log stderr. A container that dies at boot (unknown provider, missing
  // binary, bad config) explains itself only here — and debug is below the
  // default log level — so keep a tail to surface on a non-zero exit. Every
  // line is also teed to the per-group container log (containerLogStream
  // above), so debug level here doesn't lose the data for the dashboard panel.
  const stderrTail: string[] = [];
  container.stderr?.on('data', (data) => {
    for (const line of data.toString().trim().split('\n')) {
      if (!line) continue;
      log.debug(line, { container: agentGroup.folder });
      stderrTail.push(line);
      if (stderrTail.length > 10) stderrTail.shift();
    }
  });

  // stdout is unused in v2 (all IO is via session DB)
  container.stdout?.on('data', () => {});

  // No host-side idle timeout. Stale/stuck detection is driven by the host
  // sweep reading heartbeat mtime + processing_ack claim age + container_state
  // (see src/host-sweep.ts). This avoids killing long-running legitimate work
  // on a wall-clock timer.

  container.on('close', (code) => {
    activeContainers.delete(session.id);
    spawnedClaudeMdHash.delete(session.id);
    markContainerStopped(session.id);
    stopTypingRefresh(session.id);
    revokeContainerToken(proxyToken);
    containerLogStream?.end();
    // code null = killed by signal (normal shutdown path), not a boot failure.
    if (code !== 0 && code !== null && stderrTail.length > 0) {
      log.warn('Container exited non-zero', { sessionId: session.id, code, containerName, stderrTail });
    } else {
      log.info('Container exited', { sessionId: session.id, code, containerName });
    }
  });

  container.on('error', (err) => {
    activeContainers.delete(session.id);
    markContainerStopped(session.id);
    stopTypingRefresh(session.id);
    containerLogStream?.end();
    log.error('Container spawn error', { sessionId: session.id, err });
  });
}

/** Kill a container for a session. */
export function killContainer(sessionId: string, reason: string, onExit?: () => void): void {
  const entry = activeContainers.get(sessionId);
  if (!entry) return;

  log.info('Killing container', { sessionId, reason, containerName: entry.containerName });
  try {
    stopContainer(entry.containerName);
  } catch {
    entry.process.kill('SIGKILL');
  }
  if (onExit) {
    entry.process.once('exit', () => {
      try {
        onExit();
      } catch (err) {
        log.warn('killContainer onExit callback threw', { sessionId, err });
      }
    });
  }
}

/**
 * Resolve the provider name for a session using the precedence documented in
 * the provider-install skills:
 *
 *   sessions.agent_provider
 *     → agent_groups.agent_provider
 *     → container.json `provider`
 *     → 'claude'
 *
 * Pure so the precedence can be unit-tested without a DB or filesystem.
 */
export function resolveProviderName(
  sessionProvider: string | null | undefined,
  agentGroupProvider: string | null | undefined,
  containerConfigProvider?: string | null | undefined,
): string {
  return (sessionProvider || agentGroupProvider || containerConfigProvider || 'claude').toLowerCase();
}

/**
 * Recompose CLAUDE.md for a running container and update the stored hash.
 * Call after sending /clear so the next SDK turn picks up the fresh file
 * and the sweep doesn't re-detect as stale.
 */
export function recomposeAndUpdateHash(sessionId: string): void {
  const session = getSession(sessionId);
  if (!session) return;
  const ag = getAgentGroup(session.agent_group_id);
  if (!ag) return;
  composeCoworkerClaudeMd(ag);
  // Hash must match what detectStaleContainers computes: composeCoworkerSpine output,
  // NOT the file on disk (which may have @-import prefixes for flat types).
  try {
    const coworkerType = ag.coworker_type || 'default';
    let extra: string | null = null;
    try {
      extra = fs.readFileSync(path.join(GROUPS_DIR, ag.folder, '.instructions.md'), 'utf-8');
    } catch {
      /* */
    }
    const overlays = ag.overlays ? JSON.parse(ag.overlays) : undefined;
    const composed = composeCoworkerSpine({
      coworkerType,
      extraInstructions: extra,
      disableOverlays: ag.disable_overlays === 1,
      overlays,
      cliScope: (getContainerConfig(ag.id)?.cli_scope ?? 'group') as 'disabled' | 'group' | 'global',
    });
    spawnedClaudeMdHash.set(sessionId, crypto.createHash('sha256').update(composed).digest('hex'));
  } catch {
    /* best-effort */
  }
}

/**
 * Detect containers whose CLAUDE.md has become stale (skills/overlays/
 * .instructions.md changed since spawn). Returns session IDs that need a
 * fresh context. Does NOT kill or send messages — the caller decides.
 */
export function detectStaleContainers(): Array<{ sessionId: string; agentGroupId: string; folder: string }> {
  const stale: Array<{ sessionId: string; agentGroupId: string; folder: string }> = [];
  for (const [sessionId] of activeContainers) {
    const session = getSession(sessionId);
    if (!session) continue;
    const ag = getAgentGroup(session.agent_group_id);
    if (!ag) continue;

    const coworkerType = ag.coworker_type || 'default';
    let extra: string | null = null;
    try {
      extra = fs.readFileSync(path.join(GROUPS_DIR, ag.folder, '.instructions.md'), 'utf-8');
    } catch {
      /* no instructions */
    }

    // Compose the current spine to compare against the running container's
    // baseline. This can THROW when a coworker type references a skill/workflow/
    // overlay that isn't resolvable on disk (e.g. an external `skill-source`
    // skill that hasn't been fetched into container/skills/ yet). Guard it
    // per-session: a single broken type must not abort the whole stale scan.
    //
    // Before this guard, one unresolvable type (any live slang/slangpy
    // container while its external skills were absent) threw here, propagated
    // to the sweep's outer try/catch, and skipped the entire CLAUDE.md-stale
    // respawn loop — silently disabling instruction hot-reload FLEET-WIDE for
    // every healthy coworker. Mirror resolveTypeManifest's tolerance: log and
    // skip just this session. Its stale-check resumes once the type resolves.
    let currentHash: string;
    try {
      const overlays = ag.overlays ? JSON.parse(ag.overlays) : undefined;
      const composed = composeCoworkerSpine({
        coworkerType,
        extraInstructions: extra,
        disableOverlays: ag.disable_overlays === 1,
        overlays,
        cliScope: (getContainerConfig(ag.id)?.cli_scope ?? 'group') as 'disabled' | 'group' | 'global',
      });
      currentHash = crypto.createHash('sha256').update(composed).digest('hex');
    } catch (err) {
      log.warn('Skipping stale-check — spine compose failed', { folder: ag.folder, coworkerType, err });
      continue;
    }

    // Resolve the baseline hash for the running container. The in-memory map
    // is populated when this host process spawned the container, but it
    // empties on host restart — without a fallback, every container that
    // outlived a host restart becomes permanently invisible to stale
    // detection (the bug that left slang-triage running with a 3-day-old
    // CLAUDE.md after multiple /update-nanoclaw-instance cycles).
    //
    // The on-disk CLAUDE.md is what the running container actually started
    // with (the container reads it at spawn time). Hashing it gives a
    // reliable baseline that survives host restarts. Seed the map so the
    // next sweep tick skips the disk read.
    let spawnHash = spawnedClaudeMdHash.get(sessionId);
    if (!spawnHash) {
      try {
        // Read as Buffer (no encoding) to match the spawn site at line ~404
        // exactly — eliminates any theoretical encoding-roundtrip drift.
        const onDisk = fs.readFileSync(path.join(GROUPS_DIR, ag.folder, 'CLAUDE.md'));
        spawnHash = crypto.createHash('sha256').update(onDisk).digest('hex');
        spawnedClaudeMdHash.set(sessionId, spawnHash);
      } catch {
        // No CLAUDE.md on disk — group hasn't been spawned by anyone yet.
        // Skip; the next real spawn will populate the map.
        continue;
      }
    }

    if (currentHash !== spawnHash) {
      stale.push({ sessionId, agentGroupId: ag.id, folder: ag.folder });
    }
  }
  return stale;
}

/**
 * Container hardening flags. Applied to every agent container; no per-group or
 * per-install override.
 *
 * cap-drop and no-new-privileges are inert while containers run under the
 * `--user` mapping below (the capability sets are already empty and the image
 * carries no file capabilities) — they are depth against a root-in-container
 * path. `--init` is not optional: the `--entrypoint bash` override further down
 * defeats the image's tini, leaving bun as PID 1 with no signal handler, and
 * Linux discards default-action signals to PID 1. Without docker-init, SIGTERM
 * is ignored and every stop ends in SIGKILL after the full grace period.
 */
export function hardeningArgs(pidsLimit: string): string[] {
  const args = ['--cap-drop=ALL', '--security-opt', 'no-new-privileges', '--init'];

  // Test >0, not truthiness: cgroups v2 rejects `--pids-limit 0` with EINVAL and
  // fails the spawn, and '0' is a truthy string. Blank/unparseable means no cap.
  const pids = Number(pidsLimit);
  if (Number.isFinite(pids) && pids > 0) args.push('--pids-limit', String(Math.floor(pids)));

  return args;
}

function resolveProviderContribution(
  session: Session,
  agentGroup: AgentGroup,
): { provider: string; contribution: ProviderContainerContribution } {
  // Precedence: session provider > agent_group provider > container.json > default.
  // Previously passed undefined for container-config, making `provider:` in
  // groups/<folder>/container.json dead config.
  const containerConfig = materializeContainerJson(agentGroup.id);
  const containerConfigProvider = containerConfig.provider ?? null;
  const provider = resolveProviderName(session.agent_provider, agentGroup.agent_provider, containerConfigProvider);
  const fn = getProviderContainerConfig(provider);
  const contribution = fn
    ? fn({
        sessionDir: sessionDir(agentGroup.id, session.id),
        agentGroupId: agentGroup.id,
        groupDir: path.resolve(GROUPS_DIR, agentGroup.folder),
        selectedSkills: selectedSkillNames(containerConfig),
        hostEnv: process.env,
      })
    : {};
  return { provider, contribution };
}

/**
 * Locate the patched claude-trace build, or null if this install has none.
 *
 * Prefers the tracked copy at container/claude-trace. Falls back to the legacy
 * untracked data/claude-trace so a box provisioned before it was vendored keeps
 * tracing until its checkout catches up.
 *
 * Presence of dist/cli.js is the switch for the whole feature: no build means no
 * mount and no CLAUDE_CODE_EXECUTABLE, so the SDK runs the stock binary and
 * simply produces no traces. Both call sites gate on this, so they can never
 * disagree — an env var pointing at an unmounted wrapper would break every
 * Claude turn with ENOENT.
 */
export function resolveClaudeTraceDir(): string | null {
  for (const dir of [path.join(process.cwd(), 'container', 'claude-trace'), path.join(DATA_DIR, 'claude-trace')]) {
    if (fs.existsSync(path.join(dir, 'dist', 'cli.js'))) return dir;
  }
  return null;
}

export function buildMounts(
  agentGroup: AgentGroup,
  session: Session,
  containerConfig: import('./container-config.js').ContainerConfig,
  provider: string,
  providerContribution: ProviderContainerContribution,
): VolumeMount[] {
  // Default agent surfaces (composed project doc, skill links, provider state
  // dir) apply unless the provider declares it provides its own — a capability,
  // never a provider name. See provider-container-registry. (Fork composes
  // CLAUDE.md via composeCoworkerClaudeMd in spawnContainer, so the upstream
  // syncSkillSymlinks/composeGroupClaudeMd path is not used here.)
  const defaultSurfaces = !providerProvidesAgentSurfaces(provider);

  const mounts: VolumeMount[] = [];
  const sessDir = sessionDir(agentGroup.id, session.id);
  const groupDir = path.resolve(GROUPS_DIR, agentGroup.folder);

  // Convenience: drop a symlink at groups/<folder>/.workflow-state.json pointing
  // at the per-session state file. Lets the user inspect plan/critique state from
  // the visible group folder instead of digging into data/v2-sessions/.../sess-*/.claude/.
  // The symlink uses an absolute host path because it's only ever read host-side
  // (the container has the real file at /workspace/.claude/workflow-state.json).
  try {
    const linkPath = path.join(groupDir, '.workflow-state.json');
    const targetPath = path.join(sessDir, '.claude', 'workflow-state.json');
    if (fs.existsSync(linkPath) && !fs.lstatSync(linkPath).isSymbolicLink()) {
      // Stale regular file from a prior run — replace with symlink.
      fs.unlinkSync(linkPath);
    }
    if (!fs.existsSync(linkPath)) {
      fs.symlinkSync(targetPath, linkPath);
    }
  } catch (err) {
    log.debug('workflow-state symlink skipped', { folder: agentGroup.folder, err });
  }

  // Session folder at /workspace (contains inbound.db, outbound.db, outbox/, .claude/)
  mounts.push({ hostPath: sessDir, containerPath: '/workspace', readonly: false });

  // Agent group folder at /workspace/agent
  mounts.push({ hostPath: groupDir, containerPath: '/workspace/agent', readonly: false });

  // Shared directory (learnings + cross-group facts) — mounted read-only
  // for coworkers, read-write for Main. Main is the only agent allowed to
  // edit the shared bucket; coworkers write via mcp__nanoclaw__append_learning
  // which the host processes through the approval flow.
  const sharedDir = path.join(DATA_DIR, 'shared');
  if (fs.existsSync(sharedDir)) {
    // Admin (Main) gets write access. Trust ONLY is_admin — not
    // coworker_type. A malicious import that set coworker_type='main'
    // on a non-admin group must not get write access.
    const isAdmin = agentGroup.is_admin === 1;
    mounts.push({ hostPath: sharedDir, containerPath: '/workspace/shared', readonly: !isAdmin });
  }

  // Per-group .claude-shared at /home/node/.claude (Claude state, settings,
  // skills — initialized once at group creation, persistent thereafter)
  const claudeDir = path.join(DATA_DIR, 'v2-sessions', agentGroup.id, '.claude-shared');
  const settingsFile = path.join(claudeDir, 'settings.json');

  // Dashboard hook injection (port comes from config/.env). Gated on
  // defaultSurfaces: a surfaces-owning provider (e.g. codex) has no
  // .claude-shared/settings.json, so reading it here would ENOENT-crash the
  // spawn. Claude hooks are only meaningful when the agent runs on Claude
  // surfaces in the first place.
  const dashboardPort = DASHBOARD_PORT ? String(DASHBOARD_PORT) : '';
  if (defaultSurfaces && dashboardPort) {
    const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
    const hookUrl = `http://host.docker.internal:${dashboardPort}/api/hook-event`;
    if (!settings.hooks) settings.hooks = {};
    // Dedupe + drop stale-ref pass over every hook event. Two failure modes
    // it heals:
    //   1. Old bug in the CLAUDE.md guard's includes() check (escape mismatch
    //      `CLAUDE\\\\.md` vs stored `CLAUDE\.md`) appended a duplicate every
    //      restart, accumulating to 11k+ entries on busy installs and burying
    //      gate-plan / gate-critique-on-deliver so they silently never fired.
    //   2. Hook scripts get renamed (plan-gate.sh → gate-plan.sh,
    //      critique-record-gate.sh → gate-critique-on-deliver.sh, etc.) and
    //      old `/app/hooks/<old>.sh` references get stranded in settings.json
    //      where they fail at runtime with no diagnostic.
    // Collapse by (matcher, ordered command tuple); drop any entry whose
    // command references a `/app/hooks/<X>.sh` that no longer exists in the
    // build's container/hooks/ directory.
    {
      const liveHooksDir = path.join(process.cwd(), 'container', 'hooks');
      const liveHookSet = new Set(
        fs.existsSync(liveHooksDir) ? fs.readdirSync(liveHooksDir).filter((f) => f.endsWith('.sh')) : [],
      );
      const isStaleRef = (cmd: string): boolean => {
        for (const m of cmd.matchAll(/\/app\/hooks\/([\w.-]+\.sh)\b/g)) {
          if (!liveHookSet.has(m[1])) return true;
        }
        return false;
      };
      for (const ev of Object.keys(settings.hooks)) {
        const entries: Array<{ matcher?: string; hooks?: Array<{ command?: string }> }> = settings.hooks[ev] ?? [];
        const seen = new Set<string>();
        const cleaned: typeof entries = [];
        for (const entry of entries) {
          const innerHooks = (entry.hooks ?? []).filter((h) => !isStaleRef(h.command ?? ''));
          if (innerHooks.length === 0) continue;
          const matcher = entry.matcher ?? '*';
          const sig = JSON.stringify([matcher, ...innerHooks.map((h) => h.command ?? '')]);
          if (seen.has(sig)) continue;
          seen.add(sig);
          cleaned.push({ ...entry, hooks: innerHooks });
        }
        settings.hooks[ev] = cleaned;
      }
    }
    // Use command-type hooks with curl --proxy '' to bypass OneCLI HTTPS_PROXY.
    // The Claude SDK pipes hook event JSON to stdin; curl reads it via $(cat).
    const hookConfig = {
      hooks: [
        {
          type: 'command',
          // X-NanoClaw-Session-Id / X-NanoClaw-Session-Thread-Id let the
          // dashboard stamp sdk_session_routes at intake without guessing.
          // The env vars are set per-container by spawnContainer, so each
          // concurrent session (root + threads) carries its own identity.
          command: `curl -sf --proxy '' -X POST ${hookUrl} -H 'Content-Type: application/json' -H 'X-Group-Folder: ${agentGroup.folder}' -H "X-NanoClaw-Session-Id: $NANOCLAW_SESSION_ID" -H "X-NanoClaw-Session-Thread-Id: $NANOCLAW_SESSION_THREAD_ID" -d @- > /dev/null 2>&1 || true`,
          timeout: 5,
        },
      ],
    };
    for (const event of [
      // Tool lifecycle
      'PreToolUse',
      'PostToolUse',
      'PostToolUseFailure',
      'PermissionRequest',
      'PermissionDenied',
      // Session lifecycle
      'SessionStart',
      'SessionEnd',
      'Stop',
      'StopFailure',
      // Turn lifecycle
      'UserPromptSubmit',
      'Notification',
      // Subagent lifecycle
      'SubagentStart',
      'SubagentStop',
      // Task lifecycle
      'TaskCreated',
      'TaskCompleted',
      // Context
      'PreCompact',
      'PostCompact',
      // Configuration
      'ConfigChange',
      'InstructionsLoaded',
      // File/directory
      'FileChanged',
      'CwdChanged',
      // Worktree
      'WorktreeCreate',
      'WorktreeRemove',
      // MCP
      'Elicitation',
      'ElicitationResult',
    ]) {
      if (!settings.hooks[event]) settings.hooks[event] = [];
      // Strip stale entries (old transport/http format)
      settings.hooks[event] = settings.hooks[event].filter(
        (h: { transport?: string; type?: string; url?: string }) =>
          !((h.transport || h.type === 'http') && h.url?.includes(hookUrl)),
      );
      // Drop ANY existing command hook for this URL, then push the current
      // hookConfig. Dedup MUST be content-aware: the previous version keyed
      // only on hookUrl presence, so when the command string changed (e.g.
      // the X-NanoClaw-Session-Id header was added) the stale command was
      // never replaced — it matched the URL and `!hasHook` stayed false
      // forever. Long-lived groups (e.g. `main`) were stranded on the old
      // headerless command, so the dashboard never stamped sdk_session_routes
      // for them and session attribution fell back to a stale heuristic.
      // Stripping + re-pushing keeps a single up-to-date hook per event and
      // self-heals any group whose settings.json predates a command change.
      settings.hooks[event] = settings.hooks[event].filter(
        (h: { hooks?: { command?: string }[] }) =>
          !h.hooks?.some((inner: { command?: string }) => inner.command?.includes(hookUrl)),
      );
      settings.hooks[event].push(hookConfig);
    }
    // Guard hook: block direct edits to CLAUDE.md — agents must edit .instructions.md instead.
    // CLAUDE.md is auto-composed from templates + .instructions.md on every container wake,
    // so direct edits are silently lost. This hook enforces the single source of truth.
    const guardCmd = `INPUT=$(cat); FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty'); if echo "$FILE" | grep -q 'CLAUDE\\.md$'; then echo "CLAUDE.md is auto-generated from templates + .instructions.md on every container start. Your edits here will be overwritten. Edit .instructions.md instead — it lives in the same directory and its contents are appended to the composed CLAUDE.md." >&2; exit 2; fi; exit 0`;
    const guardHookConfig = {
      matcher: 'Edit|Write',
      hooks: [{ type: 'command', command: guardCmd, timeout: 5 }],
    };
    if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];
    const hasGuard = settings.hooks.PreToolUse.some(
      (h: { matcher?: string; hooks?: { command?: string }[] }) =>
        h.matcher === 'Edit|Write' &&
        // Stored command contains the literal substring `CLAUDE\.md` (the
        // shell regex anchor for the .md extension) — i.e. one backslash.
        // The previous check searched for two backslashes and never matched,
        // so the guard hook was re-appended on every restart, accumulating
        // tens of thousands of duplicates that buried gate-plan +
        // gate-critique-on-deliver. The dedup pass at the top is the
        // belt-and-braces; this is the suspenders.
        h.hooks?.some((inner: { command?: string }) => inner.command?.includes('CLAUDE\\.md')),
    );
    if (!hasGuard) {
      settings.hooks.PreToolUse.push(guardHookConfig);
    }

    // Guard hook: block git remote URLs that bake in the OneCLI proxy stub
    // ($GH_TOKEN / ROUTED_VIA_ONECLI_PROXY / "placeholder" — historical name).
    // Symptom this catches: `git remote set-url origin https://x-access-token:$GH_TOKEN@…`
    // hardcodes the stub into .git/config; the OneCLI proxy only rewrites
    // Authorization headers, not URL-embedded creds, so every push then
    // fails with "Invalid username or token". Witnessed on slang-fixer
    // 2026-06-01 — see [[project_szihs_pat_path_routing]] for context.
    // The fix is to drop the auth from the URL entirely and let the proxy
    // inject by host+path match: `https://github.com/<owner>/<repo>.git`.
    const stubGuardCmd = `INPUT=$(cat); CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty'); if echo "$CMD" | grep -qE '(git +(remote +set-url|config +remote\\.[^ ]+\\.url)).*(ROUTED_VIA_ONECLI_PROXY|placeholder|\\$GH_TOKEN|\\$\\{GH_TOKEN\\})'; then echo "Refusing to bake the OneCLI proxy stub into a git remote URL. The stub (\\$GH_TOKEN=ROUTED_VIA_ONECLI_PROXY) is not a real credential — the proxy injects auth on the wire by matching host+path, not URL-embedded creds. Drop the auth from the URL: \\\`git remote set-url origin https://github.com/<owner>/<repo>.git\\\` and retry. The proxy will inject the right token for that host+path automatically." >&2; exit 2; fi; exit 0`;
    const stubGuardHookConfig = {
      matcher: 'Bash',
      hooks: [{ type: 'command', command: stubGuardCmd, timeout: 5 }],
    };
    const hasStubGuard = settings.hooks.PreToolUse.some(
      (h: { matcher?: string; hooks?: { command?: string }[] }) =>
        h.matcher === 'Bash' &&
        h.hooks?.some((inner: { command?: string }) =>
          inner.command?.includes('Refusing to bake the OneCLI proxy stub'),
        ),
    );
    if (!hasStubGuard) {
      settings.hooks.PreToolUse.push(stubGuardHookConfig);
    }

    // Overlay hook injection: enforce plan/critique gates via runtime hooks.
    // Uses resolveOverlayHookFlags() so agent_groups.disable_overlays=1 skips
    // injection entirely — matches the compose-time contract in PR #97.
    const hooksDir = path.join(process.cwd(), 'container', 'hooks');
    if (fs.existsSync(hooksDir)) {
      const { hasPlan, hasCritique } = resolveOverlayHookFlags(agentGroup);

      const hasCmd = (event: string, cmd: string): boolean =>
        (settings.hooks[event] ?? []).some((h: { hooks?: { command?: string }[] }) =>
          h.hooks?.some((i: { command?: string }) => i.command?.includes(cmd)),
        );

      if (hasPlan || hasCritique) {
        if (!settings.hooks.UserPromptSubmit) settings.hooks.UserPromptSubmit = [];
        if (!hasCmd('UserPromptSubmit', 'workflow-state-reset.sh')) {
          settings.hooks.UserPromptSubmit.push({
            hooks: [{ type: 'command', command: 'bash /app/hooks/workflow-state-reset.sh', timeout: 5 }],
          });
        }
        // Intent router: LLM-based workflow classification on each user message.
        // Builds a routing table from the manifest's workflows and passes it as
        // an env var so the hook can present options to the classifier.
        const { workflows: wfList } = resolveTypeManifest(agentGroup);
        if (wfList.length > 0 && !hasCmd('UserPromptSubmit', 'intent-router.sh')) {
          const routingTable = wfList
            .map((w) => `${w.name}:${w.description.slice(0, 60).replace(/[;:]/g, ' ')}`)
            .join(';');
          settings.hooks.UserPromptSubmit.push({
            hooks: [
              {
                type: 'command',
                command: `OVERLAY_WORKFLOWS='${routingTable}' bash /app/hooks/intent-router.sh`,
                timeout: 8,
              },
            ],
          });
        }
      }
      // Buddy hooks — wired unconditionally. Each script first-line checks
      // /workspace/agent/.overlay-buddy-monitor (materialized by
      // materializeOverlayMarkers when the buddy-monitor overlay is active
      // for this group) and exits 0 if absent. Activation flows through
      // R1 (eligibility via applies-to) × R2 (operator selects in dashboard,
      // writes agent_groups.overlays) — gated by R3 (disable_overlays=1).
      // Host code stays generic; no overlay names baked in.
      if (!hasCmd('UserPromptSubmit', 'buddy-inject.sh')) {
        if (!settings.hooks.UserPromptSubmit) settings.hooks.UserPromptSubmit = [];
        settings.hooks.UserPromptSubmit.push({
          hooks: [
            {
              type: 'command',
              command: 'bash /app/hooks/buddy-inject.sh',
              timeout: 3,
            },
          ],
        });
      }
      if (!hasCmd('PostToolUse', 'spawn-buddy.sh')) {
        if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];
        settings.hooks.PostToolUse.push({
          hooks: [
            {
              type: 'command',
              command: 'bash /app/hooks/spawn-buddy.sh',
              timeout: 3,
            },
          ],
        });
      }

      // PR auto-mapping: detect gh pr create / curl PR creation in Bash output
      // and auto-register the PR→session mapping. Fires for ALL agents.
      if (!hasCmd('PostToolUse', 'pr-auto-map.sh')) {
        if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];
        settings.hooks.PostToolUse.push({
          matcher: 'Bash',
          hooks: [{ type: 'command', command: 'bash /app/hooks/pr-auto-map.sh', timeout: 5 }],
        });
      }

      // force-codex-sandbox: reject mcp__codex__codex calls with
      // sandbox != "danger-full-access". bwrap doesn't work inside Docker
      // containers, so read-only sandbox wastes a round-trip (30% of
      // codex-critique sessions hit this). Unconditional — any agent with
      // the codex MCP tool can trigger the failure.
      if (!hasCmd('PreToolUse', 'force-codex-sandbox.sh')) {
        if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];
        settings.hooks.PreToolUse.push({
          matcher: 'mcp__codex__codex',
          hooks: [{ type: 'command', command: 'bash /app/hooks/force-codex-sandbox.sh', timeout: 5 }],
        });
      }

      if (hasPlan || hasCritique) {
        // gate-plan.sh enforces plan-required (must have a plan before
        // editing). Subagents pass through (parent's plan covers them).
        // OVERLAY_HAS_PLAN=0 disables for one-off bring-up.
        if (!hasCmd('PreToolUse', 'gate-plan.sh')) {
          settings.hooks.PreToolUse.push({
            matcher: 'Edit|Write|MultiEdit|NotebookEdit|Bash',
            hooks: [
              {
                type: 'command',
                command: `OVERLAY_HAS_PLAN=${hasPlan ? '1' : '0'} bash /app/hooks/gate-plan.sh`,
                timeout: 5,
              },
            ],
          });
        }
        // gate-chain-routing.sh refuses marked handoff/delivery direct
        // send_message calls unless in_reply_to is set (thread_id is derived
        // from it by the runtime). Always on — the hook is self-scoping (only
        // acts on a chain delivery marker), so universal wiring is correct.
        if (!hasCmd('PreToolUse', 'gate-chain-routing.sh')) {
          settings.hooks.PreToolUse.push({
            matcher: 'mcp__nanoclaw__send_message',
            hooks: [{ type: 'command', command: 'bash /app/hooks/gate-chain-routing.sh', timeout: 5 }],
          });
        }
        // gate-critique-on-deliver.sh refuses delivery markers
        // ([Fix Report]/[Resolution]/[Triage Resolution]/[Review Verdict]/[handoff])
        // and PR-create commands until /codex-critique has run at least once.
        // Symmetric opt-in: the hook itself first-line checks
        // /workspace/agent/.overlay-critique-gate and exits 0 if absent, so
        // wiring it universally is safe — coworkers without the overlay
        // see no gating at all.
        if (!hasCmd('PreToolUse', 'gate-critique-on-deliver.sh')) {
          settings.hooks.PreToolUse.push({
            matcher: 'mcp__nanoclaw__send_message|Bash',
            hooks: [{ type: 'command', command: 'bash /app/hooks/gate-critique-on-deliver.sh', timeout: 5 }],
          });
        }
        if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];
        if (!hasCmd('PostToolUse', 'plan-tracker.sh')) {
          settings.hooks.PostToolUse.push({
            matcher: 'Write',
            hooks: [{ type: 'command', command: 'bash /app/hooks/plan-tracker.sh', timeout: 5 }],
          });
        }
      }
      if (hasCritique) {
        // track-critique.sh — PostToolUse on every successful mcp__codex__codex
        // call increments critique_rounds. Filters out buddy invocations by
        // signature (the codex-CLI thread also used by buddy carries
        // "You are Buddy" or "BATCH n (" prompts).
        if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];
        if (!hasCmd('PostToolUse', 'track-critique.sh')) {
          settings.hooks.PostToolUse.push({
            matcher: 'mcp__codex__codex|mcp__codex__codex-reply',
            hooks: [{ type: 'command', command: 'bash /app/hooks/track-critique.sh', timeout: 5 }],
          });
        }
      }
      if (hasPlan || hasCritique) {
        // track-edits.sh — pure telemetry, bumps edits_since_plan and
        // edits_since_critique counters. No threshold logic; gate decisions
        // live in gate-plan.sh / gate-critique-on-deliver.sh.
        if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];
        if (!hasCmd('PostToolUse', 'track-edits.sh')) {
          settings.hooks.PostToolUse.push({
            matcher: 'Edit|Write|MultiEdit|NotebookEdit|Bash',
            hooks: [{ type: 'command', command: 'bash /app/hooks/track-edits.sh', timeout: 5 }],
          });
        }
        log.debug('Overlay hooks injected', { folder: agentGroup.folder, plan: hasPlan, critique: hasCritique });
      }
    }

    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');
  }
  // Claude state dir — only for providers using the default Claude surfaces.
  if (defaultSurfaces) {
    mounts.push({ hostPath: claudeDir, containerPath: '/home/node/.claude', readonly: false });
  }
  // container.json — nested RO mount on top of RW group dir so the agent
  // can read its config but cannot modify it.
  const containerJsonPath = path.join(groupDir, 'container.json');
  if (fs.existsSync(containerJsonPath)) {
    mounts.push({ hostPath: containerJsonPath, containerPath: '/workspace/agent/container.json', readonly: true });
  }

  // Composer-managed CLAUDE.md artifacts — nested RO mounts. These are
  // regenerated from the shared base + fragments on every spawn; any
  // agent-side writes would be clobbered, so enforce read-only. Only
  // CLAUDE.local.md (per-group memory) remains RW via the group-dir mount.
  // `.claude-shared.md` is a symlink whose target (`/app/CLAUDE.md`) is
  // already RO-mounted, so writes through it fail regardless — no need for
  // a nested mount there.
  const composedClaudeMd = path.join(groupDir, 'CLAUDE.md');
  if (defaultSurfaces && fs.existsSync(composedClaudeMd)) {
    mounts.push({ hostPath: composedClaudeMd, containerPath: '/workspace/agent/CLAUDE.md', readonly: true });
  }
  const fragmentsDir = path.join(groupDir, '.claude-fragments');
  if (defaultSurfaces && fs.existsSync(fragmentsDir)) {
    mounts.push({ hostPath: fragmentsDir, containerPath: '/workspace/agent/.claude-fragments', readonly: true });
  }

  // Shared CLAUDE.md — read-only, imported by the composed entry point via
  // the `.claude-shared.md` symlink inside the group dir.
  const sharedClaudeMd = path.join(process.cwd(), 'container', 'CLAUDE.md');
  if (defaultSurfaces && fs.existsSync(sharedClaudeMd)) {
    mounts.push({ hostPath: sharedClaudeMd, containerPath: '/app/CLAUDE.md', readonly: true });
  }

  // Per-session codex state at /home/node/.codex (sessions/, memories/, etc.).
  //
  // Mounted UNIVERSALLY — not just for the codex agent provider. Two reasons:
  //  1. Cost accounting: dashboard/server.ts:runCodexCcusage scans
  //     <sessDir>/codex/ to attribute codex usage to the producing coworker.
  //     Without the mount, container-side codex calls (mcp__codex__codex,
  //     codex-critique, buddy-call.sh) write to ephemeral /home/node/.codex
  //     which dies with the container — invisible to ccusage.
  //  2. Container-restart resilience: codex sessions persist across respawns,
  //     so `codex exec resume <id>` from buddy-call.sh works without falling
  //     back to a fresh init (PR #446's fallback stays as defense-in-depth).
  //
  // Auth.json is opportunistically copied from the host's ~/.codex (matches
  // the prior provider-only behavior). It's a per-session copy, not a host
  // mount — host's directory stays read-only from the container's view.
  const codexDir = path.join(sessDir, 'codex');
  fs.mkdirSync(codexDir, { recursive: true });
  const hostHome = process.env.HOME;
  if (hostHome) {
    const hostAuth = path.join(hostHome, '.codex', 'auth.json');
    const localAuth = path.join(codexDir, 'auth.json');
    if (fs.existsSync(hostAuth) && !fs.existsSync(localAuth)) {
      try {
        fs.copyFileSync(hostAuth, localAuth);
      } catch (err) {
        log.debug('Codex auth.json copy skipped', { err: err instanceof Error ? err.message : String(err) });
      }
    }
  }
  mounts.push({ hostPath: codexDir, containerPath: '/home/node/.codex', readonly: false });

  // Overlay hook scripts at /app/hooks (read-only — host-managed)
  const hooksMount = path.join(process.cwd(), 'container', 'hooks');
  if (fs.existsSync(hooksMount)) {
    mounts.push({ hostPath: hooksMount, containerPath: '/app/hooks', readonly: true });
  }

  // Agent-runner scripts at /app/scripts — host-managed, read-only. Carries
  // buddy-call.sh and any other sibling-process helpers that hooks invoke.
  // Separate from /app/src (per-group agent-runner code, writable) because
  // these scripts are infrastructure, not agent workspace.
  const scriptsMount = path.join(process.cwd(), 'container', 'agent-runner', 'scripts');
  if (fs.existsSync(scriptsMount)) {
    mounts.push({ hostPath: scriptsMount, containerPath: '/app/scripts', readonly: true });
  }

  // Buddy charter (read-only). buddy-call.sh reads this and prepends to
  // codex's first call. Separate mount because container/skills/buddy/
  // is otherwise a runtime skill bundle the agent could load.
  const charterPath = path.join(process.cwd(), 'container', 'skills', 'buddy', 'CHARTER.md');
  if (fs.existsSync(charterPath)) {
    mounts.push({ hostPath: charterPath, containerPath: '/app/skills/buddy/CHARTER.md', readonly: true });
  }

  // Per-group agent-runner source at /app/src (initialized once at group
  // creation, persistent thereafter — agents can modify their runner)
  const groupRunnerDir = path.join(DATA_DIR, 'v2-sessions', agentGroup.id, 'agent-runner-src');
  mounts.push({ hostPath: groupRunnerDir, containerPath: '/app/src', readonly: false });

  // Additional mounts from container config (groups/<folder>/container.json) —
  // threaded in via the param (materialized once in spawnContainer).
  if (containerConfig.additionalMounts && containerConfig.additionalMounts.length > 0) {
    const validated = validateAdditionalMounts(containerConfig.additionalMounts, agentGroup.name);
    mounts.push(...validated);
  }

  // claude-trace: mount the patched reverse-proxy build read-only at
  // /opt/claude-trace. The wrapper (CLAUDE_CODE_EXECUTABLE, set below) runs the
  // native claude binary behind claude-trace's local reverse proxy and dumps
  // per-session request/response .jsonl + .html into the child cwd
  // (/workspace/agent/.claude-trace = groups/<folder>/.claude-trace on the host).
  // Claude provider only — Codex does not go through pathToClaudeCodeExecutable.
  //
  // Source lives in the repo at container/claude-trace (tracked). It used to be
  // an untracked data/claude-trace directory hand-placed on each box, which meant
  // the feature silently did not exist anywhere it had not been copied. The
  // DATA_DIR path is still honoured as a fallback so an existing box keeps
  // working until its checkout catches up.
  if (provider === 'claude') {
    const traceDir = resolveClaudeTraceDir();
    if (traceDir) mounts.push({ hostPath: traceDir, containerPath: '/opt/claude-trace', readonly: true });
  }

  // Provider-contributed mounts (e.g. opencode-xdg)
  if (providerContribution.mounts) {
    mounts.push(...providerContribution.mounts);
  }

  return mounts;
}

/**
 * Resolve the group's skill selection to concrete names — `'all'` recomputes
 * from `container/skills/` so newly-added upstream skills appear automatically.
 */
function selectedSkillNames(containerConfig: import('./container-config.js').ContainerConfig): string[] {
  if (containerConfig.skills !== 'all') return containerConfig.skills;
  const sharedSkillsDir = path.join(process.cwd(), 'container', 'skills');
  return fs.existsSync(sharedSkillsDir)
    ? fs.readdirSync(sharedSkillsDir).filter((e) => {
        try {
          return fs.statSync(path.join(sharedSkillsDir, e)).isDirectory();
        } catch {
          return false;
        }
      })
    : [];
}

async function buildContainerArgs(
  mounts: VolumeMount[],
  containerName: string,
  agentGroup: AgentGroup,
  session: Session,
  provider: string,
  providerContribution: ProviderContainerContribution,
  agentIdentifier?: string,
  mcpProxy?: { proxyToken: string; policy: McpAllowlistResolution },
): Promise<string[]> {
  // --init injects docker's own tini as PID 1 so orphaned children (curl/gh
  // fired by the agent and hooks) get reaped. Without it, the host overrides
  // the image's tini ENTRYPOINT with `--entrypoint bash` (see below), leaving
  // `bun` as PID 1 — and bun doesn't reap, so defunct curl/gh zombies pile up
  // for the container's lifetime.
  const args: string[] = ['run', '--rm', '--init', '--name', containerName, '--label', CONTAINER_INSTALL_LABEL];

  {
    const mode = detectGpuMode();
    if (mode === 'runtime-nvidia') {
      args.push('--runtime=nvidia');
    } else if (mode === 'gpus-all') {
      args.push('--gpus', 'all');
    }
    if (mode !== 'none') {
      args.push('-e', 'NVIDIA_VISIBLE_DEVICES=all');
      args.push('-e', 'NVIDIA_DRIVER_CAPABILITIES=compute,utility,graphics');
    }
  }

  // Per-container resource caps (opt-in; empty = unbounded, today's behavior).
  // Only --memory is set. Whether that's a hard cap depends on the host having no
  // swap (a deployment concern) — on a swapless host --memory is hard and a runaway
  // is OOM-killed; we don't manage swap from here.
  if (CONTAINER_CPU_LIMIT) args.push('--cpus', CONTAINER_CPU_LIMIT);
  if (CONTAINER_MEMORY_LIMIT) args.push('--memory', CONTAINER_MEMORY_LIMIT);

  // Docker defaults /dev/shm to 64m, which silently short-writes past that size.
  // agent-browser passes --disable-dev-shm-usage, but a third-party puppeteer or
  // Playwright launcher may not.
  args.push('--shm-size=1g');

  args.push(...hardeningArgs(CONTAINER_PIDS_LIMIT));

  // Environment — only vars read by code we don't own.
  // Everything NanoClaw-specific is in container.json (read by runner at startup).
  // Per-group timezone override (migration 020) → falls back to the install
  // global; resolveGroupTimezone validates a hand-edited DB value.
  args.push('-e', `TZ=${resolveGroupTimezone(agentGroup.id)}`);
  args.push('-e', `AGENT_PROVIDER=${provider}`);
  // claude-trace: point the SDK's executable at the wrapper mounted above. Unlike
  // stock claude-trace (a require-hook, JS-only), this build stands up a local
  // reverse proxy, points the child's ANTHROPIC_BASE_URL at it, and forwards
  // upstream via the OneCLI proxy — so it works with the NATIVE ELF binary and
  // captures NVIDIA (/llm/) and Bedrock (/model/) traffic, not just anthropic.com.
  // Gated on the same directory check as the mount: no build, no env, no trace.
  if (provider === 'claude' && resolveClaudeTraceDir()) {
    args.push('-e', 'CLAUDE_CODE_EXECUTABLE=/opt/claude-trace/claude-trace-wrapper.sh');
    args.push('-e', 'CLAUDE_TRACE_DIR=/opt/claude-trace');
    // NANOCLAW_SESSION_ID is exported below (dashboard routing) and read by the
    // wrapper for per-session --log names.
  }
  // Two-DB split: container reads inbound.db, writes outbound.db
  args.push('-e', 'SESSION_INBOUND_DB_PATH=/workspace/inbound.db');
  args.push('-e', 'SESSION_OUTBOUND_DB_PATH=/workspace/outbound.db');
  args.push('-e', 'SESSION_HEARTBEAT_PATH=/workspace/.heartbeat');

  // Intent router needs the same OVERLAY_WORKFLOWS string the SDK hook gets,
  // so the agent-runner's poll-loop can run the router on follow-up pushes
  // (the SDK fires UserPromptSubmit only on the initial query; mid-query
  // query.push() does not, so the agent-runner has to invoke the hook itself).
  // Skipped when disable_overlays=1: with no intent-router hook registered
  // in settings.json, the env var would be dead weight at best and would
  // still drive intent-router-bridge.ts on follow-up pushes at worst.
  {
    const { hasPlan, hasCritique } = resolveOverlayHookFlags(agentGroup);
    if (hasPlan || hasCritique) {
      const { workflows: wfList } = resolveTypeManifest(agentGroup);
      if (wfList.length > 0) {
        const routingTable = wfList
          .map((w) => `${w.name}:${w.description.slice(0, 60).replace(/[;:]/g, ' ')}`)
          .join(';');
        args.push('-e', `OVERLAY_WORKFLOWS=${routingTable}`);
      }
    }
    // Tamper-resistant critique-gate activation: the composer already
    // materialized .overlay-critique-gate / .critique-required-stages into
    // groupDir (composeCoworkerClaudeMd, above). Read them here — before the
    // container (and the agent) exists — and pass them as env. The gate hook
    // and poll-loop treat the env as authoritative when present, so an agent
    // can no longer disable the gate by `rm .overlay-critique-gate` or weaken
    // it by rewriting .critique-required-stages: a child process cannot mutate
    // the harness's inherited environment. (workflow-state.json verdicts stay
    // agent-writable — host-side receipts are the deeper fix, tracked
    // separately.) When disable_overlays=1, hasCritique is false and no env is
    // emitted, so the gate stays off.
    if (hasCritique) {
      const gateGroupDir = path.resolve(GROUPS_DIR, agentGroup.folder);
      const active = fs.existsSync(path.join(gateGroupDir, '.overlay-critique-gate'));
      args.push('-e', `CRITIQUE_GATE_ACTIVE=${active ? '1' : '0'}`);
      if (active) {
        try {
          const stages = fs.readFileSync(path.join(gateGroupDir, '.critique-required-stages'), 'utf-8').trim();
          if (stages) args.push('-e', `CRITIQUE_REQUIRED_STAGES=${stages}`);
        } catch {
          /* no required-stages file → legacy any-1-round mode, gate still active */
        }
      }
    }
  }

  // Model + API routing + SDK tuning — forward host .env vars so the Claude
  // SDK inside the container talks to the right endpoint with the right model.
  for (const key of [
    'ANTHROPIC_MODEL',
    'ANTHROPIC_BASE_URL',
    'ANTHROPIC_DEFAULT_OPUS_MODEL',
    'ANTHROPIC_DEFAULT_SONNET_MODEL',
    'ANTHROPIC_DEFAULT_HAIKU_MODEL',
    'ENABLE_PROMPT_CACHING_1H',
    // Separate Bedrock-specific toggle read by the Claude Code SDK when
    // requests route through an aws/anthropic/bedrock-* model. All three
    // instances (lego/prod/dev) use the NVIDIA inference-api proxy with
    // bedrock models, so `ENABLE_PROMPT_CACHING_1H_BEDROCK` is the one that
    // actually takes effect; `ENABLE_PROMPT_CACHING_1H` alone is ignored on
    // the Bedrock path.
    'ENABLE_PROMPT_CACHING_1H_BEDROCK',
    'FORCE_PROMPT_CACHING_5M',
    'CLAUDE_CODE_EFFORT_LEVEL',
    'CLAUDE_CODE_AUTO_COMPACT_WINDOW',
    'CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING',
    'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS',
    'CLAUDE_CODE_FORK_SUBAGENT',
    'CODEX_HOME',
    'CODEX_BASE_URL',
    'CODEX_MODEL',
    'CODEX_MODEL_PROVIDER',
    'CODEX_REASONING_EFFORT',
  ]) {
    if (process.env[key]) args.push('-e', `${key}=${process.env[key]}`);
  }
  // Stub credentials — load-bearing for SDKs that refuse to send a request
  // without an env var, but the actual auth is injected by the OneCLI MITM
  // proxy on the wire (host-pattern-matched secrets). Naming chosen so any
  // agent inspecting the value sees "this is not a real token, do NOT bake
  // me into URLs / config / logs". Never use $GH_TOKEN as a Basic-auth
  // password — the proxy replaces the Authorization header by host+path,
  // not by URL-embedded creds. The git-remote-url-guard hook (PreToolUse on
  // Bash) catches the `git remote set-url ...$GH_TOKEN...` footgun.
  args.push('-e', 'NVIDIA_API_KEY=ROUTED_VIA_ONECLI_PROXY');
  args.push('-e', 'GH_TOKEN=ROUTED_VIA_ONECLI_PROXY');
  // git doesn't honor SSL_CERT_FILE — needs GIT_SSL_CAINFO to trust
  // the OneCLI MITM CA so `git clone/push` work through the proxy.
  args.push('-e', 'GIT_SSL_CAINFO=/tmp/onecli-combined-ca.pem');
  // pip uses REQUESTS_CA_BUNDLE / PIP_CERT rather than SSL_CERT_FILE.
  // Without these, pip inside a venv fails SSL verification through the proxy.
  args.push('-e', 'REQUESTS_CA_BUNDLE=/tmp/onecli-combined-ca.pem');
  args.push('-e', 'PIP_CERT=/tmp/onecli-combined-ca.pem');

  if (agentGroup.name) {
    args.push('-e', `NANOCLAW_ASSISTANT_NAME=${agentGroup.name}`);
  }
  args.push('-e', `NANOCLAW_AGENT_GROUP_ID=${agentGroup.id}`);
  args.push('-e', `NANOCLAW_AGENT_GROUP_NAME=${agentGroup.name}`);
  // Per-session identity — the dashboard uses these to attribute hook
  // events to the NanoClaw session that emitted them (via the
  // sdk_session_routes mapping table). Empty thread_id is fine; the
  // dashboard treats the empty string as "root session".
  args.push('-e', `NANOCLAW_SESSION_ID=${session.id}`);
  args.push('-e', `NANOCLAW_SESSION_THREAD_ID=${session.thread_id ?? ''}`);
  // Dashboard hook URL — exposed to in-container overlay scripts (buddy-
  // call.sh, dispatchResultText) so they can post overlay-emitted events
  // alongside the SDK's universal PostToolUse stream. Same URL shape the
  // universal curl hook uses; empty when DASHBOARD_PORT isn't configured
  // so call sites can no-op cleanly.
  args.push(
    '-e',
    `NANOCLAW_HOOK_URL=${DASHBOARD_PORT ? `http://host.docker.internal:${DASHBOARD_PORT}/api/hook-event` : ''}`,
  );
  args.push('-e', `NANOCLAW_GROUP_FOLDER=${agentGroup.folder}`);
  // Cap on how many pending messages reach one prompt. Accumulated context
  // (trigger=0 rows) rides along with wake-eligible rows up to this cap.
  args.push('-e', `NANOCLAW_MAX_MESSAGES_PER_PROMPT=${MAX_MESSAGES_PER_PROMPT}`);

  // Idle-end timeout override. Agents that run long builds (e.g. CMake debug
  // builds = 15-25 min) need a higher ceiling than the 600s default so the
  // poll loop doesn't kill the query mid-build. Set NANOCLAW_IDLE_END_MS in
  // the host .env to widen the window for all containers, or pass it through
  // per-agent-group config. The poll-loop clamps to a 60s floor.
  if (process.env.NANOCLAW_IDLE_END_MS) {
    args.push('-e', `NANOCLAW_IDLE_END_MS=${process.env.NANOCLAW_IDLE_END_MS}`);
  }

  // Provider-contributed env vars (e.g. XDG_DATA_HOME, OPENCODE_*, NO_PROXY).
  if (providerContribution.env) {
    for (const [key, value] of Object.entries(providerContribution.env)) {
      args.push('-e', `${key}=${value}`);
    }
  }

  // Users allowed to run admin commands (e.g. /clear) inside this container.
  // Computed at wake time: owners + global admins + admins scoped to this
  // agent group. Role changes take effect on next container spawn.
  //
  // SQL inlined to keep core independent of the permissions module — we
  // guard on the `user_roles` table directly. If the permissions module
  // isn't installed, the table doesn't exist and the set stays empty; the
  // formatter treats an empty admin set as permissionless mode (every
  // sender is admin).
  const adminUserIds = new Set<string>();
  if (hasTable(getDb(), 'user_roles')) {
    const db = getDb();
    const owners = db
      .prepare("SELECT user_id FROM user_roles WHERE role = 'owner' AND agent_group_id IS NULL")
      .all() as Array<{ user_id: string }>;
    const globalAdmins = db
      .prepare("SELECT user_id FROM user_roles WHERE role = 'admin' AND agent_group_id IS NULL")
      .all() as Array<{ user_id: string }>;
    const scopedAdmins = db
      .prepare("SELECT user_id FROM user_roles WHERE role = 'admin' AND agent_group_id = ?")
      .all(agentGroup.id) as Array<{ user_id: string }>;
    for (const r of owners) adminUserIds.add(r.user_id);
    for (const r of globalAdmins) adminUserIds.add(r.user_id);
    for (const r of scopedAdmins) adminUserIds.add(r.user_id);
  }
  if (adminUserIds.size > 0) {
    args.push('-e', `NANOCLAW_ADMIN_USER_IDS=${Array.from(adminUserIds).join(',')}`);
  }

  // Bypass proxy for host-local traffic (dashboard hooks, MCP proxy) only.
  // NOTE: discord.com must NOT be bypassed. The container-side slang-mcp
  // Discord tools never receive DISCORD_BOT_TOKEN via env (it's not in the
  // slang-mcp envInherit allowlist), so they authenticate exclusively via
  // the REST-over-OneCLI-proxy path, which depends on the proxy injecting
  // `Authorization: Bot {token}` on the wire (host-pattern discord.com).
  // Listing discord.com here routes that traffic around the proxy → no
  // token is injected → Discord returns 401 credential_not_found. The
  // host-side Discord channel adapter is unaffected (it runs on the host
  // with the token from .env, not through this container env).
  args.push('-e', 'NO_PROXY=host.docker.internal,localhost,127.0.0.1');
  args.push('-e', 'no_proxy=host.docker.internal,localhost,127.0.0.1');

  // Egress lockdown when enabled — throws if it can't be established, aborting
  // the spawn rather than running with open egress. Otherwise the host gateway.
  if (ensureEgressNetwork()) {
    args.push(...egressNetworkArgs());
    log.info('Egress lockdown active', { containerName, network: EGRESS_NETWORK });
  } else {
    args.push(...hostGatewayArgs());
  }

  // User mapping
  const hostUid = process.getuid?.();
  const hostGid = process.getgid?.();
  if (hostUid != null && hostUid !== 0 && hostUid !== 1000) {
    args.push('--user', `${hostUid}:${hostGid}`);
    args.push('-e', 'HOME=/home/node');
  }

  // Volume mounts
  for (const mount of mounts) {
    if (mount.readonly) {
      args.push(...readonlyMountArgs(mount.hostPath, mount.containerPath));
    } else {
      args.push('-v', `${mount.hostPath}:${mount.containerPath}`);
    }
  }

  // OneCLI gateway — injects HTTPS_PROXY + certs so container API calls
  // are routed through the agent vault for credential injection.
  // Must ensureAgent first for non-admin groups, otherwise applyContainerConfig
  // rejects the unknown agent identifier and returns false.
  //
  // MUST run AFTER the volume-mounts loop: applyContainerConfig appends
  // credential-stub mounts (e.g. the codex auth.json sentinel nested INSIDE
  // our RW /home/node/.codex mount). Docker applies binds in argument order,
  // so the stub must land after its parent mount or the parent shadows it and
  // the agent silently degrades to loginless auth. Guarded structurally by the
  // ordering-invariant test in container-runner.test.ts.
  try {
    if (agentIdentifier) {
      await onecli.ensureAgent({ name: agentGroup.name, identifier: agentIdentifier });
    }
    // Snapshot the shared CA files before applyContainerConfig overwrites them —
    // another instance's running containers may mount these paths.
    const sharedCaPath = path.join('/tmp', 'onecli-proxy-ca.pem');
    const sharedCombinedPath = path.join('/tmp', 'onecli-combined-ca.pem');
    let savedCa: Buffer | null = null;
    let savedCombined: Buffer | null = null;
    try {
      savedCa = fs.readFileSync(sharedCaPath);
    } catch {}
    try {
      savedCombined = fs.readFileSync(sharedCombinedPath);
    } catch {}

    const onecliApplied = await onecli.applyContainerConfig(args, { addHostMapping: false, agent: agentIdentifier });
    if (onecliApplied) {
      // The SDK writes to shared /tmp/onecli-{proxy,combined}-ca.pem. When
      // multiple instances use different OneCLI vaults, the last writer wins.
      // Copy our CA to instance-specific paths, rewrite docker -v args to
      // mount those, then restore the original shared files for other instances.
      const caPrefix = `onecli-${CONTAINER_PREFIX}`;
      const instanceCaPath = path.join('/tmp', `${caPrefix}-proxy-ca.pem`);
      const instanceCombinedPath = path.join('/tmp', `${caPrefix}-combined-ca.pem`);
      try {
        if (fs.existsSync(sharedCaPath)) fs.copyFileSync(sharedCaPath, instanceCaPath);
        if (fs.existsSync(sharedCombinedPath)) fs.copyFileSync(sharedCombinedPath, instanceCombinedPath);
        // Restore the original shared files for other instances
        if (savedCa) fs.writeFileSync(sharedCaPath, savedCa);
        if (savedCombined) fs.writeFileSync(sharedCombinedPath, savedCombined);
        // Only rewrite -v host:container mount sources, not -e env values.
        // The container-side paths (/tmp/onecli-gateway-ca.pem, /tmp/onecli-combined-ca.pem)
        // must stay unchanged — only the host-side source path changes.
        for (let i = 0; i < args.length; i++) {
          if (args[i] === '-v' && typeof args[i + 1] === 'string') {
            args[i + 1] = args[i + 1]
              .replace(`${sharedCaPath}:`, `${instanceCaPath}:`)
              .replace(`${sharedCombinedPath}:`, `${instanceCombinedPath}:`);
          }
        }
      } catch {}
      log.info('OneCLI gateway applied', { containerName });
    } else {
      log.warn('OneCLI gateway not applied — container will have no credentials', { containerName });
    }
  } catch (err) {
    log.warn('OneCLI gateway error — container will have no credentials', { containerName, err });
  }

  // MCP servers: type-level (from coworker registry) + per-instance (from container.json).
  // Per-instance overrides type-level per server name.
  const typeMcpServers = resolveTypeManifest(agentGroup).mcpServers;
  const containerConfig = materializeContainerJson(agentGroup.id);
  const mergedMcpServers = { ...typeMcpServers, ...containerConfig.mcpServers };
  // Withhold the wiring for any server the policy allows no tool on. These
  // entries are direct (stdio/http) servers that never traverse the host MCP
  // proxy, so the proxy's ACL cannot restrict them — the only host-side
  // control is not handing them over. It is also the strongest one: a server
  // that was never wired needs no deny list to be complete, and its `env`
  // block (which can carry credentials) never enters the container at all.
  const wiredMcpServers = mcpProxy
    ? Object.fromEntries(
        Object.entries(mergedMcpServers).filter(([name]) => serverHasAllowedTools(mcpProxy.policy, name)),
      )
    : mergedMcpServers;
  const withheld = Object.keys(mergedMcpServers).filter((n) => !(n in wiredMcpServers));
  if (withheld.length > 0) {
    log.info('Withholding MCP servers with no allowed tools', {
      containerName,
      withheld,
      restricts: mcpProxy?.policy.restricts,
    });
  }
  if (Object.keys(wiredMcpServers).length > 0) {
    args.push('-e', `NANOCLAW_MCP_SERVERS=${JSON.stringify(wiredMcpServers)}`);
  }

  // MCP proxy token + URL + allowed tools — enables containers to reach host MCP servers
  if (mcpProxy) {
    args.push('-e', `MCP_PROXY_TOKEN=${mcpProxy.proxyToken}`);
    args.push('-e', `MCP_PROXY_URL=http://host.docker.internal:${MCP_PROXY_PORT}`);

    // ALWAYS passed, whatever the list length. This is the whole fix for the
    // empty-list hole: the container decides what to wire and what to allow
    // from the policy STATE, and it reads a missing variable as `unresolved`
    // (deny all configurable MCP). Previously both variables below were
    // omitted when the list was empty, which the container read as "no
    // restrictions requested" — so `--tools '[]'` handed over the full direct
    // tool surface (`mcp__nanoclaw__*`, `mcp__codex__*`), none of which
    // traverses the proxy that was doing the actual restricting.
    args.push('-e', `NANOCLAW_MCP_POLICY=${JSON.stringify(toMcpPolicyWire(mcpProxy.policy))}`);

    // Legacy variables, still emitted for the SDK disallowedTools backstop and
    // for the proxy-server auto-discovery path in the agent-runner. They are
    // no longer the policy — `NANOCLAW_MCP_POLICY` is.
    args.push('-e', `NANOCLAW_ALLOWED_MCP_TOOLS=${JSON.stringify(mcpProxy.policy.externalTools)}`);
    // claude.ts::computeBlockedTools builds the disallowedTools list as
    // (inventory − allowed). Pass the discovered inventory so the SDK-level
    // block covers proxied servers by name as well as by policy.
    const inventory = getDiscoveredToolInventory();
    if (Object.keys(inventory).length > 0) {
      args.push('-e', `NANOCLAW_MCP_TOOL_INVENTORY=${JSON.stringify(inventory)}`);
    }
  }

  // Dashboard URL
  if (DASHBOARD_PORT) {
    args.push('-e', `DASHBOARD_URL=http://host.docker.internal:${DASHBOARD_PORT}`);
  }

  // Override entrypoint: run v2 entry point directly via Bun (no tsc, no stdin).
  // The image's ENTRYPOINT (tini → entrypoint.sh) handles the stdin-piped
  // invocation path; the host-spawned sessions don't need stdin because all
  // IO flows through the mounted session DBs.
  args.push('--entrypoint', 'bash');

  // Use per-agent-group image if one has been built, otherwise base image
  const imageTag = containerConfig.imageTag || CONTAINER_IMAGE;
  args.push(imageTag);

  // Codex CLI needs the full [model_providers.<provider>] block in a real
  // config.toml — `-c` overrides reliably modify existing fields but don't
  // always *define* new TOML sections. Generate a minimal config from
  // container env vars in the entrypoint, then exec the agent-runner.
  // Auth still flows through OneCLI MITM via env_key=NVIDIA_API_KEY.
  // Note: heredoc delimiter is UNquoted (TOML_EOF, not 'TOML_EOF') so bash
  // expands the ${VAR:-default} references at container start.
  args.push(
    '-c',
    `git config --global "url.https://x-access-token:placeholder@github.com/.insteadOf" "https://github.com/" 2>/dev/null || true
mkdir -p ~/.codex && cat > ~/.codex/config.toml <<TOML_EOF
model_provider = "\${CODEX_MODEL_PROVIDER:-nvinference}"
model = "\${CODEX_MODEL:-openai/openai/gpt-5.5}"
model_reasoning_effort = "\${CODEX_REASONING_EFFORT:-xhigh}"
# Docker is the sandbox; codex's bwrap wrapper is redundant nesting and fails
# with "No permissions to create a new namespace" because Docker's default
# seccomp profile blocks unshare(CLONE_NEWUSER). Skip codex's sandbox and
# rely on the container boundary.
sandbox_mode = "danger-full-access"

[features]
use_linux_sandbox_bwrap = false
hooks = true

[model_providers.\${CODEX_MODEL_PROVIDER:-nvinference}]
name = "\${CODEX_MODEL_PROVIDER:-nvinference}"
wire_api = "\${CODEX_WIRE_API:-responses}"
base_url = "\${CODEX_BASE_URL:-https://inference-api.nvidia.com/v1}"
env_key = "NVIDIA_API_KEY"

[projects."/workspace/agent"]
trust_level = "trusted"
TOML_EOF
# NOTE: hooks are deliberately NOT written here any more. They used to be
# emitted as ~/.codex/hooks.json, which lands in Codex's USER config layer —
# where every command hook needs per-hook, content-hash trust before it may
# fire, and an untrusted one is skipped SILENTLY. Containers are --rm, so that
# trust never exists and the hooks were a permanent no-op: the dashboard simply
# showed no events for Codex groups. They now ship in the MANAGED layer as
# /etc/codex/requirements.toml, baked into the image from container/
# codex-hooks.toml, which reports trustStatus "managed". Do not reintroduce a
# hooks.json here — with allow_managed_hooks_only it is ignored, and without it
# it reappears as a duplicate hooks/list entry per event.
exec bun run /app/src/index.ts`,
  );

  return args;
}

const execAsync = promisify(exec);

/** Build a per-agent-group Docker image with custom packages. */
export async function buildAgentGroupImage(agentGroupId: string): Promise<void> {
  const agentGroup = getAgentGroup(agentGroupId);
  if (!agentGroup) throw new Error('Agent group not found');

  const containerConfig = materializeContainerJson(agentGroup.id);
  const aptPackages = containerConfig.packages.apt;
  const npmPackages = containerConfig.packages.npm;

  if (aptPackages.length === 0 && npmPackages.length === 0) {
    throw new Error('No packages to install. Use install_packages first.');
  }

  // Which bytes this is built on. Recorded on the derived image so an operator
  // can tell which base a group's packages were layered onto — the image id
  // rather than a RepoDigest, because a locally built base has no RepoDigest at
  // all and an id is unambiguous either way.
  let baseId = '';
  try {
    const { stdout } = await execAsync(`${CONTAINER_RUNTIME_BIN} image inspect --format '{{.Id}}' ${CONTAINER_IMAGE}`);
    baseId = stdout.trim();
  } catch {
    // Non-fatal: the build below fails on its own if the base is really absent.
  }

  let dockerfile = `FROM ${CONTAINER_IMAGE}\nUSER root\n`;
  if (aptPackages.length > 0) {
    dockerfile += `RUN apt-get update && apt-get install -y ${aptPackages.join(' ')} && rm -rf /var/lib/apt/lists/*\n`;
  }
  if (npmPackages.length > 0) {
    // pnpm skips build scripts unless packages are allowlisted. Append each
    // to /root/.npmrc (base image sets it up for agent-browser) so packages
    // with postinstall — e.g. playwright, puppeteer, native addons — don't
    // install silently broken.
    const allowlist = npmPackages.map((p) => `echo 'only-built-dependencies[]=${p}' >> /root/.npmrc`).join(' && ');
    dockerfile += `RUN ${allowlist} && pnpm install -g ${npmPackages.join(' ')}\n`;
  }
  dockerfile += 'USER node\n';

  // Overwrite the provenance label rather than letting it be inherited.
  //
  // `dev.nanoclaw.image-source` is documented as the one claim a retag cannot
  // forge, and --status treats it as the trustworthy answer. But a derived
  // build inherits the base's labels, so without this a group that has just
  // added arbitrary apt/npm packages would keep asserting `hardened` — the
  // vendor's claim, over bytes the vendor never saw. `derived` is the honest
  // answer, and `derived-from` says what it was layered onto.
  dockerfile += 'LABEL dev.nanoclaw.image-source="derived"\n';
  if (baseId) dockerfile += `LABEL dev.nanoclaw.derived-from="${baseId}"\n`;

  const imageTag = `${CONTAINER_IMAGE_BASE}:${agentGroupId}`;

  log.info('Building per-agent-group image', { agentGroupId, imageTag, apt: aptPackages, npm: npmPackages });

  // Write Dockerfile to temp file and build
  const tmpDockerfile = path.join(DATA_DIR, `Dockerfile.${agentGroupId}`);
  fs.writeFileSync(tmpDockerfile, dockerfile);
  try {
    // Awaited async exec so the single-threaded host stays responsive during
    // the build (can take minutes) instead of blocking on execSync. exec buffers
    // stdout/stderr (matching the old stdio: 'pipe') and rejects on a non-zero
    // exit, so error propagation is unchanged.
    // --pull=false: the FROM tag is a local-only base image (built by
    // ./container/build.sh, never pushed to a registry). Without this flag,
    // buildkit may attempt a registry pull and fail with "pull access
    // denied". Observed in slang#11004 fixer's install_packages call.
    // Note: --pull is a boolean flag in docker buildx — `--pull=never` is
    // INVALID and fails with "strconv.ParseBool: parsing 'never'". Use
    // `--pull=false` (or omit; default is false).
    await execAsync(`${CONTAINER_RUNTIME_BIN} build --pull=false -t ${imageTag} -f ${tmpDockerfile} .`, {
      cwd: DATA_DIR,
      timeout: 900_000,
    });
  } finally {
    fs.unlinkSync(tmpDockerfile);
  }

  // Store the image tag in groups/<folder>/container.json
  containerConfig.imageTag = imageTag;
  updateContainerConfigScalars(agentGroup.id, { image_tag: containerConfig.imageTag });

  log.info('Per-agent-group image built', { agentGroupId, imageTag });
}
