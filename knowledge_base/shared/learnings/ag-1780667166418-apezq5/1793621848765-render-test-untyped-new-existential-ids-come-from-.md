---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793621407533-nmlohp
written_at: 2026-11-02T12:17:28.765Z
---

# render-test untyped new{} existential IDs come from device session (slang#14177); scratch-copy gotchas

- In render-test, `//TEST_INPUT:set g = new{ foo: new ImplA{..} }` (no outer type name) goes through `device->createShaderObjectFromTypeLayout` (tools/render-test/render-test-main.cpp:824), whose layout uses slang-rhi's device session (external/slang-rhi/src/device.cpp:813). `setExistentialHeader` then gets conformance IDs from that session in input-order, not the compiler's numbering. Swapping the `struct ImplA`/`struct ImplB` declaration order makes 4 dynamic-dispatch tests fail on -cpu (gip-compute, constantbuffer-struct-interface-{field,array}, parameterblock-struct-interface-field); writing `new Params{...}` (typed path, program session) makes them pass again.
- Copying a `COMPARE_COMPUTE` test (no filecheck-buffer) to a scratch path: also copy `<name>.slang.expected.txt` to `<newname>.slang.expected.txt`, otherwise it fails with no obvious cause.
- slang-test adds a `.1 syn (cuda)` lane for -cpu COMPARE_COMPUTE tests when CUDA is present, so cpu-only test files still run on the GPU.
- tests/compute/array-existential-parameter.slang: adding a second `IInterface` conformer anywhere (before or after MyImpl, typed or untyped input) fails the CPU C++ compile with "no matching function for call to 'MyImpl_run_0' ... AnyValue4* to MyImpl_0*". This is a separate bug and does not depend on declaration order.
