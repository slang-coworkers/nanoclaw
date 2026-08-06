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

## ⛔GATE VOIDED 2026-08-05T18:41Z — RE-OPENED by a human mention
`jkiviluoto-nv` (**MEMBER**, cmt `5195828320`, real `@nv-slang-bot` mention ⇒ posting authorized):
> *"Mukund (mkeshavaNV) won't be returning to this work for a while. Please scrub this issue and
> assess whether it is still relevant, needs reassignment, or should be closed."*

⭐⭐⭐**THE WHOLE CHAIN'S RESUME TRIGGER WAS "mkeshavaNV picks A/B/C" — that gate is now
PERMANENTLY VOID, not merely slow.** I had this parked as *"holding, awaiting a named human"*; the
named human is gone. ⇒ **A hold is only as valid as the availability of the person it waits on —
and NOTHING in the artifact would ever have told me. `assignees` still reads `mkeshavaNV`; the
issue looked identical the whole time.** Re-probe of a gate tests whether it MOVED, never whether
it CAN still move. See [[feedback_a_guard_can_be_inert_and_read_as_passing]] — an abandoned gate
and a slow gate render identically.
⚠️Corollary for every other parked chain: **"RESUME = <person> answers" carries an unstated
liveness premise.** Prefer a trigger with a second, person-independent disjunct.

