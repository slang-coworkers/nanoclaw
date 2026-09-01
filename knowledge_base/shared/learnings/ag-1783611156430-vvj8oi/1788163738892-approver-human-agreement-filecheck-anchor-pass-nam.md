---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787911949735-xhge9a
written_at: 2026-08-31T08:08:58.892Z
---

# [approver/human-agreement] FileCheck anchor pass-name→position-regex relabels merge as-is when the author documents a revert-drill

**Confirmation (not a miss).** slang#12809: WOULD_APPROVE @`355d58265ab3` → MERGED AS-IS at that exact head (single commit, 0 interval commits), human `jkiviluoto-nv` explicitly APPROVED. Decision matched the human outcome.

**Transferable shape → SAFE.** A test/doc-only PR that changes only how a FileCheck test *anchors* — replacing a hard-coded pass-name label (`### AFTER <passName>:`) with a position regex (`### AFTER {{[A-Za-z0-9_]+}}:`) so the anchor binds to a pipeline *position* (e.g. "first post-link dump block") instead of an implementation-detail pass name — is low-risk and tends to merge unchanged when three things hold:
1. **The relabel does not weaken the substantive assertions.** Only the LABEL boundary moves; the positive `CHECK`/`CHECK-DAG` lines that assert content are unchanged, so the test asserts exactly what it did before, just anchored robustly. Verify the positive checks are byte-identical in the diff.
2. **Non-vacuity is demonstrable — "could it have come out otherwise?" → YES.** Here the fix itself is the proof: the tests went 22-RED on master when the old anchor stopped matching (a gated-out pass, #12336). A relabel motivated by a real red run is inherently non-vacuous. Where a `CHECK-NOT` region is bracketed by two labels (e.g. `layout-module-merged-by-linkir.slang`: `CHECK-NOT` between `### LOWER-TO-IR:` and the relabeled anchor), that bracket is the drift discriminator — it fails if the looser regex slides to a wrong block.
3. **Completeness is verifiable and complete.** Enumerate the whole bundle at head: zero leftover old pins anywhere, the new-regex count matches the PR's claim, and sibling tests that never used the anchor are untouched (no over-broad edit).

**Why the pass-name pin was wrong in the first place (the reviewer's mental model):** a dump header `### AFTER <pass>:` is emitted by `postPassHooks` from the stringified pass name, so a pass that is *skipped* (gated false on `RequiredLoweringPassSet`, or reordered/renamed) emits no header — pinning a test's anchor to a pass name couples it to pipeline trivia it doesn't actually assert. Tests that assert *a named pass's effect* legitimately keep the name; tests that just want "the first post-link snapshot" should use the position regex. This distinction is the crux — confirm the test's prose/purpose to tell which class it is.

**Probe that carried the decision:** the standing new-flag/gate positive-control probe is N/A for this shape (it introduces no flag/gate — it's the downstream test fix for an already-landed gate). The load-bearing check was non-vacuity (#2), exactly as Step-0 recall predicted for `-dump-ir` FileCheck relabels.
