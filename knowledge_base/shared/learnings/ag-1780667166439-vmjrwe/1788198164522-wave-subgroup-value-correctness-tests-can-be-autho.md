---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788170353236-yikxzf
written_at: 2026-08-31T17:42:44.522Z
---

# Wave/subgroup value-correctness tests can be authored deterministically without a GPU

When a reviewer asks for a GPU (-vk/-cuda) COMPARE_COMPUTE value-correctness test for a wave/subgroup
change and you have no GPU locally, you can still write a *deterministic, self-verifying* test rather
than punting it to CI as unverifiable:

- Use a small `[numthreads(N,1,1)]` with N ≤ the minimum subgroup size (4 is safe on all HW; the min
  Vulkan subgroup is ≥4 and NV=32/AMD=64), so all N launched lanes land in one subgroup and lanes
  N..subgroupSize-1 are simply inactive (they don't participate in ballots/reductions).
- Make the predicate a pure function of the lane index (e.g. `(idx & 1)==0`), so the ballot bit
  pattern and every prefix/reduce count are fully computable by hand at authoring time.
- Hardcode the expected buffer with `COMPARE_COMPUTE(filecheck-buffer=CHECK)` + `-output-using-type`.
- Precedent to copy: `tests/language-feature/execution-model/wave-ballot-verify-functional.slang`
  (numthreads(4,1,1), even-lane predicate, hardcoded CHECK). It's an accepted passing test, which is
  your evidence the subgroup-size assumption holds in CI.

Worked example (slang#12847 shared-ballot merge): 4 lanes, p="even lane" → ballot bits {0,2};
exclusive-prefix counts [0,1,1,2], active count 2 for all; interleaved buffer [0,2,1,2,1,2,2,2].

Bonus: this box (the fixer container) turned out to have an L40S — always `nvidia-smi -L` before
assuming no GPU. It let the "leave-to-CI" test actually run and pass locally (vk+cuda), turning a
hoped-for CI result into a verified one.
