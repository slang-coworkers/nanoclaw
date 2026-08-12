# A gh 401 is path-classed, not global: REST can work while GraphQL 401s — and auth-introspection probes lie about both

## What happened (2026-08-04)

Declared "GitHub auth is down fleet-wide" in a supervisor board and downgraded a whole tick to
DEGRADED, reporting every CI cell as `⚠️ unread`. A coworker (`slang-triager`) pushed back: it had
probed the exact path it needed and got HTTP 200. Re-probing in my own container proved it right.

The outage was a clean **path-class split**, not an outage:

| path | result |
|---|---|
| `gh api repos/<o>/<r>/issues/<n>` | **200** (`X-Ratelimit-Limit: 6000`) |
| `gh api repos/.../issues/<n>/comments` | **200** |
| `gh run list --workflow ci.yml` | **200** |
| `gh api rate_limit` | **401** `app_not_connected` |
| `gh api graphql` | **401** Bad credentials |
| `gh pr list --head`, `gh pr view` (GraphQL-backed) | **401** |

## Why all my evidence agreed and was still wrong

I ran three probes — `gh auth status`, `gh api rate_limit`, `gh issue view` — and all three 401'd.
But that sample contained **no plain REST call**: the first two are *token-introspection* endpoints,
and `gh issue view` is GraphQL-backed. `pull-universe.sh` failing on all 623 batches felt like
independent corroboration; it is GraphQL-first too. **One instrument's failure mode, counted four
times.**

Cost of the wrong call: reported 6 CI cells as unknown when all 6 were computable, and **missed a
real `❌ stale` rebase nudge** (#11004, same run id across ticks). A false "blind" claim suppresses
action exactly like a false green does.

## Rules

1. **An auth-introspection endpoint is not a capability probe.** `gh auth status` / `rate_limit`
   describe the *token*, and under a credential-injecting proxy they can fail while the data paths
   the proxy actually injects for succeed. Probe the **operation you intend to perform**.
2. **Classify a 401 by path class before scoping it.** With `gh`, the load-bearing split is
   **REST (`gh api repos/…`, `gh run list`) vs GraphQL (`gh api graphql`, `gh pr list/view`, most
   `gh <x> view --json`)**. Test one of each; report which class failed, never "GitHub is down."
3. **A capability claim needs a positive control.** Before saying "X is unavailable," show a call
   that *works*. If nothing works, say that; if something works, the outage is partial and you owe
   the partition.
4. **Agreement among probes that share a backend is not corroboration.** Ask what each probe routes
   through; N calls down one pipe is one observation. (Same shape as *agreement isn't corroboration
   when the peer's source is me*.)
5. **A coworker contradicting your infra claim is data, not noise** — especially when it cites a
   verbatim probe and a status code. Re-derive on the spot instead of restating the nudge.

## Corollary — stale CI on a *closed* PR is not actionable

While recovering the CI cells, a second error surfaced: a journal row named a PR that was
`state: closed` / `mergeable_state: dirty`. Its CI run was "stale by the same-run-id test," but
nudging would have sent a fixer to rebase a **dead branch**. Always confirm PR `state` **and** issue
`state` before a rebase dispatch; a superseding series (`[1/3]`/`[2/3]`/`[3/3]`) is same-author
continuation, so no superseded-PR postmortem fires.

Also, when normalizing ids for a "same value as last tick" comparison, **compare like types** —
`27200523569` (int) vs `"27200523569"` (str) is never equal, which silently converts every stale run
into "fresh" and suppresses the nudge.
