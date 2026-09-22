---
name: project_11709_groupshared_byref
description: "slang PR #11709 / issue #10641: pass bare groupshared array params by reference. Grew to a five-backend codegen fix (Khronos+HLSL+CUDA+Metal+WGSL) + [noinline]/export policy (E30708-E30710) + call-site l-value E30711; diagnostic renumbered 30705->30706->30707 after a real cross-PR collision with #11885. ⛔ Never relay '#11709 verified green' — the early 'built green, zero regressions' was per-target INCOMPLETE (regressed 38 CUDA neural tests). ⛔ The byte-identical CUDA signature cited as proof was NON-DIAGNOSTIC — CUDA prints a raw pointer for every by-reference mode; the IR dump is the discriminator."
metadata:
  node_type: memory
  type: project
  originSessionId: a5790b77-160e-4f43-8acc-cc66ac7dd6c3
---

# #11709 — groupshared array param by reference (fix #10641)

PR **#11709** on `fix/issue-10641`, `Closes #10641` (the issue and PR happen to
share the number; the bug issue is **#10641**). slang-fixer chain, driven by
maintainers jhelferty-nv and jkwak-work / csyonghe.

**Substance:** a bare `groupshared` array passed as a function parameter was lowered
by-value → incorrect DXIL for backward-indexing (#10641). Fix = **unconditional
by-reference lowering** (drops the reviewer-flagged unprincipled
`!hasModifier<InModifier>()` carve-out), plus a producer-side checker diagnostic
rejecting `in`/`out`/`inout groupshared`.

## What the chain grew into (final shape)

A change scoped as "Khronos + HLSL" turned out to span **five backends**:

1. **CUDA** (`shared-memory-pool.slang`): `getSharedBaseAddr` intrinsic `($0).m_data`
   → `($0)->m_data`. jhelferty directed: emit the by-ref groupshared param as a
   **pointer/decayed param** — do NOT extend Khronos forced-inlining to CUDA, do NOT
   copy the HLSL keyword-strip into CUDA emit.
2. **Metal** (`slang-ir-specialize-address-space.cpp`): rate-qualified groupshared
   param pointer types were skipped (`as<IRPtrTypeBase>` null through the
   `RateQualified` wrapper); use `getDataType()`/`setDataType()` → emits `threadgroup*`.
3. **WGSL** (`slang-ir-inline.cpp` + `slang-emit.cpp`): groupshared-only inlining
   mode run BEFORE `legalizeIRForWGSL`, so the callee inlines away before
   call-legalization bridges the shared global through a copy-in/out temp.
4. **Target-aware `[noinline]`/`export` policy:** HLSL → **E30708**;
   GLSL/SPIR-V-via-GLSL/WGSL → **E30709**; direct-SPIR-V keeps the boundary + emits
   `SPV_KHR_variable_pointers`; **E30710 + `SLANG_FAIL`** backstops the
   `linkWithOptions` option-drift path (clean error, not ICE).
5. **Call-site l-value restriction E30711:** an argument to any `groupshared`
   parameter must name thread-group-shared storage, checked by reusing
   `getValidTypeForAddressOf` and accepting iff the AST `PtrTypeBase`'s address space
   == `GroupShared`.

**Held design fork:** csyonghe implied read-**only**-by-ref (`__constref`);
jhelferty directed read-**write**-by-ref as the default. Fixer surfaced the tension
to both maintainers with verified facts and **held** rather than picking — the same
neutral-hold pattern as #12219's csyonghe-vs-pdeayton fork.

## Durable, reusable lessons

- **⛔ Per-target completeness.** "built green, zero regressions" was true only for the
  targets the fixer ran; the CUDA `tests/neural/` suite (38 variants, A/B-proven
  against master head) exposed the by-ref lowering wasn't wired for CUDA. A green claim
  is scoped to the targets actually exercised. [[feedback_never_relay_a_verdict_not_in_hand]].
- **⛔ Non-diagnostic evidence.** The byte-identical CUDA signature cited as proof that
  `const groupshared` lowers like RW could not discriminate — CUDA prints a raw
  pointer for *every* by-reference mode. The claim was true, the evidence couldn't
  tell it from the alternative. The **IR dump** is the discriminator.
- **A mid-pipeline `getErrorCount() != 0` bail must gate on a DELTA, not an absolute
  count.** E30710's backstop aborted `linkAndOptimizeIR` on ANY prior error, so tests
  emitting an early diagnostic lost a later expected one (from a pass that runs after
  the early-return). Fix: capture the count before the pass, abort only when it
  *changes*. Local per-directory runs missed it (they ran only new + targeted tests,
  not pre-existing early-error+later-diagnostic combos); CI caught it.
- **Concurrent-PR diagnostic-number collision.** Two open PRs adding diagnostics off a
  shared master baseline can both claim the same number; master has neither yet, so
  neither PR's CI catches the dup → whichever merges second collides. #11709 progressed
  30705→30706→**30707** to yield 30706 to #11885 ([[project_6319_dup_sysval_pr11885]]),
  which had it baked through its tests first. **Verify at HEAD that a new diagnostic
  number isn't double-claimed by another open PR before merge.**
- **Priority-yield red runs are benign.** The `test-slang` reds the fixer classified
  were bot-PR priority-yields (short run, `steps: []`, only `wait-for-human-priority`
  "failed") — verify nothing; `retry-yielded-bot-ci` auto-reruns.
  [[project_bot_pr_priority_yield_red_run]]. Rebases/pushes are not operator-gated
  ([[feedback_pushes_not_gated]]); merge/ready-flip are.

## Co-presence of two spellings is not a conflict (2026-08-10)

I told the fixer a test divergence "is therefore your own later edit," inventing a
defect. Truth, verified at the branch sha: **one file held prose describing the
PRE-fix behavior (`BorrowInOutParam`) beside an assertion pinning the POST-fix
behavior (`RefParam`)** — no stale half, no second version. And I'd `grep`ed the path
in my own clone (on `master`), where the file **doesn't exist** — a bare
`No such file or directory` would have "confirmed" the phantom just as easily.

⇒ **Attribute each occurrence to a commit AND a role (prose vs assertion) before
calling it a contradiction.** A `grep -l` finding both strings answers "are both
here", never "do both make the same claim". A path is not a claim about content until
you name the ref: read via `gh api contents/<path>?ref=<sha>`, which is
edge-independent (same rule as ANCHOR C for per-container `/workspace/**` paths, on
the git-ref axis). What was right and worth keeping: **flagging beat proceeding** — a
collision rule that only fires when a collision is real is untestable.
