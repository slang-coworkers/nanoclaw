/**
 * Container Runner v2
 *
 * Composes a fully-resolved `SessionSpec` for each session and hands it to the
 * selected `SessionDriver`. Everything runtime-specific — argv, kill/stop,
 * orphan listing — lives behind the driver seam in `src/drivers/`. What stays
 * here is composition and lifecycle policy: which mounts, which env, restart
 * ordering, exit bookkeeping.
 */
import { exec } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

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
  CONTAINER_MEMORY_LIMIT,
  CONTAINER_PIDS_LIMIT,
  CONTAINER_PREFIX,
  DASHBOARD_PORT,
  DATA_DIR,
  GROUPS_DIR,
  IDLE_TIMEOUT,
  INSTALL_SLUG,
  MAX_MESSAGES_PER_PROMPT,
  MCP_PROXY_PORT,
  TIMEZONE,
} from './config.js';
// resolveGroupTimezone: the fork's per-group timezone override (migration 020)
// grounds the container's TZ, falling back to the install global.
import { CONTAINER_PLUGINS_DIR, materializeContainerJson, resolveGroupTimezone } from './container-config.js';
import { getContainerConfig, updateContainerConfigScalars } from './db/container-configs.js';
// Only the binary name survives here: spawn argv, mounts, kill/stop and orphan
// reaping now live behind the driver seam (hostGatewayArgs → the driver-private
// networkArgsFor, readonlyMountArgs → MountSpec + mountArgs, stopContainer →
// SessionHandle.stop()).
import { CONTAINER_RUNTIME_BIN } from './container-runtime.js';
import { getAgentGroup } from './db/agent-groups.js';
import { getDb, hasTable } from './db/connection.js';
import { getSession } from './db/sessions.js';
import { getSessionDriver, isSessionEventsDriver } from './drivers/index.js';
import type { SupervisedHandle, SupervisedSnapshot } from './drivers/session-events.js';
import { GROUP_FOLDER_LABEL, labelValueLegal, specInvalid } from './drivers/types.js';
import type { ContainerSpec, MountSpec, SessionFailure, SessionSpec } from './drivers/types.js';
import { getGatewayProvider, type GatewayContribution } from './gateway-providers/index.js';
import { initGroupFilesystem } from './group-init.js';
import { getAgentMailbox } from './mailbox/index.js';
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
  sessionContextPath,
  sessionDir,
  writeSessionContext,
  writeSessionRouting,
} from './session-manager.js';
import type { AgentGroup, Session } from './types.js';

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

// GPU passthrough moved to the driver seam (src/drivers/index.ts's
// driver-private `hostDeviceArgs` lane): whether this host has an NVIDIA
// runtime is a property of the host, not of the session, so it never rides
// the composed spec.

/**
 * Docker defaults /dev/shm to 64m, which silently short-writes past that size.
 * agent-browser passes --disable-dev-shm-usage, but a third-party puppeteer or
 * Playwright launcher may not.
 */
const SHM_SIZE_MB = 1024;
/** Grace before SIGKILL. One second, as `docker stop -t 1` has always been. */
const STOP_GRACE_SECONDS = 1;

/** Active sessions tracked by session ID. */
interface ActiveSessionRuntime {
  /**
   * The realized session. Was `process: ChildProcess` — a session that is not
   * a child process of the host could not be represented at all, and that
   * single field was what made every runtime other than a locally-spawned
   * docker CLI inexpressible.
   */
  handle: SupervisedHandle;
  containerName: string;
  /**
   * When this host started tracking the runtime. Backs the sweep's ceiling
   * check when no heartbeat file exists yet (see `host-sweep.ts`): a container
   * that finishes its turn without ever reaching an SDK event never writes one,
   * and without this it would sit alive-but-idle forever, immune to the check.
   * An adopted runtime records the adoption, which is the honest answer — this
   * host has no spawn time for a container a previous host started, and leaving
   * it unset would exempt every adopted session from the ceiling.
   */
  startedAtMs: number;
  /** True when this runtime was adopted at startup rather than spawned here. */
  adopted: boolean;
  exitCallbacks: Array<() => void>;
  finished: boolean;
  finishedPromise: Promise<void>;
  resolveFinished: () => void;
  stopReason?: string;
}

const activeContainers = new Map<string, ActiveSessionRuntime>();

/** SHA-256 hash of CLAUDE.md at spawn time, keyed by session ID. */
const spawnedClaudeMdHash = new Map<string, string>();

/**
 * In-flight wake promises, keyed by session id. Deduplicates concurrent
 * `wakeContainer` calls while the first spawn is still mid-setup — otherwise a
 * second wake in that window passes the `activeContainers.has` check and spawns
 * a duplicate container against the same session directory, producing racy
 * double-replies.
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
async function composeCoworkerClaudeMd(agentGroup: AgentGroup): Promise<void> {
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
        cliScope: ((await getContainerConfig(agentGroup.id))?.cli_scope ?? 'group') as 'disabled' | 'group' | 'global',
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
      cliScope: ((await getContainerConfig(agentGroup.id))?.cli_scope ?? 'group') as 'disabled' | 'group' | 'global',
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

export function getContainerStartedAtMs(sessionId: string): number | undefined {
  return activeContainers.get(sessionId)?.startedAtMs;
}

/**
 * Wake up a container for a session. If already running or mid-spawn, no-op
 * (the in-flight wake promise is reused).
 *
 * The container runs the v2 agent-runner which polls the session DB.
 *
 * Contract: never throws. Returns `true` if the container is (or becomes)
 * running, `false` on a skipped wake (closed session or paused agent group) or
 * a transient spawn failure (e.g. the container runtime / OneCLI gateway is
 * unreachable). Callers don't need to wrap — the inbound row stays pending and
 * host-sweep retries on its next tick — but callers that care (e.g. a typing
 * indicator) can branch on it.
 */
export function wakeContainer(session: Session): Promise<boolean> {
  if (activeContainers.has(session.id)) {
    log.debug('Container already running', { sessionId: session.id });
    return Promise.resolve(true);
  }
  const existing = wakePromises.get(session.id);
  if (existing) {
    log.debug('Container wake already in-flight — joining existing promise', { sessionId: session.id });
    return existing;
  }
  const promise = wakeGuarded(session).finally(() => {
    wakePromises.delete(session.id);
  });
  wakePromises.set(session.id, promise);
  return promise;
}

/**
 * The wake's async body: the closed/paused gates plus the spawn.
 *
 * Split out of `wakeContainer` so the in-flight promise is registered
 * SYNCHRONOUSLY. Both gates now read the central DB asynchronously, and running
 * them before the dedup check would give two concurrent wakes an interleaving
 * point between the check and the registration — both would miss the other and
 * spawn a container for the same session.
 */
