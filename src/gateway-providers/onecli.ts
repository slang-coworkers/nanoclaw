import fs from 'fs';
import path from 'path';

import { normalizeGatewayApprovalSummary } from '../gateway-approval-summary.js';
/** OneCLI typed configuration and supervised native approval adapter. */
import { OneCLI, ApprovalClient, type ContainerConfig, type ApprovalRequest } from '@onecli-sh/sdk';

import { DATA_DIR } from '../config.js';
import { combinedCaBundle, stageOnecliFile } from './onecli-files.js';
import { storedAccountId, stubNeedsAccountId, withAccountId } from './onecli-chatgpt-stub.js';
import {
  adoptSavedProviderCredentials,
  hasSavedProviderNames,
  providerCredentialFile,
  type ProviderCredentialRecord,
  readProviderCredentials,
  RecordLockedError,
  unrecordedModelKeys,
  updateProviderCredentials,
} from './onecli-provider-credentials.js';
import { readEnvFile } from '../env.js';
import { log } from '../log.js';

import {
  registerGatewayProvider,
  type GatewayApprovalRequest,
  type GatewayApprovalScope,
  type GatewayContribution,
  type GatewaySessionInput,
  type GatewaySessionLease,
} from './gateway-provider-registry.js';

const env = readEnvFile([
  'ONECLI_URL',
  'ONECLI_API_KEY',
  'ONECLI_GATEWAY_CONTAINER',
  'ANTHROPIC_BASE_URL',
  'ONECLI_CONSOLE_URL',
  'ONECLI_NEW_AGENT_SECRETS',
]);
const onecliUrl = process.env.ONECLI_URL || env.ONECLI_URL;
const onecliApiKey = process.env.ONECLI_API_KEY || env.ONECLI_API_KEY;
const gatewayContainer = process.env.ONECLI_GATEWAY_CONTAINER || env.ONECLI_GATEWAY_CONTAINER || 'onecli';
const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL || env.ANTHROPIC_BASE_URL;
// fork delta (nv): the SDK's default timeout is not tunable, and a slow or
// wedged vault turned every spawn into a long hang with no operator lever.
const ONECLI_TIMEOUT_MS = Number(process.env.ONECLI_TIMEOUT_MS) > 0 ? Number(process.env.ONECLI_TIMEOUT_MS) : 30_000;
const onecli = new OneCLI({ url: onecliUrl, apiKey: onecliApiKey, timeout: ONECLI_TIMEOUT_MS });

// fork delta (nv): ensureAgent is durable, so one success per group per process
// is enough. Without this memo every spawn re-ensured, and under a busy sweep
// those calls starved the host's timers (see cf3aef6eb). Cleared on failure so
// an agent deleted out-of-band is re-ensured by the next spawn.
const ensuredAgents = new Set<string>();

/** Suffix of the OneCLI identifier of the agent that the closed sessions of a group use. */
export const CLOSED_AGENT_SUFFIX = ':closed';

/**
 * The OneCLI agent identifier a session uses: the agent group id, or
 * `<group id>:closed` for a closed session. The container cannot change its
 * agent identity, which is why the gateway can hold closed and open sessions
 * of one group to different rules.
 */
export function agentIdentifierFor(agentGroupId: string, privilege: 'open' | 'closed' | undefined): string {
  return privilege === 'closed' ? `${agentGroupId}${CLOSED_AGENT_SUFFIX}` : agentGroupId;
}

/** The agent group id behind a OneCLI agent identifier of either privilege. */
export function agentGroupIdOfIdentifier(identifier: string): string {
  return identifier.endsWith(CLOSED_AGENT_SUFFIX) ? identifier.slice(0, -CLOSED_AGENT_SUFFIX.length) : identifier;
}

/** Tests: forget this process's memos, as a host restart does; the pending restrictions on disk stay. */
export function _resetEnsuredAgentsForTesting(): void {
  ensuredAgents.clear();
  restrictionPending = null;
}
const healthUrl = new URL('/v1/health', onecliUrl || 'https://api.onecli.sh').toString();
const liveLeases = new Set<{ unavailable?: string; notify?: (reason: string) => void }>();
let healthTimer: NodeJS.Timeout | null = null;
let probing = false;

type OneCLIContribution = Omit<GatewayContribution, 'networkAccess'>;
type GatewayMount = NonNullable<GatewayContribution['mounts']>[number];

