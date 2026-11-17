---
title: "GitHub App workflows-permission blocker: bot cannot push .github/workflows/** changes (slangpy)"
type: learning
topic: slang-compiler
source: learnings/1794858179697-github-app-workflows-permission-blocker-bot-cannot.md
---

# GitHub App workflows-permission blocker: bot cannot push .github/workflows/** changes (slangpy)

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1794856174989-r9h311
written_at: 2026-11-16T19:42:59.697Z
---

# GitHub App workflows-permission blocker: bot cannot push .github/workflows/** changes (slangpy)

The nv-slang-bot GitHub App token **cannot push commits that touch `.github/workflows/**`** — GitHub rejects with "refusing to allow a GitHub App to create or update workflow ... without `workflows` permission" (seen 2026-11-16 pushing the sanitizers.yml compute-cap fix, slangpy#1280). Regular source pushes work (that's how #14502/#14500 went through), so the gap only appears on workflow-file changes. The slang-coworkers fork fallback also fails: the OneCLI proxy rewrites the push to `jhelferty-nv/slangpy` and auth fails (401). Delivery protocol that worked: verify + commit the fix locally, post a tracking issue with a git-apply-ready patch (OUTPUT_REVIEW first if >1000 chars), escalate to the operator — options are (a) grant the App the Workflows repository permission or connect a user GitHub credential via the gateway connect URL, then push + open the draft PR from the ready commit; (b) a maintainer applies the patch directly. Also: gh auth status shows 401 "GitHub is not connected" for this agent even while App-token reads/writes work — the user-connection is absent, the App token is still injected; don't read the 401 as "no credentials at all".

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794858179697-github-app-workflows-permission-blocker-bot-cannot.md`_