async function wakeGuarded(session: Session): Promise<boolean> {
  // Never respawn a session that has been closed (e.g. admin clicked Stop on a
  // runaway card). The approval response-handler fires wakeContainer after
  // every card response, and the sweep can race; re-read the authoritative
  // status here so a Stop is final. getActiveSessions already filters the
  // sweep, but this guards the direct-wake paths too.
  const current = await getSession(session.id);
  if (current && current.status === 'closed') {
    log.debug('Skipping wake of closed session', { sessionId: session.id });
    return false;
  }
  // Operator kill switch. This is THE choke point every wake path funnels
  // through — router @mention fanout (via delivery), agent-to-agent /
  // host-direct delivery, the 60s host-sweep's due-message wake, scheduled-task
  // fires, and container-restart all call wakeContainer, and spawnContainer has
  // no other caller. A per-wiring pause was proven insufficient on
  // slang-coworkers prod (2026-08-13): the a2a and sweep paths never consult
  // wirings, so a wiring-paused approver kept spawning. Gating the spawn itself
  // is the only pause all four honour. Messages keep accumulating in the
  // session DB; unpausing (paused=0) lets the next sweep pick them up — no work
  // is lost, the group just stops burning tokens.
  const group = await getAgentGroup(session.agent_group_id);
  if (group?.paused) {
    log.info('Skipping wake — agent group is paused', {
      sessionId: session.id,
      agentGroupId: session.agent_group_id,
    });
    return false;
  }
  try {
    await spawnContainer(session);
    return true;
    // eslint-disable-next-line no-catch-all/no-catch-all -- wakeContainer's contract is never-throws
  } catch (err) {
    log.warn('wakeContainer failed — host-sweep will retry', { sessionId: session.id, err });
    return false;
  }
}

async function spawnContainer(session: Session): Promise<void> {
  const agentGroup = await getAgentGroup(session.agent_group_id);
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
  await composeCoworkerClaudeMd(agentGroup);

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
  if (await hasTable(getDb(), 'agent_destinations')) {
    const { writeDestinations } = await import('./modules/agent-to-agent/write-destinations.js');
    await writeDestinations(agentGroup.id, session.id);
  }
  await writeSessionRouting(agentGroup.id, session.id);
  const mailboxKey = { agentGroupId: agentGroup.id, sessionId: session.id };
  const mailbox = getAgentMailbox();
  writeSessionContext(agentGroup.id, session.id, await mailbox.runnerContext(mailboxKey));

  // Materialize container.json from DB — writes fresh file and returns
  // the config object, threaded through provider resolution, buildMounts,
  // and buildContainerArgs so we don't re-read.
  const containerConfig = await materializeContainerJson(agentGroup.id);

  const providerName = resolveProviderName(session.agent_provider, containerConfig.provider);
  await initGroupFilesystem(agentGroup, { provider: providerName });

  // Resolve the effective provider + any host-side contribution it declares
  // (extra mounts, env passthrough). Computed once and threaded through both
  // buildMounts and buildContainerArgs so side effects (mkdir, etc.) fire once.
  const { provider, contribution } = await resolveProviderContribution(session, agentGroup, containerConfig);

  const mounts = await buildMounts(agentGroup, session, containerConfig, provider, contribution);
  // Container name embeds the NanoClaw session id tail so the dashboard can
  // route shell-exec requests to the right container when a coworker has
  // multiple live sessions (root + thread sessions). Without the tail, every
  // container for a folder collapsed into one namespace and shell-exec landed
  // in an arbitrary session. Timestamp keeps rapid respawns unique.
  const containerName = `${CONTAINER_PREFIX}-${agentGroup.folder}-${containerSessionTail(session.id)}-${Date.now()}`;
  // OneCLI agent identifier is always the agent group id — stable across
  // sessions and reversible via getAgentGroup() for approval routing.
  const agentIdentifier = agentGroup.id;
  const mailboxEnvironment = await mailbox.runnerEnvironment(mailboxKey);

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

  const driver = getSessionDriver();
  // The gateway's per-session contribution — typed env and mounts (and, on a
  // driver that manages them, auxiliary containers), merged into the spec
  // BEFORE validation so admission sees the whole session. Fail-closed exactly
  // as the old wiring was: contribute() throwing aborts the spawn, the inbound
  // row stays pending, and the sweep retries. Network selection is NOT here —
  // topology is driver-private (see `drivers/index.ts`).
  const gateway = await getGatewayProvider().contribute({
    key: { installSlug: INSTALL_SLUG, agentGroupId: agentGroup.id, sessionId: session.id },
    groupName: agentGroup.name,
    capabilities: driver.capabilities(),
  });
  if (gateway.containers?.length && !driver.capabilities().auxiliaryContainers) {
    // Named at composition, where the error can say which side to change —
    // not left for the driver's refusal backstop to discover.
    throw specInvalid(
      `gateway provider composed auxiliary containers, but driver '${driver.kind}' does not manage them ` +
        `(capabilities().auxiliaryContainers is false)`,
    );
  }

  const spec = await composeSessionSpec({
    agentGroup,
    session,
    containerName,
    mounts,
    containerConfig,
    contribution,
    gateway,
    mailboxEnvironment,
    provider,
    agentIdentifier,
    mcpProxy: { proxyToken, policy: mcpPolicy },
  });

  log.info('Spawning session', {
    sessionId: session.id,
    agentGroup: agentGroup.name,
    containerName,
    mcpPolicyState: mcpPolicy.state,
    mcpExternalToolCount: mcpPolicy.externalTools.length,
    hasProxyToken: !!proxyToken,
  });

  // Clear any orphan heartbeat from a previous container instance — the sweep's
  // ceiling check treats a missing file as "fresh spawn, give grace". Without
  // this, the stale mtime can trigger an immediate kill before the new container
  // touches the file itself.
  fs.rmSync(heartbeatPath(agentGroup.id, session.id), { force: true });

  const handle = await driver.prepare(spec);

  const runtime = registerRuntime(session.id, handle, containerName, false);

  // The per-group container log tee and the stderr tail both moved into the
  // driver: DockerHandle.start() runs `start --attach`, logs every stderr line
  // at debug, keeps the same 10-line tail, and surfaces it at warn on a
  // non-zero exit (docker-driver.ts). There is no ChildProcess here to pipe
  // any more, so re-teeing would mean a second attach on the same container.

  // No host-side idle timeout. Stale/stuck detection is driven by the host
  // sweep reading heartbeat mtime + processing_ack claim age + container_state
  // (see src/host-sweep.ts). This avoids killing long-running legitimate work
  // on a wall-clock timer.

  // Fork bookkeeping the driver does not own: the MCP proxy token this spawn
  // registered, and the composed-CLAUDE.md hash the stale-check compares
  // against. Registered as an exit callback so it runs on every terminal path
  // (clean exit, boot failure, host-requested stop) exactly once — `finish`
  // drains exitCallbacks after marking the session stopped.
  runtime.exitCallbacks.push(() => {
    revokeContainerToken(proxyToken);
    spawnedClaudeMdHash.delete(session.id);
  });

  try {
    await armSessionLifecycle({
      handle,
      onTerminal: (failure) => {
        void finishAndResolve(session.id, failure);
      },
      afterStart: () => {
        return markContainerRunning(session.id);
      },
    });
  } catch (err) {
    if (activeContainers.get(session.id) === runtime && !runtime.finished) {
      activeContainers.delete(session.id);
      runtime.resolveFinished();
    } else {
      await runtime.finishedPromise;
    }
    throw err;
  }
}

