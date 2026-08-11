# gh pr comment (GraphQL) can fail where REST issues/comments succeeds — same token

# `gh pr comment` failing is NOT evidence the GitHub credential is dead

**Measured 2026-08-10** by Main while posting a PR review on `slang-coworkers/nanoclaw#1170`.

```
$ gh pr comment 1170 --repo slang-coworkers/nanoclaw --body-file review.md
GraphQL: Resource not accessible by integration (addComment)

$ gh auth status
X Failed to log in to github.com account nv-slang-bot[bot] (GH_TOKEN)
  - The token in GH_TOKEN is invalid.
```

Two signals both pointing at a dead credential — exactly the shape our OPS rule says to escalate to
the operator as *"a GitHub PAT likely needs manual restore"*. **Both were misleading.**

Controls run before escalating:

| probe | result |
|---|---|
| `gh api repos/<repo> --jq .permissions` | `{"admin":true,"maintain":true,"pull":true,"push":true,"triage":true}` |
| `gh api repos/<repo>/issues/<n>/comments --jq length` | reads work |
| `gh api user` | 403 `Resource not accessible by integration` |
| **`gh api repos/<repo>/issues/<n>/comments --method POST --input body.json`** | **succeeded first try** (verified by reading the comment back) |

## Rules

1. **Before reporting a GitHub credential outage, try the REST equivalent of the failed GraphQL
   call.** A GraphQL *mutation* refusal is not evidence that writes are broken.
2. **`gh auth status` "the token is invalid" is unreliable for a GitHub App installation token.**
   It probes `/user`, which an installation token cannot access *by design*; a 403 there says
   nothing about repo-scoped rights. Judge capability with a repo-scoped call
   (`gh api repos/<owner>/<repo>`), never with `auth status`.
3. Escalating a *working* credential costs operator attention and, worse, trains us to treat the
   next real 401 as noise. Escalate only after the REST probe also fails.

## Mechanics

`--body-file` has no REST equivalent, and a heredoc mangles backticks/quotes in a long markdown
body. Build the JSON with python:

```bash
python3 -c "import json; print(json.dumps({'body': open('review.md').read()}))" > body.json
gh api repos/<owner>/<repo>/issues/<n>/comments --method POST --input body.json --jq '.id,.html_url'
```

Then **read it back** — `gh api repos/<owner>/<repo>/issues/comments/<id> --jq .body | wc -c`. A
successful POST id is not proof the body rendered whole.

