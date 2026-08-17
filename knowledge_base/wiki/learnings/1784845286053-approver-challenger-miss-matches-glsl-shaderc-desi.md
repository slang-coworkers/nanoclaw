---
title: "[approver/challenger-miss] 'matches GLSL/shaderc' ≠ desired Slang behavior — a compile-time diagnostic relaxation is a DESIGN call maintainers may reject even when the code is correct"
type: learning
topic: slang-compiler
source: learnings/1784845286053-approver-challenger-miss-matches-glsl-shaderc-desi.md
---

# [approver/challenger-miss] "matches GLSL/shaderc" ≠ desired Slang behavior — a compile-time diagnostic relaxation is a DESIGN call maintainers may reject even when the code is correct

**Symptom:** PR #12138 (LDeakin, ext fork) relaxed `verifyComputeDerivativeGroupModifiers` so spec-constant `[numthreads]` axes combined with `[DerivativeGroupQuad/Linear]` were NO LONGER diagnosed at compile time (deferred to Vulkan pipeline-creation validation). My challenger judged this "correct + principled" because it matches GLSL `local_size_*_id` + shaderc behavior, and every bot reviewer (github-actions primary 0🔴, Devin 0/0, CodeRabbit) agreed the code was sound. I recorded ABSTAIN_POLICY:OPEN_GAP — withheld only on unrun external-fork CI + a `// CHECK_ERR:` test-annotation gap. Maintainers (jkwak-work, in a team meeting) CLOSED IT UNMERGED on 2026-07-23: "it is a desired behavior to print an error on the default value even when the variables might be overridden at runtime." Their prescribed fix is for the USER to change the spec-const default (1→2), NOT to relax the compiler check.

**Root cause:** I conflated "correct/consistent-with-another-toolchain" with "the behavior Slang wants." A diagnostic that fires on the compile-time DEFAULT value of an overridable spec constant is a deliberate ergonomic/safety choice — the default is what the shader ships with if nobody overrides it, so validating it is a feature, not a bug. "shaderc/GLSL allows it" is evidence about GLSL's design, not Slang's. My challenger treated the cross-toolchain precedent as dispositive of correctness; it isn't dispositive of DESIRABILITY, which is the maintainers' call.

**How to catch it:** When a PR REMOVES or RELAXES a diagnostic (especially a `verify*`/`diagnose` gate), treat "is this the behavior we want?" as an OPEN question for the maintainers, not something the challenger settles by citing another compiler. Flags: (1) the change deletes an error path rather than fixing wrong codegen; (2) the justification is "tool X accepts it"; (3) the rejected input is a compile-time-known default of a runtime-overridable value (the default is still meaningful). Any of these → the correctness of the CODE does not establish the correctness of the DECISION to relax; lean ABSTAIN on design-scope (CHALLENGER_CONCERN or OPEN_GAP), and say explicitly in the challenger notes "this is a language-design judgment for maintainers, not a code-correctness question."

**Fix / calibration:** ABSTAIN_POLICY(OPEN_GAP) here was NOT a false-safe (I withheld → human verdict CHANGES_REQUESTED = agreement in direction). BUT it was withheld for the WRONG reason (CI/test verification), while the real kill was design. Had CI been green, my "code is correct + principled" challenger would likely have produced WOULD_APPROVE → a genuine false-safe. The lesson is not "the abstain was right" but "the challenger's correctness verdict was wrong on the axis that mattered." Diagnostic-relaxation PRs from external contributors that lean on cross-toolchain precedent are a recurring design-scope class — abstain on the design question itself, don't let a clean bot review + toolchain-precedent round the challenger up.

**Also:** verify-close-before-scoring held up again — closed_by=jkwak-work (maintainer), zero human REVIEWS (all "reviewed" timeline events were bots), state closed/merged=false; the closing COMMENT carried the rationale. Always read the closing comment on an unmerged close; it's where the real verdict lives when there are no formal reviews.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784845286053-approver-challenger-miss-matches-glsl-shaderc-desi.md`_
