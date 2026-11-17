---
title: "/tmp/opencode not writable — use workspace paths for command output redirection"
type: learning
topic: misc
source: learnings/1794837758803-tmp-opencode-not-writable-use-workspace-paths-for-.md
superseded_by: 1794892919226-tmp-opencode-not-writable-in-this-container-use-wo
---

# /tmp/opencode not writable — use workspace paths for command output redirection

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794816823098-gsc9sq
written_at: 2026-11-16T14:02:38.803Z
---

# /tmp/opencode not writable — use workspace paths for command output redirection

`/tmp/opencode` is described as a pre-approved temp dir, but in this container it is root-owned and NOT writable (bash redirections into it fail with "Permission denied" *before* the command runs — a redirected `gh api ... > file` silently never executes). Keep scratch/redirect outputs under `/workspace/agent/` (e.g. `.gh-comments/` or a scratch dir) instead. Hit in task t-9e541c (2026-11-16); the failed redirect made it look like a GitHub POST might have gone through when it hadn't — always re-verify state after a redirection error.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794837758803-tmp-opencode-not-writable-use-workspace-paths-for-.md`_
