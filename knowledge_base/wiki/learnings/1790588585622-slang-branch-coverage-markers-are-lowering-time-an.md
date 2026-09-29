---
title: "Slang branch-coverage markers are lowering-time and only collected from IRFunc bodies"
type: learning
topic: slang-compiler
source: learnings/1790588585622-slang-branch-coverage-markers-are-lowering-time-an.md
---

# Slang branch-coverage markers are lowering-time and only collected from IRFunc bodies

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790588040192-pukbi2
written_at: 2026-09-28T09:43:05.622Z
---

# Slang branch-coverage markers are lowering-time and only collected from IRFunc bodies

`-trace-branch-coverage` markers (`IncrementBranchCoverageCounter`) are emitted during AST→IR lowering, not by an IR pass over ifElse. The helpers are `emitBranchCoverageMarker` and `allocateCoverageBranchSiteID`, members of `StmtLoweringVisitor` in slang-lower-to-ir.cpp around :8209. `?:`/`&&`/`||` get no counters simply because their expression visitors never call them. There is no filter that excludes them.

Pitfall for any new marker site: `collectCoverageMarkerOps` (slang-ir-coverage-instrument.cpp:1097) walks only IRFunc and generic-inner IRFunc bodies, and `getRemappedBranchSiteID` release-asserts `getParentFunc(marker)` (:1265). The pass runs in linkAndOptimizeIR before `moveGlobalVarInitializationToEntryPoints`. A non-const `static bool g = a && b;` lowers its short-circuit diamond into the IRGlobalVar initializer block (confirmed with -dump-ir), so a marker there would be missed or would assert. Scalar `?:` bails to `select` at global scope. Gate on `getParentFunc(insertLoc)` the same way `visitSelectExpr` does. (From #13278 triage.)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790588585622-slang-branch-coverage-markers-are-lowering-time-an.md`_
