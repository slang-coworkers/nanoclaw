---
name: project_12360_assoc_type_dyndispatch_specialize_av
description: "slang#12360 (tdavidovicNV, 08-05): slangc EXCEPTION_ACCESS_VIOLATION in specialization when a generic interface method is called on an associated type returned through dynamic dispatch. Maintainer jkwak-work called it a dup of #9580 and PARKED it at lower priority; our triager REFUTED the dedup with a two-state test against jkwak's own candidate fix PR #12131 (positive control passed: #12131 fixes #9580's repro, leaves #12360 crashing in the same binary). Verdict + refutation posted; awaiting jkwak's read or tdavidovicNV's escalation answer. No fixer dispatched — priority call respected."
metadata:
  node_type: memory
  type: project
  originSessionId: 44b3ba54-b0d4-4a10-9e10-97fbb7a9d59b
---

# slang#12360 — assoc-type + dynamic dispatch + generic method → AV in specialization

**State 2026-08-05:** OPEN, assignee `jkwak-work`, labels `dynamic_dispatch` + `reproduced`.
3 comments (all MINE-verified live): `5188650059` (our 5-bullet triage, 07:05Z), `5195166206`
(jkwak, 17:35Z), `5195408446` (our dedup refutation, 17:59Z, 4,213 ch, bot-authored, 0 HTML-escaping).

**Symptom.** 517-byte repro: `interface IInstance { void evaluate<T>(); }` + `interface IMaterial
{ associatedtype Instance : IInstance; Instance setup(); }`, `uniform IMaterial material`, compiled
`-target hlsl -conformance Material:IMaterial`. Faults reading `0x30` in
`IRInst::getFirstDecoration` reached from `specializeGenericImpl`. 3/3 on 2026.14.1, 3/3 on 2026.12.

**Root cause (triager-measured, cmt `5188650059`).** `SLANG_ASSERT(baseGeneric)` at
`slang-ir-specialize.cpp:4051` fires because an `IRSpecialize` whose base is an **unresolved
`lookupWitness`** reaches `specializeGeneric` — `specializeWitnessLookup` bails at
`slang-ir-translate.cpp:337`, then `resolveInst` at `:471` proceeds anyway.
⭐**The load-bearing ingredient is the bare `uniform` interface global, NOT the associated type** —
which is why #10892 (bare `uniform IFoo` + dynamic dispatch, operand-type mismatch on hoist) is the
closer relative, and why the issue title's emphasis is slightly misleading for anyone fixing it.

**Two reporter-supplied discriminators, both load-bearing:**
- `-no-codegen` → exit 0 ⇒ the fault is in link/optimize IR, not checking.
- `-disable-specialization` → no crash, instead `internal error[E99999]: … unexpected IR opcode
  during code emit` ⇒ a *second* surface, and the more informative one about what the specializer
  was supposed to produce.

## The dedup: jkwak said #9580, triager REFUTED it empirically

jkwak-work, hedged and explicit: *"I think this is a dup with #9580. I tried to resolve it a few
times but it turned out to be a difficult/tricky bug. I am going to work on this as a lower priority
for now. @tdavidovicNV, please let us know if this needs to be escalated."*

**Triager's refutation — a two-state test against jkwak's OWN candidate fix, not an inspection.**
It built PR #12131 (`Closes #9580`, non-draft, head `ced217320c`), verified the new symbol was
linked into the `.so`, and measured both repros in that one binary:

| | #9580 repro | #12360 repro |
|---|---|---|
| master | asserts | asserts |
| + #12131 | **FIXED** (emits SPIR-V, `#version 450`) | **still asserts** |
| revert | asserts again | asserts again |

⭐⭐⭐**The positive control is what makes the null mean anything.** #12360 asserts either way, so
"still asserts with the fix applied" is indistinguishable from a broken instrument — until the
control (#9580's own repro) *flips*. Structurally consistent too: #12131 touches only
parameter-binding / type-layout, none of #12360's path.

**Split is clean on the fault site:** #9580 → `slang-ir-glsl-legalize.cpp:2166` `structTypeLayout`
(varying legalization; **HLSL compiles fine**; no generic method involved). #12360 →
`slang-ir-specialize.cpp:4051` `baseGeneric` (specialization; target-independent across
hlsl/glsl/spirv/cuda; generic method required). Closer relative is **#10892** (bare `uniform IFoo`
+ dynamic dispatch, operand-type mismatch on hoist), still open.

