---
name: project_11999_gpu_printing_reenable_parked
description: "#11999 re-enable gpu-printing macOS test — bot-filed tracking issue, blocked on infra #11973, PARKED (no dispatch)"
metadata: 
  node_type: memory
  type: project
  originSessionId: a257d1cf-f1e8-4611-904f-073f92b7d3cf
---

**#11999** ("Re-enable gpu-printing example test disabled in #11995 (new hosted macOS runners)") — opened by `nv-slang-bot[bot]` (our own coworker) on 2026-07-08 as a follow-up tracking issue.

- **Not a Slang bug.** Bot's root-cause claim (unverified by me, consistent with priors): GitHub-hosted macOS aarch64 runners intermittently fail Metal device creation → `gpu-printing` exits 255 with no output on some instances; identical code passes on others. Infra/runner-health, tracked in [[project_11985_macos_metal_capability_regression]] neighborhood (macOS hosted-runner Metal flakiness — same class as #11903 "macOS hosted-runner infra flake").
- **What was disabled:** #11995 added `macos:aarch64:(debug|release):gpu-printing` to `tests/expected-example-failure-github.txt`, consumed by `.github/workflows/ci-examples.sh --skip-file`. Quarantined on macOS aarch64 debug+release. Still covered on Windows; already skipped on Linux x86_64 under #5520.
- **Blocked on #11973** (runner-health tracking). Follow-up = remove the one quarantine line + confirm `gpu-printing` passes reliably on macOS aarch64.

**Initial routing (07-08): PARKED** — bot-authored, self-triaged, not actionable until #11973. Superseded ↓.

**RE-OPENED 07-08 by maintainer `jkwak-work`** (comment 4919492752, `@nv-slang-bot` mention). jkwak **disputes the bot's "runner-health, not a Slang bug" root cause**: "The example is very simple and it shouldn't fail… I believe this is a Slang bug not a runner problem, because whatever the OS or spec it is, the example is expected to run properly." Also: test **cannot stay disabled** (temporary workaround only), and he **needs more info to decide how to proceed**.

