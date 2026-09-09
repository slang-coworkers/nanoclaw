---
title: "Diagnosing GitHub Auth in Coworker Containers (gh / OneCLI / App token)"
type: concept
group: agent-infra
tags: [gh, onecli, github-app-token, auth, app_not_connected, spec-repo, read-vs-write]
source_count: 4
---

## TL;DR

`gh auth status` LIES in coworker containers — it reports the OneCLI-proxied `GH_TOKEN` as
invalid even when reads and writes work. Never infer reachability from the status probe or
from public GETs (which succeed regardless). Probe the actual path you need.

- **`gh auth status` says "invalid" and `gh api /user` returns 403 "Resource not accessible
  by integration" — this is NORMAL for a GitHub App installation token** (it has no user
  context). REST calls scoped to the installation's repos still work.
- **The definitive read probe:** `gh api /repos/<owner>/<repo>/issues/<n> --jq .state`. If it
  returns, your posting path is fine. `gh api` / `gh api graphql` are reliable for reads AND
  writes as `nv-slang-bot[bot]`.
- **`gh pr diff` / `gh pr view` go through git/HTTP with the raw token and succeed for reads
  even when `gh api` 401s** (OneCLI intercepts only `gh api` / `gh api graphql`). So a scary
  `gh auth status` at preflight does NOT block a review runner — verify by running
  `gh pr diff <N> -R <repo> | head`, not by trusting the status.
- **`gh issue view <n>` and other GraphQL-backed `gh` subcommands can return EMPTY output
  (no error)** with an App token — do NOT conclude GitHub is unreachable; use `gh api` /
  `gh api graphql` directly.
- **Tell a dead connection from an under-scoped token with two cheap reads:** `gh api rate_limit`
  (`app_not_connected` 401 = OneCLI has no live connection; `limit=5000+` = authed;
  `limit=60` = unauthenticated) and `gh api repos/OWNER/REPO --jq '.permissions'` (all-false =
  disconnected). Both disconnected → not transient, not `/user`-specific; every authenticated
  path fails. Reconnect is operator-side (OneCLI connect URL).
- **`shader-slang/spec` has NO writable route** from the slang container (no push, no fork,
  `/user` 403). This is different from `shader-slang/slang` which pushes fine. Draft locally,
  commit on a branch, report the blocker up with the doc — don't hunt a workaround.

## Synthesis

### The status probe misreports; probe the real path

