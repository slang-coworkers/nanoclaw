---
title: "GitHub Pagination & Count Limits — Silent Truncation, Size Caps & the 300-File Diff Cap"
type: concept
group: ci-tooling
tags: [gh-cli, github-api, pagination, total-count, size-caps, absence-claims, slang]
source_count: 9
---

# GitHub Pagination & Count Limits — Silent Truncation, Size Caps & the 300-File Diff Cap

Every GitHub collection, search, and diff read has a cap, and none of them announce it — the array simply ends, the count silently counts the wrong unit, the payload comes back empty-but-`200`, or the listing omits a live object. This page is the counting-and-completeness half of the GitHub/git instrument-limits family: `--paginate` truncation, what `total_count` actually counts, the size caps that return empty success on `search/code` and `contents`, the 300-file patch cap, and the `state=deleted` workflow the listing can never show you. Its sibling [GitHub API Error & Absence Semantics](ci-github-api-error-and-absence-semantics.md) covers the error-and-absence half (log bodies, summarizing tools, path-classed 401s, stale attempts). The measured cap table and endpoint-split defects live in [GitHub/git Instrument Limits — Caps, Silent Truncation & Endpoint Splits](../concepts/ci-github-instrument-limits.md).

## TL;DR
- **`gh api --paginate` 401s on page 2 under the OneCLI proxy and truncates silently** — the sweep gets the first 100 items and any failure past them reads GREEN. Use explicit `?per_page=100&page=N`.
- **The silence is invocation-form dependent, and exit codes ARE usable**: bare `--paginate` and `--paginate --jq` exit 1; piping into `jq` (or `2>/dev/null`) launders it. Add `set -o pipefail`.
- **Reconcile on RAW page length, not your filtered count.** `/pulls`, `/issues`, `/commits` have no `total_count` to check against; their only terminator is a short page.
- **`search/code` `total_count` counts MATCHES, not files** (`items[]` caps at 30/page) — and a count authenticates exactly one scope. Never cite a count from one scope as evidence about another.
- **`search/code` silently returns `total_count: 0` for files above ~384 KB** — biased toward the biggest files. Never use it for a denominator: search by ENTITY name, count locally with `git grep`.
- **`gh api .../contents/<path>` returns 200 with an EMPTY payload above the inline size cap** — an empty content field is not an absent string. Use `git show`.
- **The patch endpoint 406s above 300 files**, poisoning any grep-based scan of it — use `compare`, and pair every absence claim with two controls: a non-zero control on the artifact and a positive control on the pattern.
- **A `state=deleted` workflow is unlistable** — `GET /actions/workflows` omits it while still returning it by id; a `rows==total_count` bound-check passes on the incomplete set, certifying its own blind spot.
- **The cheapest detector in this whole family: what would this output look like if the thing were absent? If the answer is "the same", it is not a measurement.**

## Pagination Truncates Silently — Reconcile, Don't Trust the Call (2026-08-04 fold)

The GraphQL-401 phantom-green (a degraded transport returning a well-formed, plausible, empty-or-short answer) has a twin that bites the **REST fallback that was supposed to be the safe workaround**. Through the OneCLI GitHub gateway, `gh api "<endpoint>?per_page=100" --paginate` deterministically fails on **page 2+** with a OneCLI `app_not_connected` 401 body, while an explicit `?per_page=100&page=N` for the very same page succeeds (measured on `commits/<sha>/check-runs`, `total_count=131`: explicit `?page=2` → 6/6 OK; `--paginate` → 4/4 FAIL, emitting a second JSON doc that is the error). So the sweep silently gets the first 100 items. In one sweep 6 of 54 PRs exceeded 100 check-runs (up to 135) — exactly the big, heavily-tested PRs you least want to misjudge, and any failing check on page 2 reads GREEN ([gh api --paginate silently truncates at page 1 under the OneCLI gateway](../learnings/1785766491651-gh-api-paginate-silently-truncates-at-page-1-under.md)).

**Correction to that note — the silence is invocation-form-dependent; exit codes ARE usable.** The original write-up asserted `--paginate` produces "no non-zero exit code." That blanket claim is **wrong**, and believing it teaches the opposite of the right lesson. Measured across four forms on the same endpoint:

| form | exit | stdout |
|---|---|---|
| `gh api --paginate … --jq '…'` | **1** ✅ | 100 items **+ the error JSON leaked as a data line** (101 lines) |
| `gh api --paginate … 2>/dev/null \| jq -s '…'` | **0** ❌ | silently truncated to 100 |
| same, plus `set -o pipefail` | **1** ✅ | truncated to 100 |
| bare `gh api --paginate` (no pipe) | **1** ✅ | — |

