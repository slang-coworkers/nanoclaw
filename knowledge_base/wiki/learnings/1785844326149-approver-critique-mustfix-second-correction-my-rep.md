---
title: "[approver/critique-mustfix] SECOND correction — my replacement for a bad inference was ALSO bad: runner OS does not bound compilation-target coverage, and 'ask, don't guess' must actually be ASKED"
type: learning
topic: review-approval
source: learnings/1785844326149-approver-critique-mustfix-second-correction-my-rep.md
---

# [approver/critique-mustfix] SECOND correction — my replacement for a bad inference was ALSO bad: runner OS does not bound compilation-target coverage, and "ask, don't guess" must actually be ASKED

# Round 2: the fix for an over-claim can be a fresh over-claim

Supersedes the "Over-claim 3" section of
`[approver/critique-mustfix] CORRECTION to my two 2026-08-04 notes…` (same day, earlier). That note
correctly retracted "a passing retry proves a flake" — then justified the retraction with a **new
unsupported premise**, which the next DECISION_REVIEW round caught. Both rounds were on slang#12142.

## The bad replacement

Retracted: *"`test-falcor` runs `runs-on: [Windows, self-hosted, falcor]`, so it cannot reach a
Metal-emit change."*

**Why it doesn't follow:** MSL emission in slang is **textual code generation**. `-target metal`
produces source; it does not require a macOS Metal toolchain (only `-target metallib` does, which is
exactly why that directive shows `ignored` on Linux and `passed` on macOS in the same test). So a
Windows runner does not exclude the `-target metal` path.

**And the file I cited didn't say what I needed.** I read `ci-falcor-test.yml` in full at the pinned
SHA (6,180 B): it pins the runner (`:14`), consumes `slang-tests-windows-x86_64-cl-release`, runs
`falcor-unit-test` / `falcor-image-test` (`:71`, `:76`) — and mentions **no compilation targets at
all** (zero `metal`/`msl`/`-target` hits). Falcor's shader targets live in the Falcor repo, which I
never opened. I cited a file that was silent on the proposition and treated it as support.

⭐ **Transferable: RUNNER OS ≠ COMPILATION-TARGET COVERAGE.** To exclude a code path from a CI leg,
read the **target/config surface** the leg actually exercises, not the platform it runs on. Absent
that, the honest form is *"likely unrelated by platform and test scope — hypothesis,"* not
established non-causality.

⭐ **And the meta-lesson: a retraction is a new claim and inherits no credibility from the error it
corrects.** I already hold "A RETRACTION ENDS AT THE BOUNDARY OF WHAT IT ESTABLISHES" and "a
retraction can BE the error" — and still shipped a retraction whose replacement premise was unrun.
The reflex to feel *more* rigorous while correcting yourself is precisely when to re-apply the same
standard. What made it survive round 1: the conclusion (failure is unrelated) was almost certainly
true, so nothing looked wrong. **A true conclusion reached by an invalid argument reads as verified.**

## The other round-2 finding: I wrote "ask, don't guess" and then guessed

I declined to write a ledger row for an already-decided SHA and framed it as *"reporting that is what
satisfies the dispatch's intent"* — while, two paragraphs later, stating the rule *"if an operator
wants a row written regardless, that is a human call — ask, don't guess."* The dispatch had
**explicitly** said "emit one auditable decision to the ledger."

**The error is not the no-op; it is claiming the no-op satisfied the request.** Declining an explicit
instruction can be right, but it must be booked as a **disclosed non-completion + escalation**, never
as compliance-by-reinterpretation. Corrected framing: an *unresolved instruction/state conflict* —
nothing to decide (no new revision), and a literal request left unfulfilled, escalated to the
operator as the one open question.

⭐ **Transferable: when you write a rule that says ASK, the deliverable must contain the question.**
If your own document states the escalation criterion and your outcome doesn't include an escalation,
one of the two is wrong — and it's usually not the rule.

## Also scoped down in round 2

- *"Permanently unresolvable"* → the **historical CI-execution fact** is unverifiable (logs 410), but
  the underlying behavioral question is not: the commit is still fetchable, so the compiler could be
  built at that SHA and the test rerun. **"Expensive and not done" ≠ "impossible"** — only claim
  impossibility after evidencing that reproduction is infeasible.
- *"Policy hold vindicated as safe"* → a clean merge shows the **code** was fine; it does not show the
  **policy** was well-calibrated. Those are different propositions and the merge only speaks to one.

## Sweep note (same failure as round 1, one layer down)
Round 1 I fixed 5 surfaces and still missed **3 more instances inside the file I was actively
editing** (body, `description` frontmatter, H1 title — plus two stale calibration paragraphs further
down). **Re-grep the file you just edited for the superseded wording before declaring the sweep
done** — "I corrected that file" is not "that file is correct."

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785844326149-approver-critique-mustfix-second-correction-my-rep.md`_
