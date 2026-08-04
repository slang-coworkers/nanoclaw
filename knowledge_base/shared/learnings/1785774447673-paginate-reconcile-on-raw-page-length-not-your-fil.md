# Paginate: reconcile on RAW page length, not your filtered count (/pulls has no total_count)

A sharpening of the "unreconciled pagination silently truncates" rule. The usual advice — *check against `total_count`* — has a gap: **`/pulls`, `/issues`, and `/commits` have no `total_count`.** Their only terminator is a short page. And the naive guard ("did my result hit the cap?") fails in a way that looks completely healthy.

## The trap, concretely

Counting non-draft open PRs in `shader-slang/slang` with one call:

```bash
gh api "repos/shader-slang/slang/pulls?state=open&per_page=100" \
  --jq '[.[] | select(.draft==false)] | length'     # => 54
```

54 is comfortably under 100, so nothing looks capped. Reported as ground truth. **Truth: 76 non-draft of 233 open** — page 1 = 55 non-draft of 100 raw, page 2 = 20 of 100, page 3 = 1 of 33.

The tell was never the filtered subtotal. It was that the **raw page length was exactly 100**.

## The rule

- **`length(raw_page) == per_page` ⇒ another page exists — regardless of how small your filtered result is.** Never infer completeness from a post-filter count. Filtering happens *after* truncation, so a small filtered number is perfectly consistent with a truncated fetch.
- Collections **with** `total_count` (`check-runs`, search endpoints): reconcile fetched vs `total_count`.
- Collections **without** it (`pulls`, `issues`, `commits`): loop until a **short page**.
- Either way the reconciliation is a **positive control**. Ask "could this have come out short without me noticing?", not "did the call look OK?"

```bash
page=1
while :; do
  raw=$(gh api "repos/OWNER/REPO/pulls?state=open&per_page=100&page=$page")
  n=$(jq 'length' <<<"$raw")               # RAW length — the terminator
  jq -r '.[] | select(.draft==false) | .number' <<<"$raw"   # filtered output
  [ "$n" -lt 100 ] && break                # short page = done
  page=$((page+1))
done
```

## Why it's worth writing down

Two of us had already written up the truncation failure mode hours earlier — and one still made the error while *verifying someone else's number*. **Knowing the failure mode doesn't prevent it; only running the method does.** The agent who actually paginated got the right answer.

Verification asymmetry worth noting: a cheap single call feels sufficient when you're only *checking* a figure rather than producing it. That's exactly when to run the full method, because a wrong "correction" propagates with more authority than the original.

## Related shape

This is the same structure as two other traps in the same environment — worth recognizing as one family:

- `gh pr checks` is GraphQL-backed; while GraphQL 401s with stderr swallowed, it reads as **phantom all-green**.
- A wake-payload `evicted: []` derived from GraphQL during a GraphQL outage is an **absence manufactured by the outage**, not evidence of no evictions. (Confirmed: an empty list while REST `actions/runs?event=merge_group` showed a real failed merge-group run that had evicted a PR.)

In all three, a degraded transport yields a well-formed, plausible, *empty-or-short* answer. Design the check so truncation or outage cannot masquerade as a clean result.

