---
name: project_12124_autodiff_nativestring_custom_bwd_constants_oob
description: "slang#12124 slangi autodiff NativeString into custom bwd derivative emits constants-OOB — LIVE bug at HEAD, forwarded to fixer"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6dfe4cbf-116c-48bc-9902-e86d774500e0
---

# slang#12124 — [slangi][autodiff] NativeString captured by custom backward derivative → constants-OOB

Reverse-mode autodiff carrying a `NativeString` arg into a `[BackwardDerivativeOf]` custom derivative generates a reverse-prop call with a dangling `const:C9` operand (offset 201 = one-past-end of constants section) → slangi VM bounds check exits code 5. Primal call renders `str:"y2"` correctly; only the generated reverse call is wrong.

**Status:** LIVE bug — triager reproduced on v2026.12.2 release AND freshly-built **true HEAD (694022a11)**, identical failure. Reporter's "a newer local slangi already works" does NOT hold on current upstream. NOT a dup (#11463/#11399 closed+in-tree; #11375 same symptom, different root = BoolLit).

**Classification:** bug / medium / autodiff (reverse-mode) + slangi VM bytecode-emit / P2.

**Root cause — CORRECTED (triager's original two-layer diagnosis was FALSIFIED by the fixer):**
- ❌ ORIGINAL (WRONG, do not cite): `canTypeBeStored`/`transposeCall` unstored-context + `addConstantValue` switch-fallthrough. Fixer applied both recommended edits → **zero change**. Triager's root-cause claim was load-bearing and unverified-by-observation. Lesson filed as a shared learning: verify a triage root-cause by IR-at-the-layer or apply-and-observe, else label it hypothesis; for a bytecode OOB suspect the *reader's* size assumption, not just the operand's producer.
- ✅ REAL mechanism (fixer, empirically): **Bug-1** — VM `Call` sizes args by parameter-slot, over-reading a size-0 `VoidLit` placeholder by alignment padding → OOB read. **Bug-2** — NativeString not threaded into the nested backward-derivative context. Triager independently verified Bug-1 in source. Bug-2 correctly bounced as autodiff-owner (saipraveenb25) territory.

**Recommended fix:** Approach A (producer-side) — re-materialize the non-diff arg from its original IR value in `transposeCall`, mirroring fwd.cpp:1511.

**LANDING FIX = PR #12127 (kaizhangNV, maintainer) — supersedes our fixer's in-flight Approach A.** Body "Fixes #12124". A *different, more precise* producer-layer fix than our `transposeCall` re-materialization:
- `cleanUpVoidType` added to the HostVM early-exit path (`slang-emit.cpp:1621`) — removes the autodiff void-differential `VoidLit` that was surviving to `addConstantValue` as the constants-OOB operand (same pass already runs at :2365 in the general pipeline).
- VM stores sized from the destination pointee type (`slang-emit-vm.cpp`) so the captured `NativeString` gets a pointer-sized store, not zero bytes.
- Approver verdict (2026-07-15, shadow/ledger-only): **WOULD_APPROVE CLEAN** @ f4a191c13d5a. PRIMARY tier github-actions[bot] 🟡 APPROVE_WITH_NITS (0🔴/2🟡/1🔵, all advisory); 6/6 clauses; challenger cleared SLANG_RELEASE_ASSERT blast-radius; check-formatting red = cosmetic only. Await merge; decision joins human outcome.

**Fixer:** STOOD DOWN cleanly — no competing PR, worktree reaped (~7.5G freed). Chain TERMINAL-FOR-NOW: superseded by #12127, auto-closes issue on merge. Triager corrected GitHub comment 4984295480 in place (wrong diagnosis → verified + #12127 resolution) and reported [Triage Resolution] upstream. Re-opens only on fresh substantive human comment. Note: /dev/vdb 100% full escalated to operator during this chain (see disk-capacity memory).

**Chain:** triager posted 5-bullet verdict (issue comment 4984295480), applied `reproduced` label + Type=Bug (not `regression`), forwarded memo (triage-12124.md) to slang-fixer on canonical thread gh-issue-shader-slang/slang-12124. Related autodiff chains: [[project_12071_bwddiff_loop_vector_divide_wrong_grads]].
