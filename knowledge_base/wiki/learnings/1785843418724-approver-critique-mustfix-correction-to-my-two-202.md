---
title: "[approver/critique-mustfix] CORRECTION to my two 2026-08-04 notes — I over-claimed a ledger-clobber mechanism and an 'execution proved' transfer; both were cut down at DECISION_REVIEW"
type: learning
topic: review-approval
source: learnings/1785843418724-approver-critique-mustfix-correction-to-my-two-202.md
---

# [approver/critique-mustfix] CORRECTION to my two 2026-08-04 notes — I over-claimed a ledger-clobber mechanism and an "execution proved" transfer; both were cut down at DECISION_REVIEW

# Correction: two claims in my 2026-08-04 notes were stronger than the evidence

Supersedes specific claims in:
- `[approver/procedure] A stale webhook dispatch on an already-joined PR is a no-op + report…`
- `[approver/infra-abstain] GitHub job logs 410 after ~5 days on slang…`

Both notes' *practical advice* stands. Two of their *justifications* did not survive an independent
DECISION_REVIEW (codex), which returned must-fix. Recording the correction because an over-claimed
mechanism propagates further than a wrong conclusion — it gets reused as a premise.

## Over-claim 1 — "re-recording would overwrite/destroy the joined human verdict"

**What I can evidence:** `record_decision` is documented idempotent per `(repo, pr, commit_sha)`
("a re-run on the same commit replaces it"), and the approver skill states **one ledger row per
`(pr, revision commit)`**. So a re-record **targets the same row** rather than appending.

**What I cannot evidence, and asserted anyway:** that the *human-verdict column* is lost. The host
`approval_decisions` store is not readable from the container (only `APPROVAL_POLICY.json` is
mounted), and `record_human_verdict` is documented to *stamp onto* the decision row — which is
equally consistent with the join surviving a decision re-write. **Could not verify by method:
filesystem search for the ledger + reading the tool and skill docs.**

**Honest form:** re-recording mutates a joined, terminal row in place with a differently-based
verdict; whether the join survives is **unknown**. Unknown is still a good reason not to test it on
your own calibration product — but it is a *different, weaker* reason than "it destroys the join,"
and it must not be quoted as the latter.

**Scope guard the reviewer was right to demand:** "stale dispatch ⇒ no-op" applies **only** when the
dispatched SHA is already decided, or the PR is terminal. It must never override an explicit
workflow instruction on an *undecided* revision — that would be scope shrinkage dressed as caution.
If an operator wants a row written for an already-joined SHA anyway, **ask**; don't silently no-op a
live request.

## Over-claim 2 — "execution established by transfer" / "the gap is now CLOSED"

I proved a test executed and passed by reading logs from a **later** run, justified by the test file
being blob-identical at the pinned SHA and at that later commit.

**The flaw:** byte-identity pins the **test input only**. The compiler differs between the two
commits — and the compiler is exactly what the test exercises. So the evidence shows *the test
passes against current master*, **not** that it passed at the decided head. I had stated that limit
in a caveat while simultaneously writing "execution was established" and "gap CLOSED" in the
headings. **When a caveat contradicts the headline, the caveat governs** — the headline was wrong.

**Correct framing:** later-run logs are *corroborating evidence*, and an exact-head execution
question whose logs have expired is **unresolved and unresolvable** — say so plainly rather than
substituting a proxy. Related and worth internalizing: an artifact whose retention window has closed
does not become provable by finding a *similar* artifact.

## What did survive, and is the more useful technique

**Settle the load-bearing question from SOURCE at the pre-PR base.** No log can answer "would this
test have passed anyway?" For slang#12142: base `4f4ec505761e` bakes `get_` into
`kCandidateCommittedMetal[]` (`:22044`) while the test asserts `is_*_triangle_front_facing` ⇒ the
checks fail without the PR. Advisory accepted: this is an **emission-path inspection**, not an
executed pre-PR compiler run, and should be worded that way. It never expires, which makes it
strictly better than a log line for an old commit.

## Over-claim 3 (same review) — "re-ran green on the same runner ⇒ flake, non-causal"

A retry passing does **not** discriminate a flake from a nondeterministic PR-caused failure — both
pass on retry. I applied a retry as evidence while holding a personal rule ("ask of any negative
observation: could it have come out otherwise?") that forbids exactly this. The failure signature
was gone (log 410; only a generic `"Process completed with exit code 1."` annotation retained).

**What actually established non-causality was SCOPE, not the retry:** the failing job
(`test-falcor`) runs `runs-on: [Windows, self-hosted, falcor]` against the Windows build, while the
PR changes Metal (MSL) accessor-name emission only — Falcor cannot invoke the `-target metal`
emitter. The co-failing `check-ci` is the aggregate gate, so it is not an independent second signal.
**Prefer "the failure is outside the changed code path, by workflow scope" over any inference from a
green retry.** Whether the Falcor failure was transient stays undetermined — and irrelevant.

## Transferable
1. **A mechanism you cannot read is a hypothesis.** Name the method that failed
   ("could not verify by method M") instead of asserting the mechanism.
2. **When your own caveat contradicts your heading, the heading is the bug.**
3. **A proxy artifact does not inherit the authority of the artifact it replaces** — state what it
   pins (here: test input, not compiler).
4. **A retry is not a control.** Establish non-causality from scope.
5. **Fix every surface, not the one the reviewer named:** derivation, memory row + its frontmatter
   and title, index, archive row, and the published learnings. The reviewer flagged 2 files; the
   superseded wording lived on 5.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785843418724-approver-critique-mustfix-correction-to-my-two-202.md`_
