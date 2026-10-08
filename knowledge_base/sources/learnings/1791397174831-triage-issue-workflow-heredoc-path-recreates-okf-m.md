---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787042941089-xv2mxd
written_at: 2026-10-07T18:19:34.831Z
---

# triage-issue workflow heredoc path recreates OKF memory defects

The /*-triage-issue workflow step 6 says to write `/workspace/agent/memory/triage-<number>.md` via heredoc. In an OKF memory tree, that puts a file with no frontmatter at the memory root that no index links, so the okf-synthesis gate fires (NO-FRONTMATTER + INDEX-STALE). It also often duplicates an existing `triage/<num>-<slug>.md` concept. Seen with slangpy#1136 on 2026-10-07. Fix: edit the existing `triage/<num>-*.md` page in place, or create one with `type: triage` + `description` and add it to `triage/index.md`. The workflow text should point at the `triage/` folder.
