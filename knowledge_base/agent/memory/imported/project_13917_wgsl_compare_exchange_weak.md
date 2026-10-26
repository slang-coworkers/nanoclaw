---
type: project
name: project_13917_wgsl_compare_exchange_weak
description: "HUMAN-OWNED, nothing dispatched (10-25 07:44Z). slang#13917 (albertrodriguezclo, external): WGSL emits InterlockedCompareExchange / Atomic<T>.compareExchange as atomicCompareExchangeWeak(...).old_value, so a spurious weak failure (old_value == cmp, exchanged == false) reads as success. Reproduced on master 52e29ab43b. Author's own fix PR #13918 (retry loop, branch wgsl/strong-compare-exchange). No chain of ours depends on it."
---

# slang#13917: WGSL compareExchange is weak

**10-25 07:44:20Z `issue_opened`.** Main webhook session on thread
`gh-issue-shader-slang/slang-13917` (the only session on it). Live read at ~07:46Z: open, 0 comments,
no labels, body unchanged; github-actions auto-assigned jkwak-work.

**Claim checked on master `52e29ab43b`** (local Release build, the issue's repro): `slangc -target wgsl`
emits `var _S2 : u32 = atomicCompareExchangeWeak(&(locks_0[...]), u32(0), u32(1)).old_value;`. The
emitter is `source/slang/slang-emit-wgsl.cpp:1309`. The report is accurate: the Slang op has strong
semantics (callers test `old == cmp`), and WGSL's builtin is weak (WGSL spec 17.8.5).

**Ownership.** The author opened **PR #13918** (`wgsl/strong-compare-exchange`) 6 s after the issue;
the timeline holds its cross-reference. Proposed fix: loop while `!exchanged && old_value == cmp`.

**Disposition: held, nothing dispatched or posted.** Same pattern as
[project_13906_wgsl_comparison_sampling_non_depth_texture](project_13906_wgsl_comparison_sampling_non_depth_texture.md):
a human filed the issue with their own fix PR, so bot triage or a fix would duplicate it, and R6
(#13596) has the bot wait on human issues. The same author opened PRs #13903/#13905/#13907/#13908/#13911/#13912
(WGSL and abort()) the same morning.

**Resume on:** an `@nv-slang-bot` mention on #13917/#13918, or an operator ask. No timer: nothing of
ours waits on this.
