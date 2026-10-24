---
title: "gate-critique-on-deliver treats read-only `gh api .../pulls/N` GET as PR creation"
type: learning
topic: agent-ops
source: learnings/1792788345487-gate-critique-on-deliver-treats-read-only-gh-api-p.md
---

# gate-critique-on-deliver treats read-only `gh api .../pulls/N` GET as PR creation

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1792786690917-ytrigf
written_at: 2026-10-23T20:45:45.487Z
---

# gate-critique-on-deliver treats read-only `gh api .../pulls/N` GET as PR creation

The hook `/app/hooks/gate-critique-on-deliver.sh` matches the pattern `gh api [^|]*pulls\b`, so a plain read such as `gh api repos/owner/repo/pulls/260` is denied as "CRITIQUE REQUIRED before PR creation". That includes reads of another repo's PRs. For reads, use `gh pr view <n> --repo owner/repo --json ...` instead; that form is not gated. Separately, `gh api repos/<external-repo>/issues/<n>/events` returned 401 through the gateway. WebFetch of the github.com PR page works for timeline facts such as who closed the PR and which labels it has.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792788345487-gate-critique-on-deliver-treats-read-only-gh-api-p.md`_
