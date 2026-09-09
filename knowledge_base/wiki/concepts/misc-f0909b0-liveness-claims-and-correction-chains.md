---
title: "Liveness Claims, Closure Claims, and the Correction-Sign Heuristic"
type: concept
group: misc
tags: [approver, liveness, sha-stamping, corrections, self-serving-bias, use-after-free, refptr, slang-rhi-821]
source_count: 7
---

## TL;DR

The multi-round slang-rhi#821 chain (a use-after-free in specialized-pipeline resolution,
reviewed across #821→#825 as the author landed a rapid series through the reviewed area)
produced a tightly coupled set of durable rules about *time-perishable claims* and *the
direction of corrections*. Two agents corrected each other repeatedly, several corrections
were themselves wrong, and the net verdict (`ABSTAIN_POLICY:OPEN_GAP`) held across every round.

Durable rules:

- **A liveness claim is a claim about a HEAD, not about a defect.** Its shelf life is measured
  in COMMITS, not insight. Stamp every claim with the SHA it was resolved against ("live at
  `<sha>`"); bare "live on main" silently converts a measurement into a standing assertion.
  Bind the check to the *sentence you are about to write* — typing "live"/"fixed"/"still"
  triggers `git fetch && git rev-parse origin/main`; agreeing with the principle is not
  instrumentation.
- **"Fixed" and "currently unreachable by the call graph" are different claims.** A race
  closed by a *caller's* lock over an unchanged unsafe representation is a **narrowing** that
  returns the moment the lock is relaxed. A closure claim needs its MECHANISM named as
  precisely as a liveness claim needs its HEAD named.
- **A file's absence does not imply a symbol's absence.** `git show <ref>:<file>` settles it;
  a later refactor that moves a symbol into a new file makes "the file didn't exist" true and
  "the symbol didn't exist" false.
- **"Strong ref dropped" is half a UAF argument** — the other half is the consumer's storage
  type. Demand it in both directions, including when you are the one dismissing.
- **Voiding part of a reversal's basis returns you to *unknown*, not to the draft verdict.**
- **Check the SIGN of a batch of independent corrections.** Uniform direction (all shrinking
  *or* all enlarging) is the *alarm*, not the conclusion — a self-serving direction screens a
  batch but never substitutes for per-leg verification. A mixed-sign set carries zero
  directional information. The correction you are least able to leave unchecked is the one
  that *praises* you: only you can refute a claim about your own work, and you alone have no
  incentive to.

## The perishability of a liveness claim

The verified UAF mechanism (two threads miss the same `PipelineKey`, both create, the second
store drops the first `RefPtr`, the consumer's command holds a dangling raw `ComputePipeline*`)
ages well because it is read from code. What ages in *minutes* is which commit it is true of.
On a fast-moving series the approver wrote "the gap is LIVE on `main`," then ~90 minutes later
`main` had advanced past #822/#823/#824 and two of three legs were fixed upstream — and it had
written the "re-resolve HEAD" rule earlier in the very same file. A liveness claim has a
durable half (mechanism) and a perishable half (which HEAD); treating the second as inherited
from the first is the error. Stamp the SHA; the check must be bound to the decision point, not
held as a belief
[a defect's liveness is a claim about a HEAD](../learnings/1786383205217-approver-clause-gap-a-defect-s-liveness-is-a-claim.md).

By round 4, both the approver and a peer had shipped wrong liveness claims in *opposite*
directions from sound underlying verifications — the approver's "✅ FIXED by #823" and the
peer's "verified live," each stale within ~90 minutes. The sharp reframing: **"Fixed" and
"currently unreachable by the call graph" are different claims.** #823 added a device-wide
`m_pipelineResolutionMutex` correctly placed above the serial/parallel branch — but the unsafe
representation (raw pipeline pointer, cache as sole owner via a dropping store) is byte-for-byte
unchanged, so the race returns the moment the lock is relaxed for throughput, and `Serial` is
the default while `Parallel` is documented "Experimental." Report *unreachable-by-call-graph*,
never *fixed*, when the representation still permits the bug
[a liveness claim carries its HEAD; a closure claim carries its mechanism](../learnings/1786384831717-liveness-claims-carry-their-sha-slang-rhi-821-roun.md).

The round-5 amendment closed the loop on *citations*: a `task-pool.cpp:12-15` quote was stale
in the exact way the author had just corrected — the mechanism was verified at HEAD but the
supporting quote came from memory (#825 had rewritten the comment). **A line-number citation
is a claim about a HEAD, exactly like a liveness claim**; when the tree is moving, re-fetch
*every* quoted line at the SHA you name, not just the load-bearing ones. Prose quoted from a
prior read is a stored figure. The single countermeasure that binds all three right-rule-wrong-scope
instances: bind the check to the sentence, not the principle — the re-resolve rule fires when
you type `git fetch`, not when you type "live on main"
[bind the check to the sentence you are about to write](../learnings/1786385394025-liveness-claims-carry-their-sha-slang-rhi-821-roun.md).

## The correction chain: how the reversals corrected each other

The chain of corrections is itself the lesson, so it must be read in order rather than
pattern-matched. The first correction to the reversal asserted two things as verified fact —
that the UAF was "unestablished" (cache stores `RefPtr`, so an overwrite drops *a* strong ref,
not necessarily the only one) and that "the mechanism spans two commits" (`resolvePipelines`
allegedly absent at the pin). It also flagged the correct standing infra note (the
record_decision success-string-then-denied trap)
[first correction — later retracted](../learnings/1786368699421-approver-reversal-slang-rhi-821-correction.md).

The approver's amendment did the consumer-side check the original filing had skipped and
established the UAF: `commands::SetComputeState::pipeline` is a raw `IComputePipeline*`,
`CommandList::write` retains only the *virtual* pipeline, `resolvePipelines` overwrites
`cmd.pipeline` unretained, and the cache is sole owner — so the concrete pipeline's only strong
reference is the cache entry a racing store overwrites. It also proved the mechanism did *not*
span two commits (`git show ffa3663180b1:src/command-buffer.cpp` shows `resolvePipelines` at
`:939`) — a file's absence does not imply a symbol's absence. Crucially it noted both offered
corrections pointed toward *downgrading* its finding, the flattering-correction shape, and that
a verification pass is evidence, not authority — score it by whether its citations resolve
[the amendment — rule stands, two instances need correcting, and two offered corrections were themselves wrong](../learnings/1786369057072-approver-challenger-miss-amendment-to-the-slang-rh.md).

The corrector then fully retracted and replaced its own atom: both its objections were wrong
under re-verification at the pin. "`resolvePipelines` does not exist at the pin" was false (the
sub-fact that `pipeline-resolver.{h,cpp}` are new in #822 was "true and irrelevant" — #822
merely *extracted* a method that already existed). The UAF was established at both refs. What
stood: `m_compiledShaders` is fixed upstream by #822's `m_compileMutex`, and the adopted
reporting rule "re-resolve HEAD before any present-tense live-on-main claim." The durable
generalization it drew: **a correction that SHRINKS someone else's finding gets less scrutiny
than the finding did** (right ⇒ you look rigorous, wrong ⇒ the claim was theirs); the detector
is to check the SIGN of your batch of corrections — uniform self-serving direction is the
signal
[retraction + replacement, supersedes the earlier correction](../learnings/1786370440697-approver-reversal-slang-rhi-821-correction.md).

The reconciled-final atom is the one to read instead of the two earlier approver atoms: discard
the amendment's framing of the UAF as "reached the right conclusion on too little evidence" —
the objections were retracted by their author, and the ownership chain is fully established by
three independent readings. The original finding was correct; only its *filing rigour* was
deficient, and "filing rigour" and "truth" are separate axes ("not yet argued" and "not true"
need different words). The mirror rule: **the correction you are least able to leave unchecked
is the one that praises you** — a retraction that arrives with explicit credit ratifies a claim
only you can refute and you alone have no incentive to
[reconciled final — the UAF is fully established, and the durable rule is the correction-sign heuristic](../learnings/1786370674780-approver-challenger-miss-reconciled-final-slang-rh.md).

## Why OPEN_GAP, not BLOCK

Across every round the verdict correctly never moved. The ownership chain is proven, but the
*precondition* — whether concurrent single-device encoding is a supported pattern — is
undocumented (`command-list.h:384` states an *intent* to allow parallel encoding without
specifying whether one device may be encoded from two threads; the only nearby statement is
`docs/error-handling.md:63` about callbacks). The original clearance was wrong for reading that
silence as "unreachable"; a BLOCK would have been wrong for reading it as "specified." **Silence
in a contract is evidence for neither side — it is the reason a human must decide.** And the
#821 record's written follow-up condition ("the next PR must land per-key in-flight state plus a
concurrent same-key regression test, and must be GATED on it") paid off: #823/#824 landed
exactly that, and a later round could *check* the bound instead of re-deriving it — write the
trigger condition into the durable record, not just the verdict.

**Source learnings (7):**

- [A defect's LIVENESS is a claim about a HEAD, not about the defect — stamp the SHA](../learnings/1786383205217-approver-clause-gap-a-defect-s-liveness-is-a-claim.md) — highest risk on a rapid PR series; a clearance-converted-to-a-bound is the artifact that pays off; a true compliment about past work can carry a false current-state claim.
- [Correction to the challenger-miss (first) — verifies the reversal's four citations, some wrong](../learnings/1786368699421-approver-reversal-slang-rhi-821-correction.md) — later retracted; introduces the "mechanism spans two commits" charge (false) and the standing record_decision infra note.
- [Amendment — the rule stands, two instances need correcting, two offered corrections were themselves wrong](../learnings/1786369057072-approver-challenger-miss-amendment-to-the-slang-rh.md) — establishes the UAF via the consumer-side raw-pointer check; a file's absence ≠ a symbol's absence; verification is evidence not authority.
- [Retraction + replacement — supersedes the earlier correction; discard its legs 2 and 3](../learnings/1786370440697-approver-reversal-slang-rhi-821-correction.md) — the corrector was 2/3 wrong; a downgrade-shaped correction gets less scrutiny; check the SIGN of your corrections.
- [Reconciled final — the UAF is fully established; the durable rule is the correction-sign heuristic](../learnings/1786370674780-approver-challenger-miss-reconciled-final-slang-rh.md) — filing rigour ≠ truth; the correction that praises you is the one you must check; voiding a reversal's basis returns to unknown.
- [A liveness claim carries its HEAD; a closure claim carries its mechanism (round 4)](../learnings/1786384831717-liveness-claims-carry-their-sha-slang-rhi-821-roun.md) — both directions were wrong from sound verifications; a worst-case figure can be understated by the alarm-raiser (real bound 1+K, unbounded).
- [Amended (round 5) — bind the check to the sentence, not the principle](../learnings/1786385394025-liveness-claims-carry-their-sha-slang-rhi-821-roun.md) — a stale line-number citation is a stored figure; a mixed-sign correction set carries zero directional information; count lock lifetimes not statements.
