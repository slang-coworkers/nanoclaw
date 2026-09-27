/**
 * OneCLI contributes typed environment and read-only file mounts, before spec
 * validation. Persist its CA and credential stubs across host restarts; the
 * SDK's argv helper stages shared paths in the host temporary directory.
 */
import { OneCLI, type ContainerConfig } from '@onecli-sh/sdk';

import { DATA_DIR, ONECLI_API_KEY, ONECLI_URL } from '../config.js';
import type { MountSpec } from '../drivers/types.js';
import { log } from '../log.js';

import {
  registerGatewayProvider,
  type GatewayApprovalRequest,
  type GatewayApprovalSource,
  type GatewayContribution,
} from './gateway-provider-registry.js';

import { combinedCaBundle, stageOnecliFile } from './onecli-files.js';

// The SDK's default abort is 5 s. On prod (2026-09-27) that timer fired while
// the host's JS thread was busy with a sweep burst and killed spawn requests
// the gateway had answered in 8 ms — hundreds of "aborted due to timeout"
// wakes against a healthy OneCLI. 30 s is a backstop for a genuinely stuck
// gateway, not a budget the happy path ever approaches.
const ONECLI_TIMEOUT_MS = Number(process.env.ONECLI_TIMEOUT_MS) > 0 ? Number(process.env.ONECLI_TIMEOUT_MS) : 30_000;
const onecli = new OneCLI({ url: ONECLI_URL, apiKey: ONECLI_API_KEY, timeout: ONECLI_TIMEOUT_MS });

// Agent groups whose OneCLI agent this process has already ensured. The agent
// record is durable, so one successful ensureAgent per group per process is
// enough; every further spawn of the group skips the POST entirely (the same
// call that used to time out). Dropped again if the config read fails, in
// case the agent was deleted out-of-band — the next spawn re-ensures.
const ensuredAgents = new Set<string>();
export function _resetEnsuredAgentsForTesting(): void {
  ensuredAgents.clear();
}

/** Convert the typed SDK response without its shared temporary-file side effects. */
function contributionFromConfig(config: ContainerConfig, groupScope: string): GatewayContribution {
  const env = { ...config.env };
  const mounts: MountSpec[] = [];
  const mount = (kind: 'ca' | 'combined' | 'stub', content: string, containerPath: string) => {
    mounts.push({
      class: 'allowlisted-extra',
      hostPath: stageOnecliFile(DATA_DIR, kind, content),
      containerPath,
      mode: 'ro',
      groupScope,
    });
  };
  mount('ca', config.caCertificate, config.caCertificateContainerPath);
  const combined = combinedCaBundle(config.caCertificate);
  if (combined !== undefined) {
    const containerPath = '/tmp/onecli-combined-ca.pem';
    mount('combined', combined, containerPath);
    env.SSL_CERT_FILE = containerPath;
    env.DENO_CERT = containerPath;
  }
  for (const stub of config.credentialStubs ?? []) {
    mount('stub', stub.content, stub.containerPath);
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
    if (!ensuredAgents.has(key.agentGroupId)) {
      await onecli.ensureAgent({ name: groupName, identifier: key.agentGroupId });
      ensuredAgents.add(key.agentGroupId);
    }
    let config: ContainerConfig;
    try {
      config = await onecli.getContainerConfig({ agent: key.agentGroupId });
    } catch (err) {
      ensuredAgents.delete(key.agentGroupId);
      throw err;
    }
    const contribution = contributionFromConfig(config, key.agentGroupId);
    log.info('OneCLI gateway applied', { agentGroupId: key.agentGroupId, sessionId: key.sessionId });
    return contribution;
  },
}));
