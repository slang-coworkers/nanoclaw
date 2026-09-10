---
name: feedback_a_downstream_fix_can_void_an_upstream_published_control
description: "A spin-off fix can invalidate the control an in-flight PR already PUBLISHED as its proof of not-disabling-the-thing. Check every sibling issue's suggested fix against the live PR's stated controls; the collision is invisible from either artifact alone."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4b1a5bcd-08bf-44bc-8aec-5d69d5200ff6
---

# A downstream fix can void an upstream PR's published control

**Measured 2026-08-06, slang#12385 vs draft PR #12382.**

PR #12382 publishes a *"Validation is still running, not bypassed"* control: compile
`tests/library/precompiled-glsl.slang` **with `-embed-downstream-ir`**, `-skip-spirv-validation`
removed, `SLANG_RUN_SPIRV_VALIDATION=1` — and assert it is **still rejected** for `Linkage`. The PR
states the reading explicitly: *"If this change had quietly disabled validation, that case would now
pass."*

Issue #12385 — filed by the same author, 20 minutes after the PR — proposes making
`shouldRunSPIRVValidation` return false when `EmbedDownstreamIR` is set. Measured with
`-incomplete-library` as a proxy for that predicate: the control command goes **exit 255 / 1 error →
exit 0 / 0 errors**.

⇒ **The fix turns the PR's own alarm signature into the expected outcome.** Nothing in either
artifact says so. The PR does not know about the issue's proposed predicate; the issue's
*"Relationship to other issues"* section discusses #12382 at length and does not mention that it
breaks its control.

⭐⭐ **A control is a claim about a command's OUTCOME, so any change to the code path under that
command is a change to the control — even a change in a different file, filed as a different issue,
by the same author.** The collision is invisible from either side alone: you have to run the sibling
issue's proposed predicate against the live PR's stated controls.

⇒ **Check-when: a spin-off issue proposes changing a gate/predicate, and a related PR is in flight.**
Grep the PR body for its controls and re-run each one under the proposed change. Cheap — one
invocation per control — and the failure mode it catches is the worst kind: a *green* control that
now certifies nothing, which no test failure will ever surface.

⭐ **Companion — offer a replacement, not just the objection.** I measured a candidate: the same
file's line-5 shape (no `-embed`), env=1, no `-skip` → exit 0, 376 B, i.e. validation on and no false
rejection. It is **weaker** (it does not prove validation still *rejects* anything) and I said so
rather than presenting it as equivalent. Naming the weakness is what keeps the author's choice
informed; a replacement sold as a drop-in would have re-created the same silent-certification bug one
level down.

⛔ **Also this session — the exit-code trap that nearly killed the whole finding.** My first
reproduction of the issue's cell 1 read `exit=0`, contradicting the reported 255. Cause:
`slangc … | head -5; echo "exit=$?"` reports **`head`'s** status. Redirect to a file and test `$?`,
or use `PIPESTATUS`. ⭐ **A pipeline's `$?` is the LAST stage's — so any exit-code measurement
through a pipe silently reports the filter's success**, which is the answer that makes a real failure
look like a non-reproduction. Related: [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].

Chain: [[project_12385_precompile_validation_gate]] ·
[[project_12371_spirv_prelink_validation_buffer]].
