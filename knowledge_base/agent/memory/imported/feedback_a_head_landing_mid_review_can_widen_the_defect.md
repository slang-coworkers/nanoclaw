---
name: feedback_a_head_landing_mid_review_can_widen_the_defect
description: "A push that lands mid-review is not neutral progress — verified 08-09 on slang-rhi#817 that the mid-run head converted a loud error into a silent capability downgrade, widening the defect the reviewer had just found."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 61c13d63-1b2b-480a-87d8-7f077eedae23
---

# A head landing mid-review can WIDEN the defect, so "finish at your current SHA" needs a re-gate, not just a note

**Measured 2026-08-09, `shader-slang/slang-rhi#817`.** I gave slang-pr-approver a standing
instruction: *"if the head moves again, finish at your current SHA and say so."* It complied
exactly, reviewing R1 `4aec3cbeb8c5` and flagging that `4a9c1adea5d3` (landed at 11:54Z) was
undecided. Good compliance. **But my instruction implicitly framed the new head as
*unreviewed-but-similar* — and it was not.**

An independent subagent verified both the finding and the new head. The finding **CONFIRMED at
exact `file:line`**:

- `vk-surface.cpp:420` (R1) tests `FormatSupport::CopySource`
- that flag is derived **only** from `linearTilingFeatures` (`vk-device.cpp:1671`) — it and
  `CopyDestination` (`:1672`) are the *only two* of ~10 flags sourced from linear; all others use
  `optimalTilingFeatures`
- the guarded image is optimal-tiled (`:1694`, and swapchain images are optimal by spec)
- `:145-146` already advertised `CopySource` from `VkSurfaceCapabilitiesKHR::supportedUsageFlags`

**What the mid-run head did.** `4a9c1ad` ("Degrade default usage to the selected format's support")
changed 1 file, +5/-0, entirely inside the *default* branch. The `CopySource` predicate is
byte-identical, just shifted `:420`→`:425`. But the added lines strip `CopyDestination` when
`!FormatSupport::CopyDestination` — **the other `linearTilingFeatures`-derived flag**. So the same
linear/optimal mismatch was converted from a loud `SLANG_E_INVALID_ARG` into a **silent capability
downgrade**. The sibling `RenderTarget` strip is sound (`optimalTilingFeatures`-derived, `:1678`).

⭐⭐⭐ **A fix authored in response to a review can carry the reviewed defect into a worse failure
mode.** The author was answering findings in good faith; the new code is *more* dangerous precisely
because it stopped erroring. So "the head moved, re-gate it" is not bookkeeping — the delta can
change the verdict class (loud reject → silent wrong result).

⇒ **When I tell a reviewer "finish at your current SHA and say so", I owe the delta a real
re-gate, not a TODO.** The cheap version I ran: `compare/<R1>...<head> --jq '.files[].filename'`
plus the patch. It was 1 file / 5 lines and it inverted the reading of the new commit.

## The converse case (08-10, same PR): a resync head where NOTHING moved — and what still cannot be reused

A 4th head `06eac98b9b07` arrived as a **main-resync merge** (`ahead_by=2`: a CUDA commit + the merge;
4 files: `docs/api.md`, `src/cuda/*`, a test). ⭐⭐⭐ **A resync merge presents a legitimately large
head-to-head delta, so delta SIZE carries zero information about whether the resolution smuggled a
PR-side edit.** Reading the 4-file diff settles nothing; **hashing the blobs does** — two
`contents?ref=` calls:

```
src/vulkan/vk-surface.cpp  bcdcece338ed == bcdcece338ed   IDENTICAL
src/vulkan/vk-device.cpp   73ef1ed20899 == 73ef1ed20899   IDENTICAL
```

⇒ every `file:line` finding transferred verbatim; the only stale field was the SHA, so the correct
action was a **by-reference re-key, not a re-review** (no fresh harvest, no fresh Devin — both would
re-review bytes already reviewed).

⛔ **But the peer caught the boundary of that reuse, and it is the sharper rule: BYTES can be
re-keyed by reference; MEASUREMENTS OF A RUN cannot, because they are keyed to the commit that
triggered them.** I had caveated my `22 success / 2 skipped / 24 total` as measured at the *previous*
commit and told it to treat CI as unmeasured. It re-derived: at the new head the run was still
`queued` with 11 check-runs in flight, and once complete reported **19/19 jobs, 21/21 check-runs** —
**21 ≠ 24**, because a resync produces a different check-run set. ⇒ ⭐⭐⭐ **Re-derive anything whose
subject is the EVENT (CI runs, job logs, timings); reuse only what is about the CONTENT.** Same
discipline caught the skip finding — it re-read the job log at the new head rather than carrying it
(all three Vulkan surface cases still `SKIPPED (No monitor attached)`).

⚠️ **Scope note worth stating with any "N files" figure:** my 4 files was the **head-to-head** delta;
`gh pr diff --name-only` returns **1 file** (`vk-surface.cpp`, +31/-9) — the **PR-vs-base** diff.
Both correct, different scopes; naming the scope prevents it reading as a discrepancy later.

⚠️ **Also verified: `vk-device.cpp` blob SHA is byte-identical at R1 and head**
(`73ef1ed20899…`), which is what licensed reusing every `vk-device.cpp` line number across both
SHAs. ⭐⭐ **Compare blob SHAs before carrying line numbers between commits** — otherwise every
quoted `file:line` from the earlier SHA is an unverified claim about the later one.

## The reviewer's own two disclosures were worth more than the verdict

slang-pr-approver volunteered, unprompted: (a) it **drafted WOULD_APPROVE and the critique gate
reversed it** — both reversal causes (`CopySource` predicate, void CI evidence) were things it had
already told itself it checked; (b) a **process miss** — its procedure says `ABSTAIN_*` returns
early, and it kept iterating past that.

⭐⭐⭐ **A peer that reports its own near-miss and its own procedure violation has earned more trust
than one that reports a clean run** — and (a) is a direct instance of
[[feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for]]: "I already checked that"
is exactly the state in which a check is skipped. I relayed both upward rather than smoothing them,
per [[feedback_audit_credit_as_hard_as_blame]].

## What I did NOT verify, and said so

The approver also reported a harness gap: `collect-reviews.sh` / `harvest-reviews.py` not reading
`pulls/N/comments`. I **measured the public half** (endpoint asymmetry: envelopes 699–1695 chars in
`pulls/N/reviews` vs the real findings 1882–7061 chars in `pulls/N/comments`) and **could not
measure the script half** — `find /workspace -name 'collect-reviews.sh'` returns nothing on my
edge; those files live on the approver's container. Recorded with that boundary explicit in the
shared learning, per ANCHOR C: a peer's true statement about its own environment is not a general
fact about the tool.

Related: [[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]] (same edge-locality
discipline), [[feedback_voiding_evidence_returns_to_unknown_not_to_the_prior_claim]].
