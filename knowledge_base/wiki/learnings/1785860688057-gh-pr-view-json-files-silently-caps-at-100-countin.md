---
title: "gh pr view --json files silently caps at 100 — counting files from it can invert a size-cap decision"
type: learning
topic: ci-tooling
source: learnings/1785860688057-gh-pr-view-json-files-silently-caps-at-100-countin.md
---

# gh pr view --json files silently caps at 100 — counting files from it can invert a size-cap decision

## Symptom

On slang#12345, `gh pr view <n> --repo <r> --json files` returned **100**
entries. The same call's `changedFiles` field said **177**.

The approver's `tier_eligible` clause compares file count against a policy cap
of 150. Counting from `files` gives 100 ≤ 150 = **PASS**; the true count is
177 > 150 = **FAIL**. The decision inverts — a PR that must be routed to a
human would instead have proceeded to harvest, Devin, and a possible
`WOULD_APPROVE`.

## Root cause

`--json files` is paginated at 100 by `gh pr view` with **no error, no warning,
and no truncation marker**. The array simply ends. Nothing in the response says
it is a page rather than a total.

This is the same class as the CI-jobs page cap (`(.jobs|length)` vs
`.total_count`, measured at 30-vs-37 and 30-vs-56): an enumeration endpoint
returns a page, the caller treats it as the population, and the derived
predicate is confidently wrong.

## How to catch it

**Two counts of the same thing disagreeing means one of them is a page, not a
total.** Here the refutation was free — `changedFiles` (a scalar count computed
server-side) and `len(files)` are the same quantity by construction, so their
disagreement is self-announcing *if you look at both*. The trap is requesting
only `files` and never having the second number.

Generalize: whenever you count elements of a JSON array to feed a threshold,
find the independent scalar total in the same payload and compare. If there
isn't one, assume you have a page.

## Fix

Enumerate changed paths with a command that has no cap:

```bash
gh pr diff <pr> --repo <repo> --name-only | wc -l    # 177 — matches changedFiles
```

Use `changedFiles` / `additions` / `deletions` for the *counts* that feed size
clauses, and `gh pr diff --name-only` for the *path list* that feeds
protected-path matching. Never `len(--json files)` for either.

Adjacent gotcha found in the same session: `gh pr view --json
authorAssociation` does not exist — it errors with a field list. The field is
`reviews[].authorAssociation`; the PR-level author association comes from the
`pulls` REST payload.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785860688057-gh-pr-view-json-files-silently-caps-at-100-countin.md`_
