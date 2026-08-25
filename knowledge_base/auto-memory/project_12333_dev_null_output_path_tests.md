---
name: project_12333_dev_null_output_path_tests
description: "#12333 `-o /dev/null` → draft PR #12334 APPROVE_WITH_NITS (tests-only). ⚠️the 'Windows-only' premise is FALSE: binary targets fail on Linux too (getPathType rejects char devices) ⇒ jkwak-asked guard must be all-platforms. My 'drop -o' idea was RETRACTED."
metadata:
  type: project
  originSessionId: 6cb5ba36-0d3a-4bd6-a56f-0e0eb4c9f5b1
---

> ⚠️ **CONTROLLING STATE — READ THIS BLOCK FIRST. Everything below is chronological history and earlier entries ARE SUPERSEDED.** (This file is **45.6KB against a 24.4KB Read limit**, so an append-only read truncates the NEWEST, most authoritative content. Same hazard as [[project_12185_bindless_texture_nv_desc_handle_nonimage]]; cf. [[project_memory_files_over_read_limit_backlog]].)
>
> **As of 2026-08-24 — jkwak REVERSED DIRECTION for the THIRD time. #12414 CLOSED unmerged. New PR (#3) dispatched: make slang-test REJECT absolute `-o` paths.**
> - **NEW ASK (`5400453274`, 08-24 19:46Z):** *"the real problem is … test cases using absolute path for `-o` … slang-test must fail if the test uses an absolute path … Please create a new PR that prints an error … investigate if there are other cases we should disallow."* This is the **producer-side guard the ORIGINAL #12333 body floated and deferred** ("needs a decision on which spellings to cover") — jkwak has now made that decision. **Fixer DISPATCHED 08-24.**
> - **#12414 CLOSED unmerged** by jkwak 19:44:32Z, comment *"Closing as the direction of the solution changed"* — 2 min before the new ask. ⇒ the `st_rdev` FileStream fix is **abandoned, not landed**; do NOT resurrect it. ⭐**A maintainer reframing 3× (Windows-map → all-platform accept → test-time reject) is NORMAL exploration; each reframe SUPERSEDES, it does not stack.** Drive the latest, archive the rest.
> - **#12334** test cleanup — draft `1fc6f14e9f`, `APPROVE_WITH_NITS`, still OPEN, still `behind`. ⛔ its 30-job CI green is on the PRIOR head `d57ab26dbb` only. ⚠️**Interaction: the new guard would REJECT #12334's own tests if they still used absolute `-o` — but #12334 already switched them to `-o -` (relative/stdout), so it's compatible.** Confirm before the guard lands.
> - **Blast radius MINE-VERIFIED small:** `search/code path:tests "-o /"` = **3**, the same three `/dev/null` lines — all already fixed to `-o -` in #12334. So the guard breaks ~0 live tests once #12334 lands (order matters: guard after, or land together).
> - **Implementation site MINE-VERIFIED:** `tools/slang-test/test-output-path-util.{cpp,h}` already exists and already post-processes `-o` (called `normalizeTestOutputPathsForTestFile` at `slang-test-main.cpp:745,776`), with a unit-test file `tools/slang-unit-test/unit-test-slang-test-output-path.cpp` to extend. **`Path::isAbsolute` exists** (`slang-io.h:203-204`). ⇒ well-scoped, has a home, has a predicate.
> - ⛔**The issue's "Windows-only" premise was FALSE** (binary targets fail on Linux too; text targets *bypass* the check via bare `fopen_s`). The abandoned #12414 established that; the new guard sidesteps it entirely by acting at test-parse time, before any `fopen`.
> - **5 same-shape errors of mine on this chain** (set-member→set · necessary→sufficient · arm-reachable→reached · matches→files · line-changed→line-reached). My one-line #12414 fix was a **no-op**; two fixer attempts were **worse than the bug** (FIFO hangs; `/dev/full` silent-success).
> - ⭐⭐⭐**Top transferable lessons:** a maintainer reframe supersedes, never stacks · a test matrix derived from the fix's own story omits the cases that refute it · name the safe member, don't accept the type class · a run id's `conclusion` mutates in place across attempts · a stale *pessimistic* CI claim never gets re-checked · silence that invites a wrong inference is itself a defect.

**shader-slang/slang#12333** — "Tests using `-o /dev/null` are invalid on Windows and can pass on a failing compile". Filed **2026-08-03 18:54:18Z by `nv-slang-bot[bot]`** (slang-fixer, session `sess-1783026484565-avmy9m`, thread `gh-issue-shader-slang/slang-11917`). **No labels, no assignee, 0 comments.** Canonical thread `gh-issue-shader-slang/slang-12333`.

## Why this is NOT a zero-dispatch own-bot echo

Superficially the same shape as [[project_12320_coverage_macos_segfault_base_rate]] / [[project_12321_bfloat16_vector_vulkan_wrong_lanes]] (bot-filed → `issue_opened` webhook → echo of our own artifact). **Two properties break the analogy, and either alone is decisive:**

1. **A maintainer explicitly commissioned it.** `pdeayton-nv` on PR #12281, comment **2026-08-03T18:47:26Z**: *"@nv-slang-bot, please file a new issue for the general /dev/null cleanup. Also, please rebase to ToT and then I'll mark the PR as ready for review."* The issue is a **requested deliverable**, not a spontaneous bot filing. ⭐**Provenance of an echo matters: "bot-authored" describes the typist, not the originator.** Check whether a human asked for it before applying the echo rule.
2. **It is entirely within bot push capability** — 3 files, all under `tests/`. No `.github/workflows/` ⇒ [[project_bot_workflows_permission]] does not bite; no actions-write; no GPU/driver dependence. #12320 and #12321 were parked because their next steps were *structurally* out of reach. This one's aren't.

⇒ **Disposition: fixer DISPATCHED** on canonical thread, drafts-only. Not parked.

## Main-verified receipts (2026-08-03, `gh api`; credential injection confirmed on `repos/shader-slang/slang` = `X-Ratelimit-Limit: 6000`)

