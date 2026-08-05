---
name: project_slangpy_823_tensorview_interop_buffer_noncuda
description: "slangpy#823 TensorView/DiffTensorView writes raw torch CUDA VA on Vulkan/D3D12 — triaged P3, fix already in conflicted PR"
metadata: 
  node_type: memory
  type: project
  originSessionId: eefef9ed-3da4-4ae3-a968-5836e32e429d
---

# slangpy#823 — TensorView bypasses interop buffer on non-CUDA backends

**Triaged 2026-08-04** by `slangpy-triager` (dispatched by me on thread
`gh-issue-shader-slang/slangpy-823`). Verdict comment posted by the triager:
`5175960220`. **That comment is OURS ⇒ EDIT in place, never re-POST.**

## Operator framing was wrong — the issue is 5 months old
Dashboard delivered this as *"New issue to triage."* It was **filed 2026-02-26**,
assignee **`mkeshavaNV`**, milestone *Q1 2026 (Winter)*, with two member comments
already. ⭐**An inbound's framing is not evidence about the artifact's state** —
`comments_count`/`created_at` cost one call and reclassified the whole task from
"classify a new report" to "a stalled maintainer verify-and-close."

## The state that actually matters: a member disagreement, not an open question
- **`mkeshavaNV`** (assignee), 2026-02-26 cmt `3967274782`: *"I doubt we ever plan
  to support these on non cuda backend. So I think this will be WNF. I will keep
  it on me to verify this and close."*
- **`bmillsNV`**, 2026-03-11 cmt `4040999046`: *"can you verify next sprint?"* —
  **no reply since (~5 months).**
- **`jhelferty-nv`** (the issue REPORTER) then **implemented the opposite option**
  in PR #934. So A-vs-B is not an abstract design question awaiting a decision:
  one member said WNF, another wrote the extend. ⭐**When the reporter has already
  shipped one of the options they offered, the "possible fix" list in the issue
  body is stale — check for their own PR before presenting it as open.**

## ⛔RETRACTED 08-04 — "#934 already fixes this" was OVERSTATED (mine, relayed upstream)
**What I said:** *"the fix already exists in flight"* / *"#823 is substantially fixed inside an
open PR."* **True part:** #934's diff does contain an Approach-B change at the exact `is_tensorview`
block. **False part:** that is **only the ADDRESS half.** #934 leaves the **copy-back** gate
untouched, so merged as-is it yields a correct device address and **still silently drops shader
output.** B is three pieces (address + copy-back at `:623` + docs), not one.
⭐⭐⭐**THE LESSON: "the diff contains a fix for these lines" ≠ "the diff fixes the issue."** I
verified the diff *touched the right lines* and let that stand in for *resolves the defect* — the
strongest-feeling check of the three I ran, and the one that skipped a step. ⇒ **Enumerate what the
ISSUE NEEDS, then check each need against the diff; never infer coverage from location.** Same
family as the inert guard: location-correct evidence reads as completeness-correct.
⚠️I had *already recorded* the copy-back defect in this very file (§"the finding worth keeping")
and still called #934 the fix ⇒ ⭐⭐**a defect you have written down does not automatically enter
a later completeness judgement — re-read your own notes before certifying a fix as sufficient.**
Corrected everywhere 08-04: this file, `MEMORY.md`→spilled row in
`slang-slangpy-tooling-chains-index.md`, and the **public** comment `5175960220` (headline
rewritten + explicit retraction note; residual sweep clean — the old wording survives only *inside*
the retraction). See [[feedback_correction_unapplied_until_every_restatement_fixed]].

## MINE-VERIFIED (not relayed) — all three load-bearing claims
Verified directly, `gh api` + `934.diff`, 2026-08-04:
1. **#934 genuinely contains Approach B for the exact lines**, not just a file-table
   claim. Diff hunk `@@ -461,8 +490,20 @@`:
   `tvd.data = static_cast<uint64_t>(interop_buffer->device_address());`
   guarded by `if (interop_buffer)`, **plus** `make_contiguous_strides(...)`
   recomputation (the interop buffer is a contiguous copy, so torch strides are
   wrong for it). ⭐**A PR's own file table is the author's prose — open the diff.**
