---
name: project_nanoclaw_933_comment_discipline_invariant
description: "slang-coworkers/nanoclaw#933 (szihs) — code-comment discipline spine invariant; PRs #934/#935 MERGED by szihs 2026-07-14; interpretation accepted"
metadata:
  type: project
  node_type: memory
  originSessionId: gh-issue-933
---

**slang-coworkers/nanoclaw#933** — "Fix the verbosity", filed by **szihs** (maintainer) 2026-07-14. Directive (not a product bug): (1) write comment only if it adds value + be concise; (2) commit message and comment are separate concerns. "Add an invariant and add to nv-slang and nv-slangpy."

**Handled inline by Main** — own coworker-infra repo, work request from maintainer (same class as [[project_nanoclaw_pr874_webhook_route_approver]] #913/#914 which szihs authored). NanoClaw-platform fork; NOT routed to product coworkers.

**Implemented** = new spine invariant `container/spines/{slang,slangpy}/invariants/comments.md` + wired into writer (inherited by fixer) + reviewer types in `coworker-types.yaml`, alongside `code-changes.md`. Byte-parallel across both spines. Mirrors the #913/#914 peer-review pattern (always-in-context invariant survives compaction). Commits authored `nv-slang-bot[bot]`, NO AI attribution (upstream policy).

**PRs — BOTH MERGED by szihs 2026-07-14 (terminal):**
- **#934** `feat(slang): …` → `nv-slang`, branch `fix/issue-933-comment-invariant` — MERGED, closed.
- **#935** `feat(slangpy): …` → `nv-slangpy`, branch `fix/issue-933-comment-invariant-slangpy` — MERGED.

Both were outside the [[feedback_nv_coworkers_automerge]] grant (`nv-coworkers`-only) → maintainer merged, as expected. Posted 5-bullet resolution comment on #933 (issuecomment-4967052114) + `report_pr_created` for both. Worktrees reaped.

**INTERPRETATION — ACCEPTED.** I flagged (in both PR bodies + issue comment) that I read "comment" as **code comments authored during a change** (not GitHub PR/issue comment verbosity), and offered to retarget to `review-output.md` if wrong. szihs **merged both PRs as-is with no counter-comment** → code-comment reading confirmed correct. No retarget needed.

**FOLLOW-ON 3-PR SET (szihs, 2026-07-14, issuecomment-4989503928)** — builds on merged #934/#935, all szihs-authored, 1-line each, OPEN at review, target `nv-*` (outside grant → szihs merges). Verified diffs before ack:
- **#962** `feat(codex-critique): flag comment-noise as must-fix` → `nv-main`, `container/skills/codex-critique/SKILL.md` +1. **THE NEW ENFORCEMENT PIECE — fleet-wide.** `codex-critique` is a **base-common** skill inherited by EVERY typed coworker → this must-fix rule (flag line-restatement + history/scratchpad/why-not-alternative-in-source; blocks the CODE_REVIEW delivery gate) applies to slang/slangpy/all future coworkers, not just the 2 spines. Well-calibrated: explicitly does NOT flag concise *why*-comments, does NOT demand comments on self-evident code → won't over-correct into comment-spam.
- **#963** `feat(slang): …PR body not source` → `nv-slang`, appends 1 bullet to my `comments.md` (design rationale/soundness args/why-not-alternatives → PR body; + fresh-reader test).
- **#964** slangpy byte-parallel of #963 → `nv-slangpy`.

Posted verified ack on #933 (issuecomment-4989522366), closed chain explicitly (nothing further from me; merge is szihs's). **ALL THREE MERGED by szihs 2026-07-16T08:36Z.** szihs confirmed "fixed now and deployed" (issuecomment-4991140364) → acked with 👍 reaction (no 4th prose comment — hygiene). #962 enforcement gate now LIVE fleet-wide.

**On redelivery / webhook:** #934/#935 terminal (MERGED). #962/#963/#964 merge is szihs's (I do NOT auto-merge — `nv-*` outside grant). `pr_merged`/redelivery on any = no-op. A NEW substantive szihs comment = fresh chain input → re-evaluate on merits, don't no-op on "already done." **Note for future coworker behavior:** once #962 lands, comment-noise is a hard CODE_REVIEW stop across the fleet.
