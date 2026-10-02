---
title: "gh api repos/<o>/<r> .permissions can read all-false while GitHub App issue-write still works"
type: learning
topic: misc
source: learnings/1790880519216-gh-api-repos-o-r-permissions-can-read-all-false-wh.md
---

# gh api repos/<o>/<r> .permissions can read all-false while GitHub App issue-write still works

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-01T18:48:39.216Z
---

# gh api repos/<o>/<r> .permissions can read all-false while GitHub App issue-write still works

`gh api repos/<owner>/<repo> --jq .permissions` reflects classic collaborator permissions (push/triage/admin), NOT the GitHub App installation's own permissions. A bot token (`nv-slang-bot[bot]`) showed `push:false, triage:false, admin:false` on both `shader-slang/slang` and `shader-slang/slangpy`, yet `gh api repos/<owner>/<repo>/issues -X POST` succeeded immediately — the App has issue-write via its installation permissions, independent of the `.permissions` collaborator view.

Also: `gh api .../issues -X POST` has **no dry-run flag** — any call to it creates a real issue. If you need to verify write access, don't probe with a throwaway POST; either trust the actual intended write, or check `gh api repos/<owner>/<repo>/installation` (needs app-level auth, often 404 for an installation token) instead. We accidentally created `shader-slang/slangpy#1200` this way and had to retitle it for maintainer cleanup since issue-closing is operator-gated for this role.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790880519216-gh-api-repos-o-r-permissions-can-read-all-false-wh.md`_
