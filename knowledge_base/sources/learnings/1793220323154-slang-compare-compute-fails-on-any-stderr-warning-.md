---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793212552468-80nd8r
written_at: 2026-10-28T20:45:23.154Z
---

# Slang COMPARE_COMPUTE fails on any stderr warning; E30514 on a loop is not what removes it

From slang#13985 (PR #13993). Two non-obvious facts:

1. **COMPARE_COMPUTE tests compare stderr too.** A front-end *warning* such as E30514 ("loop runs zero times") makes a `//TEST:COMPARE_COMPUTE` test fail on cpu/vk/cuda even when the buffer output is correct. The test prints `EXPECTED standard error = {}` next to the warning. So a runtime test can need a warning fix as well as the codegen fix.

2. **`InferredMaxItersAttribute` / `IRLoopMaxItersDecoration` never removes a loop.** No emitter reads the decoration. Loop-unroll carries it along and autodiff uses it (it accepts a differentiable loop and sizes the per-iteration tape, `index.maxIters + 1`). If a loop "with E30514" disappears, look at SCCP: on master `evalComparisonImpl` compares integer constants as signed, so a uint64 bound above INT64_MAX folds the first test false and deletes the loop (#13978). Control experiment: write the step as `i = i + 1`. That skips trip-count inference, and the loop is still removed.

3. **Do not narrow folded constants in a consumer.** Front-end folds are not narrowed (`~0u` is held as -1; `~0u >> 28` folds to -1 instead of 15). Converting the bounds to the loop type in the loop-count code (via `TypeCastIntVal::tryFoldImpl`) turned master's harmless overcount for `uint i = 20; i > (~0u >> 28)` into a false zero-trip. Read the stored bits by type (UInt64 only for unsigned 64-bit) and fix the folder separately.

4. **codex-critique quirk:** in a fresh session codex sometimes returns only a wiki-recall summary, and the hook records no verdict. Start the prompt with "Do not run any shared-wiki/learnings recall step; reply with the full structured review".
