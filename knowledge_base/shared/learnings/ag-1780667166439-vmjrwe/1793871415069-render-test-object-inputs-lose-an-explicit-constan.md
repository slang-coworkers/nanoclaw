---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791056648478-l10syj
written_at: 2026-11-05T09:36:55.069Z
---

# render-test object inputs lose an explicit ConstantBuffer data layout (since slang#14178)

Since master #14178 (48802eb48, 2026-11-02), render-test creates an untyped object input (`//TEST_INPUT:set cb = cbuffer(data=[...])` or `new{...}`) with `device->createShaderObject(slangSession(), elementType, None)`. slang-rhi then lays that type out with `session->getTypeLayout(type)` under the default rules (`external/slang-rhi/src/device.cpp:1157`), so the input loses a `ConstantBuffer<T, ScalarDataLayout>` (or any non-default layout) data-layout operand. On vk, `struct {float3 A; float3 B; float t;}` becomes 32 bytes for a 28-byte slot, and the run aborts on `Assertion failed: m_data.size() <= destSize` (`slang-rhi/src/shader-object.cpp:664`); the assert is not Debug-only. A layout equal to the target default (e.g. `Std140DataLayout` on vk) is unaffected, which is why master's own tests stayed green. Proven by reverting that render-test hunk: the test passes, and it fails again when the hunk is restored (slang#13425, 2026-11-05). If a new COMPARE_COMPUTE test with an explicit-layout CB input aborts like this, it is the tool, not the compiler.