/**
 * Wire a session's lifecycle in the one order that is safe, as executable code
 * rather than as a comment a refactor can silently invert.
 *
 * Terminal handling is armed before the session starts, so a failure that lands
 * during startup finds a runtime that already knows how to finalize. If
 * `start()` throws, the post-start bookkeeping never runs — there is nothing
 * running for it to record.
 */
export async function armSessionLifecycle(deps: {
  handle: Pick<SupervisedHandle, 'onTerminal' | 'start'>;
  onTerminal: (failure?: SessionFailure) => void;
  afterStart?: () => void | Promise<void>;
}): Promise<void> {
  deps.handle.onTerminal(deps.onTerminal);
  await deps.handle.start();
  await deps.afterStart?.();
}

function registerRuntime(
  sessionId: string,
  handle: SupervisedHandle,
  containerName: string,
  adopted: boolean,
): ActiveSessionRuntime {
  let resolveFinished!: () => void;
  const finishedPromise = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });
  const runtime: ActiveSessionRuntime = {
    handle,
    containerName,
    startedAtMs: Date.now(),
    adopted,
    exitCallbacks: [],
    finished: false,
    finishedPromise,
    resolveFinished,
  };
  activeContainers.set(sessionId, runtime);
  return runtime;
}

/** Single-shot finalization: only the first terminal event resolves shutdown. */
async function finishAndResolve(sessionId: string, failure?: SessionFailure): Promise<void> {
  const runtime = activeContainers.get(sessionId);
  if (!runtime || runtime.finished) return;
  runtime.finished = true;
  try {
    await finish(sessionId, runtime, failure);
  } finally {
    runtime.resolveFinished();
  }
}

async function finish(sessionId: string, runtime: ActiveSessionRuntime, failure?: SessionFailure): Promise<void> {
  const { containerName } = runtime;
  try {
    await markContainerStopped(sessionId);
  } catch (err) {
    log.error('Failed to record stopped container', { sessionId, containerName, err });
  }
  try {
    stopTypingRefresh(sessionId);
  } catch (err) {
    log.error('Failed to stop typing refresh', { sessionId, containerName, err });
  }

  if (failure && failure.kind !== 'started-then-died') {
    log.error('Session failed', { sessionId, containerName, kind: failure.kind, retryable: failure.retryable });
  } else {
    log.info('Session ended', {
      sessionId,
      containerName,
      exitCode: failure && failure.kind === 'started-then-died' ? failure.exitCode : undefined,
    });
  }

  if (activeContainers.get(sessionId) === runtime) {
    activeContainers.delete(sessionId);
  }
  for (const callback of runtime.exitCallbacks) {
    try {
      callback();
    } catch (err) {
      log.error('Container exit callback failed', { sessionId, containerName, err });
    }
  }
}

/** Kill a container for a session. */
export function killContainer(sessionId: string, reason: string, onExit?: () => void): void {
  const entry = activeContainers.get(sessionId);
  if (!entry) return;

  // Upstream's exitCallbacks array replaces the fork's
  // `entry.process.once('exit', ...)`: there is no ChildProcess here any more,
  // and `finish` drains these on EVERY terminal path with its own try/catch
  // per callback (so a throwing callback no longer loses the rest).
  if (onExit) {
    entry.exitCallbacks.push(onExit);
  }

  entry.stopReason = reason;
  log.info('Killing container', { sessionId, reason, containerName: entry.containerName });
  void entry.handle.stop(reason).then(
    () => {
      // A handle whose supervision channel is gone (an adopted handle whose
      // attach process belonged to the previous host) would otherwise never
      // finalize, and the session would stay in the registry forever.
      if (!entry.finished) void finishAndResolve(sessionId, undefined);
    },
    (err: unknown) => {
      log.error('Failed to stop session', { sessionId, reason, err });
      if (!entry.finished) void finishAndResolve(sessionId, undefined);
    },
  );
}

/**
 * Startup reconciliation: adopt what is still alive, stop what is not ours.
 *
 * This replaces the old reap-everything `cleanupOrphans()`. A surviving session
 * used to be destroyed on every host restart and its work recovered only
 * through the DB; now the host re-registers it and delivery resumes. The OneCLI
 * gateway resolves credentials per request on the host side, so an adopted
 * session's egress keeps working without any per-process state to rebuild.
 */
export async function adoptRunningSessions(): Promise<{ adopted: number; stopped: number }> {
  const driver = getSessionDriver();
  let snapshots: SupervisedSnapshot[];
  try {
    snapshots = await driver.listSessions(INSTALL_SLUG);
  } catch (err) {
    log.warn('Failed to list existing sessions for adoption', { err });
    return { adopted: 0, stopped: 0 };
  }

  let adopted = 0;
  let stopped = 0;
  for (const { handle, phase } of snapshots) {
    const session = handle.key.sessionId ? await getSession(handle.key.sessionId) : undefined;
    // The snapshot's phase is the listing's own truth: a corpse arrives as
    // 'terminal' (or not at all), so telling adoptable sessions apart needs
    // no per-handle status() round trip. `stop()` on a corpse is still full
    // teardown — a self-exited runtime needs its residue cleaned up.
    if (!session || session.status !== 'active' || phase !== 'running') {
      await handle.stop('orphan-at-startup').catch(() => {});
      stopped += 1;
      continue;
    }
    const runtime = registerRuntime(session.id, handle, handle.name, true);
    runtime.stopReason = undefined;
    handle.onTerminal((failure) => {
      void finishAndResolve(session.id, failure);
    });
    await markContainerRunning(session.id);
    adopted += 1;
  }

  await driver.reapResidue?.(INSTALL_SLUG).catch?.(() => {});
  // Reconcile terminals the watch stream missed while no host was listening —
  // adoption is the one place a full re-list is already cheap, so the hub's
  // resync wires here rather than into new periodic machinery.
  if (isSessionEventsDriver(driver)) await driver.resync(INSTALL_SLUG).catch(() => {});

  if (adopted > 0 || stopped > 0) {
    log.info('Reconciled sessions at startup', { adopted, stopped });
  }
  return { adopted, stopped };
}

