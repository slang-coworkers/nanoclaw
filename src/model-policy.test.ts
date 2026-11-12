import { describe, expect, it } from 'vitest';

import {
  containerJsonModel,
  isOpenWeightsModel,
  isOpenWeightsRole,
  modelPolicyEnv,
  modelPolicyViolations,
  parseModelWeights,
  resolveGroupModels,
} from './model-policy.js';

// The NVIDIA install shape the fork runs (lego, prod): every role names an
// NVIDIA id; OpenCode ids carry the OpenCode provider prefix.
const ENV = {
  ANTHROPIC_MODEL: 'aws/anthropic/bedrock-claude-opus-5-5',
  ANTHROPIC_DEFAULT_HAIKU_MODEL: 'aws/anthropic/bedrock-claude-haiku-5-5',
  CODEX_MODEL: 'openai/openai/gpt-6.1-sol',
  OPENCODE_PROVIDER: 'openai',
  OPENCODE_MODEL: 'openai/aws/anthropic/bedrock-claude-opus-5-5',
  OPENCODE_SMALL_MODEL: 'openai/openai/openai/gpt-6-luna',
  PI_MODEL: 'aws/anthropic/bedrock-claude-sonnet-5-5',
};

describe('open-weights classification', () => {
  it('counts the open families as open and everything else as closed', () => {
    expect(isOpenWeightsModel('nvidia/zai-org/glm-5.3', ENV)).toBe(true);
    expect(isOpenWeightsModel('nvidia/moonshotai/kimi-k3', ENV)).toBe(true);
    expect(isOpenWeightsModel('nvidia/deepseek-ai/deepseek-v4.1-flash-1017', ENV)).toBe(true);
    expect(isOpenWeightsModel('openai/openai/gpt-6-luna', ENV)).toBe(false);
    expect(isOpenWeightsModel('aws/anthropic/bedrock-claude-opus-5-5', ENV)).toBe(false);
    // An unknown model must not pass an open-only rule.
    expect(isOpenWeightsModel('nvidia/new-vendor/model-x', ENV)).toBe(false);
  });

  it('takes the install list when one is set', () => {
    expect(
      isOpenWeightsModel('nvidia/new-vendor/model-x', { NANOCLAW_OPEN_WEIGHTS_PREFIXES: 'nvidia/new-vendor/' }),
    ).toBe(true);
  });

  it('accepts only "any" and "open" as weights', () => {
    expect(parseModelWeights(null)).toBe('any');
    expect(parseModelWeights('open')).toBe('open');
    expect(() => parseModelWeights('closed')).toThrow('weights must be');
  });
});

describe('a group with no policy keeps what each provider used before', () => {
  it('claude: the SDK model, and Haiku for the small model and the router', () => {
    expect(resolveGroupModels('claude', {}, ENV)).toEqual({
      provider: 'claude',
      weights: 'any',
      main: ENV.ANTHROPIC_MODEL,
      small: ENV.ANTHROPIC_DEFAULT_HAIKU_MODEL,
      router: ENV.ANTHROPIC_DEFAULT_HAIKU_MODEL,
      critic: ENV.CODEX_MODEL,
    });
  });

  it('opencode: its own settings, the luna router, and the install critic', () => {
    expect(resolveGroupModels('opencode', {}, ENV)).toEqual({
      provider: 'opencode',
      weights: 'any',
      main: ENV.OPENCODE_MODEL,
      small: ENV.OPENCODE_SMALL_MODEL,
      router: 'openai/openai/gpt-6-luna',
      critic: ENV.CODEX_MODEL,
    });
  });

  it('codex ignores NANOCLAW_DEFAULT_MODEL, as its runner always did', () => {
    expect(resolveGroupModels('codex', {}, { ...ENV, NANOCLAW_DEFAULT_MODEL: 'claude-x' }).main).toBe(ENV.CODEX_MODEL);
  });
});

describe('a group setting', () => {
  it('wins for the codex doer, which used to ignore --model', () => {
    expect(resolveGroupModels('codex', { model: 'nvidia/moonshotai/kimi-k3' }, ENV).main).toBe(
      'nvidia/moonshotai/kimi-k3',
    );
  });

  it('wins over PI_MODEL for pi, which used to read the env first', () => {
    expect(resolveGroupModels('pi', { model: 'nvidia/zai-org/glm-5.3' }, ENV).main).toBe('nvidia/zai-org/glm-5.3');
  });

  it('gets the OpenCode provider prefix when it is a bare endpoint id', () => {
    const r = resolveGroupModels(
      'opencode',
      { model: 'nvidia/zai-org/glm-5.3', small_model: 'openai/nvidia/zai-org/glm-5.3-flash' },
      ENV,
    );
    expect(r.main).toBe('openai/nvidia/zai-org/glm-5.3');
    expect(r.small).toBe('openai/nvidia/zai-org/glm-5.3-flash');
  });

  it('sets the critic for one group only', () => {
    expect(resolveGroupModels('claude', { critic_model: 'nvidia/moonshotai/kimi-k3' }, ENV).critic).toBe(
      'nvidia/moonshotai/kimi-k3',
    );
  });
});

