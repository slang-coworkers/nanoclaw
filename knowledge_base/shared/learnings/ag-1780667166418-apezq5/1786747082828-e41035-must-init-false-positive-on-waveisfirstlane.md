---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786732270188-k2n5w4
written_at: 2026-08-14T22:38:02.828Z
---

# E41035 must-init false positive on WaveIsFirstLane-guarded out-param store

**shader-slang/slang#12545** — E41035 "may be uninitialized on some paths" fires on `uint v; if(WaveIsFirstLane()){ buf.InterlockedAdd(...,v); } WaveReadLaneFirst(v)`. The pass is `source/slang/slang-ir-use-uninitialized-values.cpp`: `getCallUsageType` (:363-406) correctly recognizes an out/inout/ref call arg as a Store, but `cancelLoadsByDefiniteAssignment` (:606-812) is a **single-thread forward-CFG** "clean-reachable" check with NO wave-broadcast model — the store inside the `if(WaveIsFirstLane())` barrier leaves a store-free else path to the later read.

**⭐ Non-obvious, cost several review rounds — the wave op is ESSENTIAL, not a red herring.** My first instinct ("the wave op is incidental, a plain read warns too, so it's a red herring") INVERTED the truth: with a plain read the SAME warning is a genuine TRUE positive (a non-first-active lane never took the `if`). `WaveReadLaneFirst`/`WaveIsFirstLane` operate on the **first ACTIVE lane** (NOT lane index 0). A correct fix must match the specific correlation `WaveIsFirstLane`-guard ↔ `WaveReadLaneFirst`-read; keying on "any wave read" or "out-param store" would silence real bugs (control: store guarded by `if(!WaveIsFirstLane())` + `WaveReadLaneFirst` = genuinely uninitialized, must still warn).

**Direct-vs-out-param asymmetry:** a *direct* conditional store (`v=7`) is CLEAN because the var is SSA-promoted (`isPromotableVar` slang-ir-ssa.cpp rejects any var used as a CALL arg → out-param vars stay in memory) then SCCP folds `merge(undef,7)→7`, erasing the evidence BEFORE the uninit check (order: slang-lower-to-ir.cpp:15605 `constructSSA`→`applySparseConditionalConstantPropagation`). Out-param store's address escapes → stays a memory var+load → analyzed. So the must-init pass only sees non-promotable locals; direct conditional stores are a documented FALSE NEGATIVE (tests/diagnostics/uninitialized-must-init.slang:7-8).

**Regression-pin technique (no old-tag build):** E41035 was introduced by #11293, and `git rev-parse v2026.11^{commit}` == that commit, so the introducing commit IS the release tag. Verify by `git show <commit>^:slang-diagnostics.lua | grep -c <diag-name>` (0 in parent) vs at commit (1). This makes it a regression vs pre-v2026.11 — NOT the reporter's claimed v2026.14.1. Don't attribute to a same-window commit just because it touched the same FILE (#11595 added one `isMetaOp` line but not the analysis function) — check the function, not the file.
