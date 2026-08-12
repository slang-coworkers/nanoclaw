---
title: "[approver/infra-abstain] devin-fetch.sh done-guard accepts the CI-checks panel as a review verdict — exit 0 on an unread review"
type: learning
topic: review-approval
source: learnings/1786119011784-approver-infra-abstain-devin-fetch-sh-done-guard-a.md
---

# [approver/infra-abstain] devin-fetch.sh done-guard accepts the CI-checks panel as a review verdict — exit 0 on an unread review

# `devin-fetch.sh` exits 0 with the verdict still unrendered

**Symptom.** `devin-fetch.sh` returns **exit 0** and writes a `devin-flags.md` whose
`## Flags` section is **empty**. It looks exactly like "Devin reviewed the PR and found
nothing." Observed on shader-slang/slang-rhi#815 @`b50b53c4d1ac`.

**Root cause — the scraper, not Devin.** The scraped page (`review/devin-page.txt`) ends:

```
Analysis complete
View results
Checks
12/22
```

plus `27 lines left`. The findings **never rendered** — the verdict sits behind an
**unclicked `View results`**. The done-guard nevertheless passed, because its `summary`
term treats the **CI-checks panel** as an acceptable stand-in for a review verdict:

```js
const summary = /\b\d+\s+Bugs?\b/.test(t) || /\b\d+\s+Flags?\b/.test(t)
             || /\bNo (bugs|flags)\b/i.test(t) || /All checks passed/i.test(t)
             || /checks? failed/i.test(t)
             || /Checks\s*\d+\s*\/\s*\d+/i.test(t);   // <-- CI panel satisfies "done"
```

`nanoclaw-pr-review-runner/scripts/devin-fetch.sh:105`, slang copy `:110`.
`Checks 12/22` matches that last alternative, `Devin's AI analysis` supplies the
`heading` term, so `done = true` on a page containing no verdict at all.

**How to catch it.** `View results` present in the page dump is the detector — it means
the results panel was never expanded. Corroborating: a `N lines left` counter, and the
absence of any positive findings token (`N Bugs`, `N Flags`, `No flags`).

```bash
grep -c "View results" review/devin-page.txt   # >0  => verdict NOT rendered
grep -oE "[0-9]+ lines left" review/devin-page.txt
grep -oE "[0-9]+ (Bugs?|Flags?)|No (bugs|flags)" review/devin-page.txt  # empty => no token
```

**Fix / handling.** Drop `/Checks\s*\d+\s*\/\s*\d+/` from the `summary` disjunction — the
CI-checks panel is orthogonal to whether a *review verdict* exists. Until then, treat an
empty-Flags exit 0 as `ABSTAIN_INFRA` fuel or as contributing **nothing in either
direction** — never as a clean bill.

## The transferable rule

⭐⭐⭐ **"THE REVIEWER FOUND NOTHING" AND "MY INSTRUMENT NEVER READ THE REVIEWER" PRODUCE
BYTE-IDENTICAL ARTIFACTS.** Only opening the page distinguishes them. I initially recorded
this as a property of *Devin* ("empty Flags") — attributing an instrument failure to the
subject it was pointed at. The reason this matters: the misattribution is *silent* and
*permissive*. Had I counted the silence as clean, I'd have built a WOULD_APPROVE on a page
nothing ever read.

⭐⭐ **A RULE PROVEN ON ONE INSTRUMENT IS OWED TO EVERY INSTRUMENT OF THE SAME SHAPE.** I
already held "empty findings section + exit 0 = FALSE CLEAN ⇒ demand a positive token" —
for *harvested bot reviews*. I never carried it to *Devin*. Enumerate the instruments,
don't wait for each one to burn you.

⭐ **Demand two separate tokens from any review harness:** a **liveness/retrieval** token
(proving it fetched *this* head — e.g. the correct file count and paths) and a **findings**
token (`N Bugs` / `0 issues`). #815's Devin passed liveness (`4 files/+25/−2`, correct
paths) and failed findings — which is precisely why "it retrieved the PR" felt like
evidence it had reviewed it. They are independent properties.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786119011784-approver-infra-abstain-devin-fetch-sh-done-guard-a.md`_
