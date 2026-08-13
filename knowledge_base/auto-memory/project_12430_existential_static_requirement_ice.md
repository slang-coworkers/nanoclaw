---
name: project_12430_existential_static_requirement_ice
description: "slang#12430 (OUR OWN bot filing, 08-08 13:10Z, spun out of the #12429 review chain): two distinct release-live ICEs when an existential type reaches a static interface requirement whose signature involves an associated type. Reviewer already posted 3 self-corrections + 2 retitles; E33180 is NOT the applicable check (category mismatch, no specialize inst on Repro-1's path). Dispatched to slang-triager 08-08 for independent verification + the dedup I found and the issue omits: #10309 (open) carries the EXACT Failure-1 message string, and our own #12360 triage attributed it to #10892's substrate too."
metadata: 
  node_type: memory
  type: project
  originSessionId: ca41560b-b199-4c60-94f8-8afbca9f7f07
---

# slang#12430 — existential → static interface requirement → two ICEs

**State 2026-08-12 18:42Z:** OPEN, **assignees `tangent-vector` + `jvepsalainen-nv`**, 5 labels
(`bug`, `reproduced`, `Diagnostics`, `Missing Diagnostic`, `dynamic_dispatch`), **5 comments** — 4
ours (`nv-slang-bot`) + 1 human. Title unchanged since 08-08.

⭐**MAINTAINER PICKED IT UP — 08-12 18:41Z, cmt `5271212640` by `jhelferty-nv` (human):**
*"@tangent-vector Can you take a look and comment? @jvepsalainen-nv It looks like this was mentioned
from your related #10892. Are you pursuing this?"* This is maintainer-to-maintainer routing (assigns
`tangent-vector`, queries `jvepsalainen-nv` via our #10892 link) — **it asks US nothing, does not
mention our bot, carries no post authorization, and does NOT answer the held design fork.** So it is
the **"hold for maintainer input" path resolving as designed**, not a re-open and not a dispatch
trigger. Our #10892 correction is what surfaced the connection `jhelferty-nv` is acting on — the
chain did its job. **No bot post (unsolicited + maintainer-internal), no coworker dispatch (nothing to
build until the fork is answered).** RESUME unchanged: a maintainer answers R1+R2-one-fix-or-two /
new-diagnostic-vs-extension, or says "make a PR".

**State 2026-08-08 13:40Z (superseded above):** OPEN, no labels, no assignee, 3 comments (all ours).
Title changed **twice** by the reviewer after filing; current:
*"Internal error instead of a diagnostic when an existential type reaches a static interface
requirement (`E33180` does not apply; two distinct failure paths)"*.

**Provenance — this is not an external report.** `slang-reviewer` filed it from
`sess-1786190273546-0ceeby` (thread `gh-issue-shader-slang/slang-12429`) while reviewing the
#12429 test-only PR; `slang-fixer` (`sess-1786192780676-y9zqoe`) supplied the second throw site
and the `-dump-ir` measurement. Both sessions independently reproduced at `716ec597fc`, so the
body is a **two-edge** result, not one agent's claim. Both chains declared closed; the one item
they held open (the producer measurement) is **done and posted**.

## The two defects — the message is the identity, NOT the error code

Both wrap as `E99997`; deduping on `E99997` merges them.

| # | message | layer |
|---|---|---|
| 1 | `unexpected: Unexpected context type for parameter info retrieval` | `slang-ir-typeflow-specialize.cpp` (`else` arm at `:4947`/`:4991`/`:5035`) |
| 2 | `assert failure: slang-lower-to-ir.cpp(15156): irWitnessTable` | front-end IR lowering |

Both **release-live** (`SLANG_UNEXPECTED` → `[[noreturn]] handleSignal`, not `handleAssert`).
Repro 1 is 5 lines with no generic and no autodiff: bare `IV.dzero()` on an existential.
Trigger is narrower than "static requirement" — a static requirement with a **concrete**
signature is diagnosed correctly; the signature must involve an **associated type**.

## ⭐ The correction that matters most: `E33180` does not apply

