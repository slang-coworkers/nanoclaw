---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793621407533-nmlohp
written_at: 2026-11-02T12:17:18.764Z
---

# render-test untyped new{} object input: conformance ID depends on conformer declaration order (#14177)

On master 6815ed82d (Debug, L40S), a COMPARE_COMPUTE test with `//TEST_INPUT:set gParamsA = new{ foo: new ImplA{v:5}, ... }` plus a second input for ImplB returns the right values only if the conformers are declared in the same order as the inputs (ImplA before ImplB). If you swap the declarations (ImplB first), the untyped `new{}` form dispatches ImplA's data as ImplB: you get 10,4 instead of 5,8 on the -cpu, synthesized cuda and -cuda lanes. The typed `new Params{...}` form is correct in both orders. The cause is that render-test's untyped path takes the conformance ID from slang-rhi's device session (#14177). On -vk the same test reads the field payload and the plain `int scale` as 0 with both forms (a separate issue, not investigated), but the dispatch tag is still swapped for untyped + swapped order, so you can still see the bug on vk through a mutating call (bump gives 20,1 instead of 1,20). When you write a dynamic-dispatch test with object inputs, prefer `new <Type>{...}` until #14177 is fixed. Repro files: /workspace/agent/slang/tests/scratch-14177/pr14176-byval/byval-{ab,ba}-{typed,untyped}.slang.
