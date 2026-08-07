---
name: project_12393_bwddiff_ref_param_abort
description: "slang issue #12393 — TRIAGED 2026-08-06, verdict posted (cmt 5207625007), bug/high/P2/front-end, ASSIGNED jhelferty-nv, awaiting his 2 answers then a fixer draft PR (prefer diag 38030). ⭐ Verdict REVERSES the body: removing the ICE needs NO design decision — triager PROVED it by building a patch, 6 controls held. Abort is in interface-conformance witness synthesis, not via bwd_diff. ⛔ Filed groupshared repro does NOT reproduce on master (only __ref). ⛔ My '380xx tops out at 38037' RETRACTED; free = 38030/38038/38039/38044/38049."
metadata: 
  node_type: memory
  type: project
  originSessionId: c0a49331-2e8d-42f9-bc64-ae4bbd658822
---

shader-slang/slang **#12393** — "Backward-diff type builders abort on a 'ref' parameter instead of stopping at a diagnostic". OPEN, author `nv-slang-bot[bot]`, **no labels, no assignee**, 0 comments at filing (2026-08-06 15:45Z).

**Substance.** A `[Differentiable]` function with a `ref` parameter makes both backward-diff *type builders* abort:
- `source/slang/slang-ast-type.cpp:931` — `BwdDiffFuncType::_resolveImplOverride`, `ParamPassingMode::Ref` case
- `source/slang/slang-check-expr.cpp:5772` — `SemanticsVisitor::getBackwardDiffFuncType`, same case

both via `SLANG_UNEXPECTED("ref parameter not allowed in backward diff function")`. **`SLANG_UNEXPECTED` routes through `handleSignal`, not `SLANG_ASSERT` — so this fires in RELEASE too, not a debug-only assert.** The adjacent `BorrowIn` case builds a `ConstRefParamType` (over the differential-pair type or a `no_diff` type) and continues; only `Ref` aborts. No `bwd_diff` call is needed in the repro — building the type for the *declaration* is enough.

✅ **Main verified both sites at HEAD** (`grep -n` on the message string, 2026-08-06) — the two `file:line` coordinates in the issue body are real, not hallucinated. That is the only claim in the issue I checked; the design argument below is the filer's, unverified.

**Relationship to [[project_11709_groupshared_byref]].** #11709 makes a bare `groupshared` parameter carry `RefModifier`, which is how *ordinary* source reaches this path (previously it took an explicit `__ref`). #11709 already adds **E38038** ("'groupshared' on a parameter of a differentiable function"), so the missing diagnostic is NOT the gap — the gap is that compilation aborts *after* the error instead of stopping cleanly. Filed separately per review discussion on #11709 rather than expanding that PR (correct call — #11709 is already a sprawling 5-backend chain with a held csyonghe-vs-jhelferty `__constref` design fork).

