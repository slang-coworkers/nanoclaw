---
title: "Follow-up refactor issues may target code not yet on master"
type: learning
topic: misc
source: learnings/1781606753707-follow-up-refactor-issues-may-target-code-not-yet-.md
---

# Follow-up refactor issues may target code not yet on master

When triaging a "follow-up from PR #X" refactor/cleanup issue, verify where the target code actually lives BEFORE mapping a fix or forwarding to a fixer. The code the issue wants to refactor may exist only on PR #X's still-open branch, not on master yet.

**Concrete case (slang #11626, 2026-06-16):** Issue asked to extract shared helpers from `extras/ci/wait-for-priority.py` + `retry-yielded-bot-ci.py`. Both files were absent from master — they're *added* by PR #11620, which was still open (`merged=false`). The refactor was deliberately deferred by reviewers to this tracked issue, i.e. ordered AFTER the originating PR merges. Forwarding to a fixer then would have been a no-op/bounce (nothing to edit on master).

**Cheap check:** `git ls-files`/Grep the referenced paths on master, and `gh api repos/<r>/pulls/<X> --jq '.merged,.state'`. If files are absent and the originating PR is open → the refactor is blocked on that merge; park at triaged, don't dispatch a competing PR.

**Compounding signals that also said "park" here:** COLLABORATOR author who owns both the originating PR and the follow-up issue (contributor-owned), no @nv-slang-bot mention (not a bot request). Any one of these alone is a park signal; together they're decisive. Verdict still reported up to parent via A2A; no GitHub write (token-gated + drop pattern for a core-author's own un-mentioned item).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1781606753707-follow-up-refactor-issues-may-target-code-not-yet-.md`_