- **Sweep count is TRUE.** `search/code q='repo:shader-slang/slang path:tests "/dev/null"'` → **`total_count: 3`**, exactly the three named files. `path:tests "-o NUL"` → **0** ⇒ no Windows-spelling variant hiding elsewhere. The issue's "a sweep of tests/ finds three" is not an under-count.
- **Provenance claim is TRUE and correctly scoped.** #12306 (`dev/slang-fixer/slang-11135-align-attr`, merged 2026-08-01T02:31:31Z) file list contains **both** `tests/reflection/ir-type-alignment-attr.slang` and `...-existential.slang`. The third, `tests/autodiff/func-extension/subscript-accessor.slang`, is from **#12031 `77f5ca0918` 2026-07-14, author `kaizhangNV` (human)** — sole commit touching that file. The issue says "two of the three came from #12306" and does not claim the third ⇒ accurate.
- **The `result code = N` mechanism is REAL.** `tools/slang-test/slang-test-main.cpp` — `actualOutputBuilder.append("result code = ")` at **:1876**, **:3754**, `outputBuilder` at **:3839**; format comment at **:860** (`"result code = X\nstandard error = {...}"`). So a `// PREFIX: result code = 0` line does pin exit status through the FileCheck buffer, as the issue asserts.
- **Reference implementation already exists and is maintainer-blessed**, in the very PR that spawned this: `tests/legalization/empty-type-legalize-array-of-void.slang` @ `8aee09a001`→`d2621e72cd` uses `-target cpp -o - -dump-ir-before/-after` plus `// IR: result code = 0` and an explicit comment explaining why stdout beats a null device. Pattern to copy.

## ⚠️ The fix as suggested has an UNVERIFIED leg — `spirv-asm -o -` has zero precedent

Only **2** tests in the repo use `-o -` at all: `tests/diagnostics/command-line/separate-debug-info-stdout.slang` and `tests/spirv/cmd-arg-debug-info.slang`. `search/code "spirv-asm -o -"` → **`total_count: 0`**. The blessed reference uses `-target cpp`, **not** `spirv-asm`. So "replace with `-o -`" is plausible but **untested for this target**, and I hold **no slang clone and cannot build** ⇒ I must not assert it works. Two concrete risks for the fixer to settle empirically:

- Does `-target spirv-asm -o -` write asm to stdout at all, or reject `-`?
- With `-o /dev/null` the asm was **discarded**; with `-o -` it **enters the FileCheck buffer**. That could perturb the existing assertions — `subscript-accessor.slang` has `DEBUG-NEXT` chains; `ir-type-alignment-attr.slang` has `//CHECK-NOT: TypeAlignment(1 : Int)` (whole-file scope); `...-existential.slang` pins operand **order** via `CHECK:` + captured `CHECK-DAG:`.

**⭐ Option B, likely simpler and named to the fixer: drop `-o` entirely.** #12281's own comment says `-o -` was needed there *because* "the `export` function has no entry point of its own" — output had to be requested for the backend pipeline to run. **All three tests here DO have entry points** (`-entry computeMain -stage compute`, `-entry main -stage compute`), so codegen runs regardless and no output path may be needed at all. That avoids the unverified `spirv-asm -o -` path completely. Fixer picks whichever it can verify.

## Scope guardrails handed to the fixer

- The issue's own "harder guard" idea (make `slang-test` reject null-device paths in `-o`) is **explicitly out of scope** — the issue itself says it "needs a decision on which spellings to cover" = a maintainer call. Do not build it.
- Likewise the "pin `result code = 0` on all `-dump-ir*` tests as a matter of course" generalization — the issue already warns it must not be blanket (diagnostic/expected-failure tests legitimately assert non-zero). Three files only.
- ⚠️ The issue states the tests "still report **passed**" on Windows as fact for **all three**. pdeayton observed that for **#12281's** test only; for these three it is **inferred by pattern, not run**. Fixer verifies per-test rather than inheriting the claim.

## Companion directive — the OTHER half of pdeayton's ask (VERIFIED DONE, no action)

Same 18:47Z comment asked for a **rebase of #12281 to ToT**. Main verified it landed without needing a nudge: `fix/issue-11917-batch3` head moved `8aee09a001` → **`d2621e72cd`** (pushed 18:48:39Z); `compare/74c724aecc...d2621e72cd` = **`ahead_by 8, behind_by 0`** (was `behind_by 22, status diverged` at `8aee09a001`); PR `base_sha` now `74c724aecc` = master head. Still `draft: true` — correct, pdeayton flips it ready himself. See [[project_11917_pass_gating_epic]].

## ✅ FIXED — draft PR #12334, and the fixer CORRECTED BOTH of my dispatch's technical premises

**PR #12334** "Replace `-o /dev/null` in tests with `-o -` and pin the exit status", opened 2026-08-03T20:02:28Z by `nv-slang-bot[bot]`, **draft**, head `25921d9ca6`, **3 files +16/−3, tests only**. Main-verified: `/dev/null` count on the branch = **0/0/0** in all three files. GitHub footprint discharged — 5-bullet on #12333 = comment **`5171129731`** (20:03:28Z), and it correctly self-labels *"triaged → fix in draft PR #12334, held pending review"*.

**⭐⭐ MY OPTION B WAS WRONG, AND THE ISSUE'S OWN SUGGESTED FIX WAS ALSO WRONG. Both my errors, caught by the fixer empirically:**

1. **"Drop `-o` entirely" (MY suggestion) is NOT equivalent to `-o -`** — it silently flips the compile to **`-whole-program`**. **Main-confirmed at source**, `source/slang/slang-options.cpp:4719-4760`: when `rawOutput.entryPointIndex == -1` the switch sets `rawOutput.isWholeProgram = true` for a long target list, and for `SPIRV`/`SPIRVAssembly` (**our target**) it sets it whenever `shouldEmitSPIRVDirectly()`. So removing `-o` changes *what gets compiled*, not just where it goes. My reasoning ("all three have entry points, so codegen runs regardless") was **true but irrelevant** — I checked that codegen would *run*, never that the compilation *mode* would be preserved. ⭐**Same shape as the #12192 error: every premise true, the inference false — I verified a necessary condition and treated it as sufficient.**
2. **The issue's own `// DEBUG: result code = 0` is INERT on the `-g` test** — under `-g` the dumped `DebugSource` embeds *this file's own source text*, so the CHECK pattern matches **its own comment line** and passes even at exit 255. Fix is `// DEBUG: result code = {{0}}`. This is the [[slang-evidence-lessons-index]] **instrument-inside-the-phenomenon** class: the assertion is embedded in the artifact it asserts over. Note the two reflection tests have no `-g` ⇒ plain `//CHECK: result code = 0` is correct *there*; the diff applies each form to the right file, and the PR comments explain why.

**Verification the fixer supplied that I'd asked for and did not have to be reminded of:** the "still reports passed" claim was **confirmed per-test rather than inherited** (unwritable output path on Linux → `E00004`, exit 255, IR still dumped, all 3 report `passed`), and each new assertion carries an **individual negative control** (forced failing compile ⇒ all 3 FAIL). FileCheck itself was proven live first via a deliberately broken assertion. That is the right instrument discipline — a green assertion with no negative control would have been exactly the inert-`result code = 0` defect all over again.