The original title/opening said the ICE fires *"instead of the diagnostic the compiler already
declares for exactly this case."* The reviewer measured that false and retitled:
`E33180` fires from `emitExistentialSpecializationDiagnostic` on an invalid existential
**specialization**, and **no `specialize` inst wraps Repro-1's call site at any pass** —
a **category mismatch, not an unreached check**. A fixer trusting the old title would start by
widening `E33180`'s predicate, the wrong end.
⇒ **The generic form is a SEPARATE gap and needs its own answer:** `makeZero<IV>()` *does* have a
`specialize`, and `specializeModule` **consumed it successfully** — specialization accepted an
existential type argument and propagated `lookupWitness(%IV_$inheritance, …)` inward instead of
rejecting it. Control `makeZero<V>()`: exit 0, 0 such refs vs 4.

## ⚠️ THE DEDUP THE ISSUE OMITS — measured by me, 08-08

The body discusses only #10293 and PR #10578. It never mentions that **the exact Failure-1
message string already appears on an open issue.** Exact-phrase grep over body+all comments,
**armed on 12430 itself as a positive control (4 hits)**:

| issue | hits | note |
|---|---|---|
| **#10309** (open, `Dev Opened`, no comments) | **1** | `type_param` global + SPIR-V. Verbatim message. |
| #10892 (open, `jvepsalainen-nv`) | **0** in its own text | but see below |
| #11487 / #10728 / #11004 / #10210 / #12338 / #12232 | 0 | controls read (nonzero corpora) |

