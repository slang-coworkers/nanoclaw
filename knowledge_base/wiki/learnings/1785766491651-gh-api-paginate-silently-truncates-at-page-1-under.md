---
title: "gh api --paginate silently truncates at page 1 under OneCLI gateway (phantom-green vector)"
type: learning
topic: agent-ops
source: learnings/1785766491651-gh-api-paginate-silently-truncates-at-page-1-under.md
---

# gh api --paginate silently truncates at page 1 under OneCLI gateway (phantom-green vector)

## The defect

`gh api "<endpoint>?per_page=100" --paginate` through the OneCLI GitHub gateway **deterministically
fails on page 2+** with a OneCLI `app_not_connected` 401 JSON body, while an **explicit
`?per_page=100&page=N`** request for the very same page succeeds.

Measured 2026-08-03 on `repos/shader-slang/slang/commits/<sha>/check-runs` (`total_count=131`):

- explicit `?page=2` → **6/6 OK**, 31 items each time
- `--paginate` → **4/4 FAIL**; emits 2 JSON docs, doc 2 is
  `{"connect_url":...,"error":"app_not_connected","message":"GitHub is not connected in OneCLI",...}`

So `--paginate` returns only the first 100 items and **no non-zero exit code**.

## Why it's dangerous (silent, not loud)

The widely-copied CI-sweep recipe is:

```bash
gh api ".../check-runs?per_page=100" --paginate | jq -s '[.[]|.check_runs[]?]| ...'
```

The `?` in `.check_runs[]?` is precisely what makes this fail **silently**: the error document has no
`.check_runs` key, `[]?` swallows it, and the pipeline yields a clean-looking result built from page 1
only. Combined with `2>/dev/null`, there is **zero** signal that ~24% of the data vanished.

For a CI sweep this is a **phantom-green vector**: any PR with >100 check-runs can have its failing
checks sitting on page 2 and be reported GREEN. In one sweep, 6 of 54 PRs exceeded 100 checks
(up to 135) — exactly the big, heavily-tested PRs you least want to misjudge.

## Fix — explicit page loop + reconciliation

Never trust `--paginate` here. Loop explicit pages, retry the transient 401, and **reconcile the
fetched count against `total_count`** so a partial fetch is loud instead of silent:

```bash
fetch_checks() {
  local sha=$1 out="" pg=1 expected
  expected=$(gh api ".../commits/$sha/check-runs?per_page=100&page=1" | jq -r '.total_count')
  while :; do
    local tries=0 pgdata="" ok=0
    while [ $tries -lt 4 ]; do
      pgdata=$(gh api ".../commits/$sha/check-runs?per_page=100&page=$pg" 2>/dev/null)
      if echo "$pgdata" | jq -e '.check_runs' >/dev/null 2>&1; then ok=1; break; fi
      tries=$((tries+1)); sleep 2
    done
    [ $ok -eq 0 ] && { echo "__PAGEFAIL__"; return 1; }   # fail LOUD
    local cnt=$(echo "$pgdata" | jq '[.check_runs[]]|length')
    out="$out$(echo "$pgdata" | jq -c '.check_runs[]')"$'\n'
    [ "$cnt" -lt 100 ] && break
    pg=$((pg+1)); [ $pg -gt 6 ] && break
  done
  [ "$(echo "$out"|grep -c .)" != "$expected" ] && echo "__COUNT_MISMATCH__"
  echo "$out" | grep .
}
```

Key habits, generalizable beyond this endpoint:

1. **Validate the shape before extracting** — `jq -e '.check_runs'` as a gate, rather than relying on
   `[]?` to skip junk. `?` is for optional fields, not for hiding transport errors.
2. **Reconcile against a server-provided total** whenever the API offers one (`total_count`). A count
   check turns an invisible truncation into an explicit failure.
3. **A "no failures found" result is only as trustworthy as the fetch that produced it.** Treat an
   all-green sweep as a claim requiring an integrity check, not a happy answer to accept.

## Related

Same family as the known GraphQL-401 gateway facet (where `gh pr checks` 401s and looks all-green if
stderr is swallowed) — but this one bites the **REST fallback that was supposed to be the safe
workaround**, which is why it went unnoticed. Verify the fallback too.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785766491651-gh-api-paginate-silently-truncates-at-page-1-under.md`_
