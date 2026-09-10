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

---

## 2026-08-05 — human inbound + **the base rate we published is an UNDERCOUNT**

**jhelferty-nv (MEMBER) commented** ([5195426440](https://github.com/shader-slang/slang/issues/12320#issuecomment-5195426440)): *"@jkiviluoto-nv to do initial triage / @jvepsalainen-nv FYI"* — and **assigned `jkiviluoto-nv`**. Real human, non-bot ⇒ a routing inbound, and the maintainer pickup we were parked waiting for. Nothing asked of us; the ask is directed at a named human. Chain is **no longer ours to drive** — it has a human owner.

⛔**But re-measuring for the reply overturned our own headline number.** I enumerated all 37 nightly-coverage runs 07-01→08-05 and pulled the **annotation set** for each `coverage-macos` job (`/check-runs/<job>/annotations`), counting `First coverage run failed. Retrying...` separately from `exit code 139`:

- **6 nights** have a **job-level** exit-139 failure — the number we published.
- **18 of 37 nights** carry the **retry annotation**, i.e. *attempt 1 of the coverage step died* — including **6 nights that the workflow reports as SUCCESS** (08-05 `ff45b15ed`, 07-30 `7c58a326b`, 07-26 `926f93ed1`, 07-20 `a916653b7`, 07-09 `0a02eae1b`, 07-03 `96003b0d8`).
- **08-05's "green" night is a MASKED SEGFAULT, confirmed from the live log** (`grep` on job 92194767660): `run-coverage.sh: line 306: 92520 Segmentation fault: 11` on attempt 1, retry passed, **job conclusion = success, zero failed steps.** Crash site = after 1191 passed tests, last `tests/compute/nonuniformres-nested-rwstructuredbuf.slang.4` — **byte-identical crash site to 08-02 attempt 1** (job 91447962474, 1188 passed, same test).

⭐⭐⭐**The retry that makes CI green is what hid the true rate. `~17%` counts nights where BOTH attempts crashed; the crash actually fires on up to ~49% of nights (18/37) and a single lucky retry erases it from every surface a reader checks — conclusion, exit code, and step status.** Our own issue said retry-resistance "is a property of this long-standing crash" — true, but it framed both-attempts-crashed as the *signature*, when it is really the *tail* of a much more frequent event. A "green" nightly is NOT evidence the crash did not happen.

⚠️**Do NOT restate 18/37 as the crash rate either.** The retry annotation means *attempt 1 failed*, not *attempt 1 segfaulted* — attempt 1 can fail on ordinary test failures (`exit 1`). Only 08-05 was confirmed a segfault by reading its log. **The 6 pre-08-02 retry-green nights CANNOT be classified: their job logs are `410 Gone`, and a green night's annotation set carries no exit code at all** (verified: green annotations are Node-20 + retention warnings + the retry line, nothing else). So the honest statement is a **bracket: ≥7 segfault nights (6 job-failures + 08-05 confirmed), ≤18 attempt-1 failures, 11 unclassifiable.** ⭐⭐**Naming the instrument's blind spot is the finding — an annotation census can distinguish *attempt-1 failed* from *job failed*, but never *why*.**

⇒ **Operational consequence for whoever measures the rate (suggested step 2):** the measurement must key on **per-attempt segfault occurrence inside the step log**, not on job conclusion. A rate computed from `conclusion == failure` undercounts by ~3×. Logs expire in ~7 days, so a retrospective census is permanently capped at what annotations can say — **future sampling has to capture the crash artifact at the time of the run.**

⇒ **Disposition: PARKED, maintainer-owned, handed off.** GitHub footprint is complete. **Human owner as of 08-05: `jkiviluoto-nv` (assigned by jhelferty-nv), with jvepsalainen-nv FYI'd** — the maintainer pickup arrived, so we do not drive this. Our remaining obligation was one correction comment (the undercount above), since we published the ~17% figure and a human is about to triage from it.

**RESUME only if `jkiviluoto-nv`/`jvepsalainen-nv` asks us something directly, or asks for the core-dump YAML diff** — at which point the play is post-the-diff-as-a-comment (App lacks `workflows:write`), not a bot PR. Do NOT re-triage on bot echoes. ⛔**Do NOT treat a fresh red night as new breakage — and do NOT treat a green night as clean:** check the `coverage-macos` job's annotations for `First coverage run failed` before concluding anything about that night.
