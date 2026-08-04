---
name: project_12320_coverage_macos_segfault_base_rate
description: "#12320 nightly coverage-macos slang-test segfault (exit 139) — self-filed bot tracking issue, 0 dispatch (own-bot echo); long-standing ~17% base rate NOT a new regression; all next steps blocked on maintainer (workflow YAML push + actions-write); PARKED"
metadata:
  type: project
  originSessionId: b285e0b9-76cd-4205-9319-07b838de7550
---

**shader-slang/slang#12320** — "Nightly coverage: nondeterministic macOS-only slang-test segfault (exit 139) in coverage-macos". Filed **2026-08-03 08:45Z by `nv-slang-bot[bot]`** (slang-fixer, session `sess-1785745635972-8fmvgq`, thread `gh-issue-shader-slang/slang-coverage-macos-segfault`) on my 08:27Z dispatch. Labels `CI Bug`/`CI Stability`/`Test Coverage`/`slang-test`. **No assignee, no milestone, 0 comments.** Canonical thread now `gh-issue-shader-slang/slang-12320`.

**The `issue_opened` webhook on #12320 is a bot echo of this chain's own artifact — NOT a routing inbound. Main took ZERO dispatch** (no triager pass, no fixer, no GitHub comment). Same rule class as [[project_bot_comment_webhook_echo]]; same handling as slangpy#1087 in [[project_11225_capability_target_incompat_slangpy_break]] and #12232 in [[project_12210_autodiff_property_getter_frontend_crash]]. The body already *is* the triage writeup (subsystem + evidence + hypotheses + related + limits + next steps) and the labels are on — a bot-on-bot verdict comment would be pure noise.

**Substance (as filed, and the reason the framing changed):** my dispatch briefed it as a **new master regression** in a 2-commit window (`4d8fa2e9d` #12263 / `53b76e6d3` #12315). The fixer refused to file that and returned a **[Verification Report] — NOT FILED**, which was correct: the exit-139 signature hit **6 of the last 35 nights (~17%)**, four of them (07-01 `d19a399c0`, 07-09 `08af86542`, 07-19 `c6a261068`, 07-21 `6a244fee2`) on commits well before the window. The 11 green nights 07-22→08-01 are unremarkable at a 17% base rate, and so is a 2-night cluster. Filed reframed as "long-standing, nondeterministic, currently active". Three of my relayed facts were wrong; I accepted all three contradictions and authorized the reframed filing. Shared learning: `1785746835066-establish-an-intermittent-ci-failure-s-base-rate-b.md`.

Other load-bearing details in the issue: crash point moves wildly (2344 → 8445 tests, ~3.6× spread, *between the two attempts of the same job on the same SHA/runner*) ⇒ nondeterministic memory corruption, not one bad test; `failed test: 0` because the crash pre-empts failure classification; runner image byte-identical across green/red nights (`macos-26-arm64` `20260728.0273.1`, runner `2.336.0`); **cite `tools/coverage/run-coverage.sh:94`, not the log's `line 306`** (bash attributes an async-reaped child's signal to the enclosing compound statement — reproduced locally).

**Main-verified at `53b76e6d3` (2026-08-03):**
- The `-synthesizedTestApi -llvm` macOS workaround from PR #11332 **IS still live** in `.github/workflows/ci-slang-coverage-test.yml` (macOS branch of "Run Tests with Coverage (Linux/macOS)"), alongside `-expected-failure-list tests/expected-failure-coverage.txt`. Comment there names the same `parameter-block.slang.6 syn (llvm)` crash.
- **#11384** (the long-term "targeted skip for generated LLVM runtime coverage tests" issue, same crash family, `failed test: 0` shape) is **open, assigned `jvepsalainen-nv`, milestone Q3 2026 (Summer)** ⇒ maintainer-owned. Its only comment is our own 06-01 bot triage.
- Backlink is already satisfied: #12320's body mentions #11384, so GitHub stamps the cross-reference on #11384's timeline automatically — **no comment on #11384 needed**.

**Why no fix dispatch — all three suggested next steps are structurally out of the bot's reach:**
1. Capture core dumps / symbolized crash reports in `coverage-macos` = a `.github/workflows/` edit → blocked by the App's missing `workflows:write` ([[project_bot_workflows_permission]]); landing path would be post-the-diff-as-a-comment + maintainer PAT.
2. Repeated runs at a fixed SHA to measure the true crash rate = **actions-write**, which is the currently-flapping capability ([[project_github_actions_graphql_401_outage]]) and an operator/maintainer call regardless.
3. ASan/UBSan macOS run over the same test set = CI config, same gate as (1).

⇒ **Disposition: PARKED, maintainer-owned, handed off.** GitHub footprint is complete (the issue body carries the full trail + next steps). **RESUME only on a substantive human (non-bot) comment on #12320 or #11384, or if a maintainer picks it up / asks for the core-dump diff** — at which point the play is the post-the-YAML-diff-as-a-comment standard, not a bot PR. Do NOT re-triage on further bot echoes. Do NOT treat a fresh red night as new breakage — check it against the ~17% base rate first.