/** Stage immutable per-content files; SDK temporary basenames are shared across agents. */
export function contributionFromConfig(
  config: ContainerConfig,
  groupScope: string,
  dataDir = DATA_DIR,
  accountId?: string,
): OneCLIContribution {
  const env = { ...config.env };
  const mounts: GatewayMount[] = [];
  const mount = (kind: 'ca' | 'combined' | 'stub', content: string, containerPath: string) => {
    mounts.push({
      class: 'allowlisted-extra',
      hostPath: stageOnecliFile(dataDir, kind, content),
      containerPath,
      mode: 'ro',
      groupScope,
    });
  };
  mount('ca', config.caCertificate, config.caCertificateContainerPath);
  const combined = combinedCaBundle(config.caCertificate);
  if (combined) {
    const target = '/tmp/onecli-combined-ca.pem';
    mount('combined', combined, target);
    env.SSL_CERT_FILE = target;
    env.DENO_CERT = target;
  }
  for (const stub of config.credentialStubs ?? []) {
    mount('stub', accountId ? withAccountId(stub.content, accountId) : stub.content, stub.containerPath);
  }
  return { env, mounts };
}

/**
 * The stand-in's fixed account id fails a client's workspace check; OneCLI
 * keeps the real id as secret metadata. An unreachable API stops the spawn,
 * as a failed container-config fetch does; a stored login without one usable
 * id leaves the stand-in unchanged.
 */
export async function stubAccountId(config: ContainerConfig): Promise<string | undefined> {
  if (!(config.credentialStubs ?? []).some((stub) => stubNeedsAccountId(stub.content))) return undefined;
  const headers: Record<string, string> = {};
  const apiKey = onecliApiKey ?? process.env.ONECLI_API_KEY;
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (process.env.ONECLI_PROJECT_ID) headers['X-Project-Id'] = process.env.ONECLI_PROJECT_ID;
  const base = (onecliUrl || 'https://api.onecli.sh').replace(/\/+$/, '');
  const response = await fetch(`${base}/v1/secrets`, { headers, signal: AbortSignal.timeout(5_000) });
  if (response.status >= 500) throw new Error(`OneCLI secret metadata unavailable: status ${response.status}`);
  if (!response.ok) {
    log.warn('OneCLI secret metadata refused; login stand-in keeps its placeholder account id', {
      status: response.status,
    });
    return undefined;
  }
  const { accountId, logins } = storedAccountId(await response.json());
  if (!accountId) {
    log.warn('OneCLI login stand-in keeps its placeholder account id', {
      storedLogins: logins,
      hint: 'keep one ChatGPT login in OneCLI (onecli secrets list / delete), then sign in again',
    });
  }
  return accountId;
}

export function withProviderEnv(contribution: OneCLIContribution, baseUrl = anthropicBaseUrl): OneCLIContribution {
  if (!baseUrl) return contribution;
  return {
    ...contribution,
    env: { ...contribution.env, ANTHROPIC_BASE_URL: baseUrl, ANTHROPIC_AUTH_TOKEN: 'gateway-managed' },
  };
}

function stopHealthMonitor(): void {
  if (healthTimer) clearInterval(healthTimer);
  healthTimer = null;
}

/**
 * One slow or failed health probe must not stop the fleet. Before 2026-09-30 a
 * single miss (5 s timeout) marked every lease unavailable and killed every
 * running session; on prod that happened in bursts whenever OneCLI was busy
 * serving streaming traffic (133 session stops on 09-29/30, a triage turn lost).
 * A real outage still fails closed: HEALTH_FAILURES_BEFORE_UNAVAILABLE
 * consecutive misses, each allowed HEALTH_PROBE_TIMEOUT_MS, ~30 s in all.
 */
export const HEALTH_PROBE_INTERVAL_MS = 5_000;
export const HEALTH_PROBE_TIMEOUT_MS = 10_000;
export const HEALTH_FAILURES_BEFORE_UNAVAILABLE = 3;
let consecutiveHealthFailures = 0;