**Why it is not a one-liner** (filer's framing, plausible but unverified): the type builder runs regardless of whether a diagnostic already fired, so a fix means either (a) a well-formed fallback type for the `Ref` case — which requires *deciding what a backward-diff signature means for a by-reference parameter*, a design question, not a link-satisfying placeholder; or (b) gating backward-diff type construction on the declaration having checked cleanly. Diagnosing in place is not available: `_resolveImplOverride` has **no `DiagnosticSink` and no source location**, so that route needs plumbing.

⇒ ⛔ **SUPERSEDED — this line was WRONG.** I inherited the filer's framing; the triager refuted it by BUILDING the fix (see verdict section: 6 controls held). Removing the ICE needs no design decision. Original text kept for the record: "This is design-gated, not a mechanical fix." Expect triage to land it as an autodiff-owned design question rather than `ready-for-fix`. Autodiff area owner signal: #11160 (`bwd_diff` crash) is assigned **saipraveenb25** with the `Autodiff` label.

**Routing (Main, 2026-08-06).** Issue, not a PR ⇒ `slang-triager` per the webhook routing table. Dispatched on canonical thread **`gh-issue-shader-slang/slang-12393`**. No `in_reply_to` was available (webhook inbound carried no message id), so `thread_id` was set explicitly.

**Next / watch.** Triager owns; expects subsystem + severity + `Autodiff` label + next-step. Watch for: (1) whether triage routes to a design question for the autodiff owner vs. `ready-for-fix`; (2) whether #11709's E38038 changes the repro's output once it merges (the abort is downstream of the diagnostic, so it should not). GitHub footprint required from the triager per closest-to-the-state.

## ✅ 2026-08-06 — jhelferty-nv's decoupling question ANSWERED BY EXECUTION: it IS preexisting

Maintainer asked (issue comment 5207252560): *"Is it possible to construct a repro for this without
relying on #11709 exposing the Ref via `groupshared`? If this is preexisting, then ideally we could
decouple this issue from #11709."*

**Answer: yes — fully decoupled. Reproduced on clean master with no `groupshared` anywhere.**

Minimal repro (`[Differentiable]` + explicit `__ref`, function **never called**, no `bwd_diff`):

```slang
RWStructuredBuffer<float> outputBuffer;
[Differentiable]
float pick(uint tid, __ref float s) { return s; }
[shader("compute")][numthreads(1,1,1)]
void computeMain(uint tid : SV_DispatchThreadID) { outputBuffer[tid] = 0.0f; }
```
→ `error[E99997]: ... unexpected: ref parameter not allowed in backward diff function`, rc=255.

Variant matrix run on clean master (binary `build/Release/bin/slangc`, HEAD `d7d59f374`):
| variant | result |
|---|---|
| A: `__ref` scalar, called, `-target hlsl` | ABORT |
| B: `__ref` scalar, **no** `[Differentiable]` | **compiles fine** — so `[Differentiable]` is required |
| C: `[Differentiable]`+`__ref`, **never called** | ABORT ← minimal |
| D: `__ref float s[8]` array | ABORT |
| E: variant A, `-target spirv` | ABORT — target-independent, front-end |

**Provenance:** introduced by **`45ccce9a3`** (2026-04-01, Sai Praveen Bangaru, "Refactor auto-diff
implementation." #9808) — pickaxe *plus* before/after control (`git grep` absent at `45ccce9a3^`,
present at `45ccce9a3`). So it predates #11709 by ~4 months.

**An ADDITION to the issue body — NOT a correction (I first wrote "correction" and that was wrong).**
The issue body already correctly states that #11709 is what adds E38038, so its repro output block is
a *with-#11709* transcript and is internally consistent. The new fact is what the same program does
**without** #11709: **E38038 does not exist on master** (⛔ my stated reason — "380xx tops out at
38037" — is RETRACTED, see the correction section below; the range runs to 38052 and 38038 is a *gap*.
Absence itself re-verified on pristine HEAD: `grep 38038` = 0), so on master the abort arrives with **no preceding diagnostic
at all** — a bare ICE, no error naming the cause. #11709 doesn't create the bug; it makes it reachable
from ordinary source *and* adds the diagnostic that at least names the cause first.

⛔ **Near-miss worth keeping:** I drafted a maintainer-facing comment announcing a "correction to the
issue body" for something the issue body already said. Caught it only by re-reading the body before
posting. **A claim that someone else got something wrong is the one claim to re-read the source on
first** — it is costlier than being wrong alone, and the bot-authored body was easy to assume sloppy.
Cf. the peer-blaming-diagnosis trigger in the `MEMORY.md` 08-06 anchor.

⚠️ **Instrument caveat for whoever continues this:** the compiler code is in
`build/Release/lib/libslang-compiler.so.0.0.0.0`, **not** in `slangc` (223KB launcher) and **not** in
the also-present `libslang.so`. I burned four consecutive false zeros grepping the wrong object and
a nonexistent defs path — see [[feedback_grep_the_object_that_holds_the_code_not_the_launcher]].
Build was verified clean-master by two independent #11709 discriminators (E38038, E30711 texts both
absent) run alongside positive controls.

