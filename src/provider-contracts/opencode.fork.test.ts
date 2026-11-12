import fs from 'fs';
import { describe, expect, it } from 'vitest';

// Fork-owned: opencode.ts is a skill payload file that a refresh of
// /add-opencode overwrites. A model domain skips the gateway approval card for
// OpenCode groups (gateway-approval-coordinator.ts), so the list holds only
// where this install's OpenCode model calls go: the configured endpoint, or
// with none, the selected provider's own API. The payload exempts six vendors.
// Skipped when /add-opencode is not installed.
describe.skipIf(!fs.existsSync(new URL('./opencode.ts', import.meta.url)))('openCodeModelDomains', async () => {
  const { openCodeModelDomains } = await import('./opencode.js');
  it('exempts only the configured endpoint host', () => {
    expect(openCodeModelDomains('https://inference-api.nvidia.com/v1', 'openai')).toEqual(['inference-api.nvidia.com']);
    expect(openCodeModelDomains('https://inference-api.nvidia.com', 'anthropic')).toEqual(['inference-api.nvidia.com']);
  });

  it('exempts only the selected provider when the endpoint is native or unset', () => {
    expect(openCodeModelDomains('native', 'anthropic')).toEqual(['api.anthropic.com']);
    expect(openCodeModelDomains(undefined, 'openrouter')).toEqual(['openrouter.ai']);
    expect(openCodeModelDomains('native', 'openai')).toEqual(['api.openai.com', 'chatgpt.com']);
  });

  it('exempts nothing for an unknown provider or an endpoint that domains cannot express', () => {
    expect(openCodeModelDomains('native', 'nvinference')).toEqual([]);
    expect(openCodeModelDomains('http://models.example.test/v1', 'openai')).toEqual([]);
    expect(openCodeModelDomains('https://models.example.test:8443/v1', 'openai')).toEqual([]);
  });
});
