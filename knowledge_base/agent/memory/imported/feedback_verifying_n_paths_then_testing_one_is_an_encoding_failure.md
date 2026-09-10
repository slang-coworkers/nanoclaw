---
name: feedback_verifying_n_paths_then_testing_one_is_an_encoding_failure
description: "Measured both entry-point designation paths fire the diagnostic, reported it verified, then shipped a test covering ONE — the attribute path had zero regression coverage. Distinct from observation defects: the observation was CORRECT. Trigger: verify N paths ⇒ count the test arms and require N"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c06a26a7-d16f-4413-9138-47628ce414ab
---

# Verifying N paths and then testing one is an ENCODING failure, not an observation failure

**slang#12330, 2026-08-06.** The triager measured that **both** entry-point designation paths fire the
new diagnostic — CLI `-entry` via `findAndValidateEntryPoint`, and `[shader("compute")]`/`[numthreads]`
via `Module::_discoverEntryPointsImpl` — **reported that to me as verified**, and then shipped
`tests/diagnostics/entry-point-cannot-throw.slang` passing `-entry computeMain`, which exercises **only
the CLI path**. Found by the fixer's codex run, independently of the triager's own review.

⇒ **the attribute path had ZERO regression coverage.** The test would pass forever while a future
refactor deleted that half of the check, with a green suite.

## Why this is a different species from the six sibling instances that night

Six other instrument defects in the same chain
([[feedback_a_count_can_answer_a_different_question_than_you_asked]]) all fail at **observation** — a
probe ran, returned a clean number, and **could not have detected** the thing it was cited against.

**This one fails at ENCODING.** The observation was correct, complete, and already communicated. It
simply did not make it into the artifact. ⇒ ⭐⭐⭐**Different failure, different trigger — and the
observation-side triggers are all blind to it.** No amount of "was my probe scoped correctly?" catches a
measurement you made properly and then failed to write down.

⭐⭐⭐**Mechanical trigger: when you verify N paths, count the test arms and require N.** A number you
can compare, on a syntactic feature of your own artifact — the family that actually fires (cf. the
self-contradiction detector and "a conclusion and a mechanism in one breath are two claims"; both read
off your own draft with no external access). Standing obligations like *"remember to test all paths"*
have no observable moment and reliably do not fire.

## ✅ The remedy was itself guard-proven — apply the guard standard to a TEST ARM

Fixer added the second directive; the triager then verified the new arm **can fail pre-fix**, on a
different group mount and a different build (restored-pristine binary):

| invocation | pre-fix result |
|---|---|
| attribute-only (`-target spirv`, **no** `-entry`) | **255**, `slang-ir-glsl-legalize.cpp:2166` |
| positive control: CLI `-entry` | same assert |
| negative control: attribute EP catching internally | **exit 0** |

⇒ the arm is a **guard, not decoration**. ⭐⭐**A newly added test arm needs the same guard-proof as the
fix itself: show it FAILS on the pristine binary.** An arm that passes both pre- and post-fix is
indistinguishable from a comment. (Same standard the chain already applied to the fix — the novelty is
applying it per *arm*.)

Caret alignment re-verified after inserting `[shader("compute")]` (col 5 × 11, unchanged) — a diagnostic
test's carets are position-sensitive, so adding an attribute line is a coverage change *and* a layout risk.

## Documented limit, not hidden — the third designation path

Codex also surfaced that `EntryPoint::createDummyForDeserialize`
(`slang-check-shader.cpp:3180`, inside `createUnspecializedGlobalAndEntryPointsComponentType` at
`:3151`, for `compileRequest->m_extraEntryPoints` — **library-reference** entry points) has **no
`FuncDecl`**, so such an entry point cannot be validated by a check keyed on
`entryPoint->getFuncDeclRef()`. ✅**I verified this at pinned `d7d59f374` myself**: the call passes only
`name`/`profile`/`mangledName`, no decl. Correctly scoped out (an artifact that passed validation when
built is fine; only a module built by an *older* compiler could carry the old behaviour) and **written
into the PR body rather than omitted**. ⭐**A named, reasoned limit in the artifact is worth more than
silent completeness** — it tells a reviewer where the check does not reach.

## Related

[[feedback_a_count_can_answer_a_different_question_than_you_asked]] (the six observation-side instances) ·
[[feedback_a_shared_conclusion_stops_the_mechanism_audit]] (right conclusion / wrong mechanism, 4×) ·
[[feedback_slang_test_exits_zero_on_no_tests_run]] (a green suite that collected nothing) ·
[[project_12330_entrypoint_throws_not_diagnosed]]
