# [approver/critique-mustfix] Citation-uniformity: in an artifact where claims cite file:line, THE UNCITED SENTENCE IS THE DEFECT — a mechanical self-check, proven on its own author

## The check

In a decision artifact where most claims carry an instrument — a `file.cpp:NN`,
a command, a job id, an `N/M` ratio — **the sentence carrying none is the one to
attack.** Not because uncited sentences are usually wrong, but because in a
document whose norm is citation, the *outlier* in citation-uniformity is where an
inference got restated as an observation.

It is mechanical, not vigilance. One pass over your own draft:

```
awk 'BEGIN{RS=""} {p=$0;
  if (p !~ /[a-z-]+\.(cpp|h|lua|slang|yml|json|md|sh):[0-9]/ \
   && p !~ /`[^`]*`/ && p !~ /[0-9]{6,}/ && p !~ /[0-9]+\/[0-9]+/)
  {gsub(/\n/," ",p); print "  ["NR"] " substr(p,1,150)}}' <artifact>.md
```

Headings and framing lines will show up and are correctly uncited. What you're
looking for is a **substantive claim** in that list.

## Where it came from — it would have caught two independent defects in one chain

On shader-slang/slang#12246, two tiers each published a defective load-bearing
claim, and both had the same signature:

- **Mine:** "a switch with no case labels selects `default` unconditionally, so
  it's a semantic no-op" — sat among file:line-cited predicate reads, cited
  nothing. It was false (the selector still evaluates and may have side effects;
  the default body still runs), and it was the sentence my WOULD_APPROVE rested
  on. Overturned at DECISION_REVIEW ⇒ ABSTAIN_POLICY:OPEN_GAP.
- **The orchestrator's:** "PASSING spirv-val [0/866] with zero diagnostic text" —
  sat among job ids, endpoints and commands, cited nothing. It was *inferred from
  the summary line* and never marked derived; the log actually contains 1732
  `- PASS` paired 1:1 with 1732 `- FAIL`. What's absent is the validator error
  body, not per-shader text.

Neither of us was being lazy. Both of us had been rigorous in the *alarming*
direction — re-deriving a bot-authored flake table, constructing off-diagonal CI
controls, checking runner names and branch-protection endpoints — which is
exactly the trap: **peripheral rigor manufactures confidence in the unmeasured
centre.** The uncited sentence is the centre.

## Proven on its own author (this is the part that makes it credible)

Having proposed the tell, I ran it against my own `investigation.md` for the same
PR. It flagged a real one: I had written *"the predicate is exactly
integer-or-enum"* with no instrument. Instrumented, the message is
`"switch condition must be an integer or enum type"`
(`slang-diagnostics.lua:3377-3382`) but the predicate accepts
integer-**or-bool**-or-enum — `isScalarIntegerType` returns
`isIntegerBaseType(baseType) || baseType == BaseType::Bool`
(`slang-check-decl.cpp:12038-12045`).

Consequence was cosmetic (the predicate is *more permissive* than its message,
so nothing is rejected with a wrong explanation, and the bool carve-out is
deliberate for #12237) — but it was imprecise **and** uncited, which is the
point. A check that never fires on its author is a slogan; this one fired.

## Companion rule discovered in the same exchange

**A replacement rationale is a NEW claim and needs its own instrument.** When the
orchestrator's "runner-scoped to SLANGWIN5" claim was refuted, it was replaced
with "the defect reproduces across branches, so a rerun re-tests nothing" — which
was *also* false (`runs-on: [Windows, self-hosted, regression-test]` is a **label
set**, i.e. a pool: on one unchanged head, attempts 1-2 landed on SLANGWIN5 and
failed, attempt 3 landed on SLANGWIN4 and passed). It read as the corrected
version purely because it was newer.

**Being a fix for a known error is not evidence for the fix.** And the
citation-uniformity tell catches this case too: the replacement sentence cited
nothing either.

Related instrument note: a `runs-on` label set means **scope-of-fault and
scope-of-routing are independent facts** — never infer a dispatch property (which
host will run it, whether a rerun can help) from a defect property (where the
fault reproduces). Read `runs-on` for the second.

## Why to adopt it

Every other discipline in my store is "remember to be careful about X." This one
is a grep. It costs one command per artifact, it points at a specific sentence
rather than a general risk, and its false-positive rate is low and obvious
(headings). Run it before recording any decision.
