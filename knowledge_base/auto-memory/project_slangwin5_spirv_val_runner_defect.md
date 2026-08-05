---
name: project_slangwin5_spirv_val_runner_defect
description: "SLANGWIN5 SPIR-V validation broken wholesale (`PASSING [866/866]` + `spirv-val [0/866]`) — an infra outage that reads as 866 shader bugs. FILED: #12341 (depool) + #12342 (in-tree `validate()` conflates validator-absent with genuine-rejection). ATTRIBUTION is solid on two independent controls (same-head att2 WIN5 ❌ / att3 WIN4 ✅; and 3 runners / 1 job / 22 min); MECHANISM is unknown — VS 17→18 is a hypothesis only, the job sets up no VS at all. ⛔ Many claims here were RETRACTED — read before restating ANY of it: 'reruns futile' (runs-on is a POOL), 'att1 ran 0 jobs' (page cap 30 of 37), 'zero diagnostic text' (withdrawn as a strawman refutation), cost 3→2 evictions, and the rerun fail-fast mechanism (16 s head start vs 1.5–5.2 min idle gap ⇒ REFUTED). There is NO `spirv-val` binary — validation is in-process `glslang_validateSPIRV`."
metadata:
  node_type: memory
  type: project
  originSessionId: 02f511c2-578b-4ccf-bd07-2049b7969ecd
---

⚠️ **FRONTMATTER REPAIRED 2026-08-04 17:0xZ.** This file was found with `name: ""`, **no `description`, and no `type`** — while an index row was citing content as "sitting in this very child's frontmatter." The description is the field recall reads to decide whether to open a file, so **the largest, most-corrected child in this chain had no recall surface at all**, and nothing about the file *looked* broken: it opened fine, its links resolved, its body was intact. ⭐⭐**A structural check on a memory file passes on an empty description — the failure is invisible to every check except reading the frontmatter itself.** ⭐⭐⭐**And it is a SILENT-LOSS class distinct from the deletions we guard against: no row was dropped and no byte of body was lost, yet the file became unreachable-by-relevance.** Blast radius: unknown — this store has ~4 sibling writers and no line-level provenance, so **check the frontmatter of any large child you open**, not just its body.

## ⛔⛔ 10:16Z — "RERUNS ARE FUTILE" IS RETRACTED. `runs-on` is a POOL, not a host.

