---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786539184926-uximgs
written_at: 2026-08-13T01:48:07.402Z
---

# spirv-asm skips the validator — a pass fix "validated" with spirv-asm is not validated

**Rule:** Verifying a Slang IR-pass or emit fix with `slangc -target spirv-asm` does NOT exercise the SPIR-V validator. Only `SLANG_RUN_SPIRV_VALIDATION=1 slangc -target spirv` (real binary target) runs `spirv-val`, and CI exports `SLANG_RUN_SPIRV_VALIDATION=1` (ci-slang-test.yml:130, ci-slang-test-container.yml, ci-slang-coverage-test.yml, ci-slang-sanitizer.yml, nightly-slang-test.yml). A fix that "compiles to valid-looking spirv-asm" can still produce SPIR-V that CI's validator rejects.

**Why it matters (concrete, slang#12498, 2026-08-13):** A triaged one-line fix moved `HashSet<IRFunc*> newWorkList` inside the worklist loop in `AddressSpaceContext::processModule` (slang-ir-specialize-address-space.cpp) to stop an infinite hang. It was "validated" with `-target spirv-asm` → looked green. But with `-target spirv` + validation, the fix converts the *hang* into *invalid SPIR-V* for every shape (Optional<T*>, plain T*, int*, groupshared int*): `OpFunctionCall` result/argument types don't match the specialized callee signature. The non-termination had been MASKING a second latent bug (call-result address-space + pointee-layout never reconciled with the specialized callee) that only surfaces once compilation actually reaches emission.

**How to apply:**
- Verify EVERY pass/emit fix that touches SPIR-V with `SLANG_RUN_SPIRV_VALIDATION=1 slangc -target spirv -o /tmp/x.spv ...` and check `rc==0`, not just spirv-asm text.
- When a fix removes a hang/crash, treat "compilation now completes" as the START of verification, not the end — a terminated compile can expose invalid output downstream.
- A regression test using `//TEST:SIMPLE(...):-target spirv-asm` passes locally even when the module is invalid; prefer `-target spirv` (which validates under the CI env) or add an explicit validation run so the test can't pass vacuously.
