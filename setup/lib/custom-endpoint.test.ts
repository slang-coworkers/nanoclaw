import { describe, expect, it } from 'vitest';

import {
  customEndpointBaseUrl,
  endpointFromSecrets,
  endpointModelDefaults,
  NVIDIA_INFERENCE_URL,
} from './custom-endpoint.js';

describe('customEndpointBaseUrl', () => {
  it('records an http(s) endpoint, trimmed', () => {
    expect(customEndpointBaseUrl('  https://inference-api.example.com ')).toBe('https://inference-api.example.com');
    expect(customEndpointBaseUrl('http://127.0.0.1:4000')).toBe('http://127.0.0.1:4000');
  });

  it('records nothing when unset or blank', () => {
    expect(customEndpointBaseUrl(undefined)).toBeUndefined();
    expect(customEndpointBaseUrl('   ')).toBeUndefined();
  });

  it('records nothing that is not an http(s) URL', () => {
    expect(customEndpointBaseUrl('inference-api.example.com')).toBeUndefined();
    expect(customEndpointBaseUrl('ftp://example.com')).toBeUndefined();
  });
});

describe('endpointModelDefaults', () => {
  it('gives the NVIDIA inference API its provider-prefixed model ids', () => {
    expect(endpointModelDefaults(`${NVIDIA_INFERENCE_URL}/`)).toEqual({
      ANTHROPIC_MODEL: 'aws/anthropic/bedrock-claude-opus-5-5',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'aws/anthropic/bedrock-claude-opus-5-5',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'aws/anthropic/bedrock-claude-sonnet-5-5',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'aws/anthropic/bedrock-claude-haiku-5-5',
      CODEX_MODEL: 'azure/openai/gpt-6.1-sol',
      CODEX_MODEL_PROVIDER: 'nvinference',
      CODEX_BASE_URL: 'https://inference-api.nvidia.com/v1',
    });
  });

  it('leaves other endpoints on Claude Code defaults', () => {
    expect(endpointModelDefaults('https://llm.example.com')).toEqual({});
    expect(endpointModelDefaults('not a url')).toEqual({});
  });
});

describe('endpointFromSecrets', () => {
  const list = (rows: unknown[]) => JSON.stringify({ data: rows });

  it("recovers a custom endpoint from the vault's Anthropic secret", () => {
    expect(
      endpointFromSecrets(list([{ name: 'Anthropic', type: 'generic', hostPattern: 'inference-api.nvidia.com' }])),
    ).toBe('https://inference-api.nvidia.com');
    expect(endpointFromSecrets(list([{ name: 'x', type: 'anthropic', hostPattern: 'llm.example.com' }]))).toBe(
      'https://llm.example.com',
    );
  });

  it('gives nothing for api.anthropic.com, wildcards, no secret or bad output', () => {
    expect(endpointFromSecrets(list([{ type: 'anthropic', hostPattern: 'api.anthropic.com' }]))).toBeUndefined();
    expect(endpointFromSecrets(list([{ type: 'anthropic', hostPattern: '*.example.com' }]))).toBeUndefined();
    expect(endpointFromSecrets(list([{ type: 'openai', hostPattern: 'x.example.com' }]))).toBeUndefined();
    expect(endpointFromSecrets('not json')).toBeUndefined();
  });
});
