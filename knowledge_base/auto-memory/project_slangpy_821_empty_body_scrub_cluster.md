---
name: project_slangpy_821_empty_body_scrub_cluster
description: "slangpy#821 scrub RESOLVED 08-05: verdict published (cmts 5196835011 patched + 5197948085 new). #821/#820 nominated-not-accepted (ccummingsNV never ack'd); GENUINELY orphaned = #822/#832/#844/#768. Gated on #768 retire-vs-keep. Latent dispatchdata.py:108 substring defect MINE-VERIFIED wider than reported."
metadata:
  node_type: memory
  type: project
  originSessionId: 771a61c5-e510-491d-9a7d-355d99fd785c
---

# slangpy#821 — "minimal wrapper when only the compute/cuda-kernel tag is missing" (scrub)

**RESUME TRIGGER (two disjuncts, deliberately person-independent — see the void-gate lesson in
[[project_slangpy_823_tensorview_interop_buffer_noncuda]]):**
(a) any `issue_comment` on shader-slang/slangpy#821, **or**
(b) `slangpy-triager` reports its reconciliation of the ALREADY-PUBLISHED verdict (cmt
`5196835011`) on thread `gh-issue-shader-slang/slangpy-821`.
**Downstream gate that actually decides this issue: the retire-vs-keep ruling on epic #768.**
#821 is formal sub-issue 3 of 7 on #768 (`/sub_issues` — CONFIRMED by the triager, not inferred).

## Inbound

`jkiviluoto-nv` (MEMBER), cmt `5195827127`, **2026-08-05T18:41:26Z**, real `@nv-slang-bot` mention:
> *"Mukund (mkeshavaNV) won't be returning to this work for a while. Please scrub this issue and
> assess whether it is still relevant, needs reassignment, or should be closed."*

`is_pr: false` ⇒ routed to `slangpy-triager`, thread `gh-issue-shader-slang/slangpy-821`.

## This is a FLEET-WIDE BATCH, not one request
Byte-identical text, timestamps **18:41:23 → 18:41:31Z** (8 seconds), across at least:
slangpy **#1001, #899, #822, #821, #820, #768, #844** and slang **#9661**, plus slangpy **#823**
(recorded on its own chain). ⇒ ⭐⭐**A batch mention's stated reason is a TEMPLATE, applied by
author-or-assignee sweep — it is a hypothesis about each artifact, not a finding about any of them.**
Verify the premise per-issue; do not inherit it. See
[[feedback_a_reporters_framing_is_a_hypothesis_not_a_finding]].

## ⛔ FULL 12-LEG PREMISE TALLY — enumerated from the API 2026-08-05 ~22:20Z, one loop
⛔ **The premise fails on 4 of 12, in TWO DIFFERENT WAYS — and I twice reported it as "2 of 10."**

| assignee state | issues | what the premise gets wrong |
|---|---|---|
| `ccummingsNV` (reassigned 2026-03-13) | **#820, #821** | wrong *person* — moved 5 months ago |
| **`[]` — never assigned to anyone** | **#510, #1001** | wrong *frame* — "reassignment" is meaningless |
| `mkeshavaNV` (genuinely orphaned) | #768, #822, #899, #274, #832, #823, #844 | premise holds |
| `mkeshavaNV`, but verdict is *close* | #779 | holds, but rehoming is moot |

⇒ ⭐⭐⭐ **"Never assigned" is NOT a milder version of "assigned to the wrong person" — it invalidates
the question instead of answering it differently.** I collapsed both into one "premise false" bucket
and lost that distinction. Sibling of
[[feedback_a_null_from_an_instrument_with_no_field_is_an_unasked_question]]: an empty `assignees` is an
unasked question, not a value.

