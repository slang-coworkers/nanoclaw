---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1785785115619-hptgyc
written_at: 2026-08-11T07:33:06.210Z
---

# [approver/human-disagreement] slangpy#1090 merged over an open CHANGES_REQUESTED with my abstain-gap unfixed — what a documented-precondition gap is worth

# [approver/human-disagreement] Merged with the gap intact — calibrating what "OPEN_GAP" buys

**The join.** slangpy#1090 merged 2026-08-11 by `skallweitNV`. Merge ⇒ APPROVED-equivalent,
so my final `ABSTAIN_POLICY / OPEN_GAP` at `f906a11983f8` **disagrees with the human outcome**.
Worth writing down precisely, because parts of my read were vindicated and one part was not.

**What the humans did between my decision and the merge** (`git log f906a119..88bacb65`, then
reading the squashed commit's own diff): the merger rebased and squashed the branch himself
("I took the liberty to rebase/cleanup this PR so we can hopefully merge it"), and the shipped
change *grew*: CUDA device-pointer import added (`native_handle_traits.h` +
`NativeHandle.from_cuda_device_ptr`, and `cuda` added to `native_buffer_handle_type()`), plus
regenerated `py_doc.h` — which is exactly the 🔵 nit Devin had raised about the docstring
bypassing the generated-docs mechanism. So two of the review's minor findings were absorbed.

**The gap I abstained on shipped unfixed, and verifiably so.** In the merged tree,
`device.h` still documents *"The size must not exceed the native allocation"*, and the import
ctor's guards are still only: backend-implemented, handle valid, handle-type matches, no init
data. No size check in the SGL layer, and none in the three (now **four** — CUDA joined)
non-Metal rhi import paths. So the documented precondition remains enforced on 1 of 5
supported backends. Adding CUDA *widened* the gap while the PR merged.

**Calibration, stated honestly.** A documented-precondition-not-enforced gap, pre-existing
upstream, with an out-of-bounds blast radius, was **not** merge-blocking for this maintainer
group — and I flagged it at R1, R3 and R4 and it was never addressed at any of them. Two
readings, and I can't distinguish them from the evidence: either the team judged a caller
precondition acceptable for a low-level zero-copy interop API (defensible — this is the normal
contract for native-handle import everywhere), or nobody ever saw the finding, because **I
never post to GitHub** and the only human input on the thread was the author's own two comments
plus the merger's one-liner. In shadow mode the second is at least as likely as the first.
That is a limit of the harness, not evidence that the finding was wrong — but it does mean I
should not read this merge as "the gap was considered and dismissed."

**The transferable rule.** For a *new low-level interop API*, distinguish two gap classes:
- **contract-shaped**: the doc states a caller precondition the callee doesn't enforce, matching
  how the surrounding API family already behaves. Evidence here says this is **not** treated as
  merge-blocking. Report it, but expect approval; `OPEN_GAP` is defensible yet will read as a
  false-positive against the outcome.
- **claim-vs-code contradiction**: code that crashes, corrupts, or contradicts its own tests.
  That *was* merge-blocking here — my R2 BLOCK on the aborting Vulkan test was fixed upstream
  within hours and the fix shipped.

Sharpen the next call by checking, before abstaining on an unenforced documented precondition,
whether **sibling APIs in the same family** enforce theirs. If they uniformly don't, the
precondition is the house style and the gap is advisory. If this one is the outlier, it's a real
inconsistency worth abstaining on. I did not run that comparison, and it is the cheap check
that would have told me which class I was in.

**Also confirmed as correct across four revisions** (worth keeping): the R2 BLOCK, the
"registration ≠ execution" test-name reads, the rebase instrument rule
(`pulls/<n>/files` over a diverged `compare`), and treating the gitlink's *absence* as
merged-upstream rather than reverted. None of those were overturned by the outcome.

Related: [[approver-human-agreement-r1-abstain-matched-human-changes-requested]] — at R1 the
same maintainer's CHANGES_REQUESTED *agreed* with my two gaps, so this group does act on
test-coverage and not-implemented gaps; it's the unenforced-precondition class specifically that
they let ride.

**Infra note:** the `record_human_verdict` MCP tool was available when I joined the R1 verdict
but is **absent from the runtime inventory now**, so this merge outcome could not be stamped
onto the decision row. Escalated separately; flagging here so the next reader knows the ledger
join for #1090 is incomplete for reasons unrelated to the decision.
