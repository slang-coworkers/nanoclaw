/**
 * Parity + behavior test for the runner's copied pricing core.
 *
 * The rate table here is a verbatim copy of `dashboard/session-costs.ts`
 * (host). This test pins a few representative rates and the TTL-aware math so
 * the copy can't silently drift from the dashboard figure the human sees on
 * the Sessions tab. If a rate changes on one side and not the other, this goes
 * red.
 */
import { describe, it, expect } from 'bun:test';

import { MODEL_PRICING, normalizeModel, priceUsage } from './pricing.js';

describe('pricing parity (must match dashboard/session-costs.ts)', () => {
  it('opus-4-8 / opus-5 carry the $5/$25 per-Mtok rates', () => {
    expect(MODEL_PRICING['claude-opus-4-8']).toEqual({
      input: 5e-6,
      output: 25e-6,
      cacheCreate: 6.25e-6,
      cacheRead: 5e-7,
    });
    expect(MODEL_PRICING['claude-opus-5']).toEqual(MODEL_PRICING['claude-opus-4-8']);
  });

  it('sonnet-5 and haiku-4-5 rates match the dashboard table', () => {
    expect(MODEL_PRICING['claude-sonnet-5']).toEqual({
      input: 2e-6,
      output: 10e-6,
      cacheCreate: 2.5e-6,
      cacheRead: 2e-7,
    });
    expect(MODEL_PRICING['claude-haiku-4-5']).toEqual({
      input: 1e-6,
      output: 5e-6,
      cacheCreate: 1.25e-6,
      cacheRead: 1e-7,
    });
  });
});

describe('normalizeModel', () => {
  it('strips the [1m] flag, bedrock prefixes, -v1 and date suffixes', () => {
    expect(normalizeModel('claude-opus-4-8[1m]')).toBe('claude-opus-4-8');
    expect(normalizeModel('aws/anthropic/bedrock-claude-opus-5')).toBe('claude-opus-5');
    expect(normalizeModel('aws/anthropic/claude-haiku-4-5-v1')).toBe('claude-haiku-4-5');
    expect(normalizeModel('claude-sonnet-5-20251001')).toBe('claude-sonnet-5');
  });

  it('returns "" for unknown/synthetic models (treated as unpriced)', () => {
    expect(normalizeModel('<synthetic>')).toBe('');
    expect(normalizeModel(undefined)).toBe('');
    expect(normalizeModel('gpt-5')).toBe('');
  });
});

describe('priceUsage TTL-aware math', () => {
  it('prices a 1h cache write at 2x input and a 5m write at 1.25x input', () => {
    // 1M input @ $5, 1M output @ $25, 1M 1h-write @ 2*$5=$10, 1M 5m-write @ $6.25, 1M read @ $0.50
    const cost = priceUsage('claude-opus-4-8', {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
      cache_creation: {
        ephemeral_1h_input_tokens: 1_000_000,
        ephemeral_5m_input_tokens: 1_000_000,
      },
    });
    expect(cost).toBeCloseTo(5 + 25 + 0.5 + 10 + 6.25, 6);
  });

  it('falls back to the flat cache_creation field at the 5m rate when no TTL split', () => {
    const cost = priceUsage('claude-opus-4-8', {
      input_tokens: 0,
      cache_creation_input_tokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(6.25, 6);
  });

  it('returns 0 for an unpriced model rather than mis-charging', () => {
    expect(priceUsage('gpt-5', { input_tokens: 1_000_000 })).toBe(0);
  });
});