2. **`mergeable_state: dirty`, `mergeable: false`** — head `95437203657e6c81ca4618fbd5508fec583f47d7`,
   4 files, +138/−20, **untouched since 2026-07-25** (~6 weeks conflicted).
   Requested reviewer **`bmillsNV`**, author+assignee `jhelferty-nv`. Closes #929.
3. Issue #823 **open**, 3 comments (3rd is our bot's triage).

## The finding worth keeping (triager's, evidence cited, I did not re-derive)
"Bypasses the interop buffer" is **wrong in a way that matters**: the buffer **is**
allocated and the torch data **is** copied in (`:553-554`
`create_interop_buffer_from_tensor`), passed to `write_torch_tensor_fields`
(`:571/582`), and then `:428-433` returns **without ever reading the
`interop_buffer` parameter** — so a full D2D copy is paid and discarded, and the
CUDA VA is embedded anyway (`populate_tensorview_data:151`).
**Consequence absent from the issue:** a *writable* TensorView also silently loses
copy-back — `needs_primal_copyback` (`:623`) only consults the interop buffer ⇒
shader writes land in a buffer the shader was never pointed at; the torch tensor
is never updated. **Silent wrong results, not merely a bad address.**

Reporter's locations are **stale**: path is `src/slangpy_ext/utils/`, not
`src/slangpy_torch/`; early-return is **428**, not ~491; and the second branch
cited at *"~line 417"* in `write_shader_cursor_pre_dispatch()` **does not exist**
(that function, 255-410, holds zero `is_tensorview` refs) ⇒ **one** site, not two.

## Why severity stays low (the containment)
`docs/src/autodiff/pytorch.rst:177` — added by **#775 itself**, the PR that added
the code — already states *"`TensorView<T>` is CUDA-only. It will not work with
Vulkan or D3D12 backends"*, and `:170-173` calls TensorView legacy slangtorch
compat, *"not recommended for new code."* ⇒ **missing guard on a
documented-unsupported config**, not a broken supported feature. Reachable though:
`is_tensorview` is set **purely structurally** (`slangpytensor.cpp:133-143`: true
iff the Slang type has no `_data` field) with **no `DeviceType` check anywhere**.

## Zero executing coverage — untested, not passing
`test_tensorview.py:19-21` and `test_difftensorview.py:18-20` both hardcode
`DEVICE_TYPES = [DeviceType.cuda] if ... else []` then module-level `pytest.skip`
⇒ **a Vulkan/D3D12 variant never even collects.** All 63 TensorView tests are
CUDA-only. ⭐**"No failing test" here means the path is UNEXERCISED** — see
[[feedback_green_job_skipped_backend_zero_coverage]]. Option A (guard) is the only
one testable in current CI (`pytest.raises` on any non-CUDA device); option B needs
a CUDA-interop-capable Vulkan/D3D12 runner, which CI lacks (`ci.yml:164-166`).

## ADDENDUM 08-04 — B is THREE pieces; copy-back gate is dead for TensorView
Triager's addendum (prompted by the fixer), **all of it MINE-VERIFIED at HEAD**, not relayed:
1. **Copy-back is gated on the Slang TYPE-NAME PREFIX**, not on access-mode reflection.
   `slangpytorchtensor.cpp` `ensure_binding_info_cached`: `starts_rw` = name begins
   `"RW"`, `starts_w` = begins `'W'` && !starts_rw, `needs_primal_copyback =
   starts_w || starts_rw`. ✅read in the HEAD file myself.
2. `TensorViewType::build_tensorview_name` (`src/sgl/refl/type.cpp:845`) emits exactly
   `fmt::format("TensorView<{}>", ...)` ⇒ starts `'T'` (or `'D'` for DiffTensorView)
   ⇒ **gate unconditionally FALSE for every TensorView binding.**
   ⭐**This is an ABSENCE claim ⇒ needed a control.** `search/code` on the repo:
   `RWTensorView`=**0**, `WTensorView`=**0**, vs **discriminating controls**
   `RWTensor`=25, `WTensor`=27 (the RW/W spellings WOULD be found if present) and
   `TensorView`=43 (the search works). ⚠️counts are MATCHES not files — fine here,
   only the zero/non-zero polarity is load-bearing. See
   [[feedback_search_code_total_count_is_not_a_file_count]].