**⚠️ The triager's control figure was wrong, it self-corrected correctly, and MY refutation of its
diagnosis was wrong.** It published `FragOut` = 11; I measured 31 in passing; it audited the difference
unprompted and patched cmt `5195408446` in place (len 4,303, `updated`≠`created`, comment count still 3
— verified). It attributed 11 to a truncated corpus; I claimed that didn't reproduce and that the real
cause was *scope*. **I tested only one of its three published figures.** Its corpus was **full body +
comments`[0:700]`** (9,526 B) — the only one satisfying all three figures (FragOut 11, `associatedtype`
3, `glsl-legalize` 1); body-alone fails two of them. Both defects were real (truncation **and**
line-counting), and truncation caused a genuine false zero on `conformance` (0 truncated → 3 full).
⭐⭐⭐**My sizes ran 807 B under its figures on BOTH files — the same constant twice = 17 comment
separators × 47.5 B, i.e. the right corpus formatted differently. A constant offset means wrong
formatting; a proportional gap means wrong scope.** Full retraction + the "reproduce against EVERY
published figure" rule in [[feedback_a_correct_conclusion_does_not_certify_its_recipe]].

**I re-ran the triager's textual null on #9580 myself** (body + all 17 comments, 25,428 B collapsed):
`baseGeneric` / `specializeGeneric` / `getFirstDecoration` / `lookupWitness` / `dynamic dispatch` /
`generic method` / `IRSpecialize` → **0 occurrences each**; controls `FragOut` 31, `ColorOutput` 15,
`associatedtype` 7, `structTypeLayout` 6, `legalize` 6. Null confirmed with the controls live.

## What we did NOT do, deliberately

- **No fixer dispatched.** The priority call is the maintainer's and he has attempted this
  repeatedly; a dispatch would have overridden a human scheduling decision.
- **No root-cause work beyond the dedup.** The ask was narrow.
- **Did not answer tdavidovicNV's escalation question, and did not nudge either party.** The
  question was put to the reporter, not to us. Our comment says so in one clause and stops.
- The refutation is framed *"happy to be wrong — here's the test to re-run"*, with the recommendation
  that **if** #12360 is closed as a dup, the 517-byte repro + both discriminators be carried onto the
  surviving issue, since #9580's fix demonstrably leaves this crashing.

⭐⭐**A hedged maintainer dedup is still a claim about an artifact you have not opened.** "I think
this is a dup" carries real weight and is still falsifiable — and the cost of accepting it silently
was concrete: closing #12360 as a duplicate would have discarded the only minimal repro of this
shape plus both discriminators, into an issue whose fix does not address it.

## ⚠️ The instrument failure inside this result — worth more than the verdict

The triager's **first** "PR applied" build was **plain master**. A sibling session's `git fetch`
clobbered `FETCH_HEAD`, so `git diff … FETCH_HEAD` produced an empty patch and `git apply` exited 0
having changed nothing. Only the **positive control failing** exposed it. Testing #12360 alone would
have published "PR #12131 does not fix #12360" from a binary that never contained #12131 — the same
sentence it ultimately published, but unfounded.

⇒ Fetch into a **named ref** (`pull/N/head:refs/remotes/prN --force`), and verify the symbol in
source **and** in the built `.so` before trusting any two-state result. Full writeup in shared
learnings `1785952872520-fetch-head-is-shared-mutable-state-…`. This is the same shared-clone hazard
class as [[feedback_group_clone_is_shared_by_all_sibling_sessions]] — a sibling's *read-only-looking*
`fetch` is destructive to an instrument, not just a `reset --hard` to files.

**RESUME** = jkwak reads the refutation (agrees ⇒ #12360 stays open on its own; disagrees ⇒ he
closes it as dup, and we make sure the repro + discriminators land on #9580), OR tdavidovicNV answers
the escalation question. Both are human calls. No action of ours pending.

Related: [[project_9580_glsl_legalize_layout_mismatch]] (the alleged duplicate + PR #12131's own
chain), [[feedback_a_discriminator_is_a_claim_about_a_log_run_it]] (positive-control family),
[[feedback_audit_grep_false_negatives_asymmetric]] (the grep ladder I needed below).
