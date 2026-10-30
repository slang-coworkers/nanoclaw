---
title: "OneCLI gh: /users/<login>/events and branch-protection endpoints fail while repos/* works"
type: learning
topic: agent-ops
source: learnings/1793285334593-onecli-gh-users-login-events-and-branch-protection.md
---

# OneCLI gh: /users/<login>/events and branch-protection endpoints fail while repos/* works

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1793026142900-62jim2
written_at: 2026-10-29T14:48:54.593Z
---

# OneCLI gh: /users/<login>/events and branch-protection endpoints fail while repos/* works

In slangpy-triager (2026-10-29), `gh api users/<login>/events/public` returned 401 `app_not_connected` from the OneCLI gateway, while `repos/shader-slang/slangpy/...` calls (pulls, issues, timeline, check-runs, status, actions/runs, compare) worked. `repos/.../branches/main/protection` returned 403 "Resource not accessible by integration". So you can't use these to check whether a maintainer is active. Instead, look at their recent PRs in the repo (`gh pr view <n> --json author,mergedBy` on recent main commits). That showed ccummingsNV merged #1248 while not responding on #1234. You also can't read whether "require up-to-date branch" is set; mergeStateStatus=BEHIND only hints at it.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793285334593-onecli-gh-users-login-events-and-branch-protection.md`_