⇒ ⭐⭐⭐ **THE TEST FOR A WRONG BUCKET, and it is checkable rather than a matter of taste (the
triager's, sharpening mine): IF A BUCKET'S MEMBERS WOULD PROMPT DIFFERENT NEXT ACTIONS, IT IS THE
WRONG BUCKET.** #510/#1001 need an **owner**; #820/#821 need **nothing**. One bucket, two disjoint
next actions ⇒ wrong bucket, provable without argument.
⭐⭐ **Why it collapses so easily is the mechanism worth carrying: *"premise false"* is a predicate
over the QUESTION, while *"assigned to the wrong person"* / *"never assigned"* are facts about the
FIELD. Bucketing by the predicate silently discards the facts** — and the predicate is the natural
phrasing when you are answering a request, which is exactly when you are most likely to reach for it.
⇒ **Bucket by the field's state, then map states to actions; never bucket by your verdict on the ask.**

⇒ ⭐⭐ **A DENOMINATOR IN A RETROSPECTIVE OUTLIVES THE SESSION THAT PRODUCED IT.** My "2 of 10" was
wrong in *both* terms: 10 undercounted the legs (12 — I anchored on the 10 webhook arrivals I saw and
dropped the 2 self-routed), and 2 undercounted the failures (4). Every per-issue *published comment*
was correctly scoped, so nothing a maintainer reads was affected — which is precisely why this class
survives: **the summary is the only artifact carrying the number, and no downstream check ever touches
it.** Caught by a peer, not by me.
⇒ ⭐⭐ **Recompute a headline count from the enumeration at write time; never restate it from an
earlier message in the same conversation.** I had 4/12 right earlier in this very session, then
regressed to 2/10 in the close by recalling instead of re-querying. The check is one loop over the leg
list — cheaper than the correction it prevents.

⇒ ⭐⭐⭐ **A RETROSPECTIVE NUMBER DESERVES *MORE* RE-DERIVATION THAN A PUBLISHED ONE — the inversion is
the point.** A verdict on an issue gets read by a maintainer who may push back; **a denominator in a
wrap-up gets cited by someone with no way to notice.** Published claims sit in an error-correcting
channel; summary aggregates do not. ⇒ **Re-derive the aggregate precisely because nobody downstream
can.** Counter-intuitive against the usual instinct to spend verification effort where the audience is
largest.

## The two reassigned legs — #821 and #820 specifically
The request's reason is *"Mukund won't be returning to this work."* But:

- **#821 `assignees` = [`ccummingsNV`]. #820 `assignees` = [`ccummingsNV`]. Not mkeshavaNV.**
- The move is visible in the thread: mkeshavaNV, **2026-03-12** (cmts `4048217951` / `4048179787`):
  *"@ccummingsNV - should I move this to you? I believe you've started looking at it?"* — and the
  assignee field now reads ccummingsNV, so the move happened.
- **#822 is still `mkeshavaNV`.** So within one 24-second sibling cluster, the departure orphans
  #822 but **not** #821/#820.

⇒ ⭐⭐⭐**The correct scrub verdict for #821 is NOT "reassign because the owner left" — the owner
already changed 5 months ago. The live question is a DIFFERENT one: an assignment that was
PROPOSED but never ACKNOWLEDGED.** `comments_count` is 2 = mkeshava's question + this scrub request;
**ccummingsNV never replied, and has left no comment on #821 or #820 in ~5 months.** A hand-off
transferred the *field* without confirming the *person*. ⚠️Whether ccummingsNV is actually carrying
this is UNKNOWN from the artifact — and "assignee is set" reads exactly like "someone owns it."
Same shape as an inert guard reading as passing ([[feedback_a_guard_can_be_inert_and_read_as_passing]]).

## ⛔ SECOND MEASURED FACT: the body is EMPTY
`#820`, `#821`, `#822` all have **`body: ""`**. There is no spec, no repro, no acceptance criterion —
**only the title.** Consequences a triager must not paper over:

- "Is it still relevant?" **cannot be answered from the issue.** It has to be answered against
  slangpy HEAD: does the capability in the title exist / has the surrounding design moved?
- The title *is* the whole ask: *generate a minimal wrapper for an entry point when the only thing
  missing is the compute-shader / CUDA-kernel tag.*
- ⭐⭐**An empty body is not a small body — it is an UNASKED QUESTION rendered as an open ticket.**
  Sibling of [[feedback_a_null_from_an_instrument_with_no_field_is_an_unasked_question]]: a
  scrub that reads the issue and finds nothing alarming looks identical to a scrub that found it
  fine. ⇒ The verdict must cite HEAD, never the issue text.

## The cluster — do not triage #821 in isolation
Filed **2026-02-26 at 11:19:18 / 11:19:29 / 11:19:42** (24 s apart), all by mkeshavaNV, all
label `slangtorch_parity_polish`, all milestone **Q1 2026 (Winter)** (~2 quarters stale, bears
directly on "still relevant"), all empty-bodied:

| # | title (the entire ask) | assignee |
|---|---|---|
| 820 | directly call an entry point **without** a CallData trampoline when already tagged compute/cuda-kernel | ccummingsNV |
| 821 | generate a **minimal wrapper** when the only thing missing **is** that tag | ccummingsNV |
| 822 | wrap a raw entry point for the **backwards** pass; infer `[CUDAKernel]` on backward from forward | mkeshavaNV |

These are three faces of one design: **what slangpy does with an already-tagged (or nearly-tagged)
raw entry point.** Strong candidate parent: **#768 "Support raw dispatch in slangpy"** (2026-02-02,
mkeshavaNV, same label/milestone) — which unlike these **has a real body with a task checklist**,
and states `mymodule.myfunc.dispatch` "is not well maintained and should be retired."
⚠️**That parentage is my INFERENCE from titles + timing, not established** — the triager should
open #768's checklist and check whether these three are already items in it. If they are, the
verdict may be *fold into #768 and close as duplicate*, which is neither "reassign" nor "close as
irrelevant."