async function probeHealth(): Promise<void> {
  if (probing || liveLeases.size === 0) return;
  probing = true;
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(HEALTH_PROBE_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`status ${response.status}`);
    if (consecutiveHealthFailures > 0) log.info('OneCLI health probe recovered', { after: consecutiveHealthFailures });
    consecutiveHealthFailures = 0;
  } catch (err) {
    consecutiveHealthFailures++;
    if (consecutiveHealthFailures < HEALTH_FAILURES_BEFORE_UNAVAILABLE) {
      log.warn('OneCLI health probe failed; tolerating', {
        attempt: consecutiveHealthFailures,
        of: HEALTH_FAILURES_BEFORE_UNAVAILABLE,
        err,
      });
      return;
    }
    consecutiveHealthFailures = 0;
    const reason = 'OneCLI gateway unavailable';
    log.error(reason, { err });
    stopHealthMonitor();
    for (const lease of liveLeases) {
      lease.unavailable = reason;
      lease.notify?.(reason);
    }
  } finally {
    probing = false;
  }
}

function monitorLease(signal: AbortSignal): Pick<GatewaySessionLease, 'onUnavailable'> {
  const lease: { unavailable?: string; notify?: (reason: string) => void } = {};
  liveLeases.add(lease);
  if (!healthTimer) {
    healthTimer = setInterval(() => void probeHealth(), HEALTH_PROBE_INTERVAL_MS);
    healthTimer.unref();
  }
  const close = () => {
    liveLeases.delete(lease);
    if (liveLeases.size === 0) stopHealthMonitor();
  };
  if (signal.aborted) close();
  else signal.addEventListener('abort', close, { once: true });
  return {
    onUnavailable(report) {
      lease.notify = report;
      if (lease.unavailable) report(lease.unavailable);
    },
  };
}

export interface ProviderGrantOptions {
  baseUrl: string;
  apiKey?: string;
  projectId?: string | null;
  fetchImpl?: typeof fetch;
  dataDir?: string;
}

async function isUnknownRoute(res: Response): Promise<boolean> {
  const body = (await res.json().catch(() => null)) as { error?: { type?: unknown; message?: unknown } } | null;
  const error = body?.error;
  return (
    error?.type === 'invalid_request_error' ||
    (typeof error?.message === 'string' && error.message.startsWith('Unrecognized request URL'))
  );
}

/**
 * From 1.44 an agent receives only the secrets attached to it, so attach the
 * model credentials this install recorded for the group's provider; tool
 * secrets and app connections stay opt-in. Runs on every spawn and only adds,
 * so later spawns repair an interrupted setup or a provider switch. Returns the
 * ids attached, or null on a gateway without grants (1.43 and older).
 */
