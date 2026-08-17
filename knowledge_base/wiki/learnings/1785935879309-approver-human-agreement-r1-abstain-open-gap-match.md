---
title: "[approver/human-agreement] R1 ABSTAIN/OPEN_GAP matched the human's CHANGES_REQUESTED 1:1 — untested-path gaps are worth abstaining on"
type: learning
topic: review-approval
source: learnings/1785935879309-approver-human-agreement-r1-abstain-open-gap-match.md
---

# [approver/human-agreement] R1 ABSTAIN/OPEN_GAP matched the human's CHANGES_REQUESTED 1:1 — untested-path gaps are worth abstaining on

# [approver/human-agreement] The two gaps I abstained on were the two things the human asked for

**The join.** On slangpy#1090 R1 (`5c384a20b11b`) I recorded
`ABSTAIN_POLICY / OPEN_GAP` on exactly two gaps:

- **G1** — the new `create_buffer_from_native_handle` API had zero *executing* test
  coverage at any slangpy layer (none added, none pre-existing, macOS CI build-only).
- **G2** — the API was exposed backend-generically from Python while size/handle
  validation was Metal-only; Vulkan and D3D12 type-check but never size-check.

~16h later a maintainer (`ccummingsNV`, MEMBER) submitted **CHANGES_REQUESTED**:

> "Is this Metal only, or will it work on other platforms...? If it is not
> implemented on other platforms we should probably throw not implemented. Can we
> also get a test in?"

That is G2 then G1, in order. Recorded via `record_human_verdict` — decision and
human agreed. The author's next push added precisely those two things: a
`native_buffer_handle_type()` guard + throwing `SGL_CHECK`s, and a real test.

**Why this is worth generalizing.** The pressure in shadow mode runs toward
approving: the code was well-formed, the refactor was faithful, CI looked green, and
the one bot finding was pre-existing. Nothing was *wrong* in the diff. The abstain
rested entirely on a **negative** — a code path with no executing test — and on
**uneven validation across backends** for an API exposed uniformly. Both are
absence-of-evidence signals, which are easy to talk yourself out of. A human
maintainer independently weighted them as blocking.

So: for a new API surface that wraps externally-owned resources, "no test executes
this path" and "validation depth varies by backend behind a uniform façade" are not
stylistic nits. They are the review comments a maintainer will write. Abstain.

**Vindicated downstream, too.** At R2 the newly-added test *crashed the process* on
Vulkan across 4 CI legs — the G2 blast radius landing concretely (an `Undefined`
resource state reaching a Vulkan barrier, because only some backends' import paths
call `fixupBufferDesc()`). The gap wasn't hypothetical; it needed only a test to
expose it. Related: [[approver-clause-gap-registration-is-not-execution]].

**How to apply.** When the change is clean but the coverage is absent, resist rounding
up. Score the gap on trigger reachability (is the untested path the PR's stated
purpose?) and blast radius (what does failure do — wrong answer, or memory
corruption?). Native-resource import scores badly on both. `OPEN_GAP` is the correct,
non-punitive state: it says "a human must look", and here the human looked and agreed.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785935879309-approver-human-agreement-r1-abstain-open-gap-match.md`_
