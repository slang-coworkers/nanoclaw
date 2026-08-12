---
title: "[approver/human-disagreement] CONFIRMED agreement — DDS/texture subresource-math fix with exact-offset tests + merged data submodule"
type: learning
topic: review-approval
source: learnings/1784561186392-approver-human-disagreement-confirmed-agreement-dd.md
---

# [approver/human-disagreement] CONFIRMED agreement — DDS/texture subresource-math fix with exact-offset tests + merged data submodule

**Outcome:** shader-slang/slangpy#1049 (DDS loader mipmap-pitch / 3D-depth fix). Shadow decision WOULD_APPROVE; human jhelferty-nv APPROVED the same head 6fd917aa. **Direct agreement (approve/approve).** Recording the *class* of signal for calibration, not the instance.

**Class of change:** a bug-fix to binary-asset subresource/offset/size math (pitch, mip clamp, 3D depth accumulation, per-mip upload size) in an image/texture loader, where the diff is small (~180 lines, 4 files) and the risk is silent wrong offsets / out-of-bounds rather than a crash.

**What made this safely approvable (probe these on similar changes):**
1. **Every arithmetic assertion in the new tests is hand-verifiable against the new code.** For offset/pitch math, don't trust "tests pass" — recompute the expected offsets yourself from the formula and confirm they equal the test's literals. Here mip clamp (`max(1u,dim>>mip)`) had to be present on BOTH width (`get_row_pitch`) AND height (`get_subresource_pitch` row_count) or high mips give slice_pitch 0; both were present.
2. **The removed code was the bug.** decode_header previously *overrode* a correctly-computed pitch with a rounding-buggy manual calc (`row_pitch*height/block_height` truncates for block-compressed). Deleting an override that recomputes worse is a strong positive signal.
3. **Test-data dependency actually landed.** The tests load new .dds files from a `data` git submodule. Verify the submodule pointer is bumped to a commit that (a) exists, (b) contains the referenced files, (c) is merged to the data repo's default branch (`gh api .../compare/main...<sha>` → identical). A human's CHANGES_REQUESTED here was exactly "use the merged data files" — the fix was the submodule bump.
4. **3D layer/slice semantics:** confirm `layer_count==1` for 3D (depth is folded into one subresource's `.size = slice_pitch*mip_depth`, not iterated as separate layers). Getting this wrong = wrong upload size.

**Non-blocking cautions that did NOT change the call (relaxed policy require_ci_green=false):** CI build matrix still settling on a fresh merge-of-main head; fallback tier (no production github-actions review, only stale CodeRabbit + head-current Devin). Both were mitigated by the hand-verified math + Devin corroboration. On a stricter policy, unsettled CI on the machinery under test would warrant waiting, not approving.

**Head-move gotcha:** a `synchronize` that is a pure "Merge branch 'main'" produces a new head SHA but a byte-identical PR-authored diff (`base...head`). Re-pin and record against the new SHA, but the code investigation carries over verbatim. Confirm protected-path clauses read the PR's OWN diff, not the merge delta (which includes everything main brought in, e.g. .github/**).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784561186392-approver-human-disagreement-confirmed-agreement-dd.md`_
