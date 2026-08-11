---
name: feedback_gh_pr_comment_graphql_fails_where_rest_succeeds
description: "`gh pr comment` failed with `GraphQL: Resource not accessible by integration (addComment)` and `gh auth status` claimed the token was invalid — while the SAME token read fine and REST `POST /issues/<n>/comments` succeeded. Try REST before reporting a credential outage."
metadata:
  node_type: memory
  type: feedback
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1170
---

# `gh pr comment` (GraphQL) can fail where REST `POST /issues/<n>/comments` succeeds — same token

**Measured 2026-08-10** posting the nanoclaw#1170 review ([[project_nanoclaw_1170_stale_rc_dead_under_set_e]]).

```
$ gh pr comment 1170 --repo slang-coworkers/nanoclaw --body-file review.md
GraphQL: Resource not accessible by integration (addComment)

$ gh auth status
X Failed to log in to github.com account nv-slang-bot[bot] (GH_TOKEN)
  - The token in GH_TOKEN is invalid.
```

Two signals both pointing at a dead credential — the shape that the OPS rule says to escalate as
*"a GitHub PAT likely needs manual restore"*. **Both were misleading.** Controls run before
escalating:

| probe | result |
|---|---|
| `gh api repos/<repo> --jq .permissions` | `{"admin":true,"maintain":true,"pull":true,"push":true,"triage":true}` |
| `gh api repos/<repo>/issues/1170/comments --jq length` | `0` — reads work |
| `gh api user` | 403 `Resource not accessible by integration` |
| **`gh api repos/<repo>/issues/1170/comments --method POST --input body.json`** | **succeeded — id `5237911756`, verified 7802 bytes live** |

## The rules

⭐⭐⭐**Before reporting a credential outage, try the REST equivalent of the failed GraphQL call.**
A GraphQL mutation refusal is not evidence that writes are broken; here the write worked on the
first try via REST.

⭐⭐**`gh auth status` "token is invalid" is UNRELIABLE for a GitHub App installation token.** It
probes `/user`, which an app installation token cannot access **by design** — a 403 there says
nothing about repo-scoped rights. Judge capability by a repo-scoped call
(`gh api repos/<owner>/<repo>`), never by `auth status`. This is the same class as
[[feedback_published_negative_env_claims_need_rederivation]]: a capability-negative whose readers
comply by not attempting.

⚠️ Direction of error matters: escalating a *working* credential to the operator costs their
attention and, worse, teaches me to treat the next real 401 as noise.

## Mechanics that worked

`--body-file` has no REST equivalent, so build the JSON safely (a heredoc will mangle backticks and
quotes in a long markdown body):

```bash
python3 -c "import json; print(json.dumps({'body': open('review.md').read()}))" > body.json
gh api repos/<owner>/<repo>/issues/<n>/comments --method POST --input body.json --jq '.id,.html_url'
```

Then **verify by re-reading it back** (`gh api …/issues/comments/<id> --jq .body | wc -c`) — a
successful POST id is not proof the body rendered whole.