**Status:** Main answered the maintainer directly on the issue (mechanical, execution-backed fact —
not a design opinion). The design question in the issue body (fallback type vs. gating construction)
is untouched and still belongs to triage + the autodiff owner.

**Posted 2026-08-06:** https://github.com/shader-slang/slang/issues/12393#issuecomment-5207312340
(Main, answering jhelferty-nv directly — repro + variant table + provenance commit + the
E38038-is-#11709-only addition, with the design question explicitly left open for the autodiff owner).
Triager retains the chain on `gh-issue-shader-slang/slang-12393` for subsystem/severity/labels; the
decoupling half of its job is now done and it should NOT re-derive it.

## ⛔ 2026-08-06 — MY 380xx CLAIM WAS WRONG; corrected publicly. Triager's findings supersede mine.

**Retract from this file and from comment 5207312340:** "master's 380xx tops out at 38037." Pristine
`HEAD` runs to **38052**; 38045–38052 are geometry/mesh/vertex diagnostics (**shared range**, not
autodiff-only); **38038/38039 are gaps in the middle.** My pattern was `3803[0-9],` — a 10-number
window that could not see above 38039. See
[[feedback_a_bounded_grep_pattern_cannot_report_a_ceiling]].
- **Conclusion unaffected:** E38038 genuinely absent on master (pristine grep = 0), so "bare ICE, no
  preceding diagnostic on master" stands.
- **Corrected anyway** because the false ceiling implies 38040+ are free when they are taken. **Actually
  free in that block: 38038, 38039, 38044, 38049.** This family already had a real collision
  (30705→30706→30707 vs #11885). Correction posted: issue comment **5207531076**.
- Caught by **slang-triager**, not by me. Verified myself on pristine HEAD with must-hit/must-miss
  controls before posting.

**Triager's superseding technical findings (its measurements, stronger than mine):**
1. ⛔ **The issue's filed repro (bare `groupshared` param) does NOT reproduce on master** — compiles
   clean, rc=0, 458 B HLSL, re-run with `pick` actually called so not DCE. Only `__ref` reaches `Ref`
   on master. My decoupling repro used `__ref`, so it stands; but do not claim the *filed* repro
   reproduces pre-#11709.
2. **The abort is NOT reached via a `bwd_diff` expression.** Localized with a `__cxa_throw` interposer
   + `addr2line`: fires inside **interface-conformance witness synthesis** at
   `DeclCheckState::TypesFullyResolved` — `BwdDiffFuncType::_resolveImplOverride` ← `Val::resolveImpl`
   ← `getResultType` ← `synthesizeMethodSignatureForRequirementWitness` ←
   `trySynthesizeMethodRequirementWitness` ← `findWitnessForInterfaceRequirement` ←
   `checkInterfaceConformance` ← `checkModule`. That is *why* declaring the function is enough. (A
   subagent asserted the type is built only for a `bwd_diff` expression — refuted by execution.)
3. **Revised design verdict: the ICE is fixable WITHOUT settling the deep design question, but the
   recovery representation needs an input-shape audit** (differentiable vs `no_diff __ref`) — narrower
   than the issue body's framing, and NOT "already answered in tree." Codex killed its first verdict
   with 3 must-fix items: (a) the two builders back **different interface requirements**
   (`core.meta.slang:730` vs `:739`) — `BwdDiffFuncType` backs the legacy static `bwd_diff`
   requirement whose param types are **cloned into real synthesized `ParamDecl`s + call arguments**
   (`slang-check-decl.cpp:7260/:7267/:7299`) and run through overload resolution (`:7667`), so an
   opaque recovery value is not equivalent there; (b) `BwdCallableFuncType::_resolveImplOverride:555`'s
   `getErrorType()` branch is **guarded** by differentiability (`:532` maps non-differentiable/`no_diff`
   params to `NoneType` before the switch) while `:928` is **unguarded** — a blanket `getErrorType()`
   would poison `no_diff __ref`; (c) **the `__constref` analogy was vacuous** — `BwdDiffFuncType`'s
   `BorrowIn` case (`:914-925`) builds a concrete `getConstRefParamType(...)`, never `ErrorType`, so
   clean `E38034` says nothing about the proposed `ErrorType` shape. Right conclusion, wrong evidence.
4. **A diagnostic alone is provably insufficient:** `__constref` + `__ref` in one file → `E38034` fires
   at signature phase and the `__ref` one *still* aborts; `checkModule` has no error-count gate between
   phases.
5. ⚠️ **"Needs an owner" is STALE — jhelferty-nv self-assigned 16:02:06Z**, one minute before
   commenting. Labels `Autodiff`/`bug`/`reproduced` applied 16:05:23Z by **a sibling session under our
   own bot identity**, not a human (all three correct); triager set Issue Type = Bug. **Do not route
   for ownership.** Main verified via API: assignees=[jhelferty-nv], labels as stated, type=Bug.
   ⇒ Same shared-bot-identity blind spot as
   [[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]] — label provenance looked human.

⚠️ **Shared-clone hazard (triager):** `source/slang/hlsl.meta.slang` gained a `[ForceUnroll]` change in
`/workspace/agent/slang` authored by **neither of us** — a sibling session edits the same checkout.
**Never `git checkout -- .` there**; restore named files from snapshots only. Corollary: source facts
come from `git show HEAD:<path>`, never the working tree (the triager's inverse near-miss: its
patched tree returned `38038 -> 2`, i.e. "exists at master", the opposite of the truth).

**Open:** triager's Release build of the candidate fix was at 180/268 and clean; 5-bullet + memo to
follow. Chain stays with triager on `gh-issue-shader-slang/slang-12393`.

## ⛔ 2026-08-06 16:53 — SECOND error in the SAME correction: free-list was short by 38030. Amended in place.

My correction comment 5207531076 published free = `{38038, 38039, 38044, 38049}`, read off a printed
sorted list. **Actual free in 38028–38052 = `{38030, 38038, 38039, 38044, 38049}`.** Caught by
slang-triager. I re-derived independently (unbounded pattern → complement in code, not a tail):
`38030` has 0 occurrences in `slang-diagnostics.lua` and **0 tree-wide under `source/`** on pristine
HEAD (controls `38029`=1, `38034`=1). Confirmed.
- **`38030` is the BETTER slot than 38038**: the `-- 380xx: differentiation modifiers` section marker
  sits between 38029 and 38031 (verified `slang-diagnostics.lua:4417`), so 38030 heads the
  differentiation sub-block, while **38038 is the number #11709 already takes**. Recommending 38038
  would have created the exact collision my comment warned about.
- **Amended in place** via `gh api .../issues/comments/5207531076 --method PATCH -F body=@file`
  (updated 16:53:24Z, marked `*(edited)*`) — not a third comment. Peer left the call to me and had
  already routed the right set into its verdict; I amended because the wrong item is a **pointer to
  action**, not a cosmetic detail.
- ⚠️ **Range-check catch in the peer's own message:** it reported "used in 38028..38052: **36**
  entries" — that window is **25 wide**, so 36 is impossible. It was the whole-380xx count (36)
  mislabeled; its free-set was right. I accepted the conclusion and rejected the figure — separable,
  both need checking.
- Method lesson: [[feedback_an_enumeration_claim_needs_a_computed_complement]] — a positive control
  passes on a window-limited pattern, and `sort -n | tail` gives the true max while staying silent
  about interior gaps. **Two people, two instruments, same blind spot**, because both answer an
  adjacent question to "what is free".

**Triager status at 16:51:** build 264/268, zero errors, core-module regeneration step passed (which
independently confirms the new diagnostic entry is well-formed). 5-bullet to post once it links; the
`__ref`-vs-`groupshared` caveat is now the FIRST line of its comment, so a reader who tries the
issue body's snippet on master won't conclude the issue is bogus. Chain remains with triager.

## ✅ 2026-08-06 17:00 — TRIAGED + VERDICT POSTED (cmt 5207625007). Chain closed at triage; awaits jhelferty-nv.

**Main-verified live:** comment `5207625007` exists, author `nv-slang-bot[bot]`, 10,952 chars, created
16:57:08Z, first line *"Triage summary. Verified at master `d7d59f374`."* Issue now: 4 comments,
labels `Autodiff`/`bug`/`reproduced`, **type=Bug**, assignee `jhelferty-nv`, state open.

**Classification (triager):** bug / high / **P2** / front-end (semantic checking + autodiff type
construction). High because `SLANG_UNEXPECTED` → `handleSignal` directly, so
`SLANG_ASSERT=release-assert-only` does NOT suppress it and it fires in **release**; the
`InternalError` is caught and surfaces as `E99997`, aborting the request with "file an issue" and no
cause. P2 not P1 because it needs an explicit `__ref` today.
✅ Main verified the catch-site claim: `source/slang/slang-end-to-end-request.cpp` ~1941 is indeed the
`catch (const Exception& e)` / `CompilationAbortedDueToException` region at HEAD.
✅ Verified `tests/diagnostics/const-ref-differentiable-param.slang` EXISTS at HEAD (the proposed test
model is real).

**⭐ Verdict reverses the issue body's framing — and was PROVEN BY BUILDING, not argued.** Removing the
ICE does **not** require deciding what a backward-diff signature means for a by-reference parameter.
Triager patched both sites to a recovery type + a `RefModifier` diagnostic, built Release, and every
previously-aborting cell became a clean diagnostic while **all six controls held** (`__constref` still
`E38034`; `out`/`inout`/plain still clean; the body's `groupshared` repro still clean). Patch reverted.
What remains is small, local, and deliberately NOT decided: (a) **which** recovery representation each
of the two (different-kind) sites uses, (b) whether `no_diff __ref` is diagnosed or allowed. Those are
the assignee's call. ⇒ **My earlier "design-gated, not a mechanical fix" line in this file is
SUPERSEDED** — I had inherited the filer's framing; the triager refuted it with a build.

**Next human action:** jhelferty-nv answers (a)+(b) or says "make a PR" → then release `slang-fixer`
for a draft PR (`pr: non-breaking`, `Fixes #12393`, `DIAGNOSTIC_TEST:SIMPLE` modelled on
`const-ref-differentiable-param.slang`, prefer diagnostic **38030**). **No fixer dispatched — do not
dispatch one until the assignee replies.** Blocker: none.

**⛔⛔ RETRACTED IN FULL — the text below is MY ERROR, kept verbatim as the record. I measured a DIFFERENT CLONE and published an inversion of a TRUE peer report. Correct position: cause unidentified, effect measured. See the retraction block after it and [[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]]. Original heading was: "CORRECTION to the triager's shared-clone alarm — the sibling edit was a MISREAD; nothing was lost."**
It reported `source/slang/hlsl.meta.slang` carrying a `[ForceUnroll]` change authored by neither of us,
and warned `git checkout -- .` would destroy in-flight sibling work. Main measured after its revert:
`git status --porcelain` = **0 bytes tree-wide**, 0 untracked, 0 stashes, HEAD == origin/master, 0 local
commits. `ForceUnroll` count identical in worktree and HEAD (**10 = 10**), and it entered the file in
**`0864e60e6`** (2026-08-03, #12148) — i.e. **pre-existing at HEAD, not a local write**. Decisive:
`hlsl.meta.slang` mtime `2026-08-04 07:10:32.832` matches untouched control `slang-ast-type.cpp`
`…:32.836` to the millisecond — checkout-time, not edit-time. ⇒ **A file containing content you don't
recognize is not evidence someone edited it; `git log -S` + an mtime control against a known-untouched
neighbor discriminates in one command.** The revert *was* clean, which is the part that mattered.
⚠️ Keep the `git show HEAD:<path>` discipline regardless — it is correct for a *patched* tree
independent of whether a sibling exists.

**⚠️ REAL and worth keeping — `BUILD_EXIT=1` was a false failure (triager):** link reported
`FAILED: libslang-compiler.so` with 7 `undefined reference` serialization symbols, all false — the
object existed, was fresh, *defined* the symbol, and *was* on the link line; `.ninja_log` showed the
lib and `slangc` linking successfully **seconds after** the reported failure. Cause: **another `ninja`
running in the same `build/` directory.** ⇒ **On a shared clone the BUILD DIRECTORY is shared mutable
state, not just the source tree** — a build failure there is not evidence about your code until you
confirm the artifact. Triager's confirmation method: grep the `.so` for the new string **with a
known-present string in the same command** (the control-adjacency rule from
[[feedback_grep_the_object_that_holds_the_code_not_the_launcher]]). Also: **reverting source is not
reverting the build** — the binary still held the patch after the source revert, so a pristine rebuild
was needed to stop the binary from disagreeing with the tree.

**Artifacts (triager's filesystem, not mine):** memo `/workspace/agent/memory/triage-12393.md` (411
lines: symbolized stack, full cell matrix, 3 codex corrections + source verification, build-race
diagnosis); probes `/workspace/agent/scratch-12393/`.

## ⛔⛔ 2026-08-06 17:07 — I RETRACT the "misread" verdict above. My clone ≠ the triager's clone.

**The refutation needs no filesystem access and is decisive:** an upstream commit that is an **ancestor
of HEAD cannot produce a worktree diff against that same HEAD**. `git diff` compares worktree↔HEAD, so
a purely-upstream `[ForceUnroll]` would print **nothing**. The triager captured `hlsl.meta.slang | 2 ++`
with hunks (`[ForceUnroll]` on the `default:` arm of two `dot` overloads). So the file genuinely
differed from `d7d59f374` at ~16:4x on its edge, whatever wrote it.

**Why my measurement said otherwise — different objects:**
| | device + subpath |
|---|---|
| **My clone** | `/dev/vda1[/home/ubuntu/slang-coworkers-prod/nanoclaw/groups/main]` |
| **Triager's** | `/dev/vdb[/prod-groups/slang-triager]` |

**`/dev/vdb` is not present on my edge at all** — I could never have observed the state it reported.
My `07:10:32.832` figures also *predate* its `16:55:46` revert of a file it demonstrably rewrote. On its
edge my own discriminator inverts: `hlsl.meta.slang` `17:00:26.116` vs its revert writes `16:55:46.836`
⇒ rewritten **4m39s after its last write**, now byte-identical to HEAD. Two correct measurements of two
different clones at two different moments. It ruled out its own rebuild (0 mentions of
`hlsl.meta.slang` in the rebuild log, non-zero control present; no build step writes
`source/slang/*.slang`).

⇒ ⭐⭐⭐ **A valid discriminator run on the wrong object manufactures a confident inversion.** The
same-tree mtime control is a good instrument — that is exactly why it produced a crisp, wrong answer.
⇒ ⭐⭐⭐ **Before contradicting a peer about a file: `findmnt -no SOURCE,TARGET --target .` (device +
subpath), not the path string.** The missing trigger was social — *"am I about to tell a peer they are
wrong about a file?"* This rule sat at DEPTH ZERO in `MEMORY.md` as the **3rd instance** while I
committed the 4th; now anchored as the 4th with this case, because it is the first that **shipped
upstream** rather than being caught as a near-miss.

**TERMINAL POSITION for this sub-thread — relay NEITHER phrasing:** not the triager's original
"a sibling is editing our clone" (its inference; it identified no writer and has withdrawn the
phrasing), and not my "misread" (wrong object). Honest version: **a transient modification appeared in
`/dev/vdb[/prod-groups/slang-triager]` and was reverted by something other than the triager; cause
unidentified, effect measured.** Cheap next probe if it ever matters: anything in that clone with an
mtime after `16:55:46` that nobody claims. **Not worth chasing** — no work was lost, both trees are
clean, and the safety practice below is correct either way.

**Unaffected and still correct:** restore named files from snapshots rather than `git checkout -- .` in
any possibly-shared tree; `git show HEAD:<path>` for source facts in a patched tree; the
shared-`build/`-directory race (`BUILD_EXIT=1` false failure) — that one was independently verified via
`.ninja_log` and is the more actionable hazard.

## ✅ 2026-08-06 17:51 — CHAIN CLOSED at triage. Environment verified clean. No fixer.

Triager's terminal report. Deliverable stands: cmt **5207625007**, bug/high/P2/front-end, Issue Type
Bug, labels untouched (already correct), **no fixer dispatched** — jhelferty-nv owns the two remaining
judgement calls (which recovery representation per site; whether `no_diff __ref` is diagnosed or allowed).

**Environment close-out (its measurements):** source has zero tracked modifications, all four probe files
byte-identical to HEAD; binaries rebuilt and verified **at the artifact** (probe string absent, original
abort string restored, must-hit + zero controls in the same command) **and then behaviourally** — the
repro aborts again, the control still compiles. ⭐⭐ **The behavioural check is the one a string check
cannot substitute for**: identical strings do not prove identical behaviour. Load-bearing here because
the *first* revert rebuild exited 1 on the concurrent-build race and **had died before relinking** —
trusting the exit code would have left a binary disagreeing with its source.

**Final tally of my own errors on this chain, all corrected publicly or in-store:**
1. `380xx tops out at 38037` — window-limited grep pattern. Corrected on GitHub (cmt 5207531076).
2. Free-list short by `38030` in that very correction — amended in place; `38030` is the *better* slot
   (heads the differentiation sub-block; 38038 is #11709's).
3. "The sibling edit was a MISREAD" — measured a **different clone**; overturned a peer's TRUE report.
   Retracted; terminal position *cause unidentified, effect measured*.
4. `pgrep -a ninja` published as the fix — `-a` substring-matches the process name; **`pgrep -x`** is
   right by construction. Amended in the shared learning.
5. Shared-learning id attributed by `ls -t` position — twice, both wrong
   ([[feedback_newest_file_is_not_my_file_shared_store_has_concurrent_writers]]).

⭐⭐⭐ **Pattern across 1/2/4: adversarial on the bug, single-instance on the remedy.** Peer's sharper
corollary: **the remedy is the artifact nobody attacks**, because having one feels like the reward for the
hard part. ⇒ Hold a fix to the same adversarial standard as the diagnosis.

⛔ **STOP-RULE observed:** three consecutive rounds ended with a correction needing correction (round 3
was pure bookkeeping and still wrong). Trend = reason to stop, not evidence the process works. Closed
the loop in-store rather than extending it by message.

**Shared store caveat (verified independently):** ≥3 sessions wrote to `/workspace/shared/learnings/`
inside one ~15-min window; `1786038280236` (SVG/pixel-calibration markers `SVG`=1/`pixel`=1/`heartbeat`=1,
ours all 0) belongs to a third party. Attribute by topic markers, never index adjacency.

**Cross-links completed by Main** (`/workspace/shared/` is Main-writable only): the three concurrent-ninja
entries (`1780869770381` July · `1786035550722` enum/Bonus · `1786036606295` bridge) are now mutually
linked with all off-diagonal cells ≥1, and the two `pgrep` entries (`1786038047034` triager ·
`1786038259966` mine) are bidirectionally linked with the guard-theatre + artifact-vs-exit-code halves
folded into mine so either is a complete read. All five indexed in `INDEX.md`.

**RESUME TRIGGER:** jhelferty-nv answering the two judgement calls, or saying "make a PR" → release
`slang-fixer` for a draft PR (`pr: non-breaking`, `Fixes #12393`, `DIAGNOSTIC_TEST:SIMPLE` modelled on
`tests/diagnostics/const-ref-differentiable-param.slang`, prefer diagnostic **38030**). Until then: no
action, no nudge — the assignee is a human maintainer who self-assigned 16:02Z.

## ⚠️ 2026-08-06 17:58 — foreign-edit postscript (NOT #12393; recorded because it corrects a reading of mine)

A **second** foreign edit landed in `/dev/vdb[/prod-groups/slang-triager]`'s `hlsl.meta.slang` at
**17:52:19Z**, 2m33s after that session verified its tree clean: `+ case glsl: __intrinsic_asm "dot";`
into the `__target_switch` of the `dot` overload at HEAD line ~10169. Distinct from the ~16:4x
`[ForceUnroll]` edit (reverted ~17:00). Writer still unidentified by either of us; **left untouched.**

⛔ **My reading of it was wrong and the correction matters more than the observation.** I said it "fills
an upstream asymmetry — makes overload #2 match overload #1." Verified at HEAD, the two `dot` overloads
are **not** near-duplicates:

| overload | constraint | switch arms at HEAD |
|---|---|---|
| ~10108 | `__generic<T : __BuiltinFloatingPointType, let N : int>` | cuda, glsl, hlsl, metal, spirv×2, wgsl, default |
| ~10161 | `__generic<T : __BuiltinIntegerType, let N : int>` | hlsl, spirv, wgsl, default ← edit adds `glsl` |

So the edit **claims GLSL's built-in `dot` for INTEGER vectors**. GLSL's `dot` is float-only per spec, and
the integer overload's `default:` arm at HEAD is an explicit scalar loop (`T result = T(0); for(...)
result += x[i]*y[i];`) — i.e. the fallback *is* plausibly the deliberate GLSL implementation. Also
verified: `[require(cpp_cuda_glsl_hlsl_metal_spirv_wgsl_llvm, sm_4_0_version)]` is on **both** overloads,
so capability was never the gap; the arm's absence was the mechanism.

⇒ ⭐⭐⭐ **"Fills a symmetry" and "changes integer `dot` on GLSL from a scalar loop to a float-only
intrinsic" are different claims, and the second is the reviewable one.** The symmetry is what the *diff*
looks like; the type constraint sits **three lines above the hunk** and inverts the risk profile.
**A hunk's meaning can live outside the hunk — read the enclosing declaration before characterizing a
diff**, especially where sibling overloads look identical at a glance. Not judging the change; it is
someone's live work and may be right for reasons invisible in a switch statement.

✅ **My clone is not the source and cannot corroborate:** `git status --porcelain` = 0 bytes at
17:55:59Z; `hlsl.meta.slang` byte-identical to HEAD (`git show HEAD:… | cmp -` clean). My `case glsl`
count of 1 in that window is **overload #1's, upstream** — I located it before concluding, because a raw
count there would have read as "I have the edit too" and started a shared-mount theory the device IDs
already rule out ([[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]]). No chain in my
store touches `dot()` intrinsic lowering (control: 888 files match `slang`), so I cannot name the writer.

⇒ **Durable form: "tree clean" is a TIMESTAMP, not a fact — re-read `git status` at the moment you make
any claim about it.** Generalizes past that clone: a concurrent session wrote a leaf into MY memory store
at 17:52 (`feedback_a_correction_without_a_coordinate_does_not_stick`, none of my markers; linked, content
untouched) — same minute, different edge, correlation only.
