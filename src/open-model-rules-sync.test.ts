import { describe, expect, it } from 'vitest';

import type { MigrationGroupInput } from './open-weights-migration.js';
import { openModelRuleTargets, syncOpenModelRules } from './open-model-rules-sync.js';

function group(folder: string, provider: string, weights: string | null): MigrationGroupInput {
  return {
    id: `ag-${folder}`,
    folder,
    provider,
    config: weights === null ? {} : { weights },
    pinnedSessions: [],
    imageTag: null,
    imageBase: 'nanoclaw-agent-v2-test',
  };
}

describe('openModelRuleTargets', () => {
  it('picks the open-weights groups, by folder name', () => {
    const targets = openModelRuleTargets([
      group('b-fixer', 'opencode', 'open'),
      group('a-triage', 'codex', 'open'),
      group('c-pi', 'pi', 'open'),
    ]);
    expect(targets).toEqual([
      { id: 'ag-a-triage', folder: 'a-triage' },
      { id: 'ag-b-fixer', folder: 'b-fixer' },
      { id: 'ag-c-pi', folder: 'c-pi' },
    ]);
  });

  it('leaves out a group that may run a closed model, such as an eval group', () => {
    const targets = openModelRuleTargets([
      group('eval-triage', 'claude', null),
      group('eval-fixer', 'claude', 'any'),
      group('closed-opencode', 'opencode', null),
      group('open-opencode', 'opencode', 'open'),
    ]);
    expect(targets.map((t) => t.folder)).toEqual(['open-opencode']);
  });

  it('leaves out a Claude group even when its weights say open, because a rule would cut it off', () => {
    expect(openModelRuleTargets([group('mistaken', 'claude', 'open')])).toEqual([]);
  });
});

describe('syncOpenModelRules', () => {
  it('runs one group at a time and reports each outcome', async () => {
    const order: string[] = [];
    let running = 0;
    let overlap = false;
    const results = await syncOpenModelRules(
      [
        { id: 'g1', folder: 'one' },
        { id: 'g2', folder: 'two' },
        { id: 'g3', folder: 'three' },
      ],
      async (id) => {
        running += 1;
        overlap ||= running > 1;
        order.push(id);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running -= 1;
        return id === 'g2' ? 'unchanged' : 'installed';
      },
    );
    expect(order).toEqual(['g1', 'g2', 'g3']);
    expect(overlap).toBe(false);
    expect(results.map((r) => `${r.folder}:${r.outcome}`)).toEqual([
      'one:installed',
      'two:unchanged',
      'three:installed',
    ]);
  });

  it('keeps going after one group fails, and names the reason', async () => {
    const results = await syncOpenModelRules(
      [
        { id: 'g1', folder: 'one' },
        { id: 'g2', folder: 'two' },
      ],
      async (id) => {
        if (id === 'g1') throw new Error('OneCLI agent g1 not found');
        return 'installed';
      },
    );
    expect(results).toEqual([
      { id: 'g1', folder: 'one', outcome: 'failed', error: 'OneCLI agent g1 not found' },
      { id: 'g2', folder: 'two', outcome: 'installed' },
    ]);
  });

  it('passes a gateway without the policy API through as unsupported', async () => {
    const results = await syncOpenModelRules([{ id: 'g1', folder: 'one' }], async () => 'unsupported');
    expect(results[0]!.outcome).toBe('unsupported');
  });
});
