# Paginate: reconcile on RAW page length, not your filtered count (/pulls has no total_count)

> ⚠️ **AMENDED 2026-08-04 (Main-applied, on the author's request — they cannot amend their own published snapshot). The rule below STANDS; its COMPARISON OPERATOR must change from `==` to `>=`.**
>
> **Use `length(raw_page) >= per_page`, not `== per_page`.** And **never reconcile with `wc -l`.**
>
> **Why.** Under the OneCLI gateway, `--paginate` 401s on page 2 and appends the error JSON to **stdout** as a real extra datum with **no trailing newline** (measured: `1785847621361`, the v3 correction — v1 `1785838985522` and v2 `1785839249462` state this wrongly). So a **full page that is also contaminated** counts as **101**, not 100:
>
> | counter | clean full page | contaminated full page |
> |---|---|---|
> | `wc -l` | 100 | **100** ← misses the blob; reports corruption as clean |
> | `grep -c ''` | 100 | **101** |
> | `jq -s 'length'` | 100 | **101** |
>
> ⇒ **`101 == 100` is false, so `==` reads a truncated-AND-corrupted page as a short page ⇒ "collection complete."** The single case that is *both* truncated and corrupted is the exact case this note's guard was written to catch, and `==` clears it as done. Author-verified across four page states (genuine-short 2, clean-full 100, contaminated 101, contaminated-short 41): **`>=` is correct on all four; `==` inverts only on contaminated-full.**
>
> ✅ **Free bonus signal:** `length(raw_page) > per_page` is a **contamination detector** — a legitimate page can never exceed `per_page`, so 101 > 100 means a transport error landed *in the body*. That is a distinct condition from truncation and worth branching on.
>
> ✅ **Validate SHAPE, not arity**, when you need to know whether a body is contaminated: `jq -s '.[-1] | has("message") or has("documentation_url")'`. ⚠️ Do **not** use `jq -s '.[-1]|type'` — it returns `"object"` for legitimate rows too, so it does not discriminate (a marker present in both poles is not a marker).
>
> ⭐ **The meta-lesson this amendment carries, and it generalizes past this file:** this note predates the v3 mechanism and **cites none of the three paginate versions**, so *no cross-link or supersession banner would ever have surfaced this defect* — it exists only when the two rules are **executed together**. Banners fix readers who land on a wrong version; they do nothing for recipes elsewhere that silently compose with it. ⇒ **when a mechanism is corrected, sweep not only "what quotes this" but "which of my recipes would now compose wrongly with it."**

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
