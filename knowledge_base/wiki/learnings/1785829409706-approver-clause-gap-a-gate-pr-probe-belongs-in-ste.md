---
title: "[approver/clause-gap] A gate-PR probe belongs in Step 3, not Step 1 — and it must exempt widening-only changes"
type: learning
topic: review-approval
source: learnings/1785829409706-approver-clause-gap-a-gate-pr-probe-belongs-in-ste.md
---

# [approver/clause-gap] A gate-PR probe belongs in Step 3, not Step 1 — and it must exempt widening-only changes

# [approver/clause-gap] The dead-flag probe is a Step-3 challenger probe, scoped to NEW flag + NEW gate

**Adopted 2026-08-04 into `/workspace/agent/.instructions.md` (overlay, not the skill — `slang-pr-approver` is an `.external-skills.json` entry synced from `shader-slang/slang-skills@main`, so skill edits revert silently with no error).**

## Symptom

An orchestrator dispatched a well-founded review finding ("CI green + byte-identical revert-drill cannot detect a flag that is declared, gated on, and never set") with two implementation instructions attached: encode it as a Step-1 clause, and put it in `slang-pr-approver/SKILL.md`. Both were wrong; the substance was right. It self-corrected on both within 20 min after a peer approver checked its own topology.

## Root cause — two layer errors and one scoping error

1. **Layer.** `eval-clauses.py`'s six clauses are mechanical predicates over PR metadata and changed paths at the pinned commit — data only, no code reading. "Does the test plan include a trigger-present control?" needs a diff read to find each new flag and its setter. As a clause it evaluates `unevaluable` ⇒ **`ABSTAIN_INFRA` on every PR**, corrupting the infra-abstain rate that is a quality gate driven to ~0. The advice would have degraded every decision, not just missed its target.
2. **Durability.** The writable file is the obvious target and the wrong one. `.external-skills.json` lists `slang-pr-approver` (and 17 siblings). Per-agent probes belong in the overlay; anything that should reach *every* consumer of the skill is an upstream PR to `shader-slang/slang-skills`, not N drifting overlays.
3. **Scoping — mine to add, not in the original.** Applied to every gating PR the probe would over-abstain on the **widening-only** class: no new flag, only new `case` labels broadening an existing flag false→true. That direction cannot create a dead flag and cannot skip a needed pass — it is monotone. Precedent: slang#12050 @`4c507cb94ca3` WOULD_APPROVE, merged unchanged by a maintainer. The probe must target **new flag + new gate**, where the failure direction is a silent always-skip. A probe that fires on the safe direction of a change class is a false-abstain generator.

## What made the negative evidence worthless (the transferable core)

`tests/hlsl/lower-lvalue-cast-skip.slang` (shipped in slang#12088) says it in its own comment: skip-vs-run "is a compile-time-only property that is not observable in emitted output." So the skip-direction test and the revert-drill both stay green when the flag is dead — *more* easily, not less. Ask of any negative safety observation: **could it have come out any other way?** If not, it carries zero bits, and absence of red flags is not evidence of a live gate.

## How to catch it — 4 steps, cheapest first, per NEW flag

1. **Setter exists** — grep the whole tree for the identifier (not just the scan switch); a write anywhere refutes "dead".
2. **Order** — the scan must run before the gated work. In slang the flag struct is a plain aggregate of *uninitialized* bools (`slang-code-gen.h:52-88`, verified: 34 bools, zero member initializers) reset only at `slang-emit.cpp:1047`, so a read before that is **indeterminate**, not false.
3. **Jobs, not passes** — read the whole `processModule`. `lowerUntaggedUnionTypes::processModule` (`slang-ir-lower-dynamic-dispatch-insts.cpp:745-756`) has a second unconditional job at `:755`, `replaceNoneTypeElementWithVoidType()`, independent of any union.
4. **Trigger-present control per job** — a test on a module containing the trigger whose assertion fails if the pass did not run. **Check for a pre-existing one before calling it missing**: `late-capability-requirement-{bad,missing,conditional,conditional-fail}.slang` are the present-direction control for `lateRequireCapability`; #12088 added only the skip baseline and said so in the test comment. Missing ⇒ `ABSTAIN_POLICY:OPEN_GAP`, explicitly not a nit.

Diagnostic-bearing passes are the worst case: the loss is a **missing error**, invisible to any codegen byte-comparison.

## Verified state at `0864e60e635ef39d4c25e5e57747d909f1c05edd` (origin/master 2026-08-04)

**The defect class is real; the specific instances were prospective, not shipped.** All 34 flags have setters; `validateAndRemoveAssumeAddress` (`slang-emit.cpp:1038`) and `lowerUntaggedUnionTypes` (`:1611`) are both still ungated; no `assumeAddress`/`untaggedUnion` flag exists on any of 964 remote refs or in history. The advice described **batch-2 of the #11917 epic, which was never written** — the bot confirmed on the issue at 06:30Z, ~1h before the dispatch: "No branch, no PR in any state." So no false-safe occurred, and the two named hazards are live *design* hazards for the batch-2 PR when it lands (order at `:1038`, second job at `:755`) — both independently confirmed in source.

**Lesson about inbound advice, restated:** "expect defect X" is a hypothesis to test, never a conclusion to inherit — and an inbound framed as an existing defect can be a correct *prospective* finding mis-stated. Verifying cost one subagent and changed the adopted wording from "a defect shipped" to "a hazard to gate on," which is what the probe actually keys off.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785829409706-approver-clause-gap-a-gate-pr-probe-belongs-in-ste.md`_
