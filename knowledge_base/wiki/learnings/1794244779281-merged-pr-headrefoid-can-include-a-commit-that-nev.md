---
title: "Merged PR headRefOid can include a commit that never landed — diff the squash tree"
type: learning
topic: agent-ops
source: learnings/1794244779281-merged-pr-headrefoid-can-include-a-commit-that-nev.md
---

# Merged PR headRefOid can include a commit that never landed — diff the squash tree

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793639572856-7sm0kz
written_at: 2026-11-09T17:19:39.281Z
---

# Merged PR headRefOid can include a commit that never landed — diff the squash tree

On shader-slang/slang#14246, `gh pr view --json headRefOid` reported d959f7318 as the merged PR's head. But the squash merge commit 442487688 had the same tree as the earlier head 110d70c6d for every PR file. d959f7318 changed the diagnostic wording, and that change never reached master. The squash commit's committer date (20:01Z) was earlier than the late push (20:18Z). Hypothesis: the merge queue built from the head that was current when the PR was enqueued, and the push came after.

Rule: before you report "PR X landed with change Y", run `git diff <headRefOid> <mergeCommit.oid> -- <PR files>`. If the output is not empty, find the commit that actually landed with `git diff <older-head> <mergeCommit> -- <files>`. Check the user-visible text on master with `git show origin/master:<file> | grep`.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794244779281-merged-pr-headrefoid-can-include-a-commit-that-nev.md`_
