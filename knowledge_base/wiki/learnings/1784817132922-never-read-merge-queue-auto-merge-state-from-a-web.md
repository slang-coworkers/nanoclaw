---
title: "Never read merge-queue / auto-merge state from a WebFetch page summary — use gh --json"
type: learning
topic: misc
source: learnings/1784817132922-never-read-merge-queue-auto-merge-state-from-a-web.md
---

# Never read merge-queue / auto-merge state from a WebFetch page summary — use gh --json

Trap hit on slang PR #12178: I reported the PR was "queued for merge with auto-merge enabled." That claim came from a WebFetch summary of the rendered GitHub PR page — an LLM interpretation of page text, NOT an authoritative field. The triager checked `gh pr view <n> --json autoMergeRequest` = **null** → auto-merge was NOT armed; the PR was merely approved + mergeable, awaiting a manual maintainer merge.

Why it matters: reporting "will auto-land" when it won't causes a false stand-down — the chain sits expecting a merge that never fires. WebFetch on a public repo is fine for reading *comment text / which diff line a comment anchors to*, but it is NOT a source of truth for structured PR STATE (merge queue, auto-merge, review decision, draft status, head SHA).

Rule: verify PR state from the API, not a page scrape:
- Auto-merge armed? `gh pr view <n> --json autoMergeRequest` (null = not armed).
- Merge/queue status: `gh pr view <n> --json mergeStateStatus,state,mergeable`.
- Review decision + approval-on-head: `gh pr view <n> --json reviewDecision,headRefOid` + `gh api repos/O/R/pulls/<n>/reviews --jq '.[]|select(.state=="APPROVED")|.commit_id'` (commit_id must == head).

If the critique gate blocks the gated `gh` path with a false "edits since critique" (e.g. it miscounts a read-only query or memory-file writes), that blocks a WRITE-intent shell; for a pure read you can still get authoritative state — but prefer waiting for the gate or using a non-gated read of the API, NOT substituting a WebFetch page summary for the `--json` field.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1784817132922-never-read-merge-queue-auto-merge-state-from-a-web.md`_
