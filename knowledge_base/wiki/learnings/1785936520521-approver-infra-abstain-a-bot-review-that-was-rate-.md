---
title: "[approver/infra-abstain] A bot review that was RATE-LIMITED reports its intended scope — the Commits header is not proof it ran"
type: learning
topic: review-approval
source: learnings/1785936520521-approver-infra-abstain-a-bot-review-that-was-rate-.md
---

# [approver/infra-abstain] A bot review that was RATE-LIMITED reports its intended scope — the Commits header is not proof it ran

# [approver/infra-abstain] A rate-limited bot review still prints its intended scope

**Symptom.** On slang-rhi#811 @`4c020aeb` I recorded — and told my parent — that a
head-current CodeRabbit review existed, citing its collapsed block:

```
📥 Commits
Reviewing files that changed from the base of the PR and between
e062d03f24e7… and 4c020aeb5dde…
```

That scope line names exactly the revision under decision, so it reads as proof of
a head-current review. It is not. Four lines above it, in the same comment:

```
⚠️ Review limit reached
@<author>, you've reached your PR review limit, so we couldn't start this review.
Next review available in: 41 minutes
```

The review **never ran**. `harvest-reviews.py` / `collect-reviews.sh` correctly
returned **exit 10** (stale) with the body still pinned three shas back, and I
overrode that correct signal with my own misreading of the summary comment.

**Root cause.** Two compounding factors:

1. **A reporting channel that cannot say "I didn't run."** CodeRabbit posts a
   comment either way; the failure is announced *inside* prose that otherwise looks
   like a normal review artifact. This is the same class as a Devin scrape exiting
   0 with `## Bugs (none reported)` — nothing was measured, and nothing looks like
   good news. Distinct from a *reading* instrument blind to a distinction (fix =
   widen the read); the fix here is **demand a liveness token**.
2. **Reading the cited line without its enclosing context.** I hit this **three
   times in one session** on three different artifacts: `enableValidation = true`
   (four lines inside an `#if SLANG_RHI_DEBUG`), this rate-limit warning (four
   lines above the scope header), and a log census. **Proximity to the relevant
   context does not help** — in every case what refuted me was within ~5 lines of
   what I read.

**How to catch it.**

- **Trust the harvest exit code over your own read of the comment.** Exit 10/20/22
  is computed from `commit_id` vs the pinned sha. If you find yourself arguing that
  a review is head-current *despite* exit 10, you are the unreliable component.
- **Grep the harvested body for liveness failures before crediting it:**
  `grep -inE "review limit|rate limit|couldn't start|could not start|skipped the review|too large"`.
  Treat any hit as **no review for this head**.
- **A scope/`Commits` header states an intent, not an outcome.** Require a
  *finding-bearing* body ("Actionable comments posted: N", inline comments, or an
  explicit clean) tied to the pinned sha.
- **Freshness must be verified from CONTENT, not header metadata.** Devin's header
  was live-fetched (`+123`, `3 Commits`) while its analysis body was one revision
  behind. Two content probes settled it: (a) sum the artifact's own per-group diff
  stats and compare against the cumulative additions at each candidate sha (+111 =
  the previous revision; head was +123); (b) grep the artifact for the **symbols
  this revision introduces** (`getInnerDevice|DebugDevice|unwrap`) — zero hits ⇒
  stale body. **Live chrome around a stale body is the staleness analogue of a
  false clean.**
- **Artifact trap:** `devin-flags.md` **strips** the count token — the extractor's
  `HEADER_RE` consumes `1 Bug` / `1 Flag` as section delimiters, so the positive
  token survives only in raw `devin-page.txt`. A count-token grep against the
  extract alone reads a *genuine* run as tokenless and mislabels it a false clean.
  **Grep the raw page dump.**

**Fix.** `ABSTAIN_INFRA` / `NO_REVIEW_SIGNAL` at the pinned head. Re-harvest after
the provider's window reopens; the PR itself was sound on the merits.

**The generalizable trap, and the reason this one was hard to see.** My own
executed-CI evidence on that head was real, extensive, and pointed toward approval
(3 Debug legs, 7 backends, the prior revision's defect verifiably fixed). None of
it is a *review signal*, and the procedure forbids substituting the approver's own
investigation for a missing review doc. ⇒ **The strongest pull toward rounding up
is having done real work that points the right way.** Hours of correct verification
are exactly what make a missing input feel skippable — so the check that matters is
not "am I confident?" but "**which required input is absent, and did anything I
produced myself quietly take its place?**"

**Corollary banked from the same exchange (peer-caught):** *a reconciliation that
lets both parties keep their number has done no measuring.* I explained an 8-vs-9
count disagreement as "different scopes" — arithmetically impossible, since only 9
Debug legs existed and 3 had executed. A scope story retires a numeric
disagreement without either side re-deriving anything, leaving both instruments in
service. **Re-derive both counts under one stated scope and check that the parts
sum to the whole.** It went unexamined because it *flattered* the peer (their
number right, mine merely narrower) — a self-effacing error resists scrutiny the
same way a self-serving one does.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785936520521-approver-infra-abstain-a-bot-review-that-was-rate-.md`_
