import { describe, expect, it } from 'vitest';

import { parseGhWorkItem } from './item-ownership.js';

// Every distinct sub-thread id a prod slang-coworkers session was created on
// (2026-07 → 2026-10-13 audit), with the item it belongs to.
const PROD_SUB_THREADS: Array<[string, string]> = [
  ['gh-issue-shader-slang/slang-10027/diag-retry', 'shader-slang/slang#10027'],
  ['gh-issue-shader-slang/slang-11568/recovery', 'shader-slang/slang#11568'],
  ['gh-issue-shader-slang/slang-11568/recovery-2', 'shader-slang/slang#11568'],
  ['gh-issue-shader-slang/slangpy-1051/slang-escalation', 'shader-slang/slangpy#1051'],
  ['gh-issue-shader-slang/slangpy-1055/upstream-slang', 'shader-slang/slangpy#1055'],
  ['gh-issue-shader-slang/slangpy-1059/upstream-slang', 'shader-slang/slangpy#1059'],
  ['gh-issue-shader-slang/slang-12073/resume', 'shader-slang/slang#12073'],
  ['gh-issue-shader-slang/slang-12036/mimalloc-all-platforms', 'shader-slang/slang#12036'],
  ['gh-issue-shader-slang/slangpy-1079/upstream-slang', 'shader-slang/slangpy#1079'],
  ['gh-issue-shader-slang/slang-8125/review-12304', 'shader-slang/slang#8125'],
  ['gh-issue-shader-slang/slang-11135/json-reflection-scope', 'shader-slang/slang#11135'],
  ['gh-issue-shader-slang/slang-12244/gc-reap', 'shader-slang/slang#12244'],
  ['gh-issue-shader-slang/slang-12150/ovhk89-credit', 'shader-slang/slang#12150'],
  ['gh-issue-shader-slang/slang-12231-supersede', 'shader-slang/slang#12231'],
  ['gh-issue-shader-slang/slangpy-222/upstream-slang-rhi', 'shader-slang/slangpy#222'],
  ['gh-issue-shader-slang/slangpy-222/upstream-slang-d3d-autodiff', 'shader-slang/slangpy#222'],
  ['gh-issue-shader-slang/slang-12511/design-tree-liquid-guard', 'shader-slang/slang#12511'],
  ['gh-issue-shader-slang/slang-12471/rehead-e8ffb778', 'shader-slang/slang#12471'],
  ['gh-issue-shader-slang/slang-12428/maintainer-directive', 'shader-slang/slang#12428'],
  ['gh-issue-shader-slang/slang-12441/hand-close', 'shader-slang/slang#12441'],
  ['gh-issue-shader-slang/slang-11225/spirv-atom-dedup', 'shader-slang/slang#11225'],
  ['gh-issue-shader-slang/slang-12483/cppbinding-nullparam-followup', 'shader-slang/slang#12483'],
  ['gh-issue-shader-slang/slang-12554/resume-fix', 'shader-slang/slang#12554'],
  ['gh-issue-shader-slang/slang-12550/resume-step1', 'shader-slang/slang#12550'],
  ['gh-issue-shader-slang/slang-12428/resume-fixer-2', 'shader-slang/slang#12428'],
  ['gh-issue-shader-slang/slangpy-1062/fixer-fresh', 'shader-slang/slangpy#1062'],
  ['gh-issue-shader-slang/slangpy-1062/review-fresh', 'shader-slang/slangpy#1062'],
  ['gh-issue-shader-slang/slang-12569/master-repro', 'shader-slang/slang#12569'],
  ['gh-issue-shader-slang/slang-12692/review', 'shader-slang/slang#12692'],
  ['gh-issue-shader-slang/slang-12405/resume-fixer', 'shader-slang/slang#12405'],
  ['gh-issue-shader-slang/slang-12737/review', 'shader-slang/slang#12737'],
  ['gh-issue-shader-slang/slang-12799/fix-review', 'shader-slang/slang#12799'],
  ['gh-issue-shader-slang/slang-12690/overlap-12835', 'shader-slang/slang#12690'],
  ['gh-issue-shader-slang/slang-12690/refactor-isequalityconstraint', 'shader-slang/slang#12690'],
  ['gh-issue-shader-slang/slang-12581/ir-lowering-rework', 'shader-slang/slang#12581'],
  ['gh-issue-shader-slang/slang-12690/devin-1163-adjudication', 'shader-slang/slang#12690'],
  ['gh-issue-shader-slang/slang-12891/ub-sweep', 'shader-slang/slang#12891'],
  ['gh-issue-shader-slang/slang-12591/rcp-scalar-crash-track', 'shader-slang/slang#12591'],
  ['gh-issue-shader-slang/slangpy-1136/slang-rhi', 'shader-slang/slangpy#1136'],
  ['gh-issue-shader-slang/slang-12690/promise-witness-investigation', 'shader-slang/slang#12690'],
  ['gh-issue-shader-slang/slang-12714/round-up-flag', 'shader-slang/slang#12714'],
  ['gh-issue-shader-slang/slang-11782/pr', 'shader-slang/slang#11782'],
  ['gh-issue-shader-slang/slang-12714/layout-rules-version', 'shader-slang/slang#12714'],
  ['gh-issue-shader-slang/slang-13082/review', 'shader-slang/slang#13082'],
  ['gh-issue-shader-slang/slangpy-1167/slang-escalation', 'shader-slang/slangpy#1167'],
  ['gh-issue-shader-slang/slang-11669/worktree-gc', 'shader-slang/slang#11669'],
  ['gh-issue-shader-slang/slangpy-1062/worktree-gc', 'shader-slang/slangpy#1062'],
  ['gh-issue-shader-slang/slang-13301/segfault-p1a', 'shader-slang/slang#13301'],
  ['gh-issue-shader-slang/slang-13301/segfault-p6', 'shader-slang/slang#13301'],
  ['gh-issue-shader-slang/slang-13321/generic-transpose', 'shader-slang/slang#13321'],
  ['gh-issue-shader-slang/slang-13321/fwd-backstop', 'shader-slang/slang#13321'],
  ['gh-issue-shader-slang/slang-13322/f3-nested-fwd', 'shader-slang/slang#13322'],
  ['gh-issue-shader-slang/slang-11225/descriptor-handle-promotion', 'shader-slang/slang#11225'],
  ['gh-issue-shader-slang/slang-13322/nodiff-receiver', 'shader-slang/slang#13322'],
  ['gh-issue-shader-slang/slang-13166/glsl450-lookup', 'shader-slang/slang#13166'],
  ['gh-issue-shader-slang/slang-11709/13406-resume', 'shader-slang/slang#11709'],
];