**Main-verified on ONE unchanged head `ba156ebf` (#12322), run `30885595493`:**

| attempt | runner | compile-regression |
|---|---|---|
| 1 | **SLANGWIN5** | ❌ failure |
| 2 | **SLANGWIN5** | ❌ failure |
| **3** | **SLANGWIN4** | ✅ **success** |

`runs-on: [Windows, self-hosted, regression-test]` is a **label set = a pool**. The author fired attempt 3 after the babysitter declined; #12322 is now 52/0 green.

⇒ ⭐⭐**The attribution was right; the REMEDY INFERENCE was wrong.** "The fault is host-scoped" does not imply "a rerun lands on the same host" — that needs a *pinning* mechanism, and label dispatch is the opposite of pinning. **I relayed "reruns are counterproductive" to the operator twice.** The ~1-in-3 re-hit was real; stating it as *futility* was not.

⭐**Generalizable: I inferred a DISPATCH property from a DEFECT property.** Scope-of-fault (which box is broken) and scope-of-routing (which box gets the next job) are independent facts needing independent evidence — the `runs-on` line is the instrument for the second, and neither of us read it until now.

### ⚠️ My own "is the box drained?" check was ALSO non-discriminating

I found no SLANGWIN5 rows in the 5 most recent runs — then checked whether **any** compile-regression job ran in that window: **zero**. So the absence proves nothing about drainage, only that the job wasn't dispatched. **A zero with no non-zero control, again.** The load-bearing evidence is the babysitter's: SLANGWIN5 **took and passed a `test-falcor` job at 09:40Z** ⇒ demonstrably still in the pool.

## 14:2xZ — OCCURRENCE 5, self-resolved. Plus a SECOND signature and a VS-upgrade lead (hypothesis only).

**#12324** (APPROVED, head-green) evicted 11:28Z by SLANGWIN5 `spirv-val [0/866]` with compiles `866/866`. **Main-verified the self-resolution:** the queue re-dispatched on its own at 13:05:45Z (run `30912135816`), compile-regression landed **SLANGWIN4** at 13:43:02Z and **succeeded**; #12324 is back at `AWAITING_CHECKS`, `mergeable_state=blocked`. ⇒ **requeue was MOOT, not skipped** — consistent with the retracted-futility finding: the pool self-heals ~2-in-3.

**Second, distinct signature (new):** nightly VKGLCTS on SLANGWIN5 — `SLANG: failed to load slang.dll`, **11545/13792 failed** vs **0/13792** the previous day, on a box that has run that job **10/10 days** ⇒ a clean 9-day green baseline. **Both faults are "a freshly built Slang binary can't resolve a DLL/symbol"** — which is a stronger unifying description than either alone, and it fits the `validate()` symbol-lookup path.

**Lead: SLANGWIN5 was upgraded VS 2022 (17.14.19) → VS 18 (18.8.2)** between 08-03 and 08-04 — i.e. across the onset window.

⚠️**Babysitter labelled this a HYPOTHESIS, not a root cause, and the caveat is the right one:** `test-compile-regression` **sets up no VS at all** (0 hits for `vcvarsall`/`VSCMD` in both its green and red logs), so the VS version is **not observable on the job carrying the defect**. Correlation is **host-and-time only**. Confirming needs someone on the box to check whether the VS 18 install replaced the MSVC runtime that `slang-glslang.dll` links against. ⭐**Correctly not promoted to a cause — an upgrade that coincides with an onset window is a lead, and a lead named as a cause is how a plausible mechanism gets escalated.**

### ⚠️ My cross-tab could NOT reproduce the babysitter's — retention, not disagreement

Babysitter's today cross-tab: SLANGWIN5 × compile-regression **0 pass / 3 fail**; SLANGWIN4 **5/0**; WIN10X64-1 **2/0**. **Main-measured over the 100 most recent runs and found only FOUR compile-regression jobs total** (`SLANGWIN10X64-1 in_progress`, one `queued/unassigned`, `SLANGWIN4 success` ×2) — **zero SLANGWIN5 rows.**

⭐**That is NOT a refutation, and it is important not to read it as one.** Only **4 of 100** runs carry the job at all, so my window structurally cannot contain the babysitter's 10 observations; the failures it saw sit outside the 100 most-recent runs, and log/job retention prunes older ones. **A smaller sample disagreeing with a larger one over the same population is a sampling artifact until you show the samples overlap.** The one thing my measurement does establish independently: **the job is dispatching to SLANGWIN4 and WIN10X64-1 and passing there** — consistent with pool-lottery recovery, and with the box still being in the pool rather than drained.

## ⛔⛔ 14:3xZ — **NO DURABLE GITHUB ARTIFACT EXISTS FOR EITHER ASK.** Both live only in this chain. Filing authorized.

**Babysitter found the escalation-surface gap; Main verified it:**

| ask | open issues | note |
|---|---|---|
| depool/reprovision SLANGWIN5 | **0 open** (12 closed hits) | ✅**precedent exists**: #6951 *"Falcor perf test packSnorm2x16 error on SLANGWIN5"* and #3894 *"Investigate and fix non-deterministic Falcor test issue on SLANGWIN5"* — **runner-specific issues are an established pattern in this repo** |
| `GlslangDownstreamCompiler::validate` `SLANG_FAIL` conflation | **0** — `SpirvValidationFailed` open = 0, `"validator unavailable"` = 0 | in-tree, **independently useful regardless of this box** |

⇒ ⭐⭐**I have escalated this five times into chat and memory, and produced ZERO artifact a maintainer will ever read.** Everything — the 3-eviction cost figure, both signatures, the cross-tab, the `validate()` defect — dies with this session. **The persuasive number is only persuasive somewhere a human will encounter it.** This is the `feedback_recorded_is_unfalsifiable_across_tiers` rule biting on my own escalation path: dashboard messages and memory notes are not durable artifacts.

**Authorized the babysitter to file BOTH** (14:3xZ): the infra/runner issue (cross-tab + both signatures + VS lead explicitly labelled hypothesis-to-check) and the in-tree `validate()` issue. Rationale: the `validate()` one is worth filing **even if SLANGWIN5 is fixed tomorrow**, since the conflation is what made this triage expensive twice and will make the next one expensive too.

## ⚠️ "SLANGWIN5 is still broken" is now an INFERENCE, not a reading (babysitter's own correction)

Positive control: `test-falcor` on SLANGWIN5 started **13:52Z (success)** and again **14:18Z** ⇒ **still pooled, not depooled.** But **no `compile-regression` has dispatched to that box since the 12:01Z failure.** So the defect's *current* state is unobserved; occurrence count stays at **5**, and **the next compile-regression dispatch to that box is the actual test.**

⭐**Same per-TIME caveat that bit the gateway-401 "RECOVERED" note, now applied pre-emptively by the babysitter rather than after a retraction.** A 2.5-hour-old observation must not travel in the present tense. **Two separate facts: "the box is in the pool" (currently verified) and "the box is broken" (last verified 12:01Z).**

## ⭐ Time-axis case of the instrument-scope rule (babysitter, generalized)

My cross-tab non-result is now **explained, not just excused**: page 1 of `actions/runs` spans only **13:06Z → 14:33Z — 87 minutes** — because the repo generates **~690 runs/day**. The SLANGWIN5 failures at 00:48 / 08:18 / 12:01Z were **entirely outside that window.**

⇒ ⭐⭐**`per_page=100` on a busy repo is a SHRINKING DURATION, not a lookback.** Two compounding factors: only **4–5 of 100** runs carry `compile-regression` (job-specific sampling is **~20× sparser** than run sampling), and retention prunes independently. **RULE: prove the windows overlap before filing a disagreement** — the time-axis sibling of "a correct measurement over an unverified scope."

## ✅✅ 15:06Z — BOTH ISSUES FILED. Durable artifacts finally exist.

| issue | scope | link |
|---|---|---|
| **#12341** | infra — *"SLANGWIN5: SPIR-V validation reports 0/866 while all 866 shaders compile — runner-scoped, 6/6 failures, evicting PRs from the merge queue"* | https://github.com/shader-slang/slang/issues/12341 |
| **#12342** | in-tree — *"GlslangDownstreamCompiler::validate conflates 'validator unavailable' with 'shader invalid', so 0/N validation failures are indistinguishable from a mass regression"* | https://github.com/shader-slang/slang/issues/12342 |

Both **open**, `nv-slang-bot[bot]`, created 15:06:07Z / 15:06:14Z (Main-verified), cross-linked both directions, both carrying the bot disclaimer.

## ⛔ COST FIGURE CORRECTED: **2 evictions, not 3.** I was about to carry a 50%-overstated number to the operator.

**Main-verified the correction.** #12148's eviction (merge_group run `30871671290`, 02:24Z) had exactly **one** real failing job: `test-falcor / Test (Falcor)` — **not** compile-regression. And that Falcor failure is **host-independent**:

| run | Falcor job | runner | result |
|---|---|---|---|
| `30871671290` (#12148) | Test (Falcor) | **SLANGWIN5** | ❌ |
| `30889533285` (#12246) | Test (Falcor) | **SLANGWIN4** | ❌ |
| both | Test (Falcor Perf) | WIN10X64-1 | ✅ |

⇒ it fails on **two different hosts** ⇒ it is the tracked #12145 bug, which merely *happened to run* on the suspect box in #12148's case. **Corrected count: 2 evictions (#12246, #12324)**, each of which also carried an unrelated co-failure, so this defect was **never the sole cause** of either bounce — only the reproducibly host-scoped one.

⭐⭐**The rule, and it is the sharpest attribution lesson of the day: "failed on a run that used the box" ≠ "failed because of the box."** I had accepted a co-occurrence as causation because the box was already the suspect — **confirmation bias operating through a correctly-identified suspect.** And the cost of publishing it would have been asymmetric: a maintainer independently finding the 3-vs-2 error would have had grounds to distrust the solid parts too, which is how a sound infra report dies.

## ⭐ Two things got STRONGER

1. **The defect is now LIVE, not inferred.** A compile-regression landed on SLANGWIN5 at 14:40Z and failed **14:50:36Z** with `spirv-val [0/866]` (job `92023450909`) — **occurrence 6**, cited in #12341 with the timestamp. The "inference not a reading" caveat is discharged by measurement.
2. **The rigorous control that kills the benign explanation.** #12322, unchanged head `ba156ebf`, three attempts: SLANGWIN5 `0/866` → SLANGWIN5 `0/866` → **SLANGWIN4 `866/866`**. Because that job only *downloads a prebuilt artifact*, **all three attempts validated the same binaries** ⇒ this refutes *"the artifact lacks `slang-glslang`"*, since the identical artifact validates fine elsewhere. Final cross-tab: **SLANGWIN5 0/6 · SLANGWIN4 6/0 · WIN10X64-1 3/0.**

## ⭐ Process catch worth propagating — `gh search` returns FALSE ZEROES from indexing lag

The babysitter's "zero open issues" claim came from `gh search`; a shared-learnings hit warned that search can report false zeroes, so it **re-verified by enumerating all 60 open issues via REST and grepping locally** before filing. Clean, no duplicates.

⭐**Had it trusted search, it might have filed a duplicate on the very escalation it was criticizing as undocumented.** ⇒ **for a pre-filing duplicate check, enumerate + grep locally; never trust a search zero.** Same family as every other absence-claim failure today, and note the store-search rule earned its keep here.

## ⚠️ Path correction — `validate()` lives in `source/compiler-core/`, not `source/slang/`

Main-verified at `ca76f8781`: `source/compiler-core/slang-glslang-compiler.cpp` → **HTTP 200**; `source/slang/slang-glslang-compiler.cpp` → **404**. Our memory had the wrong directory. Corrected here and in #12342's citations.

## ⛔⛔ 15:2xZ — **THIS SECTION'S ORIGINAL HEADING WAS WRONG AND IS WITHDRAWN. I OVER-RETRACTED A TRUE CLAIM, IN A CORRECTION, ON A PUBLIC ARTIFACT.** Read this box before anything below it.

**Withdrawn heading (do not reuse):** *"THE PUBLISHED #12341 BODY REPUBLISHES 'zero validator diagnostic text' — the claim I REFUTED ~7h EARLIER."*

✅**"Zero validator DIAGNOSTIC text" is TRUE and now measured on both poles.** ⛔**Only the looser "plus SILENCE" gloss and the "866 invalid shaders WOULD emit 866 messages" counterfactual were defective.** I sent the babysitter a stop-work correction that would have struck a true claim from a public issue; they were mid-verification and caught it independently.

⭐⭐⭐**MY DEFECT #1 — I REFUTED A STRAWMAN.** I read *"validator diagnostic text"* as *"any per-shader text"* and refuted it with the 1732 `- FAIL` lines. But a `- FAIL` token is a **harness verdict**, not a validator diagnostic. **The claim was about validator-emitted content and I never tested that reading.** ⇒ **before refuting a phrase, enumerate its plausible readings and test the STRONGEST one — a refutation of the weakest reading feels identical from inside.**

⭐⭐⭐**MY DEFECT #2 — I GENERALIZED FOUR ZERO-HITS INTO A DEAD MARKER CLASS.** I told them the error-body check was *uniformly* non-discriminating on the strength of 4 markers at 0/0. Running the full ladder found **two asymmetric hits I had missed**: `error` **1 vs 0** and `SPIR-V` **2 vs 0**. ⇒ **`n` zeros do not establish a class is empty; and LADDER EVERY HIT, NOT JUST EVERY ZERO — my own rule, unrun on my own correction.**

⭐⭐⭐**THE COMPOUNDING FACTOR: this rode in on a CORRECTION.** My store already says errors cluster in corrections (authority high, scrutiny low) — this is that rule firing on me while I was *invoking* it. A correction arrives carrying authority, and the recipient had **already started editing a public artifact** on it. ⇒ **a correction to a PUBLISHED artifact needs the FULL ladder before it is sent, not after** — the recipient's action is concurrent with your reasoning.

✅**WHAT ACTUALLY CARRIES THE ARGUMENT — and it is stronger than either of our glosses (Main-verified att1, 15:2xZ):** the summary block names every failed shader with **no diagnostic attached**. Two blocks (one per mode), at lines **5535** and **6402** in att1: each **866 lines, 866 matching bare-filename shape, 866 DISTINCT**; first non-bare line after block 1 is the mode-2 header, after block 2 is `##[error]`. **866 + 866 = 1732 = the exact FAIL count.** Zero such blocks in healthy att3.

✅**Babysitter's structural reframe — Main-verified, and it beats my "1732 vs 3464" framing:** the suite prints **two result lines per shader per mode** (compile, then validate). **Both poles have the SAME 3464 total result lines** — broken is `PASS`+`FAIL` (1732/1732), healthy is `PASS`+`PASS` (3464/0). Measured: att2 PASS 1732 + FAIL 1732 = **3464**; att3 PASS 3464 + FAIL 0 = **3464**. ⇒ *not two different totals — the same lines, half flipped.*

⚠️**MY "`- FAIL` is emitted by `compile_all_slang.sh`" IS UNVERIFIABLE — babysitter correctly refused to publish it.** That script is **not in the tree**; `ci-slang-regression-test.yml:39-42` copies the suite from `C:\slang_compile_test_suite_a` on the runner. Log structure *supports* the reading; the emitter is **unobservable**. ⭐**They kept the counts and the structure, and dropped the attribution — the argument never needed it.** A mechanism claim smuggled into a measurement correction, caught by the recipient.

✅**LIVE BODY VERIFIED BY ME (not by their summary), 15:2xZ:** absent — `plus silence` 0, `zero-of-all` 0, `would emit 866` 0, `silence` 0 (raw + collapse-and-squeeze, non-zero control 122 lines). Present — `not one validator message` 1, `following shaders failed` 1, `does not assert what such a log` 1, `866 + 866` 1. Disclaimer intact as last line. **All 6 added job-log links resolve to the runner+conclusion the table claims.**

✅**THEIR CHARACTERIZATION OF *MY* CONTROL — verified, and it sharpens what it proves.** All three jobs are `attempt=1`, `event=pull_request`, **three different branches/heads**: `92021839632` WIN4 ✅ `compile-perf-export-tot-binaries` `9702b6dc85` · `92022571008` WIN10X64-1 ✅ `12045-deprecate-legacy-struct0` `c514c1160f` · `92023450909` WIN5 ❌ `compile-perf-memory-tracking` `f07e487123`. ⇒ **the two controls are complementary: the #12322 triple holds CODE constant and varies runner; mine holds a 22-MINUTE WINDOW constant and varies runner+code.** I published mine without checking its branches — **they characterized my own instrument more precisely than I did.**

⭐⭐**Meta: reproducing someone's NUMBERS does not validate their INFERENCE from those numbers** (their words, and it is the cleanest statement of what went wrong — my counts reproduced exactly; my reading did not).

---

**Original section follows — its measurements are sound; its VERDICT is superseded by the box above.**

⚠️**A sibling logged the filing + the 3→2 eviction correction above. This section is the part nobody caught: the artifact contradicts our own retraction.**

**Published wording in #12341:** *"The tell is a 0/N total wipeout in both validation modes, with compiles at 100% and **zero validator diagnostic text**. 866 genuinely-invalid shaders would emit 866 validator error messages and would not compile cleanly. **Zero-of-all plus silence** means the validator never ran."*

**Re-measured 15:1xZ, all three attempts of run `30885595493`, logs pulled fresh:**

| log | runner | spirv-val | `- PASS` | `- FAIL` |
|---|---|---|---|---|
| att1 `91920971585` | SLANGWIN5 | `0/866` | 1732 | **1732** |
| att2 `91937057380` | SLANGWIN5 | `0/866` | 1732 | **1732** |
| att3 `91940624213` | SLANGWIN4 | `866/866` | **3464** | **0** |

⇒ ⛔**There is no silence.** The broken logs carry **1732 `- FAIL` lines paired 1:1 per shader** (`./0_preprocessed_cs.hlsl - PASS` immediately followed by `- FAIL`). **One `grep -c -- '- FAIL'` on the log the issue itself links refutes the published sentence.**

⛔**The error-body fallback cannot rescue it** — I re-ran all four markers on **both poles**: `error:` 0/0 · `Validation failed` 0/0 · `Invalid` 0/0 · `OpType` 0/0. **Identical in the HEALTHY log** ⇒ discriminates nothing free-standing. (Third time today this exact control has had to be re-run; it keeps coming back because the *conclusion* is right.)

⛔**And the following sentence is the UNVALIDATED COUNTERFACTUAL** — *"866 genuinely-invalid shaders would emit 866 validator error messages"*. **We hold no genuine-mass-regression log.** Reasoning published as observation, in a report whose credibility rests on being measured.

### ⭐⭐⭐ The new axis — a correction that lives in the CHAIN does not reach the ARTIFACT the chain produces

The refutation landed ~08:3xZ, was re-derived ~10:2xZ, and is in this file's **own frontmatter `description`** (`⛔NOT 'zero diagnostic text'`). The filing went out **15:06Z — ~7h later, by an author holding the correction.** ⇒ **not a timing race.** The chain's *narrative* supplied the phrasing; the chain's *retraction* was a later paragraph nobody re-read while drafting prose.

⭐⭐⭐**This is [[feedback_correction_unapplied_until_every_restatement_fixed]] crossing a NEW boundary — from internal notes into a PUBLIC artifact addressed to a third party.** My store already says the blast radius includes DERIVED artifacts; the derived artifact here is a GitHub issue a maintainer will grep. **Add to the position sweep: headings → title/frontmatter → tables → index rows → prose → ⭐PUBLISHED ARTIFACTS DERIVED FROM THE NOTE.** A retraction at the top of a note does not travel into a document quoted out of the note's middle.

⭐⭐**Why it costs more than its size:** the attribution is *correct* and now well-controlled (0/6 vs 6/0 vs 3/0). A maintainer who greps for the claimed silence finds 1732 FAIL lines and discounts **the sound runner-scoping argument too** — the reader cannot tell which claims were measured. **A refuted detail inside a correct report damages the correct part.** Exactly the asymmetry the sibling named for the 3-vs-2 count, recurring in the same document via a different clause — ⇒ **the co-author who caught one instance did not generalize the sweep, and neither did I until I read the published prose against the logs.**

✅**The replacement needs NO new work — both poles are already measured:** *the tell is the **SPLIT** — both non-validator modes `866/866` while both validator modes `0/866`; the `- PASS` count **1732 (866×2) vs 3464 (866×4)** is a second independent tell.* This is already in #12341's own code block; **only the prose gloss is wrong.**

### ✅ Fresh same-window cross-runner control (mine, independent of the morning triple)

Enumerated every compile-regression job in the current run page (`13:38Z→15:07Z`), **`per_page=100` throughout, 0 bound violations across 100 runs** (`total_count == (.jobs|length)` on every call — the pagination trap that bit me at 10:3xZ, checked this time):

| job | runner | result | started |
|---|---|---|---|
| `92021839632` | SLANGWIN4 | ✅ success | 14:18:31Z |
| `92022571008` | SLANGWIN10X64-1 | ✅ success | 14:29:31Z |
| `92023450909` | **SLANGWIN5** | ❌ **failure** | 14:40:15Z |

⇒ **three runners, one job, 22 minutes, one failure — same box.** Occurrence 6 confirmed live (14:40:15Z→14:50:36Z). ⭐**A newly-manufactured control, not the retention-limited survey and not the same-head triple** — so runner-scoping now rests on two independent controls.

⚠️**Instrument note:** `actions/workflows/304423275/runs` (`ci-slang-regression-test.yml`) returns **`total_count=0` ALL-TIME** — it is `workflow_call`-only (verbatim `on: workflow_call`), so it has no runs of its own; the jobs live under the **caller's** run. **Non-zero control run:** `compile-regression-test.yml` (`88428719`) returns `total_count=13089`. ⇒ **the morning's "0 rows from 400 runs" was this same defect** — a reusable-workflow id queried for runs it structurally cannot have. Sibling of [[technique_grep_in_repo_a_misses_reusable_workflow_in_repo_b]] on the **runs** axis: *a `workflow_call` workflow is a POINTER, and a zero from its runs endpoint is a category error, not evidence.*

## ⭐⭐ 16:4xZ — RERUN AFFINITY: rerunning the SAME RUN tends to return to the box that just failed it

**Main-verified attempt-level runners across the two runs with retained data:**

| run | att1 | att2 | att3 |
|---|---|---|---|
| `30914831831` (#12125) | SLANGWIN5 ❌ | SLANGWIN5 ❌ | **SLANGWIN5 ❌** |
| `30885595493` (#12322) | SLANGWIN5 ❌ | SLANGWIN5 ❌ | **SLANGWIN4 ✅** |

⇒ **4 of 7 rerun draws ESCAPED to a healthy box; 3 redrew the defective one** — where the 7 = *draws whose PRIOR attempt drew SLANGWIN5* (⚠️the selection rule is part of the figure: every-attempt≥2 gives 8-of-12, and the babysitter's *reruns-it-fired* question gives 2-of-2 — three true answers to three different questions). ⚠️**It is a TENDENCY, not a rule** — #12322's attempt 3 *did* move and pass, which is the case that originally refuted "reruns are futile." **Both facts must travel together**: reruns work (the pool self-heals) *and* they're biased toward the box that just failed.

### ❌ 17:0xZ — the fail-fast mechanism is **REFUTED**, not merely unproven (author-retracted, Main-reproduced)

The hypothesis was: the defective box **fails fast** ⇒ goes idle first ⇒ claims the next queued job. Two measurements kill it. **Main re-derived both from `attempts/N/jobs` `started_at`/`completed_at`, second resolution:**

| quantity | value |
|---|---|
| fail on SLANGWIN5 | 10.35 · 10.50 · 10.33 · 10.27 · 10.37 min ⇒ mean **10.36** (n=5) |
| pass on SLANGWIN4 | **10.63** min |
| ⇒ head start | **0.27 min ≈ 16 s** |
| idle gap, #12125 att2→att3 | 16:27:09Z → 16:28:39Z = **1.5 min** |
| idle gap, #12322 att2→att3 | 08:42:02Z → 08:47:16Z = **5.2 min** |

⇒ **the idle gap is 6–20× the head start.** Every box in the pool is idle and waiting well before the rerun is queued, so finishing 16 s earlier cannot bias the assignment. **The affinity is real and measured; its cause is UNKNOWN.** ⭐**Do not substitute a fresh just-so mechanism** — this one was plausible, quantitative, and wrong, and the plausibility is what kept it alive for an hour.

⛔⭐⭐⭐**MY OWN DEFECT HERE IS THE MORE USEFUL ONE: I wrote "far too coarse to confirm — a 0.2-min delta cannot be resolved from `floor`-minute timestamps." THAT IS FALSE. `started_at`/`completed_at` are full ISO-8601 WITH SECONDS**, which is 8× the resolution needed. ⇒ ⭐⭐⭐**"too coarse to measure" is a CLAIM ABOUT AN INSTRUMENT and needs the same verification as a claim about the world — I asserted a precision limit without ever checking the field's precision.** Its specific cost: declaring the hypothesis *not-yet-falsifiable* **parked** it, where a 30-second subtraction would have refuted it immediately. ⭐⭐**An unfalsifiability verdict is the one verdict that ends inquiry while looking like rigour** — it reads as epistemic caution and functions as a stop. **Before writing "cannot be resolved," print the two raw values.**

**Practical rule regardless of mechanism: cap reruns at 2 per run, then prefer a FRESH DISPATCH** (a push or a new queue entry) over a third attempt on the same run. Babysitter held at 2/3 rather than burning the last slot — correct.

⭐**This refines, rather than reverses, the futility retraction.** The earlier correction was *"`runs-on` is a pool, so a rerun is a lottery."* True — but **the lottery is weighted toward the loser**, so the naive expectation of ~2-in-3 recovery per attempt is optimistic *within a single run*. Fresh dispatches were near-uniform across the 3-box pool; same-run reruns were not. **Scope-of-routing differs between "rerun this run" and "dispatch a new run" — a distinction neither of us drew until now**, and it is the third time this chain that a dispatch property turned out to be independent of the fault property.

## ⛔ Babysitter's metric correction — "reruns per day" was inflated ~2.4×, and I relayed those figures

**87 of 150 (58%)** rows logged `action:"rerun"` were actually **DECLINES** (reason beginning `"NOT RERUN"`). ⇒ past rerun counts it sent me — and that I passed upward — were inflated ~2.4×, **and buckets it correctly REFUSED outranked ones it acted on**, which inverts the whole point of a signature ranking. Corrected 7-day figure: **40 true reruns across 28 PRs** (distinct `run_id`, declines excluded). Now logs `action:"decline"`.

✅**No cap was ever breached** — the *tracker* enforces caps and was right at 0 throughout; only the *log's* reporting field was wrong. ⭐**Two stores, one right and one wrong, and the wrong one was the one feeding reports** — the enforcement path and the reporting path had different sources of truth, so the error was invisible to the mechanism that would have caught a real breach. **When a counter feeds both enforcement and reporting, verify them against each other; agreement is the check, and here there was none.**

⚠️Corrected top signatures (7d): Falcor GBufferRTTexGrads/numeric **10/40 (~25%)**, timeout/hang 9, SLANGWIN5 `spirv-val` 5, dep-fetch 5xx 2. **12 of 40 remain unclassified** — babysitter flagged that as its own tagging gap rather than smoothing it, which is right.

## Signature — an infra outage wearing a codegen-regression costume

`test-compile-regression / Test (Compile Regression)`:
```
PASSING [ 866 / 866 ]                          <- every shader COMPILES fine
PASSING spirv-val [ 0 / 866 ]                  <- validator scores ZERO
PASSING Non-Semantic Info spirv-val [ 0 / 866 ]
exit code 255
```

⛔**CORRECTED 08-04 (approver-found, Main-verified) — my published discriminator was FALSE.** I wrote "ZERO diagnostic text." **Measured on job `91933869838`'s own log: 1732 `- PASS` lines and 1732 `- FAIL` lines, paired 1:1 per shader** (`./0_preprocessed_cs.hlsl - PASS` immediately followed by `... - FAIL`). There is abundant per-shader text; every shader compiles then fails validation.

⛔⛔**MY REPLACEMENT DISCRIMINATOR WAS *ALSO* NON-DISCRIMINATING — corrected 10:2xZ, Main-measured against the healthy att3 log.** I wrote: *"the correct discriminator is the absence of the VALIDATOR ERROR BODY"* — `error:` 0, `Validation failed` 0, `Invalid` 0, `OpTypeVoid` 0 in the broken log. **The HEALTHY log (att3, job `91940624213`, SLANGWIN4, same head) has those markers at 0 as well** — nothing failed, so there is no error body to print. **A signature present in both states discriminates nothing.**

⭐**Correct form requires the PRECONDITION:** *GIVEN `spirv-val 0/N` together with per-shader FAIL lines, an absent error body ⇒ broken validator.* Free-standing, it is worthless.

⛔**And the "a genuine mass regression would NAME what was invalid" half is an UNVALIDATED COUNTERFACTUAL** — no such log is in hand. Keep it flagged as reasoning, not measurement.

✅**Fully-measured signature instead, both sides in hand (Main-verified):**

| | broken (att2/WIN5) | healthy (att3/WIN4) |
|---|---|---|
| non-validator modes | `866/866` | `866/866` |
| **validator modes** | **`0/866`** | **`866/866`** |
| `- PASS` lines | **1732** (866×2) | **3464** (866×4) |
| `- FAIL` lines | **1732** | **0** |
| error-body markers | 0 | **0 — SAME, useless** |

⇒ **the discriminator is the SPLIT: both non-validator modes pass while both validator modes fail.** That is measured on both sides, needs no counterfactual, and the PASS-line count (1732 vs 3464) is a second independent tell.

⭐⭐⭐**This is the healthy-noise rule firing on my own fix** ([[feedback_expected_noise_line_is_not_a_failure_signature]] — *"ask what this prints when FINE"*). I had the rule, applied it to the original claim, and **did not apply it to the replacement** — see the replacement-rationale lesson below. **A fix inherits the burden of proof of the thing it fixes.**

⭐⭐**Why the wrong version survived: "zero diagnostic text" was never measured, it was INFERRED from the 0/866 summary and then restated as an observation.** A `grep -c` over the log — the check I already carry as my highest-yield instrument — refutes it in one command. **A discriminator is a claim about a log; run it against the log.** Compare a real regression: some non-zero pass count, *and* a validator error body.

## ✅ Runner-scoping — SUPPORTED again as of 10:20Z (was DOWNGRADED at 09:5xZ; the downgrade's *critique* still stands, the evidence base is what changed)

⭐⭐**Current status: SUPPORTED — by the same-head PAIRED control, NOT by the runner survey below (which remains worthless).** Main-re-verified via the API, both jobs in run `30885595493`, head `ba156ebf5c900ff89189c15347bafded7b4280ee`:

| attempt | job | runner | spirv-val | result |
|---|---|---|---|---|
| 2 | `91937057380` | **SLANGWIN5** | `0/866` | ❌ |
| 3 | `91940624213` | **SLANGWIN4** | `866/866` | ✅ |

Same run, same head, same code — two boxes, opposite outcomes. ⭐⭐⭐**A rerun on a POOL manufactures the within-head control whose absence forced the downgrade** ("one compile-regression job per run ⇒ no within-run control"). **The same fact that killed "reruns are futile" resurrected the runner claim — one unread one-line file (`ci-slang-regression-test.yml:14`) was load-bearing in both directions.**

✅**CITE ALL THREE ATTEMPTS — the evidence is a TRIPLE, not a pair.** Add attempt 1: job **`91920971585`, SLANGWIN5, `failure`**, same head, 07:18:45Z. So on ONE commit: **2❌ SLANGWIN5 / 1✅ SLANGWIN4.**

⛔**A prior note here said "att1 never ran compile-regression (bound test 0/1/1, 30 jobs)" — that is FALSE and RETRACTED.** Re-measured attempt-scoped: **1/1/1, 37 jobs each.** ⛔**The mechanism I first blamed — "`runs/{id}/jobs` returns only the latest attempt" — is the WRONG CAUSE** (the note already used the attempt-scoped endpoint). ✅**Real cause: PAGINATION** — default page = **30 of 37** jobs, no error; compile-regression sits at row index **31** in att1 (outside the page) vs **12/11** in att2/att3. Fix: `per_page=100`. ⭐⭐⭐**Compare `.total_count` vs `(.jobs|length)` before any bound test — a 30 from a jobs endpoint is the PAGE CAP, not a count.** ⇒ ⭐⭐⭐**an endpoint that silently scopes to "latest" answers a snapshot question when you asked a history question** — and the wrong answer arrives as a confident zero. (See the retraction near the bottom of this file for full provenance.)

The table below is what I originally published as the *survey*. **It is still not load-bearing** — for two reasons found by the approver and confirmed here, both of which remain valid criticisms of the survey even though the underlying claim now has better support:

1. The cited SLANGWIN5 failures include job `91860189526` on branch **`fix/issue-12333`** (`event=workflow_dispatch`) — an unrelated branch. That *strengthens* "not caused by any one diff" but says nothing about the runner.
2. **I could not reproduce a runner-conditioned pattern.** Only **4** compile-regression jobs survive log retention across a 300-run population: SLANGWIN4 ✅×2, SLANGWIN5 ❌×1, SLANGWIN10X64-1 (in-flight). **One failure on one box is not a runner claim.** A deeper workflow-scoped sweep returned 0 rows from 400 runs — an instrument defect (wrong workflow id), **not** evidence of absence, so I draw nothing from it either way.

⭐⭐**What survives is the tool-vs-host separation, which never depended on runner-scoping:** `test-benchmark` succeeded on SLANGWIN5 at 08:17:38Z, 74s before compile-regression failed on it at 08:18:52Z (both Main-verified in the same run). The box is healthy; the validation path is broken. **Do not cite "SLANGWIN5 is the bad runner" as established** — and the remedy therefore is *not* "reprovision one box."

| runner | window | result | status of this row |
|---|---|---|---|
| **SLANGWIN5** | 00:48:47Z (run `30853970717`, `fix/issue-12333`) and 07:18:45Z (run `30885595493`, #12322) | ❌ | ⚠️retained as raw observation only |
| SLANGWIN4 | same window | ✅ | ⚠️2 jobs in retention, not "100%" |
| SLANGWIN10X64-1 | same window | ✅ | ⚠️not independently re-confirmed |

**Main-confirmed both failing jobs report `runner_name=SLANGWIN5`** — that is a true observation about those two jobs and nothing more. ⛔**SUPERSEDED by the downgrade above:** I originally wrote that the cross-run/cross-runner comparison "is the whole argument, which is why the runner survey is load-bearing." **It is not** — the survey rests on the same thin retention, so it cannot carry a runner claim. What actually carries attribution is the `fix/issue-12333` unrelated-branch reproduction (no diff in common) plus the same-run/same-host `test-benchmark` control.

**Structural proof it isn't the code (#12322):** touches only `tools/slang-test/slang-test-main.cpp` (+17/−2), while this job runs `slangc` via `compile_all_slang.sh` and **never invokes `slang-test`**. 34/35 sibling jobs green including every GPU test. Two unrelated PRs ⇒ infra, **not** "one runner ⇒ infra" (that inference is retracted).

## ✅ RESOLVED-AS-PREDICTED (was 🔴 LIVE RISK, Main-found 08-04 08:2xZ) — the THIRD occurrence evicted #12246 at 09:18:45Z; see "DISCHARGED" below before citing this section

Run **`30889533285`**, head `gh-readonly-queue/master/pr-12246-0864e60e...`, `event=merge_group`, compile-regression **`in_progress` on SLANGWIN5** at 08:18:52Z. #12246 is `open`, `merged=false`, `mergeable_state=blocked`.

⇒ **if the runner defect reproduces, #12246 gets evicted from the merge queue by an infra fault**, not by anything wrong with it. The babysitter reported #12246 as "healthy at queue position 1, AWAITING_CHECKS" — true at the time, and **the queue job had not yet been dispatched to the bad runner.** Escalated to the operator on this basis: the ask changes from "reprovision when convenient" to "reprovision or take SLANGWIN5 offline before it evicts a queued PR."

## 🔴 08:29Z — THE MERGE-QUEUE OCCURRENCE **FAILED**. Now 3/3 post-onset, two event types. Main-verified.

Job **`91933869838`** (run `30889533285`, `event=merge_group`, branch `gh-readonly-queue/master/pr-12246-0864e60e`) on **SLANGWIN5**: `conclusion=failure`, started 08:18:52Z, completed 08:29:21Z. Same summary signature, failing step `Run compile and validation test`, **no validator error body** (1732 PASS/1732 FAIL per-shader lines ARE present — see the corrected discriminator above).

⇒ **3/3 on SLANGWIN5 post-onset, across three distinct heads and now TWO event types** (`pull_request` + `merge_group`).

### ⭐⭐ The decisive control — Main-verified, and it isolates tool from host

**In the SAME run, on the SAME runner:**

| job | runner | started | conclusion |
|---|---|---|---|
| `test-benchmark / Test (Benchmark)` | **SLANGWIN5** | 08:17:38Z | ✅ **success** |
| `test-compile-regression / Test (Compile Regression)` | **SLANGWIN5** | 08:18:52Z | ❌ **failure** |

⇒ **the box is reachable and running jobs fine 74 seconds earlier — the defect is scoped to the `spirv-val` TOOL, not to runner health.** This is the non-zero control that turns "SLANGWIN5 is sick" into "spirv-val on SLANGWIN5 is missing/broken," which is a different and more actionable claim. It also rules out the lazy remedy of rebooting the box.

### ⚠️ Main's refinement on eviction timing — `test-compile-regression` is NOT itself a required check

Main-verified `branches/master` required contexts = **`check-formatting`, `check-ci`, `SlangPy Tests`** — exactly three, and compile-regression is **not** among them. **But `check-ci` aggregates**, and in run `30889533285` `check-ci` **has not run yet**: 8 jobs are still `in_progress` (sanitizer, falcor, 5× test-slang, rhi) with compile-regression the sole `failure`.

⇒ **the eviction is imminent, not yet recorded.** The red required check will materialize when `check-ci` rolls up. That sharpens the ask's urgency without overstating current state: **#12246 is still `AWAITING_CHECKS` position 1 / `mergeable_state=blocked`, and the failure that will evict it is already banked.** Every subsequent queue entry routed to SLANGWIN5 is exposed the same way.

### ✅ DISCHARGED 09:18:45Z — the eviction happened, and the timing model was right

Main-verified from `issues/12246/timeline`: `added_to_merge_queue` **07:51:44Z** → `removed_from_merge_queue` **09:18:45Z**. `check-ci` did roll up red exactly as predicted (final state of run `30889533285`: 3 failures out of 37 jobs — compile-regression/SLANGWIN5, test-falcor/SLANGWIN4, and `check-ci` the aggregator). PR is back to `OPEN` / `isInMergeQueue=false` / `mergeStateStatus=BLOCKED`, head unmoved at `f3b5b511886d`, `reviewDecision=APPROVED`. A `pr_ready_for_review` webhook fired ~60s after the eviction — **the eviction's echo, not new work**; routed to `slang-pr-approver` (first dispatch, no prior decision on 12246/12238, so no debounce).

⚠️**But the prediction was HALF right in a way that matters for the ask.** I framed this defect as the thing that would evict #12246. It was **one of two independent infra causes** in the same run: `test-falcor / Test (Falcor)` failed on **SLANGWIN4** with `renderpasses/test_GBufferRTTexGrads_d3d12 : FAILED (6.6 s)` — the standing #12145 flake, a *healthy* runner, a *different* box. Sibling `test-falcor / Test (Falcor Perf)` passed on SLANGWIN10X64-1 in the same run.

⇒ ⭐⭐**Reprovisioning SLANGWIN5 would NOT have saved #12246.** Before presenting a remedy as unblocking a specific victim, enumerate **all** the red required-check contributors and confirm yours is the only one — a correct diagnosis of one cause reads as a complete explanation of the outcome, and that over-claim is the same shape as citing a precedent without reading what it does. The escalation ask (reprovision or offline SLANGWIN5) stands on its own merits — every future queue entry routed there is exposed — but it must not be sold as "this unblocks #12246."

## Action

- ⛔⛔**"Rerun WITHHELD" — BOTH of my rationales are now DEAD.** v1 ("it can land on the same bad runner") presumed the retracted runner-scoping. v2, which I wrote at ~10:10Z ("the defect reproduces across branches, so a rerun re-tests nothing"), is **directly refuted by the pool evidence at the top of this file**: on one unchanged head, attempt 3 landed on SLANGWIN4 and **passed**. A rerun samples the pool, so it tests plenty. ⇒ **a rerun is a legitimate ~2-in-3 stopgap, not futile.** ⭐⭐⭐**I replaced a broken rationale with a second broken rationale and marked it "survives the downgrade" — the second one was newer, so it read as the corrected version.** A replacement rationale is a NEW claim and needs its own instrument; here the instrument was the `runs-on` line, one grep away and unread through three rounds.
- ⛔**Ask RE-GROUNDED — do NOT relay "reprovision SLANGWIN5 or take it offline."** That ask depended on runner-scoping, now unproven. The defensible ask: **restore SPIR-V validation in CI and add a positive control so a non-functioning validator is distinguishable from mass shader failure** (see the in-tree defect below — `slang-glslang-compiler.cpp` conflates validator-absent with genuine-rejection). Bot cannot fix CI infrastructure either way.

## ⚠️ 08:3xZ — THREE corrections, all Main-verified

### 1. ❌ "The bot structurally cannot verify branch protection" is FALSE — it's ENDPOINT-CLASSED

Babysitter got **403 `Resource not accessible by integration`** on `branches/master/protection/required_status_checks` and concluded the bot *structurally cannot* read branch protection, attributing the required-checks list to me rather than asserting it. **Honest, and half-wrong.** Main-verified both endpoints:

| endpoint | result |
|---|---|
| `branches/master/protection/required_status_checks` | ❌ **403** |
| **`branches/master` → `.protection.required_status_checks.contexts`** | ✅ **`["check-formatting","check-ci","SlangPy Tests"]`**, `protected=true` |

⇒ **the data is fully readable via the branch object; only the dedicated protection sub-resource is gated.** Exactly the same shape as the day's `gh` 401 being **path-classed** rather than global — see [[slang-tick87-instrument-lessons]]. **A 403 on one endpoint is evidence about that endpoint, not about the capability.** Attribute-rather-than-assert was the right *instinct* given what it had; the fix is to try a second route before concluding a capability is absent.

### 2. ✅ `compile_all_slang.sh` is genuinely NOT in the repo — the gate placement was wrong

Main-verified: `filename:compile_all_slang.sh` → **0 hits**; `slang_compile_test_suite` → **1 hit, only** `.github/workflows/ci-slang-regression-test.yml`. The script and the 866-shader corpus live only on the runner image at `/c/slang_compile_test_suite_a`.

**So "a one-line edit to `compile_all_slang.sh`" would send someone hunting a file that doesn't exist.** Correct placement — Main-read the actual workflow:
```yaml
34:  - name: Run compile and validation test
36:      set -euo pipefail
37:      SLANGC_PATH="$(pwd)/build/Release/bin/slangc.exe"
38:      [[ -f "$SLANGC_PATH" ]] || { echo "Missing required file: $SLANGC_PATH" >&2; exit 1; }   <- checks the COMPILER
39:      cp -r /c/slang_compile_test_suite_a .
42:      bash ./compile_all_slang.sh                                                              <- nothing checks the VALIDATOR
```
⭐**The asymmetry at `:38` vs `:42` IS the bug: a missing compiler fails loudly; a missing validator fails as "866 invalid shaders."** Gate goes beside `:38` (in-tree, reviewable) or on the runner image.

### 3. ⚠️ The cited precedent is WEAKER than described — `|| echo` does not fail a job

Babysitter modelled the gate on `ci-materialx-regression-test.yml:73`, saying it "already does exactly this." Main read it:
```yaml
73:  "$SLANGC" --version || echo "Could not get slangc version"
```
⇒ **`|| echo` swallows the failure — the step continues.** As a *model for a failing gate it is the wrong precedent*; copying it verbatim would reproduce the silent-tool bug in a new place. The gate must be `|| { echo …; exit 1; }`, matching `:38`'s own pattern rather than materialx's. **Citing a precedent requires reading what it does, not what it's for.**

## 🔴🔴 08:44Z — **THERE IS NO `spirv-val` BINARY. The gate we were both about to hand a maintainer probes a mechanism that never existed.**

**Main-verified.** `spirv-val` has 77 in-tree hits — **all docs, prompts and generated design text.** Zero in `.cmake` (0 hits), one in `.yml` (`nightly-slang-sascha-test.yml:115`, which is `--spirv-val` — **a flag passed to another tool, not a binary invocation**), one in `expected-failures.txt`. **No build target, no binary, no invocation.**

SPIR-V validation is **in-process**: `glslang_validateSPIRV` (confirmed in `source/slang-glslang/slang-glslang.cpp`, `slang-glslang.h`, `source/compiler-core/slang-glslang-compiler.cpp`), symbol-looked-up inside `slang-glslang.dll`, with SPIRV-Tools statically linked.

⇒ ⛔**DO NOT relay a `spirv-val --version` gate.** It would fail on every runner, healthy or not, because the binary doesn't exist anywhere. **Revised gate:** check `slang-glslang.dll` presence **plus a one-shader positive control** under `SLANG_RUN_SPIRV_VALIDATION=1`. ⭐**The positive control is the load-bearing half — it is what separates *validator absent* from *shaders invalid*.** A presence check alone reproduces the original ambiguity.

⭐⭐**This is the day's deepest instance of the recurring shape: we agreed on a remedy for three exchanges, refined its placement twice, corrected its precedent once — and the entire artifact it targeted was fictional.** Neither of us had checked that the thing we were gating existed. Placement, syntax and precedent were all debated *above* an unverified premise.

## 🔴 THE REAL IN-TREE DEFECT (Main-verified) — worth its own PR, outlives this incident

`GlslangDownstreamCompiler::validate` (`source/compiler-core/slang-glslang-compiler.cpp:359-371`):
```cpp
SlangResult GlslangDownstreamCompiler::validate(const uint32_t* contents, int contentsSize)
{
    if (m_validate == nullptr)
        return SLANG_FAIL;          // :363  validator UNAVAILABLE
    if (m_validate(contents, contentsSize))
        return SLANG_OK;
    return SLANG_FAIL;              // :370  shader genuinely REJECTED
}
```
**Two entirely different conditions return the same value**, and the sole consumer (`slang-emit.cpp:3430-3438`) reports both as `SpirvValidationFailed`. ⇒ **a uniform `0/N` is indistinguishable from a real mass regression BY CONSTRUCTION.**

Useful asymmetry the babysitter identified: **DLL fails to load** ⇒ validation silently skipped + a distinct `E100`; **DLL loads but lacks the symbol** ⇒ every shader "fails validation" — the observed case.

**Correctly NOT acted on** — needs a compiler owner, separate PR from CI triage. Fixing it collapses this whole investigation class to a one-line log read, and it matches the repo's own "fail loudly on out-of-contract input" rule.

## ⚠️ HONEST GAP — the proximate cause is NOT established

Validation only runs when `SLANG_RUN_SPIRV_VALIDATION == "1"` (`slang-emit.cpp:3265-3288`), yet **neither the green nor the red log sets it** — while the green run scored `866/866`, so it demonstrably ran. The runner-local harness must set it by a path invisible in the log.

⇒ **H1 downgraded to moderate confidence, tension stated rather than smoothed.** ⭐**Crucially, the ATTRIBUTION is unaffected** — runner-scoped / SLANGWIN5 / tool-not-host rests on F2 (same job, other runners green) and F4 (`test-benchmark` green on the same host 74s earlier), **which are independent of mechanism.** R1 remains the right ask. **We just must not tell anyone we know what broke.** That separation — confident attribution, unproven mechanism — is the correct epistemic state to report, and the third time today a right conclusion had a wrong or unknown mechanism underneath it.

## ⭐ Process note — two instruments sharing a bug agree perfectly

A subagent reported the log's failure list was **empty** and reasoned from it; the list actually holds all 866 filenames — its `awk` window was mis-scoped. The babysitter's own `grep -c` **reproduced the identical artifact**, so it nearly confirmed a false premise by repeating the same mistake. Direct `sed` settled it.

⇒ ⭐⭐**when an ABSENCE claim is load-bearing, re-verify with a DIFFERENT INSTRUMENT — two tools sharing a windowing bug agree perfectly.** Agreement between instruments is only evidence if the instruments can fail independently. Cf. [[feedback_control_the_instrument_not_the_reasoning]].

## ⭐ The reusable lesson — and the one-line fix that would have collapsed this

**A tool that reports `0/N` instead of erroring out converts an infra outage into what looks like 866 shader bugs.** Babysitter's proposed gate: **fail loudly in `compile_all_slang.sh` if `spirv-val --version` doesn't run.** That turns a multi-hour diagnosis into 30 seconds.

**Same family as the DXC prebuilt-fetch fragility tracked on [[project_12116_dxc_prebuilt_zip_500_fetch_flake]] / #12323** — *"external tool silently unavailable, job fails as if the code were wrong."* Worth checking whether they share a provisioning cause. ⇒ **Standing rule: for any external-tool dependency, the absence of the tool must be distinguishable from the tool reporting failure.** A zero score and a missing binary must not produce the same output — this is the [[feedback_control_the_instrument_not_the_reasoning]] rule applied to CI harnesses.

## ⚠️ #12246 has TWO banked infra failures from UNRELATED causes

`test-falcor` **also failed** in the same merge-group run — 08:34:54Z, job `91933869762`, `GBufferRTTexGrads_d3d12`, `Mogwai.exe` rc `3221225477` (`0xC0000005`), on **SLANGWIN4** (a *different, healthy* runner). That is the **already-tracked #12145 bucket** ([[project_12145_gbufferrttexgrads_d3d12_access_violation]]) — correctly not re-filed, and unrelated to the spirv-val defect (Falcor Perf passed on SLANGWIN10X64-1).

⇒ ⭐**fixing SLANGWIN5 alone would NOT have saved this queue entry.** Two independent infra faults hit one merge-group run. **A remedy scoped to the loudest cause can leave the outcome unchanged** — worth checking, before promising an operator that a fix unblocks something, whether it is the *only* thing blocking it.

## ⭐⭐ The two controls are COMPLEMENTARY — they license different conclusions

Recording the babysitter's generalization because it's the cleanest statement of why both matter:

| control | question answered | rules out |
|---|---|---|
| **same job, other runners** (SLANGWIN4/10X64-1 green) | is it the code? | **CODE** |
| **different job, same host** (`test-benchmark` green 74s earlier) | is it the machine? | **HOST** |

⇒ **when no within-run control exists for the failing job, look for one from a DIFFERENT job on the same host.** That's the axis the remedy turns on: without it, "reboot the runner" looks like the fix. Neither control alone gets you to "the `spirv-val` tool is broken."

**The three no-rerun reasons, as a reusable merge-group pattern:** transient `gh-readonly-queue` ref · label-based dispatch (`runs-on: [Windows, self-hosted, regression-test]`) can reland on the same bad runner · the PR's own head checks are green ⇒ not PR-attributable. **Any one justifies holding; three makes it textbook infra-owned.**

## Also this sweep (Main-noted)

- **Payload clamp 7th consecutive:** listed 20 (`prCount: 27`) vs **74** truth. ⚠️**23 of the 30 red PRs were invisible to the payload — including BOTH SLANGWIN5 instances.** The headline finding of the sweep lay outside the window the payload showed. Strongest argument yet for fixing the generator: see [[feedback_gh_paginate_401s_on_page2_use_explicit_pages]].
- **#12136 `sanitizer` genuine, correctly NOT rerun:** single suite at head (no phantom), already attempt 2, and the failing step is *`Build Slang with Sanitizers`* ⇒ the build never completed, so **not** the #12058 createBuffer bucket (that is merge-group-only and runtime-in-test). Also `mergeable_state=dirty`. Author-owned.
- **#12089 Falcor: log 410-expired, annotations bare ⇒ UNCLASSIFIABLE**, and correctly **not** attributed to #12145 despite surface similarity. ⭐**declining to classify is a valid outcome; a plausible bucket is not evidence of membership.**

## 🔬 SECOND INSTANCE of the absence-vs-rejection defect + the in-tree REMEDY PRECEDENT (Main-verified 08-04, from #12322 approval)

**Provenance:** surfaced by `slang-pr-approver` while approving #12322; **every claim below re-verified by me at `0864e60`** with a different instrument than theirs (direct file reads + a bound caller enumeration, not a CI-log sweep). Cite from here. ⚠️Their report self-corrected 2 factual must-fixes, so I treated all 3 claims as hypotheses — all 3 survived.

⚠️✅**SHA-TRANSFER DISCHARGED (08-04, approver-caught, Main-verified).** `0864e60` is **not** #12322's pinned head `ba156ebf5c90` — it's my depth-1 graft root, and the head object isn't fetched locally, so a local read *at the head* was structurally impossible, not skipped. The reads transfer anyway — proven, not assumed: **all 6 cited files are byte-identical at both SHAs** (blob shas via REST `contents?ref=`), and the `compare` bound test returns **exactly ONE differing path** — `tools/slang-test/slang-test-main.cpp`, the PR's own file, which none of these claims touch. **Non-identical control run** (that same file: `9a8bcfae8c58` vs `a7fddd7fe5b6` ⇒ differs), so the six IDENTICAL verdicts aren't an instrument stuck on "equal". Ancestry confirmed by a graft-immune instrument: head has 2 parents, `0864e60e635e` is a **direct** parent. ⇒ **the line refs below are safe to cite at the pinned head.** Instrument + the graft trap that nearly voided this: [[feedback_shallow_clone_makes_your_head_the_graft_root]] §SALVAGE. ⛔**Transfer licenses "my read of file F holds at the head" — NOT "the head behaves as described"**; a caller outside the cited set could change behaviour with every read file byte-identical.

### The LLVM path has the SAME conflation as the SPIR-V path — 3 sites, one indistinguishable diagnostic

`Diagnostics::UnableToGenerateCodeForTarget` (**E00028**) has exactly **3** emission sites repo-wide (bound check: `grep -rn` over the whole tree, `.git` excluded — the only other hits are the two generated `fiddle` files, i.e. the definition, not a use):

| site | condition | meaning |
|---|---|---|
| `slang-emit-llvm.cpp:700` | `!getOrLoadSlangLLVM()` | **backend plugin ABSENT** |
| `slang-emit.cpp:2864` | `!sourceEmitter` | **target genuinely unsupported** |
| `slang-emit.cpp:3593` | (third path) | — |

⭐⭐**The message text carries NO discriminator:** generated form is `"unable to generate code for target '" << target` — the *only* interpolated field is the target name. So absent-plugin and unsupported-target are **byte-identical** in output for a given target. This is the same defect class as my `slang-glslang-compiler.cpp:359-371` / `slang-emit.cpp:3430-3438` row, now confirmed in a **second, independent subsystem** ⇒ strengthens the own-PR case from "one bad path" to **"a repo-wide design gap"**. ⚠️I did **NOT** trace whether the sites can share an implementation — do not claim a common fix is feasible.

**#12322 does not fix this; it routes around it one layer up** (skip the test when the backend is absent). Legitimate for a *harness* problem; the *compiler*-layer split stays open and is still mine.

### ⭐⭐ The in-tree PRECEDENT to cite in my own PR — `render-test -render-features` already does the 2-stage split RIGHT

This is the shape my PR should argue for, and it **already exists in-tree**, so the PR needs no novel design:

| input defect | mechanism | outcome |
|---|---|---|
| unrecognized feature **NAME** (typo, regressed pin) | `isValidFeatureName` → `RenderTestDiagnostics::invalidRenderFeature` (`diagnostic-defs.h:40`, **code 1006**) → `return SLANG_FAIL` — `tools/render-test/options.cpp:165-172` | ❌ **fails LOUDLY** |
| device genuinely **LACKS** the feature | `SLANG_E_NOT_AVAILABLE` → `TestToolUtil::getReturnCode` maps it → `ToolReturnCode::Ignored` (`source/core/slang-test-tool-util.cpp:21-22`, verified in the switch) | ⚪ **ignored, not an error** |

⇒ **a typo or a regressed pin REDDENS instead of silently dropping coverage.** That is precisely the property the absence-vs-rejection collapse costs us, and precisely what made SLANGWIN5's `0/866` indistinguishable from a mass regression. **Verbatim-safe to cite; all 4 line refs read directly.**

### ⚠️ CORRECTION inherited from the approver — "every disabled-LLVM CI entry is build-only" is FALSE

`ci-slang-coverage-test.yml` sets `-DSLANG_SLANG_LLVM_FLAVOR=DISABLE` when `build-llvm == false` (`:204-208`, comment: *"linux aarch64 cannot build llvm"*) **and then runs slang-test** (`Run Tests with Coverage` at `:225`/`:285`) — the DISABLE branch is a *configure* branch, with no gate stopping the later test step.

⇒ an **LLVM-absent test lane is PLUMBED but NOT INSTANTIATED.** Bound test, run by me: `grep -rn 'ci-slang-coverage-test.yml' .github/workflows/` returns **exactly 3 call sites**, all in `nightly-slang-coverage-test.yml` (`:21`, `:35`, `:48`), and all three pass **`build-llvm: true`** (`:29`, `:42`, `:55`). The input's own **`default: true`** (`:20-23`) means even an omitted arg can't reach the branch, and the workflow is `workflow_call`-only (no `push`/`pull_request` trigger) ⇒ **unreachable except by editing a caller.**

⭐**This is a latent OPPORTUNITY, not a hard absence** — if I ever want the absent-backend path actually covered, flipping one nightly caller to `build-llvm: false` instantiates it. ⚠️**"3 callers, all true" is a PATH-ADDRESSED, PER-MOMENT fact** — re-run the grep before relying on it; the mechanism (default true + workflow_call-only) is the durable part.

## 🔴⭐⭐⭐ 08-04 ~10:20Z — THE SAME-HEAD PAIRED CONTROL. Runner-scoping RE-ESTABLISHED; "reruns futile" REFUTED; and the *corrected* discriminator needs a caveat.

**Provenance:** a **sibling session** wrote a "reruns futile RETRACTED / `runs-on` is a POOL" note into the spill index at 10:16Z. I had not seen the exchange behind it and it reversed a live operational hold of mine, so I re-derived it from the API. **Their claim was right in substance and wrong in one detail** — see the att1 correction below.

### The measurement (run `30885595493`, head `ba156ebf5c90`, `event=pull_request`, 3 attempts)

| attempt | compile-regression job | runner | `spirv-val` | `- PASS` / `- FAIL` |
|---|---|---|---|---|
| 1 | `91920971585` (field-verified) | **SLANGWIN5** | ❌ | — |
| 2 | `91937057380` | **SLANGWIN5** | ❌ **`0 / 866`** | 1732 / **1732** |
| 3 | `91940624213` | **SLANGWIN4** | ✅ **`866 / 866`** | **3464** / **0** |

⇒ **2❌ SLANGWIN5 / 1✅ SLANGWIN4 on ONE commit.** (An earlier version of this table said att1 "DID NOT RUN" — false, retracted; see below.)

⛔⛔**THAT "CORRECTION" WAS ITSELF FALSE — RETRACTED 10:34Z, and it deleted true evidence.** A prior note here claimed *"attempt 1 has 30 jobs and zero compile-regression (bound test = 0/1/1)"*. **Main re-ran the bound test against the ATTEMPT-SCOPED endpoint: 1 / 1 / 1, with 37 jobs per attempt — not 0/1/1, not 30.** Attempt 1 **did** run compile-regression: job **`91920971585`, SLANGWIN5, `failure`**, head `ba156ebf5c90`, started 07:18:45Z (field-verified).

⛔⭐⭐⭐**TWO DISTINCT INSTRUMENT DEFECTS LIVE HERE — and the diagnosis first written into this file blamed the WRONG ONE for MY error. Both verified 10:37Z:**

| # | defect | receipt | who hit it |
|---|---|---|---|
| **D1** | `runs/{id}/jobs` (non-attempt-scoped) returns **only the latest attempt** | `?per_page=100` on it ⇒ exactly **1** compile-regression row: att3/WIN4/success. `total_count` 37. | a plausible route to "att1 ran nothing" — **but not the one I took** |
| **D2** | `runs/{id}/attempts/{n}/jobs` **silently truncates at the 30-item default page** while `total_count` says **37** | att1: `returned=30`, `total_count=37`; compile-regression sits outside the first 30. With `?per_page=100` ⇒ `n=1` on **every** attempt. | ⬅ **THIS was my defect.** I used the attempt-scoped endpoint and never set `per_page`. |

⭐⭐⭐**THE RULE: on any GitHub list endpoint, `(.jobs|length)` is a PAGE SIZE, not a count. Compare it against `.total_count` BEFORE using it as a bound test.** A returned `30`/`100` is the tell — those are page defaults, not facts about the world. My "30 jobs each, 0/1/1" was **the page cap reported as a measurement**, which is exactly the [[feedback_search_code_total_count_is_not_a_file_count]] defect with the polarity flipped: there `total_count` overcounted vs `items[]`; here `items[]` undercounted vs `total_count`. **Same endpoint family, same two fields, opposite direction — I had the lesson and still only carried one direction of it.**

⚠️**Do not fold D1 and D2 together.** They produce the same wrong answer by different mechanisms, and a reader who patches only the endpoint (D1) while keeping the default page still gets truncated results on attempts with >30 jobs. Fix is both: **attempt-scoped endpoint AND explicit `per_page=100`.**

✅**So the evidence is STRONGER than the pair: three attempts on ONE commit — 2❌ SLANGWIN5 / 1✅ SLANGWIN4.** att1 is restored and must be cited.

⛔⛔**PROVENANCE — CORRECTED 10:37Z, and the correction is against MYSELF.** A note here claimed the false `0/1/1` "arrived in my files from a **sibling session**." **That is wrong: I ran that bound test myself** (attempt-scoped endpoint, no `per_page`, three attempts, printed `att1: 30 jobs, compile-regression=0`) and I published it to the index and to the approver as my own re-derivation of a sibling's claim. **The sibling's note was substantively RIGHT** (att1/att2 both SLANGWIN5) and **I "corrected" it with a truncated measurement.**

⭐⭐⭐**This is the worst shape in the whole chain: I overrode a correct claim by a peer using a defective instrument, while explicitly invoking "verify, don't inherit."** The verification ritual ran; the verification's own validity did not. ⇒ **when your fresh measurement CONTRADICTS a peer's, that is the moment to check your instrument — not the moment to publish.** A contradiction is symmetric evidence: it says one of the two is broken, and priors should not decide which. ⛔**And blaming the error on a sibling was a second failure on top of the first** — [[feedback_unattributed_fact_reads_as_your_own]] run in reverse: **attributing my own defect outward.** Do not reach for "a sibling wrote it" before grepping your own transcript for the command.

### ⭐⭐⭐ What this pair establishes that nothing before it could

**Same head, same code, same workflow, two runners, opposite results.** This is the **within-head cross-runner control** whose absence forced the earlier downgrade ("one compile-regression job per run ⇒ no within-run control"). A *rerun* manufactures the missing control, because `runs-on: [Windows, self-hosted, regression-test]` is a **POOL**.

⇒ ✅**"Runner-scoped" is RE-ESTABLISHED — upgraded from *unproven* to *supported by a paired control*.** Not by the retention-limited runner survey (still worthless), but by this one comparison. The code is identical across att2/att3 by construction, so the differing variable is the runner.
⇒ ⛔**"Reruns futile" is REFUTED, and it was MY inference.** I reasoned from a *defect* property (the tool is broken on the bad box) to a *dispatch* property (a rerun lands on the bad box). **Scope-of-fault ≠ scope-of-routing; `runs-on` is the instrument for routing and I never read it.** A rerun is a ~2-in-3 draw and therefore **a legitimate stopgap for a queue-blocked PR.**
⇒ **Both halves of the operator ask change.** Reprovision/offline SLANGWIN5 is **back on the table** (now with a paired control behind it, not a survey), *and* rerun-as-stopgap is available immediately. ⚠️**The rerun cap 0/3 was justified by "futile" — that justification is gone.** Re-decide it on its merits, don't inherit it.

### ⚠️ The *corrected* discriminator needs a precondition — my own control was MIS-PAIRED

I ran the error-body ladder against the **healthy** att3 log expecting it to discriminate. It does not:

| log | `error:` | `Validation failed` | `Invalid` | `OpTypeVoid` |
|---|---|---|---|---|
| att2 (broken, `0/866`) | 0 | 0 | 0 | 0 |
| att3 (**healthy**, `866/866`) | **0** | **0** | **0** | **0** |

**A column that is 0 in both cannot separate them.** But this is *my control being wrong*, not the discriminator being refuted: the healthy run has no error body because **nothing failed**, and it is already separated by the summary line. ⇒ **the discriminator is CONDITIONAL, not free-standing: GIVEN `spirv-val 0/N` with per-shader FAIL lines, the absence of an error body distinguishes broken-validator from mass-regression.** State the precondition whenever citing it.

⛔⭐⭐**And the other half remains an UNVALIDATED COUNTERFACTUAL: "a genuine mass SPIR-V regression would name what was invalid" — we hold NO log of a genuine mass regression to check that against.** Same family as [[feedback_expected_noise_line_is_not_a_failure_signature]], one step over: there the missing control was the harness's **healthy** noise; here it is the harness's **genuinely-failing** noise. **A two-way discriminator needs BOTH poles measured; I have the broken pole and the healthy pole, and the pole the claim actually rests on is the one I don't have.**

✅**Useful by-product — the healthy shape, now measured and citable:** `866/866` in **all four** modes, `- PASS` = **3464** (= 866 × 4), `- FAIL` = **0**. The broken shape's 1732/1732 is 866 × 2 ⇒ **the two non-`spirv-val` modes pass and both validator modes fail**, which is itself a cleaner signature than any text-absence test.
