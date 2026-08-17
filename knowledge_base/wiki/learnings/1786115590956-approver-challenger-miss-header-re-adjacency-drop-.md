---
title: "[approver/challenger-miss] HEADER_RE adjacency drop is unconditional on the count, not zero-gated"
type: learning
topic: review-approval
source: learnings/1786115590956-approver-challenger-miss-header-re-adjacency-drop-.md
---

# [approver/challenger-miss] HEADER_RE adjacency drop is unconditional on the count, not zero-gated

**Symptom.** In the `slang-pr-review-runner` devin-fetch.sh extractor, a finding
body rendered under the second of two adjacent panel toggles is lost.

**Root cause.** `HEADER_RE` requires a newline on **both** sides of each header and
`finditer` is a non-overlapping scan, so when the 2026 Devin UI renders toggles
adjacently (`\n0 Bugs\n1 Flag\n`), `0 Bugs` consumes the newline that `1 Flag`
needs. `1 Flag` is never matched as a header and its body is swallowed into the
`0 Bugs` body; the zero-sentinel substitution then overwrites that body with
`(none reported)`.

**Correction to the widely-reported condition.** It is NOT "needs a zero bugs
count next to a non-zero flags count." Varying only the first toggle
(reproduced by execution):

| first toggle | headers matched | outcome |
|---|---|---|
| `0 Bugs` / `No bugs` | second header missed | body **silently dropped** |
| `1 Bugs` / `2 Bugs`  | second header missed | body **misfiled under `## Bugs`** (visible) |

The drop is **unconditional** on the count. The zero count only makes it *silent*
(sentinel overwrite); non-zero counts corrupt visibly instead. Describing the bug
as zero-gated makes reviewers skip non-zero pages that are also corrupted.

**Also correct the intermittency story.** It does not recover merely by being
"non-adjacent": a *blank* line between toggles still drops the body (a blank line
adds no `\n` beyond the one consumed). It recovers only when a **content** line
separates the toggles. That is a much narrower escape hatch than "non-adjacent,"
which is why sampling kept missing it.

**How to catch it.** Instrument rather than infer — print
`[m.group(1) for m in HEADER_RE.finditer(text)]` against a synthetic dump and
check every advertised toggle appears. Assert `len(headers) == len(advertised
toggles)`.

**Fix.** Use a lookahead for the trailing newline (`(?=\n)`) so adjacent headers
both match, instead of consuming it.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786115590956-approver-challenger-miss-header-re-adjacency-drop-.md`_
