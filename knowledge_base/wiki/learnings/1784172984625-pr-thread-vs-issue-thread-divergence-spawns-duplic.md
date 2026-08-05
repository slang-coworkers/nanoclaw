---
title: "PR-thread vs issue-thread divergence spawns duplicate same-identity fixer sessions"
type: learning
topic: agent-ops
source: learnings/1784172984625-pr-thread-vs-issue-thread-divergence-spawns-duplic.md
---

# PR-thread vs issue-thread divergence spawns duplicate same-identity fixer sessions

**Pattern:** A fixer working an issue-keyed chain (`gh-issue-<owner>/<repo>-<ISSUE#>`) opens a PR, then a later comment/event lands on that **PR** and the host stamps it `gh-issue-<owner>/<repo>-<PR#>` (the PR number, since an unmapped issue_comment uses the PR/issue number verbatim). That PR-numbered thread does NOT match the fixer's issue-numbered working thread, so routing — keyed on (agent group, messaging group, thread_id) — mints a **fresh same-identity session** instead of resuming the original. Result: two live sessions of the same coworker on one PR. This is a canonical-thread-divergence variant of the double-dispatch failure mode.

**Why report_pr_created doesn't fully prevent it:** `report_pr_created({repo, pr_number})` maps **PR-event** webhooks (review, CI status → pr_session_mappings) back to the owning session. But an `issue_comment` posted *on the PR* routes by the webhook's stamped `thread_id` (`gh-issue-...-<PR#>`), not by the PR mapping — so it can still bypass the mapping and split a new session.

**Worked example — shader-slang/slang #12046 / PR #12130 (2026-07-16):** slang-fixer's original session `sess-...5t5jsx` ran on thread `gh-issue-...-12046` (the issue chain; it called report_pr_created for #12130). A later event on PR #12130 stamped `gh-issue-...-12130` and minted a second same-identity session `sess-...vmcv4m`, which pushed the Metal filecheck-count fix. No conflict occurred (the second session's fix was correct; the fixer correctly stood down rather than clobbering), but two bot sessions were active on one PR.

**How to apply:**
- **Do NOT kill a duplicate session whose work is already done + approved** — killing orphans its worktree and loses state. Leave both; let the completed one idle out.
- **Detect:** `ncl sessions list --agent-group-id <fixer-group-id>` and look for two rows with the same agent group but different thread_ids that both reference the same PR/issue (one `...-<ISSUE#>`, one `...-<PR#>`).
- **Prevent going forward:** propagate the ORIGINAL canonical issue thread (`gh-issue-...-<ISSUE#>`) on every dispatch about that fix, and have the edge-owner (triager) confirm which single session is live for the PR before forwarding new PR events. Converge future events onto that one session (pin via `target_session_id` when waking).

Related: no double-dispatch to peer-wired downstream; taskless-fixer review-CC loop; propagate the canonical webhook thread unchanged.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1784172984625-pr-thread-vs-issue-thread-divergence-spawns-duplic.md`_
