---
title: "[approver/false-safe] Never record WOULD_APPROVE while CI is still pending on a behavior-changing PR — Devin-clean is not test-clean"
type: learning
topic: review-approval
source: learnings/1784150830548-approver-false-safe-never-record-would-approve-whi.md
---

# [approver/false-safe] Never record WOULD_APPROVE while CI is still pending on a behavior-changing PR — Devin-clean is not test-clean

**Symptom (near-miss, caught):** On slang #12122 (a new parse-time CLI *rejection* diagnostic, E00046, rejecting conflicting -profile/-capability), I recorded WOULD_APPROVE (CLEAN) @9fe3de9e at 19:58Z. Devin was clean (0 bugs/0 flags) and all 6 clauses passed. But `test-slang` was still PENDING when I decided — it completed ~8 min later FAILING with 29 test failures, because the new diagnostic false-positived on many pre-existing, previously-valid command lines (`glsl_450+spirv_1_5` — the documented way to request SPIR-V 1.5; `sm_6_5 -capability spvShaderInvocationReorderNV`; `glsl_460+GL_EXT_ray_tracing`). The correct decision was BLOCK. The false-safe was averted only because (a) a `synchronize` event forced a re-decision and (b) the OUTPUT_REVIEW critique re-checked live CI and caught the pending→fail transition.

**Root cause of the near-miss:** Two compounding gaps.
1. **Decided on incomplete CI.** The `ci_green_on_sha` clause "passes" under v0-shadow-relaxed because policy does not *require* green CI — but that is an eligibility tag, NOT evidence CI is clean. I let a passing clause + a clean Devin doc stand in for actually reading the CI state. On a PR that changes compiler behavior on *existing* inputs, the test suite is the only thing that catches a runtime regression, and it wasn't done yet.
2. **Trusted a static-diff reviewer as if it ran tests.** Devin (and the production claude-pr-review too) reason about the diff; they do NOT execute the test suite. Devin was clean 0/0 at BOTH heads and never saw the regression. A clean Devin-only doc on a behavior-changing PR is necessary-not-sufficient.

**How to catch it (the rule):**
- **Before recording WOULD_APPROVE on any PR that changes compiler behavior on existing inputs (new/changed diagnostics, lowering, emit, option parsing), the challenger MUST read the actual CI test-job state at the head.** If `test-slang` (or the relevant test job) is still `pending`/`in_progress`, you do NOT have a clean signal — WAIT for it (same discipline as the exit-22 harvest WAIT rule) or ABSTAIN_INFRA, never round a pending suite up to APPROVE. Devin-clean + clauses-pass is not a substitute.
- **A new *rejection* diagnostic's blast radius is EVERY existing invocation of the guarded command-line surface / IR shape** — not just the author's imagined cases. The PR's own passing test controls exercise the cases the author thought of; they cannot cover the existing test corpus. Grep the test suite for the guarded surface (here: every `.slang` using `-profile X+Y` or `-profile ... -capability ...`) and reason about whether the guard fires on legitimate ones. (Parallels the #11152/#12119 __ldg-guard op-set lesson: probe the full set the guard touches, not the happy path.)
- **Classifying CI:** don't reflex-call failures flake. `test-linux-release-gcc-aarch64 / test-slang` FAILED on #12122 but PASSED on every other current open PR (12115/12117/12119/12125/12126) → not aarch64-wide infra; PR-specific. Cross-PR comparison of the same check is a fast, decisive infra-vs-PR-caused discriminator.

**Fix that worked:** the synchronize + OUTPUT_REVIEW-live-CI-recheck. Bake that in proactively: recheck live CI at record time, and treat a behavior-changing PR with unfinished tests as "not yet decidable."

Root cause of the bug itself: `_parseProfile` (slang-options.cpp:2687) records `+`-appended profile atoms as capabilities; the new check flags any version raise, unable to distinguish the intended conflict (`spirv_1_4+SER`) from a deliberate version-bump (`glsl_450+spirv_1_5`) or a shader-model profile.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784150830548-approver-false-safe-never-record-would-approve-whi.md`_
