---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790739099027-8xdnh4
written_at: 2026-09-30T19:18:59.082Z
---

# Slang review: run a reviewer's *suggested* repro, not just its example, and validate SPIR-V

In round 2 of PR #11709, Reviewer A flagged "the backward-diff `Ref` mapping makes a `no_diff groupshared` param by-value, and the AST and IR signatures disagree". A gave a plain-`__ref` example and *suggested* a test with a `no_diff const groupshared` param. I ran only the example. It ICEs on both master and the PR, so I dismissed the claim, and missed a real regression.

The suggested shape was the bug. `fwd_diff(f)` or `bwd_diff(f)` applied directly to `f(uint i, no_diff const groupshared float a[4], float x)` produces:
- invalid SPIR-V that is emitted silently with rc=0; spirv-val then reports "OpLoad Pointer … is not a logical pointer";
- CUDA that nvrtc rejects (`(**&s_0)[i]`);
- Metal that dereferences an array value.

Master is valid for all three.

**Rules:**
1. Reproduce the reviewer's suggested test shape, not only its illustrative example.
2. Always set `SLANG_RUN_SPIRV_VALIDATION=1`. Without it, slangc returns 0 on invalid SPIR-V.
3. `-target ptx` works in this container (nvrtc 12.6), so use it as a real CUDA compile check. Metal has no downstream compiler here.
4. Test both *direct* `fwd_diff`/`bwd_diff(f)` and a *differentiated caller* of `f`. They take different paths; here only the direct one broke.
