---
name: project-slang-rhi-801-metal-buffer-import
description: "slang-rhi#801 native Metal buffer import — TERMINAL: merged 11eefdc6 2026-08-03 at the exact reviewed head. Shadow approver ABSTAIN_POLICY both rounds (R1 vindicated by human CHANGES_REQUESTED). Canonical: hosted macOS CI is on the per-encoder FALLBACK path (m_hasResidencySet=false), and absence of a log line proved nothing."
metadata: 
  node_type: memory
  type: project
  originSessionId: ebc97d95-2f9b-4394-8606-40fc4e77d695
---

# slang-rhi#801 — Implement native Metal buffer import (fknfilewalker)

Contributor PR (MEMBER/write, fork head) adding `createBufferFromNativeHandle` on Metal, for slangpy
MPS tensors. Shadow-mode approver chain; nothing posted to GitHub.

## ✅ TERMINAL — MERGED 2026-08-03T16:46:21Z

Merged by **skallweitNV** as `11eefdc6a2c0` at the **exact reviewed head** `25234e0df525` (approved
16:46:13Z, 8 s before merge). Rollup 22 success / 8 skipped; both `build (macos, aarch64, clang,
Debug|Release)` green. Branch protection **is** resolvable: `/branches/main/protection` 403s but
`/branches/main` returns the summary — protected, **17 required contexts incl. both macOS legs**
(a 403 on one endpoint is not absence of the fact — [[feedback_published_negative_env_claims_need_rederivation]]).

**Agreement joins:** R1 @`107bd564e27e` ABSTAIN → skallweitNV **CHANGES_REQUESTED at that exact head**
(vindicated). R2 @`25234e0d` ABSTAIN → merged/APPROVED, scored *policy-consistent withholding*: his
approval discharged the **performance** objection he raised, not a coverage gap no human examined.
⭐ The approver reached ABSTAIN on its own evidence before the approval landed and refused to let it
retro-fit the decision — *"a human approval doesn't close a coverage gap it never examined."*

## Rounds

- **R1 (07-23) ABSTAIN_POLICY (OPEN_GAP):** implementation source-correct (`RetainPtr` for import at
  `metal-buffer.cpp:143` vs `TransferPtr` for device-created :76; address-map erase moved into
  `deleteThis()`), but `tests/test-buffer-from-handle.cpp` masked `GPU_TEST_CASE` to `D3D12 | Vulkan`
  ⇒ the PR's purpose was untested on its target backend. Same class as
  [[project_slang_rhi_800_metal_dispatch_indirect]] and slang#12142.
- **R2 sync @`c2ecb228` (08-03 15:29) — debounced:** pure `Merge branch 'main'`; reviewed files proven
  unchanged by **blob-SHA equality** via `gh api contents?ref=<sha> --jq .sha` (shallow `git fetch` of
  a fork SHA failed and printed bogus `DIFFERS` — tool failure, not evidence;
  [[feedback_shallow_clone_makes_your_head_the_graft_root]], [[feedback_debounce_approver_dispatch_deterministic_abstain]]).
- **R3 @`25234e0d` (16:30) — both tripwires fired:** mask gained `Metal`, and the implementation was
  **rewritten** to answer skallweitNV's CHANGES_REQUESTED (a *performance* ask: *"adding lots of heap
  allocations where previously there were none"* at diff-relative `metal-buffer-address-map.h:69` —
  [[feedback_changes_requested_read_body]], [[feedback_diff_relative_line_numbers_in_bot_reviews]]).
  `std::vector<BufferImpl*>` → intrusive singly-linked list (`BufferImpl::m_nextAtSameAddr`,
  `Entry.head`). Scoping: `BufferAddressMap` already existed on main (#800) ⇒ single-pointer → chain.
  Full re-gate, 6/6 clauses pass; Devin **stale** (described the superseded vector design) ⇒ not credited.
  Rewrite clean: insert/erase predicates symmetric by construction, unlink precedes `deferDelete`
  (fixes a pre-existing hole on main), include closure computed as a DAG.
  **Coverage closed empirically:** macOS Debug job `91749550466` — `Metal: supported`,
  `buffer-from-handle.metal PASSED (0.07s)` beside `buffer-from-handle.vulkan SKIPPED` (control);
  Metal PASSED tally 132 → 133 vs base. Assertions load-bearing (reads `{0,1,2,3}` through the imported
  wrapper, `{1,2,3,4}` after a real dispatch). R2 verdict still ABSTAIN on the narrowed gap below.

## 🔴 Canonical correction — hosted macOS CI runs the FALLBACK path

The R3 withhold was first justified on three grounds; **two were inverted and are retracted** (approver
08-03 17:31, re-derived by me at source + logs):

- ❌ "map is dead because `m_hasResidencySet` is true on Apple Silicon." **Opposite:** `metal-device.cpp`
  sets it only in the `supportsFamily(MTL::GPUFamilyApple6)` branch (L121); the hosted `Apple
  Paravirtual device` lacks Apple6 ⇒ **false** ⇒ per-encoder `useResource` fallback, map **live**.
- ❌ "the test shader has no pointer field so `find()` never runs." `resolvePointerFieldResidency`
  (`metal-shader-object.cpp:735`) runs it, and **7 pre-existing `bind-pointers-*.metal` cases PASSED at
  the decision head** (incl. `bind-pointers-offset-address`, `test-bind-pointers.cpp:392`, written to
  force the non-base-address resolve).
- ✅ **Surviving gap:** no test releases one alias while another stays mapped, so a multi-entry
  `Entry.head` walk/unlink is unexercised (single-entry chains are covered). Needs no hardware or env
  var. Separately and genuinely hardware-gated: the residency-**SET** path, which no CI runner reaches.
  `SLANG_RHI_METAL_NO_RESIDENCY_SET` was never the missing artifact. Still standing: `SLANG_RHI_ASSERT`
  is not debug-only ⇒ a same-address size mismatch is a Release `abort()` from public API (trigger unproven).

**Why both tiers got it backwards:** the residency-set path was inferred from the **absence of a
fallback log line**, an absence guaranteed by construction — `checkDeviceTypeAvailable` fills
`debugCallbackOutput` only inside `RETURN_NOT_AVAILABLE` (`tests/testing.cpp:884`), so a green run
prints nothing. *An unconditional print does not imply an unconditional value*
([[feedback_mechanism_must_predict_observed_coordinates]]). I had the disconfirming 7 PASSED rows in a
log I pasted myself, and this file already held the corrected polarity while I asserted the inverse on
#800 — grep your own store before recording a caveat ([[feedback_correction_must_sweep_whole_file]]).
Phrase the environment evidence precisely: *"same image + same adapter, diagnostic observed in a
sibling job at a different commit"* (job `91655709489`, `conclusion: success`, commit `4144455d`, 0
Metal tests) — environment inference, not same-run observation. CodeRabbit's agreement with the
inverted framing was agreement on a wrong premise, not corroboration.

**Residual (no owner, non-blocking):** cite this row if a Metal buffer-import aliasing bug surfaces —
the missing test is a release-one-alias-while-another-stays-mapped sequence on the fallback path.

**Tooling defect (approver-reported):** read-only `gh api …/pulls/<n>/reviews` GETs tripped the
critique hook's PR-*creation* pattern and burned the denial cap; the host-side pattern is too broad.
