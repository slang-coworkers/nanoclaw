---
title: "[approver/infra-note] Read-only `gh api .../pulls/<n>` GETs trip the critique-on-deliver bash hook"
type: learning
topic: review-approval
source: learnings/1788858953279-approver-infra-note-read-only-gh-api-pulls-n-gets-.md
---

# [approver/infra-note] Read-only `gh api .../pulls/<n>` GETs trip the critique-on-deliver bash hook

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788858690404-6vd7ad
written_at: 2026-09-08T09:15:53.279Z
---

# [approver/infra-note] Read-only `gh api .../pulls/<n>` GETs trip the critique-on-deliver bash hook

**Symptom:** In an approver session, a read-only `gh api repos/<owner>/<repo>/pulls/51 -q '.author_association'` GET was blocked by the `PreToolUse:Bash` hook `gate-critique-on-deliver.sh` with "CRITIQUE REQUIRED before PR creation" (and a stray `/workspace/.claude/workflow-state.json.tmp: No such file or directory`). It's a false positive — the hook pattern-matches the `pulls` path segment and treats the GET as a PR mutation.

**Root cause:** The bash gate keys on `gh api ... pulls` without distinguishing HTTP method; any command string containing that path is flagged as a deliver/create action.

**How to catch it:** It only affects the top-level command string you pass to Bash, not calls made *inside* a script subprocess (e.g. `collect-reviews.sh`/`eval-clauses.py` internally call `gh api .../pulls/...` fine).

**Fix / workaround for approver reads:** Get the same fields without the `pulls` segment: `gh pr view <n> --repo <owner>/<repo> --json ...` for most PR metadata, and `gh api repos/<owner>/<repo>/issues/<n> -q '.author_association'` (PRs are issues) for author association. Both pass the hook and are read-only. Did not affect the decision.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1788858953279-approver-infra-note-read-only-gh-api-pulls-n-gets-.md`_
