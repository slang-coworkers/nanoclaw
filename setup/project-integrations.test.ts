import { describe, it, expect } from 'vitest';

import {
  PROJECTS,
  parseProjectsEnv,
  runProjectIntegrations,
  composeBranch,
  type ProjectOption,
} from './project-integrations.js';

describe('composeBranch (merge tiers)', () => {
  const ok: () => number = () => 0;
  const fail =
    (code: number): (() => number) =>
    () =>
      code;

  it('returns 0 on merge-train success; never invokes the LLM tier', async () => {
    let llm = 0;
    const r = await composeBranch('nv-x', {
      runMergeTrain: ok,
      llmCompose: async () => {
        llm++;
        return true;
      },
      llmEnabled: true,
    });
    expect(r).toBe(0);
    expect(llm).toBe(0);
  });

  it('does NOT invoke the LLM when disabled; returns merge-train failure', async () => {
    let llm = 0;
    const r = await composeBranch('nv-x', {
      runMergeTrain: fail(1),
      llmCompose: async () => {
        llm++;
        return true;
      },
      llmEnabled: false,
    });
    expect(r).toBe(1);
    expect(llm).toBe(0);
  });

  it('falls back to the LLM when merge-train fails + enabled; 0 on LLM success', async () => {
    const calls: string[] = [];
    const r = await composeBranch('nv-dashboard', {
      runMergeTrain: fail(1),
      llmCompose: async (b) => {
        calls.push(b);
        return true;
      },
      llmEnabled: true,
    });
    expect(r).toBe(0);
    expect(calls).toEqual(['nv-dashboard']);
  });

  it('returns the merge-train failure code when the LLM also fails', async () => {
    const r = await composeBranch('nv-x', {
      runMergeTrain: fail(3),
      llmCompose: async () => false,
      llmEnabled: true,
    });
    expect(r).toBe(3);
  });
});

describe('PROJECTS catalog', () => {
  it('every project maps to an nv-* branch with a unique value', () => {
    const values = PROJECTS.map((p) => p.value);
    expect(new Set(values).size).toBe(values.length);
    for (const proj of PROJECTS) {
      expect(proj.branch).toMatch(/^nv-/);
      expect(proj.label.length).toBeGreaterThan(0);
    }
  });

  it('offers slang, slangpy, dashboard, and nanoclaw', () => {
    expect(PROJECTS.map((p) => p.value).sort()).toEqual(['dashboard', 'nanoclaw', 'slang', 'slangpy']);
  });

  it('dashboard is the only default-selected overlay', () => {
    const defaults = PROJECTS.filter((p) => p.default).map((p) => p.value);
    expect(defaults).toEqual(['dashboard']);
  });
});

describe('parseProjectsEnv', () => {
  it('returns null for unset / empty / whitespace', () => {
    expect(parseProjectsEnv(undefined)).toBeNull();
    expect(parseProjectsEnv('')).toBeNull();
    expect(parseProjectsEnv('   ')).toBeNull();
  });

  it('matches by value key', () => {
    const got = parseProjectsEnv('slang,slangpy');
    expect(got?.map((p) => p.branch)).toEqual(['nv-slang', 'nv-slangpy']);
  });

  it('matches by full branch name too', () => {
    const got = parseProjectsEnv('nv-dashboard');
    expect(got?.map((p) => p.value)).toEqual(['dashboard']);
  });

  it('ignores unknown tokens and tolerates whitespace', () => {
    const got = parseProjectsEnv(' slang , nope , dashboard ');
    expect(got?.map((p) => p.value)).toEqual(['dashboard', 'slang']);
  });

  it('preserves catalog order regardless of input order', () => {
    // catalog order is dashboard, slang, slangpy, nanoclaw — input order ignored
    const got = parseProjectsEnv('slang,dashboard');
    expect(got?.map((p) => p.value)).toEqual(['dashboard', 'slang']);
  });
});

describe('runProjectIntegrations', () => {
  const pick = (...values: string[]): ProjectOption[] => PROJECTS.filter((p) => values.includes(p.value));

  it('skips when nothing is selected (null)', async () => {
    let merges = 0;
    const res = await runProjectIntegrations({
      select: async () => null,
      merge: () => {
        merges++;
        return 0;
      },
    });
    expect(res).toEqual({ merged: [], failed: [], skipped: true });
    expect(merges).toBe(0);
  });

  it('skips when an empty selection is returned', async () => {
    const res = await runProjectIntegrations({
      select: async () => [],
      merge: () => 0,
    });
    expect(res.skipped).toBe(true);
    expect(res.merged).toEqual([]);
  });

  it('merges each selected branch in listed order', async () => {
    const calls: string[] = [];
    const res = await runProjectIntegrations({
      select: async () => pick('slang', 'slangpy'),
      merge: (branch) => {
        calls.push(branch);
        return 0;
      },
    });
    expect(calls).toEqual(['nv-slang', 'nv-slangpy']);
    expect(res.merged).toEqual(['nv-slang', 'nv-slangpy']);
    expect(res.failed).toEqual([]);
    expect(res.skipped).toBe(false);
  });

  it('collects failures without aborting the remaining merges', async () => {
    const calls: string[] = [];
    const res = await runProjectIntegrations({
      select: async () => pick('slang', 'slangpy', 'dashboard'),
      merge: (branch) => {
        calls.push(branch);
        return branch === 'nv-dashboard' ? 1 : 0; // dashboard "conflicts"
      },
    });
    // All three were attempted (in catalog order) — a failure does not short-circuit.
    expect(calls).toEqual(['nv-dashboard', 'nv-slang', 'nv-slangpy']);
    expect(res.merged).toEqual(['nv-slang', 'nv-slangpy']);
    expect(res.failed).toEqual(['nv-dashboard']);
  });
});