/**
 * Resolve the provider name for a session using the precedence documented in
 * the provider-install skills:
 *
 *   sessions.agent_provider
 *     → agent_groups.agent_provider
 *     → container_configs.provider (container.json `provider`)
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
export async function recomposeAndUpdateHash(sessionId: string): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) return;
  const ag = await getAgentGroup(session.agent_group_id);
  if (!ag) return;
  await composeCoworkerClaudeMd(ag);
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
      cliScope: ((await getContainerConfig(ag.id))?.cli_scope ?? 'group') as 'disabled' | 'group' | 'global',
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
export async function detectStaleContainers(): Promise<
  Array<{ sessionId: string; agentGroupId: string; folder: string }>
> {
  const stale: Array<{ sessionId: string; agentGroupId: string; folder: string }> = [];
  for (const [sessionId] of activeContainers) {
    const session = await getSession(sessionId);
    if (!session) continue;
    const ag = await getAgentGroup(session.agent_group_id);
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
        cliScope: ((await getContainerConfig(ag.id))?.cli_scope ?? 'group') as 'disabled' | 'group' | 'global',
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

async function resolveProviderContribution(
  session: Session,
  agentGroup: AgentGroup,
  containerConfig: import('./container-config.js').ContainerConfig,
): Promise<{ provider: string; contribution: ProviderContainerContribution }> {
  // Precedence: session provider > agent_group provider > container.json > default.
  // `agentGroup.agent_provider` is a real tier on this fork — upstream's call
  // passes only two arguments, which would make a group-level provider pick
  // silently lose to container.json. The config is now threaded in by the
  // caller (already materialized once per spawn) rather than re-read here.
  const provider = resolveProviderName(
    session.agent_provider,
    agentGroup.agent_provider,
    containerConfig.provider ?? null,
  );
  const fn = getProviderContainerConfig(provider);
  const contribution = fn
    ? await fn({
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

export async function buildMounts(
  agentGroup: AgentGroup,
  session: Session,
  containerConfig: import('./container-config.js').ContainerConfig,
  provider: string,
  providerContribution: ProviderContainerContribution,
): Promise<VolumeMount[]> {
  const projectRoot = process.cwd();

  // Default agent surfaces (composed project doc, skill links, provider state
  // dir) apply unless the provider declares it provides its own — a capability,
  // never a provider name. See provider-container-registry.
  const defaultSurfaces = !providerProvidesAgentSurfaces(provider);

  const claudeDir = path.join(DATA_DIR, 'v2-sessions', agentGroup.id, '.claude-shared');
  if (defaultSurfaces) {
    syncSkillSymlinks(claudeDir, containerConfig);
    // No composeGroupClaudeMd here: this fork composes the project doc from the
    // lego spine (composeCoworkerClaudeMd, called in spawnContainer), and
    // upstream's claude-md-compose module is deleted on this branch.
  }

  const mounts: VolumeMount[] = [];
  const sessDir = sessionDir(agentGroup.id, session.id);
  const groupDir = path.resolve(GROUPS_DIR, agentGroup.folder);
  const scope = agentGroup.id;

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

  // Session workspace: mailbox-selected state plus outbox and heartbeat files.
  mounts.push({ hostPath: sessDir, containerPath: '/workspace', readonly: false, mountClass: 'group-state', scope });
  mounts.push({
    hostPath: sessionContextPath(agentGroup.id, session.id),
    containerPath: '/app/.nanoclaw-session.json',
    readonly: true,
    mountClass: 'group-state',
    scope,
  });

  // Agent group folder at /workspace/agent (RW for working files + shared memory)
  mounts.push({
    hostPath: groupDir,
    containerPath: '/workspace/agent',
    readonly: false,
    mountClass: 'group-state',
    scope,
  });

  // Shared directory (learnings + cross-group facts) — mounted read-only
  // for coworkers, read-write for Main. Main is the only agent allowed to
  // edit the shared bucket; coworkers write via mcp__nanoclaw__append_learning
  // which the host processes through the approval flow.
  //
  // 'allowlisted-extra', not 'group-state': the group-state rule admits only
  // `dataRoot/v2-sessions/<scope>` and the group's own subtree under
  // groupsRoot (mountAllowed in drivers/types.ts), and this path is neither —
  // it is deliberately cross-group. classRequiredByPath does not pin it, so
  // the class is ours to state.
  const sharedDir = path.join(DATA_DIR, 'shared');
  if (fs.existsSync(sharedDir)) {
    // Admin (Main) gets write access. Trust ONLY is_admin — not
    // coworker_type. A malicious import that set coworker_type='main'
    // on a non-admin group must not get write access.
    const isAdmin = agentGroup.is_admin === 1;
    mounts.push({
      hostPath: sharedDir,
      containerPath: '/workspace/shared',
      readonly: !isAdmin,
      mountClass: 'allowlisted-extra',
      scope,
    });
  }

  // Per-group .claude-shared at /home/node/.claude (Claude state, settings,
  // skills — initialized once at group creation, persistent thereafter).
  // `claudeDir` is declared at the top of this function, where
  // syncSkillSymlinks needs it.
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
  // Under `dataRoot/v2-sessions/<group>`, so 'group-state' is what the policy
  // requires here.
  if (defaultSurfaces) {
    mounts.push({
      hostPath: claudeDir,
      containerPath: '/home/node/.claude',
      readonly: false,
      mountClass: 'group-state',
      scope,
    });
  }
  // container.json — nested RO mount on top of RW group dir so the agent can
  // read its config but cannot modify it. Composed per group, so 'group-state'
  // read-only rather than 'install-surface': the install-surface rule is an
  // enumerated release-surface allowlist, and this path is under the group.
  const containerJsonPath = path.join(groupDir, 'container.json');
  if (fs.existsSync(containerJsonPath)) {
    mounts.push({
      hostPath: containerJsonPath,
      containerPath: '/workspace/agent/container.json',
      readonly: true,
      mountClass: 'group-state',
      scope,
    });
  }

  // Stamped plugin content is immutable at runtime (the Agent Plugins
  // contract: writes go to plugin-data/, which stays RW via the group mount).
  // Same nested-RO pattern as container.json; initGroupFilesystem creates the
  // dir before mounts are built, so the mount is unconditional.
  //
  // Classed 'install-surface' rather than 'group-state' because what is stamped
  // here is code the agent EXECUTES, and install-surface is the only class
  // whose read-only rule is enforced instead of chosen. It lives under the
  // group folder rather than an install root, so the mount policy pins it
  // through the group-folder label — see `stampedPluginsRoot`.
  mounts.push({
    hostPath: path.join(groupDir, 'plugins'),
    containerPath: CONTAINER_PLUGINS_DIR,
    readonly: true,
    mountClass: 'install-surface',
    scope,
  });

  // Composer-managed CLAUDE.md artifacts — nested RO mounts. These are
  // regenerated from the shared base + fragments on every spawn; any
  // agent-side writes would be clobbered, so enforce read-only. Only
  // CLAUDE.local.md (per-group memory) remains RW via the group-dir mount.
  // `.claude-shared.md` is a symlink whose target (`/app/CLAUDE.md`) is
  // already RO-mounted, so writes through it fail regardless — no need for
  // a nested mount there.
  const composedClaudeMd = path.join(groupDir, 'CLAUDE.md');
  if (defaultSurfaces && fs.existsSync(composedClaudeMd)) {
    mounts.push({
      hostPath: composedClaudeMd,
      containerPath: '/workspace/agent/CLAUDE.md',
      readonly: true,
      mountClass: 'group-state',
      scope,
    });
  }
  const fragmentsDir = path.join(groupDir, '.claude-fragments');
  if (defaultSurfaces && fs.existsSync(fragmentsDir)) {
    mounts.push({
      hostPath: fragmentsDir,
      containerPath: '/workspace/agent/.claude-fragments',
      readonly: true,
      mountClass: 'group-state',
      scope,
    });
  }

  // Shared CLAUDE.md — a release surface, read-only.
  const sharedClaudeMd = path.join(projectRoot, 'container', 'CLAUDE.md');
  if (defaultSurfaces && fs.existsSync(sharedClaudeMd)) {
    mounts.push({
      hostPath: sharedClaudeMd,
      containerPath: '/app/CLAUDE.md',
      readonly: true,
      mountClass: 'install-surface',
      scope,
    });
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
  //
  // Under `dataRoot/v2-sessions/<group>/<session>`, so 'group-state'.
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
  mounts.push({
    hostPath: codexDir,
    containerPath: '/home/node/.codex',
    readonly: false,
    mountClass: 'group-state',
    scope,
  });

  // Overlay hook scripts at /app/hooks (read-only — host-managed).
  //
  // 'allowlisted-extra', not 'install-surface': the install-surface class is
  // an ENUMERATED allowlist (mountPolicy().surfaceRoots names only
  // container/agent-runner/src, container/skills, container/CLAUDE.md), and
  // mountAllowed rejects an install-surface mount outside those roots. These
  // three host-managed paths are outside it, so widening surfaceRoots would be
  // the alternative — a change to upstream-owned policy for fork-only paths.
  // They stay read-only by their own `readonly: true` either way.
  const hooksMount = path.join(process.cwd(), 'container', 'hooks');
  if (fs.existsSync(hooksMount)) {
    mounts.push({
      hostPath: hooksMount,
      containerPath: '/app/hooks',
      readonly: true,
      mountClass: 'allowlisted-extra',
      scope,
    });
  }

  // Agent-runner scripts at /app/scripts — host-managed, read-only. Carries
  // buddy-call.sh and any other sibling-process helpers that hooks invoke.
  // Separate from /app/src (per-group agent-runner code, writable) because
  // these scripts are infrastructure, not agent workspace.
  const scriptsMount = path.join(process.cwd(), 'container', 'agent-runner', 'scripts');
  if (fs.existsSync(scriptsMount)) {
    mounts.push({
      hostPath: scriptsMount,
      containerPath: '/app/scripts',
      readonly: true,
      mountClass: 'allowlisted-extra',
      scope,
    });
  }

  // Buddy charter (read-only). buddy-call.sh reads this and prepends to
  // codex's first call. Separate mount because container/skills/buddy/
  // is otherwise a runtime skill bundle the agent could load.
  //
  // This one IS under container/skills, which classRequiredByPath pins to
  // 'install-surface' — stating anything else here is denied outright.
  const charterPath = path.join(process.cwd(), 'container', 'skills', 'buddy', 'CHARTER.md');
  if (fs.existsSync(charterPath)) {
    mounts.push({
      hostPath: charterPath,
      containerPath: '/app/skills/buddy/CHARTER.md',
      readonly: true,
      mountClass: 'install-surface',
      scope,
    });
  }

  // Shared skills — read-only, symlinks in .claude-shared/skills/ point here.
  const skillsSrc = path.join(projectRoot, 'container', 'skills');
  if (fs.existsSync(skillsSrc)) {
    mounts.push({
      hostPath: skillsSrc,
      containerPath: '/app/skills',
      readonly: true,
      mountClass: 'install-surface',
      scope,
    });
  }

  // Per-group agent-runner source at /app/src (initialized once at group
  // creation, persistent thereafter — agents can modify their runner).
  //
  // Deliberately NOT upstream's read-only mount of the shared install tree:
  // this fork's self-customize skill routes source edits through a builder
  // agent that WRITES to /app/src, and /add-opencode writes provider files
  // straight into the overlay. A read-only install-surface mount here breaks
  // both. The staleness cost is known and managed —
  // `pnpm run check:runner-staleness` reports which groups run old code.
  // Under `dataRoot/v2-sessions/<group>`, so 'group-state' and writable.
  const groupRunnerDir = path.join(DATA_DIR, 'v2-sessions', agentGroup.id, 'agent-runner-src');
  mounts.push({
    hostPath: groupRunnerDir,
    containerPath: '/app/src',
    readonly: false,
    mountClass: 'group-state',
    scope,
  });

  // Additional mounts from container config (groups/<folder>/container.json) —
  // threaded in via the param (materialized once in spawnContainer), already
  // vetted by the allowlist.
  if (containerConfig.additionalMounts && containerConfig.additionalMounts.length > 0) {
    const validated = validateAdditionalMounts(containerConfig.additionalMounts, agentGroup.name);
    mounts.push(...validated.map((m) => ({ ...m, mountClass: 'allowlisted-extra' as const, scope })));
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
    // 'allowlisted-extra': container/claude-trace is not one of the enumerated
    // surfaceRoots, so install-surface would be denied by mountAllowed.
    if (traceDir)
      mounts.push({
        hostPath: traceDir,
        containerPath: '/opt/claude-trace',
        readonly: true,
        mountClass: 'allowlisted-extra',
        scope,
      });
  }

  // Provider-contributed mounts (e.g. opencode-xdg). Vetted upstream by the
  // in-tree provider registration, which is exactly the 'allowlisted-extra'
  // contract — classing them group-state would deny any provider whose state
  // root sits outside the group subtree.
  if (providerContribution.mounts) {
    mounts.push(...providerContribution.mounts.map((m) => ({ ...m, mountClass: 'allowlisted-extra' as const, scope })));
  }

  return mounts;
}

/** VolumeMount (host vocabulary) → MountSpec (seam vocabulary). */
export function toMountSpecs(mounts: readonly VolumeMount[], defaultScope: string): MountSpec[] {
  return mounts.map((mount) => ({
    class: mount.mountClass ?? 'allowlisted-extra',
    hostPath: mount.hostPath,
    containerPath: mount.containerPath,
    mode: mount.readonly ? ('ro' as const) : ('rw' as const),
    groupScope: mount.scope ?? defaultScope,
  }));
}

