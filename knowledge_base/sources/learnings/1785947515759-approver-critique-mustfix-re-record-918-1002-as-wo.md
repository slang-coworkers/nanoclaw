# [approver/critique-mustfix] "Re-record #918/#1002 as WOULD_APPROVE" is not bookkeeping — WOULD_APPROVE is critique-gated (DECISION_REVIEW + OUTPUT_REVIEW) while the original ABSTAIN_* rows were gate-exempt, so correcting a false-negative costs strictly more than making it did

# [approver/critique-mustfix] The correction is gated even though the error wasn't

## Symptom

I carried "re-record #918 and #1002 as WOULD_APPROVE for calibration" as a bookkeeping
item. Both re-derivations are solid — verified that under the signed `v0-shadow-wide`
policy each clears Step 1 and its Step-2 review is clean:

```
#1002 @34e5df38dddf  failed no_protected_paths on .github/workflows/wheels.yml
                     wide protects only **/slang-tag-version.h    → PASSES
                     24 lines / 2 files  ≪ 8000/150               → PASSES
                     Step 2: APPROVE, 0 bugs, 0 gaps              → WOULD_APPROVE
#918  @57259b457b4c  failed head_provenance (fork jhelferty-nv)
                     wide allow_fork_head = true                  → PASSES
                     Step 2: APPROVE, 0 bugs, 0 gaps              → WOULD_APPROVE
```

Both merged with human `APPROVED` at the head I decided, so both are agreement data.

**But reading `SKILL.md` Step 4 before acting, the asymmetry is explicit** (`:142-153`):

- `ABSTAIN_POLICY` / `ABSTAIN_INFRA` assert nothing about the code ⇒ **not**
  critique-gated. Skip DECISION_REVIEW/OUTPUT_REVIEW, call `record_decision`, stop.
- `WOULD_APPROVE` / `BLOCK` ⇒ **full critique gate**, both stages, and *"you cannot
  author or edit verdict state."*

So the original false-negatives were recorded through the **cheap, gate-exempt** path,
and correcting them requires the **expensive, gated** path. **The error was free to make
and costs a full critique round each to fix.**

## Root cause, and why the asymmetry is right but creates a trap

The gate design is sound: an abstain says "a human must look," which is safe by
construction, so gating it would only burn cycles. An approve asserts something about the
code and must be adversarially checked.

But the consequence is a **ratchet**: the system's cheapest output (abstain) is also the
one whose *errors* are hardest to walk back, and those errors are the invisible kind —
nothing alerts on a spurious abstain because caution reads as caution. So the failure
class that already lacked a detector *also* has the highest correction cost. That's the
opposite of the gradient you'd want, and it's presumably why 2 false-negatives sat
unnoticed until I built the outcome join.

Concretely, it means my to-do item was mislabelled. "Re-record for calibration" sounds
like editing a spreadsheet; it is actually **two fresh WOULD_APPROVE decisions, each
requiring DECISION_REVIEW + OUTPUT_REVIEW**, on PRs already merged. And I nearly did it
as a quiet fix — the exact "substituting a stage" error I filed earlier today, in a new
costume.

## How to catch it

Before treating any record correction as bookkeeping, read the gate rules for the
**target** state, not the source state:

```bash
grep -n -A12 "Step 4 — record" <skill>/SKILL.md      # which states are gated?
```

Falsifier: the corrected value belongs to a more strongly gated class than the value being
replaced ⇒ it is a new decision, not an edit, and the full procedure applies.

## Fix

- Treat both as **new gated decisions**, run in the normal procedure with the correct
  policy explicitly (`--policy /workspace/extra/approver-policy/APPROVAL_POLICY.json`, to
  avoid the stale per-PR pin), each with its own critique stages. Not batched, not quiet.
- **Open question for the operator, which I will not decide unilaterally:** whether
  retroactively recording WOULD_APPROVE on already-merged PRs is even desirable. It
  improves agreement statistics, but it writes a decision that no live gate ever produced,
  and a ledger that mixes live and reconstructed decisions may be worse for calibration
  than one with a known 2-row gap. **Flagging the gap may be more honest than filling
  it** — and that is a measurement-integrity call, not mine.
- Interim, costs nothing and preserves the information: record the two known false-negatives in
  my own work item with full derivation, so the gap is documented even if the ledger
  keeps it.

**Method note:** I was one step from performing a gated write as an ungated cleanup. What
stopped it was reading the procedure for the state I was moving *to*. The generalizable
form: **a correction inherits the ceremony of its destination, not of its origin.**

Siblings: "clause-eligible is not approvable"; the ABSTAIN-vs-merged join entry; "a
retraction is not self-verifying."
