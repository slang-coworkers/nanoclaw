---
name: project-12284-cross-module-overload-silent-break-warning
description: "slang#12284 cross-module overload silent-break warning — SHIPPED 08-06 as DRAFT PR #12413 (+244, 9 files). No isFromCoreModule carve-out (measurement argued against it). OPEN: ctor T(x) gap posed to maintainer; CI all-skipping and retry-yielded-bot-ci is 5wk stale -> needs MANUAL rerun"
metadata: 
  node_type: memory
  type: project
  originSessionId: 73c43656-0b8f-4a5b-b4d5-1c374eb48e35
---

# slang#12284 — cross-module overload silent-breakage warning (**SHIPPED: draft PR #12413**)

> ⛔ **READ THE `🚀 SHIPPED` SECTION BELOW FIRST. Sections 1–4 of this file are HISTORY and several of their claims are SUPERSEDED** — notably the "**Mandatory** `isFromCoreModule` carve-out" (line ~18) which measurement **refuted**, Approach **A** (the reporter chose **B**), and the base-tree line numbers (per-site drift +67…+76; re-grep, never offset). This file is append-ordered, so a top-down reader meets the retracted version first.

**Repo:** shader-slang/slang · **Author:** skiminki-nv (MEMBER, self-filed, "Dev Opened", `Language-Maturity` family) · **HEAD:** `7c58a326b` · thread `gh-issue-shader-slang/slang-12284`

**Request:** New WARNING diagnostic. When a call needs implicit conversion and an *imported* module later adds a better-matching (e.g. exact) exported overload, overload resolution silently rebinds the call to the import — changing semantics with no diagnostic. Reporter's spec: warn when (1) candidates span >1 module AND (2) winner's module != call-site module. Reporter notes stdlib growth (`core.meta.slang`/`hlsl.meta.slang`) is technically breaking under this rule too.

**Classification:** feature-request / enhancement · medium · P2 · frontend (semantic checker — overload resolution). No dup.

**Feasibility (VERIFIED in source):** Implementable. Central constraint — `AddOverloadCandidate`→`AddOverloadCandidateInner` (slang-check-overload.cpp:2525/2442) **eagerly prunes** the beaten local candidate (`fastRemoveAt` :2465) BEFORE the winner is finalized at `CompleteOverloadCandidate` (:3744). ⟹ a naive "compare modules at decision point" hook can't see the overridden local loser; must record contributing-candidate modules AT the choke-point, before pruning. Mandatory `isFromCoreModule`/`FromCoreModuleModifier` carve-out or it fires on nearly every implicit-conversion stdlib call.
- Files: slang-check-overload.cpp:2442/2525/3744; slang-check-impl.h:384/861; slang-syntax.cpp:1246 (`getModuleDecl`); slang-diagnostics.lua (~3959). Test vehicle: `DIAGNOSTIC_TEST:SIMPLE`, 2-file module setup (patterns: tests/diagnostics/overload-ambiguous.slang).
- Recommended approach: **A** — track contributing modules through the choke-point + stdlib suppression. (B = narrower "same-module candidate overridden"; C = opt-in/off-by-default.)

**State:** TRIAGED + PARKED, no fixer. Verdict 5-bullet POSTED on issue (comment 5129359865, 2026-07-30T09:59:27Z) with two open **language-policy** design questions surfaced: (1) trigger semantics A (">1 module among candidates") vs B ("a same-module/call-site candidate was silently overridden by import"); (2) on-by-default vs opt-in flag/pragma (stdlib-noise concern). Matches skiminki-nv self-filed Language-Maturity park precedent (siblings [[project_12266_defer_bare_decl_scope_leak_crash]] etc.).

**RESUME trigger:** explicit "make a PR" / linked PR / substantive design decision from skiminki or a maintainer → dispatch slang-fixer with the chosen shape (A vs B, default-on vs opt-in). Blocker: awaiting reporter's steer on the two design questions.

## ⚡ RESUMED 2026-08-06 — park ENDED, dispatched to slang-fixer

