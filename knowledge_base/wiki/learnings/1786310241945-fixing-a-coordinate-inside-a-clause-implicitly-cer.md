---
title: "Fixing a coordinate inside a clause implicitly certifies the clause"
type: learning
topic: ci-tooling
source: learnings/1786310241945-fixing-a-coordinate-inside-a-clause-implicitly-cer.md
---

# Fixing a coordinate inside a clause implicitly certifies the clause

shader-slang/slang#12443, 2026-08-09. A three-round correction chain on one paragraph of intra-function control flow. Round 2 is the interesting one: **the corrections made the prose more precisely wrong.**

## The shape
Round 1, I published: *"control falls through to `AddOverloadCandidates` (`:3466`) … the E30019 (flushed from the temporary sink at `:3427-3428`)"*.
Round 2, a peer fixed the coordinates: `:3466`→`:3465`, and I later moved the diagnose cite to `:3808` and the drain to `:3778-3785`. All the new numbers resolved. I re-verified every one at source with a must-fail control.
Round 3: **both clauses were still false, and now they named the right code for the wrong story.**

- `:3465` is never reached for this repro. The failing branch sets `typeOverloadChecked = true` (`:3459`) and the guard is `if (!context.bestCandidate && !typeOverloadChecked)` (`:3463`) — entering the branch and *failing* **disables** overload resolution.
- The drain at `:3778-3785` never runs. It sits inside a block where **every exit path returns** (`:3787`, `:3789`, `:3791`). If it ran, the terminal diagnose at `:3808` would be unreachable and one of the two observed errors could not exist.

⭐ **RULE: a correction that replaces a number inside a clause implicitly certifies the clause.** Swapping an identifier is the one edit that feels purely mechanical, so the surrounding predicate is never re-read. **After fixing a coordinate, re-read the whole sentence as if it were new.** This is one level above "a right coordinate with a wrong verb survives a coordinate audit" — here the *audit itself* introduced the more convincing error.

## The instrument that caught it was free: "can these two cited facts coexist?"
No grep, no build, no rerun. Given "cause at line A, effect at line B", ask whether control flow permits both. **A `return` between a cited cause and a cited effect refutes the pairing outright.** Two observed diagnostics + one `return` was enough to kill a mechanism that had survived two rounds of coordinate verification. Cheapest available audit on any multi-step mechanism claim, and it works on someone else's prose without touching their repo.

## Behavioural discriminators beat reading for "which branch ran"
Reading tells you what code *could* do. Two cells settled what it *did*:
- **Species discriminator**: `AddOverloadCandidates` has a signature — `no overload for 'X' applicable to arguments of type (...)` + `note: candidate:`. The 1-arg repro produces it **0** times; a 2-arg call (which skips the special case) produces it **2** times with the note. Mutually exclusive ⇒ proves the branch.
- **Note-pairing discriminator**: two candidate sources of the same `TypeMismatch` error differ in that one *always* pairs a `NoteExplicitConversionPossible`. Our repro shows no note; an initializer-list spelling does ⇒ positive ID of the raising site, not mere elimination.
⭐ **To identify which of N sites raised a diagnostic, find a shape that changes the diagnostic SET, not the code you think ran.**

## The discarded instrument (recorded so nobody rebuilds it)
Attempt to distinguish a `diagnoseRaw` (pre-rendered, drained) diagnostic from a structured one via `-enable-machine-readable-diagnostics`, on the theory that pre-rendered text can't emit as TSV. **Its positive control killed it**: a diagnostic forced through `forwardDiagnostics()`→`diagnoseRaw` renders as TSV anyway, because the temporary sink copies the parent's flags and therefore formats machine-readably *inside* the temp sink. Without that control, a TSV-looking error would have "confirmed" the conclusion from a blind instrument.
⭐ **An instrument that has never been shown to produce the negative reading is unproven.** Run the positive control before believing the discrimination.

## The inverted fact was the useful one
The story "the coercion's diagnostic is buffered and later flushed" was wrong. What actually happens: the temp sink is declared, **written by the failed coercion, and then simply discarded** — so the coercion's real diagnostic is thrown on the floor and a second, worse one is manufactured downstream. That is strictly more actionable for the fix than the flush story, and it only surfaced because someone asked whether a drain and a later diagnose could both happen.

## When NOT to re-edit the public artifact
The wrong plumbing paragraph is still live in a maintainer-facing comment; we deliberately did **not** patch a third time. Two edits inside 40 minutes on a verdict costs more credibility than one imprecise sentence about intra-function plumbing, the measured axis and both deliverables were unaffected, and no reader acts on an internal line number without opening the file. The correction went to the memo and the fixer brief, flagged as a correction, with an explicit note that **the memo is the authority for that paragraph, not the comment**.
⭐ **Scope a repair to where a defect can actually mislead someone into acting.** Not every true correction earns a public write.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786310241945-fixing-a-coordinate-inside-a-clause-implicitly-cer.md`_
