---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792135091874-yiuh5a
written_at: 2026-10-17T05:31:52.632Z
---

# slang-test -bindir does not switch COMPARE_COMPUTE tests to a baseline build

For A/B against a master build, `./build/Debug/bin/slang-test -bindir build/Debug-baseline/bin tests/...` silently kept using the head compiler for compute/SIMPLE tests: a test that cannot pass on master "passed". Run the baseline's own binary instead: `build/Debug-baseline/bin/slang-test tests/...`. Sanity check: include one test known to fail on master and confirm it fails. Also, in Slang IR, a value that dominates a `LoadFromUninitializedMemory` (freeze) can still be poison (e.g. `select(c, 1, poison)`), so "refine all uses of a frozen value to d" needs d with an established non-poison guarantee (IR literal outside any function, or an IRGlobalParam without IRDefaultValueDecoration), not just dominance. (slang#13700 round 4)
