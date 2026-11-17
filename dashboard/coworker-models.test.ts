import { describe, expect, it } from 'vitest';

import type { PrivilegeSettings } from '../src/modules/session-privilege/index.js';
import { resolveProviderName } from '../src/providers/provider-name.js';

import { coworkerModels, weightsBadge } from './coworker-models.js';

// The model card shows what a group's next container runs, so it must resolve
// each role exactly as spawn does (src/model-policy.ts).

const ENV = {
  ANTHROPIC_MODEL: 'aws/anthropic/bedrock-claude-opus-5-5',
  ANTHROPIC_DEFAULT_HAIKU_MODEL: 'aws/anthropic/bedrock-claude-haiku-5-5',
  CODEX_MODEL: 'nvidia/moonshotai/kimi-k3',
  OPENCODE_PROVIDER: 'openai',
  OPENCODE_MODEL: 'openai/nvidia/zai-org/glm-5.3',
  OPENCODE_SMALL_MODEL: 'openai/nvidia/zai-org/glm-5.3-flash',
  INTENT_ROUTER_OPENAI_MODEL: 'nvidia/zai-org/glm-5.3-flash',
};

// A group whose weights column is empty follows the install default, so a fixture
// that means a Claude, Codex or weights=any group says `weights: 'any'`, as
// migration 952 records for every group that existed before that default.
describe('coworkerModels', () => {
  it('a Claude group: the doer, Haiku for small and router, the install critic', () => {
    expect(coworkerModels({ folder: 'cl', agent_provider: 'claude' }, { weights: 'any' }, ENV)).toEqual({
      folder: 'cl',
      provider: 'claude',
      weights: 'any',
      roles: [
        { role: 'main', model: ENV.ANTHROPIC_MODEL, openWeights: false },
        { role: 'small', model: ENV.ANTHROPIC_DEFAULT_HAIKU_MODEL, openWeights: false },
        { role: 'router', model: ENV.ANTHROPIC_DEFAULT_HAIKU_MODEL, openWeights: false },
        { role: 'critic', model: ENV.CODEX_MODEL, openWeights: true },
      ],
      problems: [],
    });
  });

  it("an OpenCode group's own values, with the provider from its container config", () => {
    const card = coworkerModels(
      { folder: 'oc', agent_provider: null },
      { provider: 'opencode', critic_model: 'openai/openai/gpt-6.1-sol' },
      ENV,
    );
    expect(card.provider).toBe('opencode');
    expect(card.roles.map((r) => [r.role, r.model, r.openWeights])).toEqual([
      ['main', 'openai/nvidia/zai-org/glm-5.3', true],
      ['small', 'openai/nvidia/zai-org/glm-5.3-flash', true],
      ['router', 'nvidia/zai-org/glm-5.3-flash', true],
      ['critic', 'openai/openai/gpt-6.1-sol', false],
    ]);
  });

  it('names the closed role of a weights=open group, which spawn refuses', () => {
    const card = coworkerModels(
      { folder: 'oc', agent_provider: 'opencode' },
      { weights: 'open', critic_model: 'openai/openai/gpt-6.1-sol' },
      ENV,
    );
    expect(card.weights).toBe('open');
    expect(card.problems).toEqual(['critic model openai/openai/gpt-6.1-sol is not an open-weights model']);
  });

  it('a role with no model has no badge (Codex has no small model)', () => {
    const card = coworkerModels({ folder: 'cx', agent_provider: 'codex' }, { weights: 'any' }, ENV);
    expect(card.roles.find((r) => r.role === 'small')).toEqual({ role: 'small', model: null, openWeights: null });
  });
});

// The open/closed badge on every coworker and session panel. It must name the
// provider spawn would pick (session pin, group, container config, default),
// apply the session's privilege as spawn does, and call a coworker open only
// when it may call open-weights models alone.
describe('weightsBadge', () => {
  const OFF: PrivilegeSettings = { mode: 'off', approvedPath: '', check2: 'off', eligibilityPath: '' };
  const ENFORCE: PrivilegeSettings = { ...OFF, mode: 'enforce' };
  const OPEN_CRITIC = { critic_model: 'nvidia/moonshotai/kimi-k3' };
  const OC = { folder: 'oc', agent_provider: 'opencode' };

  it('an OpenCode group on GLM with an open critic is open', () => {
    expect(weightsBadge(OC, OPEN_CRITIC, null, ENV, OFF)).toEqual({ effectiveProvider: 'opencode', weights: 'open' });
  });

  it('a Claude group is closed, although its critic is open-weights', () => {
    expect(weightsBadge({ folder: 'cl', agent_provider: 'claude' }, { weights: 'any' }, null, ENV, OFF).weights).toBe(
      'closed',
    );
  });

  it('one closed role makes a weights=any group closed', () => {
    expect(
      weightsBadge(OC, { weights: 'any', critic_model: 'openai/openai/gpt-6.1-sol' }, null, ENV, OFF).weights,
    ).toBe('closed');
  });

  it('a weights=open group is open, because spawn refuses its closed roles rather than call them', () => {
    const config = { weights: 'open', critic_model: 'openai/openai/gpt-6.1-sol' };
    expect(weightsBadge(OC, config, null, ENV, OFF).weights).toBe('open');
  });

  it('the session pin outranks the group and the container config', () => {
    expect(weightsBadge(OC, { ...OPEN_CRITIC, weights: 'any' }, { agent_provider: 'claude' }, ENV, OFF)).toEqual({
      effectiveProvider: 'claude',
      weights: 'closed',
    });
    const cl = { folder: 'cl', agent_provider: 'claude' };
    expect(weightsBadge(cl, OPEN_CRITIC, { agent_provider: 'opencode' }, ENV, OFF).weights).toBe('open');
  });

  it('a closed-privilege session drops the open rule only while enforcement is on', () => {
    const cl = { folder: 'cl', agent_provider: 'claude' };
    const config = { weights: 'open' };
    const closed = { agent_provider: null, privilege: 'closed' as const };
    expect(weightsBadge(cl, config, closed, ENV, ENFORCE).weights).toBe('closed');
    expect(weightsBadge(cl, config, closed, ENV, OFF).weights).toBe('open');
    expect(weightsBadge(cl, config, { agent_provider: null, privilege: 'open' }, ENV, ENFORCE).weights).toBe('open');
  });

  it('a group with no model at all is not called open', () => {
    expect(
      weightsBadge(
        { folder: 'x', agent_provider: 'codex' },
        { weights: 'any', critic_model: 'unknown/x' },
        null,
        {},
        OFF,
      ).weights,
    ).toBe('closed');
  });

  it('names the provider spawn resolves, tier by tier, and agrees with the model card', () => {
    const rows: Array<[string | null, string | null, string | null]> = [
      [null, null, null],
      [null, null, 'opencode'],
      [null, 'codex', 'opencode'],
      ['pi', 'codex', 'opencode'],
      ['OpenCode', null, null],
    ];
    for (const [session, group, config] of rows) {
      const g = { folder: 'g', agent_provider: group };
      const badge = weightsBadge(g, { provider: config }, { agent_provider: session }, ENV, OFF);
      expect(badge.effectiveProvider).toBe(resolveProviderName({ override: undefined, session, group, config }));
      if (!session) expect(badge.effectiveProvider).toBe(coworkerModels(g, { provider: config }, ENV).provider);
    }
  });
});
