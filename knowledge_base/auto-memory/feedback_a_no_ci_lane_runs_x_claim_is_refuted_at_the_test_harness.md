---
name: feedback_a_no_ci_lane_runs_x_claim_is_refuted_at_the_test_harness
description: "A \"no CI lane runs <binary>\" claim must be checked at the test harness that spawns the binary, not by grepping workflow YAML — grepping .github/ finds only lanes that name it, missing every lane that runs it via the test driver."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 40bd584e-08e5-4c7d-a174-bdeb7529246d
---

**Measured 2026-08-10, shader-slang/slang#12136.** `slang-pr-approver` reported a real
untested gap in the language server and justified its invisibility as
*"all 48 green check-runs are structurally blind to it — **no lane runs `slangd`**."*

The gap was real; the reason was false. `slangd` **is** executed in CI:
`tools/slang-test/test-context.cpp:268` `createLanguageServerJSONRPCConnection`
spawns `ExecutableLocation(exeDirectoryPath, "slangd")` for every
`//TEST:LANG_SERVER` directive, and `ls tests/language-server | wc -l` → **79**
such tests, driven by the ordinary `ci-slang-test.yml` lanes.

**Why the wrong reason is reachable:** grepping `.github/workflows/` for `slangd`
returns only lanes that *name* the string — a staging `cp` and two
`-DSLANG_ENABLE_SLANGD=OFF` lines. A lane that runs the binary through a **test
driver** never names it. The grep's hits look like a complete census and are a
census of mentions.

⭐⭐⭐**A "nothing exercises X" claim is a claim about the TEST HARNESS, so it must
be measured there.** Workflow YAML names lanes; the harness names what lanes
actually invoke. Grepping the wrong artifact yields a true statement about
mentions dressed as a statement about execution.

⇒ **Detector:** grep the test driver for the binary name / spawn call
(`Process::create`, `setExecutableLocation`, the directive→runner table) before
asserting any lane does or does not run it. Then narrow to the *entry point*:
here the honest scope was **two untested entry points**, not an absent binary —
`--print-builtin-module` has **1** reference repo-wide (`tools/slangd/main.cpp:19`,
zero tests) and `slang-synth` (goto-def into a builtin) appears in **0** tests.

This is another instance of [[feedback_a_control_validates_the_instrument_never_the_target]]'s
family — a correct measurement of the wrong object — and of the carve-out in
ANCHOR F: **a correctly-stated finding aimed at the wrong scope.** The verdict it
supported (`ABSTAIN_POLICY` / `OPEN_GAP`) survived; only the maintainer's
next-action framing changed. Correcting scope on a peer's *true* finding is still
worth shipping, because the wrong reason routes the fix to the wrong place —
"add a slangd CI lane" vs "add a test for these two entry points."

See also [[feedback_zero_hit_grep_has_never_o]] and
[[feedback_published_negative_env_claims_need_rederivation]] — a capability-negative
has no failure signature; readers comply by not attempting.
