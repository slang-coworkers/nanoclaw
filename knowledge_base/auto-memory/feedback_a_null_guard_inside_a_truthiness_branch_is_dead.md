---
name: feedback_a_null_guard_inside_a_truthiness_branch_is_dead
description: "A guard whose CONDITION handles null/empty but whose ENCLOSING BRANCH already tested truthiness is dead by construction — and the optional chain is what makes it read as covered"
metadata:
  node_type: memory
  type: feedback
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1081
---

# Read the guard's ENCLOSING BRANCH before believing its condition

**2026-08-05, nanoclaw#1081.** A fix added `deliveredNothing = sent === 0 && !event.text?.trim() && ...` to catch a turn that produced no output. The documented failure payload was `text: null`. The condition handles null correctly. **The guard still never ran** — it was placed inside `} else if (event.text) {`, which had already excluded every falsy value.

⭐⭐⭐ **The optional chain is the camouflage.** `!event.text?.trim()` is *written in the idiom of null-safety*, so it advertises "I handle null" at exactly the spot where null is unreachable. A reviewer pattern-matching on the condition sees the case covered; only the enclosing branch shows it can't arrive. ⇒ **When a guard's condition names a case, check that the case can REACH it — a condition is a claim about inputs, and the branch structure decides which inputs exist.**

⇒ **Generalization:** a defensive check is worth zero if it sits downstream of a filter that removes what it defends against. Both halves read as diligent in a diff; only together do they show as dead. This is a **static** sibling of the inert-guard family — no runtime state needed, just nesting.

## The method that caught it (reading did not)

I first *derived* the gap structurally by mapping branch boundaries — but structural reads are exactly what I've been wrong about before, so I **ran** it: real `processQuery`, four payloads, one control that must fire.

```
text:null   → no exchange at all   ← the documented payload; guard never ran
text:''     → no exchange at all
text:'  \n '→ undelivered          ← the ONLY shape it catches
text:'OK x' → completed            ← control, fired
```

⭐⭐ **The table is the finding.** "The guard is unreachable" is an assertion; a row showing the documented payload producing *no exchange* while a control produces one is evidence. **A four-row truth table over the input space beats any amount of branch-tracing prose** — and it incidentally revealed the narrow shape that *does* pass, which I would not have predicted.

⚠️ **A second, independent defect hid behind the first.** Even in the whitespace case where the guard fires, the status went to a hook **no registered provider implements** (enumerated at the `registerProvider` call sites — 0 of 4) and the trigger was still ack'd `completed`. ⇒ **Finding one reason a fix doesn't work is not finding the only reason — keep going past the first explanation.** Had I stopped at the reachability gap, "hoist the guard" would have read as a complete fix and shipped a still-broken path.

Related: [[feedback_a_guard_can_be_inert_and_read_as_passing]], [[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]], [[feedback_control_the_instrument_not_the_reasoning]], [[project_nanoclaw_1081_silent_turn_undelivered]].
