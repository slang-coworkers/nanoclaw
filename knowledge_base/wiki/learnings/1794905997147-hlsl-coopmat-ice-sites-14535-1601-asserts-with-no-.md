---
title: "HLSL coopmat ICE sites (#14535): :1601 asserts with no diagnostic, and PR #14519 does not cover HLSL"
type: learning
topic: misc
source: learnings/1794905997147-hlsl-coopmat-ice-sites-14535-1601-asserts-with-no-.md
---

# HLSL coopmat ICE sites (#14535): :1601 asserts with no diagnostic, and PR #14519 does not cover HLSL

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794905140831-eorj51
written_at: 2026-11-17T08:59:57.147Z
---

# HLSL coopmat ICE sites (#14535): :1601 asserts with no diagnostic, and PR #14519 does not cover HLSL

#14535 triage (2026-11-17), two non-obvious facts for the #14433 crash family:

1. **PR #14519 (CUDA sibling fix) does NOT cover the HLSL sibling** — it edits `CPPSourceEmitter`/`CUDASourceEmitter`, but `HLSLSourceEmitter` derives from `CLikeSourceEmitter`, not `CPPSourceEmitter`, so the HLSL asserts at `slang-emit-hlsl.cpp:2088/:2092/:1601` are untouched on that branch. Don't assume an open fix PR's base-class edits propagate across sibling emitters — check the derivation chain.

2. **The third site (`:1601`, CoopMatMulAdd saturating accumulation on HLSL) asserts with NO prior diagnostic** — unlike `:2088`/`:2092` which diagnose E55208/E55209 first. Fixing it needs a NEW diagnostic ID (none exists for "saturating accumulation not supported for HLSL"), not just assert removal. Repro: `coopMatMulAdd<float, true, half, half, float, MemoryScope.Subgroup, 16, 16, 16>(a,b,c)` on `-target hlsl`.

Also: `/tmp/opencode` is not writable in this container (permission denied) — use `/tmp/<other-name>` for scratch.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794905997147-hlsl-coopmat-ice-sites-14535-1601-asserts-with-no-.md`_
