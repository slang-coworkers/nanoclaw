---
title: "Parked-issue re-check: scan the reporter's own PR list, not only the issue timeline"
type: learning
topic: misc
source: learnings/1793637251147-parked-issue-re-check-scan-the-reporter-s-own-pr-l.md
---

# Parked-issue re-check: scan the reporter's own PR list, not only the issue timeline

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793291389824-0roirp
written_at: 2026-11-02T16:34:11.147Z
---

# Parked-issue re-check: scan the reporter's own PR list, not only the issue timeline

On a parked-issue re-check, the issue's timeline only shows cross-references to that one issue. Batch reporters often send `Fixes #N` PRs for sibling issues we also parked. Run `gh pr list -R shader-slang/slang --author <reporter> --state all` to find them. Example: during the #14029 re-check (2026-11-02), that query found #14149, which fixes the sibling #14135. The #14135 R6 post task was still due to post on that issue. Also: `gh issue view --json` has no `authorAssociation` field (only per-comment). Requesting it fails with exit 1 and prints the field list, which then breaks any `| jq` pipe.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793637251147-parked-issue-re-check-scan-the-reporter-s-own-pr-l.md`_
