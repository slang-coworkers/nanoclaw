/**
 * The OneCLI rules that keep closed models away from an open session.
 *
 * An open session runs on the OneCLI agent `<group id>`. For that agent the gateway holds four
 * block rules:
 *
 * - `open-models-only (<id>)` refuses every POST, PUT or PATCH to the inference host whose JSON
 *   body names no open model, including a body that cannot be read, so the rule fails closed;
 * - `open-models-only (<id>) routes` refuses, for every method, the routes that pick the model
 *   from the URL, where a body `model` field could name an open model while the URL selects a
 *   closed one;
 * - `open-models-only (<id>) query` refuses a request of any method whose `model` query parameter
 *   names no open model. A WebSocket handshake is a GET that carries its model there;
 * - `open-models-only (<id>) closed hosts` refuses every request to a host of a closed-model
 *   vendor (`CLOSED_VENDOR_HOSTS`), on every method and path. The first three rules read the
 *   model on the inference host only, so without this one a client in the container, such as a
 *   nested Claude Code, reaches the vendor's own API with its telemetry and directory calls.
 *
 * The gateway matches a rule against the canonical path, so `/%6Dodel/info` and `//model/info`
 * meet the `routes` rule as `/model/info` does.
 *
 * A closed session uses the agent `<group id>-closed`, which has none of these rules. The gateway
 * needs `onecli-cost:v5` or later: its matcher reads `body` and `query` conditions with the `in`
 * and `not_in` operators, and matches the canonical path.
 */

/** How to reach the gateway's management API. */
export interface ModelRuleOptions {
  baseUrl: string;
  apiKey?: string;
  projectId?: string | null;
  fetchImpl?: typeof fetch;
}

/** Prefix of every rule name here; the full name appends the OneCLI agent identifier. */
export const OPEN_MODEL_RULE_PREFIX = 'open-models-only';

export function openModelRuleName(identifier: string): string {
  return `${OPEN_MODEL_RULE_PREFIX} (${identifier})`;
}

/**
 * The inference hosts an install sends model requests to: the host of each model base URL it sets.
 * The rule names these hosts, so a model request to any other host is outside it. The host and the
 * `scripts/open-model-rules.ts` script both read the list here.
 */
export function inferenceHostsOf(env: Record<string, string | undefined>): string[] {
  const hosts = (['ANTHROPIC_BASE_URL', 'OPENCODE_BASE_URL', 'CODEX_BASE_URL'] as const).flatMap((key) => {
    try {
      return env[key] ? [new URL(env[key]!).hostname] : [];
    } catch {
      return [];
    }
  });
  return [...new Set(hosts)];
}

/**
 * The hosts of the closed-model vendors (Anthropic, Claude, OpenAI, ChatGPT), which an open session
 * never calls. The gateway (`host_matches` in OneCLI's `connect.rs`) splits a pattern at its `*`
 * and compares the prefix and the suffix without case, so `*.anthropic.com` meets every subdomain
 * but not `anthropic.com` itself. Each domain is listed both ways for that reason. The two API
 * hosts are also listed by exact name, because an exact name is the one form that every gateway
 * version matches.
 */
export const CLOSED_VENDOR_HOSTS: readonly string[] = [
  'anthropic.com',
  '*.anthropic.com',
  'api.anthropic.com',
  'claude.ai',
  '*.claude.ai',
  'claude.com',
  '*.claude.com',
  'openai.com',
  '*.openai.com',
  'api.openai.com',
  'chatgpt.com',
  '*.chatgpt.com',
];

/** The methods whose body can name a model. The gateway reads a body for exactly these. */
const BODY_METHODS = ['POST', 'PUT', 'PATCH'] as const;
type BodyMethod = (typeof BODY_METHODS)[number];

/**
 * Inference routes that pick the model from the URL, which an open session never uses: Bedrock
 * (`/model/<id>/invoke`) and the NVIDIA `/llm/` route. Open sessions call the `/v1` routes, where
 * the model is in the body. The rule covers every method, so a GET or a WebSocket handshake on
 * these routes is refused too.
 */
const URL_MODEL_ROUTES = ['/model/*', '/llm/*'] as const;

