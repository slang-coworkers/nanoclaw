/**
 * OneCLI — the built-in gateway provider.
 *
 * The same wiring the spawn path always did (ensure the agent exists
 * gateway-side, fetch the per-session container config, treat "not applied" as
 * a transient hard failure), with one change: the contribution crosses into
 * the spec as TYPED env and mounts, merged before validation, instead of raw
 * docker flags appended after it.
 *
 * The SDK's apply surface still emits argv, so this provider parses it at the
 * boundary. The grammar is closed and known from the SDK source: with
 * `addHostMapping: false` it emits exactly `-e KEY=VALUE` pairs (proxy env,
 * CA bundle pointers) and `-v host:container[:ro]` mounts (the CA
 * certificate, credential stub FILES — stubs never ride env). Anything else
 * refuses the spawn: nothing gets to ride raw argv around the spec again. A
 * typed SDK config surface is the successor that deletes this parser.
 */
import fs from 'fs';
import path from 'path';

import { OneCLI } from '@onecli-sh/sdk';

import { CONTAINER_PREFIX, ONECLI_API_KEY, ONECLI_URL } from '../config.js';
import type { MountSpec } from '../drivers/types.js';
import { log } from '../log.js';

import {
  registerGatewayProvider,
  type GatewayApprovalRequest,
  type GatewayApprovalSource,
  type GatewayContribution,
} from './gateway-provider-registry.js';

const onecli = new OneCLI({ url: ONECLI_URL, apiKey: ONECLI_API_KEY });

/** Shared paths the SDK writes its CA material to, regardless of install. */
const SHARED_CA_PATH = path.join('/tmp', 'onecli-proxy-ca.pem');
const SHARED_COMBINED_CA_PATH = path.join('/tmp', 'onecli-combined-ca.pem');

/**
 * Give this install its own copy of the CA material and point the emitted
 * mounts at it.
 *
 * `applyContainerConfig` writes to the two SHARED `/tmp` paths above, so when
 * several installs (lego / prod / dev) share a host the last writer wins — and
 * a peer's already-running containers keep those paths bind-mounted, so they
 * start presenting a CA that no longer matches their proxy. Copy ours aside,
 * rewrite only the `-v` SOURCE paths to the copies, then put the shared files
 * back exactly as we found them.
 *
 * Container-side targets are deliberately untouched: the agent-runner and the
 * `GIT_SSL_CAINFO` / `REQUESTS_CA_BUNDLE` / `PIP_CERT` env values all name
 * `/tmp/onecli-combined-ca.pem` inside the container, and rewriting those
 * would break every one of them.
 */
function isolateCaMaterial(args: string[], savedCa: Buffer | null, savedCombined: Buffer | null): void {
  const caPrefix = `onecli-${CONTAINER_PREFIX}`;
  const instanceCaPath = path.join('/tmp', `${caPrefix}-proxy-ca.pem`);
  const instanceCombinedPath = path.join('/tmp', `${caPrefix}-combined-ca.pem`);
  try {
    if (fs.existsSync(SHARED_CA_PATH)) fs.copyFileSync(SHARED_CA_PATH, instanceCaPath);
    if (fs.existsSync(SHARED_COMBINED_CA_PATH)) fs.copyFileSync(SHARED_COMBINED_CA_PATH, instanceCombinedPath);
    if (savedCa) fs.writeFileSync(SHARED_CA_PATH, savedCa);
    if (savedCombined) fs.writeFileSync(SHARED_COMBINED_CA_PATH, savedCombined);
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-v' && typeof args[i + 1] === 'string') {
        args[i + 1] = args[i + 1]
          .replace(`${SHARED_CA_PATH}:`, `${instanceCaPath}:`)
          .replace(`${SHARED_COMBINED_CA_PATH}:`, `${instanceCombinedPath}:`);
      }
    }
  } catch (err) {
    // Best effort: on a single-install host the shared paths are already
    // correct, so a failure here is not worth aborting a spawn over.
    log.warn('OneCLI CA isolation skipped', { err });
  }
}

function readIfPresent(file: string): Buffer | null {
  try {
    return fs.readFileSync(file);
  } catch {
    return null;
  }
}

/** Argv → typed contribution. Exported for its tests; the grammar is closed. */
export function contributionFromArgs(args: readonly string[], groupScope: string): GatewayContribution {
  const env: Record<string, string> = {};
  const mounts: MountSpec[] = [];
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    if (flag === '-e' && value?.includes('=')) {
      const eq = value.indexOf('=');
      env[value.slice(0, eq)] = value.slice(eq + 1);
      continue;
    }
    if (flag === '-v' && value) {
      const parts = value.split(':');
      if (parts.length >= 2 && parts.length <= 3 && (parts[2] === undefined || parts[2] === 'ro')) {
        mounts.push({
          class: 'allowlisted-extra',
          hostPath: parts[0],
          containerPath: parts[1],
          mode: parts[2] === 'ro' ? 'ro' : 'rw',
          groupScope,
        });
        continue;
      }
    }
    // Fail-closed on grammar drift: an SDK that starts emitting a flag this
    // parser cannot type must break the spawn loudly, not smuggle argv.
    throw new Error(`OneCLI gateway emitted argv this seam cannot type: '${flag} ${value ?? ''}'`);
  }
  return { env, mounts };
}

/**
 * OneCLI's approvals capability: the SDK's manual-approval long-poll, mapped
 * to the neutral request shape. `listPending`/`decide` are deliberately
 * absent — the gateway does not redeliver un-decided requests on reconnect
 * and the SDK exposes no late-decision surface, so the capability flags
 * honestly say so and the approvals module degrades accordingly.
 */
function onecliApprovalSource(): GatewayApprovalSource {
  return {
    subscribe(handler) {
      const handle = onecli.configureManualApproval(async (request) =>
        // The SDK's ApprovalRequest is structurally the neutral shape (the
        // hosted gateway's `summary` rides as an extra field).
        handler(request as unknown as GatewayApprovalRequest),
      );
      return { stop: () => handle.stop() };
    },
  };
}

registerGatewayProvider('onecli', () => ({
  kind: 'onecli',
  approvals: onecliApprovalSource,
  async contribute({ key, groupName }) {
    // OneCLI agent identifier is always the agent group id — stable across
    // sessions and reversible via getAgentGroup() for approval routing.
    await onecli.ensureAgent({ name: groupName, identifier: key.agentGroupId });
    // Snapshot the shared CA files BEFORE applyContainerConfig overwrites
    // them — a peer install's running containers may have these paths mounted.
    const savedCa = readIfPresent(SHARED_CA_PATH);
    const savedCombined = readIfPresent(SHARED_COMBINED_CA_PATH);
    const args: string[] = [];
    const applied = await onecli.applyContainerConfig(args, { addHostMapping: false, agent: key.agentGroupId });
    if (!applied) {
      throw new Error('OneCLI gateway not applied — refusing to spawn container without credentials');
    }
    isolateCaMaterial(args, savedCa, savedCombined);
    log.info('OneCLI gateway applied', { agentGroupId: key.agentGroupId, sessionId: key.sessionId });
    return contributionFromArgs(args, key.agentGroupId);
  },
}));