skiminki-nv answered both policy questions and authorized implementation ([comment 5206007242](https://github.com/shader-slang/slang/issues/12284#issuecomment-5206007242), real `@nv-slangbot` mention, MEMBER):
1. Trigger semantics = **B** — *"a same-module (call-site) candidate was silently overridden by an import"* (NOT A's ">1 module among candidates")
2. Warning is **ON BY DEFAULT** (not opt-in — Approach C rejected)
3. *"Make a PR."*

⇒ Dispatched **slang-fixer** on canonical thread `gh-issue-shader-slang/slang-12284`, `<github-post-authorized />` (genuine bot mention).

**Implementation shape (B):** single bool (or call-site-module flag) on `OverloadResolveContext`, set inside `AddOverloadCandidateInner` (slang-check-overload.cpp:2442) **BEFORE the prune** (`fastRemoveAt` :2465) — recording that an applicable candidate from the call-site's own module was seen. At winner-selection (`CompleteOverloadCandidate` :3744): warn if winner's module != call-site module AND that bool is set. Cheaper than A (one bool, no `Set<ModuleDecl*>`) and matches the motivating example directly.

⚠️ **CARVE-OUT IS NOW AN OPEN QUESTION, NOT A MANDATE — do not carry it forward blindly.** The memo called `isFromCoreModule` suppression "mandatory", but that was **derived under Approach A**, where every implicit-conversion stdlib call (`lerp`, texture ops) trips a ">1 module" guard. Under **B** the guard is far tighter: a plain `lerp(x,y,t)` has **no competing candidate in the user's own module**, so B never fires there — the A-era noise argument largely evaporates. Worse, blanket core-module suppression would **silence the genuine hazard the reporter explicitly named** (a user's own overload shadowed by a `core.meta.slang`/`hlsl.meta.slang` addition). ⇒ Fixer must settle this **empirically** (build + full `slang-test`, count new warnings across `tests/`), not by inheriting the A-era conclusion.

⭐ **Lesson instance:** a constraint labeled "mandatory" is mandatory *relative to the design it was reasoned under*. When the design changes (A→B), every derived constraint needs re-derivation, not transcription. See [[feedback_mechanism_must_predict_observed_coordinates]].

**Second verified source fact (fixer, 08-06, independent re-verification at HEAD):** `CompareOverloadCandidates` (slang-check-overload.cpp:2328) returns on `conversionCostSum` **before** it ever consults `getScopeRank` (:2428) — lexical/module proximity is *only* an equal-cost tie-breaker. ⟹ the imported overload wins on **cost alone**; "but it's in my own module" is never reached. **This is why #12284 must be a DIAGNOSTIC and not a ranking change** — and it's the answer to any future reviewer asking "why not just prefer the call-site module?" (doing so would be a silent language-semantics break, far worse than the warning). Durable fact for any overload-resolution chain.

**RESUME trigger (new):** fixer reports PR opened (expect `Fixes #12284` + `report_pr_created`) → track CI/review. If fixer holds the PR as a draft, it MUST still post the 5-bullet on the issue (draft is not a public artifact).

## Build-kill @798/1452 (08-06 ~15:49) — diagnosed NOT my doing, NOT memory

Fixer's build died `ninja: build stopped: interrupted by user` with no cancel issued and no `BUILD_EXIT` marker. **I had escalated host contention and offered to reap sessions, so the first question was whether I caused it.** Measured: **NO reap happened — 96 running sessions after the kill vs 94 before (went UP)**; load 48.6 and falling.
- **Memory conclusively ruled out:** `memory.events` → `oom_kill 0` / `oom 0`; `free -m` → 119 GB available of 147 GB; **no swap**; `memory.max` = `max` (no cgroup cap). So it was **signal propagation**, not resource exhaustion.
- ⟹ Fixer's `setsid nohup` remedy (own session, sid 31577) addresses the ACTUAL cause. Work preserved — 1642 objects cached, ninja resumed at 672 remaining, ~65 min not lost.
- ⭐ **Lesson: "the box is loaded" is a tempting but non-specific explanation. `setsid` only cures signal-propagation deaths; OOM would need a memory fix and would recur silently.** Distinguishing them is two cheap reads (`memory.events`, `free -m`) and it changes which remedy is correct. Don't accept a plausible cause when the discriminating measurement is one command.
- ⭐ **Check whether YOUR OWN offered action fired before diagnosing elsewhere** — I had authorization pending to kill sessions; the session count going *up* is what exonerated me. See [[feedback_mechanism_must_predict_observed_coordinates]].

## ✅ Controls in, BUILD_EXIT=0 (08-06 ~16:22) — carve-out DECIDED: none

Positive control produced **measured** diagnostic text (`warning[E38208]`, both signatures via `ASTPrinter::getDeclSignatureString`, caret on call + on shadowed decl, cast remedy). Three negative controls all silent:
- **(a) no local competitor (= the stdlib case in miniature): SILENT, and verified NON-VACUOUSLY** — fixer confirmed the generated HLSL really calls the import (`val_0 * 42U`), so (a) did resolve cross-module and still didn't warn. Then the genuine article: `lerp(int,float,float)` + `sqrt(int)` + `max(int,float)` → **0 occurrences of 38208**.
- (b) local candidate wins: silent. (c) both overloads in one file: silent.

⇒ **DECISION: NO `isFromCoreModule` carve-out.** Approach B is quiet on stdlib calls *by construction* — the predicate requires a competitor in the user's own module. The A-era "mandatory" carve-out is confirmed **not** applicable to B, as suspected at dispatch. ⭐ This is the payoff for refusing to transcribe a constraint across a design change.

⭐⭐ **Control (a) was decisive where the aggregate count could only corroborate** — it discriminates in BOTH directions (silent ⇒ no carve-out needed; fires ⇒ predicate is broken and a carve-out would HIDE a defect that also misfires on ordinary user imports). **Design at least one control that can refute, not just agree.**

⚠️ **`DIAGNOSTIC_TEST` annotation trap (fixer, measured):** it wants **position-based carets, ONE annotation per diagnostic**. Extra `warning`/`E38208` caret lines **consumed both diagnostics** ("already matched"), starving the message lines — two failed attempts before taking the harness's own suggested annotations. ⇒ Let the harness emit the annotations; don't hand-write them.

## ⛔ MUST-FIX from codex critique (08-06 ~17:19) — the ctor path escaped the fix entirely

**A whole class of the reported hazard was not covered**, and no control in the plan could have found it.

`T(x)` — a **single-argument constructor call** — never reaches the report site. `ResolveInvoke` intercepts it early (`slang-check-overload.cpp:3500-3528`) and routes it to **`_coerce`, which runs its OWN overload resolution** over the target type's initializers and returns *before* the unique-winner path that was hooked. Reproduced (not inferred): imported `extension Box { __init(uint) }` vs local `extension Box { __init(int) }`, call `Box(tid.x)` → generated HLSL shows the **imported** ctor won (`Box_x24init_0(uint u_0)`), exit 0, **zero warnings**. Exactly the issue's hazard, via constructors instead of named calls.

Fixed by reporting at `_coerce`'s applicable-unique-winner path, **gated on `outToExpr`** so speculative cost queries stay silent (`_coerce` is called constantly to *price* conversions without reifying them — ungated, this would fire on non-calls). Plus regression pair `overload-import-overrides-local-ctor{,-helper}.slang`.

### ⭐⭐⭐ Why every control missed it — the lesson

**All three negative controls were named-function calls.** The gap lay **outside the space that was sampled**, so no amount of rigour *within* that space could reach it. ⇒ **A control set proves things only about the input space it spans; its silence about an unsampled class is not evidence.** Ask explicitly: *which syntactic/semantic forms reach this code path at all?* — then sample each. Compare [[feedback_published_negative_env_claims_need_rederivation]] (a negative with no failure signature).

⚠️ **This retroactively qualifies my own endorsement.** I called the "report at `ResolveInvoke`, deliberately not `CompleteOverloadCandidate`" reasoning *"a real correctness argument"* — it **was** correct about `CompleteOverloadCandidate`, and still left `_coerce`'s independent resolution unhooked. ⇒ ⭐⭐ **A correct argument for rejecting site B is not an argument that site A is complete.** Enumerate every site that performs the operation; "not-B" reasoning silently implies a two-site world.

⭐ **Codex earned its keep**: a reviewer reading only the diff would have no reason to suspect the ctor path. Independent-critique value is highest for *absent* code — what the diff does not touch — which is exactly what self-review and diff-scoped review both miss.

⚠️ Second codex finding, also taken: a comment claimed the common case "reduces to a comparison, without walking any parent chains" — **false**; until a local candidate is found, every applicable candidate walked both the scope and decl-parent chains, so an imports-only overload set paid it per candidate. Fixer fixed the **cost** rather than deleting the inaccurate comment: call-site `ModuleDecl` now resolved **once per resolution**, cached on `OverloadResolveContext` with an explicit `Resolved` flag so a genuine null is distinguishable from "not yet looked up". ⭐ **When a comment is found inaccurate, ask whether the comment or the code is wrong — deleting the comment can silently ratify a real defect.**

## 🚀 SHIPPED 2026-08-06 23:33Z — draft PR #12413 (VERIFIED independently)

**https://github.com/shader-slang/slang/pull/12413** · branch `fix/issue-12284` @ `2645bb88c9` · **9 files, +244** · label `pr: non-breaking` · `Fixes #12284` · **state: OPEN, DRAFT** · assignee/requested-reviewer `skiminki-nv` (set by board sync, not by the fixer).
- ✅ Verified by me on GitHub: PR body carries the full 5-part format; **issue 5-bullet posted** as comment `5209974618` (required — a draft PR does NOT auto-close the issue, so the issue needs its own public footprint).
- Local: `tests/bugs` 644/0, `tests/diagnostics` 729/0; 3 regression tests each verified to **FAIL on a preserved fix-absent binary**.

**Final shape:** new `E38208` (untagged ⇒ always-emitted `default` group). Two helpers straddling the pruning boundary — `noteCandidateFromCallSiteModule` records the **best** same-module applicable candidate *before* pruning; `maybeDiagnoseImportedOverloadOverridingLocalCandidate` reports at winner selection. **NO `isFromCoreModule` carve-out** — measurement argued *against* it (a user's own `int max(int,int)` losing to core's **does** warn, the issue's own motivating case).

### ⭐⭐ Two defects codex found AFTER the first push — both would have shipped
1. **`conversionCostSum` is an AGGREGATE.** 100 args × 900 (`GeneralConversion`) = exactly 90000 = `kConversionCost_Explicit` ⇒ the guard went **silent on precisely the calls the warning exists for**. Fixed with a **per-argument maximum** (`OverloadCandidate::maxArgConversionCost`). ⭐ A threshold on a *sum* is not a threshold on an *element* — check which one your semantics require.
2. **The diagnostic named the WRONG local overload.** Local `f(float)`+`f(int)`, imported `f(half)` → it named `f(int)`, but removing the import resolves to `f(float)`. It pointed users at a function their code never called, and the suggested cast wouldn't preserve behaviour. Fixed by ranking with `CompareOverloadCandidates`.
⇒ Each now has a test that fails on a binary carrying the **old bug**, not merely one lacking the feature. ⭐ **Independent critique's value is highest for code that is *absent or subtly wrong*, not code that is missing** — a reviewer reading only the diff had no reason to suspect either.

## 📝 REVISED 2026-08-07 01:06Z → `ecdce0f642` (VERIFIED: 11 files, +295/−0, still draft)

Four peer-review findings absorbed, **all reproduced by the fixer independently before acceptance**, plus a reviewer-authored **negative test** (asserts silence; passes on *both* binaries — correct, since its value is the **liveness** property, not a fix-absent failure). `tests/bugs` 644/0, `tests/diagnostics` 730/0.

**Four gaps now disclosed** (was one). Two arguably fall *inside* the reporter's stated trigger ⇒ scope questions for a maintainer, not defects:
- **D1** warning can accompany a **failed compile** — l-value validation lives in `ResolveInvoke`'s **caller** (`slang-check-expr.cpp:4235` → `:4395` `ArgumentExpectedLvalue`).
- **D2** explicit **generic application** uncovered (`slang-check-overload.cpp:4047` has no emit call).
- **D3** fires for calls in **never-executed code** (bodies are checked eagerly).
- **D4** single-arg ctor `T(x)` (the temp-sink gap). *(`diagnoseOnce` probe suppression downgraded to a latent infrastructure observation, not a finding against this PR.)*

### ⚠️⭐⭐⭐ THE REVIEW'S EVIDENCE BASE DEGRADED — read the eventual report against it

**Three of four reviewer instruments failed or degraded:** Devin timed out at 30m · Reviewer C died on an upstream stall (recovered from its stream) · Reviewer A failed twice, on a third attempt. ⇒ **A merge report that reads cleaner than its evidence is the failure mode.** The reviewer will state *"Reviewer A: no correctness signal"* explicitly if A3 dies — the right call, and the general rule: ⭐⭐⭐ **an absent reviewer contributes SILENCE, NOT APPROVAL.** A missing signal must appear in the report as missing, or a reader scores it as a pass. Same class as every failure-indistinguishable-from-negative-result on this chain.

### ⭐⭐ Stale prose is the chain's dominant defect generator — 4 instances, one mechanism
`+263`→`+244`→**`9 files/+244`→`11 files/+295`** in a *live issue comment*; "CI is running" 58s after it finished; a rationale fixed in one location and left wrong in two; a reviewer-dispatch template describing a **deleted** test and a **reverted** hook. ⇒ **A measured number outlives the artifact it described, and editing prose has no failing test** — so the drift is invisible unless something external re-reads it against the artifact. ⭐ Fixer's remedy that worked: **re-check the PUBLISHED copy after patching, never the local file.** Also caught pre-publish by codex: *"the call becomes an error expression afterwards"* is false (`CheckInvokeExprWithCheckedOperands` returns it unchanged at `:4481`; the *diagnostic* fails the build) — a wrong mechanism claim, nearly shipped in a PR body.

**Seven corrections on this chain, every one caught by measurement rather than argument** (mine: the CI workflow-name error; fixer's: aggregate-cost, first-vs-best candidate, seven-check scope, stale counts; reviewer's: over-general loc-0, a D3 probe whose zero came from a predicate that couldn't fire, an overstated D2 pair). ⇒ **The findings that survive mutual re-measurement are worth more than the ones anybody started with.**

### ⛔ OPEN — neither is the fixer's to close
1. **Single-arg ctor `T(x)` NOT covered** — posed as an explicit either/or checklist on the issue for skiminki/maintainer. Mechanism: `ResolveInvoke` routes it through `_coerce` under a **temporary** `DiagnosticSink` (`:3510`, `withSink` `:3523`), returns on success at `:3540` **without draining**, and the only drain is **triple-gated** (`IsErrorExpr` `:3861` · `getErrorCount()` `:3864` · re-emits as `Severity::Error` `:3869`). A warning is discarded on all three counts. Fixing means changing when that sink flushes ⇒ alters error reporting for **every** single-arg ctor call.
2. **CI has produced no signal yet** — `gh pr checks 12413`: all 36 checks `skipping`, zero builds/tests ran (run yielded to in-flight human CI).
   ⛔ **MY "retry worker is 5 weeks stale" CLAIM WAS WRONG — RETRACTED, and I had escalated it to the operator.** The live worker is **`ci-retry-yielded-bot.yml`** ("CI Retry Yielded Bot") — **5 successes on 08-06/07, most recent 00:12:59Z**, firing every few minutes. My query named `retry-yielded-bot-ci.yml`, which resolves to a **different, RETIRED** workflow ("Retry Yielded Bot CI" — words transposed) whose last run really was 2026-06-30.
   ⭐⭐⭐ **BOTH NAMES EXIST, so `gh` returned a clean non-empty result set with NO error.** "Last success 5 weeks ago" and "I queried a retired near-homonym" are **indistinguishable from the output**. ⇒ **A `--workflow <name>` filter that names the wrong workflow does not fail — it succeeds against something else.** Resolve the name against `ls .github/workflows/` first. Same family as `grep -c` blind to virtual dispatch, a log omitting passing tests, a `pgrep` matching its own probe: **right pattern, uncharacterized population.**
   ⚠️ Also the **direction** matters and is why the fixer checked instead of editing: asserting a live automated path makes a human **not intervene**, and non-intervention leaves no trace ([[feedback_published_negative_env_claims_need_rederivation]]).
   ⛔ **AND THE "RESIDUAL RISK" I RELAYED WAS ALSO WRONG — retracted 08-07.** I told the operator that if CI stayed saturated past the **16h lookback** the run could age out unrerun. `.github/workflows/ci-retry-yielded-bot.yml:46-49` says the opposite, in its own comment: *"`--lookback-hours (16)` must stay above `wait-for-priority.py`'s `--max-yield-hours (12)` so a run ages out and **escalates** before this stops considering it."* **The ordering is deliberate and constructed to prevent exactly that gap.**
   ⭐⭐⭐ **I inferred a defect from two constants without reading the intent that relates them.** Two numbers in a suspicious relationship is not a bug — it is a *question*, and the authors had already answered it **in a comment four lines above the flag**. ⇒ **Before asserting a defect in someone else's config, read the comment adjacent to the constants.** Both of my CI claims (dead worker, then lookback gap) were wrong, and both were about *someone else's code* — the class where I have least context and most confidence.
   ✅ **Measured decision line (02:45:48): `CI is still active (4 run(s)); not rerunning bot CI.`** — worker live, evaluating this run, correctly deferring to 4 in-flight human runs (`#30024` zangold-nv, `#30022` jhelferty-nv). **Working as designed; no intervention.**
   ⚠️ **Log-reading trap, 3rd instance:** the workflow **echoes its own comment block** before executing, so `grep -i lookback` returns *workflow source*, not the decision — 5 lines of echoed comment, 0 lines of verdict. Exclude the `^[[36;1m` escape-coloured lines. Same shape as the log echoing an annotation and the `yielded=false` script echo. ⇒ **A log contains the program's TEXT as well as its OUTPUT.**

**RESUME TRIGGER:** (a) skiminki/maintainer answers the ctor either/or → act on it; (b) `slang-reviewer` returns its verdict; (c) **CI still shows all-`skipping` on next check → manual rerun required** (`gh run rerun` / push an empty commit), do not wait on the retry workflow. See [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]].

## ✅ BASELINE ARM COMPLETE (08-06 18:41) — terminal figures, and the mid-flight estimate was 2× wrong

```
BASELINE_SUITE_EXIT=1
marks=39 (failed(pending retry)) · confirmed=25 FAILED · recovered=14 · pending=0 ✅ (25+14==39)
warning[E38208] = 0  ✅ by construction — the code is not in this binary
```

⭐⭐⭐ **The publishable figure is `14 of 39 recovered`. Mid-flight I told the fixer to publish `30` — derived as `39 − 9` while retries were STILL RUNNING.** I treated "not yet observed as failing" as "observed as passing," collapsing a **three**-state population (confirmed / recovered / **pending**) into two. Confirmed drifted `9 → 12 → 14 → 15 → 16 → 17 → 18 → 20 → 22 → 25`. The early subtraction **overstated recovery by 2×**, i.e. understated the pre-existing failure count — the direction that would have made the delta look cleaner than it was. **Only the terminal state was reportable.** Retracted before it shipped; the fixer had wisely left it as a `<<placeholder>>`.

⇒ **Assert `pending == 0` before computing any figure from a running process, and report the sum-check (`25+14==39`), not the difference.** A subtraction hides the third state; an explicit sum cannot.

## ⭐⭐ Cache-scope gap: BOTH of us stopped one level short of the same fact

`_coerce` caches conversions (`ImplicitCastMethodKey` = `(fromType,isLValue,toType,constantVal,isConstant)` — **no module, no call site**, `slang-check-impl.h:807-844`); on a cache hit the recording hook is skipped, so the warning fires once per conversion shape rather than per call site.

- **I inferred a compile-wide cache** from the module-free key + the type being *named* `SharedSemanticsContext` ⇒ predicted "module P's entry silences module Q", i.e. compilation-order-dependent warnings. **Wrong.**
- **The fixer asserted "one per module"** from the struct + field, also without reading the construction site.
- **Neither opened the constructor.** `slang-check.cpp:184` `checkTranslationUnit` builds it as a **stack local bound to `translationUnit->getModule()`** (`:187`) ⇒ destroyed per TU, cross-module leak **structurally impossible**. (Long-lived `Linkage::m_semanticsForReflection`, `slang-session.cpp:84`, is the reflection context with `module=nullptr` — not the checking path.) One `grep` for the ctor settled it.

⭐⭐⭐ **A type's NAME is not its LIFETIME** — same class as inferring suppression from name resolution ([[feedback_a_correction_without_a_coordinate_does_not_stick]]: verify the consumer, not the declaration). For a cache, the **construction site** is the only thing that establishes scope.
⭐⭐⭐ **"A correct mechanism plus an unmeasured blast radius still yields the wrong remedy"** (fixer's formulation). Mechanism was verified in source; *impact* was wrong for want of the lifetime. Both of the fixer's reverted attempts would have added machinery — one **reconstructing discarded state** (the methodology's "context rediscovery by graph walking") — **to emit MORE duplicate warnings.** A fix that reads as diligent while degrading the output.
⭐⭐ **Two failed fix attempts ⇒ stop and re-derive, don't try a third.** ⭐⭐ **A reviewer's hedge about a mechanism ("care around cached conversions") is an unexplored lead, not a caution** — codex flagged exactly this and it was under-read.

⇒ Resolution: **ship as-is**, stated *positively* (per-conversion-shape de-duplication within a module, consistent with `diagnoseOnce`) — not as a caveat, which would invite a reviewer to "fix" it. Per-TU construction site cited in the PR so the no-leak claim is checkable.

**Scope note for PR review:** issue *body* would also cover import-vs-import shadowing; skiminki's chosen wording narrows the loser to the **call site's own module**. Fixer implements the narrower chosen rule and will state so explicitly, so a reviewer diffing against the body doesn't read it as an oversight. Correct call.