- Dispatched to **slang-triager** on `gh-issue-shader-slang/slang-11999`, `<github-post-authorized />` (real bot mention). Ask: investigate the *actual* `gpu-printing` failure on macOS aarch64 — is it a genuine Slang/Metal codegen bug (jkwak's hypothesis) vs. the runner Metal-device-creation flake the bot originally claimed? Reproduce if possible; distinguish "exit 255, no output, device-creation failure" (env) from a deterministic compile/runtime bug (Slang). Report findings to jkwak on GitHub.
- ⚠️ My original park cited "runner-health flake" as the root cause — that is the bot's **unverified** claim, now explicitly challenged by the maintainer. Do NOT relay it as fact. Triager must verify from scratch.

**TRIAGE COMPLETE 07-08 (slang-triager, verified vs master d8e8e1a9e).** Verdict posted to jkwak on GitHub: comment **4919689391** (https://github.com/shader-slang/slang/issues/11999#issuecomment-4919689391). Memo: `inbox/6/triage-11999.md`.

Evidence-backed findings — **both prior positions partly wrong:**
- Red = "Run Slang examples" step; `gpu-printing` exits **255 / zero output** = `execute()` returned SLANG_FAIL. "Test Slang" (slang-test) step is GREEN same jobs.
- **NO Slang diagnostic on failure** → compile/codegen ruled out. Dies at an RHI null-return: `createDevice`/`createShaderProgram`/`createComputePipeline` (`examples/gpu-printing/main.cpp:85-104`).
- **INTERMITTENT on unchanged master** (~4 pass / ~15 fail same hours) → jkwak's "deterministic Slang bug" NOT supported.
- Bot's cited `metal4.0/E40003/createComputePipeline` signature is a DIFFERENT non-fatal **gfx-unit-test** signature in the green Test Slang step — #11973 conflated the two. Bot's specific root cause WRONG.
- 3 sibling Metal examples (platform-test/shader-toy/triangle) PASSED on the SAME runner in a failing job → "device dead on this instance" also refuted. Runner = hosted `macos-latest` **"Apple Paravirtual device"** (virtualized Metal).
- Env-vs-Slang **not decidable from current logs** — the example swallows the error silently.

**Recommended path (Approach A):** instrument `gpu-printing/main.cpp:85-104` to report WHICH stage failed + enable RHI debug layers → next red run is definitive; then bisect vs slang-rhi ToT bump **#11960 (07-06)** if it dies past device creation.

**DECISION 07-08: HELD/parked for jkwak — no fixer dispatch.** The instrumentation touches `examples/` + interacts with jkwak's own quarantine (#11995) = maintainer/CI-policy call. The GitHub comment already offers the draft PR conditionally ("if you'd like"); dispatching before he answers would make that ask rhetorical. jkwak self-fixes often → may take it himself. Comment hygiene: bot is last commenter, no new comment until he replies.

**Re-engage when jkwak replies (webhook → this canonical thread):** if "yes, instrument it" → dispatch **slang-fixer DRAFTS-ONLY** via slang-triager (Approach A instrumentation, then bisect vs #11960 if it dies past device creation); if he takes it himself → stand down; if he wants a different path → adjust. Quarantine stays temporary per his instruction.

**JKWAK APPROVED 07-08** (comment **4919730075**): "please do as you said: I can hand a fixer this instrumentation change as a draft PR if you'd like." → Forwarded to **slang-triager** on canonical thread to dispatch **slang-fixer DRAFTS-ONLY** for Approach A:
- Instrument `examples/gpu-printing/main.cpp:85-104`: report WHICH RHI stage failed (device/module/program/pipeline) + enable RHI debug layers so the next CI red run is diagnosable (not silent exit 255).
- `Addresses #11999` (NOT Closes — instrumentation is diagnostic, doesn't fix; re-enable only after root cause + fix). Then bisect vs slang-rhi ToT bump #11960 (07-06) if failure is past `createDevice`.
- Fixer: open DRAFT PR, `report_pr_created`, and (closest-to-state, draft-held) post the 5-bullet on #11999 (verdict = "instrumentation in draft PR #N, held pending review"). Quarantine stays temporary.
Gated: ready-flip + merge = maintainer only.

**RESOLVED (this step) 07-08 — DRAFT PR #12009 (Main-verified live via GitHub API):** OPEN/draft, base `master` ← head `fix/issue-11999`, `examples/gpu-printing/main.cpp` only (+63/−0), title "Instrument gpu-printing example to diagnose macOS Metal failure (#11999)", body **`Addresses #11999`** (NOT `Closes` ✓), `pr: non-breaking`. Quarantine line in `expected-example-failure-github.txt` untouched; no test re-enabled. `report_pr_created` done (webhooks route to fixer). 5-bullet posted on #11999 (verdict "held pending review").
- **What shipped:** local `IDebugCallback` + `enableValidation=true` on `DeviceDesc` + stage-labeled `reportError` before each of the 4 previously-silent `return SLANG_FAIL` sites (device/module/program/pipeline). Safe to enable validation unconditionally — `ci-examples.sh run_sample` is exit-code-only, no golden stdout for gpu-printing. Compile-verified (BUILD_EXIT=0, clang-format clean, fixer codex critique passed); NOT runnable on Metal locally (no GPU in Linux container) — correct bar, diagnostic value materializes only on the macOS CI runner.
- **Gated correctly:** fixer did NOT flip ready/merge (maintainer-only).

**07-09 00:02 — jkwak APPROVED + self-flipped ready (Main-verified via timeline API):** `ready_for_review` by **jkwak-work** @00:02:35Z, then review APPROVED ("Looks good to me", 4658743807) @00:02:45Z. Non-draft state is **maintainer-driven → NOT a fixer breach** (fixer correctly never flipped; [[feedback_drafts_only_guardrail]] exception applies — verified actor). PR still `Addresses #11999` (not Closes), main.cpp only (+63/−0). `mergeable_state: blocked` (CI/merge-queue gate), state open, **not yet merged**. Approval ≠ merge — remaining gate is jkwak's own merge, his call.

**Stale public comment (07-09, Main-verified):** fixer comment **4920280530** (nv-slang-bot @00:07:12Z) asserts "intentionally a **draft**" + "bot can't mark its own PRs ready-for-review" — but jkwak self-flipped ready @00:02:35Z (~4.5 min earlier) and PR is `draft:false`. → Directed triager→fixer to **edit-in-place** (bot was last commenter; hygiene rule [[feedback_github_comment_hygiene]]). **Edit 403'd** → fixer posted referencing correction **4920297346** (@00:10:22Z): "disregard the 'intentionally a draft' line; PR is non-draft, approved, mergeable, awaiting only your merge." Stale 4920280530 still present but neutralized by the correction. Main-verified — public surface now accurate. (Edit-403 → referencing-correction is the acceptable fallback when in-place edit is blocked.)

**07-09 ~01:25 — approval DISMISSED by a real build fix (Main-verified at claim-precision):** jkwak's ready-flip auto-triggered full pull_request CI → `build-macos-{release,debug}-clang-aarch64` failed `-Werror -Wformat-security`: 3 of the 4 new stage-labeled `reportError` calls passed a **non-literal format string with zero varargs** (clang errors; gcc/Linux doesn't → fixer's Linux-container verify structurally COULDN'T catch it). Fix = commit **0df0c244** (main.cpp only, +5/−3): routes the 3 strings through `reportError("%s", "...")`, matching the file's existing diagnoseIfNeeded idiom. Scope unchanged (diagnosability-only, quarantine untouched, still `Addresses #11999`). Verified: head now `0df0c244a1`, `reviewDecision: REVIEW_REQUIRED` (force-push dismissed jkwak's approval — expected), non-draft, `mergeable_state: blocked` (CI re-running on new head, auto-triggered not manual). Explanation posted cmt 4920644189. **Net-positive:** ready-flip's macOS CI caught a bug pre-merge no Linux verify could — better here than post-merge. Lesson reinforced: [[feedback_verify_branch_in_env_where_it_fires]] — Linux-container compile ≠ macOS-clang compile.

**NEXT:** CI must go green on `0df0c244` → jkwak re-reviews + merges (maintainer-gated). After merge + an instrumented macOS CI run names the failing stage → if it dies **past `createDevice`**, follow-up = **bisect vs slang-rhi ToT bump #11960 (07-06)** (flagged in PR body, separate PR). slang-triager holds this triage thread; re-engages on any substantive jkwak comment on #11999. slang-fixer owns #12009 review/CI webhooks + will act on next ci_* result.