interface RuleBody {
  name: string;
  action: 'block';
  enabled: true;
  requireApproval: false;
  identities: Array<{ type: 'agent'; id: string }>;
  /** A target without a `method` holds for every method. */
  targets: Array<{ kind: 'network'; hostPattern: string; method?: BodyMethod; pathPattern?: string }>;
  conditions: Array<{ target: 'body' | 'query'; key: 'model'; operator: 'not_in'; value: string }>;
}

/**
 * The rules the gateway must hold for one open agent: the body, routes and query rules on the
 * inference hosts, and the closed-hosts rule on `CLOSED_VENDOR_HOSTS`, which does not depend on
 * `hosts`.
 */
export function desiredOpenModelRules(
  identifier: string,
  agentId: string,
  hosts: string[],
  globs: string[],
): RuleBody[] {
  const sorted = [...hosts].sort();
  const base: Pick<RuleBody, 'action' | 'enabled' | 'requireApproval' | 'identities'> = {
    action: 'block',
    enabled: true,
    requireApproval: false,
    identities: [{ type: 'agent', id: agentId }],
  };
  return [
    {
      ...base,
      name: openModelRuleName(identifier),
      targets: sorted.flatMap((hostPattern) =>
        BODY_METHODS.map((method) => ({ kind: 'network' as const, hostPattern, method })),
      ),
      conditions: [{ target: 'body', key: 'model', operator: 'not_in', value: globs.join(',') }],
    },
    {
      ...base,
      name: `${openModelRuleName(identifier)} routes`,
      targets: sorted.flatMap((hostPattern) =>
        URL_MODEL_ROUTES.map((pathPattern) => ({ kind: 'network' as const, hostPattern, pathPattern })),
      ),
      conditions: [],
    },
    {
      ...base,
      name: `${openModelRuleName(identifier)} query`,
      targets: sorted.map((hostPattern) => ({ kind: 'network' as const, hostPattern })),
      conditions: [{ target: 'query', key: 'model', operator: 'not_in', value: globs.join(',') }],
    },
    {
      ...base,
      name: `${openModelRuleName(identifier)} closed hosts`,
      // A target with no method and no path holds for every method and every path of its host.
      targets: CLOSED_VENDOR_HOSTS.map((hostPattern) => ({ kind: 'network' as const, hostPattern })),
      conditions: [],
    },
  ];
}

type Json = Record<string, unknown>;

/** A rule of ours: a block rule with our name prefix. A rule of another action never counts, whatever its name. */
const isModelRule = (rule: Json) =>
  rule.action === 'block' && String(rule.name).startsWith(`${OPEN_MODEL_RULE_PREFIX} (`);

/** The project's custom rules in the order the gateway applies them. */
const customInOrder = (rules: Json[]) =>
  rules.filter((r) => r.isDefault !== true).sort((a, b) => Number(a.priority) - Number(b.priority));

/** Whether no rule of another kind stands before the rule at `name`, so it is not shadowed. */
function leads(rules: Json[], name: string): boolean {
  const order = customInOrder(rules);
  const at = order.findIndex((r) => r.name === name);
  return at >= 0 && order.slice(0, at).every(isModelRule);
}

/** Whether a rule as the gateway lists it already says what `want` says. */
function holdsRule(rule: Json, want: RuleBody): boolean {
  const key = (items: unknown, fields: string[]) =>
    (Array.isArray(items) ? (items as Json[]) : [])
      .map((item) => fields.map((f) => String(item[f] ?? '')).join('|'))
      .sort()
      .join('\n');
  return (
    rule.enabled === true &&
    rule.action === want.action &&
    !rule.requireApproval &&
    key(rule.identities, ['type', 'id']) === key(want.identities, ['type', 'id']) &&
    key(rule.targets, ['kind', 'hostPattern', 'pathPattern', 'method']) ===
      key(want.targets, ['kind', 'hostPattern', 'pathPattern', 'method']) &&
    key(rule.conditions, ['target', 'key', 'operator', 'value']) ===
      key(want.conditions, ['target', 'key', 'operator', 'value'])
  );
}

