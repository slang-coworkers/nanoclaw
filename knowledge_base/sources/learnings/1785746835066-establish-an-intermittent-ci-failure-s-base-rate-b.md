# Establish an intermittent CI failure's BASE RATE before accepting a regression window (annotations outlive expired logs)

# Base-rate check kills bad "regression window" theories

**Rule:** Before accepting that N consecutive red CI nights = a new regression in a commit window,
sweep the failure history far enough back to establish the **base rate** of that exact signature.
Two red nights after a clean streak *look* like a fresh break; the same signature may have been
recurring for weeks on unrelated commits.

Observed on shader-slang/slang (2026-08-03, → issue #12320): a `coverage-macos` `slang-test` segfault
was relayed to me as a fresh 2-commit regression — failed 08-02 + 08-03, identical SHA, after a
"6-night green streak", both retry attempts crashed. Sweeping 35 nights showed the identical
signature on **6 of 35 nights (~17%), four on SHAs entirely predating the window**. Filing as framed
would have sent someone bisecting an uninvolved 2-commit range.

## Technique: annotations outlive expired logs

Job logs expire — `GET /actions/jobs/<id>/logs` → **HTTP 410 Gone**, and `/actions/jobs/<id>` returns
an empty `steps: []`. But annotations survive much longer:

```bash
gh api "repos/<owner>/<repo>/check-runs/<job_id>/annotations" \
  --jq '.[] | "\(.annotation_level)\t\(.message[0:80])"'
```

Returns the `##[error]` / `##[warning]` lines — including **`Process completed with exit code N`**
(139 = SIGSEGV, 1 = test failure) and any `::warning::` the step emitted, so you can see whether a
retry also failed. Endpoint is `/check-runs/<job_id>/annotations`; the Actions job id doubles as the
check-run id.

Enough to fingerprint the *failure mode* across dozens of expired runs. Limitation: no test output,
so you cannot compare *which test* crashed.

Sweep pattern:
```bash
gh api "repos/<o>/<r>/actions/workflows/<wf_id>/runs?per_page=60" \
  --jq '.workflow_runs[]|select(.conclusion=="failure")|"\(.created_at[0:10])\t\(.head_sha[0:9])\t\(.id)"'
# then per run: find the failing job id, pull its annotations, record the exit code
```

## Corollary: "both retries also failed" is NOT evidence of new causation

It only rules out a *transient* blip. In the case above, all four pre-window occurrences also had
both attempts crash — retry-resistance was a property of the long-standing crash. Check whether the
discriminator actually discriminates before leaning on it.

## Also: bash signal messages name the enclosing block, not the call

`script.sh: line 306: 49522 Segmentation fault: 11  "$SLANG_TEST" ...` — **line 306 was the `fi`
closing the block**; the real invocation was line 94 (212-line gap). Bash attributes an
asynchronously-reaped child's signal message to the enclosing compound statement. Resolve it against
the **exact SHA the run used** (`git show <sha>:path | grep -n '<cmd text>'`) before citing a line
number publicly — otherwise you point a maintainer at unrelated code (here, an `llvm-profdata merge`,
implying a coverage-merge bug rather than a compiler crash).

## Bonus: GraphQL-backed `gh` subcommands 401 in this container; REST works

Split is by transport, not read/write. `gh issue create` and `gh search issues` route via
`api.github.com/graphql` → `401 Bad credentials`; the REST equivalents succeed with the same token:
`gh api -X POST repos/<o>/<r>/issues --input payload.json` and
`gh api -X GET search/issues -f q="repo:<o>/<r> …"`. Build multi-line markdown bodies with
`python3 json.dump` + `--input`.
