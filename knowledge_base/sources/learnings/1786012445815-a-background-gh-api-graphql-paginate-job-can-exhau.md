# A background `gh api graphql --paginate` job can exhaust the GraphQL budget and make every later eviction query fail open to "0 evictions"

## What happened

During a CI sweep I launched `gh api graphql --paginate --slurp` in the **background** to cross-check a
PR population, then proceeded with the sweep in the foreground. The background job kept retrying and
drained the **GraphQL** budget to zero (`RATE_LIMIT / graphql_rate_limit`, installation-scoped) while
**REST stayed healthy at 3432/6000** — the two budgets are separate.

The danger is what a rate-limited GraphQL read looks like through the idiom I (and most sweep scripts)
use:

```bash
gh api graphql -F pr=12363 -f query='…' 2>/dev/null \
| jq -r '.data.repository.pullRequest | "PR \(.number) evictions=\(.timelineItems.nodes|length)"'
# → PR null evictions=0        exit status 0
```

**`evictions=0` with a clean exit — indistinguishable from "this PR was never evicted."** For a
merge-queue babysitter this is the worst possible fail-open: the entire job is finding evictions, and an
exhausted budget reports *none anywhere*. Without stderr swallowed the same call is `rc=1` plus an
explicit `RATE_LIMIT` body.

Two independent silencers stack: `2>/dev/null` hides the message, and the pipe into `jq` launders the
exit status (`jq` succeeds on the error JSON because `.data.…` is merely absent → `null`).

## Why `--slurp` made recovery impossible

`--paginate --slurp` buffers **all** pages into one JSON array and writes it at the end, so a mid-stream
death leaves an unterminated array: 1,248,537 bytes, **zero** complete top-level objects recoverable,
and **no trailing newline** (the same tell as a truncated/error page). A per-page `?page=N` loop would
have left every completed page intact and parseable.

## How to apply

1. **Never leave a `--paginate` job running in the background while you work the same API.** It is not
   free parallelism — it competes for the budget the foreground needs, and you won't see it fail until it
   has already poisoned later reads.
2. **Probe the budget you are about to spend, not the other one.** REST `X-Ratelimit-Remaining` says
   *nothing* about GraphQL. Use `gh api graphql -f query='{rateLimit{remaining resetAt}}'`.
3. **Make the failure loud** in any GraphQL read whose zero is load-bearing:
   ```bash
   set -o pipefail                       # stop jq from laundering the status
   out=$(gh api graphql …) || { echo "GRAPHQL FAILED: $out" >&2; exit 1; }
   jq -e '.data.repository.pullRequest != null' <<<"$out" >/dev/null \
     || { echo "NULL PAYLOAD — treat as UNKNOWN, never as zero" >&2; exit 1; }
   ```
   Keep stderr; assert the payload is non-null **before** counting anything.
4. **Cross-check a zero on a different transport.** REST `issues/<n>/timeline` exposes
   `removed_from_merge_queue` / `added_to_merge_queue` / `auto_merge_enabled` with the same timestamps
   and actors as the GraphQL `timelineItems`, on a separate budget. That is what let me confirm two real
   evictions after GraphQL died.
5. **A semantic error is proof of life.** An `UNPROCESSABLE … not authorized to push` reply means auth
   and quota were fine; only `RATE_LIMIT`/`401` invalidate the read. Distinguish them before discarding
   findings.

## The general rule

**An instrument that returns `0` when it is broken must never be the sole source of a `0` you act on.**
Ask what the failure mode *looks like* — if broken and empty are the same output, the count is not
evidence. Pair the query with a positive control, or read the count off a second transport.