export interface ComposeSessionSpecInput {
  agentGroup: AgentGroup;
  session: Session;
  containerName: string;
  mounts: VolumeMount[];
  containerConfig: import('./container-config.js').ContainerConfig;
  contribution: ProviderContainerContribution;
  /**
   * The gateway provider's typed per-session contribution. No argv-shaped
   * input reaches composition anymore: network selection is driver-private,
   * and everything the gateway used to append as raw flags arrives here as
   * env, mounts, and (capability-gated) auxiliary containers.
   */
  gateway: GatewayContribution;
  /** Non-secret configuration supplied by the selected mailbox implementation. */
  mailboxEnvironment: Record<string, string>;
  /** Resolved agent provider — selects the claude-trace wiring and AGENT_PROVIDER. */
  provider?: string;
  /** OneCLI agent identifier (the agent group id). */
  agentIdentifier?: string;
  /**
   * MCP wiring for this spawn. The proxy token authorises the container to
   * reach host MCP servers; the policy decides which servers get handed over
   * at all (see `forkContainerEnv`).
   */
  mcpProxy?: { proxyToken: string; policy: McpAllowlistResolution };
}

/**
 * One source per target: contributed mounts shadow composed mounts on a
 * containerPath collision (a gateway-served stub landing inside a composed
 * tree replaces that path's source — the effect Docker's last-wins `-v` rule
 * used to produce, resolved here so the spec a driver sees is collision-free
 * and `validateSpec` can refuse ambiguity outright).
 */
export function mergeMounts(composed: MountSpec[], contributed: MountSpec[]): MountSpec[] {
  const contributedTargets = new Set(contributed.map((m) => m.containerPath));
  return [...composed.filter((m) => !contributedTargets.has(m.containerPath)), ...contributed];
}

