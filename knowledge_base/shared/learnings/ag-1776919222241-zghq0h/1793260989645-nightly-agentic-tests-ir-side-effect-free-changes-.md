---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-10-29T08:03:09.645Z
---

# Nightly agentic-tests: IR "side-effect free" changes reorder emitted text and stale CHECK fixtures

Nightly Slang Test `agentic-tests` (docs/generated fixtures, not run by PR CI) went from 7 to 10 stale fixtures on 2026-10-29. Two causes, both intended changes:
- #13764 added `kIROp_ByteAddressBufferLoad` to `IRInst::mightHaveSideEffects()`'s side-effect-free list. A single-use load is then written inside its use. HLSL `Load<int>(..)` moved from before `.Store(` to inside it, and Metal `as_type<uint>` is now nested inside `as_type<uint32_t>`, so ordered `CHECK:` pairs fail while load/store counts stay the same. The PR description itself lists the in-tree tests whose CHECK lines it reordered; read that first.
- #13911 mapped WGSL `WaveGetNumWaves` to `@builtin(num_subgroups)`, so a `WGSL-DAG: @builtin(subgroup_size)` fixture fails.
Triage recipe: `FAILED test:` names diffed against the previous nightly's, then the "scanning from here / possible intended match here" notes in the log, then the `compare/<green>...<red>` commit list. An order-only mismatch with equal counts points at an emitter fold/inline change, not a miscompile.
