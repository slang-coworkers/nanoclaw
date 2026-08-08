---
name: project_12367_functype_kernel_emit_armed_cotrigger
description: "ARMED CO-TRIGGER — slang#12367 (functype reaches 4 kernel emitters as an undefined type) is owned-but-NOT-decided; dispatch slang-fixer ONLY when a maintainer answers the design fork or says 'make a PR'. Spin-off #12372 filed. RESUME on any human comment on either issue."
metadata: 
  node_type: memory
  type: project
  originSessionId: 9f9f7b0e-e9ed-4eb0-8ecf-7cff86871b38
---

# slang#12367 — `functype` reaches kernel emitters as an undefined type name

**Written 2026-08-05 after a container restart revealed this chain had NO durable project row** — it
existed only in 11 *lesson* files as an example, plus the live conversation. The operational state below
is what a restart would otherwise have dropped. ⭐ **A chain that repeatedly closes and re-opens never
gets a `project_` row written, because every closing turn feels terminal.** That is the gap this file
closes.

## ✅ TRIGGER FIRED 2026-08-05 ~23:1xZ — NO LONGER ARMED

`jkwak-work`, cmt **`5198405565`**: *"@nv-slang-bot , let's have a disgnostic error message for the
targets that doesn't have the implementation until we have the implementations. **Make a PR**"*

⇒ **The design fork is ANSWERED: Approach A (diagnose), explicitly framed as an interim measure "until we
have the implementations"** — so the PR must not read as closing the feature question. Authorization is
an explicit `@nv-slang-bot` mention ⇒ GitHub post-back authorized.
**Routed through `slang-triager`** (owns the chain, holds the 380-line memo + repro files, is last
commenter) rather than dispatching `slang-fixer` myself — **both of us were armed, and parallel dispatch
to the same peer mints duplicate sessions.** I explicitly stood down my own dispatch; triager owns it.
⚠️ `slang-fixer` already had an unrelated live session on **#12372** (`sess-1785964795135-xlefpr`) at
dispatch time — different chain, do not conflate.

## HANDOFF COMPLETE 2026-08-05 ~23:13Z — waiting on `[Fix Report]`, DO NOT POLL