describe('weights=open', () => {
  it('gives an OpenCode group the open defaults: GLM, GLM flash for small and router, Kimi for the critic', () => {
    const r = resolveGroupModels('opencode', { weights: 'open' }, ENV);
    expect(r).toEqual({
      provider: 'opencode',
      weights: 'open',
      main: 'openai/nvidia/zai-org/glm-5.3',
      small: 'openai/nvidia/zai-org/glm-5.3-flash',
      router: 'nvidia/zai-org/glm-5.3-flash',
      critic: 'nvidia/moonshotai/kimi-k3',
    });
    expect(modelPolicyViolations(r, ENV)).toEqual([]);
    expect(isOpenWeightsRole(r, 'main', ENV)).toBe(true);
  });

  it('takes the install open defaults when they are set', () => {
    const env = { ...ENV, NANOCLAW_OPEN_ROUTER_MODEL: 'nvidia/deepseek-ai/deepseek-v4.1-flash-1017' };
    expect(resolveGroupModels('codex', { weights: 'open' }, env).router).toBe(
      'nvidia/deepseek-ai/deepseek-v4.1-flash-1017',
    );
  });

  it('names each role set to a closed model', () => {
    const r = resolveGroupModels('opencode', { weights: 'open', critic_model: 'openai/openai/gpt-6.1-sol' }, ENV);
    expect(modelPolicyViolations(r, ENV)).toEqual([
      'critic model openai/openai/gpt-6.1-sol is not an open-weights model',
    ]);
  });

  it('refuses a Claude group, whose SDK and router call Claude models', () => {
    const problems = modelPolicyViolations(resolveGroupModels('claude', { weights: 'open' }, ENV), ENV);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('--agent-provider opencode');
  });

  it('keeps an install-wide NANOCLAW_DEFAULT_MODEL out of the container.json of an open group', () => {
    const env = { ...ENV, NANOCLAW_DEFAULT_MODEL: 'aws/anthropic/bedrock-claude-opus-5-5' };
    expect(containerJsonModel('opencode', { weights: 'open' }, env.NANOCLAW_DEFAULT_MODEL, env)).toBe(
      'openai/nvidia/zai-org/glm-5.3',
    );
    // A Claude group keeps the value it had before the policy.
    expect(containerJsonModel('claude', {}, 'claude-default', env)).toBe('claude-default');
  });
});

describe('container env', () => {
  it('writes the variables each provider reads', () => {
    expect(modelPolicyEnv(resolveGroupModels('opencode', { weights: 'open' }, ENV))).toEqual({
      NANOCLAW_MODEL_WEIGHTS: 'open',
      NANOCLAW_CRITIC_MODEL: 'nvidia/moonshotai/kimi-k3',
      INTENT_ROUTER_OPENAI_MODEL: 'nvidia/zai-org/glm-5.3-flash',
      OPENCODE_MODEL: 'openai/nvidia/zai-org/glm-5.3',
      OPENCODE_SMALL_MODEL: 'openai/nvidia/zai-org/glm-5.3-flash',
    });
    expect(modelPolicyEnv(resolveGroupModels('codex', { model: 'nvidia/moonshotai/kimi-k3' }, ENV))).toEqual({
      NANOCLAW_MODEL_WEIGHTS: 'any',
      NANOCLAW_CRITIC_MODEL: ENV.CODEX_MODEL,
      INTENT_ROUTER_OPENAI_MODEL: 'openai/openai/gpt-6-luna',
      CODEX_MODEL: 'nvidia/moonshotai/kimi-k3',
    });
    expect(modelPolicyEnv(resolveGroupModels('claude', { small_model: 'aws/anthropic/x' }, ENV))).toEqual({
      NANOCLAW_MODEL_WEIGHTS: 'any',
      NANOCLAW_CRITIC_MODEL: ENV.CODEX_MODEL,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'aws/anthropic/x',
    });
  });
});
