---
title: "[approver/human-agreement] BLOCK on a latent-but-real payload-validation gap was vindicated — author added the exact guard before merge"
type: learning
topic: review-approval
source: learnings/1784141964975-approver-human-agreement-block-on-a-latent-but-rea.md
---

# [approver/human-agreement] BLOCK on a latent-but-real payload-validation gap was vindicated — author added the exact guard before merge

**Context:** slang#11979 (examples: shader-coverage-backends). I decided BLOCK on rev1 (`df93653bce92`) and rev2 (`2bd14efb01a1`) over one 🔴: `runCpu()` built the CPU dispatch payload sized `uniformOffset + sizeof(CpuBufferView)` and wrote `outputView` at offset `sizeof(CpuBufferView)` with no check that `uniformOffset` was large enough — trusting the metadata-reported offset without a lower-bound guard (OOB-write risk, latent because the supported layout gives uniformOffset==32). rev3 grew past the size cap → ABSTAIN_POLICY, and I carried the finding forward as context for the human, noting the new `runCuda()` replicated the same pattern.

**Outcome (join):** PR MERGED 2026-07-15 by jvepsalainen-nv at head `6233709c0329` (merge commit `336dd0f4`). Commit `33a61982f82e` ("Address review: assert documented counter values and payload-layout checks") added EXACTLY the guard I recommended, in BOTH paths:
```
if (program.resourceInfo.uniformStride != int32_t(sizeof(CpuBufferView))) fail(...);
if (size_t(program.resourceInfo.uniformOffset) < 2 * sizeof(CpuBufferView))
    fail("coverage buffer uniform offset overlaps the user buffers' payload");  // runCpu:472 AND runCuda:595
```
plus a comment tying it to "instead of letting a regressed offset turn into an out-of-bounds write" — the exact failure mode I described. All three decision rows recorded APPROVED (merge = APPROVED-equivalent); this is agreement, not a false-safe.

**Transferable lesson — the class of signal that was worth blocking on:** a host-side buffer/payload built at a *metadata-reported offset/stride* with only a sign/null guard, where the code hard-assumes a specific field-packing layout. Even when it's LATENT (doesn't fire on the supported path today), it is a legitimate BLOCK/flag: the offset is external input (compiler metadata that can change across versions/targets), and "the layout happens to work now" is not validation. The conservative-lean paid off — the author agreed it was worth a defensive guard. When reviewing similar host-integration/marshaling code (CPU host-callable payloads, CUDA `SLANG_globalParams`, descriptor binding), probe: "is every metadata-derived offset/stride/size validated against the buffer it indexes before the write, or just assumed?" A missing lower-bound check on a trusted-metadata offset is the pattern to flag.

**Second lesson — carried-forward context is worth recording even when it doesn't drive the verdict.** On rev3 the size-cap FAIL short-circuited before the challenger, so the 🔴 was NOT in that verdict — but I recorded it as "context for the human reviewer." The human then fixed exactly that. Surfacing a known finding as non-verdict context (clearly labeled) still adds value at the human-review handoff.

**Third lesson — verify the join SHA against live GitHub.** By merge time the PR had advanced ~9 commits past my last-decided head (2d2364879b54), across a day boundary (my decisions 07-14, merge 07-15). The merged head (6233709c0329) matched none of my decision rows. I joined the APPROVED verdict to my actual decision commits, not to the merged head — and read the merged source to confirm the fix, rather than assuming from commit messages.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784141964975-approver-human-agreement-block-on-a-latent-but-rea.md`_
