# [approver/clause-gap] An over-correction is a defect too — "the gate wouldn't have prevented it" is false with CI_GATE_REQUIRED_SUITE set: the build suite is conclusion=failure, so the host parks the wake upstream of the waived clause

# [approver/clause-gap] Correcting a misattributed mechanism can overshoot into a second false claim

## Symptom

Having established that `ci_green_on_sha` passed on slangpy#1090 via the **waiver**
branch (`"policy does not require CI green"`, `require_ci_green: false`) and not via
the blind combined-status API, my orchestrator prepared an operator correction
saying it had overstated urgency for arming `APPROVER_CI_GATE`, because *"the host
gate would not have prevented it."*

That correction is itself wrong — it holds for one gate configuration and fails for
the other. Measured at the head I decided (2026-08-05T15:27:50Z),
`slangpy#1090` @ `bb870c1750cc`, **check-suites**:

```
github-actions  completed  SUCCESS  12:37:28Z
github-actions  completed  FAILURE  12:52:11Z   ← the suite carrying 4 red build legs
github-actions  completed  SUCCESS  12:38:08Z
github-actions  completed  SUCCESS  12:40:41Z
+ 3 skipped
```

- `CI_GATE_REQUIRED_SUITE` **set** to the build suite ⇒ that suite is `failure` ⇒
  **the host never wakes the approver.** The park is upstream of every clause, so
  the waiver never gets a chance to launder anything.
- `CI_GATE_REQUIRED_SUITE` **unset** ⇒ releases on *any* successful suite, and 3 are
  green ⇒ wakes exactly as it did, red build invisible.

So the true statement is conditional: *the gate as configured today would not have
prevented it; the gate with both flags set would have.* Collapsing that to "would
not have prevented it" discards the strongest measured evidence for the
both-flags-together recommendation the orchestrator itself opened with.

## Root cause

A correction inherits none of the original claim's verification, and it needs its
own. The failure mode is asymmetric-scrutiny: the *original* claim ("the blind
clause fired") got challenged and measured; the *retraction* ("so the gate wouldn't
have helped") was accepted on the strength of the correction being welcome. Retreat
feels epistemically safe, so it is audited less than advance.

Concretely, the collapse happened by dropping a **configuration variable** —
exactly the one-variable discipline filed earlier in this same chain, applied to a
counterfactual instead of a control: "would the gate have prevented it" is
unanswerable without pinning `CI_GATE_REQUIRED_SUITE`, because the two settings give
opposite answers.

Second, related point on the same message: `require_ci_green: false` reads as a
policy bug if reported bare. It isn't. `APPROVAL_POLICY.json` (`v0-shadow-wide`) is a
**single global flag, no repo scoping**, and its `_comment` records a deliberate,
human-signed widening (haaggarwal, 2026-08-04) on measured grounds — 53% of 232
decisions were ABSTAIN_POLICY, and 91% of the abstains that later carried a decisive
human verdict were approved. It buys measurement signal in shadow mode where the
final gate is human, and is explicitly marked MUST BE RE-TIGHTENED BEFORE ANY
ENFORCEMENT. So the waiver is an **authorized tradeoff**; only the clause's reporting
of it as `pass` is defective. Reporting it without that context invites someone to
revert a flag that was set on purpose.

## How to catch it

- Before sending a retraction, **verify it like a claim**: what measurement would
  falsify *the correction*? Here, one `check-suites` call.
- For any counterfactual ("X would/wouldn't have prevented Y"), **enumerate the
  config variables X depends on** and answer per-setting. If two settings give
  opposite answers, the unconditional form is false either way.
- When citing a policy value as a defect, read its `_comment` / provenance first.
  A deliberate, signed tradeoff and a bug look identical in the JSON.

## Fix

- Report the conditional: gate-as-configured no; gate-with-both-flags yes. That
  keeps the correction honest *and* preserves the recommendation's evidence.
- Standing rule, sibling to "an accepted correction of mine does not promote the
  reasoning I attached to it": **a retraction is not self-verifying.** Over-
  correction is a defect with the same cost as the original error, and it is
  under-audited precisely because it looks like humility.
- Same through-line as the rest of this chain: the host gate fixes **timing** and
  **wrong-surface** exposure; it does not fix a **waived** clause; and the clause's
  three-outcome split (`pass` / `unevaluable` / `not_applicable`) is the only fix for
  the branch that actually fired. Three independent failure points, each passing the
  check for the other two.

Siblings: the `:184` waiver-branch entry; CI green with zero coverage of the diff;
the one-variable control rule.
