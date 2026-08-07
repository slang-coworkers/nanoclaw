---
name: feedback_a_finding_against_a_superseded_head_needs_re_siting
description: "A reviewer's finding is a claim about the SHA it read. When the branch has advanced, re-site each finding at the live head before acting: measured 2026-08-06, a 4-reviewer-corroborated -Wassume hazard was already dead at the new head, while a second half of the same recommendation stayed valid. Corroboration count says nothing about currency."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0dacff7c-b2e0-4955-93f6-07f27abcd3f8
---

# A finding against a superseded head must be re-sited before you act on it

**Measured 2026-08-06 on shader-slang/slang PR #12382.** A reviewer pipeline reported a finding
escalated to *"the fix you already pushed is incomplete"*, backed by **four independent reviewers**
and relayed with a concrete patch to apply. Its stated mechanism:

> `SLANG_ASSUME` does not evaluate its operand … your operand is `spirvBlob->getBufferSize()`, a
> virtual call … Clang's `-Wassume` diagnoses a side-effecting operand, and Slang builds
> warnings-as-errors, so this is a build risk. `SLANG_RELEASE_ASSERT` alone does not fully address
> it.

**The review read diff sha `3d4dcb58302f`, matching head `5c4c63d1`. The live head was `b52dba91`.**
Re-sited at the live head:

- `SLANG_RELEASE_ASSERT` (`source/core/slang-common.h:374-379`) is **unconditional** — no
  `#ifdef _DEBUG`, and it never expands to `SLANG_ASSUME`. It evaluates its operand inside
  `if (!(VALUE))`. ⇒ **The `-Wassume` hazard cannot fire there.** The commit that landed between the
  two heads had already replaced `SLANG_ASSERT` with `SLANG_RELEASE_ASSERT` at that exact line, so
  *"`SLANG_RELEASE_ASSERT` alone does not fully address it"* was false at the head the fixer was
  actually on.
- **The other half of the same recommendation survived.** `getBufferSize()` is still called **twice**
  in that block (`:3433` and `:3435` at `b52dba91`), so the hoist-into-a-local is still worth doing —
  for the redundant virtual call, not for a warning hazard.

⭐⭐ **One recommendation, two halves, opposite currency — and they arrived fused.** "Apply the hoist"
was correct; the *reason* given for it was dead. Accepting the bundle wholesale would have propagated
a false build-risk claim into a PR body under maintainer review; rejecting it wholesale would have
dropped a real cleanup. **Neither accept nor reject: re-site each claim.**

**Why corroboration didn't help.** Four reviewers agreeing raised my confidence in the *mechanism* —
and the mechanism was sound as a statement about `SLANG_ASSERT`. What no amount of agreement could
establish is **which SHA it applied to**, because all four read the same superseded diff. ⇒ **Agreement
count is evidence about correctness, never about currency.** Reviewers dispatched at time T share T's
tree; their independence is real and their staleness is *perfectly correlated*.

**How to apply:**

- **Before acting on any review finding, compare the reviewed SHA to the live head.** If they differ,
  `gh api repos/<o>/<r>/compare/<reviewed>...<live>` and check whether each finding's cited lines are
  in the diff. Findings touching changed lines need re-derivation; the rest carry over.
- **Re-site per claim, not per report.** A single recommendation can mix a live defect with a dead
  rationale, as here.
- **When relaying, say what the finding was measured against**: *"at `5c4c63d1`; the hoist still
  applies at `b52dba91`, the warning hazard does not."* A finding stated without its SHA is
  unfalsifiable later.
- ⚠️ Note the asymmetry that makes this dangerous: a stale finding usually *over*-reports (the defect
  was fixed), so the failure mode is **wasted work plus a false public claim**, not a missed bug. That
  makes it feel safe to just apply, which is why it survives.

Instance: [[project_12385_spirv_validation_precompile_overfire]],
[[project_12371_spirv_prelink_validation_buffer]]. Companion on the same PR:
[[feedback_a_metadata_edit_cannot_move_additions_deletions]] (the head move that created the skew),
[[feedback_slang_assert_becomes_assume_in_release_not_a_skipped_check]] (the macro semantics the
finding was right about).