The recurring surprise across triager, fixer, and reviewer containers is that `gh auth status`
reporting an invalid `GH_TOKEN`, and `gh api user` returning `403 Resource not accessible by
integration`, are **normal for a GitHub App installation token** — it carries no user context,
so `/user` is inaccessible and the status check misreports ([gh api REST works with the App installation token even when gh auth status says invalid](../learnings/1788776005130-gh-api-rest-works-with-the-app-installation-token-.md)).
REST calls scoped to the installation's repos work fine: `gh api /repos/shader-slang/slang/issues/12926
--jq .state` returns `open`, and POSTing an issue comment succeeds as `nv-slang-bot[bot]`;
`gh api graphql` also works (used to read/set native Issue Type). The definitive pre-escalation
probe is therefore `gh api /repos/<owner>/<repo>/issues/<n> --jq .state` — if that returns, the
posting path is fine. A gotcha in the same learning: `gh issue view <n>` and other GraphQL-backed
`gh` subcommands can return EMPTY output with no error under this token — do NOT read that as
"GitHub unreachable"; use `gh api` / `gh api graphql` (or the slang-mcp `github_*` tools, a
separate working read/search auth).

The read/write split is even finer for the PR-review runners. During a `/slang-pr-review` run,
`gh auth status` reported invalid and `gh api rate_limit` returned `app_not_connected` 401, yet
`gh pr diff <N> -R shader-slang/slang` and `gh pr view` returned the real diff — because the
OneCLI gateway intercepts `gh api` / `gh api graphql` (the auth-status probe and any REST/GraphQL
write path) while plain `gh pr diff`/`gh pr view` go through git/HTTP with the raw `GH_TOKEN` and
succeed for read access ([gh pr diff works even when gh auth status shows invalid GH_TOKEN](../learnings/1788581852750-slang-pr-review-gh-pr-diff-works-even-when-gh-auth.md)).
Since the reviewer runner reads the PR via `gh pr diff`, a scary preflight `gh auth status`
failure does NOT block Reviewer A or C — verify by actually running `gh pr diff <N> -R <repo> |
head`. Posting back WOULD be blocked by the same OneCLI wall, but that only matters when
`<github-post-authorized />` is present.

### Distinguishing dead-connection from under-scoped, and the spec-repo dead end

When `gh` genuinely fails, distinguish a *dead credential connection* from a merely *under-scoped
token* with two cheap reads, since public GETs succeed in both cases: `gh api rate_limit` (a
disconnected broker never reaches GitHub and returns the OneCLI proxy error
`{"error":"app_not_connected", ...connect URL...}` at HTTP 401; a real token returns `limit=5000+`;
an unauthenticated one `limit=60`) and `gh api repos/OWNER/REPO --jq '.permissions'` (write-capable
returns `push/triage/maintain` true; disconnected returns all false)
([diagnosing a gh 403/invalid-token — OneCLI app_not_connected](../learnings/1787673998635-diagnosing-a-gh-403-invalid-token-in-the-coworker-.md)).
If both signals say disconnected it is NOT transient and NOT `/user`-specific — every
authenticated path (labels, comments, Issue Type via GraphQL, PR create, and `git push`, since the
origin remote is `x-access-token:<token>@github.com/...` backed by the same connection) will fail.
Remediation is operator-side (reconnect via the OneCLI connect URL); report it up and tell any
downstream fixer to stop-and-report at PR-creation rather than retry-loop, since local build/test
work is unaffected.

A permanent access boundary, not a transient outage: `shader-slang/spec` (the formal
specification / proposals repo) has NO writable route from the slang container — `git push` fails
`Authentication failed` (origin carries a placeholder token), `gh auth status` shows an invalid
`GH_TOKEN`, `.permissions` are all false, no `slang-coworkers/spec` fork exists, and `/user` 403s
([shader-slang/spec has no writable path from the slang-fixer container](../learnings/1787678701018-shader-slang-spec-has-no-writable-path-from-the-sl.md)).
This contrasts with `shader-slang/slang`, which pushes fine via a different remote/credential —
the spec repo is simply not covered by the same App access. The four probes above are the
definitive check; run them once and escalate rather than burning turns on a workaround. Correct
handling: draft + critique the proposal locally (needed regardless), commit on a branch in the
local `spec` clone, and report the blocker up with the finished doc attached, asking the operator
to open the PR or provision a writable route. (Proposal conventions: copy `proposals/000-template.md`,
keep number `000` until a maintainer assigns one, conform to the template sections exactly, Status
= "Design Review".)

**Source learnings (4):**
- [Diagnosing a gh 403/invalid-token in the coworker container (OneCLI app_not_connected)](../learnings/1787673998635-diagnosing-a-gh-403-invalid-token-in-the-coworker-.md) — two cheap reads (`rate_limit`, `.permissions`) tell dead-connection from under-scoped; both dead ⇒ every authenticated path fails, reconnect is operator-side.
- [shader-slang/spec has no writable path from the slang-fixer container](../learnings/1787678701018-shader-slang-spec-has-no-writable-path-from-the-sl.md) — no push, no fork, invalid GH_TOKEN, /user 403; draft locally and report the blocker up, don't hunt a workaround.
- [slang PR review: gh pr diff works even when gh auth status shows invalid GH_TOKEN](../learnings/1788581852750-slang-pr-review-gh-pr-diff-works-even-when-gh-auth.md) — OneCLI intercepts only `gh api`/`gh api graphql`; `gh pr diff`/`gh pr view` read via raw token, so preflight status failure doesn't block the runner.
- [gh api REST works with the App installation token even when gh auth status says "invalid"](../learnings/1788776005130-gh-api-rest-works-with-the-app-installation-token-.md) — App tokens have no user context (so /user 403s); probe `gh api /repos/.../issues/<n> --jq .state`; GraphQL-backed `gh` subcommands can return empty output.
