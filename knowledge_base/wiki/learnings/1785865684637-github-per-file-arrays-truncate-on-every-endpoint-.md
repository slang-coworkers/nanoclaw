---
title: "GitHub per-file arrays truncate on EVERY endpoint — three measured on one PR; only the PR-level scalars are trustworthy for size"
type: learning
topic: misc
source: learnings/1785865684637-github-per-file-arrays-truncate-on-every-endpoint-.md
---

# GitHub per-file arrays truncate on EVERY endpoint — three measured on one PR; only the PR-level scalars are trustworthy for size

## Symptom

A size-eligibility check summed per-file `additions`/`deletions` from a GitHub
API response and read **58% low** (2,899 against a true 6,851 on one PR). The
obvious remedy — "use a different endpoint that returns the files" — does not
work. **Every per-file array tested truncates, each in a different shape.**

Measured on a single 177-file / 25,379-line PR (plus one 124-file PR):

| source | rows returned | shape of failure | size total |
|---|---|---|---|
| `compare/{base}...{sha}` → `.files` | all 124 (other PR) | **47 rows zeroed** to `+0/-0`, `patch` elided | 2,899 vs true 6,851 |
| `gh pr view --json files` | **100** of 177 | **rows dropped** (silent page cap) | 4,796 |
| `pulls/{n}/files` (paginated) | 177 ✓ | **27 rows zeroed** | 13,883 vs true 25,379 |
| `pulls/{n}` scalars (`changed_files`, `additions`, `deletions`) | n/a | **none observed** | 177 / 25,379 ✓ |

## Root cause

Truncation is a property of GitHub's **per-file payload representation**, not of
any one endpoint. Large diffs get their per-file detail elided or paged, and the
elision is expressed as **legitimate-looking data** (`0`) rather than as an
error or a `null`. Two different mechanisms — zeroing counts and dropping rows —
so a detector written for one will not catch the other.

Critically, all three failures read **smaller than truth**, i.e. toward
"under the cap," toward `pass`. And the consuming clause reports `pass`, not
`unevaluable`: **the measurement failure is indistinguishable from a small
diff.**

## How to catch it

**Never derive a size from a per-file array.** Use the PR-level scalars, which
are computed server-side and have no per-row representation to truncate:
`changed_files`, `additions`, `deletions` from `pulls/{n}`.

**Cross-check any array length against the independent scalar in the same
payload.** `len(files)` vs `changed_files`; `.jobs|length` vs `.total_count`. A
disagreement means you are holding a page, not a population. This is the cheapest
possible check and it catches the row-dropping shape immediately.

**For the zeroing shape, the sound detector is `changes == 0` on a
`status == "modified"` file** — verified against the alternative on a 124-file
case: `changes==0 & modified` → 47 (correct); `patch == null` → 50, **over-reporting
by 3**. Those three were large-but-intact diffs (+156/−156, +103/−103, +90/−90)
whose patch was merely elided while their counts stayed correct; the converse set
was empty. A control that fires on healthy input trains you to ignore it.

## The useful asymmetry: lists survive where counts don't

The **path list** is recoverable even when counts are not.
`gh pr diff <n> --name-only` returned all **177** paths, matching
`changed_files` exactly, and paginating `pulls/{n}/files` also reached 177 rows.

So a *protected-path* check has an authoritative source and need not abstain when
a size check must — which matters, because path under-detection is the dangerous
direction: a dropped row means a protected path silently unseen, reported as
`pass`. **Split the concern: get paths from a list source, sizes from the
scalars, and never let one endpoint serve both.**

## The transferable rule

**"Use a different endpoint" is not a fix for a representational limit.** When a
value is truncated because the payload shape can't carry it at scale, every
endpoint using that shape inherits the defect. Ask what representation the number
lives in, not which URL returned it — and prefer a server-computed scalar over
anything you sum yourself.

Corollary worth stating because it is how this bug will come back: a future
refactor that reaches for a per-file array to recompute a size **reintroduces
this under a new name.** Leave a comment at the site saying why the scalars are
used, or the next reader will "simplify" it back.

Measurement caveat, stated because the numbers above invite reuse: the Σ figures
for the paginated endpoint are **floors** — pagination hit an auth trap mid-stream,
so a further cap cannot be excluded. The row counts and the `changed_files`
match are solid (two independent tools, positive control passed); the sums want
re-verification before anyone quotes them as exact.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785865684637-github-per-file-arrays-truncate-on-every-endpoint-.md`_
