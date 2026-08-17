---
title: "[approver/clause-gap] 'Clause-eligible' is not 'approvable' — I let a Step-1 fix imply a Step-2 outcome and it propagated to an operator; #925's review verdict is REQUEST_CHANGES with 2 gaps, so the spurious clause changed the REASON, not the decision"
type: learning
topic: review-approval
source: learnings/1785944803906-approver-clause-gap-clause-eligible-is-not-approva.md
---

# [approver/clause-gap] "Clause-eligible" is not "approvable" — I let a Step-1 fix imply a Step-2 outcome and it propagated to an operator; #925's review verdict is REQUEST_CHANGES with 2 gaps, so the spurious clause changed the REASON, not the decision

# [approver/clause-gap] A fix to one stage does not predict the outcome of the next

## Symptom

Having found that slangpy#925's `CLAUSE_FAIL:no_protected_paths` was spurious (the
run loaded `v0-shadow` instead of the human-signed `v0-shadow-wide`), I wrote — and my
orchestrator relayed to an operator — that **"#925 was WOULD_APPROVE-eligible under the
signed policy."** It then generalized: *"Same for #1078 (both heads) and #918."*

Both claims are wrong. Reading #925's actual Step-2 input,
`work/925-4743d90ff367/review/review-doc.md`:

```json
{"_approver_result": true, "verdict": "REQUEST_CHANGES",
 "bugs": 0, "gaps": 2, "reviewers_complete": true,
 "source_tier": "fallback-coderabbit-head-current-plus-devin"}
```

**The review verdict is `REQUEST_CHANGES` with 2 open gaps.** Passing Step 1 only means
Step 2 *runs*. With the correct policy loaded, #925 proceeds into the verdict parse and
lands on **ABSTAIN_POLICY:OPEN_GAP or BLOCK** — on the substance: gap 1 is the confirmed
`SLANGPY_VERSION_OVERRIDE` regression (`wheels.yml:25` shadowing `:133` on Linux), gap 2
is the missing trigger-present control on a `workflow_dispatch`-only wheel path.

Corrected statement: **the abstain was recorded for the wrong reason, not for no
reason.** Same outcome, sound derivation instead of an artifact.

## Root cause

The decision procedure is a **pipeline of gates**, and I reasoned about it as if the
first gate determined the result. "Eligible" is a statement about *reaching* the next
stage, never about passing it. `pass` on all Step-1 clauses is necessary and nowhere
near sufficient.

Why it slipped through: I had spent nine rounds establishing the clause defect, so the
clause was the salient object, and its removal *felt* like it removed the abstain. The
phrase "WOULD_APPROVE-eligible" is technically defensible and reads as a verdict — the
legibility failure filed earlier in this chain, now in my own output: **the crisp phrase
outcompeted the accurate one.**

Worst consequence, and the reason this needed catching mid-flight: it invites the reader
to conclude *"so the approver would have approved a PR with a known one-line
regression."* That is the opposite of true, and it is exactly the claim that gets a
shadow-mode measurement program shut down. A false statement in the *permissive*
direction about my own judgment is the most expensive kind I can emit.

The generalization to `#1078`×2 and `#918` compounded it: each has its own review doc
and its own verdict. Inferring three outcomes from one clause state is the same error,
multiplied.

## How to catch it

Never report a re-derived outcome from clause state. Read the next stage's input:

```bash
python3 - <<'EOF'
import re,json
s=open("work/<pr>-<sha12>/review/review-doc.md").read()
for m in re.finditer(r'```json\s*(\{.*?\})\s*```', s, re.S):
    d=json.loads(m.group(1))
    if d.get("_approver_result"): print(d["verdict"], d["bugs"], d["gaps"])
EOF
```

Falsifiers: (1) `verdict != APPROVE`/`APPROVE_WITH_NITS` ⇒ no clause fix can yield
WOULD_APPROVE; (2) `gaps > 0` ⇒ Step 3 judges severity, so the outcome is open, not
approve; (3) any statement of the form "fixing stage N makes this X" where X is decided
at stage N+1 ⇒ unsupported by construction.

Vocabulary discipline: say **"would have reached Step 2"**, not "would have been
approved" / "was approvable" / "was WOULD_APPROVE-eligible." The last one is the trap —
it contains the verdict token, so readers extract the verdict.

## Fix

- #925: the abstain **stands on the substance**; only its reason code was spurious.
  Re-derivation yields `ABSTAIN_POLICY:OPEN_GAP` or `BLOCK`, not `WOULD_APPROVE`.
- `#1078` (both heads) and `#918`: outcomes **unknown** — each needs its own Step-2
  read before anyone quotes a result. Withdrawn from the relayed claim.
- Standing rule: **when correcting a defect at stage N, report the corrected
  *derivation*, never the corrected *outcome*, until stage N+1 has actually been run.**
  A pipeline's stages are not substitutable, and the reason a decision was right is
  itself the deliverable in an auditable procedure.

**Method note:** this was caught by reading my own review doc *because* an operator was
about to act on the phrase. The trigger worth internalizing is not "was I careful" but
**"is anyone about to act on this, and does the artifact say what I said it says?"** —
the same shape as reading the loaded policy rather than a copy.

Siblings: the legibility entry (a false mechanism that's easier to say outcompetes a
true one); the 21→4 over-call correction; "a status value is an interface, not a
description."

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785944803906-approver-clause-gap-clause-eligible-is-not-approva.md`_
