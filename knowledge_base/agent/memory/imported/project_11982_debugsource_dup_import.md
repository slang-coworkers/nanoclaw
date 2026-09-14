---
name: project_11982_debugsource_dup_import
description: "slang#11982 duplicate SPIR-V DebugSource for imported module — MERGED 2026-07-17 via PR #12034 (Main-verified), by pdeayton-nv (human), commit 3649fb98283f. Same-compilation dedup (getMostUniqueIdentity convergence) + separate-compilation regression fix (BOM-decoding disk-load fallback). CHAIN CLOSED."
metadata:
  node_type: memory
  type: project
  originSessionId: fd193fba-2b42-465a-ba93-727cb97c3ef8
---

# slang#11982 — duplicate DebugSource for imported module (MERGED via PR #12034)

**Repo:** shader-slang/slang · reporter pdeayton-nv · thread `gh-issue-shader-slang/slang-11982`. An imported module emits **two** `DebugSource` records (3 instead of 2). Not a crash; valid SPIR-V, pure debug-info bloat. Reproduced at ToT.

**Root cause (proven via `-dump-ir`):** `DebugSource` is `hoistable=true` (identical operands auto-dedup), but two producers in `slang-lower-to-ir.cpp` spell the filename differently for a `Type::Normal` file — the per-source-file loop (`generateIRForTranslationUnit`) uses `getMostUniqueIdentity()` → **canonical ABSOLUTE** (the CU-referenced record), while the lazy `getOrEmitDebugSource()` uses `pathInfo.getName()` → **as-found RELATIVE** (a dead orphan). The mismatched string operand defeats hoistable-dedup. (Accessor→spelling mapping verified in `slang-source-loc.cpp`: `getName`→foundPath, `getMostUniqueIdentity`→uniqueIdentity.)

**Fix (author-requested ABSOLUTE convergence):** canonicalize the lazy producer's emitted operand with `getMostUniqueIdentity()` so both producers agree → the two hoistable `IRDebugSource` insts collapse at link, orphan gone, surviving record keeps absolute. `SourceFile*` lookup left byte-for-byte (found-path first, identity fallback); only the emitted operand + derived path-map key canonicalized.

**Separate-compilation regression + its fix (pdeayton-nv caught it, bot confirmed real):** absolute convergence regressed the binary/separately-compiled module path. A deserialized module's `SourceFile` is *found but content-less* → `source->getContent()` returned empty → `DebugSource` dropped its text operand. Fix: `getOrEmitDebugSource()` falls back to a **disk-load whenever embedded content is empty**, guarded null-safe as `(!source || !source->hasContent())`, and BOM-decodes via `SourceFile::decodeContentBlob()` (matching the loop's decoded content) → restores base behaviour AND keeps the #11982 dedup. Both invariants hold: Producer-1's loop iterates only in-build in-memory TU sources (no fallback); a `-r`-deserialized module enters via the source-loc deserializer, only the lazy producer emits it → no competing record to diverge from, no re-dup.

**Test suite (7 files)** incl. `debug-source-separate-compilation.slang` + sidecar, and a **discriminating `CHECK-NOT: … DebugSource %id{{$}}`**: the original positive-only `CHECK` was a false-pass (the buggy one-operand record coexisted with a good one, unflagged). Revert-drill confirmed the fixed test fails pre-fix / passes post-fix. ⭐ **A positive-only `CHECK` can't guard a regression when a good record coexists with the bad one → always revert-drill a regression test.**

## MERGED — terminal

PR **#12034** MERGED 2026-07-17T17:11:21Z by **pdeayton-nv** (`is_bot:false`, human maintainer — not a self-merge), mergeCommit `3649fb98283f95e1302569231b0900f574d425d9`, `Closes #11982`. Merged at exactly the last-evaluated head (`85880034cdf0`) with no follow-up commits between decision and merge ⇒ shipped code byte-identical to what was reviewed. **CHAIN CLOSED.** Reopens only on a genuine post-merge regression referencing #11982/#12034.

Adjacent (fixed alongside / loose family, unconfirmed): #11983 (same reporter, DebugFunction wrong CU); import/precompiled-module dedup leads [[project_10027_vector4_import_abort_pending]], [[project_11771_reflection_dup_global_pending]].

## Durable lessons this chain generated (full statements in the linked concepts)

- **The #11984 fabrication:** an early "[Fix Report]" claiming a MERGEABLE draft PR #11984 was fabricated — it arrived interleaved with corrupted tool-result output (phantom tokens, fake invoke blocks), and the "verification" of it was part of that tainted stream. Ground truth via clean self-issued calls: `gh pr view 11984` → "Could not resolve"; the PR never existed. #12034 is the genuine one. See [[project_corrupted_turn_taints_verification]].
- **Cosmetic post-approval push dismisses the approval for zero gain.** A comment-only push (`a0635cc612`) landed after jkwak's approval and GitHub auto-dismissed it. Distinguish from the *legitimate exception*: a maintainer-requested correctness fix re-dismisses expectedly and is worth more than a stale approval. Recovery is via a plain no-`@` re-approval-ready comment (a comment posts freely; only `gh pr ready`/`gh pr merge` are operator-gated). See [[feedback_pushes_not_gated]].
- **Verify "approved" at HEAD, not from a relayed report.** Three separate 07-14 "approved, awaiting merge" reports were REVIEW_REQUIRED at HEAD (each superseded by a dismissing push); only head-verified re-approvals were real.
- Draft-dispatch `github.ci_failed` is the cosmetic priority-yield signature (build/test jobs `skipping`), not a real failure — real builds run when a maintainer readies. See [[project_bot_pr_priority_yield_red_run]].
