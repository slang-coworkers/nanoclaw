---
name: project_12330_entrypoint_throws_not_diagnosed
description: "slang#12330 EP `throws` undiagnosed — SHIPPED 08-06: draft PR #12412 (head eb4cd103b972, 5 files +141, closingIssuesReferences=[12330]), E38053 in validateEntryPoint + 3 tests, codex approve, verdict cmt 5208479135 refreshed. Blanket rule right (no CPP carve-out); shares #12134 assert line but DIFFERENT defect ⇒ not blocked on that deferred fix. ⛔My record: 4 wrong gate diagnoses, an endorsed-then-refuted generic-arm claim, a retracted worktree census, one unrun verification row."
metadata: 
  node_type: memory
  type: project
  originSessionId: c06a26a7-d16f-4413-9138-47628ce414ab
---

# slang#12330 — shader entry point allowed to `throws` (no diagnostic)

Author **skiminki-nv** (MEMBER/maintainer, self-filed), 2026-08-03 16:36Z. `Dev Opened`, 0 comments.
https://github.com/shader-slang/slang/issues/12330 · reporter SHA `53b76e6d3009b8e6434d41573524c7ce5c499d23`

**Ask:** a `throws` clause on a shader entry point should be an error. Reporter's argument: it's
unclear how an uncaught exception from an entry point could even be handled, and AFAICT only the
CPP target could theoretically support it. Analogous to uncaught exceptions in C++.

**Repro** (`slangc -target spirv -entry computeMain -stage compute test.slang`): `uint g(uint n)
throws uint` + `void computeMain(uint3 tid : SV_DispatchThreadID) throws uint` calling `try g(...)`.

**Two broken outcomes reported (transcribed from the issue — NOT independently verified by me):**
- `-target spirv` → `E99997 InternalError assert failure: slang-ir-glsl-legalize.cpp(2166): structTypeLayout`
- `-target hlsl` → emits `ResultType_1 { bool tag_1; AnyValue4 anyValue_1; }` as the **return type** of
  `[numthreads(1,1,1)] computeMain(...)`. Reporter *believes* this won't compile downstream (compute
  shaders can't return values without semantic binding) — flagged to the triager as a belief to test,
  not inherit.

## Routing

Dispatched to **slang-triager**, canonical thread `gh-issue-shader-slang/slang-12330`.
**No fixer dispatch** — this author owns his own PRs. On [[project_12326_throw_statement_missing_semicolon]]
he opened PR #12328 adopting our recommendation essentially verbatim ~1h after our verdict landed.
⇒ the **framing** is the deliverable here; it has to be right the first time.

## Two questions I asked the triager to keep separate

1. **Is the blanket rule right?** Check whether CPU/CPP/host-callable targets *work today*. If any
   path currently produces correct behavior, a universal error deletes a working case and the rule
   needs a target/usage carve-out. Also: which layer owns the check — entry-point validation in
   `check-shader.cpp` is the precedent from #11881's duplicate-`[numthreads]` fix (confirm or correct).
2. **Is the ICE separately a bug?** With the diagnostic added, is the underlying legalize crash class
   still reachable by other means?

## My 2 hypotheses — UNVERIFIED, handed over as hypotheses

- **Same-assert link to #9580 / #12134.** `slang-ir-glsl-legalize.cpp:2166 structTypeLayout` is the
  *same assert line* as [[project_9580_glsl_legalize_layout_mismatch]] and
  [[project_12134_base_interface_assoc_type_followup]]. There the mechanism was a type⇄layout mismatch
  on the **entry-point result**: the concrete return type was rewritten by a later transform while the
  entry-point result *layout* was never refreshed → null `structTypeLayout`. Error-handling lowering
  rewriting the EP return `void` → `ResultType_1` looks like the same family. If true it changes
  one-crash-class-vs-two, and #9580's fix is jkwak-work-owned and **deferred ~2 sprints**.
- **Feature-maturity unknown.** I did NOT establish whether `throws`/`try` is experimental,
  language-version-gated, or otherwise unstable. That materially changes severity and whether
  "diagnose an error" is even the right disposition vs. "feature is incomplete". Triager to establish
  from source, not from my framing.

## Standing constraints carried into the dispatch

- **Duplicate check:** REST search (`throws in:title`, `throw entry point in:title,body`) returned only
  #12330 itself. Sibling-but-distinct = **#12326** (same author, filed 3h earlier, has his own PR #12328).
  Triager to confirm independently. (GraphQL `gh issue list --search` has 401'd in past sessions —
  [[feedback_gh_paginate_401s_on_page2_use_explicit_pages]].)
- **Generated-surface sweep is mandatory.** #12326's live lesson: PR #12328 left
  `docs/generated/tests/.../stmt-throw-no-semicolon.slang` + 2 generated doc lines stale, and that
  directory runs **nightly-only** (`slang-test -test-dir docs/generated/tests` from
  `nightly-slang-test.yml`; `workflow_dispatch` + cron `0 4 * * *`, **no `pull_request`**) ⇒ breakage
  lands green and surfaces as an unattributed nightly failure.
  [[feedback_green_job_skipped_backend_zero_coverage]] shape. Any recommendation here must name the
  exact generated files a `throws`-on-EP diagnostic would invalidate.
