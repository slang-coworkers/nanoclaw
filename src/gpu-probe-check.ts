/**
 * Host-side check of the agent-runner's GPU probe.
 *
 * The runner measures GPU access once per container start and writes it to
 * outbound.db `session_state` key `gpu_probe` (container/agent-runner/src/
 * gpu-probe.ts). The host knows whether it APPLIED GPU passthrough
 * (`dockerGpuArgs()` non-empty). When it did but the container measured no
 * GPU, something between the host and the agent is broken (runtime, device
 * node, driver mismatch) and every GPU test in that session will silently be
 * skipped — so warn, once per container start (keyed by the probe's
 * `probedAt`, which the runner rewrites on every start).
 *
 * Read-only against outbound.db; never throws.
 */
import type Database from 'better-sqlite3';

import { log } from './log.js';

export const GPU_PROBE_STATE_KEY = 'gpu_probe';

export interface StoredGpuProbe {
  gpu: boolean;
  probedAt: string;
  reason?: string;
  devNode?: boolean;
  cuda?: string;
  devices?: Array<{ name: string; driver?: string }>;
}

export function readGpuProbe(outDb: Database.Database): StoredGpuProbe | null {
  try {
    const row = outDb.prepare('SELECT value FROM session_state WHERE key = ?').get(GPU_PROBE_STATE_KEY) as
      | { value: string }
      | undefined;
    if (!row?.value) return null;
    const p = JSON.parse(row.value) as Partial<StoredGpuProbe>;
    if (!p || typeof p !== 'object' || typeof p.gpu !== 'boolean' || typeof p.probedAt !== 'string') return null;
    return p as StoredGpuProbe;
  } catch {
    // session_state absent (container never started) or JSON garbage.
    return null;
  }
}

/** The pure decision: GPU args applied, probe present, probe says no GPU. */
export function isGpuProbeMismatch(gpuArgsApplied: boolean, probe: StoredGpuProbe | null): boolean {
  return gpuArgsApplied && probe !== null && !probe.gpu;
}

/** sessionId → probedAt already warned about. */
const warned = new Map<string, string>();

/**
 * Warn when the host passed the GPU through but the container's probe found
 * none. Returns true when it logged (tests).
 */
export function checkGpuProbe(
  sessionId: string,
  outDb: Database.Database,
  gpuArgsApplied: boolean,
  warn: (msg: string, ctx: Record<string, unknown>) => void = (m, c) => log.warn(m, c),
): boolean {
  if (!gpuArgsApplied) return false;
  const probe = readGpuProbe(outDb);
  if (!probe || !isGpuProbeMismatch(gpuArgsApplied, probe)) return false;
  if (warned.get(sessionId) === probe.probedAt) return false;
  warned.set(sessionId, probe.probedAt);
  warn('GPU passthrough applied but container probe found no GPU — GPU tests in this session cannot run', {
    sessionId,
    probedAt: probe.probedAt,
    reason: probe.reason,
    devNode: probe.devNode,
    cuda: probe.cuda,
  });
  return true;
}

/** Tests only. */
export function resetGpuProbeWarningsForTests(): void {
  warned.clear();
}
