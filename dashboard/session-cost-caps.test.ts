import { describe, it, expect } from 'vitest';
import {
  parseCostCapBlob,
  deriveControlVersion,
  deriveEpochKey,
  buildCostCapEntry,
  usdToCents,
  buildSessionCostFields,
  mapEpisodeToLatestAdjustment,
  validateCeilingRequest,
} from './session-cost-caps.js';

describe('parseCostCapBlob', () => {
  it('parses a well-formed JSON object', () => {
    expect(parseCostCapBlob('{"capUsd":10,"status":"ok"}')).toEqual({ capUsd: 10, status: 'ok' });
  });
  it('returns null for missing/empty/corrupt/non-object input', () => {
    expect(parseCostCapBlob(null)).toBeNull();
    expect(parseCostCapBlob(undefined)).toBeNull();
    expect(parseCostCapBlob('')).toBeNull();
    expect(parseCostCapBlob('not json')).toBeNull();
    expect(parseCostCapBlob('[1,2,3]')).toBeNull();
    expect(parseCostCapBlob('"just a string"')).toBeNull();
    expect(parseCostCapBlob('42')).toBeNull();
  });
});

describe('deriveControlVersion', () => {
  it('returns undefined when there is no blob at all (no cost data)', () => {
    expect(deriveControlVersion(null)).toBeUndefined();
  });
  it('defaults to 1 when a blob exists but carries no v2 signal (legacy runner)', () => {
    expect(deriveControlVersion({ capUsd: 10 })).toBe(1);
  });
  it('reads supportsSetCeiling:true as version 2', () => {
    expect(deriveControlVersion({ supportsSetCeiling: true })).toBe(2);
  });
  it('supportsSetCeiling:false does NOT count as a v2 signal', () => {
    expect(deriveControlVersion({ supportsSetCeiling: false })).toBe(1);
  });
  it('prefers an explicit numeric protocol field over the boolean flag', () => {
    expect(deriveControlVersion({ costControlProtocol: 3, supportsSetCeiling: true })).toBe(3);
    expect(deriveControlVersion({ protocolVersion: 2 })).toBe(2);
  });
  it('ignores a non-numeric protocol field rather than throwing', () => {
    expect(deriveControlVersion({ costControlProtocol: 'two' as unknown as number })).toBe(1);
  });
});

describe('deriveEpochKey', () => {
  it('defaults to "0" when there is no blob or no epoch signal', () => {
    expect(deriveEpochKey(null)).toBe('0');
    expect(deriveEpochKey({ capUsd: 10 })).toBe('0');
  });
  it('reads a top-level epochKey string', () => {
    expect(deriveEpochKey({ epochKey: '7' })).toBe('7');
  });
  it('reads a numeric budgetGen and stringifies it', () => {
    expect(deriveEpochKey({ budgetGen: 7 })).toBe('7');
  });
  it('falls back to lastCostOverride.budgetGen when nothing top-level is set', () => {
    expect(deriveEpochKey({ lastCostOverride: { budgetGen: 9 } })).toBe('9');
  });
  it('trims a padded string epoch value', () => {
    expect(deriveEpochKey({ epochKey: '  7  ' })).toBe('7');
  });
});

describe('buildCostCapEntry', () => {
  it('returns null when the blob is null (nothing to publish)', () => {
    expect(buildCostCapEntry('ag-1', null, '2026-08-25T10:00:00.000Z')).toBeNull();
  });
  it('carries every field through, deriving epoch/version', () => {
    const entry = buildCostCapEntry(
      'ag-1',
      { capUsd: 10, spentUsd: 5, status: 'ok', immortal: false, window: 'lifetime', ceilingUsd: 15, supportsSetCeiling: true, epochKey: '3' },
      '2026-08-25T10:00:00.000Z',
    );
    expect(entry).toEqual({
      agentGroupId: 'ag-1',
      capUsd: 10,
      spentUsd: 5,
      status: 'ok',
      immortal: false,
      window: 'lifetime',
      ceilingUsd: 15,
      epochKey: '3',
      controlVersion: 2,
      updatedAt: '2026-08-25T10:00:00.000Z',
    });
  });
  it('drops non-numeric/non-boolean fields rather than propagating garbage', () => {
    const entry = buildCostCapEntry('ag-1', { capUsd: 'ten' as unknown as number, immortal: 'yes' as unknown as boolean }, 'now');
    expect(entry?.capUsd).toBeUndefined();
    expect(entry?.immortal).toBeUndefined();
  });
});