- Post the 5-bullet verdict on the issue **only if VERIFIED**, HOLD otherwise
  ([[feedback_triage_github_posting]]). Probe builds get reverted and the revert stated.

## ⛔ MY 08-03 DISPATCH NEVER LANDED — 3 DAYS DARK

Full derivation: [[feedback_announced_dispatch_needs_landed_verification]]. I announced this as
routed on 08-03 16:40Z; `ncl sessions list --thread-id` returned **1 row (mine only)** on 08-06.
Triager was alive and took **#12331 at 17:57Z, 1h21m later**. Cause UNIDENTIFIED. Discovered only
because skiminki came back and asked the bot directly. **Re-dispatched 08-06 17:45Z; landed
(triager session `sess-1786038354542-3gmr4h`).**

## 08-06 — maintainer authorized a fix; chain executed same evening

- `5207792475` 17:24Z: *"Switched back to language maturity for tracking purposes."* Type
  `Language Maturity` (same as #12361), milestone **Q3 2026**, **self-assigned**.
- `5207801659` 17:25Z: **"@nv-slang-bot: Please reproduce and make a PR."** ⇒ triage **+ fix**.
  Departure from the #12326/#12324 pattern where he authored his own PR.
- Triager implemented + validated itself, **POSTED the 5-bullet `5208479135` 19:14:15Z**, then handed
  off to slang-fixer 19:15:51 for the PR only. `reproduced` label applied.
- Fixer session `sess-1786043752553-h25j8b` (19:15), worktree `/workspace/agent/wt-slang-12330`,
  branch `fix/issue-12330`, base master `d7d59f374`. Independent pre-fix repro **with control**:
  throwing EP → exit 255 + the assert; non-throwing control → exit 0, 688-byte SPIR-V.
- ⚠️**Handoff artifact went missing once** (fixer msg 6: *"the inlined patch did not arrive"*), re-sent
  as 3 files 19:19–19:20. [[feedback_delivered_artifact_missing_index_row]] class again; self-corrected.
- ⚠️A **different** triager session warned this one at 18:47 it was **exposed in the shared clone** —
  so the triager's validation figures were measured there, and the fixer's rebuild is in an isolated
  worktree. [[feedback_group_clone_is_shared_by_all_sibling_sessions]] shape.

## Fix as reported (triager-measured; I verified 5 legs myself — see below)

New diagnostic **`entry-point-cannot-throw` = E38053**, check in `validateEntryPoint`
(`slang-check-shader.cpp`), beside `EntryPointCannotReturnResourceType`/`…ArrayType`. +94 / 4 files.
Predicate = `getErrorCodeType(astBuilder, entryPoint->getFuncDeclRef())->equals(getBottomType())` —
deliberately the **same predicate** lowering uses to attach `kIROp_FuncThrowTypeAttr`, so the
diagnostic cannot drift from lowering. Substitution-aware (generics). Error trips the error-count
gate before `generateIR()`, so the malformed shape never reaches layout/legalization.

**Q1 ANSWERED — blanket rule is RIGHT, no carve-out.** Reporter's "only CPP could theoretically
support it" **does not hold**: `cuda`/`cpp`/`host-callable` all fail `E99999 … this target doesn't
support this user-defined varying parameter`. Before/after matrix: `spirv`/`glsl`/`metal`/`wgsl`
**SIGSEGV(139)** → E38053 · `hlsl` **exit 0 + invalid output** → E38053 · `cuda`/`cpp`/`host-callable`
E99999 → E38053. Each cell paired with an internally-catching control that exits 0 everywhere.

**Worse than the issue shows in a shipped build:** `SLANG_ASSERT` → `SLANG_ASSUME` when `_DEBUG` is
undefined ⇒ **Release hard-crashes with no diagnostic at all**, not `E99997`.

**Reporter's HLSL suspicion right, REASON WRONG** — real DXC 1.9 (`-target dxil -profile cs_6_0`)
rejects it with *"Semantic must be defined for all parameters of an entry function"*, i.e. a **missing
semantic on the return value**, NOT "compute shaders may not return values". Non-throwing control →
3020 bytes valid DXIL. ⇒ the belief-not-to-inherit instruction paid off.

## ⛔ MY HYPOTHESIS: shape CONFIRMED, "same bug" REFUTED

I guessed this was the **same bug** as [[project_9580_glsl_legalize_layout_mismatch]] /
[[project_12134_base_interface_assoc_type_followup]] because they share assert line
`slang-ir-glsl-legalize.cpp:2166`. **Split verdict, and the distinction is load-bearing:**
- **Shape confirmed** — it *is* an EP-result type⇄layout disagreement caused by an IR-side rewrite.
  But the precise mechanism is **absence**, not staleness: `slang-parameter-binding.cpp:3560` only
  computes `resultLayout` when the **AST** result type is non-`void`; here it's `void` (the `throws`
  clause is not folded into `getResultType`), so no result layout is ever built. The `ResultType`
  struct appears later and **only in IR**
  (`slang-ir-lower-error-handling.cpp:43 builder.getResultType(...)`; that file has **zero** layout
  references). glsl-legalize then reads `entryPointLayout->getResultLayout()` unguarded at `:4910`
  and asserts at `:2166`. **The layout was never wrong — it correctly described a void-returning EP.**
- **"Same bug" REFUTED by positive-control differential:** #12134's reproducer **still aborts at
  :2166 in the patched build**, with this issue's reproducer as the positive control. Different root
  cause (link-time assoc-type resolution), jkwak-work, milestone Q4 2026.
⇒ ⭐⭐**A shared assert LINE is not a shared bug. Asserts are chokepoints, so line-sharing is weak
evidence** — exactly the [[project_12362_nonmatching_handlers_escaping_throw_hang]] lesson (shared
failure mode is worth ~0 for dedup; only a differential decides), which I had *in store* and still
reached for a dup link. **2nd instance of this error shape for me.**

**Q2 ANSWERED:** the assert remains independently reachable. The diagnostic removes one path to it,
it does **not** fix the IR defect — and the triager said so publicly rather than letting a green test
read as a fixed path. [[feedback_green_job_skipped_backend_zero_coverage]] discipline, applied right.

## ✅ Five legs I re-verified MYSELF at master HEAD (not relayed)

Fetched raw from `master`, not from the fixer's report:
1. `slang-common.h:363-372` — `#ifdef _DEBUG … #else #define SLANG_ASSERT(VALUE) SLANG_ASSUME(VALUE)`
   ⇒ Release-crash claim **holds verbatim**.
2. `slang-parameter-binding.cpp:3560` — `if (!resultType->equals(astBuilder->getVoidType()))`
   guarding `entryPointLayout->resultLayout = resultLayout;` at `:3587` ⇒ void-guard claim **holds**.
3. `slang-lower-to-ir.cpp:4809-4812` — `if (!getErrorCodeType(...)->equals(...getBottomType()))` then
   `kIROp_FuncThrowTypeAttr` ⇒ **the shared predicate is real**, so the anti-drift argument is sound.
4. `slang-ir-legalize-varying-params.cpp:1072-1078` — `diagnoseUnsupportedUserVal` emits
   `Diagnostics::Unimplemented{"this target doesn't support this user-defined varying parameter"}`
   ⇒ the cuda/cpp/host-callable E99999 attribution **holds**.
5. `slang-check-shader.cpp:1697 validateEntryPoint`, siblings `EntryPointCannotReturnResourceType`
   `:1747` / `…ArrayType` `:1755`, called from `:2665` ⇒ **layer choice is beside the right neighbours**.
✅**`E38053` is FREE on master** — `38050`/`38051`/`38052` exist (`invalid-entry-point-varying-type`,
`…-for-target`, `vertex-shader-missing-sv-position`), **`38053` absent** ⇒ no collision. Worth having
checked: a number collision in a generated enum is a merge-time break, not a test failure.

## ⚠️ Live risk: the 5-bullet is PUBLIC AHEAD of the fixer's independent rebuild

Comment `5208479135` already asserts `error-handling` **34/34** (32/32 before ⇒ +2 = exactly the new
test), `diagnostics` **727/727**, guard-proven pristine-SIGSEGV-vs-patched-E38053, and the 42-file
`throws` sweep (20 `tests/` + 22 `docs/generated/`, **none** with a throwing EP, planted must-hit
control confirming the sweep could see one). Those figures were measured **in the shared clone**;
the fixer is rebuilding in an isolated worktree. ⇒ **any divergence is now a published-claim
correction, not a private gate.** Told the fixer to report divergence immediately rather than
quietly reconcile.

**Generated-surface sweep came back CLEAN** — no in-tree file invalidated, so the #12326 nightly trap
does not fire here. The planted must-hit control is what makes that null meaningful.

## Open / not folded in

- **`try`/`catch` appears broken under `slangi`** — 6-line `do`/`catch` → `VM operand access out of
  bounds in constants section`, plain `printf` fine. Fixer flagged it separately rather than folding
  it in (correct) and offered to file it. **Held out of this chain** — a 5th throw/catch issue, needs
  its own triage.
- Feature-maturity of `throws`/`try` still not established from source; Type `Language Maturity` on
  both #12330 and #12361 is suggestive, not evidence.

## RESOLVED 2026-08-06 — verdict published, fix implemented, fixer building

**Verdict = cmt 5208479135** (`nv-slang-bot[bot]`, 19:14:15Z, `created == updated`, 6348 codepoints). I
verified it live with a bogus-id 404 control. Issue now `comments=3`, labels `Dev Opened` + **`reproduced`**,
Type left as skiminki's human-set **`Language Maturity`** (he retitled the tracking category himself at
17:24Z — do not "correct" it).

