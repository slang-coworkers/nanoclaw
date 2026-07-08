---
name: project_11990_iarray_subscript_64bit_pending
description: PENDING design —
metadata: 
  node_type: memory
  type: project
  originSessionId: bfbc97e5-7214-49f0-b658-32e0cd79fe6a
---

**#11990** (shader-slang/slang) — bot-filed (`nv-slang-bot[bot]`) follow-up design-decision issue, opened 2026-07-08. This is the tracked root-cause issue Main directed the fixer to file off the #11967 chain. See [[project_11967_64bit_indexing_e2e]].

**The defect:** `IArray<T>`/`IRWArray<T>` interface requirement is `__subscript(int index)` (hardcoded 32-bit) in core.meta.slang. A `uint64_t` index routed through a generic `IArray`/`IRWArray` constraint is `intCast(UInt64)→Int` **truncated at the interface boundary** (warning 30081). Direct concrete-buffer subscript (`RWStructuredBuffer<int>` by `uint64_t`) is **unaffected** — those subscripts are already `__generic<TIndex : __BuiltinIntegerType>`.

**Why niche:** actual miscompute needs BOTH (1) index ≥ 2³² (>8 GB device buffer) AND (2) access through a generic `IArray`/`IRWArray` constraint. Common direct-indexing case is fine.

**The open question (maintainer call):** widen the requirement to `__generic<TIndex : __BuiltinIntegerType> __subscript(TIndex)` — accepting the conformance/witness-synthesis surgery that **E38100** proves is required (magic types Array/vector/matrix don't synthesize a witness for a *generic* subscript requirement) — OR leave the interface-path 32-bit limit as-is (documented). @skiminki-nv already flagged hesitation about widening; the E38100 cascade confirms it.

**Chain discipline:**
- Author = our own bot → this `issue_opened` webhook is a **footprint echo, not a routing inbound**. NO dispatch triggered by it. [[project_bot_comment_webhook_echo]]
- **NO fixer dispatched, NO auto-post.** Parked design-decision issue, no maintainer go. Issue body IS the public artifact. [[feedback_dont_close_open_proposals]], parked-feature discipline.
- Re-engage ONLY on a substantive **human** (non-bot) maintainer comment on #11990 → then route as a live chain on canonical thread. A maintainer "go" on widening is the only trigger to dispatch a fixer. [[feedback_reopen_not_release_parked_feature]]
- #11967 (the E2E test re-pinning the interface path to current truncating behavior + documenting this limit, draft PR `Closes #11967`) is the separate in-flight fix chain — still awaiting fixer's [Fix Report].