/**
 * Make the gateway refuse closed models and the closed-model vendors' hosts to the OneCLI agent
 * `identifier` (`desiredOpenModelRules`), and return what happened: `unchanged` when the published
 * rules already say so, `installed` after a write and a publish, `unsupported` when the gateway has
 * no policy API. A gateway that has the API but not the matcher refuses the rule (422), and that is
 * an error: an open session must not start without the boundary. After a publish the live rules
 * are read back, and a mismatch is an error too.
 *
 * The open-models-only rules lead the project's order, because the gateway applies the first rule
 * that matches, and an earlier allow rule for the same host would otherwise win. The rules of
 * several agents do not overlap, so they keep whatever order they have among themselves.
 * Publishing makes the whole draft live, so a draft someone else left in the project goes live
 * with it. The caller runs one of these at a time for the whole project, because two runs that
 * interleave could publish each other's half-written draft.
 */
export async function ensureOpenModelRule(
  identifier: string,
  hosts: string[],
  globs: string[],
  opts: ModelRuleOptions,
): Promise<'unchanged' | 'installed' | 'unsupported'> {
  if (hosts.length === 0) throw new Error('no inference host is configured, so no model rule can name one');
  if (globs.length === 0) throw new Error('no open-weights model is configured, so the model rule would refuse all');
  const doFetch = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl.replace(/\/+$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;
  if (opts.projectId) headers['X-Project-Id'] = opts.projectId;
  const call = (path: string, method = 'GET', body?: unknown) =>
    doFetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  const rows = async (res: Response, what: string): Promise<Json[]> => {
    if (!res.ok) throw new Error(`${what} returned ${res.status}`);
    const body = (await res.json()) as unknown;
    const list = Array.isArray(body) ? body : (body as { data?: unknown }).data;
    if (!Array.isArray(list)) throw new Error(`${what} did not return a list`);
    return list as Json[];
  };
  const refuse = async (res: Response, what: string): Promise<never> => {
    const detail = (await res.text().catch(() => '')).slice(0, 200);
    const hint = res.status === 422 ? ' (the gateway may be older than onecli-cost v5)' : '';
    throw new Error(`${what} returned ${res.status}${hint}: ${detail}`);
  };
  const list = (status: 'draft' | 'published') =>
    call(`/v1/policy/rules?status=${status}`).then((res) => rows(res, `GET /v1/policy/rules?status=${status}`));

  const agentRows = await rows(await call('/v1/agents'), 'GET /v1/agents');
  const agentId = agentRows.find((a) => a.identifier === identifier)?.id;
  if (typeof agentId !== 'string') throw new Error(`OneCLI agent ${identifier} not found`);
  const wants = desiredOpenModelRules(identifier, agentId, hosts, globs);

  const draftRes = await call('/v1/policy/rules?status=draft');
  if (draftRes.status === 404) return 'unsupported';
  let draft = await rows(draftRes, 'GET /v1/policy/rules?status=draft');
  const published = await list('published');

  let changed = false;
  for (const want of wants) {
    const mine = draft.find((r) => r.name === want.name);
    if (!mine) {
      const created = await call('/v1/policy/rules', 'POST', want);
      if (!created.ok) await refuse(created, 'POST /v1/policy/rules');
      changed = true;
    } else if (!holdsRule(mine, want)) {
      const { name: _name, ...fields } = want;
      const patched = await call(`/v1/policy/rules/${encodeURIComponent(String(mine.id))}`, 'PATCH', fields);
      if (!patched.ok) await refuse(patched, 'PATCH /v1/policy/rules');
      changed = true;
    }
  }

  // The order is part of the rule: the model rules stand before every other custom rule.
  if (changed) draft = await list('draft');
  if (!wants.every((w) => leads(draft, w.name))) {
    const order = customInOrder(draft);
    const orderedIds = [...order.filter(isModelRule), ...order.filter((r) => !isModelRule(r))].map((r) => String(r.id));
    const ordered = await call('/v1/policy/rules/order', 'PUT', { orderedIds });
    if (!ordered.ok) await refuse(ordered, 'PUT /v1/policy/rules/order');
    changed = true;
  }

  const live = (rules: Json[]) =>
    wants.every((w) => {
      const rule = rules.find((r) => r.name === w.name);
      return rule !== undefined && holdsRule(rule, w) && leads(rules, w.name);
    });
  if (!changed && live(published)) return 'unchanged';
  const publish = await call('/v1/policy/publish', 'POST', {});
  if (!publish.ok) await refuse(publish, 'POST /v1/policy/publish');
  if (!live(await list('published'))) {
    throw new Error('the published rules do not match the open-models-only rules after the publish');
  }
  return 'installed';
}