## ⚠️ CI on #12334 — and a self-caught measurement error

Benign draft priority-yield, as the fixer said. **But my first read was wrong and I nearly relayed it:** single-page `check-runs` reported `{failure:1, skipped:29}` while the same response's `total_count` was **81**. Paginated (`--paginate ... per_page=100`) ⇒ **81 rows = 2 failure + 75 skipped + 4 success**, reconciling exactly. Failures are **`check-ci` + `wait-for-human-priority`** only; the 4 successes are `filter`, `board-sync`, `reuse-compliance-check`×2. **Zero build jobs ran** (all skipped) ⇒ no code signal either way; `retry-yielded-bot-ci` handles it. ⭐**This is the `total_count > len(check_runs)` short-count from [[project_approver_pipeline_defects_devin_fetch_ci_green]] firing on me the very next day** — the defect is in my *habit*, not in one script. Print both numbers and reconcile, every time; it is free.

**Base drift (minor, no action):** `mergeable_state=behind`, `ahead 1 / behind 1` — master moved to `5b3f7a2430` (#12332, "Replace native assert with SLANG_ASSERT … in `source/` and `tools/`") 19:42:18Z, ~15s before the branch commit. Source-only, cannot interact with three `tests/*.slang` files. Not worth a rebase ask on a draft.

**Attribution verified (fixer's FYI was accurate):** `assigned`/`review_requested` on #12334 were all done **by `jhelferty-nv`** at 20:02:46–47Z → `kaizhangNV` (author of #12031, which contributed the autodiff test) + `tangent-vector`. Not bot-initiated ⇒ correctly left untouched per the no-pre-request rule.

## ✅ REVIEW COMPLETE 08-03 21:05Z — `APPROVE_WITH_NITS`, **0 bugs, 4 gaps**

`slang-reviewer` A(correctness)+B(Devin)+C(clarity)+D(own empirical). `diff_hash` `a61c78dde44a786e…`, head `25921d9ca6de`. Report: `/workspace/inbox/a2a-1785791129887-f7oda8/combined-review-12334.md` (**51KB / 803 ln — over the Read limit, section-read via `grep -n '^#'` map**). Devin: 0 bugs / 0 flags / 0 informational.

**Reviewer D independently re-derived the two departures by a DIFFERENT INSTRUMENT than the fixer's (hand-built FileCheck buffers, no harness) — so the conclusion doesn't rest on the fixer's harness:**
- `{{0}}` is load-bearing: forced-255 buffer ⇒ shipped `{{0}}` = **0 hits** (fails, live); counterfactual plain `0` = **84 hits** (passes ⇒ **inert**). `-g` embeds the file's whole source **83×**.
- Reflection tests (no `-g`): forced-255 = 0 hits, healthy = 1 ⇒ plain literal genuinely discriminates. **Per-file form is correct, not uniform-by-accident.**
- `-o -` preserves the baseline: IR dump **byte-identical** old→new on all 3; only delta = asm now on stdout. No literal file named `-`.
- No perturbation: 0 hits of `TypeAlignment`/`size(` in new stdout; `DEBUG-NEXT` pairs anchored to IR-dump syntax and stderr precedes stdout in the buffer.

## ⭐⭐⭐ MY "drop `-o` ⇒ `-whole-program`" CLAIM WAS OVERSTATED — and I had relayed it as MINE-CONFIRMED to two coworkers

Reviewer D measured it: with `-entry` present, `-o -` vs no `-o` ⇒ **byte-identical SPIR-V asm, exactly one `OpEntryPoint`**. The flip is **inert for these three tests except inside the `-g`-embedded command-line string** (one fold-line difference). Genuine whole-program behaviour needs `-entry` **absent** (then 2 `OpEntryPoint`s).

**MINE-VERIFIED at source — the reviewer's causal chain is exactly right:** `slang-options.cpp:4626-4632` binds `entryPointIndex = 0` onto **every existing** `rawOutput` when there's one entry point; the auto-add block at **:4646** is gated on **`m_rawOutputs.getCount() == 0`**, so with any `-o` present it never fires; only an auto-added output carries `entryPointIndex == -1` and can reach the `SPIRVAssembly` + `shouldEmitSPIRVDirectly()` ⇒ `isWholeProgram = true` arm at **:4753-4758**.

⭐⭐**So my error was NOT the code reading — `:4719-4760` says what I said it says. The error was the SCOPE I attached to it: I read a reachable arm and asserted it WOULD be reached, without checking the guard that decides whether these particular invocations reach it.** Verdict unchanged (`-o -` is still right, and it's the option provably byte-identical to baseline), but the *stated reason* overstates the effect. ⭐**This is the third consecutive instance of one shape in this chain** — #12192 (verified one set member, generalized), my option B (necessary≠sufficient), and now this (arm reachable ≠ arm reached). ⚠️**And I propagated it**: it went to the fixer in my dispatch, into the PR body, and to the reviewer as "MINE-CONFIRMED @slang-options.cpp:4719-4760". ⇒ **a file:line citation authenticates the LOCATION, never the SCOPE of the claim built on it.**

## 4 gaps — all 🟡, non-blocking (0 bugs ⇒ not REQUEST_CHANGES)

1. ⭐**HIGHEST VALUE — the convention regenerates itself away.** ✅**COUNT RESOLVED — cite `786 files (grep -rl) / 828 occurrence-lines (grep -r)` under **`docs/generated/tests`** at `5b3f7a24`, never my "932", and never the `docs/` pair.** ⚠️my first citation **mixed scopes** (786 is `docs/generated/tests`, 833 is `docs/`) — reviewer caught it pre-send; `docs/` also carries 2 false positives (`build_toc.sh`, `scripts/release-note.sh` = ordinary shell redirection). `docs/generated/tests` is both the scope my query used and the corpus nightly runs. ⚠️**my 786 is a FLOOR** (both paginated sweeps rate-limit-truncated) ⇒ the reviewer's `grep -rl` is the count, mine a consistent floor; **do not repeat their "two instruments reached 786 independently" framing.** ✅**FINAL — cite by CLAIM (settled with fixer 21:29Z): `786 files / 828 lines` = how widespread the spelling is · `770/771` = `//TEST:` directives carrying the defect · ⭐`755` = EXECUTED `.slang` tests that could silently pass — the number Gap 1 actually needs, and 0 of them pin a result code.** Arithmetic ties (`828−771=57` prose lines; 771>770 because one `_prompt.md` has two directives; `770−755=15` are `.md` prompts, not tests); fixer's set is a strict subset of the reviewer's. ⭐**Nobody was wrong — three nested metrics compared as if they answered one question. Name the claim before quoting a number.** ⚠️I could not corroborate 770/755 myself: `search/code` can't express "directive lines" (adding `"TEST"` left `total_count` at 932; `"-o /dev/null"` = 906), though a `ZZZ` control ⇒ 0 proves terms apply ⇒ ⭐**a discriminating control proves the instrument WORKS, not that it answers YOUR question.** `search/code`'s `total_count` counts **MATCHES, not files**; paginating the identical query ⇒ **786 distinct paths**, exactly matching the reviewer's independent `grep -rl`. ⚠️their stale-`slang-r0`-snapshot theory was **WRONG — that path does not exist in my container and I never ran a local grep**; every figure came from the API. See [[feedback_search_code_total_count_is_not_a_file_count]] (holds the `--paginate` rate-limit-injects-JSON-error-text trap too). `docs/generated/tests/_meta/prompts/_common.md:881-885` still **mandates** `-o /dev/null` ("*requires both `-target <text-target>` and `-o /dev/null`*"). **MINE-VERIFIED verbatim at master**, and the corpus is executed nightly: `nightly-slang-test.yml:137` `-test-dir docs/generated/tests`, `runs-on: ubuntu-22.04` (⇒ portability bug **latent** there, not active). My own count: **932 code-search hits under `docs/generated/tests`** (reviewer said 833 occurrences — different units, same order; ⭐don't reconcile a file-count against an occurrence-count). Cheap guard exists: `regenerate.py lint` already runs at `:108`, `lint_bundle` @`regenerate.py:1147` has no `/dev/null` check. **This is a SEPARATE issue, not scope creep into #12334** — reviewer explicitly says filing it against #12333 is the reasonable path.
2. "before code generation" is wrong in **both** directions — `-dump-ir` dumps after *every* backend pass (`slang-pass-wrapper.cpp:30-31,80-84`), and `E00004` is raised in the artifact **write** (`slang-end-to-end-request.cpp:466` → `slang-artifact-output-util.cpp:183`) *after* codegen succeeded.
3. The `{{0}}` comment omits the real justification: `slang-test`'s `removeEmbeddedSourceFromSPIRV` (`:1774-1775`) runs on **stdout only**, while the dump lands on **stderr** unstripped — so a reader who knows about the stripper will think `{{0}}` is redundant. Also "this very line" under-scopes it (the echo is the whole file).
4. Reflection files never state the precondition (`-g` absent, `slang-lower-to-ir.cpp:15432`) that makes plain `0` safe ⇒ adding `-g` later silently makes the assertion inert. Naming the *property* beats naming the flag (`-debug-info-include-source` also embeds).

⚠️**Reviewer's own harness caveat (§7):** `libslang-llvm.so` only under `build/slang-2026.13.1-linux-x86_64/lib/`, not `build/Release/lib/`; where FileCheck is unavailable slang-test reports **`Ignored`, not failed**, so a "PASS" can be vacuous. Does not undermine this verdict — §1's revert drill used hand-built buffers. But ⭐**a green from a harness that degrades to `Ignored` is not evidence**; keep this for future slang-test claims.

## ✅ GAPS FOLDED IN — head `24b2a6f816` (08-03 ~21:17Z), review round closed

Fixer pushed all 4 gap fixes. **MINE-VERIFIED at the new head:** 3 files, **+33/−5** cumulative, still **draft**. **All three `//TEST:SIMPLE` directives byte-unchanged** (`-o -` in each), assertions intact and **per-file form preserved** — `// DEBUG: result code = {{0}}` @:143 on the `-g` test, plain `//CHECK: result code = 0` @:19/:30 on the two reflection tests. So "comments + one front-matter reference only, reviewed behaviour untouched" checks out.

⭐**The fixer caught a hazard its own fix created and re-controlled for it:** the rewritten prose now contains the literal string `result code = 0` in explanatory text (@:139-142, *"so a plain `0` would match the echoed copy…"*), which under `-g` is exactly the self-match material. It re-ran the **negative** control after the rewrite, not just the positive — all 3 still FAIL on a forced failing compile. ⭐**Editing a comment can disarm an assertion when the assertion's own subject is text-in-this-file; a positive-only re-run would have hidden it.**

Also: codex caught that **`-debug-info-include-source` alone is REJECTED at `DebugInfoLevel::None`** ⇒ needs `-g1`+, so reviewer A's "embeds at a lower level" was wrong; corrected in the comment. And the fixer independently reached the same `:4627-4632` / `:4646` conclusion on the whole-program scope (measured **1 `OpEntryPoint` with and without `-o`**) before rewriting the PR body — ⭐it named its own repeat pattern (*"same class of error twice this task — both from extrapolating a measurement to a case I hadn't run"*), the mirror of my four.

⚠️**CI = benign draft priority-yield, MINE-VERIFIED on the SUITE not the aggregate.** Suite `83667007478` @`24b2a6f816`: `conclusion=failure`, `latest_check_runs_count=36`; paginated = **2 failure (`wait-for-human-priority`, `check-ci`) + 33 skipped + 1 success (`filter`) = 36 ✅ reconciles**. **Every build/test job skipped ⇒ no build ran ⇒ nothing could fail on the code.** ⭐⭐**The fixer surfaced the methodological flaw that also invalidated MY earlier read: `/commits/<sha>/check-runs` returns the CUMULATIVE aggregate across all runs on that head, so a red X can be pure history** — key on `check_suite.id` from the webhook payload instead. My 81-row count came from the aggregate route; this 36-row suite read is the correct instrument. ⚠️**It also PAGES AT 30** — an unpaginated `/commits/<sha>/check-runs` silently truncates, so a 36-run suite reads as 30. `CI Retry Yielded Bot` (workflow `304423273`) verified `state=active` ⇒ rerun is automatic. **Expect one such webhook per push while draft — recurrence is not escalation.**

## ⭐⭐ 2026-08-05 21:57Z — jkwak-work ASKS FOR THE DEFERRED HARD GUARD ⇒ the Gap-1-class nod ARRIVED

`jkwak-work` on #12333 (comment **`5197853045`**, verbatim): *"@nv-slang-bot , I want you to make another PR that recognizes `/dev/null` on Windows; or all platforms and skip the printing."*

**This is the "harder guard" that the issue body itself deferred and that I twice scoped OUT of #12334** (as "a maintainer call on which spellings to cover"). ⭐**The deferral resolved exactly as designed: I held it, and the maintainer asked for it unprompted.** Vindicates the #12219 don't-file-unilaterally rule from the *other* direction — holding cost nothing and the ask arrived with the maintainer's own preferred shape attached. **"another PR"** ⇒ explicitly NOT a widening of #12334.

⚠️**His ask contains a genuine ambiguity I must NOT resolve myself** — *"on Windows; or all platforms"* offers two scopes, and *"skip the printing"* is the behavioural core (treat a null-device path as *write nothing, succeed*, rather than attempt a file open that fails):
- **(A) Windows-only**: map `/dev/null` to the platform null device (`NUL`) so the existing spelling works there.
- **(B) All platforms**: recognise a null-device path anywhere and **skip the write entirely** (no file open ⇒ no `E00004`), making `-o /dev/null` legal-and-silent everywhere.

He wrote "or", so **the fixer must ask which — or implement B and say why**, since B subsumes A and is the only one that removes the failure mode rather than relocating it.

**MINE-VERIFIED extension point (this is a small, well-located change, NOT a sweep):**
- `source/slang/slang-end-to-end-request.cpp:457-460` — `_isStdoutArtifactPath(path)` already returns true for `path.getLength() == 0 || path == "-"`, and `:464` gates `writeToFile` on it. **A null-device predicate belongs beside this one**, and 5 more call sites already consult it (`:593`, `:683` `SLANG_RELEASE_ASSERT`, `:723`, `:728`, `:743`) ⇒ **audit all 6, and the `:683` assert especially — a new "skip the write" path must not trip it.**
- `source/slang/slang-artifact-output-util.cpp:183` and **`:261`** — the **two** `Diagnostics::CannotWriteOutputFile` emission sites (E00004). ⭐**Two, not one** — a fix that only guards `:183` leaves the other live.

⚠️**Scope-creep tripwires to hand the fixer:** this is a **compiler-behaviour change**, unlike #12334's test-only edit ⇒ it needs its own tests, and it **interacts with #12334** (if `/dev/null` becomes legal-and-silent, #12334's `-o -` switch is still right — stdout is what those tests want — but the *rationale comments* #12334 just landed would become partly stale). Also do NOT let this absorb the **`_common.md:881` generator-prompt fix (Gap 1 proper)** — that's a docs/regeneration change, still unfiled, still needs its own nod.

**#12334 status @08-05 (Main-verified):** still **draft**, head moved `24b2a6f816` → **`d57ab26dbb`** — but that is *only* a `Merge remote-tracking branch 'origin/master'` (12:23:38Z); cumulative diff **unchanged at 3 files +33/−5**, `mergeable_state=behind` again. **ZERO reviews from `kaizhangNV`/`tangent-vector` after ~2 days** ⇒ the earlier "don't nudge before a reasonable interval" has now matured into a fair nudge, but jkwak's arrival on the issue supersedes it — he is the more senior signal and may simply merge it.

## ⭐⭐⭐ 2026-08-05 22:12Z — THE "WINDOWS-ONLY" PREMISE OF THIS ENTIRE ISSUE IS FALSE (fixer found it; **I MINE-VERIFIED the full chain at source**)

`-o /dev/null` **already fails on Linux** for **binary** targets (`-target spirv` ⇒ `E00004`, exit 255); every **text** target (`spirv-asm`, `hlsl`, `glsl`, `metal`, `cuda`, `cpp`) succeeds. So this was never "an invalid path spelling on Windows" — it is a **path-shape refusal that is platform-independent**, and the reason it *looked* Windows-only is that all three tests in #12334 use `spirv-asm`, a **text** target.

**MINE-VERIFIED mechanism, end to end — and the fixer's account was slightly imprecise about where the split lands:**
1. `slang-artifact-output-util.cpp:217-219` — `writeToFile` splits on `ArtifactDescUtil::isText(desc)`: text ⇒ `File::writeAllTextIfChanged`, binary ⇒ `File::writeAllBytes`.
2. ⭐**The text branch never consults `getPathType` at all** — `writeAllTextIfChanged` (`slang-io.cpp:1211`) → `writeNativeText` (`:1222`) calls **`fopen_s(..., "w")` directly**. That is *why* text targets succeed: they bypass the check, not because the check passes.
3. The binary branch reaches `FileStream::_init` (`slang-stream.cpp:45`), which at **`+86..+95`** does `if (File::exists(fileName))` → `Path::getPathType` → **`if (pathType != SLANG_PATH_TYPE_FILE) return SLANG_E_CANNOT_OPEN`** — *before* any `fopen`.
4. `Path::getPathType` (`slang-io.cpp:641`) recognises **only** `S_ISDIR`/`S_ISREG` (POSIX) and `_S_IFDIR`/`_S_IFREG` (Win32), then `return SLANG_FAIL`. `/dev/null` is a **character device** ⇒ falls through to the failure. ⭐**Both platform branches are written the same way**, so this is not a Windows quirk. **We refuse a path the OS would accept** (`fopen("/dev/null","w+b")` succeeds).

⇒ ⭐⭐⭐**Option (A) Windows-only would RELOCATE the bug, not remove it** — it would leave the Linux binary-target failure standing. The fixer recommended **(B) all-platforms recognise-and-skip** and, correctly, **still offered A and told jkwak this evidence post-dates his "or"** rather than silently overriding him. ⭐**A maintainer's either/or was written without a fact that changes the answer; surfacing the fact beats both obeying and overriding.**

⚠️**Consequence I must not lose: this invalidates the premise several artifacts were written against — including #12334's freshly-landed rationale comments** (which explain the hazard in Windows terms) **and #12333's own issue body.** Not a defect in #12334's *code* (`-o -` is still right, and its assertions are still live), but the *comments* now under-describe the bug. **Do not let that silently stand as the repo's explanation.**

✅**My extension-point map checked out exactly** (fixer confirmed all 6 call sites + both E00004 sites), and it added a hazard I had not seen: **`:683`'s `SLANG_RELEASE_ASSERT` is safe only because `:743` rejects stdout paths first — and that check does NOT cover a null-device path.** So fixing `:464` alone would **unmask a derived-sidecar hazard** (`/dev/null.dbg.spv`, `/dev/null.coverage-manifest.json`), currently masked by the very bug being fixed; fixer measured that no stray file appears today. Also confirmed **no existing null-device helper** anywhere in `source/core/` or `compiler-core/` ⇒ genuinely new logic, not duplication.

⚠️**#12334 CI — fixer CORRECTED ITS OWN earlier "benign yield" report:** ten hours on, **still no substantive CI run** on `d57ab26dbb`. `CI Retry Yielded Bot` fired but never produced a new `ci.yml` run; the only two runs on that SHA are the `skipped` `pull_request` one and the yielded `workflow_dispatch` one ⇒ **`test-compile-regression` is UNCONFIRMED on the merge commit — the merge has NOT been shown to clear it.** ⭐**"the retry bot handles it" is a mechanism, not an observation** — verify a *run exists*, don't infer it from the bot being active. Ready-flip (maintainer-only) is what would make `pull_request` CI actually run.

## ⭐⭐⭐ 2026-08-06 22:26Z — jkwak ANSWERED by REFRAMING: fix the Linux bug FIRST, as its own PR

`jkwak-work`, comment **`5209555169`**: *"It seems like we discovered a new issue that `/dev/null` doesn't work on Linux. We should fix that first. Can you make a fix PR for that as a new and separate PR?"*

⭐**This dissolves A-vs-B rather than picking a side.** Neither (A) Windows-mapping nor (B) recognise-and-skip — he wants the **underlying refusal** fixed, then the null-device policy question separately. **Three PRs now, strictly ordered:** (1) the Linux/`FileStream` refusal ← **AUTHORIZED NOW** · (2) whatever null-device policy remains after (1) · (3) #12334 (already open, untouched). ⭐**Surfacing the fact beat both obeying and overriding the "or" — the maintainer had a third option neither of us listed.**

## ⭐⭐⭐ MINE-VERIFIED: the fix is ONE LINE, and the guard's OWN COMMENT proves it

`slang-stream.cpp`, `FileStream::_init` (~`+86`):
```cpp
if (File::exists(fileName))
{
    // Check that the path exists and is a file; not a directory.   ← STATED INTENT
    SlangPathType pathType;
    SLANG_RETURN_ON_FAIL(Path::getPathType(fileName, &pathType));
    if (pathType != SLANG_PATH_TYPE_FILE)      ← IMPLEMENTATION
        return SLANG_E_CANNOT_OPEN;
}
```
⭐⭐**The comment says "not a directory"; the code rejects "not a regular file."** Those differ exactly on the third category — **character/block devices, FIFOs, sockets**. `/dev/null` is a char device, so it is refused by a check that never intended to refuse it. ⇒ **The principled fix is `if (pathType == SLANG_PATH_TYPE_DIRECTORY) return SLANG_E_CANNOT_OPEN;`** — implement the documented intent, let the OS adjudicate everything else (`fopen("/dev/null","w+b")` already succeeds). **This is a root-cause fix at the producer, not a null-device special case** — no `/dev/null` string ever appears, so it generalises to `/dev/stdout`, FIFOs, `CON`/`NUL` on Windows.

⛔⛔**RULED OUT — do NOT add a `SLANG_PATH_TYPE_*` enumerator. It is PUBLIC ABI and would be a breaking change.** MINE-VERIFIED in `include/slang.h`: `enum SlangPathType : SlangPathTypeIntegral` at **`:1724-1729`** has **exactly two enumerators (`DIRECTORY=0`, `FILE=1`) and NO sentinel/`CountOf`**; it is passed to **`FileSystemContentsCallBack`** (`:1734`) and to **`ISlangFileSystemExt::getPathType`**, a **`virtual … SLANG_MCALL`** on a public COM interface (**`:1853`**). Per CLAUDE.md's ABI rules, third-party file systems *implement* that vtable and *switch* on that enum, so a new value would be returned to callers compiled against the 2-value enum ⇒ **breaking**. ⭐**The cheap-looking fix ("just add `SLANG_PATH_TYPE_OTHER`") is the one that breaks ABI; the one-line predicate flip is both smaller AND safer.** If a new category is ever genuinely needed it belongs on a new versioned interface, not this enum.

⚠️**Blast radius is real and must be tested, because this is `FileStream`, not a `/dev/null` path** — every binary artifact write plus anything else routed through it. **The guard must still reject a DIRECTORY** (that is its whole purpose, and it is presumably load-bearing somewhere) ⇒ regression test for: null device writes silently+successfully · **directory still refused** · genuinely unwritable path still diagnoses `E00004` · a normal file still round-trips.

**Sequencing note for whoever picks this up:** once (1) lands, re-derive what (2) still needs — if `/dev/null` simply works, the "recognise and skip the printing" half may reduce to nothing, or to a *documentation* change. **Do not carry the old (B) plan forward unexamined** ([[feedback_a_freshness_reading_expires_the_moment_you_stop_looking]] shape: a plan written against the old premise).

## ⛔⭐⭐⭐ 2026-08-07 — MY ONE-LINE FIX WAS A NO-OP. Shipped as draft #12414. THREE wrong fixes, all "obviously right", all caught only by MEASUREMENT.

**PR #12414** "Allow FileStream to write to the null device" — draft, `4881fffa60`, `pr: non-breaking`, **2 files +157/−4** (`source/core/slang-stream.cpp` +29/−4, `tools/slang-unit-test/unit-test-io.cpp` +128). 5-bullet on #12333 = `5210218141`; `report_pr_created` called. **Main-verified against the live diff.**

**⛔ MY CANDIDATE (`if (pathType == SLANG_PATH_TYPE_DIRECTORY)`) WAS A NO-OP — MINE-RE-VERIFIED at source:** `Path::getPathType` returns **`SLANG_FAIL`** for a char device (`slang-io.cpp:676`, the `return SLANG_FAIL` after the two `S_IS*` arms), and `SLANG_RETURN_ON_FAIL` (`include/slang-com-helper.h:24-27`) returns as soon as `SLANG_FAILED(_res)` ⇒ **control never reaches the comparison I proposed changing, and `pathType` is never even written.** ⭐⭐⭐**I read the two lines I intended to change and never traced the line ABOVE them. The bug was in treating "cannot classify" as "cannot open" — a `SLANG_RETURN_ON_FAIL` on a call whose failure is EXPECTED and benign.** My *reasoning* (comment says "not a directory", code refuses "not a regular file") was the right basis and is what shipped; my *edit site* was unreachable. ⇒ **A fix must be traced from the function's entry to the edit, not read outward from the line that looks wrong.** 5th same-shape error in this chain (set-member→set · necessary→sufficient · arm reachable→reached · matches→files · **line-changed→line-reached**).

**⚠️⚠️ THE FIXER THEN GOT IT WRONG TWICE — and both were WORSE THAN THE BUG.** Its measured table:

| accepted set | `-o <fifo>` | `-o /dev/full` |
|---|---|---|
| "refuse only directories, let the OS decide" (≈ my intent) | **rc=124 — HUNG** | rc=0 |
| "any character device" | rc=255 | **rc=0 — SILENT SUCCESS** |
| **shipped** (null device by identity) | rc=255 | rc=255 |

- ⭐⭐⭐**"Let the OS adjudicate" presumes the OS DECIDES — a FIFO BLOCKS**, converting an error into a hang. A hang is worse than a wrong answer: it consumes a CI slot and reports nothing.
- ⭐⭐⭐**`/dev/full` fails every write with `ENOSPC`, yet `fwrite` returns the full count** (stdio buffers), so the error surfaces at `fflush` — which `FileStream::write` never checks ⇒ **rc=0 for output never written = the EXACT silent-success class #12333 exists to eliminate.** My generalisation ("generalises to FIFOs, `/dev/stdout`") was precisely the wrong direction.
- ⇒ ⭐⭐⭐**NAME THE SAFE MEMBER; DO NOT ACCEPT THE TYPE CLASS.** Shipped fix matches the null device by **device identity** (`st_rdev` equality against `stat("/dev/null")`, so symlink aliases work) plus `NUL` case-insensitively on Windows — verified in the diff. Only the null device guarantees *write discarded* **and** *reported as succeeding*.

✅**My ABI warning held and became moot:** no new `SlangPathType` value needed; fixer confirmed the 2-enumerator/no-sentinel public enum on `ISlangFileSystemExt::getPathType`, and that **the cheap-looking fix was the breaking one**.

✅**Sidecar hazard = PRE-EXISTING, not unmasked** (fixer measured): no `/dev/null.dbg.spv`, no coverage-manifest sidecar, `:683`'s assert never trips. The `<hash>.dbg.spv` in CWD is named from the **build-id hash, not the `-o` path**, and the *pre-fix* binary writes it too. ⭐**I flagged this as a possible new hazard; it was neither new nor caused by us — "measure rather than assume" cut the right way against MY flag.**

**Tests:** 6 unit tests (null device incl. both `NUL` cases; directory / FIFO / `/dev/full` refused; unwritable still diagnoses `E00004`; regular file round-trips). Unit suite **540/540**, `tests/diagnostics/command-line/` 55/55. **Revert-drilled each** — old guard ⇒ null test fails; wide guard ⇒ FIFO test **hangs** rather than passing.

⚠️**TWO DISCLOSURES TO CARRY FORWARD (fixer's, unprompted):**
1. ⛔**Formatting is NOT tool-verified — `clang-format` is absent from that container AND `extras/formatting.sh` EXITS 0 while saying it needs it.** A silent false green in the project's own required pre-commit step. Hand-checked tabs/≤100 cols only ⇒ **CI formatting may still fail; do not represent this PR as format-clean.** Same class as the slang-test `Ignored`-not-failed trap. ⭐**worth its own report to the operator if it recurs — a repo-wide gate that exits 0 when unusable mis-certifies every bot PR.**
2. Force-pushed twice (squash + fix), each time first confirming the remote tip was its own commit with no PR attached.

⚠️**MEMORY-INTEGRITY EVENT (fixer's report):** its index had **zero** pointers to `fix-12333.md` / `fix-12414.md` although both child files existed on disk — **unreachable from the loaded index**; rows restored. ⭐**Matches the Mode-4 hazard I hit on my own store this chain: a sibling compaction can drop pointers while leaving content. Content-on-disk ≠ reachable.**

⚠️**CI on #12414:** benign yield on attempt 1 (zero build jobs). ⛔**The fixer again wrote "the retry bot handles it" — that is a MECHANISM, not an OBSERVATION**; it was wrong about exactly this on #12334 (ten hours, no `ci.yml` run ever appeared). **Verify a run EXISTS before treating CI as pending-but-fine.**

✅**MAIN-VERIFIED #12414 CI + formatting (08-07), by measurement not mechanism.** At full head `4881fffa60effe64dd59bcace868139344f24fc3`: **11 runs**. The `workflow_dispatch` **CI** run `31133814619` = `completed/failure`, and its jobs reconcile **2 failure + 33 skipped + 1 success = 36 = `total_count`** — failures are only **`wait-for-human-priority` + `check-ci`**, **zero build jobs ran** ⇒ **benign yield CONFIRMED**, and this time a run genuinely exists (unlike #12334, where none ever appeared). ⚠️**`gh actions/runs?head_sha=` returned `total_count: 0` for the ABBREVIATED sha and 11 for the full 40-char sha** — a **silent false zero**, not an error ⇒ ⛔**always pass the full SHA to `head_sha=`** (same class as the abbreviated-ref traps already in this store).

⛔⭐⭐**FORMATTING IS GENUINELY UNRESOLVED — CI CANNOT COVER IT: `Check Formatting (comment /format to auto-fix)` = `skipped` on this head.** So the fixer's disclosure (no `clang-format` in-container, and `extras/formatting.sh` **exits 0 while saying it needs it**) is **not** compensated by CI: the local gate false-greens *and* the remote gate is skipped on drafts. ⇒ **Two independent instruments both report nothing, and neither reports failure** — exactly [[feedback_a_null_from_an_instrument_with_no_field_is_an_unasked_question]]'s inverted form, twice over. **Formatting on #12414 is UNKNOWN, not clean; it will first be adjudicated on ready-flip.** The `/format` comment affordance in the check's own name is the cheap remedy if it fails.

## ✅ 2026-08-07 — #12334 DID get full CI on `d57ab26dbb`: the concern we BOTH carried as open was already CLOSED

**MINE-VERIFIED.** Run **`31006541602`** (`CI`/`workflow_dispatch`) on full sha `d57ab26dbbb6704cdd06327413599208c86cce0c`: **`completed/success`**, jobs **36 success + 1 skipped = 37**, of which **30 are real `build*`/`test-*` jobs** — including **`test-compile-regression / Test (Compile Regression)` = success**, plus both `test-falcor` legs. Window `2026-08-05T12:39:02Z → 2026-08-06T02:05:17Z` ⇒ **~13.4 h**, which is why both of us looked too early and saw nothing.

⭐⭐⭐**So the thing I recorded twice as "test-compile-regression UNCONFIRMED on the merge commit" was TRUE WHEN WRITTEN AND WENT FALSE WHILE FILED.** The fixer's *"I reported 'still unconfirmed' against a run that had already flipped"* is exactly right, and I propagated the same stale claim upstream. ⇒ ⭐⭐**A negative CI finding is a TIMESTAMPED observation, not a state. Re-measure before repeating it** — a slow queue makes "no run exists" decay into a falsehood with no event to notify you. Same family as [[feedback_a_freshness_reading_expires_the_moment_you_stop_looking]], but the decay direction is *toward* good news, which is why nobody rechecks.

⚠️**Current head `1fc6f14e9f`** (a second `Merge remote-tracking branch 'origin/master'`, 08-06T12:53:51Z; diff still 3 files +33/−5) has **only** a benign yield so far — run `31103592339`, **2 failure (`wait-for-human-priority`+`check-ci`) + 33 skipped + 1 success = 36 = `total_count`**, zero build jobs. ✅**`mergeable_state` improved `behind` → `blocked`** (the merge cleared; `blocked` = awaiting the review gate, not a rebase problem). ⇒ **The 30-job green is on the PREVIOUS head. Do not cite it for `1fc6f14e9f`** — that would be the `reviews[].commit_id` post-dating trap in a new costume. If a fresh full run matters, it needs another ~13 h or a ready-flip.

✅**#12414 formatting disclosure verified on the LIVE PR body** (`:152-157`): *"Formatting is unverified, not verified-clean… `extras/formatting.sh` exits 0 while reporting that it cannot run… `check-formatting` is also `skipped` on this head, as it is for any draft… `/format` will auto-fix"*. ⭐**The fixer's PR body had made no formatting claim at all, so nothing was false — it added the disclosure anyway, because two silent instruments let a reviewer ASSUME the check happened.** That is the right standard: **silence that invites a wrong inference is itself a defect to fix**, not merely an absence to leave alone.

⭐⭐**Paired lesson, jointly derived — the two errors are symmetric and both are "reasoning about the NAME instead of the RUNTIME BEHAVIOUR":**
- **mine — `line-changed ≠ line-reached`**: I read the two lines I meant to edit, never the guard above them.
- **fixer's — `type-class ≠ behaviour-class`**: "character device" looks like a coherent category, but `/dev/null` and `/dev/full` share the type and have **opposite write semantics**.
⇒ Both were settled only by running the adversarial case. ⭐**Neither `mkfifo` nor `/dev/full` was on the original 4-case matrix** — the FIFO came from my blast-radius instruction, `/dev/full` from the fixer chasing a mechanism *past* the example that named it. **A test matrix derived from the fix's own story systematically omits the cases that refute it.**

## ⛔⭐⭐⭐ THE MECHANISM THAT HID THE STALE CI CLAIM: **a run id's `conclusion` MUTATES IN PLACE across attempts** — MINE-VERIFIED both attempts

The fixer named this and I confirmed it directly on the **same run id `31006541602`**:

| query | `run_attempt` | `conclusion` | `updated_at` |
|---|---|---|---|
| `actions/runs/31006541602/attempts/1` | 1 | **`failure`** | 2026-08-05T12:39:37Z |
| `actions/runs/31006541602` (bare) | **2** | **`success`** | 2026-08-06T02:05:17Z |

Same `created_at` (12:39:02Z), but `run_started_at` = **08-06T00:44:37Z** ⇒ attempt 2 started ~12 h later. ⭐⭐⭐**So "I already measured run 31006541602" is NOT grounds to trust a cached reading — the id is stable while the verdict underneath it changes.** A re-query of the *same id* is a *different measurement*, which is exactly the intuition that makes caching feel safe here. This is the missing half of the check-runs traps already in this file (cumulative aggregate; 30-item page; `total_count` short-count) — **now: attempt-mutation.**

⭐⭐**And the fixer's asymmetry is the reason it survived two tellings: a stale PESSIMISTIC claim feels safe to restate, so nobody re-checks it; a stale optimistic one gets challenged instantly.** ⇒ ✅**State CI findings so they cannot rot: timestamp + FULL sha + run id + `run_attempt` + non-skipped count + real-build-job count.** Never bare "CI is unconfirmed" — that phrasing has no expiry field, so it reads as current forever. **Always pass `--jq '.run_attempt'` alongside `.conclusion`.**

⭐⭐⭐**MOST TRANSFERABLE LESSON OF THE WHOLE CHAIN (fixer's framing, and I agree it outranks my half): A TEST MATRIX DERIVED FROM THE FIX'S OWN STORY SYSTEMATICALLY OMITS THE CASES THAT WOULD REFUTE IT.** Its 4-case matrix contained neither `mkfifo` nor `/dev/full`, because both candidate fixes' stories were about *making `/dev/null` work* — not about *what else the widened predicate would admit*. **The two cases that caught real defects both came from OUTSIDE that story** (the FIFO from my blast-radius question; `/dev/full` from chasing a reviewer's mechanism past the example that named it). ⇒ **Not carelessness — the author picks the cases the fix is ABOUT.** Ask instead: *what does this change now ACCEPT that it previously refused, and which member of that new set behaves worst?*

✅**Standing rule adopted by both tiers: SILENCE THAT INVITES A WRONG INFERENCE IS ITSELF A DEFECT** — not merely an absence to leave alone. Generalised beyond formatting.

**RESUME:** #12414 review/merge — draft `4881fffa60`, `pr: non-breaking`, formatting disclosure live, **formatting UNKNOWN until ready-flip** · #12334 review/merge — draft `1fc6f14e9f`, `mergeable_state=blocked` (**review gate, not staleness**), ⛔**full 30-job CI green is on the PRIOR head `d57ab26dbb` ONLY — do not launder it onto `1fc6f14e9f`** · null-device policy (2) re-derive **only after #12414 lands** · Gap 1 (`_common.md:881`) unfiled, needs its own maintainer nod · then re-derive what null-device policy (2) still needs · #12334 review/merge · Gap 1 (`_common.md:881`) unfiled. Superseded: fixer's PR (1) for the `FileStream` predicate · then re-derive (2) · #12334 review/merge · Gap 1 (`_common.md:881`) still unfiled. Old trigger (superseded): jkwak's A-vs-B answer → fixer implements in a fresh worktree + draft PR, with tests **both** ways (null path silent-and-successful **and** a genuinely unwritable path still diagnosing `E00004` — a guard that swallowed real failures would be a worse silent-pass bug than the original) · #12334 review/merge · Gap 1 (`_common.md:881`) still unabsorbed and unfiled · or pdeayton commenting on #12333/#12334 · or a maintainer asking for the out-of-scope `slang-test` hard guard. Gaps 2-4 are comment-wording only ⇒ fixer's call whether to fold in before ready-flip; **gap 1 wants its own issue** (needs pdeayton/maintainer nod first, per the don't-file-unilaterally rule that bit #12219). Do NOT re-dispatch on further bot echoes.
