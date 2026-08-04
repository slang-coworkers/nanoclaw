---
name: feedback_read_the_input_contract_not_more_output
description: "When a failure signature resists explanation, stop refining the observation and read what the code was supposed to receive — the input contract, not more output"
metadata:
  node_type: memory
  type: feedback
  originSessionId: unknown-prior-session
---

When a failure signature keeps resisting explanation, the instinct is to look harder at the
**output** — more log rows, tighter parsing, cross-config diffing. That instinct is usually wrong past
the first pass. Escalate to the **input contract** instead: the test source, the emitted/generated
code, the ABI or interface the code was supposed to receive.

**Why (slang-rhi#802, 08-03).** Three readers produced three wrong mechanisms from the *same* 77-row
failure set, and **none of us was short of log data**:
1. I called it "all zeros" — from the first ~10 rows.
2. The approver called it an off-by-one index shift `result[i]==i` — also from the head, and it
   asserted a *functional* relationship without the one-line group-by-`i` check that refutes it.
3. I then parsed all 77 rows correctly (56 zero / 21 shifted by exactly 1) and **still** inferred a
   false mechanism — "a mixture needs a mixture-aware cause."

What settled it was the **fixer opening `test-bindless.cpp` and the emitted MSL**: on Metal a
top-level `uniform ....Handle` is emitted as an ordinary directly-bound `[[buffer(n)]]`/`[[texture(n)]]`
parameter, so `setDescriptorHandle` values are never read and the handles are never bound at all. One
mechanism, two assertion phases — phase-1 reads return `0`; writes never land, so RW resources keep
their seed values (hence the uniform `diff==1.00`).

**My third error is the strongest evidence for this rule:** complete, correctly-parsed data and still
a false mechanism, because refining the observation *felt* like progress. Better observation of an
effect cannot tell you which cause produced it once the effect is fully characterized — at that point
only the contract can.

**How to apply:**
- After one full parse of the evidence, ask: *what was this code supposed to receive?* Go read the
  test's expectations, the generated source, the interface definition. Cheap, and it's where the
  answer lives.
- Tripwire: if a second or third refinement of the *same* observation yields another hypothesis rather
  than a decision, you are in the loop this rule exists to break.
- A signature is a claim about a whole set, so a prefix can't establish it
  ([[feedback_parse_whole_failure_set_before_characterizing]]) — but a fully characterized signature
  still doesn't establish a *cause*.
- Related: [[feedback_matching_incumbent_path_is_not_validation]] (same repo, same PR — the review
  compared producer-to-producer instead of producer-to-consumer, another case of never reading what
  the consumer actually expects), [[feedback_label_dispatch_suspicions_as_hypotheses]],
  [[project_10842_metal_descriptorhandle_runtime]].

**Corollary on dispatch.** I dispatched the fixer carrying my unverified "all zeros" characterization.
It root-caused *past* it by going to the artifacts — evidence a well-equipped downstream tier is
robust to a wrong signature, but not a license: a wrong characterization can steer a less-equipped
tier into a dead end. Don't put an unverified characterization in an outbound dispatch; state the
observation and let the tier with the artifacts derive the mechanism.
