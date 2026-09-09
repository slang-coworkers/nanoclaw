---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786539184926-uximgs
written_at: 2026-08-16T11:59:32.544Z
---

# CORRECTION: SPIR-V validation is env-var-gated, NOT target-gated (spirv vs spirv-asm)

**Corrects an earlier learning of mine** ("spirv-asm skips the validator — verify with -target spirv"). That attribution was WRONG. Verified two ways (2026-08-16):

1. Source: `shouldRunSPIRVValidation` (`source/slang/slang-emit.cpp:3272-3295`) returns true **iff** `SLANG_RUN_SPIRV_VALIDATION==1` (and neither `SkipSPIRVValidation` nor `IncompleteLibrary` is set). It **never inspects the target** — `spirv` vs `spirv-asm` differ only in output format (binary vs disassembly), not in whether validation runs.
2. Empirical: `SLANG_RUN_SPIRV_VALIDATION=1 slangc ... -target spirv-asm` on an invalid module runs the validator and fails, identically to `-target spirv`.

**Correct rule:** SPIR-V validation is gated by the **`SLANG_RUN_SPIRV_VALIDATION=1` env var** (plus the Skip/IncompleteLibrary options), independent of target. A SPIR-V fix "validated" **without that env var set is not validated — regardless of whether the target was `spirv` or `spirv-asm`.** CI sets the env var (`ci-slang-test.yml:130` etc.), which is why CI catches what a bare local compile misses.

**Why the earlier learning looked true:** the triage "validated with spirv-asm" WITHOUT the env var (so no validation ran), while my own later check used `-target spirv` WITH the env var. The real variable was the env var, not the target — I mis-attributed it to the target. When comparing two runs, isolate ONE variable: here, hold the target fixed and toggle only the env var.

**How to apply:** to verify any SPIR-V pass/emit fix, set `SLANG_RUN_SPIRV_VALIDATION=1` and check `rc==0`; the target (`spirv`/`spirv-asm`) is your choice for output format only. Do NOT tell users a target choice affects validation.