## ⛔⛔ THE VERDICT WAS ALREADY PUBLIC BEFORE I DISPATCHED — cmt `5196835011`, 20:13Z
`nv-slang-bot` posted a complete 5-bullet scrub verdict on #821 at **2026-08-05T20:13:38Z**
(self-edited 20:29Z) — **100 minutes before my 21:54Z dispatch.** Posted by a **sibling** session:
#820's (`sess-1785955405005-augy5t`), which picked up #821's own webhook, batched five scrubs
(#768 epic, #821, #899, #1001, #274), and reports *"seven verdicts posted"*. Its log also shows an
earlier #821 leg **died on a provider 429 without posting**, then succeeded on a later pass — which
is why no memo and no comment-id file existed for it.
⇒ My dispatch was **redundant**, not wrong-in-substance: the triager is now reconciling rather than
re-deriving, and the premise-correction I sent independently matches what it had already published.
⇒ ⭐⭐⭐**WORK COMPLETES ON THREADS IT DOESN'T BELONG TO.** My whole verification rested on
"no session on thread `…-821`" — true, and irrelevant: a batch handler did the work from #820's
session. **A per-thread session query is evidence about ROUTING, never about WORK.**
⇒ ⭐⭐**I had the receipt in hand and didn't read it.** I called `github_get_issue` on #821 *before*
dispatching and extracted only `assignees`. `comments_count` was **2** then and **3** now — the
verdict landed in between, but the artifact was always the right place to look.
See [[feedback_a_memo_is_not_a_receipt]] (rewritten — both halves of my original check were wrong).

## Routing decisions taken (2026-08-05)
- **#821 dispatched to `slangpy-triager` on thread `gh-issue-shader-slang/slangpy-821`** at 21:54Z
  (session `sess-1785966890874-kxhi4u`) — **redundant, see above.**
- ⛔**Do NOT self-dispatch the siblings** — parallel fan-out to the same peer from two sources
  creates duplicate sessions and the work happens twice. Cluster context passed as READING
  material, not as extra chains. ✅**Verified they were already routed by their own webhooks:**
  `slangpy-triager` (`ag-1780667169498-sqxdef`) holds live sessions on
  `slangpy-820`, `-822`, `-823`, `-844`.
- **I did not post on GitHub.** Closest-to-the-state: the triager holds the verdict and posts the
  5-bullet. A *new* comment (not an edit) is required to notify —
  [[feedback_an_in_place_edit_notifies_nobody]].

## ⛔ MY OWN FALSE STATUS VERB — caught on resume, 21:49Z restart
**This file originally read "Dispatched #821 only" — and no dispatch had fired.** I wrote the memo
first and the restart landed between the write and the `send_message`. The enumeration that caught
it: `ncl sessions list --limit 2000 | grep <triager-group-id> | awk '{print $4}' | sort` → 32 threads,
**#820/#822/#823/#844 present, #821 absent.** ⇒ ⭐⭐⭐**Write the status verb only AFTER the call
returns; on resume, distrust your own last few lines** — the exact failure the triager disclosed to
me on [[project_slangpy_823_tensorview_interop_buffer_noncuda]], reproduced by me on the sibling
issue within 24h. A memo is not a receipt.

⚠️**Two instrument traps hit while verifying this, both producing FALSE ZEROS:**
1. `grep "slangpy-triager"` over `ncl sessions list` → **0 rows, exit 0.** That output carries
   `agent_group_id`, **not the group name** — the pattern could never match. I had to resolve the
   name→id via `ncl groups list` first. ⭐**Grep for a field the output actually contains.**
2. The bare `grep` returning nothing looked like "not dispatched" for the *right* reason by luck.
   The control (`wc -l` → 2002 rows; `grep -c "slangpy-"` → 183) is what licensed reading any zero
   at all. ⭐**A control validates the INSTRUMENT, never the target** —
   [[feedback_control_the_instrument_not_the_reasoning]],
   [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].

## ✅ RESOLVED 2026-08-05T22:07Z — verdict published, ownership finding delivered
`slangpy-triager` reconciled rather than re-derived. **Two artifacts, deliberately split:**
- `5196835011` **patched in place** 22:07:20Z — corrections + line-cite fixes + the #879 staleness finding.
- `5197948085` **NEW comment** 22:07:51Z — carries *only* the ownership delta, because an in-place
  edit notifies nobody and this is the half a human must act on.
  ⇒ ✅**The storage-vs-receipt split was applied correctly** — see [[feedback_an_in_place_edit_notifies_nobody]].

**Ownership — now a finding, not a downgrade.** `ccummingsNV` has **never acknowledged #821/#820 in
any form**: 0 comments on #821/#820/#822/#768, 0 PRs referencing either number, no self-assignment,
no `connected`/`referenced` event; only auto `mentioned`+`subscribed`. **Both `assigned` events have
`actor: mkeshavaNV`** ⇒ the field records the DEPARTING owner's intent, not the receiver's assent.
Published as **"nominated, not accepted"** with an explicit ask to `jkiviluoto-nv`.
⭐**Commit-activity was demoted to explicitly non-load-bearing** — he touched this area (#870, #876,
#879) and merges actively today (#1085/#1082/#1081/#1075, Jul 30-31), but activity in a file is not
acceptance of a ticket.

**Corrected scope of the departure premise (this is the reusable output):**
- **NOT orphaned:** #821, #820 — reassigned away from mkeshavaNV 2026-03-13, ownership unconfirmed.
- **GENUINELY orphaned, needs rehoming:** **#822, #832, #844, and epic #768 itself.**

**Disposition still deferred and correctly so:** (a) close-as-satisfied / (b) rescope-to-port /
(c) hold — selected entirely by the **retire-vs-keep ruling on epic #768**. The triager did not let
reconciliation turn into a recommendation. **No fixer dispatched** — nothing to fix until #768 rules;
forwarding a maintainer decision as a fix task would bounce.

## MINE-VERIFIED at HEAD (not relayed) — clone `/tmp/spy821`, `slangpy/core/dispatchdata.py`
⚠️**Path is `slangpy/core/dispatchdata.py`.** My first read guessed `slangpy/builtin/` and got a
**404** — my own wrong path, not a missing file. ⭐**A 404 on a path you typed from memory is
evidence about your typing, never about the repo** (same family as the triager's own retyped-prefix
error below).

All three corrected line cites verify **exactly** on the real file:
- `:103-113` param validation · `:126-135` the emitted mini-kernel · `:84-135` the whole block.
- `:100` is `if ep is None:`; `:129-131` emit `[shader("compute")] [numthreads(...)] void
  <name>_entrypoint(...)`; `:122-123` default `uint3(32,1,1)`. ✅ Verdict body is accurate.

**⛔ The latent defect is REAL — but my "widened" enumeration was WRONG on 2 of 6, and the
triager caught it.** Line `:108` reads `not "uint" in slang_function.parameters[0].type.full_name`.

⛔⛔**MY ERROR: I listed `vector<uint,3>` and bare `uint` as defects. They are the check WORKING.**
`full_name` is `slang_target()->getFullName()` (`src/sgl/device/reflection.cpp:243-248`) and Slang
renders vectors in **canonical generic form** — so **`uint3` reflects AS `vector<uint,3>`**.
✅MINE-VERIFIED, `/tmp/spy821`: `slangpy/tests/device/test_reflection.py:511-514` asserts
`("vector", "vector<float,3>", "float3_var")` — a field *declared* `float3` reflecting as
`vector<float,3>`. And `test_raw_dispatch.py:19` declares `uint3 dispatchThreadID`, so the two green
tests pass **only because the substring matches `vector<uint,3>`**. Bare `uint` is the legitimate 1-D
thread id the `:112` message itself names.
⇒ ⭐⭐⭐**I enumerated a PREDICATE over type names I INVENTED, never over names the reflection layer
actually produces.** The predicate arithmetic was correct and the input set was fiction — so the
output was well-formed and partly false. **A hand-built input set is a hypothesis about the domain;
`uint3` was never in it.** Exactly the defect I had just published a learning about (retyped
citations) in a new costume: I fed my own invention to a check and read the result as measurement.

**GENUINE (5 of my 6 minus the 2 above, plus the reported one):** `uint4`, `uint4x4`, `uint2x3`,
`uint64_t`, `uint16_t`. ⚠️**`uint4x4`/`uint2x3` spellings are UNVERIFIED INFERENCE on both our
parts** — no matrix `full_name` assertion exists in the suite. ✅Controlled that absence myself:
`grep -c 'matrix<' test_reflection.py` → **0** against `grep -c 'vector<'` → **19** in the same file
(the grep discriminates). ⇒ Do not publish the matrix rendering as measured; the conclusion survives
regardless, since a substring test cannot discriminate either way.

**Severity (unchanged, mine):** whatever passes is emitted at `:117` as
`{declaration}: SV_DispatchThreadID` ⇒ a matrix or 64-bit param binds to a thread-id semantic and
fails in **generated** Slang, far from the cause, with an error message that misdescribes the contract.

⛔**NOT a one-line fix — my "ready one-line fix" hook was wrong.** A correct predicate must ACCEPT
`vector<uint,N≤3>` **and** bare `uint` while REJECTING sized ints and matrices ⇒ it has to test
`kind`/`scalar_type`/`row_count` via reflection, not the name string. **Naive tightening to an exact
`uint1/2/3` test regresses the ONLY tested path.** The loose check may even be deliberate *because*
`uint3` doesn't stringify as `uint3`.
⇒ ⭐⭐**"Obviously a one-liner" was an artifact of not knowing the domain** — the same gap that
produced the bad enumeration. Cost of the two errors was identical and they had one root.
**RESUME hook:** if anyone opens raw-dispatch validation work, treat this as a reflection-API change
with the two green tests as the regression guard, NOT a string-tightening.

## The triager's own self-caught error — worth keeping as a pattern
Its verifying subagent reported *"path is WRONG"* about `slangpy/bindings/generator.py` — **a string
that only ever existed in the triager's own prompt**, retyped from a repo-layout list where
`bindings/` is a real sibling dir. The published comment never contained that prefix. It nearly
published its own typo as a correction to itself, and the subagent's report **looked like independent
confirmation.**
⇒ ⭐⭐⭐**When verifying a citation, `grep` it out of the ARTIFACT; never retype it from your working
summary.** A subagent handed a fabricated quote will confirm the fabrication — it has no access to
the original. Sibling of my own 404 above, and of my truncated-limit error: **three instrument
defects in one chain, all of which rendered as clean findings.**
Its `assigned`-event jq also returned a **false zero** on #821, caught only by positive-controlling
against #820/#822/#768. ⭐**Same shape as my 2000-row truncation: a clean zero from a broken
instrument is indistinguishable from a real negative until a control runs.**

## Related
- [[project_slangpy_823_tensorview_interop_buffer_noncuda]] — same batch, same requester; source of
  the **void-gate** lesson (a hold is only as valid as the availability of the person it waits on).
- [[project_9661_cuda_getdimensions_scrub]] — same batch on the slang side; there the trap was
  body-vs-thread disagreement. **Here the trap is the inverse: there is no body at all.**
- [[slang-slangpy-tooling-chains-index]] — routing index for slangpy chains.
