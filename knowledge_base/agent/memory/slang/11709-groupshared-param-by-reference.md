---
type: chain
title: slang PR #11709 — groupshared parameters by reference (fix for #10641)
description: Held on tangent-vector's answer to "who implements the ParameterPassingMode Ref split". Owned by slang-fixer; maintainers jhelferty-nv (CHANGES_REQUESTED) and tangent-vector (design direction via #13339)
tags: [slang, frontend, param-passing-mode, groupshared, parked]
resource: /workspace/inbox/a2a-1790792233298-nk2r5w/11709-vs-13339-plan-report.md
---

# slang PR #11709: groupshared parameters by reference

Owner: `slang-fixer`, session `sess-1785902924001-jylfb4`, thread `gh-issue-shader-slang/slang-11709`.
As of 2026-09-30 the head is `cddb935c48`. It is not a draft and is CHANGES_REQUESTED by jhelferty-nv
(review 5354344993). The companion issue [#13339](https://github.com/shader-slang/slang/issues/13339)
(a `const __ref` interface-conformance gap) was filed by slang-fixer.

## State (2026-09-30)

- **Design direction from the maintainers.** tangent-vector wrote two comments on #13339
  ([5916124244](https://github.com/shader-slang/slang/issues/13339#issuecomment-5916124244) and
  [5916469853](https://github.com/shader-slang/slang/issues/13339#issuecomment-5916469853)). Their points:
  - `const` on a parameter is a binding modifier.
  - `__ref` is a passing mode, not a type.
  - Near term, split `ParameterPassingMode::Ref` into `RefReadWrite`, `RefReadOnly` and `RefWriteOnly`.
  - `const` + `__ref` → `RefReadOnly`. For `const groupshared` → `RefReadOnly` they wrote "I'm guessing".
  - Their own open PR **#13232** ("Record effective this parameter information", 47 files) touches the same code.
- **Effect on #11709.** Commit 84fa791 compares read-only-ness as a side predicate, and only for
  `groupshared` params (`slang-check-decl.cpp:5437-5445`). The split would subsume that comparison.
  - The rework is about 100–150 lines across ~10 files, and it conflicts directly with #13232.
  - The `groupshared`-vs-`__ref` half of 84fa791 is not covered by the plan and is still an open question.
- **Round-3 peer review (`cddb935`, 2026-09-30): REQUEST_CHANGES, one 🔴 regression against master.**
  The trigger is `fwd_diff`/`bwd_diff` on a function with a `no_diff [const] groupshared float a[4]` parameter.
  The result fails spirv-val with "OpLoad Pointer … is not a logical pointer", and CUDA emits `(**&s_0)[_S1]`.
  Near-master `55e3dbdd7` compiles it cleanly.
  - slang-fixer reproduced it; I did not.
  - The reviewer's candidate producers are unverified: `populateParams` has no `RefParamType` branch, and the
    bwd `Ref`→by-value mappings.
  - Both overlap #13232.
  - Decision (me, 09-30): option (a). Root-cause it at the producer, prepare the fix and test **unpushed**,
    post one verified disclosure on #11709, and run a delta-only review when the hold lifts.
  - **Done 09-30 20:18Z.** The verified producers were `populateParams` (it had no `RefParamType` branch, so fwd
    lowers the argument as an r-value load) and the PR's own bwd `Ref`→by-value `no_diff T` mapping.
    - Local commits, **unpushed**: `9230f147c1` (fix + `tests/autodiff/groupshared-param-no-diff-direct-diff.slang`)
      and `50c003155a` (nits).
    - Full suite 7185/7187 (2 known env failures).
    - Disclosure: [5918943205](https://github.com/shader-slang/slang/pull/11709#issuecomment-5918943205).
    - When the hold lifts: push, then slang-reviewer does a delta-only review.
    - Not an issue: the whole-array load and bwd checkpoint are valid but copy-heavy (master ICEs here, so
      there's no baseline). They go in the PR description as a known limitation.
- **Decision routing.** The rework-or-hold call belongs to tangent-vector, not the operator.
  slang-fixer's #13339 reply asks them (1) who implements the split: #13339, #11709, or after #13232;
  and (2) whether `const groupshared` should map to `RefReadOnly`.
  I verified the reply's claims at master `4c88395ea0`; it was posted 2026-09-30 18:25Z as [5917220651](https://github.com/shader-slang/slang/issues/13339#issuecomment-5917220651).

## Open maintainer items

| Item | State |
|---|---|
| tangent-vector: who implements the split / `const groupshared` mapping | asked 09-30 |
| [r4141296596](https://github.com/shader-slang/slang/pull/11709#discussion_r4141296596): release assert (a)/(b) for pre-PR `.slang-module`s | open |
| [r4139502685](https://github.com/shader-slang/slang/pull/11709#discussion_r4139502685): E30709 warning vs error | open |
| jhelferty-nv CHANGES_REQUESTED | sticky until she re-reviews |
| `__constref groupshared` A/B (r4137802265) | **closed**: "(A)" at r4138118657, implemented in `c18511b5ef` (E30712) |

Re-chase: `rechase-11709-constref-d-9d86` (2026-10-02 09:00Z). It was retargeted on 09-30 to the four
live items above; before that it watched only the A/B thread, which was already closed.

## Lessons

- My dispatch note said the A/B question was open when it had been answered a day earlier. The fixer
  caught it. Re-check a thread's state live before carrying it forward in a note or a timer.
