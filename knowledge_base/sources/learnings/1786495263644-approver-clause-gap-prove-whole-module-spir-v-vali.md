---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786491345130-nkin9y
written_at: 2026-08-12T00:41:03.644Z
---

# [approver/clause-gap] Prove whole-module SPIR-V validity with only a pre-fix compiler: matched before/after + fail-fast awareness

**Context:** Adjudicating a Devin flag on slang #12467 (fix declares `OpCapability SampleRateShading` for `sample` interpolation). Flag: un-suppressing a multi-modifier generated test means the WHOLE sub-test must now pass spirv-val, not just the sample path. I only had a PRE-fix compiler in the tree (`build/slang-<ver>-linux-x86_64/bin/slangc`; the Debug build was missing its `slang-glslang` .so, so validation couldn't run there — only the release tarball has both `libslang-glslang` and `libslang-llvm`).

**Two traps, both caught by codex critique:**
1. **Grammar ≠ whole-module proof.** Reading `external/spirv-headers/.../spirv.core.grammar.json` proves which decorations need which capability (Flat/NoPerspective/Centroid → only `Shader`; `Sample` → `SampleRateShading`; Patch → Tessellation). That shows no OTHER interpolation decoration lacks a capability — but NOT that the complete module has no unrelated validation failure.
2. **spirv-val is FAIL-FAST** (`external/spirv-tools/source/val/validate.cpp:316`, returns on first error). So a pre-fix run that emits exactly ONE error only proves that error surfaces FIRST — later failures are never reached. A single-error pre-fix log is NOT proof it's the only error.

**The method that actually proves it (no post-fix build needed):** run a matched BEFORE/AFTER on the pre-fix compiler.
- BEFORE: pre-fix on the exact shader, `SLANG_RUN_SPIRV_VALIDATION=1 -target spirv` → confirms the specific error exists.
- AFTER: reproduce the fix's EFFECT rather than the fix — declare the same capability by a legitimate in-language means (here: add an `SV_SampleIndex` input, which declares `SampleRateShading` module-wide via the SV path), yielding the IDENTICAL decoration set with the capability present. Then run full validation → **EXIT 0** means the COMPLETE module validates end-to-end (validation ran to completion, not stopped at an error). Run it under both `-target spirv` and the exact suppressed directive form (`-target spirv-asm`).

EXIT 0 on the capability-declared complete module is the whole-module proof; it defeats the fail-fast objection because completion (not first-error-stop) is what exit 0 signals. This corroborates a PR body's "N/N passed" claim by measurement instead of trusting the untrusted body. Always record compiler path + sha256 + exact commands + exit statuses in the log.
