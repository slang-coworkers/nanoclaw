---
title: "Reverse-AD normalizeCFG creates undef on infeasible _runFlag paths (false E50101); old releases print 'error 50101'"
type: learning
topic: misc
source: learnings/1791926539548-reverse-ad-normalizecfg-creates-undef-on-infeasibl.md
---

# Reverse-AD normalizeCFG creates undef on infeasible _runFlag paths (false E50101); old releases print "error 50101"

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791920052172-jpm6ss
written_at: 2026-10-13T21:22:19.548Z
---

# Reverse-AD normalizeCFG creates undef on infeasible _runFlag paths (false E50101); old releases print "error 50101"

#13612: under bwd_diff, an interface factory with early returns triggers a false E50101 ("dispatch on potentially uninitialized interface").

**Where the undefined value comes from.** The producer is the final `constructSSA` inside `normalizeCFG` (slang-ir-autodiff-cfg-norm.cpp:765), not `convertFuncToSingleReturnForm` or break elimination. The sequence:
1. `eliminatePhisInFunc` turns the return-value phi into a var.
2. Region normalization moves the second return under `if (_runFlag)`.
3. `readVar` (slang-ir-ssa.cpp:1121) then emits `LoadFromUninitializedMemory` on the empty false edge. That path is infeasible because `_runFlag` is true there.

**Why a typeflow fix is wrong.** Typeflow merges witness sets path-insensitively, so the uninitialized element reaches `analyzeExtractExistentialWitnessTable`. Fixing it there, by dropping the uninitialized element when a concrete table is also present, hides real errors.

**Why Poison alone is not enough.** Replacing only the newly introduced undefined values with Poison still hides real errors. `eliminatePhisInFunc` skips stores of IRUndefined arguments (eliminate-phis.cpp:1041), so `constructSSA` re-creates the user's own undefined value as a fresh inst.

**Prototype that works.** Keep undefined stores in the phi elimination inside cfg-norm, and Poison the undefined values that appear during it. With both changes, every reported shape compiles, a true-positive control still gets E50101, and tests pass 1996/1996.

**Release-sweep pitfalls.**
- Releases up to about v2026.3 print `error 50101`, not `E50101`, so grep for `50101`.
- In a loop, capture `rc=$?` before running any `$(...)` command substitution, because the substitution resets `$?`.
- A minimal `-DSLANG_ENABLE_TESTS=OFF` build lacks slang-glslang, so `-target spirv` fails with E00100 (spirv-opt); build the `slang-glslang` target too.
- In a fresh worktree, initialize submodules with `git -c protocol.file.allow=always submodule update --init --recursive`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791926539548-reverse-ad-normalizecfg-creates-undef-on-infeasibl.md`_
