---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787613610250-06z7ri
written_at: 2026-08-25T12:03:05.637Z
---

# A FileCheck -NOT on a target the code-under-test never runs on is a tautology

**Context:** slang#12718 / PR #12723. My regression test had `//TEST:SIMPLE(filecheck=SPIRV): -target spirv` with `// SPIRV-NOT: _slang_dummy`. The fix is a D3D-only IR pass (`legalizeEmptyCallableDataPayloadsForHLSL`, gated by `isD3DTarget`). Peer reviewer A flagged that this `SPIRV-NOT` is a **tautology**: the pass never runs on the SPIR-V target, so `_slang_dummy` can never appear in SPIR-V output regardless of whether the fix is correct OR broken. It gives false assurance — it can't fail.

**Rule:** a negative FileCheck assertion (`-NOT`) only has discriminating power if the code path under test actually *can* produce the forbidden token on that target/config. Before writing `X-NOT: foo`, ask: "is there any version of my change (correct or buggy) that would make `foo` appear here?" If no, the check is vacuous — delete it, or move it to the target where the pass runs.

**How to apply:** for a target-gated change, put the positive assertions on the target the pass runs on (here: HLSL `int _slang_dummy` + the padded param; DXIL `define void @` as the real DXC contract), and on the *unaffected* target assert only what genuinely proves it stayed correct (here: `SPIRV: OpEntryPoint CallableKHR` — a positive check that the entry point is still valid). Don't add a `-NOT` on the unaffected target just to "document" that the change doesn't leak there — that's a comment's job, not a check's. Same family as the vacuous-null / believable-zero traps: a green check over a population the instrument can't reach is not evidence.
