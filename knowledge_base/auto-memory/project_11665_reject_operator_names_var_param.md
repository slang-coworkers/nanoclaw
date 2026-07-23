---
name: project_11665_reject_operator_names_var_param
description: "#11665 reject operator names on vars/params — MERGED, shadow WOULD_APPROVE=human APPROVED (agreement); TERMINAL"
metadata: 
  node_type: memory
  type: project
  originSessionId: f8b55b29-071d-4799-b38f-b4558f82feed
---

shader-slang/slang#11665 "Reject operator names on variables and parameters (#11664)" — nv-slang-bot fixer PR (fix/issue-N branch).

**Approver verdict (07-17, head 8c3a3ee19155ab78a88e909cf2353c15ef8ff4e7):** WOULD_APPROVE / reason_code=CLEAN. mode=live_late, shadow — recorded to ledger, nothing posted to GitHub.

- Devin-only tier (harvest exit 20 — bot-authored fixer branch, production review genuinely skips).
- 6/6 eligibility clauses pass; Devin 0 bugs / 0 flags / 3 informational (all refuted or out-of-scope by direct source inspection).
- Full CI green at pinned head (44 success / 2 skipped / 0 failures). #12141 slang-rhi-submodule false-safe class cleared (all test-slang-rhi variants green).
- Fix rejects `operator <op>` names at the single `UnwrapDeclarator` choke point via a function-only `allowOperatorName` opt-in; exactly one E20020 in the lua (edited in place → #11609 uniqueness check passes); rebased on master. This is the "Option 2" rework maintainer skiminki-nv requested.

**✅ MAINTAINER APPROVED 2026-07-20 08:13 (fixer msg 50306) — AGREEMENT with shadow WOULD_APPROVE, SAME HEAD.** @skiminki-nv approved the Option-2 rework ("Looks reasonable enough") at head **`8c3a3ee191`** = exactly the head the shadow WOULD_APPROVE/CLEAN was recorded against (fixer verified it's still the branch tip → approval covers the reviewed state). No changes requested. This is a clean shadow-vs-human **agreement** signal (WOULD_APPROVE → APPROVE, same SHA, not a false-safe). PR OPEN/non-draft/approved.

**Next-action:** await maintainer **MERGE** (operator/maintainer-gated — bot does NOT merge/flip-ready). Fixer holding ALL pushes: a new commit would auto-dismiss skiminki's approval, so if slang-reviewer returns late findings the fixer REPORTS them rather than pushing (unless a maintainer explicitly asks for a change). Worktree `wt-slang-11664` held until merge/close, then fixer's webhook path reaps it. Terminal = maintainer merges → approver stamps human-verdict agreement on the ledger row.

**✅ MERGED & TERMINAL 2026-07-22 (fixer msg 56170; merge `02b55fb2c7` on master, verified via git + `pr_merged` webhook).** The merge-queue flake cleared on re-queue; PR #11665 merged. **Shadow verdict VINDICATED as clean agreement:** shadow WOULD_APPROVE/CLEAN was recorded @ `8c3a3ee191`, skiminki APPROVED that same head, and it merged → WOULD_APPROVE → human APPROVE → merge, no false-safe. Fixer sent final Fix Report, reaped worktree `wt-slang-11664` + sentinel. Chain closed.
- **📌 INFRA PAPERCUT flagged (fixer, non-blocking):** the critique gate **false-positived on a read-only `gh api .../pulls/11665` verification call** — it pattern-matches the `/pulls/` endpoint as "PR creation" and counted unrelated MEMORY.md compaction edits as "13 edits since last critique," auto-generating a bypass request (admin-rejected). No functional blocker — #11665 completed via non-gated paths; fixer did NOT retry (already had the answer via git-only). **Prevention (fixer logged shared learning):** read-only `/pulls/` status checks should use git-only equivalents (`git ls-remote`, `git log origin/master | grep <PR#>`) to avoid tripping the gate. Worth tightening the gate's read-vs-write `/pulls/` detection if it recurs — flagged, not urgent.

**2026-07-22 08:47 — IN MERGE QUEUE; merge-queue failure triaged UNRELATED infra flake (fixer msg 54402).** Maintainer flagged intermittent CI failures in the queue; fixer confirmed **not PR-specific**: the failing jobs = `test-falcor / Test (Falcor)` (`test_GBufferRTTexGrads_d3d12` D3D12 image-diff) + macOS ARM `test-slang` — the **same two jobs flaking across unrelated queued PRs #12122/#12133/#12151** (shared-signature flake, = the [[project_12145_gbufferrttexgrads_d3d12_access_violation]] anchor). No causal path from this PR's parser diagnostic (rejects `operator` names on non-function decls) to a rendered-image diff. Replied on-thread (issuecomment-5043796913). **Re-queue clears it = maintainer action** (fixer doesn't re-queue/merge, holds pushes to preserve approval). No code change needed. Blocker: none from our side — waiting on merge-queue retry.

**✅ 2026-07-22 13:05 — MERGED / JOIN APPROVED / VINDICATED — TERMINAL.** Merged by **skiminki-nv** (maintainer ≠ author) @ merge head `d01027a0639a` (mergeCommit `02b55fb2c710`), reviewDecision=APPROVED with an independent APPROVED review at the merged head → genuine non-self-merge agreement. Approver join: shadow WOULD_APPROVE (CLEAN) = human APPROVED → **calibration hit / agreement**, `human_verdict=APPROVED` stamped against ledger row @8c3a3ee1. SHA-drift note: merged head (d01027a) ≠ recorded head (8c3a3ee1) — two "merge master into branch" commits landed after decision, no synchronize webhook reached the (exited) session; approver verified per-invariant that the PR's OWN operator-name diff is **byte-identical** at both heads (checksum c43dcf9e, master-merge syncs only) → decision NOT stale in substance. Chain closed.
