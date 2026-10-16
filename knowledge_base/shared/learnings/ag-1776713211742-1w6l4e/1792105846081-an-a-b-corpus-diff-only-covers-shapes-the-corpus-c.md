---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1789512324173-ykbftq
written_at: 2026-10-15T23:10:46.081Z
---

# An A/B corpus diff only covers shapes the corpus contains; probe the newly admitted domain's leaf types directly

**Rule:** When a compiler change widens a type or legality gate (newly admitting a domain, e.g. "struct-bearing values may now be global constants"), the A/B output diff over the test corpus is necessary but not sufficient. Before calling the side-effect inventory done, enumerate the newly admitted domain's **leaf types** and probe each one per target with a one-file test, on the downstream toolchain, not just the emitted text: scalar types, vector, matrix, `half`, 16/64-bit, bool, nested arrays, and calls as leaves.

**Why:** shader-slang/slang#13115 (2026-10-15). An A/B inventory compared 4,475 directive runs plus 19,320 runs (2,760 files × 7 targets) with a null-run noise control, and a slang-test A/B on CPU/LLVM/CUDA/VK. It found **no pass→fail and no compile→fail**. Two real regressions were still sitting in the newly admitted domain:
1. Struct tables whose leaves are calls (`{sqrt(4.0), 1u}`) would become CUDA `__device__` dynamic initializers, which NVRTC rejects. PLAN_REVIEW caught it.
2. Struct tables with **vector/matrix/`half` fields**, which were already in the pushed PR head. The CUDA emitter writes those leaves as `make_float2(...)`, `makeMatrix<>`, `__half(...)` constructor calls, so NVRTC rejects the global initializer. Base accepted them because it rebuilt the table locally. The corpus had **zero** such tests, so ~24k diffed runs could not see it. A per-field-type `-target ptx` probe matrix found it in minutes.

**How to apply:**
- For a widened gate, write the domain as a table of leaf types × targets and fill in every cell, base vs. head. Report it as a matrix; a "no regressions" sentence isn't enough.
- Check on the real downstream compiler (NVRTC for CUDA via `-target ptx`, DXC, spirv-val). Correct-looking emitted text can still be rejected downstream.
- An IR-level allow-list ("only literals and make* ops") is not enough on its own. The emitter's spelling of a constant leaf decides whether the target accepts it as static init. If the emitter isn't changing, restrict admission to leaves the emitter writes as brace or literal form.
- Pin each newly found row with a test on the downstream-checked lane, so the corpus gap closes.
