---
title: "[approver/challenger] Partial-fix revision: one sibling patched, the other left inconsistent — verify EACH call site, don't assume a fix propagated"
type: learning
topic: review-approval
source: learnings/1785490973077-approver-challenger-partial-fix-revision-one-sibli.md
---

# [approver/challenger] Partial-fix revision: one sibling patched, the other left inconsistent — verify EACH call site, don't assume a fix propagated

**Symptom:** On slangpy#1075 R7 (`52a6c5e`), a "Fix …" commit finally touched the reviewed file after several no-op merge heads. It applied the exact suggested off-by-one fix to `create_textures` (`if ((i+1) % BATCH_SIZE == 0 && (i+1) < size())` + `device->wait()`), but the SIBLING function `create_texture_array` was left with BOTH the old off-by-one form AND no `device->wait()` at all. A reviewer skimming "the fix commit landed" would wrongly assume the whole class of concern was addressed.

**Root cause / transferable class:** When a codebase has N near-duplicate call sites doing the same batched-resource pattern, an author fixing "the bug" often patches the one site the reviewer commented on and misses the structurally-identical sibling. The two functions become inconsistent — which is itself a tell (the author demonstrably KNEW the fix; they just didn't propagate it).

**How to catch it:** Never infer "gap fixed" from a "Fix …" commit message or from one reviewer no longer flagging it. Grep the whole file for the pattern (`BATCH_SIZE`, `device->wait()`, `submit_command_buffer`) and read EVERY loop body at the pinned head. Confirm the fix at each call site independently. Cheap decisive signal for material-vs-no-op: compare the reviewed file's git BLOB SHA (`gh api contents/<path>?ref=<sha> --jq .sha`) against the prior head's — identical = no-op merge, different = real change to inspect.

**Calibration nuance (firmed-up gap that still stays OPEN_GAP, not a hard-fail):** At R5 the array-path gap was Devin-only and I held it partly on "the array path is ONE descriptor for a texture_2d_array, so maybe it doesn't hit the sampler-heap mechanism at all." At R7 CodeRabbit independently corroborated Devin on the same path AND supplied the missing mechanism (per-item `blitter->generate_mips()` inside the UNWAITED batch loop is real descriptor/blitter activity). That falsified my hedge — the concern is real and reachable. But the decision CATEGORY still stayed OPEN_GAP (abstain), not a verified defect, for three reasons worth reusing: (1) it's a load/driver-dependent resource-exhaustion RACE I could not reproduce (the path still flushes every BATCH_SIZE, it just doesn't block); (2) fallback tier (no primary claude-code-action review) mandates extra caution, uncertainty ⇒ abstain; (3) "a gap that undermines the PR's stated purpose" is an EXPLICIT open-gap trigger in the procedure, distinct from "verified defect". Lesson: independent two-reviewer corroboration + an explained mechanism raises confidence the gap is REAL, but a hard-fail verdict requires a VERIFIED (ideally reproduced) defect — corroboration of a plausible-but-unreproduced race is still an open gap. Don't round a firmed-up gap up to a hard-fail, and don't round it down to a clear. See [[slangpy-1075]].

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785490973077-approver-challenger-partial-fix-revision-one-sibli.md`_
