import { describe, expect, it } from 'vitest';

import { desiredOpenModelRules, ensureOpenModelRule, openModelRuleName } from './onecli-model-rule.js';

type Rule = Record<string, unknown> & { id: string; name: string; priority: number };

/**
 * A gateway with the v2 policy API: a draft list, a published list, ordering, and a publish
 * that copies the draft. `refuseBodyConditions` models a gateway older than onecli-cost v4.
 */
function policyGateway(
  opts: { agents?: string[]; noPolicyApi?: boolean; refuseBodyConditions?: boolean; publishIsIgnored?: boolean } = {},
) {
  const agents = (opts.agents ?? ['g1']).map((identifier) => ({ id: `id-${identifier}`, identifier }));
  let draft: Rule[] = [];
  let published: Rule[] = [];
  let nextId = 1;
  const writes: string[] = [];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const renumber = () => draft.forEach((r, i) => (r.priority = i + 1));
  const fetchImpl = (async (url: string, init: RequestInit = {}) => {
    const { pathname, searchParams } = new URL(url);
    const method = init.method ?? 'GET';
    const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    if (method !== 'GET') writes.push(`${method} ${pathname}`);
    if (pathname === '/v1/agents') return json(agents);
    if (opts.noPolicyApi) return json({ error: { message: 'Unrecognized request URL' } }, 404);
    if (pathname === '/v1/policy/rules' && method === 'GET') {
      const list = searchParams.get('status') === 'published' ? published : draft;
      return json(list.map((r) => structuredClone(r)));
    }
    if (pathname === '/v1/policy/rules' && method === 'POST') {
      if (opts.refuseBodyConditions) return json({ error: { message: 'invalid operator' } }, 422);
      draft.push({ ...structuredClone(body), id: `r${nextId++}`, priority: 0, isDefault: false } as unknown as Rule);
      renumber();
      return json({ id: draft[draft.length - 1]!.id }, 201);
    }
    const one = pathname.match(/^\/v1\/policy\/rules\/([^/]+)$/);
    if (one && method === 'PATCH') {
      const rule = draft.find((r) => r.id === one[1]);
      if (!rule) return json({}, 404);
      Object.assign(rule, structuredClone(body));
      return json(rule);
    }
    if (pathname === '/v1/policy/rules/order' && method === 'PUT') {
      const ids = body.orderedIds as string[];
      draft = ids.map((id) => draft.find((r) => r.id === id)!);
      renumber();
      return json(draft);
    }
    if (pathname === '/v1/policy/publish' && method === 'POST') {
      if (!opts.publishIsIgnored) published = structuredClone(draft);
      return json({ generation: 1, ruleCount: published.length });
    }
    return json({}, 404);
  }) as unknown as typeof fetch;
  return {
    fetchImpl,
    writes,
    draft: () => draft,
    published: () => published,
    seed: (rule: Partial<Rule>) => {
      draft.push({ id: `r${nextId++}`, name: 'other', priority: 0, isDefault: false, ...rule } as Rule);
      renumber();
    },
    dropPublished: () => (published = []),
  };
}

const HOSTS = ['inference-api.nvidia.com'];
const GLOBS = ['nvidia/zai-org/*', 'openai/nvidia/zai-org/*'];
const options = (g: ReturnType<typeof policyGateway>) => ({ baseUrl: 'http://gw', fetchImpl: g.fetchImpl });

