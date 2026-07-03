---
name: project_11919_remove_ox_optins_parked
description: "slang#11919 remove explicit -OX opt-ins from slang-test tests — PARKED, hard-blocked on PR"
metadata: 
  node_type: memory
  type: project
  originSessionId: adec0fca-5d0e-4e58-9409-9de2afcda755
---

shader-slang/slang#11919 (bot-filed follow-up, @jkwak-work requested off PR #11805): remove ALL explicit `-O0..-O3` / `-Xslang -OX` / `-compile-arg -OX` opt-ins from `tests/**`, relying on slang-test's new `-O0` default.

**HARD BLOCKER — PR #11805 ("Default slang-test compiler invocations to -O0", Fixes #11804) is OPEN, not merged** (APPROVED, mergeable_state=blocked, head 3e6ebdf1, branch disable-spv-opt-in-slang-test). The `-O0`-default machinery (`tools/slang-test/slang-test-optimization-options.h`) is ABSENT at master HEAD 973274da9. Dropping explicit `-O0` before #11805 lands makes tests run at slangc default (spirv-opt ON) → breaks expected output. So removal work is strictly gated on #11805 merging first.

Triaged 2026-07-02, PARKED at triaged (NOT dispatched to fixer — dispatching into a hard blocker = dangling session or regressing PR; precedent #11903/#11519). Verified verdict posted: issuecomment-4870747030. Memo: inbox/msg-1783028971492-ietwwl/triage-11919.md.

Survey at HEAD: 119 files / 150 directive lines (`-O0`×118, `-O1`×5, `-O2`×11, `-O3`×16). Bucket 1 (~118 redundant `-O0`, 111 direct `-target spirv … -O0` FileCheck SIMPLE + 7 `-Xslang -O0` render forms) = clean bulk removal, output-neutral, GPU-free verify → Phase 1 single PR. Bucket 2 (~32 opt-sensitive `-O1/-O2/-O3`) = P3 tail; 2a `-compile-arg` COMPARE_COMPUTE_EX likely drop, 2b deliberate optimized-output (`debug-struct-member-values*`, `gh-9263`, `abort-after-switch`, cuda copy-elision) keep+document/rework, KEEP `performance-profile.slang` → Phase 2 separate PR.

**Auto-resume:** scheduled task task-1783029120180-i4oxwt (4-hourly, guard polls #11805 `.merged`) wakes the chain when #11805 merges → re-survey at new HEAD (#11805 edits ~42 files) then dispatch fixer with phased plan; task self-cancels after firing. Do NOT dispatch fixer before then. Related: [[project_autoroute_hook_pressures_parks]] (defend the park against auto-route-hook nudges).