/**
 * Compose the session spec. This is the tail of the old `buildContainerArgs`,
 * with argv assembly removed: the host says what a session *is*, the driver
 * says how it is realized.
 */
export async function composeSessionSpec(input: ComposeSessionSpecInput): Promise<SessionSpec> {
  const { agentGroup, session, containerName, mounts, containerConfig, contribution, gateway, mailboxEnvironment } =
    input;

  // `forkContainerEnv` sets TZ from the group's timezone override
  // (resolveGroupTimezone), which is the fork's stronger rule — the
  // containerConfig/install-global pair below is its fallback, so it is listed
  // FIRST and deliberately overridden.
  const env: Record<string, string> = {
    TZ: containerConfig.timezone ?? TIMEZONE,
    ...(await forkContainerEnv(input)),
    ...mailboxEnvironment,
  };
  // The contributed lane (ContainerSpec.contributedEnv): registry-sourced env,
  // exempt from the credential-NAME check and still refused credential VALUES.
  // The model provider's contribution fills first, the gateway's second — a
  // gateway wins a key collision, the override the old raw-argv append got
  // from Docker's last-wins rule.
  const contributedEnv: Record<string, string> = {
    ...(contribution.env ?? {}),
    ...(gateway.env ?? {}),
  };

  const hostUid = process.getuid?.();
  const hostGid = process.getgid?.();
  // The spec contract (drivers/types.ts, `runAs`): the identity that must read
  // 0600 host-owned material is explicit in the spec for every non-root host,
  // never inherited from an image USER. uid 1000 matches the agent image's
  // node user, so the Docker realization is a no-op there — but a driver whose
  // auxiliary image runs as 65532 needs it said, or that container cannot open
  // its own 0600 session material. uid 0 stays excluded: the hardened posture pins
  // non-root, and Docker's root behavior is unchanged trunk behavior.
  // HOME travels with the mapping, exactly as it did in the old argv: a uid
  // the image has no passwd entry for resolves HOME to '/', and the provider
  // SDK's `mkdir ~/.claude` dies EACCES; /home/node is chmod 777 in the agent
  // image, so it is writable by any uid under both drivers.
  const runAs = hostUid != null && hostUid !== 0 ? { uid: hostUid, gid: hostGid ?? hostUid } : undefined;
  if (runAs) env.HOME = '/home/node';

  const agent: ContainerSpec = {
    role: 'agent',
    // Composition resolves the image; drivers never build and never resolve.
    image: containerConfig.imageTag || CONTAINER_IMAGE,
    env,
    // Run the v2 entry point directly (no tsc, no stdin). The driver maps the
    // 'standard' posture's PID-1 requirement onto this: Docker adds `--init`.
    command: ['bash', '-c'],
    // Writes ~/.codex/config.toml from container env, then execs the runner.
    // See agentEntrypointScript for why the TOML cannot be `-c` overrides.
    args: [agentEntrypointScript()],
    mounts: mergeMounts(toMountSpecs(mounts, agentGroup.id), gateway.mounts ?? []),
    contributedEnv,
  };

  // The folder label (D9) rides the spec so an admission-side check can pin
  // the `groups/<folder>` mount subtree to the session that carries it — the
  // id→folder mapping lives only in the central DB, which no admission-side
  // check can read. It is VERBATIM by contract, deliberately the opposite of
  // the projection lineage labels get: the policy pins hostPaths by
  // concatenating this label into the required prefix
  // (`path.startsWith(GROUPS + '/' + label + '/')` shape), and no
  // admission-side check can invert a hash-suffix projection — a projected
  // value would have the policy compare the real folder against a truncated
  // stand-in and deny every session of the group while naming the wrong
  // culprit. So a folder no driver can carry verbatim refuses HERE, loudly
  // and non-retryably, where the error can say what is actually wrong.
  if (!labelValueLegal(agentGroup.folder)) {
    throw specInvalid(
      `group folder '${agentGroup.folder}' cannot be carried verbatim as the ${GROUP_FOLDER_LABEL} label ` +
        `(label values: <=63 bytes of [A-Za-z0-9._-], alphanumeric at both ends); admission joins ` +
        `on this label verbatim so it is never projected — rename the group folder ` +
        `(\`bun scripts/detect-driver-migration.ts\` enumerates affected groups and the fix)`,
    );
  }

  return {
    key: { installSlug: INSTALL_SLUG, agentGroupId: agentGroup.id, sessionId: session.id },
    labels: { 'nanoclaw-container-name': containerName, [GROUP_FOLDER_LABEL]: agentGroup.folder },
    // The gateway's auxiliary containers ride beside the agent; capability-
    // gated in the spawn path before composition ever runs.
    containers: [agent, ...(gateway.containers ?? [])],
    network: 'shared-private',
    hardening: 'standard',
    resources: {
      cpus: CONTAINER_CPU_LIMIT || undefined,
      memoryMb: parseMemoryMb(CONTAINER_MEMORY_LIMIT),
      pidsLimit: parsePidsLimit(CONTAINER_PIDS_LIMIT),
      shmSizeMb: SHM_SIZE_MB,
    },
    // The group's configured tier; the driver refuses one it cannot realize
    // (validateSpec, against capabilities().isolationTiers).
    runtimeTier: containerConfig.runtimeTier ?? 'container',
    runAs,
    stopGraceSeconds: STOP_GRACE_SECONDS,
  };
}

/**
 * `CONTAINER_MEMORY_LIMIT` is an operator-facing docker size string ("8g",
 * "512m"). Empty stays undefined — no cap, today's behavior.
 *
 * A bare number is bytes, which is Docker's own rule and therefore what an
 * operator's existing value already means. It is preserved rather than
 * reinterpreted as megabytes: guessing the friendlier meaning would quietly
 * multiply a limit by a million.
 */
export function parseMemoryMb(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const match = /^(\d+(?:\.\d+)?)\s*([bkmg]?)b?$/i.exec(value.trim());
  if (!match) {
    // Fail-closed, like the raw pass-through this replaced: an invalid value
    // used to make Docker reject the spawn, and returning undefined here would
    // silently REMOVE the operator's cap instead — the one wrong direction for
    // a resource limit to fail in.
    throw specInvalid(`CONTAINER_MEMORY_LIMIT '${value}' is not a docker size string ("8g", "512m", "1073741824")`);
  }
  const size = Number(match[1]);
  if (!Number.isFinite(size)) {
    throw specInvalid(`CONTAINER_MEMORY_LIMIT '${value}' is not a docker size string ("8g", "512m", "1073741824")`);
  }
  if (size === 0) return undefined; // Docker's own meaning for 0: no cap.
  switch (match[2].toLowerCase()) {
    case 'g':
      return Math.floor(size * 1024);
    case 'k':
      return Math.max(1, Math.floor(size / 1024));
    case 'b':
    case '':
      return Math.max(1, Math.floor(size / (1024 * 1024)));
    default:
      return Math.floor(size);
  }
}