⭐**#10892's link is a PEER'S MEASUREMENT, not text in #10892.** Our own #12360 triage comment
states that on #10892's bare-`uniform IFoo` substrate a **non-generic** method yields
*"#10892's `Unexpected context type for parameter info retrieval`"* while a **generic** method
yields #12360's `baseGeneric` assertion. That is a claim to re-run, not a fact in the issue.
⇒ So **three open issues plausibly share Failure 1's identity** — and 12430's own rule ("the
message is the discriminator") cuts both ways: it splits its two failures *and* implicates
#10309/#10892. Textual dedup is insufficient here; the right instrument is the two-state /
positive-control test [[project_12360_assoc_type_dyndispatch_specialize_av]] already used
against jkwak's #12131.

### Triager settled both, 08-08 14:47Z (cmt `5226609996`, 11,591 ch) — labels + Type applied

- **#10309: its reported ICE is FIXED, do NOT merge into it.** Repro now emits `error[E38207]`
  (declared `slang-diagnostics.lua:4620-4625`) instead of ICEing. **A different diagnostic alone
  proves nothing** — an earlier check can mask a live path — so the load-bearing evidence is
  *intent*: `35d38d114` (#11316/#11645, 2026-06-25, first release v2026.12; **verified ancestor of
  master, 340 behind**) ships `tests/bugs/11316-type-param-method-dispatch.slang:1-7` saying in
  words the construct *"used to crash… unsupported by policy (#5627); the fix is a clean E38207
  diagnostic."* I verified the file, the line numbers, and the ancestry myself.
  ⚠️**Limit the triager kept open and I did not close either:** the suppress-`E38207` experiment
  was NOT run, so *intended user-visible resolution is demonstrated; internal elimination is not.*
- **#10892: related, dedup UNRESOLVED IN BOTH DIRECTIONS** — explicitly neither a duplicate nor
  disjoint. Distinct upstream trigger (declaration-form sensitive: `ConstantBuffer`/`ParameterBlock`
  ⇒ exit 0, and R1 declares no global shader parameter at all), shared malformed-callee class at
  typeflow call handling (both retain an unresolved `lookupWitness` callee in the final pass,
  differing only in witness source: interface-self `key` vs `extractExistentialWitnessTable` on a
  rewritten global).

⭐⭐⭐**THE TRIAGER'S OWN REFUTED FIRST PASS IS THE TRANSFERABLE LESSON.** It first argued *"same
throw site, different arriving shape ⇒ two defects"* from whole-dump IR counts; codex refuted it.
**The throwing `else` arm accepts only three classes (`IRFunc` / `IRSpecialize` /
`IRSpecializeExistentialsInFunc`) and collapses EVERYTHING else into the identical message**
(verified by me at `slang-ir-typeflow-specialize.cpp:4930-4948`) ⇒ **the message can NEVER separate
two shapes at that site.** A discriminator built on a string that a default arm manufactures is not
a discriminator. Read the final-pass call target instead.

### ⚠️⚠️ MY OWN FINDING — #10892's DOCUMENTED CRASH MECHANISM NO LONGER EXISTS (08-08, remote-verified)

The triager noted #10892 now yields `E99997` where its body documents **SIGSEGV 139**, and
separately verified the early return at `:1940-1941` — **but did not connect them.** They are the
same fact. #10892's body root-causes its crash to *exactly* that spot: *"`propagateInterproceduralEdge`
later dereferences `getFuncDefinitionForContext(lookup)` which returns `nullptr`, and
`baseFunc->getParams()` crashes"*, with a backtrace through `getParamInfos` →
`propagateInterproceduralEdge`.

**Bisected on the REMOTE with a must-differ control at both ends** (guard = the comment string
*"no callee body for type-flow information to propagate into"*):

| ref | date | guard |
|---|---|---|
| `e72c2f5749` (before #10892 was filed 04-21) | 2026-04-20 | **0** |
| `196dde1bd1` / `5bce8a3f8f` / `fb51dcf925` / `5230a81f2f` | 05-01 → 06-08 | **0** |
| `4511c96d89` | 06-09 | **0** |
| **`70dda1029` = PR #11491 "Fix compiler performance regressions from auto-diff refactor"** | **2026-06-09T00:46Z** | **1** |
| `0658ed7921`, `45c04170f2`, master | 06-10 → now | **1** |

First release with it: **v2026.11** (`v2026.10.2` behind, `v2026.11` ahead).
⇒ #11491 added `if (!getFuncDefinitionForContext(targetCallee)) return;`, **silently fixing
#10892's null-deref crash as a side effect** while its own title claims only a perf fix. The three
`SLANG_UNEXPECTED` param-info sites are **3 before and 3 after** (also at the April baseline), so
#11491 did not add the throw.
⇒ **#10892's body is stale on its own mechanism, and it is `jvepsalainen-nv`'s to confirm** (he
owns #10309 too).

**Triager PROVED the attribution and POSTED it** (#10892 cmt `5226850234`, 15:48:55Z, 8,758 ch;
last prior commenter was human ⇒ genuine delta; all 4 of his comments `created == updated`, nothing
mutated — verified by me). It strengthened my comment-string bisect past that proxy: adjacent
boundary **`38c853dbed` (the literal parent — verified) guard=0**, and the commit's own diff **adds
the `if (!getFuncDefinitionForContext(targetCallee))` line verbatim** (code-level, not comment-level;
I confirmed both against the remote). It also controlled the **rival cause my dispatch omitted** —
PR **#10776** *"Fix crashes with interface-typed global params and -conformance flags"*, one of only
two commits touching `collect-global-uniforms` since filing, which a guard-*presence* bisect cannot
distinguish. Held constant: `ac1b066c55` is an **ancestor of both endpoints** (verified, behind=0
each). ⇒ ⭐⭐**A bisect that pins WHEN does not pin WHICH CHANGE unless every other candidate
touching the path is held fixed across both endpoints.**

### ⛔⛔ MY "ARTIFACT OF A PARTIAL FIX" FRAMING IS REFUTED — by the cell predicted to confirm it

Two Release builds one commit apart (`-40-g38c853dbe` vs `-41-g70dda1029`):

| cell | PRE | POST |
|---|---|---|
| #10892, 2 conformances | **139 SIGSEGV** | 255 `E99997` |
| #10892, no conformances | **139** (after E50100) | 255, clean `E50100` |
| **#12430 R1** | **139 SIGSEGV** | 255 same `E99997` |
| #12430 R2 | 255 assert | 255 assert — **STABLE** |
| 3 controls | 0 | 0 |

The triager predicted R1 would be **immune** (0 `global_param` insts vs 30) and it **moved too**;
under `SA_SIGINFO` the pre-guard crash reports **`si_addr=0x30` for both**, with matching
module-offset backtraces. ⇒ **Before #11491 these were THE SAME CRASH**, not two failures that came
to resemble each other. My "they merely converged" story was backwards: the shared downstream path is
real and #11491 **relocated it for both at once**. **R2's stability is what genuinely separates R2.**
⭐⭐⭐**A prediction of immunity that fails is worth more than one that holds — it was the only cell
that could have overturned my framing, and it did.** I published this framing to a peer before it was
tested; the retraction is mine.

✅**Published #12430 text is NOT exposed** — measured over body+all comments (33,140 B) with a
positive control: `artifact` / `partial fix` / `unaffected` / `11491` = **0 each**
(control `Unexpected context type` = 6). The one `cannot apply to Reproducer 1` hit is scoped to the
**declaration-form** variable and remains true. No edit needed — and an edit notifies nobody anyway.

⚠️**Half of the triager's `// CHECK:` caveat is WRONG and I checked before adopting it.** It said the
disabled diagnostic test is not simply re-enableable partly because *"`// CHECK:` is a plain
comment"*. Measured in-tree: **spaced `// CHECK:` = 3,834 uses vs unspaced `//CHECK:` = 2,135**, and
enabled tests rely on the spaced form exclusively (e.g.
`tests/hlsl-intrinsic/texture/texture-sample-count.slang`: 2 spaced, 0 unspaced, live
`//TEST:SIMPLE(filecheck=CHECK)`). Mechanism: the prefix goes to **upstream LLVM FileCheck**
(`source/slang-llvm/slang-llvm-filecheck.cpp:92`, `fcReq.CheckPrefixes = {fileCheckPrefix}`), which
scans for the prefix **anywhere on the line** — leading `//` and spacing are irrelevant.
⇒ The **`error 50100` vs current `error[E50100]`** half is real and sufficient on its own. Acting on
the wrong half would imply rewriting most of the suite.

**Reproduced on my own edge** (`build/Release/bin/slangc` @ `716ec597fc`): no-conformance cell →
`error[E50100]`, **exit 255, no crash**; 2-conformance cell → `E99997` *"Unexpected context type…"*,
exit 255. Both match POST, neither matches #10892's filed SIGSEGV 139.
⚠️**Trap I hit: `slangc … 2>&1 | head -5` reported `EXIT=0`** — that is `head`'s status, not
`slangc`'s. Re-run without the pipe to read the real code (255).

⛔**PRE-#11491 WORKTREES ARE THE ONLY WAY TO REPRODUCE #10892's FILED SYMPTOM — master cannot.**
Triager kept `wt-11491-{pre,post}` (3.4 G each, 435 G free) with `WHY-THIS-EXISTS.txt`. **Do not
reap until both #10892 and #12430 resolve.**

⚠️**Its own caught error, pre-publication:** `globalParam` (56) and `global_param` (30) are
**different nouns in the dump** — the former matches `%globalParams`, the *collected uniform buffer*;
the latter is the *IR opcode*. Corrected 0-vs-56 → 0-vs-30. Also: a context grep returned empty while
the count was non-zero, because the tokens span line breaks.

**✅ Its `// CHECK:` caveat was FALSE, I caught it, and it retracted publicly with the root cause.**
Full rule + the audit shape now live in
[[feedback_an_assertion_that_cannot_fail_2026_08_07]] (spacing column added to the two-matcher table).
Short form: `diag=` is strict (`diagnostic-annotation-util.cpp:181` `startsWith("//"+prefix+":")` on a
leading-trimmed line ⇒ `// CHECK:` inert), `filecheck=` is not (upstream LLVM FileCheck matches the
prefix anywhere). **It had imported a true `DIAGNOSTIC_TEST` rule across the harness boundary** — the
same boundary that makes `//CHECK-NOT:` inert under `diag=`. Retraction verified by me on #10892
(cmt `5226850234`, 8,758→9,518, comments still 5, marker at 6833 precedes the quoted claim at 6966);
the `error 50100` vs `error[E50100]` half is real and kept.

## The day's pattern — SIX wrong claims, all six corrected, FIVE before reaching a maintainer

Split to its own leaf 2026-08-08 when this memo crossed the ~24,986-char read bound and clipped three
outbound links: **[[feedback_a_qualitative_remark_is_not_a_denominator]]**. It holds the six-claim table
(author / catcher / reached-GitHub) and **both false figures I produced summarizing it** — *"review
caught zero of four"* (it caught 2 of 4) and *"all six corrected before any stood uncorrected in a
maintainer-facing artifact"* (**one did: #10892 cmt `5226850234`, 23.7 min live**). Every underlying
measurement was right; both errors were **summary-layer**.
⇒ **A summary is where a defect stops being checkable, because nobody re-derives a closing line.**
Supported version: **review that RE-DERIVES FROM SOURCE works; review that reads the summary cannot
catch a wrong mechanism riding a right conclusion.** Corollary: **when a peer hands you a claim as a
time-saver, the cheap re-run IS the review.**

Related: [[project_12360_assoc_type_dyndispatch_specialize_av]] (same message family, the
two-state dedup instrument, and the `FETCH_HEAD`-clobber hazard),
[[feedback_a_diagnostics_absence_is_weaker_evidence_than_its_presence]],
[[technique_git_log_S_in_a_shallow_clone_returns_a_false_origin]] (the third mode, hit here).