describe('parseGhWorkItem', () => {
  it.each(PROD_SUB_THREADS)('prod sub-thread %s → %s', (thread, key) => {
    expect(parseGhWorkItem(thread)?.key).toBe(key);
  });

  it.each([
    ['gh-issue-shader-slang/slang-11709', 'shader-slang/slang#11709'],
    ['gh-pr-shader-slang/slang-13406', 'shader-slang/slang#13406'],
    ['gh-issue-shader-slang/slangpy-222', 'shader-slang/slangpy#222'],
    ['gh-issue-shader-slang/slang-rhi-123', 'shader-slang/slang-rhi#123'],
    ['gh-pr-shader-slang/slang-rhi-45/review', 'shader-slang/slang-rhi#45'],
    // A repo whose own name has a numeric dash-segment keeps it.
    ['gh-issue-acme/foo-2-123', 'acme/foo-2#123'],
    ['gh-issue-acme/foo-2-123/sub', 'acme/foo-2#123'],
    // Dash suffix after the number is a sub-thread, not part of the number.
    ['gh-issue-shader-slang/slang-12231-supersede-2', 'shader-slang/slang#12231'],
  ])('canonical and edge form %s → %s', (thread, key) => {
    expect(parseGhWorkItem(thread)?.key).toBe(key);
  });

  it('issue and PR threads for the same number are the same item', () => {
    expect(parseGhWorkItem('gh-pr-shader-slang/slang-13406')).toEqual(
      parseGhWorkItem('gh-issue-shader-slang/slang-13406/review'),
    );
  });

  it.each([
    null,
    undefined,
    '',
    'system:tasks:rechase-13406-r6-a54e',
    'msg-1791517792695',
    'review-PR-A',
    'hermes-FLEET-F62',
    'gh-issue-shader-slang/slang',
    'gh-issue-shader-slang/slang-0',
    'gh-issue-shader-slang',
    'gh-commit-shader-slang/slang-123',
  ])('not a GitHub work item: %s', (thread) => {
    expect(parseGhWorkItem(thread as string | null | undefined)).toBeNull();
  });
});