export async function grantProviderCredentials(
  identifier: string,
  provider: string,
  opts: ProviderGrantOptions,
): Promise<string[] | null> {
  const doFetch = opts.fetchImpl ?? fetch;
  const dataDir = opts.dataDir ?? DATA_DIR;
  const base = opts.baseUrl.replace(/\/+$/, '');
  const headers: Record<string, string> = {};
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;
  if (opts.projectId) headers['X-Project-Id'] = opts.projectId;
  const request = (path: string, method = 'GET') =>
    doFetch(`${base}${path}`, { method, headers, signal: AbortSignal.timeout(10_000) });
  const list = async (path: string): Promise<Array<Record<string, unknown>>> => {
    const res = await request(path);
    if (!res.ok) throw new Error(`GET ${path} returned ${res.status}`);
    const body = (await res.json()) as unknown;
    const rows = Array.isArray(body) ? body : (body as { data?: unknown }).data;
    if (!Array.isArray(rows)) throw new Error(`GET ${path} did not return a list`);
    return rows as Array<Record<string, unknown>>;
  };

  const agent = (await list('/v1/agents')).find((a) => a.identifier === identifier);
  if (typeof agent?.id !== 'string') throw new Error(`OneCLI agent ${identifier} not found`);
  const agentPath = `/v1/agents/${encodeURIComponent(agent.id)}`;
  const grants = await request(`${agentPath}/grants`);
  // Only a gateway that does not know the route at all lacks grants (1.42
  // answers `invalid_request_error`, "Unrecognized request URL"); any other
  // 404, such as "Agent not found.", is a failure.
  if (grants.status === 404 && (await isUnknownRoute(grants))) return null;
  if (!grants.ok) throw new Error(`GET ${agentPath}/grants returned ${grants.status}`);
  const granted = ((await grants.json()) as { secrets?: unknown }).secrets;
  if (!Array.isArray(granted)) throw new Error(`GET ${agentPath}/grants did not return a secrets list`);
  const held = new Set(granted.map((g) => (g as { secretId?: unknown }).secretId));

  let record = readProviderCredentials(dataDir);
  const vault = await list('/v1/secrets');
  const live = new Set(vault.map((secret) => secret.id).filter((id): id is string => typeof id === 'string'));
  if (!record.matched.includes(provider) && hasSavedProviderNames(provider)) {
    // Duplicate saved names throw here, after the record is read again.
    const adopt = (r: ProviderCredentialRecord) => adoptSavedProviderCredentials(r, provider, vault);
    try {
      record = await updateProviderCredentials(dataDir, adopt, { lockTimeoutMs: 1_000 });
    } catch (err) {
      if (!(err instanceof RecordLockedError)) throw err;
      // Never stall or fail a spawn on the record: use the match now, record it on a later spawn.
      log.warn('OneCLI could not record the matched model credential; using it for this spawn only', {
        agentGroupId: identifier,
        provider,
        lock: `${providerCredentialFile(dataDir)}.lock`,
      });
      // Re-read: the holder may have committed its match before stalling.
      record = readProviderCredentials(dataDir);
      adopt(record);
    }
  }
  const ids = (record.providers[provider] ?? []).filter((id) => live.has(id));
  const missing = ids.filter((id) => !held.has(id));
  for (const id of missing) {
    const res = await request(`${agentPath}/grants/secrets/${encodeURIComponent(id)}`, 'PUT');
    if (!res.ok) throw new Error(`attaching secret ${id} returned ${res.status}`);
  }
  if (ids.length === 0) {
    const unrecorded = unrecordedModelKeys(record, provider, vault);
    if (unrecorded.length) {
      // A group that still holds one (converted on upgrade) works; a new one gets no key.
      const level = unrecorded.some((s) => held.has(s.id)) ? 'warn' : 'error';
      log[level](
        `OneCLI holds a ${provider} model key NanoClaw never recorded, so new groups get no key: ` +
          `run \`pnpm exec tsx setup/index.ts --step gateway-auth ${provider}\` to sign in and record one`,
        { agentGroupId: identifier, provider, unrecorded: unrecorded.map((s) => s.name) },
      );
    } else {
      log.warn(
        'No model credential recorded for this provider is in the OneCLI vault; the group gets none until its login is run again',
        {
          agentGroupId: identifier,
          provider,
        },
      );
    }
  }
  return missing;
}

/**
 * The secrets a new agent gets on a gateway with secret modes:
 * `ONECLI_NEW_AGENT_SECRETS`, a comma-separated list of secret names. Null when
 * unset, which leaves a new agent as the gateway makes it.
 */