`slang-triager` dispatched `slang-fixer` on canonical thread `gh-issue-shader-slang/slang-12367`; memo
`triage-12367.md` (453 lines) delivered as `msg-1785971475238-im8ckf`. Fixer read back all six
constraints correctly. **Workflow Step 10 is explicit: wait, do not poll or re-dispatch.**
⚠️ Dispatch required the `<message>` block channel — the routing gate refuses the MCP call for a missing
`in_reply_to` on a *fresh* dispatch (same gate + workaround as #12302 / #12311).

**What gets checked on the report — re-read the actual DIFF, never the progress summary:**
four silent targets genuinely covered (⛔ Metal's op-name fallback is the trap: a CPP-only fix looks
complete and isn't) · `host-cpp`/PyTorch `[DllImport]` still works · kernel-target `functype` test
coverage exists · PR body carries **both** the interim framing **and** the HLSL/GLSL exclusion as an
explicit note rather than silence.
**Then:** fresh comment on #12367 with the PR link (**last commenter is human `jkwak-work` ⇒ fresh, not
an edit — an edit notifies no one**), and `[Triage Resolution]` upstream.

## ✅ PR #12378 OPEN 2026-08-06 02:23Z — draft, awaiting review

`fix/issue-12367` → master · **draft** · `pr: non-breaking` · `Fixes #12367` · `mergeable=true` ·
`jkwak-work` requested reviewer **and** assignee · 0 reviews · CI red is a bot-CI priority yield
("Stop yielded bot CI", 33 builds skipped), so **nothing is validated yet**. Public trail: issue cmt
`5199718759` (patched in place — now lists `llvm-shader-ir` and carries a segfault Update).

⚠️ **DIFFSTAT MOVES — NEVER quote a stored one; re-measure.** Observed THREE times on this branch:
`+419/−0 over 10 files` @02:23Z (head `524c391fb`… earlier) → `+424/−0 over 10` @03:1xZ
(`524c391fb`) → **`+564/−0 over 16 files` @04:5xZ (head `9482349972`)** — each verified by me, each
with the partition control closing (per-file `--numstat` sum == `--shortstat` total ⇒ no file
unaccounted). **The command, not the number:**
`MB=$(git merge-base <pr-ref> origin/master); git diff --shortstat $MB <pr-ref>`.

✅ **DESIGN QUESTION CLOSED BY THE LANGUAGE OWNER 08-07** — `csyonghe`, cmt `5212908232`:
*"`functype` is mostly for core module's internal use, not intended as a mature language feature. We
should mark it as unsupported now, until we decide to add full support for it. Supporting it for
cpp/cuda should be easy, other targets might not be feasible."* ⇒ E55216 is **endorsed, not inferred**;
the (a)/(b) split held — (b) shipped, (a) deferred by the owner. **Forward-looking:** the diagnostic is
likely *temporary* for cuda/cpp and *permanent* for metal/wgsl — don't word it as if all four are
equally hopeless.

⛔⭐⭐⭐ **CORE-MODULE SAFETY — MY MECHANISM WAS WRONG, THE TRIAGER'S IS ROBUST.** `hlsl.meta.slang` uses
`functype` **20×** (`cooperate`/`fallback`/`waveMatch`/`broadcast` params, reduction `combineOp`), so
"will E55216 fire on core-module code?" is a real question a maintainer will ask — and the PR body
mentions the core module **0 times**. I answered *"they specialize away"*; measured, **4 func-typed
insts DO survive to check time**. The true reason: all four are `^func %Name : Func(...)` **plain
declarations**, and the check is **SHAPE-GATED before it ever reaches the opcode switch**. Verified at
`b7aa786bd0`, inside one `for (auto globalInst : module->getGlobalInsts())`:
`if (rejectFuncTypedValue)` at **`:335`** runs FIRST and contains two type tests —
`holdsFuncType(field->getFieldType())` at `:341` behind `if (auto structType = as<IRStructType>(...))`
(`:337`), and `holdsFuncType(globalInst->getDataType())` at `:357` behind
`else if (globalInst->getOp() == kIROp_GlobalVar)` (`:354`). **A `kIROp_Func` survives because it
satisfies NEITHER shape gate, so its own type is never tested.** Only 4 **value positions** can fire:
`kIROp_Var`, struct `field` (`:341`), `kIROp_GlobalVar` (`:357`), block `param` (via `:244`).

⛔⭐⭐⭐ **THREE MECHANISMS, ONE VERDICT, TWO OF THEM WRONG — and the verdict's stability is what let both
survive.** (1) mine: *"specialization eliminates them"* — **false**, 4 insts survive. (2) triager's:
*"the switch dispatches on opcode before examining any type"* — **false**, types ARE examined at `:341`
and `:357`. (3) truth: **shape-gating in the pre-switch block.** ⚠️ **I had cited `:380`
(`case kIROp_Func:` recursing into the body) as the protection — accurate as a line, wrong as the
explanation; the recursion happens AFTER.** ⇒ ⭐⭐⭐ **A correct verdict re-derived from three different
mechanisms is evidence the verdict is over-determined, NOT that any mechanism is right — and a wrong
mechanism in the store is worse than none, because the next reader who opens the pre-switch block sees
the type tests I claimed were absent.** Neither of us reached the truth without codex attacking it.
⇒ ⭐⭐⭐ **"They specialize away" is a claim about a PASS; "declarations aren't value positions" is a
claim about the CHECK'S SHAPE — the second survives a specialization regression, the first doesn't.** I
was one step from having the fixer publish the fragile version into a maintainer-facing body, where the
author of that core-module code would have found it wrong. Same fact that made a type-keyed predicate
catastrophic earlier: `IRFunc::getDataType()` returns `IRFuncType`, so **role-keying is load-bearing
twice.**

⭐⭐ **TRANSFERABLE, BUT I OVERSTATED IT AND THE CORRECTION IS THE LESSON:** a *fixed delta between two
counts* refutes the rebase/race/cache family; a **constant DIFFSTAT across a head change does not** —
it is equally consistent with content edits that preserve the line total (a test rewrite, a comment
swap), and the fixer had in fact been editing test content at constant totals. **The settling check is
a tree hash or a two-head `git diff`, never the diffstat.**
⛔ **My comparison was VOID: I force-fetched the new head over the ref holding the old one, so both
names resolved to `b7aa786bd0` (identical trees `7b390e798836`) — "0 files differ" that looked clean.**
✅ **THEN I RETRACTED TOO FAR.** I said *"I could not run it"* — false **on my edge**:
`git cat-file -t 9482349972` → `commit`, so the force-fetch moved the **REF**, not the **OBJECT**, and
the old head was live all along. ⇒ ⭐⭐ **Test the object (`git cat-file -t <sha>`), never infer
unreachability from a ref you overwrote.** Same void-cell shape one layer in — and uniquely, this one
made me *withdraw a CORRECT claim*.
⛔ **SCOPE — and I initially wrote this rule as universal, which is the error it warns about.**
`cat-file -t` on the triager's clone: `b7aa786bd0` → commit, but `9482349972` / `7291d6a375` /
`5cc7bd2520` → *"not a valid object name."* **They fetched `pull/12378/head` twice, both times AFTER
the rebase, so they genuinely never held those objects.** My "you just overwrote the ref" was a fact
about *my fetch history*, not a portable diagnosis; their "blocked" was correct locally and not a void
cell. ⇒ ⭐⭐⭐ **Object availability is a property of YOUR OWN FETCH HISTORY — not of the remote, the ref
name, or a peer's clone.** ✅ **Which is why the merge-base-per-head method is the one to reach for
first: it needs NEITHER edge's object history — it asks the remote, not the local clone.**

✅ **SETTLED (triager's method, reproduced by me): DIFF EACH HEAD AGAINST ITS OWN MERGE-BASE, never
against the other head.**

| head | own merge-base | PR-relative |
|---|---|---|
| `9482349972` | `fe64ccc609` | **+564 / 16 files** |
| `b7aa786bd0` | `88fa1206d3` | **+564 / 16 files** |

Identical contribution, different base ⇒ **pure rebase.** The original inference was right; only the
instrument was void.
⛔ **Three instruments that could NOT answer it, all giving confident or unusable output:** (a) a
two-head `git diff` on a force-overwritten ref → void; (b) a **3-dot `compare/A...B` between diverged
commits MIXES BOTH SIDES** — returned `ahead 25 / behind 16, 56 files`, mostly upstream master movement,
and the triager first read that as *"the PR's own files are byte-identical"*, flatly false (tell:
`slang-diagnostics.lua +28/−0` where the PR adds **+7** — two populations in one table); (c) a per-head
**blob hash** differs under a rebase by construction, since the file also carries upstream changes.
⇒ ⭐⭐ **"What differs between two points in history" is a DIFFERENT QUESTION from "did the contribution
change."** Paired warning: **a true rule that fits the symptom doesn't feel like a guess, it feels like
expertise** — which is exactly what licenses stopping too early.
⚠️ **Print the ref before believing a count taken at it** — the triager's first position count returned
empty from a stale `FETCH_HEAD`, and *an empty result from a stale ref is indistinguishable from "the
code isn't there."* Same void-cell shape as every needle failure, relocated into a git ref.
⚠️ **One line of code, three legitimate numbers** (file 357 · `git diff` 149 · API `.patch` 145) — nine
correct figures, zero errors, the whole apparent discrepancy was **unstated provenance.**

⛔⭐⭐⭐ **`APPROVE_WITH_NITS` IS PEER-INTERNAL AND IS *NOT* A GITHUB REVIEW STATE.** The reviewer tier
reported APPROVE_WITH_NITS with 0 confirmed correctness bugs across 9 rounds; GitHub shows
**0 reviews** and `jkwak-work` has not reviewed. ⇒ **Never relay it upward as "approved"** — two
different populations (an internal verdict vs. the `reviews` array), the same wrong-population shape
that ran through this whole chain. Outstanding gates: **CI validation + jkwak-work's review**.

⛔⭐⭐⭐ **"CI IS RED" WENT STALE AND THE NEW STATE IS *WORSE*: IT NOW READS GREEN.** Measured myself on
head `9482349972`: `/status` combined **`state=success`**, while the check-run census is
**41 skipped + 4 success, 0 failures** — and the 4 are `board-sync` ×2 and `reuse-compliance-check` ×2,
**pure housekeeping. Zero builds, zero tests** (every `test-*` job is in the skipped set:
`test-windows-debug-cl-x86_64-gpu`, `test-linux-release-gcc-x86_64-rhi`, `test-compile-regression`, …).
⭐⭐⭐ **Red announces itself; a green aggregate computed from housekeeping over 41 skipped builds is
SILENT — a maintainer sees validation that does not exist.** ⇒ **Never cite the CI aggregate. Cite WHICH
checks ran** — the aggregate is a function of what was *attempted*, and "everything skipped" aggregates
to `success`. Commands (store these, not a verdict):
`gh api repos/O/R/commits/<sha>/check-runs?per_page=100 --jq '.check_runs|group_by(.conclusion)[]|"\(.[0].conclusion): \(length)"'`
then `… | select(.conclusion=="success") | .name`.
⚠️ **Both tiers repeated the stale "red" for hours — CI is the one artifact here that changes with NO
notification to either side.** I restated it minutes after applying the store-the-command rule to the
diffstat: **same rule, different noun, missed by both.**
✅ **Drafting rule that saved the public comment:** cmt `5199718759` says *"CI has validated nothing
yet"* (still true: 0 builds, 0 tests) and never says *"red"*. **A claim phrased as its CONSEQUENCE
outlives one phrased as its SYMPTOM.**

⚠️ **Compaction asymmetry, worth knowing if resuming:** the fixer's context was compacted (~868k
tokens gone) and its resume path depends on its own `memory/fix-12367.md`; the triager is insulated by
`triage-12367.md` (~1,477 lines) plus tasks #4/#5. Its post-merge queue is now **3** spin-offs:
`[DllImport]`+`hpp` SIGSEGV · the `-minimum-slang-optimization` gate question · func-typed **return
type** SIGSEGV.

**Approach: E55216 in `checkUnsupportedInst`** — not the CPP emitter. **I verified the two claims most
expensive to get wrong:**
- ✅ **Diagnostic code.** Highest at master is **55214**, so `55215` reads free *there* — but it is
  **claimed by UNLANDED PR #12249** (`slang-diagnostics.lua:5579`). #12378 correctly took **55216**
  (`:5562`). ⭐⭐⭐ **"Free at master" and "free" are DIFFERENT POPULATIONS** — a correct `git grep` on
  `origin/master` answering a subtly different question than the one that mattered. Two PRs would have
  merged the same code, colliding only *after* both landed.
- ✅ **Target scope.** `isTargetWithoutFuncTypeSupport` (`slang-ir-check-unsupported-inst.cpp:135-150`)
  = CPPSource/CPPHeader/CUDASource/CUDAHeader/PTX/ShaderSharedLibrary/ShaderHostCallable + Metal + WGPU.
  **`HostCPPSource` is ABSENT ⇒ `[DllImport]` keeps working** — the one regression risk, clear.

⚖️ **Deliberately excluded and flagged, not folded in:** `hlsl`/`glsl` (they fail *loudly* with
`E99999` — an internal error on valid input, arguably also E55216, but a larger blast radius and
outside the authorization). ⚠️ **Known limitation stated in the PR:** `checkUnsupportedInst` is skipped
under `-minimum-slang-optimization` (`slang-emit.cpp:2737`), so this closes the hole at **default
optimization levels only** — pre-existing, affects the two sibling checks too.

## RESUME TRIGGER (now)

**A review/merge on PR #12378**, or any new human comment on #12367 / #12372. Also resume if asked
"what's armed" / "what's in flight". ⛔ **Do NOT re-dispatch or nudge on silence** — the PR is a draft
awaiting a human reviewer; absence of movement is the expected state, not a stall.
**Triager's queued follow-ups (tasks #4/#5), NOT mine to do:** on merge → re-read the *merged diff* →
refresh the issue comment → `[Triage Resolution]`; then file 2 spin-offs (`[DllImport]`+`hpp` SIGSEGV;
the `-minimum-slang-optimization` gate design question).

## State (verified live 2026-08-05 ~21:00Z)

| | #12367 | #12372 |
|---|---|---|
| state | open, Type=Bug | open, Type=Bug |
| labels | `cuda`, `bug`, `reproduced`, `Office-Yong` | `reproduced` |
| assignee | `jkwak-work` — **routed by `jhelferty-nv`** @18:23:05Z, NOT self-assigned | unassigned |
| milestone | Q3 2026 (Summer) — set by `jhelferty-nv` @18:23:33Z | none |
| comments | 4 (newest is ours, `5197180868` @20:49:58Z) | 0 |

⛔ **OWNED ≠ DECIDED.** A human holds it, but the design fork has **no answer**. jkwak's words are future
tense — *"I **will** discuss with @csyonghe about **how to** schedule this"* — and the milestone
**predates his comment by 2h08m**, so it is not the product of his decision either. **Do not stand the
trigger down on the strength of the milestone.**

## THE ARMED CO-TRIGGER — exact dispatch conditions

**Fire only when** jkwak-work or csyonghe (a) answers the (a)/(b) split, or (b) says "make a PR".
**Then:** dispatch `slang-fixer` on thread `gh-issue-shader-slang/slang-12367` with:

- **Approach A only** — diagnose at emit time, preferably in `slang-ir-check-unsupported-inst.cpp`
  (already target-aware, already runs at the right point). NOT the CUDA-prelude alias (Approach B: a
  language-surface commitment that does nothing for Metal/WGSL).
- **Diagnostic must cover the FOUR silent targets:** `cuda`, `cpp` (kernel), `metal`, `wgsl`.
- ⛔ **`slang-emit-cpp.cpp:1207` covers neither Metal nor WGSL** — Metal has a *different producer* (no
  `kIROp_FuncType` case in `slang-emit-metal.cpp` at all; it falls into
  `MetalSourceEmitter::emitSimpleTypeImpl`'s op-name fallback, and the op's name is `Func`).
- **HLSL/GLSL fail BEFORE emit** (`E99999`, exit 255) — a separate, lesser fix (they misreport user input
  as an internal compiler error). **HLSL is NOT in the `:1207` list.**
- **Add kernel-target `functype` test coverage** — zero of the 11 existing `functype`/lambda tests target
  a kernel text target, which is why this survived since 2022.

**Item (b)** — that `slangc` exits 0 writing unbuildable output regardless of feature status — was raised
**once** in `5197180868` and **is not to be nagged**. If they schedule only the feature and say nothing
about (b), re-raise at most once more.

## The verdict (survived 5 rounds of instrument correction unchanged)

**REACHABLE**, reproduced end-to-end at HEAD `7175a561b` (re-confirmed at `b0e43d657`). `slangc -target
cuda` → **exit 0, no diagnostic** → emitted `Slang_FuncType<int, int>  gFn_0;` → `nvcc` *"Slang_FuncType
is not a template"*. Reachable because `specializeHigherOrderParameters` (`slang-emit.cpp:1429`, gated
only on `requiredLoweringPassSet.higherOrderFunc` at `:541-543`, so target-independent) is
**best-effort**: `slang-ir-specialize-function-call.cpp:267-268` returns `canSpecializeCall == false` on
an unsuitable arg and the call is **silently skipped, not diagnosed**. No downstream guard —
`checkUnsupportedInst`'s two `IRFuncType` mentions are both `String` checks. **Not a regression:** emit
case + host-only prelude definition landed in the same commit `65c2e7f1c` (`[DllImport]`, #2181,
2022-04-12).

**The 4/2 table is the CORRECT one.** A mid-chain "correction" to 5/1 was **wrong** and was publicly
retracted — it measured a runtime-ternary variant the issue never publishes. See
[[feedback_a_correction_must_re_measure_the_published_input]]. **#12372** = spirv-opt asserts at default
`-O` on a functype value (`ir_context.cpp:1106`), `-O0` clean — a *separate* defect, downstream of a
working emit.
