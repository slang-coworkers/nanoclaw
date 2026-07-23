---
name: project_12034_rebase_bom_decode_merge
description: "#12034 — pdeayton-requested rebase; squashed 5 review commits, resolved conflict with #12055 BOM-decode in getOrEmitDebugSource (merged both); build+verify then push"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5bec4191-e017-44da-b211-e48a8839d909
---

shader-slang/slang **PR #12034** (fixes **issue #11982** — duplicate/dropped SPIR-V DebugSource for imported + separately-compiled modules; DebugSource-cluster sibling of #11984, see [[project_11982_debugsource_dup_import]]). slang-fixer rebase (fixer msgs 41912/41916/41918, 2026-07-17). pdeayton-nv requested a rebase; base was 61 commits behind master.

**✅ MERGED & TERMINAL 2026-07-17 (fixer msg 43644; Main-verified at HEAD).** pdeayton-nv merged PR #12034 — merge commit `3649fb98283f95e1302569231b0900f574d425d9` (Main REST-confirmed `merged:true`, merged_by pdeayton-nv); issue **#11982 CLOSED/COMPLETED**. Shipped: producer-layer fix in `getOrEmitDebugSource` (`slang-lower-to-ir.cpp`) aligning all 3 DebugSource operands with the per-source-file loop — filename canon via `getMostUniqueIdentity()`, content/`isIncludedFile` from resolved `SourceFile`, BOM-safe disk-load fallback for content-less deserialized modules — + 6 regression/helper files (import, import+#include, separate-comp paths). Fixer reaped worktree + sentinel. Long chain (2 author rounds + 3 maintainer rounds incl. a real separate-comp regression pdeayton caught that the initial test missed; master rebase w/ genuine BOM-decode merge conflict; transient GH_TOKEN expiry mid-flight) — all resolved, merged clean. Chain closed.

**[historical] ✅ PUSHED + APPROVED + READY-TO-MERGE (07-17 ~13:56Z, fixer msg 43630; Main-verified at HEAD).** After the gateway cred recovered (~13:56Z, [[project_github_actions_graphql_401_outage]]), the fixer pushed — **PR #12034 origin head = `85880034cdf0ee81ad999d23efa066bde5e8ff3c`** (Main REST-verified), branch `fix/issue-11982`. **pdeayton-nv APPROVED** at that rebased head; `mergeable=true`, `mergeable_state=blocked` (= approved, awaiting merge — NOT a conflict). PR description refreshed in one pass to match the final squashed+rebased commit: documents all 3 sub-bugs (filename spelling, `#include` content/`isIncludedFile`, separate-compilation dropped-text regression) + the merged BOM-decode path + accurate 7-file table; codex OUTPUT_REVIEW verified vs code. **Useful distinction fixer logged:** `gh pr edit --body` (description edit) is metadata → does NOT dismiss approval (unlike a push). Fixer holding per never-merge/never-flip — **merge is pdeayton's**; fixer reaps worktree on MERGED/CLOSED webhook. Terminal = pdeayton merges.

**[historical] ⛔ was BLOCKED ON GITHUB CRED 07-17 07:50Z→~13:56Z:** commit `85880034cd` on `fix/issue-11982`/`wt-slang-11982` was push-403'd during the outage; resumed cleanly on cred recovery (no rebuild needed — invariants pre-verified; commit was durable in worktree git + `memory/fix-11982.md`).

- **Squashed** the 5 review-round commits into one clean commit, rebased onto current `master` → now `master + 1 commit`, carrying only the fix's 7 files (no submodule/lz4 leakage, verified).
- **One substantive conflict, resolved carefully (NOT a clobber):** master gained a UTF-8-BOM-decode improvement in `getOrEmitDebugSource` (from **#11984/#12055**, merged earlier today — decode raw disk bytes via `SourceFile::decodeContentBlob`) in the **same** content-embedding block #12034's fix touches. Fixer **merged both**: content from `SourceFile` when it has content, else disk-load **with master's BOM-decode**, plus `emitDebugSource(..., isIncludedFile)` — neither side's improvement lost. Correct avoidance of the [[project_stacked_pr_shared_base_clobber]] failure mode.
- **Next (fixer, webhook-driven after):** build dir reclaimed (migration) → fresh configure+full build via subagent (~20min) → re-verify both invariants (dedup + separate-comp discrimination) on the COMBINED code → force-push (`--force-with-lease`) → reply on thread. Not pushed yet.
- **Blocker:** none. Drafts-only + operator/maintainer-gated merge INTACT. Code push (rebase) not gated [[feedback_pushes_not_gated]]. Await fixer's post-build push confirmation.

(Overlaps #11984/#12055's `getOrEmitDebugSource` / DebugSource emit area — same subsystem, distinct fix.)
