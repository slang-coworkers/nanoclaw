---
name: feedback_a_newly_green_suite_needs_the_expectation_set_diffed
description: "A suite that went red→green proves nothing until you know the expectations didn't move. Hash the test file when it's untouched; when it changes alongside the impl, diff the test-NAME SET and count removed lines. nanoclaw#1150 R3/R4."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a5b972af-7843-4f33-bba2-5d5f162f197f
---

# A red→green suite is only evidence once you know the expectations didn't move

**Measured 2026-08-09 across nanoclaw#1150 R3 and R4.** Both rounds handed me a suite that had just
gone green on the blocker I'd raised. ⭐⭐⭐**"The tests pass now" is compatible with two very different
events: the implementation was fixed, or the expectation was relaxed to meet it.** A green run cannot
distinguish them, and the cheap read — scrolling the diff — is exactly where a weakened assertion
hides.

## Two checks, and which one applies depends on whether the test file moved

**R3 — test file UNTOUCHED.** One command settled it: `git rev-parse <old>:<testfile> <new>:<testfile>`
→ **identical blob** (`8f36911df813` at both heads). ⇒ the expectation provably could not have moved,
so the impl did. ⭐⭐**Hashing the test file is the cheapest possible version of this check — use it
whenever it's available.**

**R4 — test file CHANGED (+57 lines, 9 → 13 tests).** The hash check was **unavailable**, and its
absence is not a reason to skip the question. Replacement, mechanical rather than eyeballed:

```
git diff <old>..<new> -- <testfile> | grep -cE '^-'      # removed lines → expect ~0
comm -23 <(old test names | sort) <(new test names | sort) # dropped/renamed → expect EMPTY
```
Extract names with `grep -oE "it\('[^']*'"`. R4: **1** removed line (whitespace), name-set difference
**empty**, 4 added ⇒ nothing relaxed, purely additive.

⇒ ⭐⭐⭐**A renamed test is a deleted test wearing a disguise, and a diff read is bad at spotting one
among +57 lines. Set difference over names is immune to reordering, reindentation, and volume.**

## Then check the NEW tests can fail

Additive tests still need to earn their green. ✅**Mutation drill: break the specific thing each new
test claims to pin, and require that ONLY that test fails.** R4: removing `smoke: ['--version']` from
`REQUIRED` failed only the "requires a smoke command" test; deleting the `check:runtime-deps` line from
`merge-train.sh` failed only the "runs the runtime-deps check" test; restore → 13/13. ⭐⭐**One
mutation per new test, with the blast radius checked — a mutation that fails three tests means they
overlap; a mutation that fails none means the test is decorative.**

## Why this is worth the two minutes

R4's own commit closed a hole my R2 and R3 passes had **certified as healthy**: a package directory
with no `package.json` still resolves a deep file, so R3 printed `ok … "resolve, belong to this
checkout, and run"` (rc=0) where R4 correctly says `DAMAGED INSTALL` (rc=1). ⇒ ⭐⭐**My earlier green
was itself an unexamined expectation.** The discipline that catches a relaxed assertion in someone
else's patch is the same one that would have caught my own missing case.

Related: [[feedback_a_local_green_is_an_environment_claim_too]],
[[feedback_a_guard_must_run_where_the_failure_is_silent]],
[[project_nanoclaw_1150_ccusage_own_nvmain]].