describe('usdToCents', () => {
  it('rounds to the nearest cent', () => {
    expect(usdToCents(150)).toBe(15000);
    expect(usdToCents(91)).toBe(9100);
    expect(usdToCents(143.27)).toBe(14327);
  });
  it('absorbs floating-point noise (e.g. 0.1 + 0.2 style error)', () => {
    expect(usdToCents(19.99999999998)).toBe(2000);
  });
  it('returns undefined for undefined/null/NaN — never fabricates a $0', () => {
    expect(usdToCents(undefined)).toBeUndefined();
    expect(usdToCents(null)).toBeUndefined();
    expect(usdToCents(NaN)).toBeUndefined();
  });
});

describe('buildSessionCostFields', () => {
  it('every field is undefined (and so omitted by JSON.stringify) when there is no entry', () => {
    const fields = buildSessionCostFields(undefined, null);
    expect(fields.costCap).toBeUndefined();
    expect(fields.costStatus).toBeUndefined();
    expect(fields.costCeilingCents).toBeUndefined();
    expect(fields.costControlVersion).toBeUndefined();
    expect(JSON.stringify(fields)).toBe('{}');
  });
  it('derives costCeilingCents from ceilingUsd — one source of truth, never stored independently', () => {
    const fields = buildSessionCostFields(
      { agentGroupId: 'ag-1', ceilingUsd: 150, epochKey: '7', controlVersion: 2, updatedAt: 't' },
      null,
    );
    expect(fields.costCeiling).toBe(150);
    expect(fields.costCeilingCents).toBe(15000);
  });
  it('includes latestCostAdjustment only when one is passed', () => {
    const withAdj = buildSessionCostFields(
      { agentGroupId: 'ag-1', epochKey: '0', updatedAt: 't' },
      { id: 'cca-1', state: 'enqueued', targetCeilingCents: 17500, requestedAt: 't' },
    );
    expect(withAdj.latestCostAdjustment).toEqual({ id: 'cca-1', state: 'enqueued', targetCeilingCents: 17500, requestedAt: 't' });
    const withoutAdj = buildSessionCostFields({ agentGroupId: 'ag-1', epochKey: '0', updatedAt: 't' }, null);
    expect(withoutAdj.latestCostAdjustment).toBeUndefined();
  });
});

describe('mapEpisodeToLatestAdjustment', () => {
  const base = {
    episode_id: 'esc-1',
    session_id: 'sess-1',
    target_ceiling_usd: 175,
    created_at: '2026-08-25T10:00:00.000Z',
  };
  it('returns null for a null/undefined row, or one with no target_ceiling_usd (not a set_ceiling episode)', () => {
    expect(mapEpisodeToLatestAdjustment(null)).toBeNull();
    expect(mapEpisodeToLatestAdjustment(undefined)).toBeNull();
    expect(mapEpisodeToLatestAdjustment({ ...base, target_ceiling_usd: null, decision_state: 'pending', effect_state: null })).toBeNull();
  });
  it('decision_state=pending -> state pending', () => {
    const adj = mapEpisodeToLatestAdjustment({ ...base, decision_state: 'pending', effect_state: 'none' });
    expect(adj).toEqual({ id: 'esc-1', state: 'pending', targetCeilingCents: 17500, requestedAt: base.created_at });
  });
  it('decision_state=ceiling_set but effect_state not yet applied -> state enqueued (CAS won, effect not confirmed)', () => {
    const adj = mapEpisodeToLatestAdjustment({ ...base, decision_state: 'ceiling_set', effect_state: 'enqueued' });
    expect(adj?.state).toBe('enqueued');
  });
  it('effect_state=applied -> state applied, regardless of decision_state wording', () => {
    const adj = mapEpisodeToLatestAdjustment({ ...base, decision_state: 'ceiling_set', effect_state: 'applied' });
    expect(adj?.state).toBe('applied');
  });
  it('decision_state=superseded -> state conflict', () => {
    const adj = mapEpisodeToLatestAdjustment({ ...base, decision_state: 'superseded', effect_state: 'none' });
    expect(adj?.state).toBe('conflict');
  });
  it('decision_state=expired -> state rejected', () => {
    const adj = mapEpisodeToLatestAdjustment({ ...base, decision_state: 'expired', effect_state: 'none' });
    expect(adj?.state).toBe('rejected');
  });
  it('an unrecognized decision_state falls back to rejected, never applied (fail closed)', () => {
    const adj = mapEpisodeToLatestAdjustment({ ...base, decision_state: 'something-new', effect_state: 'none' });
    expect(adj?.state).toBe('rejected');
  });
});

