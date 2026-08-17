---
title: "Six ways a grep/count returns a false zero — and the four-leg test that makes a zero mean something"
type: learning
topic: misc
source: learnings/1785889928610-six-ways-a-grep-count-returns-a-false-zero-and-the.md
---

# Six ways a grep/count returns a false zero — and the four-leg test that makes a zero mean something

# Six false-zero mechanisms, and how to make a zero mean something

**All six were hit in a single session (2026-08-04/05, slang#12349 → slang-rhi#810) across
Main, `slang-triager`, and `slang-fixer`. Every one produced a confident, well-formed `0` that
read as "verified absent." Each was caught only by a control — or by a coworker refusing to
accept it.**

## The mechanisms

| # | mechanism | what it looks like | who hit it |
|---|---|---|---|
| 1 | **line-wrap** | `grep -c "phrase"` → 0 on a file that contains the phrase, because it wraps across lines | Main |
| 2 | **empty fetch** | `gh api ... > f.cpp` silently produced 0 bytes; every grep against `f.cpp` returned a clean 0 | Main |
| 3 | **markdown emphasis** | pattern `not written` misses `_not_ *written*` — markup sits inside the phrase | `slang-fixer` |
| 4 | **asymmetric normalization** | stripped backticks from the *haystack*, left them in the *needle* — normalizing one side of a comparison is its own defect | Main |
| 5 | **count-as-proxy-for-meaning** | `grep -c <sha>` → 0 read as "unpinned", but the doc pinned it **in prose** without repeating the sha. Instrument perfect; inference wrong | Main (caught by `slang-reviewer`) |
| 6 | **the mirror of 5** | a *hit* can't distinguish your defect from a coincidence — a `22/22` sweep hit an unrelated fix (#9038) | `slang-fixer` |

⭐⭐⭐ **5 and 6 are the dangerous pair, because no control catches them.** The measurement is
accurate; only the semantic leap fails. **Both directions of a count are semantically blind** — a
zero can't distinguish *absent* from *present-in-another-form*, and a hit can't distinguish *the
defect* from *a coincidence*. The only remedy is reading the matches, which is precisely what
counting was meant to avoid.

## Remedies for 1–4

- **Collapse before grepping prose**: `tr '\n' ' ' < f | tr -s ' '`. Fixes wrap (1).
- **Strip markup from BOTH sides**, or grep a distinctive substring that survives either form.
  Fixes (3) and (4).
- **Check the artifact is non-empty** (`wc -c`) before believing any grep against it. Fixes (2).
- **`diff` against a known-good local copy** where possible — it is the only instrument in this
  family with *no preprocessing step* to desynchronize.

## ⭐⭐⭐ The four-leg test: make a zero carry information

A bare `0` from a filter is indistinguishable from an **inert filter**. Four legs, cheap:

```bash
# 1. the invariant
jq '[.items[] | select(.conclusion != "success")] | length'          # -> 0
# 2. the INVERSE — proves the predicate actually partitions the set
jq '[.items[] | select(.conclusion == "success")] | length'          # -> 26
# 3. RECONCILE — 0 + 26 == total, so there is no unnoticed third bucket
jq '.items | length'                                                 # -> 26
# 4. the IMPOSSIBLE predicate — the decisive leg
jq '[.items[] | select(.conclusion == "not-a-real-conclusion")] | length'   # -> 0
```

**Leg 4 is what makes the case:** an impossible predicate returns the *same* `0` as the real
invariant. So without legs 2–4, the bare zero carried no information whatsoever. (Leg 4
contributed by `slang-fixer`; legs 1–3 developed jointly.)

## Bonus: store the invariant, never the tally

Same session: a PR's check-run count went **22 → 23 → 25 → 26** across four measurements in ~30
minutes (a `board-sync` job re-triggering). Every measurement was correct when taken and wrong
minutes later. Two agents each published a stale "N/N green."

⇒ **A check-run count on an open PR is a growing population, not a property of the sha.** Store
`[.check_runs[] | select(.conclusion != "success")] | length == 0` — which doesn't decay — or
stamp the tally `as of HH:MMZ`. Note `filter=latest` does **not** dedupe re-runs of the same
*name*; all are retained.

⚠️ Also: `license/cla` and other **commit statuses live on `commits/{sha}/status`, invisible on
`check-runs`** — "N checks green" says nothing about them. Two independent surfaces.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785889928610-six-ways-a-grep-count-returns-a-false-zero-and-the.md`_
