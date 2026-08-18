---
title: "[approver/calibration] Closing a coverage gap can UNCOVER a new one — re-scope the gap to the revision's own new code"
type: learning
topic: review-approval
source: learnings/1785776756858-approver-calibration-closing-a-coverage-gap-can-un.md
---

# [approver/calibration] Closing a coverage gap can UNCOVER a new one — re-scope the gap to the revision's own new code

**Symptom:** slang-rhi#801. R1 ABSTAIN(OPEN_GAP) because a Metal-only feature's test was masked to `D3D12|Vulkan`. R2 flipped the mask to include Metal AND rewrote the implementation. The mask edit *worked* — `buffer-from-handle.metal` PASSED on both macOS legs, tally 132→133, load-bearing content assertions. It is tempting (and I nearly did) to read "the gap I named is closed" as "the PR is now covered" and approve.

**Root cause of the trap:** the two are different propositions. The R1 gap was about the *import API*; R2's substance was a NEW intrusive-linked-list rewrite of the address map. The now-passing test exercises the import path but provably never touches the list: (a) the whole map is dead code when `m_hasResidencySet` is true — true on any Apple-Silicon runner, i.e. exactly the CI legs — consumer early-returns and both insert sites are guarded; (b) the consumer only iterates `Kind::Pointer` fields and the test shader has none, so `find()` is never called; (c) no alias is ever released while another stays mapped, which is the only way to trigger the dangling-`head` failure mode. The env escape hatch (`SLANG_RHI_METAL_NO_RESIDENCY_SET`) is set nowhere in CI.

**How to catch it:** when a revision closes your prior gap, do NOT diff your old withhold reason against the new evidence and stop. Re-derive the gap from scratch against *this* revision's diff: "which lines are new here, and what executes them?" A green test proves the path it covers, never the path a same-revision rewrite introduced. Concretely: trace from the newly-changed lines FORWARD to an executing test, rather than from the test backward to a green checkmark. Ask what guard makes the new code reachable at all — a data structure behind a runtime capability flag that CI always sets the other way is unexecutable by construction, no matter how many tests pass.

**Corroboration signal worth trusting:** CodeRabbit independently flagged the identical gap at the same head ("a regression in `insert` or `erase` for duplicate base addresses would still pass"). Two reviewers converging from different directions on the same uncovered surface is strong evidence the gap is real and not approver over-caution.

**Fix:** ABSTAIN_POLICY(OPEN_GAP) re-scoped to the new code, with the old gap explicitly marked CLOSED so the record shows progress rather than a repeated withhold. Precedent that settles the lean: slang-rhi#802 was source-verified correct and still FAILED once the relevant configuration executed — source-correctness is not execution, and "I read it carefully" is not coverage.

---

## 🔴 POLARITY CORRECTION (2026-08-03 17:32Z) — clause (a) of the "Root cause of the trap" paragraph is FALSE

**Retracted verbatim so a grep for the old wording lands here:** *"the whole map is dead code when
`m_hasResidencySet` is true — true on any Apple-Silicon runner, i.e. exactly the CI legs"*, and the closing
*"the env escape hatch (`SLANG_RHI_METAL_NO_RESIDENCY_SET`) is set nowhere in CI"* as an argument that the
fallback is unreached.

**Apple-Silicon ≠ Apple6, and that is the whole error.** `m_hasResidencySet = true` is set **only** inside
`else if (m_device->supportsFamily(MTL::GPUFamilyApple6))` (`src/metal/metal-device.cpp` L121, verified at
merged `d8c609ef`). The hosted `Apple Paravirtual device` on `macos-26-arm64` (image `20260728.0273`) is
Apple Silicon but **does not expose Apple6**; a sibling job on that same image logs the terminal-`else`
message `GPUFamilyApple6 not supported; using per-encoder useResource fallback`. ⇒ **`m_hasResidencySet` is
FALSE on the CI legs, so the map is live there, not dead code.** The env hatch being unset in CI is
irrelevant — CI takes the fallback *without* it.

**Consequence for this atom:** clauses (b) — the test shader has no `Kind::Pointer` field — and (c) — no alias
released while another stays mapped — are unaffected and still carry the conclusion. Main's
`project_slang_rhi_801_metal_buffer_import` records (b) as **also retracted** on separate evidence (7
`bind-pointers-*.metal` cases PASSED at the decision head ⇒ `find()` does run), leaving **(c) alone** as the
surviving, much narrower gap: the multi-entry chain walk/unlink is unexercised; single-entry chains are
covered.

⇒ **The withhold survives on (c) only.** Do not cite (a) at all, and do not cite
`SLANG_RHI_METAL_NO_RESIDENCY_SET` as a missing artifact anywhere — CI is already on that path.

⭐ **Durable lesson: a feature-tier name is not a capability check.** "Apple Silicon" reads as a synonym for
"modern Metal GPU" and silently is not — the guard tests `GPUFamilyApple6`, and a paravirtualized adapter
fails it. Verify the *predicate the code branches on*, never the marketing tier it resembles. Sibling to
**narrowing a claim is not testing its premise**: this clause was narrowed twice while its premise
(*which residency path do the CI legs take?*) went untested, when one public job-log `curl` settled it.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785776756858-approver-calibration-closing-a-coverage-gap-can-un.md`_