export function newAgentSecretNames(
  value = process.env.ONECLI_NEW_AGENT_SECRETS || env.ONECLI_NEW_AGENT_SECRETS,
): string[] | null {
  const names = (value ?? '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
  return names.length > 0 ? names : null;
}

/**
 * Give the agent `toIdentifier` every secret the agent `fromIdentifier` holds,
 * so a closed session of a group keeps the tool secrets the operator granted to
 * the group (a GitHub token, say). Only adds, and runs on every closed spawn, so
 * a grant the operator adds later reaches the next closed session. It does not
 * remove a grant the group's agent has lost. Returns the ids attached, or null on
 * a gateway without grants (1.43 and older); `mirrorAgentSecrets` serves those.
 */
export async function copyAgentGrants(
  fromIdentifier: string,
  toIdentifier: string,
  opts: ProviderGrantOptions,
): Promise<string[] | null> {
  const doFetch = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl.replace(/\/+$/, '');
  const headers: Record<string, string> = {};
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;
  if (opts.projectId) headers['X-Project-Id'] = opts.projectId;
  const request = (path: string, method = 'GET') =>
    doFetch(`${base}${path}`, { method, headers, signal: AbortSignal.timeout(10_000) });
  const agents = await request('/v1/agents');
  if (agents.status === 404) return null;
  if (!agents.ok) throw new Error(`GET /v1/agents returned ${agents.status}`);
  const body = (await agents.json()) as unknown;
  const rows = (Array.isArray(body) ? body : (body as { data?: unknown }).data) as Array<Record<string, unknown>>;
  const idOf = (identifier: string) => {
    const agent = rows.find((a) => a.identifier === identifier);
    if (typeof agent?.id !== 'string') throw new Error(`OneCLI agent ${identifier} not found`);
    return `/v1/agents/${encodeURIComponent(agent.id)}`;
  };
  const from = idOf(fromIdentifier);
  const to = idOf(toIdentifier);
  const secretsOf = async (agentPath: string): Promise<Set<unknown> | null> => {
    const res = await request(`${agentPath}/grants`);
    if (res.status === 404 && (await isUnknownRoute(res))) return null;
    if (!res.ok) throw new Error(`GET ${agentPath}/grants returned ${res.status}`);
    const secrets = ((await res.json()) as { secrets?: unknown }).secrets;
    if (!Array.isArray(secrets)) throw new Error(`GET ${agentPath}/grants did not return a secrets list`);
    return new Set(secrets.map((g) => (g as { secretId?: unknown }).secretId));
  };
  const source = await secretsOf(from);
  if (source === null) return null;
  const held = (await secretsOf(to)) ?? new Set();
  const missing = [...source].filter((id): id is string => typeof id === 'string' && !held.has(id));
  for (const id of missing) {
    const res = await request(`${to}/grants/secrets/${encodeURIComponent(id)}`, 'PUT');
    if (!res.ok) throw new Error(`attaching secret ${id} returned ${res.status}`);
  }
  return missing;
}

/**
 * Make the secrets of the agent `toIdentifier` exactly the secrets of the agent
 * `fromIdentifier`, on a gateway built on OneCLI 1.43 or older (such as
 * onecli-cost). There an agent has one list of secrets and a mode, `all` or
 * `selective`. A closed session uses the closed agent of its group, so the closed
 * agent follows the group's agent, including a secret the operator revokes from
 * the group: it is removed from the closed agent too. The list is set first and
 * the mode second, so the closed agent never runs selective with nothing attached.
 * Returns `unsupported` on a gateway without these routes.
 */
export async function mirrorAgentSecrets(
  fromIdentifier: string,
  toIdentifier: string,
  opts: ProviderGrantOptions,
): Promise<'mirrored' | 'unsupported'> {
  const doFetch = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl.replace(/\/+$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;
  if (opts.projectId) headers['X-Project-Id'] = opts.projectId;
  const request = (path: string, method = 'GET', body?: unknown) =>
    doFetch(`${base}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10_000),
    });
  const agents = await request('/api/agents');
  if (agents.status === 404) return 'unsupported';
  if (!agents.ok) throw new Error(`GET /api/agents returned ${agents.status}`);
  const listed = (await agents.json()) as unknown;
  const rows = (Array.isArray(listed) ? listed : (listed as { data?: unknown }).data) as Array<Record<string, unknown>>;
  const find = (identifier: string) => {
    const agent = rows.find((a) => a.identifier === identifier);
    if (typeof agent?.id !== 'string') throw new Error(`OneCLI agent ${identifier} not found`);
    return agent;
  };
  const from = find(fromIdentifier);
  const to = find(toIdentifier);
  const fromPath = `/api/agents/${encodeURIComponent(from.id as string)}`;
  const toPath = `/api/agents/${encodeURIComponent(to.id as string)}`;
  const held = await request(`${fromPath}/secrets`);
  if (!held.ok) throw new Error(`GET ${fromPath}/secrets returned ${held.status}`);
  const secretIds = (await held.json()) as unknown;
  if (!Array.isArray(secretIds) || !secretIds.every((id) => typeof id === 'string')) {
    throw new Error(`GET ${fromPath}/secrets did not return a list of ids`);
  }
  const put = await request(`${toPath}/secrets`, 'PUT', { secretIds });
  if (!put.ok) throw new Error(`PUT ${toPath}/secrets returned ${put.status}`);
  const mode = await request(`${toPath}/secret-mode`, 'PATCH', {
    mode: from.secretMode === 'all' ? 'all' : 'selective',
  });
  if (!mode.ok) throw new Error(`PATCH ${toPath}/secret-mode returned ${mode.status}`);
  return 'mirrored';
}

/**
 * Give a new OneCLI agent only the install's base secrets. A gateway built on
 * OneCLI 1.43 or older (such as onecli-cost) creates an agent in secret mode
 * "all", so a new group could use every secret on the box: the model keys and
 * every GitHub token. We attach the secrets named in ONECLI_NEW_AGENT_SECRETS
 * (for example the inference key and the GitHub read tokens), then switch the
 * agent to "selective". An unknown name is logged and skipped. A gateway
 * without these routes (1.44 and newer, where an agent gets only its granted
 * secrets) is left alone. Returns what happened.
 */
export async function restrictNewAgentSecrets(
  identifier: string,
  secretNames: readonly string[],
  opts: ProviderGrantOptions,
): Promise<'restricted' | 'unsupported'> {
  const doFetch = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl.replace(/\/+$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;
  if (opts.projectId) headers['X-Project-Id'] = opts.projectId;
  const request = (path: string, method = 'GET', body?: unknown) =>
    doFetch(`${base}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10_000),
    });
  const list = async (res: Response, path: string): Promise<Array<Record<string, unknown>>> => {
    if (!res.ok) throw new Error(`GET ${path} returned ${res.status}`);
    const body = (await res.json()) as unknown;
    const rows = Array.isArray(body) ? body : (body as { data?: unknown }).data;
    if (!Array.isArray(rows)) throw new Error(`GET ${path} did not return a list`);
    return rows as Array<Record<string, unknown>>;
  };

  const agentsRes = await request('/api/agents');
  if (agentsRes.status === 404) return 'unsupported';
  const agent = (await list(agentsRes, '/api/agents')).find((a) => a.identifier === identifier);
  if (typeof agent?.id !== 'string') throw new Error(`OneCLI agent ${identifier} not found`);
  const agentPath = `/api/agents/${encodeURIComponent(agent.id)}`;

  const vault = await list(await request('/api/secrets'), '/api/secrets');
  const byName = new Map(vault.map((s) => [s.name, s.id]));
  const secretIds: string[] = [];
  for (const name of secretNames) {
    const id = byName.get(name);
    if (typeof id === 'string') secretIds.push(id);
    else log.warn('ONECLI_NEW_AGENT_SECRETS names a secret the vault does not have', { name });
  }
  // Attach first, then switch: the agent never runs selective with nothing attached.
  const put = await request(`${agentPath}/secrets`, 'PUT', { secretIds });
  if (!put.ok) throw new Error(`PUT ${agentPath}/secrets returned ${put.status}`);
  const mode = await request(`${agentPath}/secret-mode`, 'PATCH', { mode: 'selective' });
  if (!mode.ok) throw new Error(`PATCH ${agentPath}/secret-mode returned ${mode.status}`);
  return 'restricted';
}