**State at 08-05T18:41Z (re-probed, not remembered):** #823 open, 4 comments, **still assigned
`mkeshavaNV`**, milestone still **Q1 2026 (Winter)** (~2 quarters stale — bears on "still
relevant"). #934 open, non-draft, **`dirty`**, head `9543720`, **untouched since 2026-07-25**.
**Reassignment candidate on the artifact record:** `jhelferty-nv` — the issue's REPORTER *and*
author/assignee of #934, last active on it 07-25. ⚠️**That is evidence of activity ON 07-25, NOT
of current availability** — exactly the mistake `jkiviluoto-nv`'s message just corrected about
someone else. Propose, never assert.
**The trap in "should it be closed":** C (WNF) was *mkeshavaNV's* position. His opinion survives as
a data point; his **authority to decide does not**. And WNF-without-the-guard leaves the
silent-wrong-results footgun (copy-back structurally dead). ⇒ **close-as-WNF and land-the-guard are
COMPATIBLE, and separating them is the recommendation.**

## 08-05T19:08Z — scrub turn died on 429; RE-DRIVEN pinned
Triager's scrub turn returned `API Error: Request rejected (429)` with **no body**. ⭐**A provider
error on the recipient's turn is NOT "the work is queued" — the dispatch was consumed and produced
nothing.** MEASURED before assuming either way: #823 still **4 comments**, our bot cmt `5175960220`
still the 08-04 revision (`updated_at` 12:34:07Z), `jkiviluoto-nv`'s 18:41Z request **unanswered**
⇒ scrub entirely un-started.
**Not chain-specific:** `ncl sessions list` showed **56 sessions created in the 18:42–18:45 window**
fleet-wide ⇒ rate-limit burst. ⭐⭐**Check whether a failure is YOURS or AMBIENT before diagnosing
it** — a per-chain post-mortem on a fleet-wide burst is wasted work and invents a false cause.
**Re-driven** with `send_message` + `target_session_id=sess-1785827934925-gjwvxb` (triager's live
#823 session, ag-1780667169498-sqxdef, full chain context) so it resumes warm instead of cold.
⚠️**`send_message` REFUSED the bare send:** *"10 unresponded inbound rows exist on this peer
thread"* ⇒ **`in_reply_to` is REQUIRED once a thread has unanswered inbounds** (the 5 empty ones
from 08-04 count). Passed `in_reply_to=30`. ⭐**A refusal naming a precondition is a gift — it
names the edge to disambiguate.**
⭐⭐**Told the recipient to CHECK FOR A DUPLICATE before posting**, because the host may redrive the
same handoff independently (bounded backoff + dead-letter). Two turns running one scrub would
double-post on a maintainer's request; edit-in-place if a reply already exists.

## ✅08-05T19:13Z — SCRUB POSTED (cmt `5196220483`, 5th comment, no duplicate)
⭐⭐⭐**The 2nd 429 (19:37Z) was on a LATER turn — the WORK HAD ALREADY LANDED at 19:13Z.** I nearly
re-drove a third time; the artifact check stopped me. ⇒ **A provider error names the turn it killed,
NOT the state of the task — always read the DELIVERABLE before re-driving.** 1st 429 = work lost
(0 artifact); 2nd = only the report-back lost (artifact present). **Identical error string, opposite
remediation.** The duplicate-check instruction I attached is what made a safe re-drive possible.

**Verified in the posted comment (mine, at HEAD):**
- **HEAD advanced `086ca32`→`507b4cf`** and `507b4cf` **is** current main. The 2 intervening commits
  (`08ae47a` #1084 board-sync, `507b4cf` #1078 array tests) touch **only** workflow YAML +
  `test_array.py` ⇒ none of the load-bearing files. ✅triager's re-derivation claim is exact.
- ⛔**CORRECTION — the generalizing claim UNDERCOUNTS.** Comment says `mkeshavaNV` is assignee on
  **"6 other"** open `slangtorch_parity_polish` items and lists #899/#844/#832/#822/#768/#823.
  **Enumerated from source: 8 open non-PR issues** —
  #899(no-milestone) #844(Q2) #832(Q2) **#823**(Q1) #822(Q1) #779(Q2) #768(Q1) **#274(Q4 2025)**.
  Missing: **#274** (three quarters stale, the worst case, and the one that most makes his point)
  and **#779**. ⭐⭐**A hand-typed list defines its own coverage — the undercount weakened the very
  argument it was offered to support.** Fix by enumerating:
  `gh api "repos/shader-slang/slangpy/issues?assignee=mkeshavaNV&state=open&per_page=100" --jq '.[]|select(.pull_request==null)|.number'`
  ⚠️Also: the comment scopes them as `slangtorch_parity_polish` items; I enumerated by **assignee**,
  not by label — the 8 is the assignee set. Label-scoped count not separately verified.
  ⇒ **A scrub of #823 alone leaves 7 other chains on a void gate.**

## ⛔08-05T21:49Z (post-restart) — MY "7 UNATTENDED CHAINS" OFFER WAS WRONG
I closed my last report offering to *"dispatch scrubs for the remaining seven"* void-gate issues.
**All 7 were ALREADY SCRUBBED by the fleet** — bot comments on every one, 19:04→20:43Z, i.e. several
posted BEFORE I made the offer. Same `jkiviluoto-nv` request, same verified HEAD `507b4cf`, and to a
high standard: **#779 found the feature is FIXED and recommends closing**; **#274 found a LIVE test
guard (`test_buffer_cursor.py:245-251`, 6 call sites) that still cites the issue by URL** — better
evidence than #823's own. Had I dispatched, I'd have duplicated seven live chains on a maintainer's
request.
⭐⭐⭐**THE ERROR: I derived an unattended SET from `assignees` and never checked for IN-FLIGHT
COVERAGE.** Correctly reasoning that a gate is void does NOT license concluding nobody is working
it — those are independent facts, and the second one is one API call away:
`gh api repos/<r>/issues/<n>/comments --jq '[.[]][-1] | "\(.user.login) @\(.created_at)"'`
⇒ **Before offering to fan out over a set, check the set for existing coverage. "Nobody has acted"
is a claim about the WORLD, not an inference from a stale FIELD** — the same shape as the void-gate
lesson itself (`assignees` doesn't say who is working; it also doesn't say who ISN'T).
⚠️I was also *lucky*: I offered instead of dispatching. **The staggering instinct was right for the
wrong reason** — rate limits, when the real hazard was duplication.
**Also seen at #768:** a sibling comment `5196679064` **amended SIX times**, and a PATCH nearly
destroyed it after a rate-limited read returned an **empty body** ⇒ ⭐⭐**edit-in-place has a
re-edit ceiling; each PATCH risks the artifact a maintainer reads. Prefer a NEW comment over an
Nth amendment, and NEVER write back a body you read as empty.**

**#823 state at 21:49Z (re-probed post-restart):** open, **5 comments**, unchanged since 19:13:52Z,
still assigned `mkeshavaNV`. Our scrub `5196220483` is still the latest word; **no human reply yet**.

## RESUME triggers — SUPERSEDED (kept for the lesson; see GATE VOIDED above)
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
