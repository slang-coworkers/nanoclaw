/**
 * The session provider pin: `sessions.agent_provider`, the first tier of
 * `resolveProviderName` (session pin → group provider → container config →
 * default). `ncl sessions update --provider` sets and clears it, and
 * `ncl sessions get/list` show it next to the provider the session runs on.
 *
 * Consider a group that runs on OpenCode, with one session that should try
 * Codex for a while:
 *
 *   ncl sessions update --id sess-1 --provider codex
 *   ncl sessions update --id sess-1 --provider ''     # back to the group's provider
 *
 * The command checks the pin the way spawn will check it: it resolves the
 * provider the session would run on, resolves each model role for that
 * provider and the session's privilege (`resolveSessionModels`, the helper
 * spawn calls), and refuses on any model policy violation. A pin that would
 * make a `weights=open` group call a closed model therefore fails at the
 * command, not at the session's next start.
 *
 * The pin is read at spawn, so a running container keeps its provider until it
 * stops. `--restart` stops this one session's container; the next message to
 * the session starts it on the new provider.
 */
import { isContainerRunning, killContainer } from '../container-runner.js';
import { getAgentGroup } from '../db/agent-groups.js';
import { getContainerConfig } from '../db/container-configs.js';
import { getSession, updateSession } from '../db/sessions.js';
import { modelPolicyViolations } from '../model-policy.js';
import { resolveSessionModels } from '../modules/session-privilege/index.js';
import { knownProviderNames, resolveProviderTier, type ProviderTier } from '../providers/provider-name.js';
import type { Session } from '../types.js';

/** The provider a session runs on, and the tier that decides it. */
interface SessionProvider {
  effective_provider: string;
  provider_source: ProviderTier;
}

/** The stored provider tiers of a group, and its container config row. */
async function groupProviderTiers(agentGroupId: string) {
  const [agentGroup, configRow] = await Promise.all([getAgentGroup(agentGroupId), getContainerConfig(agentGroupId)]);
  return { group: agentGroup?.agent_provider, config: configRow?.provider, configRow };
}

/** The provider a session with `pin` runs on, given its group's stored tiers. */
function sessionProvider(
  pin: string | null | undefined,
  tiers: { group: string | null | undefined; config: string | null | undefined },
): SessionProvider {
  const { provider, tier } = resolveProviderTier({
    override: undefined,
    session: pin,
    group: tiers.group,
    config: tiers.config,
  });
  return { effective_provider: provider, provider_source: tier };
}

/**
 * Add `effective_provider` and `provider_source` to session rows from the
 * generic `sessions list/get`. Each row keeps its stored `agent_provider` (the
 * pin); the group lookups run once per group, not once per row.
 */
export async function presentSessionProviders(rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
  const byGroup = new Map<string, ReturnType<typeof groupProviderTiers>>();
  return Promise.all(
    rows.map(async (row) => {
      const agentGroupId = String(row.agent_group_id);
      if (!byGroup.has(agentGroupId)) byGroup.set(agentGroupId, groupProviderTiers(agentGroupId));
      const tiers = await byGroup.get(agentGroupId)!;
      return { ...row, ...sessionProvider(row.agent_provider as string | null, tiers) };
    }),
  );
}

export interface SessionPinResult extends SessionProvider {
  id: string;
  agent_group_id: string;
  /** The stored pin after the update; null when the session follows its group. */
  agent_provider: string | null;
  previous_pin: string | null;
  container_running: boolean;
  restarted: boolean;
}

/**
 * Set or clear a session's provider pin (`ncl sessions update`). Refuses an
 * unknown provider and a pin the model policy would refuse at spawn; stops the
 * session's running container when `restart` is set.
 */
export async function pinSessionProvider(args: Record<string, unknown>): Promise<SessionPinResult> {
  const id = args.id as string;
  const pin = String(args.provider).trim().toLowerCase() || null;
  const session: Session | undefined = await getSession(id);
  if (!session) throw new Error(`session not found: ${id}`);

  if (pin !== null && !knownProviderNames().includes(pin)) {
    throw new Error(
      `Unknown provider "${pin}". Known providers: ${knownProviderNames().join(', ')}. ` +
        "Pass --provider '' to clear the pin.",
    );
  }

  const tiers = await groupProviderTiers(session.agent_group_id);
  const resolved = sessionProvider(pin, tiers);
  const problems = modelPolicyViolations(
    resolveSessionModels(resolved.effective_provider, tiers.configRow ?? {}, session),
  );
  if (problems.length > 0) {
    const what = pin ? `pin session ${id} to ${pin}` : `clear the pin of session ${id}`;
    throw new Error(
      `Model policy refuses to ${what}: it would run on ${resolved.effective_provider}, and ${problems.join('; ')}`,
    );
  }

  await updateSession(id, { agent_provider: pin });

  const running = isContainerRunning(id);
  const restart = args.restart === true && running;
  if (restart) killContainer(id, `provider pin changed via ncl (now ${resolved.effective_provider})`);

  return {
    id,
    agent_group_id: session.agent_group_id,
    agent_provider: pin,
    previous_pin: session.agent_provider ?? null,
    effective_provider: resolved.effective_provider,
    provider_source: resolved.provider_source,
    container_running: running && !restart,
    restarted: restart,
  };
}

const SOURCE_TEXT: Record<ProviderTier, string> = {
  override: 'the command',
  session: 'the session pin',
  group: "the group's provider",
  config: "the group's container config",
  default: 'the install default',
};

/** Human output of `ncl sessions update`: what changed, and when it applies. */
export function formatSessionPin(data: unknown): string {
  const r = data as SessionPinResult;
  const change = r.agent_provider
    ? `Session ${r.id} is pinned to ${r.agent_provider} (was: ${r.previous_pin ?? 'no pin'}).`
    : `Session ${r.id} has no pin now (was: ${r.previous_pin ?? 'no pin'}).`;
  const runsOn = `It runs on ${r.effective_provider}, from ${SOURCE_TEXT[r.provider_source]}.`;
  let when: string;
  if (r.restarted) {
    when = `Its container was stopped; the next message starts it on ${r.effective_provider}.`;
  } else if (r.container_running) {
    when =
      "The pin applies at the session's next spawn, and its container is running now on the old provider. " +
      `To apply it now, run the same command with --restart (stops only this session's container), ` +
      `or \`ncl groups restart --id ${r.agent_group_id}\` (restarts every running container of the group).`;
  } else {
    when = `The pin applies at the session's next spawn: no container runs now, so the next message starts it on ${r.effective_provider}.`;
  }
  return [change, runsOn, when].join('\n');
}
