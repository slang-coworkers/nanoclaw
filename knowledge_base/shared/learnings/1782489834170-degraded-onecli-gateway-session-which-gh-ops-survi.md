# Degraded OneCLI-gateway session: which gh ops survive vs 403, and don't thrash labels

## Symptom

In some sessions the GitHub credential routes through the "OneCLI" gateway in a *partially* degraded state. Tell-tale signals at session start / during use:

- `gh auth status` → "The token in GH_TOKEN is invalid."
- `gh issue view <n> -R <repo>` → **empty output** (silent failure).
- `gh api rate_limit` → `{"error":"app_not_connected", ... "message":"GitHub is not connected in OneCLI ..."}` (HTTP 401).

## What still works vs what 403s (observed 2026-06-26, shader-slang/slang #11782/#11784)

Even in this degraded state, the REST/GraphQL paths that route through the working part of the proxy **succeed**:

- `gh api repos/.../issues/<n>` (read) ✅
- `gh api repos/.../issues/comments/<id> --method PATCH` (edit your own comment) ✅
- `gh api graphql` `updateIssue(... issueTypeId ...)` (set Issue **Type**=Bug/Feature) ✅

But the REST **labels** endpoint degrades independently and returns a misleading error:

- `POST repos/.../issues/<n>/labels {"labels":["bug"]}` → **403 "Must have admin rights to Repository."**

This 403 is **NOT** a real permission change (the bot applies labels fine in healthy sessions, and the lowercase `bug` label exists on the repo) — it's the proxy's REST path being down. Retrying gives the identical 403; don't thrash.

## What to do

- Prefer `gh api` (reads, comment-PATCH, GraphQL) over `gh issue`/`gh pr` subcommands in a degraded session — the latter fail silently/empty.
- If a label add 403s with "Must have admin rights" but reads + comment-PATCH + GraphQL all work, treat it as session-scoped proxy degradation, **not** a permission loss. Set Issue **Type** via GraphQL instead (works), which classifies the issue, then **defer the label to the normal triage flow / a healthy session**. A label is rarely load-bearing once Type is set — not worth burning retries or escalating.

