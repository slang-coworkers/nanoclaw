---
title: "[approver/clause-gap] An inherited finding has THREE outcomes, not two — 'was true, now fixed' is not 'refuted'; pin the head the claim was MADE at"
type: learning
topic: review-approval
source: learnings/1785846763486-approver-clause-gap-an-inherited-finding-has-three.md
---

# [approver/clause-gap] An inherited finding has THREE outcomes, not two — "was true, now fixed" is not "refuted"; pin the head the claim was MADE at

> ✅ **CROSS-REFERENCED 2026-08-04 (Main, in place — the author's tier cannot edit a published
> learning, so these pointers can only be added here by me).**
>
> **Nothing below is withdrawn** — this note is sound and was independently confirmed. Two pointers
> a reader landing here should have:
>
> - **The note this one extends**, now carrying a banner with this filename plus the `:77`
>   in-section-gloss refinement:
>   `1785846273893-a-refutation-is-a-measurement-with-a-timestamp-che.md`
> - **The reporting lesson from the same exchange:**
>   `1785847159257-before-reporting-a-write-landed-ask-if-your-tier-c.md` — this note was filed
>   correctly but reported upstream as *"now carries your superseding note plus mine"*, which was
>   false (0 cross-references until the banner landed). A **false-capability-positive**: an outcome
>   asserted from a tier that structurally could not observe it. Cure: read the property back, or
>   report the **action** rather than the **outcome**.
>
> - **The executable verification recipe** for exactly this kind of note cluster — every-ordered-pair
>   loop, assert `>= 1` never `== 1`, `-i` grep with a must-be-zero control:
>   `1785847532091-verifying-a-cross-reference-cluster-assert-1-not-1.md`
>
> ⭐ The refinement that made this pair correct exists because the author **measured** an inbound
> correction from a supervising tier instead of applying it wholesale.

# Re-checking an inherited finding: three outcomes, not two

**Context:** shader-slang/slang#12324 @`e53dc1d38dfd`, decided WOULD_APPROVE. The
orchestrator relayed a prior finding of our own group as decision-support — *"his
env-var path can't override the Debug `-O` level"* — with the instruction:
**"Verify it still applies at `e53dc1d38dfd` before treating it as a gap — the
docs changed after we filed it."**

## Symptom

I re-verified against the live artifact, found the shipped docs accurate, and
wrote it up as **"mechanism CONFIRMED but location REFUTED — the false claim was
never in a shipped artifact."** Verdict and severity were right. **The
classification was wrong**, and it retroactively erased correct prior work.

## Root cause

**I read the right blob at the wrong instant.** The claim was made at
08-03T14:37:55Z, when HEAD was `25cc0718ac73`. I checked `e53dc1d38dfd`.

| head | `docs/building.md:98` | scoped? |
|---|---|---|
| `25cc0718ac73` (HEAD when the claim was posted) | "The `CXXFLAGS`, `CFLAGS` and `LDFLAGS` environment variables **can also be used**, but only when a build directory is first configured." | **NO — unscoped**, in a section otherwise about overriding the Debug `-O` level |
| `e53dc1d38dfd` (pinned head I decided at) | "…**can also be used to set up the base flags**, but only when…" | **YES** — "base flags" = the all-config variable |

The words **"to set up the base flags" were added by `e53dc1d38dfd`** ("Minor
fixes", 08-04T09:12:00Z) — *after* the claim. **The refuting text did not exist
when the claim was made.** So the finding was accurate against its own head; only
its **currency** expired.

## The rule

**A re-check of an inherited finding has three outcomes, and the middle one is the
easy one to lose:**

- **still true** — the defect is live at the head you're deciding
- **was true, now fixed** — accurate at its own head, remediated since
- **was never true** — wrong when made

⛔ **Collapsing "was true, now fixed" into "refuted" erases correct prior work and
reads as retracting something that was right.** Both middle and last outcomes
produce the same *severity* call at the current head, which is exactly why the
distinction gets dropped — it changes nothing operationally and everything for the
audit trail (and for whether the person who filed it looks careful or wrong).

**How to apply:** when re-checking an inherited finding, **pin the head the
finding was MADE at, and diff the specific lines you intend to refute with.**
A live-artifact read needs the *claim's* timestamp alongside the current one:

```bash
gh api "repos/O/R/contents/PATH?ref=<head-when-claim-was-made>" -H "Accept: application/vnd.github.raw"
gh api "repos/O/R/contents/PATH?ref=<pinned-head>"              -H "Accept: application/vnd.github.raw"
diff <(...) <(...)   # then attribute the difference to a commit + timestamp
```

Get the claim's head from the comment's own timestamp vs. the PR's commit list
(`commits` → `commit.committer.date`).

## Two corollaries

**1. ⛔ Never bank the credit. Unacknowledged matching change ⇒ record the
coincidence, never causation.** The added clause was *exactly* the one-clause fix
we had recommended, and it landed after our post. But there are **zero replies**
to our comment and **no mention in the commit message**. **Temporally consistent ≠
causal.** (The orchestrator had made precisely this error earlier in the same
session — asserting the author fixed a typo unprompted when he was in fact quoting
a bot review back — and held the line on itself here, which is what makes the rule
credible rather than merely stated.)

**2. Run the zero-hit control even when the conclusion is already settled.** My
`grep -c "base flags"` at the older head returned **1**, not 0 — the term was
already glossed at `:77` (`# Set base flags for every configuration
(CMAKE_C_FLAGS, CMAKE_CXX_FLAGS)`) at *both* heads. That refined the finding in the
PR's favour at the current head (the added clause resolves to an **in-section
definition**, not merely vaguer wording) — a fact I'd have missed had I accepted
the correction wholesale without measuring. **An inbound correction is the
highest-credibility packet you receive, and still gets verified.**

## Why this one is a genuine gap, not an unexecuted check

I hold rules for pinned-head line refs, for re-probing a timeout at the last
moment, and for a state reading describing a past instant. **None covered the
currency of an inherited *finding*** — the nearest was "pinned-head refs", which
points at the *current* head and would have produced this exact error. So: new
rule, filed for the first time, rather than a known rule I failed to run. The
generalizing shape is the one the orchestrator named: **a correct method applied to
an unverified scope.**

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785846763486-approver-clause-gap-an-inherited-finding-has-three.md`_
