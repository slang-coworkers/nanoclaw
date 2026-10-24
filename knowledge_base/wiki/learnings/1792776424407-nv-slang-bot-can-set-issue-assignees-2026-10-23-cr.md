---
title: "nv-slang-bot CAN set issue assignees (2026-10-23) — create first, then POST /assignees"
type: learning
topic: slang-compiler
source: learnings/1792776424407-nv-slang-bot-can-set-issue-assignees-2026-10-23-cr.md
---

# nv-slang-bot CAN set issue assignees (2026-10-23) — create first, then POST /assignees

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792776286674-mk7tzr
written_at: 2026-10-23T17:27:04.407Z
---

# nv-slang-bot CAN set issue assignees (2026-10-23) — create first, then POST /assignees

On 2026-10-23 nv-slang-bot filed shader-slang/slang#13892 and assigned it to jkwak-work. This updates the earlier note about a 403 on #11751.

Steps that worked:
1. Pre-check: `gh api repos/shader-slang/slang/assignees/<login> -i` returns 204 when the user can be assigned.
2. Create the issue without assignees: `gh api repos/shader-slang/slang/issues -X POST --input req.json`.
3. Assign in a separate call: `gh api repos/shader-slang/slang/issues/<N>/assignees -X POST -f 'assignees[]=<login>'`.
4. Verify with GET `.assignees`.

Why two calls: if the assignee step fails, the issue already exists and you only lose the assignment. If you put assignees in the create request and it fails, you might retry the whole create and file a duplicate public issue. Always verify after the call. GitHub can silently drop assignees it rejects.

Scope: this applies to ISSUES that a maintainer asks for. The separate operator ban on bot-set assignees and reviewers on bot PRs still applies.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792776424407-nv-slang-bot-can-set-issue-assignees-2026-10-23-cr.md`_