// A new agent whose restriction has not succeeded yet. ensureAgent reports
// `created` only once, so the next setup retries the restriction for these
// identifiers. The set lives in a file because a host restart between the failed
// restriction and the retry would otherwise forget it, and the agent would keep
// every secret ('all' mode) for good.
const RESTRICTION_PENDING_FILE = 'onecli-restriction-pending.json';
let restrictionPending: Set<string> | null = null;

/** The identifiers whose restriction is pending, read from DATA_DIR once per process. */
function pendingRestrictions(): Set<string> {
  if (restrictionPending) return restrictionPending;
  restrictionPending = new Set();
  try {
    const ids = JSON.parse(fs.readFileSync(path.join(DATA_DIR, RESTRICTION_PENDING_FILE), 'utf-8')) as unknown;
    if (Array.isArray(ids)) for (const id of ids) if (typeof id === 'string') restrictionPending.add(id);
  } catch {
    /* no file yet: nothing pending */
  }
  return restrictionPending;
}

/** Add or remove a pending restriction and write the set back atomically. */
function setRestrictionPending(identifier: string, pending: boolean): void {
  const set = pendingRestrictions();
  if (pending) set.add(identifier);
  else set.delete(identifier);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, RESTRICTION_PENDING_FILE);
  fs.writeFileSync(`${file}.tmp`, JSON.stringify([...set]));
  fs.renameSync(`${file}.tmp`, file);
}

// One in-flight agent setup per agent group and provider in this host process:
// concurrent spawns share one ensureAgent call and one grants check.
const agentSetup = new Map<string, Promise<void>>();

