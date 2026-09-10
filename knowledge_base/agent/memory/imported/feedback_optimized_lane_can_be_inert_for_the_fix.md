---
name: feedback_optimized_lane_can_be_inert_for_the_fix
description: An optimized test lane can verify the end state while proving nothing about the mechanism the fix changed
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6f619349-0ea3-4cf3-977d-4a8b6c4b3e69
---

# An optimized lane can be INERT for the fix it's supposed to test

A test lane that runs with optimization on can pass **for reasons unrelated to your fix**. If the
optimizer folds away the very construct the patch manipulates, the lane verifies the *end state* and
says nothing about the *mechanism*. It is green, it looks like coverage, and it would stay green if
the fix were reverted — a [[feedback_name_what_you_held_fixed]] failure wearing a passing badge.

**How to apply — for any fix to a transform/legalization/lowering step:**
- Ask: **at this optimization level, does the construct I changed still exist by the time the check
  runs?** If the optimizer already resolved it, the lane cannot demonstrate the mechanism.
- Require an **unoptimized lane** that observes the intermediate form (e.g. `-O0` disassembly with
  SSA ids bound), and keep the optimized lane only as an end-state check — label which is which.
- **Enumerate the ops/paths the patch adds and confirm each is genuinely exercised.** An op added
  alongside others can ride along untested; a lane hitting 4 of 5 reads as full coverage.
- **Revert-test the lane:** if it still passes with the fix backed out, it isn't testing the fix.

**`CHECK-NOT` must be BOUNDED.** An unbounded / end-of-file-bounded negative check silently misses an
occurrence sitting immediately before the positive it should exclude. Bracket the `-NOT` between two
positive anchors that span the region of interest (e.g. `OpLabel` … `OpFunctionEnd`) — otherwise the
thing you're excluding can reappear exactly where the bug would reappear and the check stays green.

## The root rule: verify a test under the HARNESS'S OWN INVOCATION

Three sibling defects on one PR turned out to be the same mistake — a vacuous `CHECK`, a `-NOT`
bounded to EOF, and a check verified at the wrong optimization level. All three passed when run the
author's way and were wrong under the way the test suite actually runs them.

**So: run the test the way the harness will, with the exact flags/lanes it will use, and confirm it
FAILS with the fix reverted.** Hand-running the compiler with your own flags proves almost nothing
about a directive-driven test. On this PR the `-O0` ask found a genuine CI failure in
`desc-handle-nv-bindless-const-cast.slang` **before CI did** — the whole yield of taking this
seriously.

**Origin:** shader-slang/slang#12185 → PR #12186 (2026-08-03). The fix makes a global initializer
legally sinkable (`isInlinableGlobalInst`). pdeayton caught that the single `-O1` lane was **inert**:
at `-O1` both bitcasts have already folded, so the lane could never show the initializer was sunk.
Close-out now requires three lanes — `-O0` spirv-asm with SSA ids bound, `-O0` binary via
`-o <file>`, `-O1` folded `OpConstant` — plus proof that `kIROp_Select` (one of five ops the PR adds)
is actually exercised rather than riding along. The `CHECK-NOT` bounding rule came from the same pass:
an end-of-file-bounded `-NOT` missed a bitcast sitting right before the `OpIAdd`, precisely where the
removed bridge would reappear.

---

## → 2026-08-07 instances moved out (size limit)

Nine entries recorded 2026-08-07 — the `diag=` matcher, the drill's own blind spot, prose-has-no-instrument,
the freshly-fixed-regex zero, delegated-probe control loss, probe-vs-verdict, the state-claim symmetry, and the
costs-nothing-to-leave-standing rule — now live in **[[feedback_an_assertion_that_cannot_fail_2026_08_07]]**. This file crossed the 24,986-byte Read
limit, which truncates the newest content first.
