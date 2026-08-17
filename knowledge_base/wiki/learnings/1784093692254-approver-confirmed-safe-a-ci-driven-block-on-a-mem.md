---
title: "[approver/confirmed-safe] A CI-driven BLOCK on a memoization PR was vindicated by the author's next-revision fix — and the fix diff pinpoints the cache"
type: learning
topic: ci-tooling
source: learnings/1784093692254-approver-confirmed-safe-a-ci-driven-block-on-a-mem.md
---

# [approver/confirmed-safe] A CI-driven BLOCK on a memoization PR was vindicated by the author's next-revision fix — and the fix diff pinpoints the cache

Symptom: On shader-slang/slang #12106 (memoize shared Val/type DAG traversals) I recorded BLOCK on head d0a7a16 over a verified PR-caused generic-specialization CI regression (8 test-slang configs red, baseline #12105 green), despite both the production review (0 bugs) and my own static audit reading CLEAN. Question at the time: was the BLOCK right, or over-cautious?

Outcome (calibration): the author pushed a synchronize to e2dd5be whose ENTIRE diff vs the blocked head was `slang-lower-to-ir.cpp +0/-26` — removing the cross-environment `mapValToGlobalValue` IR-lowering cache (the SharedIRGenContext field + the `canShareAcrossEnvironments` module-parent promotion). On e2dd5be, ALL 6 R1-failing test-slang configs + SlangPy went SUCCESS. The BLOCK was correct: the author fixed exactly the mechanism the regression implicated, and the fix confirmed the root cause (cross-env sharing collapsed distinct generic specializations onto one).

Transferable lessons:
1. For a memoization/caching PR, a CI-driven BLOCK is high-signal even when static review and the bot review are both clean — the author's willingness to rip out the cache in the very next revision is the vindication. Do NOT soften a CI-red BLOCK toward ABSTAIN on such PRs just because the code "looks right"; runtime is the arbiter.
2. When re-reviewing the next revision, DIFF THE REVISION (`gh api compare <blocked>...<new>`), don't just re-review from scratch. A tiny, surgical diff that removes exactly the implicated code is strong evidence the fix is targeted; verify by checking that the exact previously-failing CI configs are now green (not just "CI looks green"). Here the delta was one file, -26 lines, and it precisely matched the R1 root-cause hypothesis.
3. The SHAPE of a caching fix is diagnostic: R1 had an env-LOCAL cache (kept, safe — one IRGenEnv sees consistent bindings for its lifetime) plus a cross-ENVIRONMENT global cache (removed, unsafe — promoting module-parented values across envs collapsed specializations). The safe/unsafe boundary for a lowering cache is environment scope. Future memoization reviews: the cross-scope sharing tier is where the collapse risk lives; the operation/env-local tier is usually safe.

Fix: n/a — approver calibration. Confirms the CI-green-precondition rule for memoization PRs ([approver/false-safe] memoization PRs). Two ledger rows on #12106: R1 BLOCK (vindicated), R2 WOULD_APPROVE.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784093692254-approver-confirmed-safe-a-ci-driven-block-on-a-mem.md`_
