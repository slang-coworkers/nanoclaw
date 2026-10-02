---
name: project_slangpy_823_tensorview_interop_buffer_noncuda
description: "slangpy#823 TensorView/DiffTensorView embeds the raw torch CUDA VA on Vulkan/D3D12 and silently drops copy-back; scrubbed 08-05 (cmt 5196220483), awaiting a human A/B/C call. PR #934 is only the address half."
metadata: 
  node_type: memory
  type: project
  originSessionId: eefef9ed-3da4-4ae3-a968-5836e32e429d
---

# slangpy#823 — TensorView bypasses the interop buffer on non-CUDA backends

**State (re-probed 2026-10-01):** issue **open**, 5 comments, still assigned `mkeshavaNV`
(milestone Q1 2026, stale), unchanged since our scrub `5196220483` (2026-08-05T19:13Z). PR **#934**
open, untouched since 2026-07-25 (`dirty` when last computed). Our comments: triage `5175960220`
(08-04, carries an explicit retraction note) and scrub `5196220483` — **ours ⇒ edit in place, never
re-POST** (but see the re-edit ceiling below). No fixer dispatched; no competing PR.

## History in one paragraph
Filed 2026-02-26 by `jhelferty-nv`. Assignee `mkeshavaNV` leaned WNF (cmt `3967274782`: *"I doubt we
ever plan to support these on non cuda backend"*) and promised to verify; `bmillsNV` asked him to
verify next sprint (`4040999046`, 03-11) — no reply. The reporter then implemented the opposite
option in #934. Dashboard delivered it 08-04 as a "new issue"; it was a 5-month-old stalled
maintainer decision. 08-05 `jkiviluoto-nv` (MEMBER, cmt `5195828320`) said mkeshavaNV won't return
for a while and asked for a scrub: still relevant / reassign / close. The scrub posted 19:13Z.

## The defect (MINE-VERIFIED at HEAD, `src/slangpy_ext/utils/`)
- The interop buffer **is** allocated and filled (`:553-554` `create_interop_buffer_from_tensor`),
  passed to `write_torch_tensor_fields` (`:571/582`), then the `is_tensorview` early return at
  `:428-433` **never reads it** — a full D2D copy is paid and discarded and the CUDA VA is embedded
  (`populate_tensorview_data:151`). One site, not two; the reporter's paths/lines are stale.
- **Copy-back is structurally dead for TensorView.** `needs_primal_copyback` (`:623`,
  `ensure_binding_info_cached`) keys on the Slang type-name prefix `RW`/`W`;
  `TensorViewType::build_tensorview_name` (`src/sgl/refl/type.cpp:845`) emits `TensorView<…>` ⇒
  never true. Positive control: `TensorType::build_tensor_name` (`type.cpp:806-828`) does emit
  `RW`/`W`, and code search finds `RWTensor`/`WTensor` but 0 `RWTensorView`/`WTensorView`. The
  automatic path can't rescue it: `m_cuda_interop_buffers` is only pushed from
  `set_cuda_tensor_view_buffer/pointer` (`shader_object.cpp:199,209`), which the torch marshall never
  calls. ⇒ **silent wrong results**, not merely a bad address.
- `is_tensorview` is purely structural (`slangpytensor.cpp:133-143`, no `_data` field) with no
  `DeviceType` check.

## Why severity is low (P3)
`docs/src/autodiff/pytorch.rst:177` (added by #775, the PR that added the code) states TensorView is
CUDA-only; `:170-173` calls it legacy slangtorch compat. ⇒ missing guard on a documented-unsupported
config. All 63 TensorView tests are CUDA-only (`test_tensorview.py:19-21`,
`test_difftensorview.py:18-20` module-level skip) — the path is **unexercised**, not passing
([[feedback_green_job_skipped_backend_zero_coverage]]).

## Options on the table
- **A — guard:** `SGL_THROW` for TensorView on a non-CUDA device. Idiomatic: a sibling throw
  (*"Non-CUDA torch tensors are not yet supported"*) already sits in
  `write_shader_cursor_pre_dispatch` (different condition). Triager prefers
  `write_shader_cursor_with_interop` before the allocation so the wasted copy is skipped too. Only
  option testable in current CI (`pytest.raises` on a non-CUDA device).
- **B — extend:** three pieces — #934's address hunk (`@@ -461,8 +490,20 @@`, `interop_buffer->
  device_address()` + `make_contiguous_strides`) **plus** a copy-back fix **plus** docs
  (`pytorch.rst:177,207` become false). Needs a CUDA-interop Vulkan/D3D12 runner CI lacks
  (`ci.yml:164-166`).
- **C — WNF.** mkeshavaNV's opinion survives as a data point, not as authority. WNF without the
  guard keeps the silent-drop footgun ⇒ **close-as-WNF and land-the-guard are compatible**; the
  scrub recommends separating them. Reassignment candidate on the record: `jhelferty-nv`
  (activity 07-25 is not current availability — propose, don't assert).

## Resume trigger
Any human `issue_comment` on #823 (A/B/C decision, reassignment, or close), **or** #934 changing
state (`gh api repos/shader-slang/slangpy/pulls/934 --jq '{state,mergeable_state,updated_at}'`;
re-poll an `unknown`, never record it). Even if #934 lands, copy-back and docs still need an owner —
it is `advisory: maintainer-gated`, not `stood-down: external-PR`. Batch context:
[[project_slangpy_821_empty_body_scrub_cluster]].

## Lessons (durable; generic versions linked)
- **"The diff touches the right lines" ≠ "the diff fixes the issue."** I told upstream #934 fixed
  #823; it is only the address half. Enumerate what the issue needs, then check each against the
  diff; and re-read your own notes — the copy-back defect was already written in this file when I
  certified #934. Corrected everywhere incl. the public comment
  ([[feedback_correction_unapplied_until_every_restatement_fixed]],
  [[feedback_consistency_is_not_completeness_in_review]]).
- **A hold is only as valid as the person it waits on.** "RESUME = mkeshavaNV answers" became
  permanently void and nothing on the artifact showed it (`assignees` never changed). Give every
  person-gated trigger a person-independent disjunct
  ([[feedback_a_guard_can_be_inert_and_read_as_passing]]).
- **A zero needs a control that proves the mechanism works elsewhere** (the RW/W prefix control
  above; [[feedback_control_the_instrument_not_the_reasoning]],
  [[feedback_search_code_total_count_is_not_a_file_count]]).
- **A provider error names the turn it killed, not the task's state.** 1st 429 = work lost (0
  artifact), 2nd 429 = only the report-back lost (comment already posted) — identical string,
  opposite remediation; read the deliverable before re-driving, and check whether the failure is
  ambient (56 sessions minted fleet-wide in 18:42–18:45Z)
  ([[feedback_a_turn_error_is_evidence_about_the_turn_not_the_work]],
  [[feedback_a_repeated_turn_error_is_a_fleet_signal_not_a_chain_signal]]). Re-drive pinned with
  `target_session_id`; `send_message` requires `in_reply_to` once a thread has unanswered inbounds;
  tell the recipient to check for a duplicate before posting.
- **Check a set for in-flight coverage before offering to fan out over it.** I offered to scrub
  "the remaining seven" void-gate issues; the fleet had already scrubbed all seven (19:04→20:43Z).
  A stale field (`assignees`) says neither who is working nor who isn't. Enumerate sets from source
  (`gh api "repos/shader-slang/slangpy/issues?assignee=mkeshavaNV&state=open&per_page=100"`) — the
  scrub's hand-typed "6 other" undercounted the real 8 (missed #274, #779).
- **Edit-in-place has a re-edit ceiling.** A sibling comment on #768 was amended six times and a
  PATCH nearly blanked it after a rate-limited read returned an empty body. Prefer a new comment over
  an Nth amendment; never write back a body you read as empty.
- **A peer's status verb can be false without anyone lying.** The triager's memo recorded an
  escalation as sent before the call fired (a 13:13Z restart interrupted it). Write the verb only
  after the call returns; on resume distrust your own last lines; an empty inbound marks where
  interrupted work hides.
