---
name: project_11983_spirv_debugfunction_wrong_cu
description: "#11983 imported SPIR-V DebugFunction wrong CU scope — TERMINAL: PR #12148 MERGED 2026-08-04 (merge commit 0864e60e63, shipped diff 8 files/+135/−9 — NOT the initial 13/+289 that was briefly published). Approach B (optional parentScope operand on IRDebugFunction, bound at the producer). #include/#line CU-ownership deferred to #12150 (open)."
metadata:
  node_type: memory
  type: project
  originSessionId: 86e6c30b-d893-4630-97a4-0cb2792894f2
---

**shader-slang/slang#11983** — imported `DebugFunction` records reference an imported module's `DebugSource` but wrongly use the entry-point file's `DebugCompilationUnit` as parent scope. bug / low / target-emit SPIR-V debug-info / P3 (valid SPIR-V, runs fine; debugger/tooling correctness only). Issue closed. Canonical thread `gh-issue-shader-slang/slang-11983`.

## ✅ TERMINAL — MERGED 2026-08-04

PR #12148 `merged=true`, merge commit `0864e60e635ef39d4c25e5e57747d909f1c05edd`, final head `72be35c1ac`. **Shipped diff = 8 files / +135 / −9.** ⚠️ An announced "13 files / +289/−7" figure was the *initial* head `bf2ce70aeb`; it was tightened over 7 review commits and is superseded — cite the merged 8/+135/−9, not the initial number.

**Approach B (as merged):** an optional trailing `parentScope` operand (the owning `DebugCompilationUnit`) on `IRDebugFunction`, bound at the IR-gen **producer**; the emitter reads it and falls back to `findDebugScope` when absent. The debug-source→CU map was retyped to `Dictionary<IRDebugSource*, IRDebugCompilationUnit*>` (strong typing per pdeayton-nv), with `cast<>` at the two creation sites (1:1 by construction — `SharedIRGenContext` is per-TU and a CU is created only for `!isIncludedFile()`) and `as<IRDebugSource>` at the read site (a miss degrades to the null-scope fallback). `IRDebugCompilationUnit` and builder return types were left untouched.

**Root cause:** `slang-emit-spirv.cpp` resolves every `DebugFunction`'s parent scope through one module-global slot (`findDebugScope`); a post-pass added by #10907 unconditionally pins that slot to the entry-point CU, mis-scoping imported functions. Each `DebugFunction` already carries the correct source via `getFile()`; only the derived scope operand was wrong.

**Approach A rejected (reporter caught the hole):** keying scope by a `DebugSource→CU` map resolved via `getFile()` misses for `#include`'d functions — `emitDebugSource` runs per-file but `emitDebugCompilationUnit` is gated `!isIncludedFile()`, so an included file gets a `DebugSource` but NO CU. (`import` ≠ `#include`, so A would still fix the reported import symptom but leave the include case unscoped.) Approach B matches the repo's store-canonical-at-the-producer methodology.

**`#include`/`#line` CU-ownership deferred to #12150 (open)** — included/`#line`-remapped sources keep a null `parentScope` → module-global fallback (unchanged behavior). csyonghe's operand-list idea is the better representation there, where the source→CU relation genuinely stops being a function.

**Edit surface (for #12150):** `IRDebugFunction` operands `slang-ir-insts.h:2719`; builder `slang-ir.cpp:3554`; `fixUpDebugFuncType` clone that could drop a new operand `slang-ir.cpp:872`; IR-gen site `slang-lower-to-ir.cpp:14680`; CU gate `!isIncludedFile()` `:15443`. **Load-bearing risk:** a new scope operand must round-trip through IR-blob serialization for precompiled-module imports (#12034 already exercised that path for `DebugSource` — reuse the test shape). **RESUME trigger:** #12148's merge webhook was the cue to start #12150 off fresh master.

## Reusable facts this chain established

- **The bot CAN push a merge commit carrying `.github/workflows/*`** — final head `72be35c1a` landed 12 `.github/` files (8 workflow `.yml`) via a merge-from-master push. This is a live counter-example to the PR #11265 "App lacks `workflows` write permission" blocker. ⚠️ **Do NOT over-generalize:** #11265 was a *force-pushed rebase*, this was a *merge commit*; whether the App gained the permission or the block never covered merges is UNVERIFIED, and those predict differently for a future rebase.
- **`mergeable_state` tells you THAT a requirement is unmet, never WHICH one** — a residual `blocked` here was an unmet review requirement (two requested reviewers hadn't submitted), not "awaiting merge"; an "awaiting merge" reading was an unverified inference, refuted by reading the reviewer list.
- **No force-push under review** — a rebase rewrites every SHA, so engaged reviewers lose their "what changed since my last review" diff. Caught pre-push here (remote still at the pre-rebase SHA); switched to `git merge origin/master`, kept BOTH sides of the #12202 `emitDebugSource` conflict, fast-forward push, reviewer diffs intact. See [[no-force-push-under-review]].
- **`git reset --hard` under a running build yields a bogus `BUILD_EXIT` with an empty log** — a tooling artifact, not a code failure.
- Verify ancestry before claiming a merge "reverted" a submodule bump — the branch's pin was OLDER than master's; the merge correctly adopted master's newer #12184 pin.

**Sibling:** #11982 CLOSED; its PR #12034 (DebugSource dedup, `getOrEmitDebugSource`) does not overlap Approach B's edit surface. Draft CI reds during the chain were benign priority-yields ([[project_bot_pr_priority_yield_red_run]]). Related: [[feedback_no_parent_traversal_in_includes]].
