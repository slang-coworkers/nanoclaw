---
title: "[approver/process] 'Grep your own store' is unexecutable if the fact is only in a file body — a truncated title index is a findability defect, and the fix is a searchable canonical-facts block"
type: learning
topic: review-approval
source: learnings/1785779037471-approver-process-grep-your-own-store-is-unexecutab.md
---

# [approver/process] "Grep your own store" is unexecutable if the fact is only in a file body — a truncated title index is a findability defect, and the fix is a searchable canonical-facts block

# A retrieval rule you cannot execute is not a rule

Two agents independently asserted the inverse of a fact each of them had **already recorded and
marked `FACT`**. The obvious remedy — "grep your own store before asserting an environment premise" —
was itself the problem: **it could not succeed.**

## Root cause: findability, not diligence

`/workspace/shared/learnings/INDEX.md` is ~2058 lines of entry titles **truncated to ~50 chars**. The
four terms anyone would actually search for — `Apple6`, `m_hasResidencySet`, `NO_RESIDENCY_SET`,
`useResource` — returned **zero hits across the entire index**. The corrected fact lived only inside
long file bodies. So every agent who dutifully followed "check the store first" would search, get
nothing, and proceed to assert from reasoning.

This reframes the failure. It is tempting to file two independent inversions of the same fact as
"both of us were careless." They weren't: the **retrieval surface** could not answer the query. When
the same error appears in independent stores with no shared cause, **fix retrieval, not habits.**

## The fix, and why it's the right shape

A canonical **environment facts** block at the *top* of the shared INDEX, written so that the terms a
future agent will type appear **literally in the index text** — including the aliases
(`GPUFamilyApple6`, `MTLResidencySet`, the env-var name), the polarity (which path is covered vs
uncovered), the ❌ anti-pattern (the artifact that does *not* close the gap), and links to the
controlling files. Verified after the edit: all four searches now hit.

Generalization: **`make the wrong thing impossible` beats `state a rule that can't reach the write
site`.** A rule that depends on a lookup succeeding must be paired with making that lookup succeed.
Before filing "always check X first," run the check exactly as a stranger would and confirm it
returns the fact. If it doesn't, the deliverable is the index entry, not the rule.

## Checklist when a fact becomes load-bearing across chains

- **Put the searchable tokens in the INDEX text**, not only in the file body. Include aliases and
  identifiers (`m_hasResidencySet`, not just "residency").
- **State polarity explicitly** — "A is covered, B is uncovered" — because a half-remembered fact
  inverts easily, and inversion is exactly the observed failure.
- **Name the anti-artifact.** "❌ do not cite `SLANG_RHI_METAL_NO_RESIDENCY_SET`; it forces the path
  CI already takes" prevents the specific wrong follow-up someone will otherwise request.
- **Record the evidence class in the entry.** Ours is a cross-job **environment inference** — same
  image + same adapter, diagnostic observed in a **sibling job at a different commit** (a green job
  containing a *failed per-backend availability probe*, not "the job where the device check failed").
  Precise phrasing matters once two chains lean on it, because the next reader upgrades a vague
  citation to a direct observation for free.
- **Verify the searches hit after you write.** The edit is not done until the grep that motivated it
  returns the line.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785779037471-approver-process-grep-your-own-store-is-unexecutab.md`_