/** cgroups v2 rejects a pids limit of 0 with EINVAL, so blank/0/garbage means no cap. */
export function parsePidsLimit(value: string): number | undefined {
  const pids = Number(value);
  return Number.isFinite(pids) && pids > 0 ? Math.floor(pids) : undefined;
}

/**
 * Sync skill symlinks in .claude-shared/skills/ to match the container.json
 * selection. Each symlink points to a container path (/app/skills/<name>) so
 * it's dangling on the host but valid inside the container.
 */
export function syncSkillSymlinks(
  claudeDir: string,
  containerConfig: import('./container-config.js').ContainerConfig,
): void {
  const skillsDir = path.join(claudeDir, 'skills');
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
  }

  const desired = selectedSkillNames(containerConfig);
  const desiredSet = new Set(desired);

  // Remove symlinks not in the desired set
  for (const entry of fs.readdirSync(skillsDir)) {
    const entryPath = path.join(skillsDir, entry);
    let isSymlink = false;
    try {
      isSymlink = fs.lstatSync(entryPath).isSymbolicLink();
    } catch {
      continue;
    }
    if (isSymlink && !desiredSet.has(entry)) {
      fs.unlinkSync(entryPath);
    }
  }

  // Create symlinks for desired skills (container path targets)
  for (const skill of desired) {
    const linkPath = path.join(skillsDir, skill);
    let entry: fs.Stats | undefined;
    try {
      entry = fs.lstatSync(linkPath);
    } catch {
      /* missing */
    }
    if (!entry) {
      fs.symlinkSync(`/app/skills/${skill}`, linkPath);
    } else if (!entry.isSymbolicLink()) {
      // A real entry here is either a template overlay (intentional; see
      // src/group-skills.ts) or a stale pre-refactor skill copy that shadows
      // the shared skill (#3001). No marker distinguishes them yet, so
      // surface the skip instead of staying silent.
      log.warn(
        'Shared skill not symlinked: real entry occupies the path (template overlay or stale pre-refactor copy)',
        {
          skill,
          path: linkPath,
        },
      );
    }
  }
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

/**
 * Every env var this fork's agent-runner, hooks, and overlay scripts read.
 *
 * These used to be `-e KEY=VALUE` pushes inside `buildContainerArgs`, which the
 * driver seam removed: `ContainerSpec` forbids raw runtime flags, but env is a
 * typed lane, so the whole set survives as a plain record. Composed literals
 * only — registry-sourced lanes (the model provider's contribution, the
 * gateway's) ride `contributedEnv` and override these on a key collision.
 */