`gh` *does* signal failure; **piping into `jq` launders it** (a pipeline reports the last command's status, and jq succeeded on the 100 items it was handed), and `.check_runs[]?` launders it a second time. Two independent silencers is why it looked like "no signal" ([CORRECTION: the --paginate silence is invocation-form-dependent](../learnings/1785766871120-correction-to-the-paginate-truncation-note-the-sil.md)).

Mitigations in order of robustness: (1) **reconcile against `total_count`** — transport-agnostic, and page 1 already carries it; (2) **don't launder the exit code** — `gh`'s built-in `--jq` or `set -o pipefail`, noting `--jq` exits 1 but stdout is *still* dirty (the error arrives as a data line), so exit-code and shape checks are complementary; (3) **validate shape before extracting** with `jq -e '.check_runs'`, reserving `?` for genuinely optional fields; (4) **explicit `?page=N` loop** with a per-page retry, failing LOUD on `__PAGEFAIL__` / `__COUNT_MISMATCH__`.

**Reconcile on RAW page length, not your filtered count** — because `/pulls`, `/issues`, and `/commits` have **no `total_count`**; their only terminator is a short page. Counting non-draft open PRs in one call returned 54, comfortably under 100, so nothing looked capped — truth was **76 non-draft of 233 open** (page 1 = 55 of 100 raw, page 2 = 20 of 100, page 3 = 1 of 33). The tell was never the filtered subtotal; it was that the **raw page length was exactly 100**. Filtering happens *after* truncation, so a small filtered number is perfectly consistent with a truncated fetch:

```bash
page=1
while :; do
  raw=$(gh api "repos/OWNER/REPO/pulls?state=open&per_page=100&page=$page")
  n=$(jq 'length' <<<"$raw")                                 # RAW length — the terminator
  jq -r '.[] | select(.draft==false) | .number' <<<"$raw"     # filtered output
  [ "$n" -lt 100 ] && break                                  # short page = done
  page=$((page+1))
done
```

Two agents had already written up this failure mode hours earlier and one still made the error *while verifying someone else's number* — a cheap single call feels sufficient when you're only checking a figure, which is exactly when to run the full method, because a wrong "correction" propagates with more authority than the original ([reconcile on RAW page length, not your filtered count — /pulls has no total_count](../learnings/1785774447673-paginate-reconcile-on-raw-page-length-not-your-fil.md)).

**The generalizable rule for every collection on this page:** ask not "did the call look OK" but **"could this have come out short without me noticing"** — and answer with a positive control (count vs server total, or loop-to-short-page). Any unreconciled paginated collection can be silently truncated. This is one family with the GraphQL-401 phantom-green and with a wake payload's `evicted: []` derived from GraphQL during a GraphQL outage (an absence *manufactured by* the outage, refuted by REST `actions/runs?event=merge_group` showing a real failed merge-group run): in all three, a degraded transport yields a well-formed, plausible, empty-or-short answer.

## `total_count` Counts MATCHES, Not Files — and a Count Authenticates One Scope (2026-08-04 fold)

`gh api search/code --jq '.total_count'` is a **match** count: a file with 3 hits contributes 3. Compounding it, `items[]` caps at **30 per page** regardless of `per_page`, so `total_count` and the rows you can see never correspond. That is the actual defect behind a 932-vs-833 discrepancy that looked like a units mismatch. The correct file count paginates and dedupes paths:

```bash
gh api --paginate 'search/code?q=repo:OWNER/REPO+path:some/dir+"NEEDLE"&per_page=100' \
  --jq '.items[].path' | sort -u | wc -l
```

This returned **786**, matching a local `grep -rl` over the same scope exactly — two independent instruments agreeing is much stronger than either alone, and worth doing deliberately when a count goes upstream to a maintainer. Three further rules from the same reconciliation: **`--paginate` on `search/code` can inject error text into your data stream** (blowing the installation rate limit appends the 403 JSON body to stdout, so a naive `wc -l` counts six lines of error as data — filter to the expected shape and treat any paginated total as a **floor** unless you confirmed the sweep completed); **pick ONE scope and never pair figures across scopes** (`/dev/null` under `docs/` = 788 files / 833 lines vs under `docs/generated/tests` = 786 / 828 — "786 files / 833 lines under `docs/`" silently pairs one scope's file count with the other's line count, and the wider scope also added false positives, two shell scripts using `/dev/null` for ordinary redirection); and **when two numbers are arithmetically impossible together, one instrument is defective — resolve it, don't bridge it** (N files with ≥1 match each forces ≥N occurrence-lines, so 932 files / 833 lines cannot both be true; "different denominators, same order of magnitude, the finding stands either way" reasons *past* the contradiction that is itself the evidence). Also: **a mechanism that explains the DIRECTION of an error is not necessarily the one that produced it** — a stale local snapshot that skewed numbers the same way fit the peer's inflated count perfectly, but that path didn't exist in their container, and accepting the direction-matching theory would have retired the real cause ([search/code total_count counts matches, not files — and pick ONE scope when citing counts](../learnings/1785791779734-gh-api-search-code-total-count-counts-matches-not-.md)).

## Size Caps Return Empty Success — `search/code` and `contents` (2026-08-07 fold)

`total_count` has a second failure mode, worse than counting the wrong unit: **`search/code` returns `total_count: 0` for files above GitHub's index cap (~384 KB) — no error, no warning, no partial-results flag.** A two-arm control on shader-slang/slang separates size from syntax: arm A `"emitOpDecorate" filename:slang-emit-spirv.cpp` → **0** from the API, **45** from local `git grep -c`; arm B `IRInterpolationModeDecoration filename:slang-emit-metal.cpp` → **1** and **1**. Arm B proves the API and query syntax work, leaving one variable: `slang-emit-spirv.cpp` is **491,551 bytes**. **The omission is systematically biased toward the largest files** — the emit-critical ones an audit must cover. Check `stat -c %s <file>`; above ~384 KB assume not indexed — `search/code` silently omits them and cannot establish a denominator ([GitHub search/code silently omits files over ~384KB — it cannot establish a denominator](../learnings/1786079543367-github-search-code-silently-omits-files-over-384kb.md)).

Hence a hard prohibition: **`search/code` cannot establish a denominator** — population counts, exhaustive enumerations, "N sites total", "nothing else does X". On a PR whose scoping argument rested on how many places read `IRInterpolationModeDecoration`, three instruments gave three wrong answers before local `git grep` gave the true 11: grepping `findDecoration<IRInterpolationModeDecoration>` → **6** (searching by *call shape* left four cast-shaped reads `(IRInterpolationModeDecoration*)dd` structurally invisible); reading six guessed-at files → **10**; "fixing" it via `search/code` by entity name silently dropped the biggest file. **That third attempt was worse than the bug it replaced, because it carried the authority of a systematic method.** Both halves are required — **search by the ENTITY** (type/symbol name, not one syntax for touching it) *and* **count LOCALLY** in a fresh checkout; either alone still yields a wrong denominator. Riders: `git grep -c` counts **matching lines, not occurrences** (use `git grep -o <pat> | wc -l` when the number is load-bearing), and if you must use `search/code`, pair every query with a **positive control** — a string independently confirmed present in the *same* file; `0` on the control means the file isn't indexed and the real query's 0 means nothing.

**Same shape on the read path: `gh api repos/<o>/<r>/contents/<path>?ref=<sha>` returns `200` with an empty (or `"none"`-encoded) content field above its inline size cap.** Neither exit code nor HTTP status flags it, so a presence check built on it — grepping a shipped hunk out of a large `hlsl.meta.slang` at a PR head — fails toward **absent**: `--jq '.content' | base64 -d | grep 'ForceUnroll'` printing no match is *indistinguishable* from a successful read of a file lacking the string. Fetch the ref and read it locally (`git fetch <remote> <ref>`, then `git show <sha>:<path>`), which cannot silently truncate; or assert the payload is non-empty before trusting a negative ([gh api contents returns empty success above the inline size cap](../learnings/1786072032077-gh-api-contents-returns-empty-success-above-the-in.md)).

⇒ ⭐⭐⭐ **The cheapest detector in this family: what would this output look like if the thing were absent? If the answer is "the same", it is not a measurement.** It catches every case on this page — a size-capped empty payload, an unindexed file, a failed `cd` making the next `grep` a false zero, a too-narrow pattern, a capped or deduped listing, a probe whose flag never reaches the pass under test.

## Getting the Right Diff: the 300-File Patch Cap, and Two Controls on Every Absence Claim (2026-08-04 fold)

GitHub's patch/diff media types **hard-fail at 300 files**, and `gh api` writes the error body into your output file:

```bash
gh api repos/O/R/pulls/N -H "Accept: application/vnd.github.v3.patch" > p.patch
grep -E '^\+' p.patch | grep -oiE '<email-regex>' | grep -c ''   # => 0   ("no PII!")
```

That `0` was worthless — a 391-file, +34524/−6378 PR yielded a **337-byte** JSON body (`"the diff exceeded the maximum number of files (300)"`, status 406), and the grep dutifully found no emails in it. **A scan of an error message looks identical to a clean scan.** Detection was the byte count: 337 bytes cannot be a +34,524-line diff. Working substitute — the `compare` endpoint has no 300-file cap (`gh api repos/O/R/compare/<sha>^...<sha> -H "Accept: application/vnd.github.v3.diff"` → 3,194,375 bytes, `grep -cE '^\+'` = 34915, matching the PR's stated +34524 ±hunk headers); `pulls/N/files?per_page=100&page=K` is the right instrument for *path* enumeration but gives filenames and counts, not line content.

**The general rule: pair every absence claim with two controls.** (1) A **non-zero control on the artifact** — `wc -c` / `grep -c ''` proving you scanned real content of the expected magnitude. (2) A **positive control on the pattern** — feed the regex a synthetic known-positive (`printf '+ contact [REDACTED-EMAIL] here\n' | grep -oiE …`); if that prints nothing, your regex is broken and the `0` means nothing. With both green the 0 hits were real; without them it was an unfalsified guess dressed as a verification. Bonus false-positive: a credential-shape grep (`sk-[A-Za-z0-9_-]{20,}`) fired twice on a **filename** inside a `diff --git` header — always print surrounding context for a secret-shaped hit before calling it a leak ([gh patch endpoint 406s above 300 files, poisoning grep scans](../learnings/1785812823235-gh-patch-endpoint-406s-above-300-files-poisoning-g.md)).

## A `state=deleted` Workflow Is Unlistable — Enumeration Certifies Its Own Blind Spot (2026-08-14 fold)

`GET /actions/workflows` omits `state=deleted` rows entirely, yet returns them by id. A rename mints a **new** workflow id and retires the old one to `deleted` (truncating its per-id run history silently), so the predecessor is reachable *only* by id or filename — never by scanning the listing. The nastiest part is that the obvious completeness check passes on the incomplete set: on shader-slang/slang the listing gave `total_count=82, rows=82, every row state=active`, so a `rows==total_count` bound-check PASSES while the deleted workflow (`287019999`, `Agentic Tests (Nightly)`, `updated 2026-06-30`) is a live object the listing never shows. So "82 rows, zero deleted → no predecessor exists" is exactly the shape of a check that certifies its own blind spot. To answer a rename question, fetch by id or by `.github/workflows/<path>.yml` directly; the listing cannot discharge it ([a state=deleted workflow is unlistable — "zero deleted in the listing" cannot discharge a rename check](../learnings/1786253658942-a-state-deleted-github-workflow-is-unlistable-zero.md), [state=deleted workflows are unlistable and the rows==total_count bound-check passes anyway](../learnings/1786253873766-state-deleted-workflows-are-unlistable-and-the-row.md)).

**Source learnings (9):**

- [gh api --paginate silently truncates at page 1 under the OneCLI gateway — a phantom-green vector on the REST fallback](../learnings/1785766491651-gh-api-paginate-silently-truncates-at-page-1-under.md)
- [CORRECTION: the --paginate silence is invocation-form-dependent — `gh` does exit 1; a pipe into jq launders it](../learnings/1785766871120-correction-to-the-paginate-truncation-note-the-sil.md)
- [Reconcile on RAW page length, not your filtered count — /pulls, /issues, /commits have no total_count](../learnings/1785774447673-paginate-reconcile-on-raw-page-length-not-your-fil.md)
- [search/code total_count counts MATCHES not files (items[] caps at 30/page); pick ONE scope when citing counts](../learnings/1785791779734-gh-api-search-code-total-count-counts-matches-not-.md)
- [gh patch endpoint 406s above 300 files, poisoning grep scans — use compare, and pair every absence claim with two controls](../learnings/1785812823235-gh-patch-endpoint-406s-above-300-files-poisoning-g.md)
- [`search/code` returns `total_count: 0` for files over ~384 KB (two-arm control: 0 vs local 45); it cannot establish a denominator — search by entity, count locally.](../learnings/1786079543367-github-search-code-silently-omits-files-over-384kb.md)
- [`gh api .../contents/<path>` returns 200 with an empty payload above the inline size cap, so presence greps fail toward "absent"; use `git show` instead.](../learnings/1786072032077-gh-api-contents-returns-empty-success-above-the-in.md)
- [a state=deleted GitHub workflow is UNLISTABLE — the listing omits it while returning it by id; a rename mints a new id + truncates history](../learnings/1786253658942-a-state-deleted-github-workflow-is-unlistable-zero.md)
- [state=deleted workflows are unlistable and the rows==total_count bound-check passes anyway — enumeration certifies its own blind spot](../learnings/1786253873766-state-deleted-workflows-are-unlistable-and-the-row.md)

_Catalog: [index](../index.md)_
