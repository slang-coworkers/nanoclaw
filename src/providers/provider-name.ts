/**
 * The one rule for which provider an agent group runs on: the session's
 * pinned provider, else the group's own `agent_provider`, else the group's
 * container config, else Claude. Spawn resolves through this, and so does
 * every host command that must validate against the group's actual provider
 * (e.g. `--speed`).
 *
 * `agentGroupProvider` is a real tier on this fork — upstream's rule has only
 * two, which makes a group-level provider pick silently lose to container.json.
 *
 * Every parameter is required, including the ones a caller has nothing for:
 * pass `undefined` explicitly. An optional tier is a tier a call site can omit
 * by accident, and omitting one shifts the remaining arguments onto the wrong
 * tiers — `resolveProviderName(session, config)` reads container.json as the
 * group and drops the group tier entirely, silently, with the same result
 * whenever the group happens to have no provider of its own. Requiring all
 * three makes that a compile error instead of a spawn that resolves two
 * different providers for one session.
 */
export function resolveProviderName(
  sessionProvider: string | null | undefined,
  agentGroupProvider: string | null | undefined,
  containerConfigProvider: string | null | undefined,
): string {
  return (sessionProvider || agentGroupProvider || containerConfigProvider || 'claude').toLowerCase();
}
