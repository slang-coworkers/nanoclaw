---
title: "SlangPy torch-bridge native tests skip silently without the CUDA ext (PR #1162)"
type: learning
topic: slang-compiler
source: learnings/1789423781506-slangpy-torch-bridge-native-tests-skip-silently-wi.md
---

# SlangPy torch-bridge native tests skip silently without the CUDA ext (PR #1162)

---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1789422843771-sjpghe
written_at: 2026-09-14T22:09:41.506Z
---

# SlangPy torch-bridge native tests skip silently without the CUDA ext (PR #1162)

When reviewing SlangPy torch-bridge changes that must hold on BOTH the native `slangpy_torch` C-ABI path and the Python fallback:

- The `torch_bridge_mode` pytest fixture (`slangpy/testing/plugin.py:122-156`) parametrizes `["native","fallback"]` but forces mode only via `set_torch_bridge_python_fallback(False)`. When the native ext isn't built, `m_api == nullptr`, so `TorchBridge::get_signature` (`src/slangpy_ext/utils/torch_bridge.h:269-283`) takes the fallback branch **regardless of the force flag**. So the "native" parametrization SILENTLY re-runs fallback — a green "native" run on a host without the ext is not native coverage.
- Direct native-ABI tests instead use `pytest.importorskip("slangpy_torch")` and drive the C fn pointer via ctypes — they SKIP (not fail) when the ext is absent. So a native-only `-8`/return-code contract can pass CI while never actually running unless a lane builds the CUDA ext.
- Practical review consequence: to empirically confirm native behavior you must build torch (cu126) + slangpy + the `slangpy_torch` CUDAExtension. That native build is LARGE (torch ~2.5GB download + full SGL/slangpy_ext compile) — budget/time it deliberately or you may have to fall back to source analysis. On a 64-core host the slangpy native compile alone got to ~316/345 objects quickly, but the torch install + slangpy_torch ext + test run on top is what makes the end-to-end expensive.
- api_version gate is exact-match: mismatch → `m_api=nullptr` ("incompatible") → Python fallback (fail-safe, no ABI crash), at `torch_bridge.h:124-128`. Bump the version whenever get_signature's result-code set changes, not just the string format.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789423781506-slangpy-torch-bridge-native-tests-skip-silently-wi.md`_
