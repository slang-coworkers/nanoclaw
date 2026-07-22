---
name: project_12177_slang_test_verbosity_failure_parallel
description: "slang#12177 slang-test -v failure prints passing tests in parallel + capability-discovery output — draft PR #12180 open, reviewer pipeline running"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3e42b408-c466-4efc-924a-ba06c294588d
---

**shader-slang/slang#12177** — `slang-test -v failure` still prints passing tests in parallel (`-server-count > 1`) runs and prints backend/render-API capability-discovery output regardless of verbosity. Defeats `failure` level (introduced to keep successful-run logs small). Filed **and self-assigned** by maintainer **jkwak-work** @6a244fee2.

**Triage verdict (slang-triager, code-inspection confirmed both jkwak root causes):** bug / low / CI·test-tooling (slang-test harness) / P3. Not binary-reproduced (Windows-exe path) so no `reproduced` label; mechanism unambiguous in source.
1. `runTestsInParallel` per-worker `TestReporter` (slang-test-main.cpp:5395-5396) only `init()`s, never sets `m_verbosity` → default `Info`; main reporter does set it (:6049). Passing-test gate `m_verbosity < Info` at test-reporter.cpp:407. Same config-drift class as #11911.
2. `Supported backends:` (:5850-5878) + `_getAvailableRenderApiFlags` `Check …:` (:1592-1601, :1635-1647) write raw `StdWriters::getOut()`, ungated.

**Fix solution space (memo):** P1 fold reporter config into `TestReporter::init` (single source of truth); P2 gate discovery output on `verbosity >= Info`. **Load-bearing:** CI parses `Supported backends:` (action.yml:94) at default Info → P2 must be `>= Info`, never unconditional suppress. Verify behaviorally (monolithic harness, no committed regression test).

**STATUS: ✅ TERMINAL — MERGED & CLOSED.** jkwak-work merged PR #12180 into master 07-22 (merge commit `7002bbe677`); issue #12177 auto-closed COMPLETED. Both root causes fixed at right layer in tools/slang-test (+79/−31, 5 files): P1 `TestReporter::init(const Options&)` config-fold (kills #11911-class worker/main drift) + GPU-free regression unit test; P2 discovery gated `>= Info` with 2 refinements over original memo (`Supported backends:` deferred past `Options::parse` — in-place gate was timing no-op; `Not Supported` lines left ungated per jkwak inline). CI-parse constraint (`common-test-setup` grep of `Supported backends:` at default verbosity) preserved byte-identical. Chain closed — no reopen absent fresh substantive human comment.

--- HISTORY ---
**Was: PR #12180 APPROVED by jkwak-work (maintainer+author+assignee), awaiting human merge.** Formal APPROVED review 07-21 22:19:46Z on HEAD @c4c62d9292 — "Looks good to me. Locally tested and it works as expected." reviewDecision=APPROVED, MERGEABLE, OPEN. Fixer holding pushes (a commit auto-dismisses approval). No open review threads. Only failing CI = `gfx-unit-test createBufferFromHandleD3D12.internal` (Windows-debug-GPU only) — flaky D3D12 gfx, unrelated to test-tooling diff (0 gfx touched; passed Windows-release/macOS/Linux + Common Test Setup which parses `Supported backends:`); rerun in flight. Await human merge (bot never merges) → then refresh issue verdict to merged.

--- HISTORY ---
**Was: PR #12180 NON-DRAFT, in maintainer review (jkwak flipped ready 07-21 20:23:58Z himself).** HEAD @c4c62d9292; GH reviewDecision=REVIEW_REQUIRED (no formal approve yet); internal slang-reviewer=APPROVE_WITH_NITS (0 bugs, 1 gap, advisory). jkwak left inline "Not supported case should show up for `-v failure`" (slang-test-main.cpp:1649) → fixer **ungated the `Check <api>: Not Supported` branches** (failed backend is signal `-v failure` users need; positive "Supported" lines stay gated; CI unaffected — runs at default Info). Added GPU-free regression test `slangTestReporterInitFromOptions` (Reviewer A showed internals ARE unit-testable) + 4 clarity fixes. Now 5 files +79/−31. Await jkwak re-review + real pull_request CI @c4c62d9292 + his merge (bot never flips/merges). No open blockers.

--- HISTORY ---
**Was: DRAFT PR #12180 OPEN — reviewer pipeline running, held draft.** Verdict posted → issue comment 5037279405. Was parked per [[feedback_admin_standing_rules_precedence]] `no-autofixer-jkwak-self-filed`; **07-21 jkwak-work "Please make a PR for this" (comment 5037327703) = maintainer go** → gate cleared → slang-fixer dispatched.

**Draft PR #12180** https://github.com/shader-slang/slang/pull/12180 — branch `fix/issue-12177` @9eb0fd38e3, `Closes #12177`, 3 files in tools/slang-test (+42/−33). `report_pr_created` done. Fixer PR-opened comment 5038139306.
- **P1:** reporter config folded into `TestReporter::init(const Options&)` — worker/api-detection/main share one config path (kills #11911-class drift).
- **P2:** discovery gated `verbosity >= Info`. `Check <api>:` prints gated **in place** (call sites 4917/5605/5656/5962 all post-parse). `Supported backends:` (:5851) prints **pre-parse** → moved to gated print AFTER `Options::parse` (:5921); preserves :5863 `availableBackendFlags` set + :5872 category registration side-effects. Fixer caught this timing bug in memo's P2 (in-place gate would no-op at ctor-default Info).
- **Behavioral verify PASS:** `-v failure` parallel → summary only (0 `passed test:`, 16/16); default `-v` keeps discovery byte-identical → CI action.yml:94 parse preserved. Draft CI "fail" = cosmetic priority-yield.
- codex PLAN/CODE/OUTPUT approve; slang-reviewer 3-reviewer pipeline running (~20-30 min as of 07-21 19:30).

**Next:** await reviewer verdict (triager forwards) → maintainer (jkwak-work assignee) flips ready → merge. Chain OPEN. Triage memo: /workspace/inbox/a2a-1784656458522-hue4od/triage-12177.md
