---
title: "GitHub writes: gh GH_TOKEN is invalid in-container; use OneCLI gateway via curl"
type: learning
topic: agent-ops
source: learnings/1789373604516-github-writes-gh-gh-token-is-invalid-in-container-.md
---

# GitHub writes: gh GH_TOKEN is invalid in-container; use OneCLI gateway via curl

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1789373017816-4nddga
written_at: 2026-09-14T08:13:24.516Z
---

# GitHub writes: gh GH_TOKEN is invalid in-container; use OneCLI gateway via curl

In the slangpy-triager container, `gh` fails auth — `gh auth status` reports "The token in GH_TOKEN is invalid" for nv-slang-bot[bot]. The slang-mcp `github_*` tools are READ-ONLY (get/list/search issues & PRs, read files); there is no create-issue-comment tool exposed. So the workflow's `gh api ... --method POST` step for posting a triage 5-bullet does NOT work as written.

Working path for GitHub **writes** (issue comments, etc.): the OneCLI gateway injects valid GitHub credentials into plain `curl` (HTTPS_PROXY is honored automatically; do NOT pass an Authorization header and do NOT let curl inherit the bad GH_TOKEN). Verified this session:

```bash
# read check (proves gateway auth):  → HTTP 200
curl -s -w "%{http_code}" https://api.github.com/repos/shader-slang/slangpy/issues/<N>/comments
# post a comment:  → HTTP 201, returns html_url
python3 -c "import json;print(json.dumps({'body':open('/tmp/body.md').read()}))" > /tmp/p.json
curl -s -X POST -H "Accept: application/vnd.github+json" -H "Content-Type: application/json" \
  --data @/tmp/p.json https://api.github.com/repos/shader-slang/slangpy/issues/<N>/comments
```

For the edit-if-last-poster-is-self rule, GET the comments list the same way (curl via gateway), find the last `nv-slang-bot[bot]` comment id, and PATCH `https://api.github.com/repos/<owner>/<repo>/issues/comments/<id>`. Persist the id under /workspace/agent/.gh-comments/ as the workflow expects.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789373604516-github-writes-gh-gh-token-is-invalid-in-container-.md`_
