---
title: "slang escalation session that FILES an upstream issue also triggers a duplicate webhook triage session — don't double-post/double-dispatch"
type: learning
topic: agent-ops
source: learnings/1783886221663-slang-escalation-session-that-files-an-upstream-is.md
---

# slang escalation session that FILES an upstream issue also triggers a duplicate webhook triage session — don't double-post/double-dispatch

**Pattern (observed twice: slang#12070 and slang#12071, both 2026-07-12).** When our own `slangpy-<n>/upstream-slang` escalation session files a NEW shader-slang/slang issue (via `gh issue create`), the `issue_opened` webhook fires and the orchestrator ALSO dispatches a fresh triage session on the canonical `gh-issue-shader-slang/slang-<n>` thread. Result: two sessions of the SAME agent converge on one issue within the same minute.

**The escalation session, in one shot, typically already did ALL of triage:** filed the issue, applied labels (Autodiff/bug/reproduced) + Issue Type, posted the verified 5-bullet verdict comment (recorded in `.gh-comments/shader-slang-slang-<n>.id`), **dispatched slang-fixer with the full briefing**, and reported up to parent.

**So the webhook-minted session MUST NOT:** post a 2nd GitHub comment, re-apply labels, or re-dispatch slang-fixer (no-double-dispatch → duplicate fixer sessions = work done twice on two wirings).

**How to detect fast (do this BEFORE any mutating triage step):**
1. `gh api repos/OWNER/REPO/issues/N/comments --jq '.[-1]|"\(.user.login)\t\(.id)\t\(.created_at)"'` — if newest is `nv-slang-bot[bot]` posted ~same minute as issue creation, a sibling already triaged.
2. `ls /workspace/agent/.gh-comments/OWNER-REPO-N.id` and `ls /workspace/agent/memory/*<n>*escalation*.md` — the escalation session persists its briefing there (same agent, shared /workspace/agent), so you can read its exact handoff.
3. `git ls-remote origin 'refs/heads/*<n>*'` + `gh pr list --search N` — fixer branch/PR state.
4. Read the escalation session transcript: `ncl sessions messages <sess-id> --json | jq .data` (note: outbound tool actions like comment-post aren't always in the DB — the GitHub comment + persisted memo are ground truth).

**The webhook session's legitimate value-add** = independent from-scratch ToT re-verification of the repro + locus/sibling-relationship confirmation, reported up on the canonical thread — WITHOUT duplicating the external artifacts. That's what the parent's "verify, don't relay" ask wants anyway.

**Verify-at-HEAD before deciding not to re-post:** confirm the existing verdict comment's numbers still hold at current HEAD. If they do (they did for both), the comment is accurate → edit-if-self says leave it as-is (no delta to add). Only re-post if HEAD changed the verdict.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783886221663-slang-escalation-session-that-files-an-upstream-is.md`_
