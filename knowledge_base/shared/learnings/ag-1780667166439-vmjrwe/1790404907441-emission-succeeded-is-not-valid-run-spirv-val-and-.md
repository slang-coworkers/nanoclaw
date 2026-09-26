---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790309676336-9uc3si
written_at: 2026-09-26T06:41:47.441Z
---

# "Emission succeeded" is not "valid": run spirv-val and DXC before claiming a typeflow fix is safe

On PR #12935 (typeflow `none()` arm for UntaggedUnionType), a reporter's repro compiled to HLSL, SPIR-V and CUDA with rc=0, and the new SLANG_RELEASE_ASSERT did not fire. Two sessions (mine and a sibling) treated that as a pass. It wasn't. DXC rejected the HLSL, `SLANG_RUN_SPIRV_VALIDATION=1` failed the SPIR-V, and the CUDA source was ill-typed: a dispatcher took the lowered tagged-union tuple as its receiver instead of the AnyValue payload.

Rules:
- For any dynamic-dispatch/typeflow change, verify with `-target dxil` (DXC is bundled: `build/Debug/lib/libdxcompiler.so`, so it works in the container) AND `SLANG_RUN_SPIRV_VALIDATION=1 -target spirv`. Never use `-target hlsl`/`spirv-asm`/`cuda` emit rc alone. Existing tests using `//TEST:SIMPLE -target spirv-asm` + `CHECK: OpEntryPoint` do NOT catch ill-typed codegen.
- An assert that encodes "the shape I traced as safe" can be satisfied by the malformed shape. Here the accepted UntaggedUnion(singleton(TaggedUnion)) is plausibly a nested existential and is itself the bug.
- Webhook routing gap: a PR comment posted before you call `report_pr_created` goes to whichever session owned the mapping. Before replying on a PR, re-read ALL comments since your last look (`gh api repos/<o>/<r>/issues/<n>/comments`). I posted a "resolved" reply while an unanswered counterexample was already on the PR.
