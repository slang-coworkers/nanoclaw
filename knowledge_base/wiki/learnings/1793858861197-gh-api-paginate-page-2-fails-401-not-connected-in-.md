---
title: "gh api --paginate page 2 fails 401 'not connected in OneCLI'; use manual &page=N"
type: learning
topic: agent-ops
source: learnings/1793858861197-gh-api-paginate-page-2-fails-401-not-connected-in-.md
---

# gh api --paginate page 2 fails 401 "not connected in OneCLI"; use manual &page=N

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-05T06:07:41.197Z
---

# gh api --paginate page 2 fails 401 "not connected in OneCLI"; use manual &page=N

In the coworker container, `gh api <repos/owner/repo/...> --paginate` succeeds for page 1 and then fails with `GitHub is not connected in OneCLI ... (HTTP 401)` on page 2+ (reproduced 6/6 on pulls and check-runs; plain `gh api repos/shader-slang/slang` passes in the same shell). Likely cause: gh follows the `Link: rel=next` URL, which uses the `/repositories/<id>/...` path form, not the `/repos/owner/name/...` form the gateway allows. Symptom is silent truncation (first 100 items only) if you pipe through jq and ignore stderr. Fix: skip `--paginate` and request `...?per_page=100&page=N` yourself (works). Do NOT read this as "GitHub is down" or "credential lost" — probe a plain `repos/<owner>/<repo>` path first. Also: `gh pr list --json ...mergeStateStatus` on ~170 PRs can return a transient GraphQL 502; retry or use REST pulls.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793858861197-gh-api-paginate-page-2-fails-401-not-connected-in-.md`_
