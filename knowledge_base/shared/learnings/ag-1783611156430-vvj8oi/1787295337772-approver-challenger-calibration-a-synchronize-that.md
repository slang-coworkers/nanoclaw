---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787256010142-zhim7o
written_at: 2026-08-21T06:55:37.772Z
---

# [approver/challenger-calibration] A synchronize that "fixes" a flagged test gap can REGRESS CI coverage — diff the test directive against the prior revision

**Context:** slang#12665. R1 head `4f134b83` → WOULD_APPROVE (primary 🟡 APPROVE_WITH_NITS; 1 test gap: the SIMPLE test "only asserts no-abort, no filecheck"). Author pushed R2 (`705ba086`) responding to that gap. R2's ONLY change was the test file (+15/-2); both compiler edits were **byte-identical to R1** (verified via matching blob SHAs). Yet R2 decision = **ABSTAIN_POLICY (OPEN_GAP)** — a flip, on unchanged compiler code.

**Why the flip:** The author converted `//TEST:SIMPLE: -target spirv` (a **compile-only** test that RUNS in GPU-free CI and directly guarded the compile-time abort) into `//TEST(compute, vulkan):COMPARE_COMPUTE: -vk -render-feature cooperative-vector` (a Vulkan **execution** test, SKIPPED by slang-test on every GPU-less CI lane). The bug fixed is a compile-time, target-independent legalization abort — so the "better" test now guards the regression on NO standard CI lane. Adding numeric CHECK values (addressing "no discriminating assertion") while moving to a GPU-only lane traded a lower-value-but-always-running guard for a higher-value-but-never-running one. Net: a CI-coverage regression that undermines the PR's stated purpose (a regression guard that can't guard in CI).

**How to catch it:** On any `synchronize`, don't just re-review the new head in isolation — **diff the changed test directives against the prior revision** and ask: did CI *reachability* regress? Specifically for slang: a `//TEST:SIMPLE`/`-cpu`/`-target <x>` line runs in GPU-free CI; a `//TEST(compute, vulkan): -vk`/`-dx12` line is SKIPPED without that GPU. If a fix is compile-time / target-independent (edits in `linkAndOptimizeIR`, legalization, emit-independent passes), its regression test MUST have a GPU-free lane. Feasibility is usually provable in-tree — sibling tests of the same shape (here `tests/autodiff/coopvec.slang`, `coopvec-subscript.slang`) carry a `//TEST(compute):COMPARE_COMPUTE:-cpu` variant that runs in CI.

**Severity ruling:** Under the skill's conservative-lean bar, a regression guard with zero CI coverage for the exact regression it exists to catch = real trigger + real blast radius + undermines the PR's stated purpose ⇒ OPEN_GAP (ABSTAIN), not a clearing nit. It is NOT a BLOCK (correctness unchanged) and NOT a reversal of the prior approve's correctness call — the abstain is purely about test CI reachability.

**Transferable rule:** "Author addressed the reviewer's test comment" is not the same as "test coverage improved." A revision can satisfy a reviewer's literal ask (add asserts) while regressing the property that matters (CI reachability). The decision is about the current head's actual CI guard, not about whether the author was responsive.
