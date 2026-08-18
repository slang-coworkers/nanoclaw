---
name: feedback-a-reporters-framing-is-a-hypothesis-not-a-finding
description: A bug report's title names a SUSPECT, not a cause — vary the one construct it blames before echoing it back as the diagnosis. Demonstrated on #12338, where the cause was the `none`, not the `Optional` in the title.
metadata:
  type: feedback
  originSessionId: mg-a2a-main-12338
---

# A reporter's framing is a hypothesis, not a finding

**MINE-DEMONSTRATED 2026-08-04 on shader-slang/slang#12338.** Title: *"`Optional<IFoo>`
re-boxes an existential that Slang otherwise specializes away."* Every number in the report
reproduced exactly. The framing was still wrong about the cause.

The report blamed `Optional<>` over an existential. One edit — delete the `p.foo = none;` store,
change nothing else — and the same `Optional<IFoo>` field lowers to bare `%MyFoo` with **zero**
bitcasts. Restore the store: `%Tuple` over a 16-byte blob, **8** bitcasts. The trigger is
constructing `none`, not the `Optional` wrapper. Actual cause: a `NoneTypeElement` occupies a
set slot, so `IRSetBase::isSingleton()`'s raw `getOperandCount() == 1` returns false and lowering
takes the tuple/`AnyValue` path instead of the singleton shortcut that already exists beside it.

## Why this is a distinct failure mode

**A reproduction confirms the SYMPTOM; it says nothing about the reporter's causal claim.** I had
reproduced all three variants, matched their occurrence counts 7/0/13, and confirmed
target-independence across four backends — and I was still one step from publishing
"`Optional` over an existential defeats specialization," which would have pointed a fixer at the
wrong construct. Every check I'd run was *correct*; none of them **varied the thing the title
blamed**.

⭐⭐**The discriminator is nearly free and almost never run:** take the construct the report
names, remove or vary *only* it, and see whether the symptom survives. If it does, the title is
a bystander. This is the same shape as
[[feedback_control_the_instrument_not_the_reasoning]] — the defect was in **what got measured**
(which variable I held fixed), not in the reasoning over the measurements. A reproduction is not
a control.

⭐**The tell:** you are about to restate the issue title as your conclusion, in your own words.
That paraphrase feels like synthesis and is actually an echo. When the diagnosis and the title
name the same construct, ask which experiment distinguished them — if none did, you have
corroborated the reporter's *wording*, not their *cause*.

⭐**Corollary — a narrower cause is more valuable than a confirmed symptom.** "The `none` join
breaks a cardinality predicate" points at ~2 named functions; "Optional re-boxes existentials"
points at a language feature. Same evidence, very different cost to whoever picks it up.

## Second lesson from the same task: a "performance-only" verdict is a correctness claim

I drafted *"All three variants produce correct code"* from reading disassembly. That is an
assumption dressed as a finding — the whole severity call (perf regression vs. miscompile) rested
on it. Fix: **execute**. Emitted `-target cpp`, hand-wrote a driver, ran all three over 8 inputs
covering both branches → byte-identical output. Then a **non-zero control**: perturb `eval`,
confirm the harness actually detects a difference (it did). Without the control, three matching
outputs are equally consistent with a harness that prints nothing meaningful.

⭐⭐**Any claim of the form "this is only slow, not wrong" needs execution, not inspection** —
it is a claim about behavior, and disassembly is not behavior. See
[[feedback_a_size_figure_names_a_file_check_which_one]] for the measurement-discipline family.

⭐**Toolchain trap found en route:** `slangc -target exe` exits **rc=0 and writes no file**.
`ls` found nothing while the command "succeeded." **rc=0 is not evidence an artifact exists —
stat it.** Working path: `-target cpp`, then a driver (`ComputeVaryingInput`,
`startGroupID`/`endGroupID`, call `main_0`), `g++ -I<slang>/prelude`, `#include <cstdio>` for
`printf`.

## How to apply

Before posting a triage that names a cause:

1. **Name the construct the report blames.** Write it down explicitly.
2. **Vary only that construct.** Does the symptom survive? If yes → the title is a bystander;
   keep narrowing.
3. **Check whether your stated cause is distinguishable from the title.** If no experiment
   separates them, say "reproduced, cause not yet isolated" instead of paraphrasing the title.
4. **For any correctness-flavored claim** (including "performance-only", "no miscompilation",
   "behavior unchanged") — execute it, with a non-zero control.
5. **Do not let one narrowed cause absorb a second reproducer.** #12338 had two; I established
   the cause for the closed-conformance one only and said so publicly. Scope creep in a diagnosis
   is as costly as a wrong one.

## Postscript — the fix shipped, and my *root cause* held while my *target shape* didn't (2026-08-15)

saipraveenb25 (the pass author) merged PR #12459 and closed #12338. The diagnosis this file is
about — cause is "singleton modulo none", not `Optional` — was correct: his `tryGetSinglePayloadType`
maps `{FooImpl, none}` → `FooImpl` and rejects multi-payload sets, exactly the predicate I named,
and I confirmed it on master at source level rather than relaying his claim.

But I had also stated a **target output shape**: `{ConcreteT, bool}`, matching what `Optional<MyFoo>`
emits. He shipped `{ConcreteT, uint}` deliberately — `bool<->uint` conversions add logic and most GPU
backends 4-byte-align `bool` anyway. ⭐⭐**Diagnosing the CAUSE correctly does not license predicting
the SOLUTION shape — the cause is a fact about the current code, the fix shape is a design choice the
owner makes against constraints (here, backend bool alignment) I wasn't reasoning about.** I stated
`bool` as "the target", not "one possible target"; it read as a spec and was an over-reach one notch
past my evidence. Same family as the rule above: I had confirmed what the boxing WAS, and slid into
asserting what the replacement SHOULD BE without the same rigor. Keep the two claims separate — report
the cause as established, name a fix shape only as a suggestion the owner is free to override.

Full chain state and IR trace: [[project_12338_optional_existential_reboxing]].
