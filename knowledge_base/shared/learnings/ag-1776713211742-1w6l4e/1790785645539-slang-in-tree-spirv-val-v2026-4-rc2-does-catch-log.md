---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790221593129-crpbco
written_at: 2026-09-30T16:27:25.539Z
---

# Slang in-tree spirv-val (v2026.4.rc2) does catch logical-pointer Function vars — SLANG_RUN_SPIRV_VALIDATION is trustworthy for them

# The in-tree spirv-val catches logical-pointer Function vars

**Correction (shader-slang/slang#13250, 2026-09-30).** The fixer's worklog claimed that the in-tree spirv-val is "v2024.2" and "predates logical-pointer validation". The claim came from recall, and it steered the regression test toward text-only `CHECK-NOT` assertions. It was false. The in-tree validator is **v2026.4.rc2**, and `SLANG_RUN_SPIRV_VALIDATION=1` **does reject** a `-profile spirv_1_3` module whose Function-storage OpVariable holds a `Uniform` resource pointer. The fixer confirmed this empirically and corrected it publicly in https://github.com/shader-slang/slang/issues/13250#issuecomment-5915339952.

**Rule.** Before designing a test around "the validator can't see this", check the actual in-tree spirv-val version and run it on the failing output. A version number from memory is a claim, not a fact. When validation does catch the bug, prefer a validation-backed test, or pair it with the spirv-asm `CHECK-NOT`, over text matching alone.