describe('validateCeilingRequest', () => {
  const valid = { requestId: 'cca-abc', targetCeilingCents: 17500, expectedEpochKey: '7', expectedCeilingCents: 15000 };
  it('accepts a well-formed request', () => {
    const result = validateCeilingRequest(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(valid);
  });
  it('rejects a non-object body', () => {
    expect(validateCeilingRequest(null).ok).toBe(false);
    expect(validateCeilingRequest('nope').ok).toBe(false);
    expect(validateCeilingRequest([1, 2, 3]).ok).toBe(false);
  });
  it('rejects a missing/empty requestId', () => {
    expect(validateCeilingRequest({ ...valid, requestId: '' }).ok).toBe(false);
    expect(validateCeilingRequest({ ...valid, requestId: undefined }).ok).toBe(false);
  });
  it('rejects targetCeilingCents below the floor, above the ceiling, non-integer, or non-numeric', () => {
    expect(validateCeilingRequest({ ...valid, targetCeilingCents: 0 }).ok).toBe(false);
    expect(validateCeilingRequest({ ...valid, targetCeilingCents: -1 }).ok).toBe(false);
    expect(validateCeilingRequest({ ...valid, targetCeilingCents: 100001 }).ok).toBe(false);
    expect(validateCeilingRequest({ ...valid, targetCeilingCents: 175.5 }).ok).toBe(false);
    expect(validateCeilingRequest({ ...valid, targetCeilingCents: '17500' }).ok).toBe(false);
  });
  it('accepts the exact boundary values 1 and 100000', () => {
    expect(validateCeilingRequest({ ...valid, targetCeilingCents: 1 }).ok).toBe(true);
    expect(validateCeilingRequest({ ...valid, targetCeilingCents: 100000 }).ok).toBe(true);
  });
  it('rejects a missing/empty expectedEpochKey', () => {
    expect(validateCeilingRequest({ ...valid, expectedEpochKey: '' }).ok).toBe(false);
    expect(validateCeilingRequest({ ...valid, expectedEpochKey: 7 }).ok).toBe(false);
  });
  it('rejects a negative or non-integer expectedCeilingCents, accepts 0', () => {
    expect(validateCeilingRequest({ ...valid, expectedCeilingCents: -1 }).ok).toBe(false);
    expect(validateCeilingRequest({ ...valid, expectedCeilingCents: 1.5 }).ok).toBe(false);
    expect(validateCeilingRequest({ ...valid, expectedCeilingCents: 0 }).ok).toBe(true);
  });
  it('trims requestId/expectedEpochKey in the returned value', () => {
    const result = validateCeilingRequest({ ...valid, requestId: '  cca-abc  ', expectedEpochKey: ' 7 ' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.requestId).toBe('cca-abc');
      expect(result.value.expectedEpochKey).toBe('7');
    }
  });
});