function ensureAgentReady(identifier: string, name: string, provider: string | undefined): Promise<void> {
  const key = `${identifier}\0${provider ?? ''}`;
  const inFlight = agentSetup.get(key);
  if (inFlight) return inFlight;
  const setup = (async () => {
    const ensured = await onecli.ensureAgent({ name, identifier });
    const secretNames = newAgentSecretNames();
    if (secretNames && (ensured?.created || pendingRestrictions().has(identifier))) {
      setRestrictionPending(identifier, true);
      const outcome = await restrictNewAgentSecrets(identifier, secretNames, {
        baseUrl: onecliUrl || 'https://api.onecli.sh',
        apiKey: onecliApiKey,
        projectId: process.env.ONECLI_PROJECT_ID,
      });
      setRestrictionPending(identifier, false);
      if (outcome === 'restricted') {
        log.info('OneCLI agent restricted to the base secrets', {
          agentGroupId: identifier,
          secrets: secretNames.length,
        });
      }
    }
    if (!provider) return;
    let attached: string[] | null;
    try {
      attached = await grantProviderCredentials(identifier, provider, {
        baseUrl: onecliUrl || 'https://api.onecli.sh',
        apiKey: onecliApiKey,
        projectId: process.env.ONECLI_PROJECT_ID,
      });
    } catch (err) {
      throw new Error(
        `OneCLI: could not grant the ${provider} model credential to agent group ${identifier} ` +
          `(${(err as Error).message}); the next spawn retries`,
        { cause: err },
      );
    }
    if (attached?.length) {
      log.info('OneCLI model credential granted', { agentGroupId: identifier, provider, secrets: attached.length });
    }
  })();
  agentSetup.set(key, setup);
  const clear = () => {
    if (agentSetup.get(key) === setup) agentSetup.delete(key);
  };
  setup.then(clear, clear);
  return setup;
}

async function ensureSession(input: GatewaySessionInput, signal: AbortSignal): Promise<GatewaySessionLease> {
  // The OneCLI agent identifier is the agent group id — stable across sessions
  // and reversible via getAgentGroup() for approval routing. A closed session
  // (src/modules/session-privilege) uses `<group id>:closed` instead, so the
  // gateway can hold it to different rules than the group's open sessions.
  // Memoized per identifier and provider (fork delta, above): a provider switch
  // is a new key, so its model credential is still granted on the next spawn.
  const groupId = input.key.agentGroupId;
  const identifier = agentIdentifierFor(groupId, input.privilege);
  const closed = identifier !== groupId;
  const ensure = async (id: string, name: string) => {
    const key = `${id}\0${input.provider ?? ''}`;
    if (ensuredAgents.has(key)) return;
    await ensureAgentReady(id, name, input.provider);
    ensuredAgents.add(key);
  };
  const ensuredKey = `${identifier}\0${input.provider ?? ''}`;
  await ensure(groupId, input.groupName);
  if (closed) {
    await ensure(identifier, `${input.groupName} (closed)`);
    // The closed agent holds whatever the group's agent holds, so closed sessions keep the
    // tool secrets the operator granted to the group.
    try {
      const gatewayOpts = {
        baseUrl: onecliUrl || 'https://api.onecli.sh',
        apiKey: onecliApiKey,
        projectId: process.env.ONECLI_PROJECT_ID,
      };
      const copied = await copyAgentGrants(groupId, identifier, gatewayOpts);
      if (copied === null) await mirrorAgentSecrets(groupId, identifier, gatewayOpts);
      if (copied?.length)
        log.info('OneCLI closed agent grants copied', { agentGroupId: groupId, secrets: copied.length });
    } catch (err) {
      throw new Error(
        `OneCLI: could not copy the grants of agent group ${groupId} to its closed agent (${(err as Error).message}); the next spawn retries`,
        { cause: err },
      );
    }
  }
  let config;
  try {
    config = await onecli.getContainerConfig({ agent: identifier });
  } catch (err) {
    // The memo is an optimization, never a cache of truth: if the agent record
    // turns out to be gone, forget it so the next spawn re-ensures rather than
    // failing forever against a stale assumption.
    ensuredAgents.delete(ensuredKey);
    throw err;
  }
  const accountId = await stubAccountId(config);
  log.info('OneCLI gateway applied', { agentGroupId: groupId, sessionId: input.key.sessionId, closed });
  return {
    ...monitorLease(signal),
    contribution: {
      ...withProviderEnv(contributionFromConfig(config, input.key.agentGroupId, DATA_DIR, accountId)),
      networkAccess: {
        endpoint: 'host.docker.internal',
        target: { kind: 'runtime', identity: gatewayContainer },
      },
    },
  };
}