**My four dispatch questions, answered by the triager:**
1. **The blanket rule is right — no carve-out.** No target works today, CPP included.
2. **Same assert LINE as #12134 but a DIFFERENT defect**, and #9580 never mentions that assert ⇒ ⛔**my
   "same-assert family" hypothesis was too strong, and the practical consequence is the opposite of what I
   feared: #12330 does NOT depend on jkwak's deferred fix.**
3. `throws`/`try` is **ungated and not experimental** (from source) ⇒ "diagnose an error" is the right
   disposition, not "feature incomplete."
4. **The assert stays reachable** — #12134's repro still aborts at `:2166` in the *patched* binary. The
   diagnostic guards a live bug and the verdict says so publicly.

**Fix:** `E38053` in `validateEntryPoint` + 2 regression tests, worktree `wt-12330` @ `d7d59f374`; 7/7
targets diagnose cleanly where 4 previously SIGSEGV'd and HLSL emitted DXC-invalid code; suites 34/34 and
727/727; codex approved round 2. ⚠️**`tests/bugs` NOT run** — deliberately stopped rather than measure a
mid-rebuild binary; not claimed. Fixer session `sess-1786043752553-h25j8b` live on the canonical thread,
patch applied, branch `fix/issue-12330`, build started 19:23Z.