describe('open-models-only rule', () => {
  it('names the rules after the OneCLI agent and lists the open models as one string', () => {
    const [body, routes] = desiredOpenModelRules('g1', 'id-g1', ['b.example', 'a.example'], GLOBS);
    expect(body!.name).toBe(openModelRuleName('g1'));
    expect(routes!.name).toBe(`${openModelRuleName('g1')} routes`);
    for (const rule of [body!, routes!]) {
      expect(rule.action).toBe('block');
      expect(rule.identities).toEqual([{ type: 'agent', id: 'id-g1' }]);
    }
    expect(body!.targets.map((t) => `${t.method} ${t.hostPattern}`)).toEqual([
      'POST a.example',
      'PUT a.example',
      'PATCH a.example',
      'POST b.example',
      'PUT b.example',
      'PATCH b.example',
    ]);
    expect(body!.conditions).toEqual([
      { target: 'body', key: 'model', operator: 'not_in', value: 'nvidia/zai-org/*,openai/nvidia/zai-org/*' },
    ]);
    // The routes rule has no condition: it refuses the URL-model routes outright.
    expect(routes!.conditions).toEqual([]);
    expect(new Set(routes!.targets.map((t) => t.pathPattern))).toEqual(new Set(['/model/*', '/llm/*']));
  });

  it('installs the rule for the agent and publishes it', async () => {
    const g = policyGateway();
    await expect(ensureOpenModelRule('g1', HOSTS, GLOBS, options(g))).resolves.toBe('installed');
    expect(g.published().map((r) => r.name)).toEqual([openModelRuleName('g1'), `${openModelRuleName('g1')} routes`]);
    expect(g.published()[0]).toMatchObject({ action: 'block', enabled: true });
    expect(g.writes).toEqual(['POST /v1/policy/rules', 'POST /v1/policy/rules', 'POST /v1/policy/publish']);
  });

  it('changes nothing when the published rule is already right', async () => {
    const g = policyGateway();
    await ensureOpenModelRule('g1', HOSTS, GLOBS, options(g));
    g.writes.length = 0;
    await expect(ensureOpenModelRule('g1', HOSTS, GLOBS, options(g))).resolves.toBe('unchanged');
    expect(g.writes).toEqual([]);
  });

  it('repairs a rule someone edited and publishes the repair', async () => {
    const g = policyGateway();
    await ensureOpenModelRule('g1', HOSTS, GLOBS, options(g));
    g.draft()[0]!.enabled = false;
    g.draft()[0]!.conditions = [{ target: 'body', key: 'model', operator: 'not_in', value: '*' }];
    g.writes.length = 0;
    await expect(ensureOpenModelRule('g1', HOSTS, GLOBS, options(g))).resolves.toBe('installed');
    expect(g.writes).toEqual(['PATCH /v1/policy/rules/r1', 'POST /v1/policy/publish']);
    expect(g.published()[0]).toMatchObject({ enabled: true });
    expect((g.published()[0]!.conditions as Array<{ value: string }>)[0]!.value).toBe(GLOBS.join(','));
  });

  it('publishes again when the draft is right but the live rule is missing', async () => {
    const g = policyGateway();
    await ensureOpenModelRule('g1', HOSTS, GLOBS, options(g));
    g.dropPublished();
    g.writes.length = 0;
    await expect(ensureOpenModelRule('g1', HOSTS, GLOBS, options(g))).resolves.toBe('installed');
    expect(g.writes).toEqual(['POST /v1/policy/publish']);
    expect(g.published()).toHaveLength(2);
  });

  it('puts the rule before an allow rule for the same host, because the first match wins', async () => {
    const g = policyGateway();
    g.seed({ name: 'allow-inference', action: 'allow' });
    await ensureOpenModelRule('g1', HOSTS, GLOBS, options(g));
    expect(g.published().map((r) => r.name)).toEqual([
      openModelRuleName('g1'),
      `${openModelRuleName('g1')} routes`,
      'allow-inference',
    ]);
    // A later change that puts another rule first is put right at the next check.
    const moveLast = (rules: Rule[]) => {
      rules.push(rules.shift()!);
      rules.forEach((r, i) => (r.priority = i + 1));
    };
    moveLast(g.draft());
    moveLast(g.published());
    await expect(ensureOpenModelRule('g1', HOSTS, GLOBS, options(g))).resolves.toBe('installed');
    expect(g.published().map((r) => r.name)[2]).toBe('allow-inference');
    expect(
      g
        .published()
        .slice(0, 2)
        .map((r) => r.name)
        .sort(),
    ).toEqual([openModelRuleName('g1'), `${openModelRuleName('g1')} routes`].sort());
  });

  it('keeps one rule per agent, and the rules of several agents do not move each other', async () => {
    const g = policyGateway({ agents: ['g1', 'g2'] });
    await ensureOpenModelRule('g1', HOSTS, GLOBS, options(g));
    await ensureOpenModelRule('g2', HOSTS, GLOBS, options(g));
    await expect(ensureOpenModelRule('g1', HOSTS, GLOBS, options(g))).resolves.toBe('unchanged');
    expect(g.published().map((r) => r.name)).toEqual([
      openModelRuleName('g1'),
      `${openModelRuleName('g1')} routes`,
      openModelRuleName('g2'),
      `${openModelRuleName('g2')} routes`,
    ]);
  });

  it('does not count an allow rule as ours because of its name', async () => {
    const g = policyGateway();
    g.seed({ name: `${openModelRuleName('g1')} (copy)`, action: 'allow' });
    await ensureOpenModelRule('g1', HOSTS, GLOBS, options(g));
    expect(g.published()[2]).toMatchObject({ action: 'allow' });
    expect(
      g
        .published()
        .slice(0, 2)
        .map((r) => r.action),
    ).toEqual(['block', 'block']);
  });

  it('fails when the live rules do not match after the publish', async () => {
    const g = policyGateway({ publishIsIgnored: true });
    await expect(ensureOpenModelRule('g1', HOSTS, GLOBS, options(g))).rejects.toThrow(
      /do not match.*after the publish/,
    );
  });

  it('reports a gateway without the policy API instead of failing', async () => {
    const g = policyGateway({ noPolicyApi: true });
    await expect(ensureOpenModelRule('g1', HOSTS, GLOBS, options(g))).resolves.toBe('unsupported');
  });

  it('fails when the gateway refuses the rule, and says it may be too old', async () => {
    const g = policyGateway({ refuseBodyConditions: true });
    await expect(ensureOpenModelRule('g1', HOSTS, GLOBS, options(g))).rejects.toThrow(/422.*older than onecli-cost v4/);
  });

  it('fails for an agent the gateway does not know', async () => {
    const g = policyGateway({ agents: [] });
    await expect(ensureOpenModelRule('g1', HOSTS, GLOBS, options(g))).rejects.toThrow(/OneCLI agent g1 not found/);
  });

  it('refuses to write a rule that names no host or no model', async () => {
    const g = policyGateway();
    await expect(ensureOpenModelRule('g1', [], GLOBS, options(g))).rejects.toThrow(/no inference host/);
    await expect(ensureOpenModelRule('g1', HOSTS, [], options(g))).rejects.toThrow(/no open-weights model/);
    expect(g.writes).toEqual([]);
  });
});