async function subscribeApprovals(
  decide: (request: GatewayApprovalRequest) => Promise<'approve' | 'deny'>,
  signal: AbortSignal,
  _resolved?: (requestId: string) => Promise<void>,
  scope?: GatewayApprovalScope,
): Promise<void> {
  if (!scope) throw new Error('OneCLI approval subscription requires installation ownership scope');
  const subscribedAt = Date.now();
  const client = new ApprovalClient(
    onecliUrl || 'https://api.onecli.sh',
    onecliApiKey || '',
    process.env.ONECLI_GATEWAY_URL || null,
    process.env.ONECLI_PROJECT_ID || null,
  );
  let stopped = false;
  const stop = () => {
    if (!stopped) {
      stopped = true;
      client.stop();
    }
  };
  if (signal.aborted) return;
  signal.addEventListener('abort', stop, { once: true });
  try {
    // Unlike configureManualApproval, start exposes gateway-URL discovery failures.
    await client.start(async (request: ApprovalRequest) => {
      // The local gateway poll is shared by installations. Throwing from the
      // pinned SDK callback submits no decision and leaves the request pending.
      // Keep this outside the deny-on-translation-error block, even for stale
      // requests: this copy has no authority over another copy's requests.
      if (!(await scope.ownsAgentGroup(agentGroupIdOfIdentifier(request.agent?.externalId ?? '')))) {
        throw new Error('OneCLI approval belongs to another installation');
      }
      if (signal.aborted || Date.parse(request.createdAt) < subscribedAt) return 'deny';
      try {
        return await decide(toGatewayApprovalRequest(request));
      } catch (err) {
        log.error('OneCLI approval translation failed closed', { requestId: request.id, err });
        return 'deny';
      }
    });
  } finally {
    signal.removeEventListener('abort', stop);
    stop();
  }
}

function toGatewayApprovalRequest(request: ApprovalRequest): GatewayApprovalRequest {
  return {
    id: request.id,
    trigger: 'policy',
    destination: { host: request.host, method: request.method },
    agentGroupId: agentGroupIdOfIdentifier(request.agent.externalId ?? ''),
    createdAt: request.createdAt,
    expiresAt: request.expiresAt,
    summary: normalizeGatewayApprovalSummary(
      { agent: request.agent.name, method: request.method, host: request.host, path: request.path },
      (request as ApprovalRequest & { summary?: ApprovalSummary }).summary,
    ),
    title: 'Credentials Request',
    question: buildQuestion(request, request.agent.name),
    audit: { method: request.method, host: request.host, path: request.path },
  };
}

interface ApprovalSummary {
  action?: string;
  details?: { label: string; value: string }[];
}

function safeApprovalText(value: string): string {
  return value.replace(/[<>&`*_~[\]()]/g, '_').replace(/[\0\r]/g, '');
}

function buildQuestion(request: ApprovalRequest, agentName: string): string {
  const lines = [`*Agent:* \`${safeApprovalText(agentName)}\``];
  const summary = (request as ApprovalRequest & { summary?: ApprovalSummary }).summary;
  if (summary?.details?.length) {
    if (summary.action) lines.push(`*Action:* \`${safeApprovalText(summary.action)}\``);
    let budget = 2_200;
    for (const { label, value } of summary.details) {
      if (budget <= 0) break;
      const raw = safeApprovalText(typeof value === 'string' ? value : (JSON.stringify(value) ?? String(value)));
      const shown = raw.slice(0, Math.min(900, budget));
      const safeLabel = safeApprovalText(String(label));
      lines.push(shown.includes('\n') ? `*${safeLabel}:*\n\`\`\`\n${shown}\n\`\`\`` : `*${safeLabel}:* \`${shown}\``);
      budget -= shown.length + String(label).length + 8;
    }
  } else {
    lines.push(`\`${safeApprovalText(`${request.method} ${request.host}${request.path.split(/[?#]/, 1)[0]}`)}\``);
  }
  return lines.join('\n').slice(0, 2_600);
}

registerGatewayProvider({
  kind: 'onecli',
  connections: {
    async connect() {
      const consoleUrl = process.env.ONECLI_CONSOLE_URL || env.ONECLI_CONSOLE_URL;
      return consoleUrl
        ? {
            status: 'action_required' as const,
            action: 'operator_console' as const,
            connect_url: consoleUrl,
            message:
              'Connect the account in OneCLI and grant access to the agent, then retry the original request. A native connect_url returned by the gateway can be used directly.',
          }
        : {
            status: 'unsupported' as const,
            message:
              'Use the native connect_url returned by OneCLI, or ask the operator to set ONECLI_CONSOLE_URL for a console handoff. Do not guess a dashboard URL from an API URL.',
          };
    },
  },
  agentSkills: ['onecli-gateway'],
  sessions: { ensure: ensureSession },
  approvals: { legacyActions: ['onecli_credential'], subscribe: subscribeApprovals },
});
