import { describe, expect, it } from 'vitest';

import { coworkerModels } from './coworker-models.js';

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

describe('coworkerModels', () => {
  it('a Claude group: the doer, Haiku for small and router, the install critic', () => {
    expect(coworkerModels({ folder: 'cl', agent_provider: null }, undefined, ENV)).toEqual({
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
    const card = coworkerModels({ folder: 'cx', agent_provider: 'codex' }, undefined, ENV);
    expect(card.roles.find((r) => r.role === 'small')).toEqual({ role: 'small', model: null, openWeights: null });
  });
});