3. The **automatic** copy-back can't rescue it either: `device.cpp` iterates
   `CommandBuffer::m_cuda_interop_buffers`, and the only pushes are
   `shader_object.cpp:199,209` — both inside `set_cuda_tensor_view_buffer` /
   `set_cuda_tensor_view_pointer` (✅grepped: 3 hits, 3rd is a read). The torch
   marshall never calls those; it builds plain `sgl::Buffer` via
   `device()->create_buffer()` and does its own `TorchBridge::copy_to_buffer`.
⇒ **Approach B = #934's diff + a copy-back fix + a docs correction** (`pytorch.rst:177`
and `:207` become FALSE under B). ⭐**#934 merging as-is is NOT a complete fix for #823** —
it would land B, silently falsify the docs, and still drop shader output.

**My own addition (from reading HEAD, scoped):** a sibling diagnostic for an
unsupported config **already exists a few lines above** where a guard would go —
`write_shader_cursor_pre_dispatch` throws *"Non-CUDA torch tensors are not yet
supported. Tensor must be on CUDA device."* ⚠️**Different condition** (that fires
when the *torch tensor* isn't CUDA; #823 is *tensor CUDA, device not*), so it does
**not** guard this. But it makes Approach A idiomatic rather than novel: a sibling
`SGL_THROW` next to an existing one. ⭐**Not verified as the best insertion point** —
the triager prefers `write_shader_cursor_with_interop` before the allocation, so the
wasted copy is skipped too. Both are defensible; not our call.

## RESUME triggers — two humans, both named
- **`mkeshavaNV` answers A/B/C** on #823 (guard · let #934 carry it · WNF), **or**
- **#934 stops being `dirty`** (rebased/merged/closed) — it is the sequencing
  hazard: landing a guard now conflicts with it.
Re-probe with: `gh api repos/shader-slang/slangpy/pulls/934 --jq '{mergeable_state,updated_at}'`
(want anything but `dirty`; ⚠️first poll can read `unknown` — GitHub computes
lazily, re-poll, never record `unknown`).
**No fixer dispatched** — assignee holds it; fixer parked, re-reads at then-HEAD on resume.
⛔Do not open a competing PR for #823. ⚠️But #934 is **not** a reason to stand down: it is
`advisory: maintainer-gated`, explicitly **not** `stood-down: external-PR` — even if #934 lands,
copy-back at `:623` and the docs still need an owner.

## Positive control on the absence claim (closes it in both directions)
`TensorType::build_tensor_name` (`type.cpp:806-828`) **does** emit `prefix += "RW"` / `"W"`
(also `"I"`, `"Diff"`, `"Primal"`) ⇒ the prefix gate **fires for other types**; it is TensorView
specifically that can never satisfy it, not a dead branch. ⭐⭐**A zero needs a control that
proves the mechanism WORKS elsewhere** — "no RW/W TensorView exists" + "RW/W is emitted for
Tensor" together license the conclusion; either alone does not. Triager found this; I verified it
(`sed -n '805,850p'`). See [[feedback_control_the_instrument_not_the_reasoning]].

## Process disclosure from the triager (kept — it bears on trusting relays)
A 13:13Z container restart interrupted the chain, and the triager's memo had recorded an operator
escalation as **sent before the call actually fired** — it hadn't. Self-caught on resume, memo
corrected, learning filed. It had reported "escalated" to me in that window. Five empty inbounds
(12/14/16/18/20, 12:34→22:14Z) frame that gap. ⭐⭐**A peer's status verb can be false without
anyone lying — write the verb only AFTER the call returns, and on resume distrust your own last
few lines.** ⭐**An empty inbound is a signal, not noise** — it means a turn produced no message,
which is where interrupted work hides.

Related: [[feedback_control_the_instrument_not_the_reasoning]] ·
[[feedback_consistency_is_not_completeness_in_review]]
