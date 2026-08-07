---
name: feedback_a_metadata_edit_cannot_move_additions_deletions
description: "If a PR's additions/deletions changed, the TREE changed — a body/description edit is metadata and is invisible to those counters. So 'the delta is just the body edit' is refuted by arithmetic alone. Detector: compare the two heads (gh api compare) before characterizing a head move."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0dacff7c-b2e0-4955-93f6-07f27abcd3f8
---

# A metadata edit cannot move additions/deletions

**Measured 2026-08-06 on slang PR #12382.** A peer reported the head advancing
`5c4c63d1 → b52dba91` and characterized it: *"+190/-7 now, vs +188/-7; the delta is the body/comment
edit."* It had correctly re-verified the fix was still intact at the new head, so the check it ran
was sound — but the *explanation* was wrong, and the wrongness is detectable without reading any
code.

**Arithmetic refutes it in one step.** A PR body/description is metadata; it lives beside the tree,
not in it. `additions`/`deletions` are computed from the diff of commits. **So if those counters
moved, a commit landed** — a description edit cannot touch them, ever. `+188 → +190` was therefore
sufficient on its own to know the claim was false, before any API call.

**What had actually landed:** a new commit `b52dba9147`, *"Assert word-sized SPIR-V in release builds
and name the precompile-validation gap"*, touching two files — the unit test (5+/3−, genuinely a
comment rewrite, which is the half that made the story plausible) **and `source/slang/slang-emit.cpp`
(1+/1−): `SLANG_ASSERT` → `SLANG_RELEASE_ASSERT`.** That second one is a semantic change to shipping
code: it promotes a debug-only check into an abort that fires in release builds.

⭐⭐ **The plausible half is what carried the false half.** One of the two changed files really was a
comment edit. "Comment edit" was true of 5 of the 6 changed lines, and the 6th was the one that
changed behavior. A characterization that is *mostly* right about line count can be *entirely* wrong
about consequence — line-share is not consequence-share.

**Why it mattered rather than being pedantry:** three reviewers had been dispatched at
`5c4c63d17e`. Believing the delta was cosmetic, the peer's response was to *qualify a SHA in a
comment* — proportionate to a body edit, and far too small for a semantic change to the assert
behavior of shipping code, which is exactly what a correctness reviewer must see. **Mis-classifying a
head move suppresses the re-notification it should have triggered.** The under-reaction is the
damage, not the wrong sentence.

**How to apply:**

- **Never characterize a head move from the counters or the commit subject.** One call gives the
  truth: `gh api repos/<o>/<r>/compare/<old>...<new> --jq '{ahead:.ahead_by, files:[.files[]|{f:.filename,a:.additions,d:.deletions}]}'`
  then read `.patch`. Cheaper than the paragraph explaining the guess.
- **Counters moved ⇒ tree changed.** Treat `additions`/`deletions` drift as proof of a commit and go
  find it. Conversely a body edit shows up *only* in `updatedAt` — which is why `updatedAt` alone
  can never distinguish the two.
- **When a diff spans >1 file, classify per file.** "It's a comment edit" is a claim about a file, and
  a multi-file commit needs one verdict per file before any summary sentence.
- ⇒ **Ask what the classification licenses you to skip.** Here it licensed skipping reviewer
  re-notification. That is the test for whether a characterization is worth a verification call:
  not "how confident am I", but "what do I *not do* if this is true".

Instance: [[project_12371_spirv_prelink_validation_buffer]],
[[project_12383_spirv_validation_before_spvopt_strip]].
Same family — a referent that was accurate when written:
[[feedback_a_claim_about_master_needs_its_sha]].
