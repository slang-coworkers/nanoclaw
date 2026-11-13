import { describe, expect, it } from 'bun:test';

import { PI_CREDENTIAL_PLACEHOLDER, piModelsConfig } from './pi.js';

// Fork-owned. Pi reaches a custom OpenAI-compatible endpoint (the NVIDIA
// gateway) only through a provider declared in its models.json.

describe('piModelsConfig', () => {
  it('declares the provider at PI_BASE_URL with the model, a placeholder key and the system role', () => {
    expect(
      piModelsConfig('nvidia', 'nvidia/zai-org/glm-5.3', { PI_BASE_URL: ' https://inference-api.nvidia.com/v1 ' }),
    ).toEqual({
      providers: {
        nvidia: {
          baseUrl: 'https://inference-api.nvidia.com/v1',
          api: 'openai-completions',
          apiKey: PI_CREDENTIAL_PLACEHOLDER,
          compat: { supportsDeveloperRole: false },
          models: [{ id: 'nvidia/zai-org/glm-5.3' }],
        },
      },
    });
  });

  it('is null for a built-in provider (no PI_BASE_URL) or with no model', () => {
    expect(piModelsConfig('anthropic', 'claude-opus-4-5', {})).toBeNull();
    expect(piModelsConfig('nvidia', undefined, { PI_BASE_URL: 'https://x/v1' })).toBeNull();
  });
});
