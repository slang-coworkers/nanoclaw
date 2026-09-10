---
name: project_9401_hpp_export_docs_mismatch
title: slang#9401 — `-target hpp` export/docs mismatch (✅ TERMINAL, docs-only)
description: "shader-slang/slang#9401 `-target hpp` export requires entrypoint + docs mismatch — ✅ TERMINAL: docs-only PR #12242 merged 2026-07-31 (public→export __extern_cpp in docs/cpu-target.md), #9401 auto-closed. Behavior is INTENDED, not a bug: `export` (not `public`) preserves a symbol into host C++; every compiler-side fix explored was reverted/decided-against, #12156 CLOSED UNMERGED. Only GATE-2 (-whole-program with no entry point) awaits a reporter reply. Distilled from an 80KB blow-by-blow chronicle; durable reasoning lessons kept, negotiation transcript pruned."
metadata:
  node_type: memory
  type: project
  originSessionId: 0574abae-931e-41dc-9682-6e980e9d381d
---

# slang#9401 — `-target hpp` export/docs mismatch — ✅ TERMINAL (merged 2026-07-31)

**Terminal / historical.** Distilled 2026-09-01 from an 80 KB, 100-bullet blow-by-blow
chronicle of an ~13-day chain (orchestrator → triager → fixer, two maintainers). The
day-by-day negotiation transcript is pruned; what remains is the terminal outcome, the one
still-open gate, and the durable reasoning lessons the chain earned.

## Terminal outcome (MINE-verified via GitHub API 2026-08-04, not relayed)

- **Docs-only PR #12242 MERGED 2026-07-31** (`mergeCommit e84ea3e96c…`, `merged_at
  2026-07-31T03:35:43Z`). Issue **#9401 auto-closed** 03:35:44Z (`Fixes #9401` fired; the
  1-second lag is normal auto-close).
- **Shipped = one file, `docs/cpu-target.md`**: samples/prose changed `public __extern_cpp`
  → `export __extern_cpp` (+ missing `int` return type; global → `__global export
  __extern_cpp`). Every compiler/test change explored on the branch was **REVERTED** before
  merge.
- **The reported behavior is INTENDED, not a bug** (csyonghe issuecomment-5135718535, jkwak
  agreeing 5136229007): `export` — not `public` — is what preserves a symbol into host C++
  output; `public` is *visibility only*; `__extern_cpp` supplies the *unmangled* name.
  Precisely: `export` alone = preserved into `-target cpp`, mangled, no hpp decl;
  `export __extern_cpp` = preserved + unmangled + hpp decl; `public` = neither.

⛔ **Do not implement, resurrect, or cite as pending** any compiler-side fix from this
chain: `HLSLExportDecoration`+`KeepAliveDecoration` on the `ExternCppModifier` arm, GATE-1,
the `!isImported` / `isDefinition()` guard, the `isCPUTarget`-at-link host-scoped rooting,
the `isPublic`-drop, or **#12156** (target-neutral rooting) — **#12156 was CLOSED UNMERGED**
2026-07-28 "in favor of #12242", then #12242's own compiler change was reverted after the
jkwak↔csyonghe consult converged that `export` is required.

## The one genuinely-open thread: GATE-2 (emit with no entry point)

- Disposition = **use `-whole-program`** (already works; jkwak told reporter **@NBickford-NV**
  directly, issuecomment-5136252442). **RESUME TRIGGER = @NBickford-NV replying that
  `-whole-program` is insufficient.** Nothing owed on GitHub until then.
- ⛔⭐ **GATE-2 is INDEPENDENT of the rejected GATE-1 — do NOT sweep it into the rejected
  bucket.** Proof of decoration-independence: `export __extern_cpp` already carries
  HLSLExport+KeepAlive and *still* emits nothing with no entry point and no `-whole-program`,
  while `-whole-program` emits with no entry point at all. GATE-2 lives in `generateOutput`,
  a different mechanism from GATE-1's linking-root path.
- ⚠️ **Locate it by MECHANISM, not line number — numbers rot.** MINE-verified at HEAD
  `0864e60`: `EndToEndCompileRequest::generateOutput(TargetProgram*)` = `:904`, the
  whole-program-vs-entry-point branch = `:911`. `grep GenerateWholeProgram` alone is **not a
  unique key** (5 hits in that file `:428/:855/:911/:981/:1192` + setter `:1369`); the correct
  locator = `GenerateWholeProgram` *scoped to the `generateOutput(TargetProgram*)` definition*.

## Durable reasoning lessons (earned across the chain)

- ⭐⭐ **Over-correction by false dependency.** On learning X was rejected, verify Y was
  actually *derived* from X before retiring Y. A peer's correction pass marked GATE-2 "dead
  (it presupposed the rejected GATE-1)" — but GATE-2 was never derived from GATE-1, so the
  "fix" deleted a live resume trigger. A correction that erases a live trigger is worse than
  the stale header it fixed. See [[slang-evidence-lessons-measurement-rows]]
  (fix-inherits-burden-of-proof).
- ⭐⭐ **Position decides which claim is read; an accurate body does not rescue a stale
  header.** My copy's *body* (40+ rows down) was correct while its frontmatter `description`
  + H1 — the two fields a reader hits first — were stale. Also: **sibling agents hold
  divergent copies of the same topic file**; "I corrected it" from a peer does not mean YOUR
  copy was wrong nor that theirs is now right. See
  [[feedback_correction_unapplied_until_every_restatement_fixed]].
- ⭐⭐ **CI-green never resolves a maintainer design-scope objection.** #12156 reached 16/16
  test-slang green with both prior regressions fixed, yet a WOULD_APPROVE would have been a
  FALSE-APPROVE: jkwak closed it for the exact target-neutral GLSL defect pdeayton caught
  (rooting `public __extern_cpp` for *every* target incl GLSL/SPIR-V → previously-valid GLSL
  made invalid). Approver R1 BLOCK / R3 ABSTAIN_POLICY both vindicated by the terminal human
  outcome. Don't round up over an unresolved design objection; don't merge over it.
  See [[feedback_signature_grep_passed_vs_failed]] (don't hand a coworker a confident benign
  classification of a red you have not verified — the "aarch64 golden-update" miscall here).
- ⭐⭐ **Surface-and-defer, don't thrash.** Because nothing intermediate ever merged (each
  design was held for maintainer sign-off), the resolution was **one clean docs commit** — no
  revert-of-a-merge, nothing to unwind. When jkwak and csyonghe gave *opposite* steers, the
  fixer correctly did **not** re-implement to the newest voice; it surfaced the conflict
  neutrally and held code until the two maintainers converged.
- ⭐ **A visibility gate that tests the literal keyword misses effective visibility.** The
  explored `isPublic` gate checked for a literal `PublicModifier` in `decl->modifiers`, never
  computed/effective visibility, so an implicitly-public `__extern_cpp` fn fell through — the
  same *class* of hole as the original #9401 bug. (Moot after revert, but the pattern is
  reusable: "gate keys on syntax where the invariant is semantic.")

## Related concepts

- [[slang-evidence-lessons-measurement-rows]]
- [[feedback_correction_unapplied_until_every_restatement_fixed]]
- [[feedback_signature_grep_passed_vs_failed]]
