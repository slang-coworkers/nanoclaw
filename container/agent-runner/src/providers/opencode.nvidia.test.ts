import { describe, expect, it } from 'bun:test';

import { OPENCODE_CREDENTIAL_PLACEHOLDER } from './opencode-auth.js';
import { buildOpenCodeConfig, resolveOpenCodePromptModel } from './opencode-config.js';

// Fork-owned. On an NVIDIA install setup writes these OpenCode defaults
// (setup/lib/custom-endpoint.ts). Every model call must then go to the NVIDIA
// host, where the OneCLI gateway swaps the placeholder for the real key. A
// second enabled provider, or a native base URL, would let OpenCode call a
// vendor API directly (threat model P0-2).
const NVIDIA_ENV = {
  OPENCODE_PROVIDER: 'openai',
  OPENCODE_BASE_URL: 'https://inference-api.nvidia.com/v1',
  OPENCODE_MODEL: 'openai/aws/anthropic/bedrock-claude-opus-5-5',
  OPENCODE_SMALL_MODEL: 'openai/openai/openai/gpt-6-luna',
  // Present in every fork container; must not enable a second provider.
  ANTHROPIC_BASE_URL: 'https://inference-api.nvidia.com',
  ANTHROPIC_API_KEY: 'placeholder',
  OPENAI_API_KEY: 'ROUTED_VIA_ONECLI_PROXY',
};

function withEnv<T>(env: Record<string, string>, run: () => T): T {
  const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  Object.assign(process.env, env);
  try {
    return run();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe('OpenCode on the NVIDIA defaults', () => {
  for (const model of ['openai/aws/anthropic/bedrock-claude-opus-5-5', 'openai/openai/openai/gpt-6.1-sol']) {
    it(`sends ${model} only to the gateway-injected NVIDIA host`, () => {
      const config = withEnv(NVIDIA_ENV, () => buildOpenCodeConfig({ model }));
      expect(config.enabled_providers).toEqual(['openai']);
      const providers = config.provider as Record<string, { npm?: string; options: Record<string, unknown> }>;
      expect(Object.keys(providers)).toEqual(['openai']);
      expect(providers.openai.npm).toBe('@ai-sdk/openai-compatible');
      expect(providers.openai.options).toEqual({
        apiKey: OPENCODE_CREDENTIAL_PLACEHOLDER,
        baseURL: 'https://inference-api.nvidia.com/v1',
      });
      expect(config.small_model).toBe('openai/openai/openai/gpt-6-luna');
      // The first path segment selects the OpenCode provider; NVIDIA gets the rest.
      expect(resolveOpenCodePromptModel(config)).toEqual({
        providerID: 'openai',
        modelID: model.slice('openai/'.length),
      });
      expect(JSON.stringify(config)).not.toMatch(/api\.anthropic\.com|api\.openai\.com/);
    });
  }
});
