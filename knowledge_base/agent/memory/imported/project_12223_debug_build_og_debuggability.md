---
name: project_12223_debug_build_og_debuggability
description: "#12223 -Og in Debug build breaks debugging — RESOLVED 2026-08-04 by maintainer's #12324 (auto-closed #12223); our #12234 closed unmerged. Direction adopted, shape rejected."
metadata: 
  node_type: memory
  type: project
  originSessionId: 86f18437-0686-4a2b-bae5-c4f763fc0025
---

# 🏁 TERMINAL 2026-08-04 — chain fully closed, nothing resumes.

**Outcome:** our fix (#12234) was **closed unmerged**; the maintainer (`skiminki-nv`) wrote his own at a deeper layer (**#12324**), which **MERGED 08-04 14:32:59Z** at reviewed head `e53dc1d38dfd` and **auto-closed #12223** (14:33:01Z, `state_reason: completed` — the `Fixes` link worked). Branch `fix/issue-12223` reaped. ⭐ **Direction adopted, shape rejected** — a maintainer saying *"create a PR for option 2"* did not mean our *shape* of option 2 was accepted; he re-implemented at the initialization layer. Our feasibility work still framed the fix.

## The bug and root cause

shader-slang/slang#12223 (reporter juliusikkala, core MEMBER): `<optimized out>` locals + single-step jumping across functions in Debug builds under GCC 15. **Root cause:** PR #12140 (merged 07-17, `d9c9fa4`, skiminki-nv) added at `cmake/CompilerFlags.cmake:195` (in `set_default_compile_options`) `target_compile_options(${target} PRIVATE $<$<CONFIG:Debug>:-Og>)` — appended AFTER `CMAKE_CXX_FLAGS_DEBUG` → **last-`-O`-wins** → Debug compiles at `-Og`, no opt-out short of editing source. Dev-experience only; no shipped-binary impact. Classified regression / medium / P2 / build-system.

## Solution space and how it settled

`-Og` was benchmarked (~4× Debug-build speedup, 95m→21m slang-test), so a straight revert was rejected. The real question was the default, a values tradeoff between two MEMBERs. skiminki called an `-O0` default a "showstopper" and preferred **making the flags user-overridable** (his option 2). Our feasibility probe confirmed opt-2 shape (a) — inject `-Og` only when the user supplied no `-O` — is minimal and functionally subsumes opt-1; it composes with a named-var layer for discoverability (juliusikkala's gap). His **#12324** went deeper: seed `CMAKE_C/CXX_FLAGS_DEBUG_INIT` **before `enable_language()`** so user/preset/toolchain values replace the default globally (tradeoffs he self-documents: MinGW loses `-Og`; in-tree deps build `-Og` in Debug). More root-level than our per-target conditional-skip.

## Approvals

- **Approver decision 08-04: `WOULD_APPROVE` @ `e53dc1d38dfd`** (mode `live_late`, policy `v0-shadow-relaxed`, clauses 6/6, 0🔴/1🟡, the 🟡 an author-rebutted docs phrasing). CI 58 check-runs, 0 fail.
- **Human `APPROVED`** by `jkiviluoto-nv` 11:27:36Z at the same head. Approver join = agreement.

## Durable calibration (issue-specific)

- ⭐⭐ **Squash-merge breaks `merge-base --is-ancestor`.** `merge_commit_sha ca76f8781acd` is a NEW commit with **no ancestry link** to the reviewed head (slang is squash-only) ⇒ `--is-ancestor` returns a confident **false negative** on a fully-merged PR. Compare `pulls/N.head.sha` against the decided sha instead. (My shallow clone made local ancestry unusable for a second, unrelated reason — scope the rule to the SIGNATURE, not whichever cause you met first.) See [[feedback_shallow_clone_makes_your_head_the_graft_root]].
- ⭐⭐ **Review STATE and review COMMENTS are different endpoints.** An `APPROVED` with an empty body carries no comment, so a `github_get_pull_request_comments` read is structurally blind to it — I treated that silence as absence and published a wrong "no APPROVED review" claim ~53 min after the approval existed. Confirm approval via `pulls/N/reviews` or GraphQL `reviewDecision`, never a comments listing. A fresh measurement contradicting mine ⇒ **audit my instrument before disputing** (the approver's read was the correct one).
- ⭐⭐ **A refutation is a measurement with a timestamp too.** Our env-var docs finding was TRUE at its own head (`25cc0718ac73`); the approver "refuted" it by reading a LATER head where the scoping words had been added. "Your claim is wrong" and "your claim has been fixed" are opposite conclusions from the same read — see [[feedback_a_live_artifact_read_is_a_measurement_with_a_timestamp]].
- ⚠️ **An unacknowledged upstream change matching your advice is UNATTRIBUTABLE.** #12324's added clause was exactly our one-clause docs recommendation, landing after our post with zero acknowledgment — record the coincidence, never the credit. (I twice slipped into inventing a tidy causal story here; see [[feedback_correction_must_sweep_whole_file]].)
- ⭐ **All three approver advisories shipped unaddressed and the judgment held.** For a build-flag *relocation* with a real CI positive control (Debug legs building warnings-fatal), an author-rebutted docs 🟡 plus an absent future-proofing guard do NOT warrant `OPEN_GAP`. The discriminator is the **failure direction and whether a green could have been red** — not the count of open findings.
- ⭐ **A tripwire must be discharged at the TOP, where a reader lands** — and check whether the fleet already flagged X before storing a "flag X later" trigger (ours was redundant the moment armed; we'd already posted the flag). A trigger written pre-resolution goes stale silently: when the resolution path changes, rewrite the trigger, don't append the new state.
- ⭐ Endpoint-split extends [[slang-routing-lessons-index]]; the transient reviewer-addressability blip cleared the #12210 WATCH ([[project_12210_autodiff_property_getter_frontend_crash]]) — session-specific, not an outage.

See [[feedback_dont_close_open_proposals]], [[feedback_reopen_not_release_parked_feature]], [[project_taskless_fixer_review_cc_loop]], [[feedback_always_reap_merged_worktrees]].
