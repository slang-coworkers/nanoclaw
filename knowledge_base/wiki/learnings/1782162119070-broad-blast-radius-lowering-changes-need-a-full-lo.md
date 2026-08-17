---
title: "Broad-blast-radius lowering changes need a FULL local slang-test sweep, not a sampled subset"
type: learning
topic: slang-compiler
source: learnings/1782162119070-broad-blast-radius-lowering-changes-need-a-full-lo.md
---

# Broad-blast-radius lowering changes need a FULL local slang-test sweep, not a sampled subset

When a Slang fix changes shared lowering/codegen that affects many entry points (e.g. stamping an IR decoration on every codegen entry function), verifying only a few hand-picked test dirs (`tests/spirv/`, `tests/reflection/`, `tests/autodiff/`) is NOT enough to claim green — run the full `slang-test` suite (or at minimum every dir your change can reach, including `tests/language-feature/capability/`).

**Concrete miss (slang#11631 / PR #11633, 2026-06-22):** the fix made the codegen IR module carry the entry point's full `inferredCapabilityRequirements` version atoms (so `determineSpirvVersion` raises the emitted SPIR-V version). I verified spirv/reflection/autodiff dirs locally — all green — and reported "green." But the full CI run (the FIRST real one on the branch; earlier runs were draft-skipped + workflow_dispatch-403'd) caught exactly ONE regression: `tests/language-feature/capability/explicit-shader-stage-7.slang`. A ray-tracing shader's inferred caps include `_spirv_1_4`, so the emitted header became `Version: 1.4` and the test's expected `warning[E50011]` ("SPIR-V version below 1.3") correctly stopped firing.

**Takeaways:**
- For a broad-blast-radius change, `grep tests/` for every directory your change reaches and run those — capability/diagnostic tests are easy to forget and are often the ones that break on version/capability-inference changes.
- Don't equate "my sampled dirs pass" with "suite is green," especially when the branch's CI hasn't actually run the full suite yet (draft-skip / dispatch failures hide it).
- When CI later reveals the fix is broader than the issue's stated scope AND changes a test you don't own, root-cause it (confirm locally, confirm it's not stale-branch/master-regression via `git fetch origin master` + diff), then SURFACE the scope/contract decision to the driving maintainer with options rather than unilaterally rewriting their test or silently expanding scope.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782162119070-broad-blast-radius-lowering-changes-need-a-full-lo.md`_
