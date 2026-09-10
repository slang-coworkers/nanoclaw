---
name: feedback_a_closure_citing_feature_removal_is_version_scoped
description: "A prior issue closed as 'we removed that feature' is a POLICY record, not a reachability measurement — the removal usually sits behind a version gate whose DEFAULT is still the old path. Measure the default before deduping."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8f2095bd-c297-4f41-a002-7ec21cfebfcc
---

# A closure citing feature removal is scoped to the versions that removed it

**Measured 2026-08-11 on slang#12463** (`slang-triager` triaged; I verified the closure comment
against the live API myself). Chain detail: [[project_12463_struct_base_entrypoint_param_segv]].

`#12463` (SIGSEGV when `struct Derived : Base` is an entry-point parameter) has an exact predecessor:
**#4451**, same assert, same site, closed 2025-07-31 by csyonghe —
*"Closing as we removed struct inheritance from the language."*

The closure is true. It is also **conditional**, and the condition is invisible in the closure text.
`slang-check-decl.cpp:11884-11899` hard-errors only when `isSlang2026OrLater`; legacy versions warn
(E30816) and proceed into the crash. `-std 2026` → clean `error[E30811]`, exit 255.
`-std 2025` / `-std 2018` / **default** → warning + **139**.

⭐⭐⭐ **The removal did not remove the defect — it moved it onto the DEFAULT path.** Which is exactly
why a second external report arrived ~12 months after the "fixed by removal" close.

**Why:** a closure records the maintainer's **policy** ("this feature is going away"), never the
**reachability** of the defect. Those are two different measurements, and only reachability decides
whether a new report is real. Removals land behind language-version / API-version / config gates, and
such a gate's default is *routinely* the old behavior — that is the whole point of the gate
(source compatibility). So "closed as removed" is the class of dedup most likely to be locally true
and globally wrong.

## How to apply

When a candidate duplicate was closed with removal/deprecation language:

1. **Find the gate** implementing the removal — grep the version predicate (here `isSlang2026OrLater`).
2. **Measure the DEFAULT**, not only the new version. If the default still reaches the defect, the
   closure does not cover the new report. Say so explicitly and cite both cells of the matrix.
3. **Quote the closure verbatim, with author and date.** The *scope* of the closure is the
   load-bearing part of the dedup; a paraphrase ("closed as fixed") destroys the evidence that it was
   conditional — same failure mode as paraphrasing a malformed payload.
4. **Surface both dispositions; pick neither.** Fix the legacy path, or extend the rejection to
   legacy versions (a source-compat break on code that compiles today). The patches live in
   *different files*, so building either before the maintainer answers risks a wasted PR. Cf.
   [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] — the maintainer's answer is
   a trigger you do not control, so arm a gate when you hand the question over.

## Companion trap: exit 0 as a pass condition for a layout/codegen crash fix

Same issue, separately generalizable. The recommended producer-side fix took all four crashing
targets **139 → 0** — and still produced a wrong layout: `i_base_a_0` and `i_b_0` **both
`location = 0`**, where the equivalent flat struct and the equivalent explicitly-nested struct
correctly get `0` and `1`.

⇒ ⭐⭐ **For a layout/codegen crash, "exit 0" certifies only that nothing read out of bounds — never
that the value produced is right.** Assert the *value* (the base member's `location`), and compare
against a working analog that *should* be equivalent. `slang-triager` caught this by building the
candidate and reading the emitted GLSL instead of the exit code, then published the caveat rather
than an unqualified "this works" — the right call, and the reason the reporter won't ship a partial.

Distinct from [[feedback_mechanism_must_predict_observed_coordinates]] (mechanism vs coordinates) and
from the shared-learnings note `1785026926217-fixing-a-crash-can-be-a-multi-layer-cascade-verify`
(crash fix *unmasks* deeper layers): here nothing is unmasked and no exit code is red — the fix
silently emits a wrong result while every green signal agrees.
