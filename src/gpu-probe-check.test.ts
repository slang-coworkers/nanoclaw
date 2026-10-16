import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { checkGpuProbe, isGpuProbeMismatch, readGpuProbe, resetGpuProbeWarningsForTests } from './gpu-probe-check.js';

function outDb(value?: string): Database.Database {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE session_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)');
  if (value !== undefined) {
    db.prepare('INSERT INTO session_state (key, value, updated_at) VALUES (?, ?, ?)').run(
      'gpu_probe',
      value,
      new Date().toISOString(),
    );
  }
  return db;
}

const NO_GPU = JSON.stringify({ gpu: false, reason: 'nvidia-smi not found', probedAt: '2026-10-16T12:00:00.000Z' });
const GPU = JSON.stringify({
  gpu: true,
  devices: [{ name: 'NVIDIA L40S', driver: '595.91.07' }],
  probedAt: '2026-10-16T12:00:00.000Z',
});

describe('gpu probe host check', () => {
  beforeEach(() => resetGpuProbeWarningsForTests());
  afterEach(() => vi.restoreAllMocks());

  it('reads a stored probe and rejects garbage / missing tables', () => {
    expect(readGpuProbe(outDb(GPU))?.gpu).toBe(true);
    expect(readGpuProbe(outDb('not json'))).toBeNull();
    expect(readGpuProbe(outDb())).toBeNull();
    expect(readGpuProbe(new Database(':memory:'))).toBeNull();
  });

  it('mismatch only when GPU args applied and probe says no GPU', () => {
    expect(isGpuProbeMismatch(true, JSON.parse(NO_GPU))).toBe(true);
    expect(isGpuProbeMismatch(true, JSON.parse(GPU))).toBe(false);
    expect(isGpuProbeMismatch(false, JSON.parse(NO_GPU))).toBe(false);
    expect(isGpuProbeMismatch(true, null)).toBe(false);
  });

  it('warns once per container start (probedAt), again after a new probe', () => {
    const warn = vi.fn();
    const db = outDb(NO_GPU);
    expect(checkGpuProbe('s1', db, true, warn)).toBe(true);
    expect(checkGpuProbe('s1', db, true, warn)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][1]).toMatchObject({ sessionId: 's1', reason: 'nvidia-smi not found' });

    db.prepare("UPDATE session_state SET value = ? WHERE key = 'gpu_probe'").run(
      JSON.stringify({ gpu: false, reason: 'nvidia-smi timeout', probedAt: '2026-10-16T13:00:00.000Z' }),
    );
    expect(checkGpuProbe('s1', db, true, warn)).toBe(true);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('silent when GPU present, passthrough off, or no probe yet', () => {
    const warn = vi.fn();
    expect(checkGpuProbe('s1', outDb(GPU), true, warn)).toBe(false);
    expect(checkGpuProbe('s2', outDb(NO_GPU), false, warn)).toBe(false);
    expect(checkGpuProbe('s3', outDb(), true, warn)).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
});