⚠️**Handoff defect worth remembering: an INLINED patch did not survive transport.** The fixer's
`messages_in` had 1 row at `content_len=408` and it refused to reconstruct from the memo — correct call. The
three artifacts (patch + both tests) landed only as **attachments**. ⇒ **send patches as files, never inlined.**

## ⛔ MY OWN ERROR ON THIS CHAIN: I over-attributed the dirty tree 3/3 when it was 2/3

I told the #12330 session the 3 modifications in the shared clone were "almost certainly yours" — hedged,
but the hedge was about *proof*, not about *scope*. **`hlsl.meta.slang` was not theirs**, and the triager
then watched it go from modified to byte-identical-to-HEAD mid-session with no error and no log — i.e. a
**third field instance** of the shared-clone destruction class, observed live from the victim seat. My
diagnostic-name reasoning (`entry-point-cannot-throw` matches #12330) was sound for 2 files and I extended
it to a 3rd on adjacency alone. ⇒ **an attribution argument covers exactly the files whose content carries
the signal; the rest are unattributed, not "probably the same author."**

## ✅ SHIPPED — draft PR #12412, 2026-08-06 22:23Z

https://github.com/shader-slang/slang/pull/12412 · head `80e4e31e5455` · **draft=true** ·
`pr: non-breaking` · 0 reviewers requested · base master · CI run `31128969868`.
**Independently verified by me:** `draft:true`, head SHA matches, label present, and GraphQL
`closingIssuesReferences` = **[12330]** ⇒ auto-close fires on merge. `report_pr_created` confirmed
(fixer session mapped on the canonical thread).

**Diff at head `eb4cd103b972` (3rd push 22:42Z): 5 files, +141 net** — `137 + 4`, the `+4` entirely in the diagnostic test (34→38) from commit 3, *"Warn that the CHECK carets bind by column…"*. ⚠️Triager's published figures are pinned to head `80e4e31e5455`/+137 and were **deliberately not edited** — pinned figures are stale-by-events, not wrong. Earlier state: **5 files, +137 net** — 2 commits (`95d0ac98b2` +151/−0, then `80e4e31e54` +6/−20 *"soften
coupling claim"*). ⚠️The `[Fix Report]`'s "+151" is the **pre-trim** figure; both true, different
revisions ([[feedback_two_figures_for_one_quantity_may_be_two_revisions]]). The trim carried a
**substantive** fix: the overstated *"the two cannot drift apart"* clause is retired in favour of
*"canonical AST error-type predicate"* — verified at the pushed blob by both me and the triager.
Suites: `tests/diagnostics` 726→**728** (+2 = both designation-path directives collected),
`error-handling` 32→**35** (+3). 0 removed, 0 failed. Repro: `E38053` ×1, `:2166` assert count **0**
⇒ replaced, not accompanied.

**Codex PLAN/CODE/OUTPUT_REVIEW all approve** after 8 must-fix items. PLAN_REVIEW killed a claim
**I had endorsed at source** (the generic-arm justification — see the retraction above).
OUTPUT_REVIEW found a 2nd decl-less path, `createDummyForPassThrough`
(`slang-entry-point.cpp:33`); both decl-less flavours are now named in the body, as is the
`catalog.txt` consequence (`695→696`, `613→614`, new row at `:521`, two stale bundles, deliberately
not regenerated).

⛔**THE GATE CAUSE WAS THE FIXER'S `sandbox` PARAM — AND I MISDIAGNOSED IT 4×.** It passed
`sandbox: "read-only"`; `force-codex-sandbox.sh` **denies** anything but `danger-full-access` with
`exit 2` ⇒ no `PostToolUse` ⇒ `track-critique.sh` never ran. **I read that hook in full and reported
only "it never rewrites `tool_input`"** — true, and the wrong question. All four failed diagnoses:
[[feedback_i_read_the_denying_hook_and_missed_the_denial]]. **Both coworkers refused
`CRITIQUE_PIN_INSTRUCTIONS=0`; that refusal is the only reason the real cause surfaced.**
Two escalated gate defects survive independently: the verdict-vocabulary mismatch
(`track-critique.sh:92-97`) and the unanchored Bash marker match (`gate-critique-on-deliver.sh:81`).

## ⚠️ REVIEWER FOUND THE SESSION'S ONE GENUINE MUST-FIX (23:30Z) — E38053 over-fired

**`throws NotAType` produced `E30015 undefined identifier` PLUS a spurious `E38053`.** Mechanism, visible
in the block I had already read and did not compose: `slang-check-decl.cpp:15599-15608` takes the
`getBottomType()` branch **only when there is no `throws` clause at all**; a clause that *fails to check*
goes through `CheckProperType` → **`ErrorType`**, which is ≠ bottom ⇒ the predicate fires. ⇒ **a second
error stacked on an already-reported one, on exactly the input a user typos** — worst place for diagnostic
noise: most likely hit, least likely understood. Fixed with in-tree precedent + a test arm asserting E30015
only. ⭐**The triager's single-sentinel test could not have caught it** — same shape as the arity/no-witness
findings: a test that pins one input class says nothing about the adjacent one.

## ⛔ "TWO CALLERS" WAS WRONG — and the precise shape matters more than the correction

There is a **third reach-path**: `slang-session.cpp:2290` → `Module::_discoverEntryPoints` (`mod.cpp:325`)
→ `_discoverEntryPointsImpl` → `validateEntryPoint` (`:409`). ✅**I verified the enclosing function at
`:2290` is `Linkage::loadSerializedModuleContents` — i.e. the path is LOADING A SERIALIZED MODULE**, not
compiling one.

⇒ **still only TWO call sites; what has a third entry is `:409` itself**, reached from compile-time
(`:3144`) and from module import (`:2290`). ⭐⭐⭐**The triager enumerated CALL SITES and published them as
PATHS** — its grep answered *"who calls `validateEntryPoint`"* while its sentence claimed *"how can this
check be reached."* Fourth time in one evening it stopped one hop short with a correct grep behind it
(`:713` one path of two · `:1727` didn't read up · the `:629` refutation · this). ⇒ **the remedy is not a
better grep but asking whether what you enumerated is what your sentence quantifies over.**

⚠️⭐⭐⭐**USER-VISIBLE CONSEQUENCE — a HARD LOAD FAILURE, not a diagnostic beside a successful load. Every
hop verified by me at `d7d59f374`:**

```
:2123  SlangResult Linkage::loadSerializedModuleContents(..., DiagnosticSink* sink)
:2290    module->_discoverEntryPoints(sink, targets);       → mod.cpp:409 validateEntryPoint
:2297    if (sink->getErrorCount() != 0) return SLANG_FAIL;   ← AFTER discovery
:1226  if (SLANG_FAILED(loadSerializedModuleContents(...))) {
:1234      mapPathToLoadedModule.remove(mostUniqueIdentity);
:1235      mapNameToLoadedModules.remove(moduleName);
:1236      return nullptr;                                    ← module UNREGISTERED
```

⇒ **publishable form: a `.slang-module` built by an older compiler, containing an entry point with a
`throws` clause, will no longer load.** Not implied by the issue's ask, which was about *compiling* one.
**The one item on this PR a maintainer should weigh rather than rubber-stamp.**

✅**Mechanism leg I checked that neither peer had: `errorType` IS serialized** — declared
`FIDDLE() TypeExp errorType;` at `slang-ast-decl.h:620`, immediately beside `FIDDLE() TypeExp returnType;`
(`:617`), so its serialization is generated the same way. The field survives a round-trip.

⚠️**BOUND, and the triager was right to insist on it: whether such an artifact EXISTS is unmeasured.** The
path is real and the failure is hard; *"modules like this exist in the wild"* is a claim about history none
of the three of us tested. ⇒ **register as: path real, failure hard, incidence unknown.** ⭐**Given how many
overstatements this chain produced, the bound is worth more than the emphasis** — it is the difference
between a maintainer weighing a real risk and dismissing an inflated one.

⭐**And the motivation was mis-ordered until the fixer corrected it:** on master a throwing entry point
compiles **silently to a struct return** on `hlsl`; the assert is the loud symptom on *one* target. **Silent
wrong codegen is the worse half**, and the triager had measured that at the start yet framed the issue
around the assert because that is what the reporter led with. ⇒ **a reporter's lead symptom is not
necessarily the worst one you measured.**

## ⛔ MY `:17` CRON GUIDANCE WAS WRONG — the retry is DEADLOCKED, not waiting (reviewer, 23:41Z)

I told the fixer *"`ci-retry-yielded-bot.yml` runs `cron "17 * * * *"` ⇒ the next attempt is the next :17,
automatic, nothing to dispatch."* **The cron line is real and the conclusion was false.** Measured:

```
gh api …/workflows/ci-retry-yielded-bot.yml/runs → 8 runs in 11 MINUTES (23:27→23:38), all "success"
gh run view 31131849035 --log → "CI is still active (5 run(s)); not rerunning"
                                also present: "#29902", "waiting", "max-yield-hours", "escalates"
```

⇒ **it fires every ~1-2 min (not hourly), reports `success` while doing nothing, and self-blocks: one of
the 5 "active" runs it counts is `#29902 (pull_request, waiting)` — parked on a MANUAL-APPROVAL gate, which
the script treats as active.** Only the 12h escalation (`--max-yield-hours 12`) or marking the PR ready
breaks it. ⭐⭐**A workflow reporting `success` every 2 minutes while performing no work is the most
convincing possible disguise for a deadlock** — and I read its cron trigger and inferred its behaviour
instead of reading its runs. **Same species as everything else tonight: the trigger was the thing I could
read; the run log was the thing that decided.**

## Combined review — APPROVE_WITH_NITS, coverage explicitly incomplete (23:40Z)

`combined-review-12412.md` (75 KB, read via subagent). **A partial 3/5** (budget death $30.03/74 turns;
**code-quality and test-coverage absent, not clean**), **B skipped** (Devin 30m timeout), **C partial**
(both candidate passes done, died before scope-filter ⇒ candidates unfiltered). A's and C's outputs
recovered from `stream.jsonl`. ⭐**Reviewer labelled the gap rather than implying a clean three-pass.**

- **0 bugs / 2 gaps / 3 questions.** The one real must-fix (E38053 over-firing on `ErrorType`) was found
  and already fixed; in-tree precedent cited at `slang-language-server-completion.cpp:554-555`.
- ⚠️**2nd actionable: `throws-outside-entry-point.slang`'s `//CHECK-NOT: error` is a DEAD NEGATIVE** —
  `slang-test-main.cpp:1882-1890` appends **stderr before stdout**, so a `CHECK-NOT` anchored after a
  SPIR-V-body match scans a region that cannot contain diagnostics. **A guard that cannot fail** — the
  same class as the `12326` guard and the no-witness comment, now in the over-rejection test.
- **Test gaps:** no coverage of the binary-module import path; and under explicit `-entry`, sibling
  `[shader]` functions are not validated at all (pre-existing).
- ⭐**Reviewer retracted its OWN earlier advice**: it had told the fixer to publish the enumeration as
  "load-bearing" on the null-deref argument — wrong, since `:1727` derefs two statements above the hunk.
  **Two of A's subagents caught it independently.** Its self-diagnosis: *"I had read the helper but not the
  caller."* (I endorsed that same claim; see the refuted section in
  [[feedback_an_enumeration_claim_needs_a_computed_complement]].)

⛔**BINDING IS BROKEN AND THE DELTA IS NOT INERT.** All three reviewers read `80e4e31e54`; head is
`11264cb5d4de`. ✅**I measured the delta: 4 files, +38/−7, of which `source/slang/slang-check-shader.cpp`
+9/−6 — and I read the patch: it is exactly the two-sentinel guard plus its comment, no other logic.**
⇒ **the predicate now at head is unreviewed by any reviewer.** `diff_hash` in the result block is
`80e4e31e54`, so a PR-approver's `commit_match` clause will correctly refuse to match head.

## ⭐⭐ THE OVER-FIRE IS AN INSTANCE OF A PRE-EXISTING CLASS — 4 other sites, all verified by me

Triager's finding, and I checked every site at `d7d59f374` rather than relaying:

| site | predicate | tests both sentinels? |
|---|---|---|
| `slang-language-server-completion.cpp:554-555` | `errorType.type != getBottomType() && != getErrorType()` | ✅ **the only one** |
| `slang-check-stmt.cpp:642` | `parentFunc->errorType->equals(getBottomType())` | ❌ bottom only ⇒ E30015 **+ E30116** |
| `slang-check-expr.cpp:7575` | `funcCallee->errorType->equals(getBottomType())` | ❌ ⇒ E30015 **+ E30095** |
| `slang-check-expr.cpp:7600` | `parentFunc->errorType->equals(getBottomType())` | ❌ ⇒ E30015 **+ E30095** |

⚠️**Near-miss worth recording: `grep -c getErrorType` over `:640-650` returns 1, which reads as "this site
already handles it."** It does not — the hit is `:649` testing `stmt->expression->type`, **a different
operand**. `:650` confirms the two are distinct (`parentFunc->errorType->equals(stmt->expression->type)`).
⇒ ⭐⭐**a predicate is (operand, comparand); matching the comparand in a nearby line says nothing about the
operand.** I nearly refuted a true class claim on that count — the same *print-don't-count* failure, one
more time, on the site I had already read tonight for a different purpose.

⇒ **The fixer's decline of the 9-site `doesDeclareThrows` consolidation is CORRECT WITH EVIDENCE**: the
class predates this PR, and folding it in would widen an already-unreviewed change. Separate issue if a
maintainer wants it. ⭐**`:642` even leaks the sentinel into user prose — *"function's error type `error`"*.**

✅**And the `ErrorType` arm is noise-only, not crash-prevention** (triager-measured): pristine,
`throws NotAType` ⇒ E30015 alone, **no assert, no output file**; `throws MyErr` ⇒ E99997 + the `:2166`
assert. Gates at `slang-compile-request.cpp:607/620` stop a checking failure before lowering.

## ⛔ MY "byte-identical" WARNING WAS ABOUT MY OWN SENTENCE, NOT THE ARTIFACT

I warned the triager that its *"both `source/` files are byte-identical to the reviewed commit"* line had
gone false and must not be published. **It was never in the published comment** — swept: `byte-identical`
0 · `byte identical` 0 · `unchanged since` 0 · `still the reviewed` 0 · `reviewed commit` 0, must-hit
control `12330` = 1. The comment's only revision claim is **SHA-pinned** and re-derives exactly
(`d7d59f374...80e4e31e5455` = 5 files, `13+7+34+39+44` = **+137**). ⇒ ⭐⭐⭐**a stale sentence in my
reasoning is not a stale artifact — ask WHICH ARTIFACT the sentence lives in before issuing a correction.**
**Three heads, ten commits, zero edits** to that comment; an unpinned figure would have needed an edit at
each head, and **each edit notifies nobody.**

⚠️**My compare was also one head behind:** head is `7721e7e7864a` (7 files, **+175/−0**, 10 commits), and
the unreviewed set is **FIVE** files, not four — FG011's fix moved `throws-outside-entry-point.slang`
(+8/−1). Reviewed→head = **+46/−8**.

## ⛔ MY CI-DEADLOCK MECHANISM WAS WRONG — and it reached the OPERATOR as a false option

I escalated three options; **option 2 was "wait for the 12h escalation, build lands ~midday tomorrow."**
**It can never fire.** Triager checked the mechanism rather than inheriting my framing; ✅I verified both
decisive legs myself:

1. **Our CI never yielded — it was SKIPPED AT THE DRAFT GUARD.** The only `CI` run on `fix/issue-12330`
   (`31132220148`, head `7721e7e786`) concludes **`skipped`**, and `wait-for-human-priority` / `check-ci`
   are themselves **`skipped`, not `failure`**. Cause: `ci.yml:15` guards `filter` with
   `github.event.pull_request.draft != true`, and every downstream job carries `needs: [filter, …]`
   (`:66/:135/:157/:187/:214`) ⇒ **one draft guard skips all 36 jobs.** Nothing to do with priority yielding.
2. **The escalation is structurally unreachable.** `extras/ci/wait-for-priority.py:176-181`:
   `escalated = yielded and self_age_hours is not None and self_age_hours >= max_yield_hours`.
   **Requires `yielded == true`; a skipped run never yields.**

⇒ **The `waiting` run I cited (`#29902`) is real but NOT OURS** — branch `falcor-vet-approve-gate`, another
author, ~19 h old. **I attributed a genuine repo-wide blocker to our PR.**

⛔⭐⭐⭐**THE SHAPE: three individually-TRUE observations composed into a mechanism our artifact is not in the
population of** (the yield mechanism exists · a `waiting` run exists · the 12 h ceiling exists). This is the
*unverified join* branch, at the highest stakes of the chain — it reached the operator as a decision option.
⇒ ⭐⭐⭐**The free tell I skipped: a yielding story predicts a run that reads `waiting`; ours reads
`skipped`.** **Before blaming a mechanism, check your artifact is in its population** — one field on one run.

⚠️**Aperture traps the triager recorded, all false zeros:** `?status=waiting` + `event=pull_request` → **0**;
unfiltered `per_page=100` → **[]** (the run is older than one page); explicit `?status=waiting` alone finds
it. ⛔**And `status=zzbogus` returns `0`, not an error — that cell can NEVER be a control.**

⚠️**Fixer hit the same denominator trap in the same cycle:** its census read "29 skipped, 1 success" =
exactly 30 = **one API page**; paginated truth is **42 skipped / 4 success across 46**. *"A display limit
became my denominator"* — third instance this cycle, and it had corrected two peers for it earlier.

## ⭐ Final critique caught 9 stale claims in the published PR body — two structural

1. An earlier edit **APPENDED** a corrected predicate explanation without deleting the obsolete one ⇒ the
   body asserted **both** that the check matches lowering's test and that it deliberately differs.
   ⇒ ⭐⭐**an append-only correction leaves the artifact self-contradictory; delete what you supersede.**
2. Two unbounded quantifiers bounded; *"no third party has executed this patch"* → the falsifiable
   *"no third-party execution result is known to me"*; CI analysis **dated to identified runs** rather than
   presented as live.

⚠️**Delivery-gate defect (3rd, independent):** the gate re-armed after approve because its counter treats
**every `Bash` call as an edit** — the `sha256sum` and `git status` run to *prove nothing changed* tripped
it. Fixer treated the approve as valid (body hash == codex's attested value, tree clean) rather than
re-running a review over identical bytes, which would launder the control; codex agreed and proposed
**content-based invalidation (compare the approved hash)**. ⭐**Same shape as everything tonight: an output
that reads identically whether or not the thing it measures occurred.**

## ✅ TWO BODY DEFECTS FIXED AND VERIFIED IN THE LIVE ARTIFACT (08-07 00:21Z)

1. **Glossary cited a class member as precedent.** `:158` said `equals(getBottomType())` is canonical
   *"(the same idiom appears at `slang-check-stmt.cpp:642`)"* — a **single-sentinel** site, i.e. a member of
   the class that produced this PR's own over-fire. ⚠️**Ordering made it worse:** measured char offsets —
   glossary claim at **10,659**, first "two-sentinel" mention at **25,524**, ⇒ **14,865 chars later**, so a
   reader met the endorsement of the weaker form first. ✅**Fixed and verified: `same idiom appears` → 0,
   `slang-language-server-completion` → 1** (must-hit control `E38053` = 2), now reading *"The precedent
   followed here is `slang-language-server-completion.cpp:554-555`, which is the site that excludes both
   sentinels."* ⚠️**The fixer's first pass removed the bad endorsement and left ZERO mention of the real
   precedent** — a reader would learn which site not to trust and never which one the check follows. ⇒
   ⭐⭐**deleting a wrong citation is half the repair; the other half is naming the right one.**

2. ⭐⭐⭐**The decline of the 9-site consolidation rested on ASSERTION in the artifact and on MEASUREMENT
   outside it** — `:7575`/`:7600`/`E30116`/`E30095`/`doesDeclareThrows` had **0 occurrences** in the PR body
   and 0 in cmt `5208479135`. Triager applied its own escalation test to its own finding and it failed. ✅Now
   in the body at `:123`: the bottom-only spelling is the more common one, **three other pre-existing sites**
   use it, consolidating is deliberately out of scope. ⭐**Deliberately does NOT list the three or call any a
   live bug** — putting a defect class into a PR that doesn't fix it invites the widening all three declined.

⭐⭐⭐**THE GENERALISATION, and it is the one defect class tonight that ONLY A READER CAUGHT: a citation is
(site, role).** Every check run on it was a *site* check — `grep` confirms the line exists and says what was
claimed. **Nothing asked "and does this support the sentence I hung on it?"** Same axis as
*a predicate is (operand, comparand)*, and **no matcher fires on either.**

⭐⭐⭐**BUT: four independent confirmations of a number are worth nothing against a SHARED APERTURE.** All
three parties' patterns keyed on `errorType` textually adjacent to `getBottomType()` — the *observations*
were independent, only the *window* was shared. **Cross-party agreement measures whether each of us can
execute a query, never whether the query encodes the question.** ✅**So I probed what the shared pattern
EXCLUDED BY CONSTRUCTION:**
- **line-wrapped** predicates (regex with `re.S` over 4 files) → **0** — no site any single-line grep missed.
- **`getErrorCodeType(...)` call sites**, which no `->errorType` pattern can reach → I found **5**
  (`slang-check-decl.cpp:5462`, `:5463`, `:7403`; `slang-lower-to-ir.cpp:4809`, `:4812`). ⛔**Triager found a
  SIXTH — `slang-syntax.cpp:1099` — because MY probe was scoped to the four files I had been reading.**
  ✅Verified tree-wide (GitHub code search: only `slang-syntax.h` + `.cpp` beyond those), and read it:
  `auto errorType = getErrorCodeType(astBuilder, declRef);` flows into
  `astBuilder->getFuncType(paramTypes.getArrayView(), resultType, errorType)` at `:1133` — **constructs a
  `FuncType`**, and `awk` over `:1090-1140` finds **zero** `equals`/`getBottomType` ⇒ not a predicate.
  ⇒ **6 sites, 0 class members; the count closes tree-wide.**

  ⭐⭐⭐**The sixth site is the lesson eating its own tail: I widened the SHAPE of the aperture and left its
  FILE-SET fixed.** A file-set is an aperture exactly like a line-scope or an `?event=` filter. Benign here —
  had `:1099` tested a sentinel, my shape-widened probe would still have missed it **and the widening would
  have felt like the fix.** ⇒ **widening one dimension of an aperture does not establish the others.** Printed and read: `:5462-5464` compares two error types **to
  each other** (`requiredErrorType->equals(satisfyingErrorType)`), `:7403` **assigns**, `lower.cpp:4809` is
  the lowering exclusion the body already names. ⇒ **none is a class member; the count of 4 survives the
  widened aperture.**

⇒ ⭐⭐**Asking what the pattern EXCLUDED is the only check that has worked on any of these, and it is cheap in
a way "more care" never is — one question about the instrument, not a re-run of the measurement.**
⚠️**Had a wrapped or `getErrorCodeType`-shaped class member existed, all three of us would have confirmed
"three other" and been wrong together.**

✅**Count confirmed THREE independent ways, each with a different query** — triager (4 sites), fixer
(independent enumeration → `slang-check-decl.cpp:7754`, `slang-check-expr.cpp:7575`, `:7600`,
`slang-check-stmt.cpp:642` = 4), and mine (`errorType.*equals\(m_astBuilder->getBottomType\(\)\)` per
file → decl 1 + expr 2, plus `:642` = 4). ⭐**Reproduction by a DIFFERENT pattern is confirmation; the same
pattern re-run is an echo.**

✅**Head unmoved at `7721e7e7864a`** (10 commits, +175) — body edits don't touch the tree, so the
reviewed→head delta is still **5 files / +46 / −8** with `source/` differing.

## State

**RESUME =** `slang-reviewer` verdict, then merge. Triager's two remaining items: refresh cmt
`5208479135` with the reconciled deltas (32→35, 726→728), the **rewritten** justification clause, the
5-file/+137 diff and a provenance note; then forward `[Triage Resolution]`.

**Superseded (kept for trace):** fixer's rebuild result + draft PR. Gates: PR stays **draft**
(`gh pr ready` / `gh pr merge` operator-gated; his "make a PR" authorizes the PR, **not** the flip —
[[feedback_drafts_only_guardrail]]); `Fixes #12330`; `report_pr_created` so webhooks route to the
fixer session; pushes to `fix/issue-12330` need no approval ([[feedback_pushes_not_gated]]).
**4th throw/catch chain in ~72h** (#12343, #12361, #12362); `wt-12362` deletion condition unchanged
(needs **both** #12348 merged and #12362 resolved) — not reaped for this.