async function forkContainerEnv(input: ComposeSessionSpecInput): Promise<Record<string, string>> {
  const { agentGroup, session, containerName, containerConfig, contribution, provider, mcpProxy } = input;
  const env: Record<string, string> = {};

  // Only vars read by code we don't own. Everything NanoClaw-specific is in
  // container.json (read by the runner at startup). Per-group timezone override
  // (migration 020) → falls back to the install global; resolveGroupTimezone
  // validates a hand-edited DB value.
  env.TZ = await resolveGroupTimezone(agentGroup.id);
  if (provider) env.AGENT_PROVIDER = provider;

  // claude-trace: point the SDK's executable at the wrapper mounted by
  // buildMounts. Unlike stock claude-trace (a require-hook, JS-only), this
  // build stands up a local reverse proxy, points the child's
  // ANTHROPIC_BASE_URL at it, and forwards upstream via the OneCLI proxy — so
  // it works with the NATIVE ELF binary and captures NVIDIA (/llm/) and
  // Bedrock (/model/) traffic, not just anthropic.com. Gated on the same
  // directory check as the mount: no build, no env, no trace.
  if (provider === 'claude' && resolveClaudeTraceDir()) {
    env.CLAUDE_CODE_EXECUTABLE = '/opt/claude-trace/claude-trace-wrapper.sh';
    env.CLAUDE_TRACE_DIR = '/opt/claude-trace';
    // NANOCLAW_SESSION_ID (below, for dashboard routing) is also read by the
    // wrapper for per-session --log names.
  }

  // Two-DB split: container reads inbound.db, writes outbound.db. The runner
  // defaults to these same paths, but state them so a mailbox implementation
  // that relocates them only has to change one place.
  env.SESSION_INBOUND_DB_PATH = '/workspace/inbound.db';
  env.SESSION_OUTBOUND_DB_PATH = '/workspace/outbound.db';
  env.SESSION_HEARTBEAT_PATH = '/workspace/.heartbeat';

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
        env.OVERLAY_WORKFLOWS = wfList
          .map((w) => `${w.name}:${w.description.slice(0, 60).replace(/[;:]/g, ' ')}`)
          .join(';');
      }
    }
    // Tamper-resistant critique-gate activation: the composer already
    // materialized .overlay-critique-gate / .critique-required-stages into
    // groupDir (composeCoworkerClaudeMd). Read them here — before the
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
      env.CRITIQUE_GATE_ACTIVE = active ? '1' : '0';
      if (active) {
        try {
          const stages = fs.readFileSync(path.join(gateGroupDir, '.critique-required-stages'), 'utf-8').trim();
          if (stages) env.CRITIQUE_REQUIRED_STAGES = stages;
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
    'PI_MODEL',
    'PI_PROVIDER',
    'PI_THINKING_LEVEL',
  ]) {
    const value = process.env[key];
    if (value) env[key] = value;
  }

  // Stub credentials — load-bearing for SDKs that refuse to send a request
  // without an env var, but the actual auth is injected by the OneCLI MITM
  // proxy on the wire (host-pattern-matched secrets). Naming chosen so any
  // agent inspecting the value sees "this is not a real token, do NOT bake
  // me into URLs / config / logs". Never use $GH_TOKEN as a Basic-auth
  // password — the proxy replaces the Authorization header by host+path,
  // not by URL-embedded creds. The git-remote-url-guard hook (PreToolUse on
  // Bash) catches the `git remote set-url ...$GH_TOKEN...` footgun.
  env.NVIDIA_API_KEY = 'ROUTED_VIA_ONECLI_PROXY';
  env.GH_TOKEN = 'ROUTED_VIA_ONECLI_PROXY';
  // git doesn't honor SSL_CERT_FILE — needs GIT_SSL_CAINFO to trust
  // the OneCLI MITM CA so `git clone/push` work through the proxy.
  env.GIT_SSL_CAINFO = '/tmp/onecli-combined-ca.pem';
  // pip uses REQUESTS_CA_BUNDLE / PIP_CERT rather than SSL_CERT_FILE.
  // Without these, pip inside a venv fails SSL verification through the proxy.
  env.REQUESTS_CA_BUNDLE = '/tmp/onecli-combined-ca.pem';
  env.PIP_CERT = '/tmp/onecli-combined-ca.pem';

  if (agentGroup.name) env.NANOCLAW_ASSISTANT_NAME = agentGroup.name;
  env.NANOCLAW_AGENT_GROUP_ID = agentGroup.id;
  env.NANOCLAW_AGENT_GROUP_NAME = agentGroup.name;
  // Per-session identity — the dashboard uses these to attribute hook
  // events to the NanoClaw session that emitted them (via the
  // sdk_session_routes mapping table). Empty thread_id is fine; the
  // dashboard treats the empty string as "root session".
  env.NANOCLAW_SESSION_ID = session.id;
  env.NANOCLAW_SESSION_THREAD_ID = session.thread_id ?? '';
  // Dashboard hook URL — exposed to in-container overlay scripts (buddy-
  // call.sh, dispatchResultText) so they can post overlay-emitted events
  // alongside the SDK's universal PostToolUse stream. Same URL shape the
  // universal curl hook uses; empty when DASHBOARD_PORT isn't configured
  // so call sites can no-op cleanly.
  env.NANOCLAW_HOOK_URL = DASHBOARD_PORT ? `http://host.docker.internal:${DASHBOARD_PORT}/api/hook-event` : '';
  env.NANOCLAW_GROUP_FOLDER = agentGroup.folder;
  // Cap on how many pending messages reach one prompt. Accumulated context
  // (trigger=0 rows) rides along with wake-eligible rows up to this cap.
  env.NANOCLAW_MAX_MESSAGES_PER_PROMPT = String(MAX_MESSAGES_PER_PROMPT);

  // Idle-end timeout override. Agents that run long builds (e.g. CMake debug
  // builds = 15-25 min) need a higher ceiling than the 600s default so the
  // poll loop doesn't kill the query mid-build. Set NANOCLAW_IDLE_END_MS in
  // the host .env to widen the window for all containers, or pass it through
  // per-agent-group config. The poll-loop clamps to a 60s floor.
  if (process.env.NANOCLAW_IDLE_END_MS) env.NANOCLAW_IDLE_END_MS = process.env.NANOCLAW_IDLE_END_MS;

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
  env.NO_PROXY = 'host.docker.internal,localhost,127.0.0.1';
  env.no_proxy = 'host.docker.internal,localhost,127.0.0.1';

  // MCP servers: type-level (from coworker registry) + per-instance (from
  // container.json). Per-instance overrides type-level per server name.
  //
  // BOTH lanes are load-bearing and must stay: `NANOCLAW_MCP_SERVERS` is the
  // SOLE transport for type-level coworker-registry servers (they have no
  // other way in), while container.json's `mcpServers` is per-instance only.
  // Proxy auto-discovery in the agent-runner runs LAST so its
  // `if (mcpServers[serverName]) continue` guard lets explicit config win.
  const typeMcpServers = resolveTypeManifest(agentGroup).mcpServers;
  const mergedMcpServers = { ...typeMcpServers, ...containerConfig.mcpServers };
  // Withhold the wiring for any server the policy allows no tool on. These
  // entries are direct (stdio/http) servers that never traverse the host MCP
  // proxy, so the proxy's ACL cannot restrict them — the only host-side
  // control is not handing them over. It is also the strongest one: a server
  // that was never wired needs no deny list to be complete, and its `env`
  // block (which can carry credentials) never enters the container at all.
  // This withholding step runs AFTER the merge above, never before it.
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
    env.NANOCLAW_MCP_SERVERS = JSON.stringify(wiredMcpServers);
  }

  // MCP proxy token + URL + allowed tools — enables containers to reach host MCP servers
  if (mcpProxy) {
    env.MCP_PROXY_TOKEN = mcpProxy.proxyToken;
    env.MCP_PROXY_URL = `http://host.docker.internal:${MCP_PROXY_PORT}`;

    // ALWAYS passed, whatever the list length. This is the whole fix for the
    // empty-list hole: the container decides what to wire and what to allow
    // from the policy STATE, and it reads a missing variable as `unresolved`
    // (deny all configurable MCP). Previously both variables below were
    // omitted when the list was empty, which the container read as "no
    // restrictions requested" — so `--tools '[]'` handed over the full direct
    // tool surface (`mcp__nanoclaw__*`, `mcp__codex__*`), none of which
    // traverses the proxy that was doing the actual restricting.
    env.NANOCLAW_MCP_POLICY = JSON.stringify(toMcpPolicyWire(mcpProxy.policy));

    // Legacy variables, still emitted for the SDK disallowedTools backstop and
    // for the proxy-server auto-discovery path in the agent-runner. They are
    // no longer the policy — `NANOCLAW_MCP_POLICY` is.
    env.NANOCLAW_ALLOWED_MCP_TOOLS = JSON.stringify(mcpProxy.policy.externalTools);
    // claude.ts::computeBlockedTools builds the disallowedTools list as
    // (inventory − allowed). Pass the discovered inventory so the SDK-level
    // block covers proxied servers by name as well as by policy.
    const inventory = getDiscoveredToolInventory();
    if (Object.keys(inventory).length > 0) {
      env.NANOCLAW_MCP_TOOL_INVENTORY = JSON.stringify(inventory);
    }
  }

  if (DASHBOARD_PORT) env.DASHBOARD_URL = `http://host.docker.internal:${DASHBOARD_PORT}`;

  // Provider-contributed env (e.g. XDG_DATA_HOME, OPENCODE_*) is NOT merged
  // here: it rides `contributedEnv` on the spec, which is the registry-sourced
  // lane and wins a key collision with these composed literals.
  void contribution;

  return env;
}

/**
 * PID 1's argument for the agent container.
 *
 * Codex CLI needs the full [model_providers.<provider>] block in a real
 * config.toml — `-c` overrides reliably modify existing fields but don't
 * always *define* new TOML sections. Generate a minimal config from
 * container env vars at start, then exec the agent-runner. Auth still flows
 * through the OneCLI MITM proxy via env_key=NVIDIA_API_KEY.
 *
 * Note: the heredoc delimiter is UNquoted (TOML_EOF, not 'TOML_EOF') so bash
 * expands the ${VAR:-default} references at container start, not here.
 */
function agentEntrypointScript(): string {
  return `git config --global "url.https://x-access-token:placeholder@github.com/.insteadOf" "https://github.com/" 2>/dev/null || true
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
exec bun run /app/src/index.ts`;
}
const execAsync = promisify(exec);

/** Build a per-agent-group Docker image with custom packages. */
export async function buildAgentGroupImage(agentGroupId: string): Promise<void> {
  const agentGroup = await getAgentGroup(agentGroupId);
  if (!agentGroup) throw new Error('Agent group not found');

  const configRow = await getContainerConfig(agentGroup.id);
  if (!configRow) throw new Error('Container config not found');
  const aptPackages = JSON.parse(configRow.packages_apt) as string[];
  const npmPackages = JSON.parse(configRow.packages_npm) as string[];
  if (aptPackages.length === 0 && npmPackages.length === 0) {
    throw new Error('No packages to install. Use install_packages first.');
  }

  // Image building is not on the runtime path (drivers never build) and shells
  // the local Docker daemon. Both call sites gate on the `imageBuild`
  // capability; this is the backstop for any future caller that forgets.
  if (!getSessionDriver().capabilities().imageBuild) {
    throw new Error('Per-agent-group image builds are unavailable on this runtime driver');
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

  // Store the image tag in the DB — container.json is re-materialized from it
  // at the next spawn, so writing the file here would be redundant.
  await updateContainerConfigScalars(agentGroup.id, { image_tag: imageTag });

  log.info('Per-agent-group image built', { agentGroupId, imageTag });
}
