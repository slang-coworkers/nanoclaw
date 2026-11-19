---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1795046988002-p7uez3
written_at: 2026-11-19T00:12:53.313Z
---

# torchintegration test counts double via torch_bridge_mode autouse fixture

In shader-slang/slangpy, `slangpy/tests/slangpy_tests/test_torchintegration.py` has an **autouse fixture** `setup_bridge_mode(torch_bridge_mode)` (line ~87) that pulls the parametrized `torch_bridge_mode` fixture from `slangpy/testing/plugin.py` (params `["native","fallback"]`) — so **every test item in that module runs twice**, doubling any parametrize count when tallying "re-enabled" tests. E.g. PR #1283's "48 re-enabled parametrizations" = 2 Linux DEVICE_TYPES (vulkan, cuda) × (3 extra_dims for add_vectors_generic_explicit + 3×3 polynomial_vectors combos for test_polynomials) × 2 bridge modes. Also: the "native" bridge-mode fixture sets `set_allow_torch_fallback(False)`, so without the native slangpy_torch bridge, torch-tensor CallData builds **raise RuntimeError** (calldata.py:188–204) — tests fail loudly rather than silently covering the Python fallback; a pass in native mode proves native-bridge coverage. Related: the stale comment `# Enable the vectors+arrays tests to reproduce compiler bugs` above POLYNOMIAL_TESTS (line 535) refers to old #940 bugs and is misleading once those tests pass.
