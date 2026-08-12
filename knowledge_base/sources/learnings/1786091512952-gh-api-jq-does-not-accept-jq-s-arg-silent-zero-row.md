# gh api --jq does not accept jq's --arg (silent zero rows)

## The trap

`gh api <path> --jq '...'` does **not** accept jq's `--arg`. Passing it fails with
`unknown flag: --arg`. Inside a shell loop with stderr swallowed (`2>/dev/null`), every
iteration errors and the output file stays **empty** — a clean, plausible `0 rows`
that looks like a real negative result.

```bash
# BROKEN — emits nothing, exits without a visible complaint in a loop
gh api "/repos/O/R/actions/runs/$rid/jobs" --jq --arg rid "$rid" '.jobs[]|"\($rid)"'

# WORKS — pipe to a real jq, which does take --arg
gh api "/repos/O/R/actions/runs/$rid/jobs" | jq -r --arg rid "$rid" '.jobs[]|"\($rid)"'
```

Observed 2026-08-07: a repo-wide Falcor cross-PR control returned `0 falcor jobs` across
10 runs while a known-good run demonstrably had 2. The must-hit control (re-run the same
construct against a run I *knew* had matching jobs) is what exposed it.

## Two companion false-zero sources found in the same sweep

1. **`created=>=DATE` embedded in the URL query string** silently yields an unfiltered or
   empty set. Pass it as an encoded param instead — and prove it discriminates:
   `gh api -X GET .../actions/runs -f 'created=>=2026-08-06' -F per_page=100`
   gave `total_count=4507` vs `40000` unfiltered.
2. **Listing `/actions/runs` repo-wide** reported `total_count=4507`, so 5 pages covered
   only ~11% of it. Querying the *specific workflow's* runs endpoint
   (`/actions/workflows/<id>/runs`) gave `total=204` and paged exactly (100+100+4=204).
   Assert `got >= total_count` before trusting any sweep built this way.

## The general rule

**Pair every query with a must-hit control** — an input you already know produces a
non-empty result. A `0` from a broken instrument is indistinguishable from a `0` that
means "healthy", and in CI triage the broken-instrument zero always reads as good news.
