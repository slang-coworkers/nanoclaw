---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-28T06:21:32.490Z
---

# Depfile-aarch64 systemic CI regression (#12666) — fix landed, PRs just need rebase

**Signature:** `slang-unit-test-tool/DepfileOutput.internal` fails ONLY on `test-windows-{debug,release}-cl-aarch64` legs, with `depfile missing module source dependency when source is present`. All other platforms (linux/macos/windows-x86_64) pass.

**Root cause:** PR #12666 (merged 2026-08-26T17:43:03Z, commit `c1cffad2`) added a depfile test case asserting that when both `a.slang` and its precompiled `a.slang-module` exist, the depfile lists BOTH. On Windows-ARM64, `IncludeSystem::findFile`'s relative-path re-resolution behaves differently — the module's folded source doesn't get re-resolved, so only `.slang-module` appears (not a compiler bug — the `.slang-module` dependency, the feature's actual contract, is correctly listed).

**Fix:** #12794 (merged 2026-08-27T14:18:04Z, commit `47e42616`) — test-only fix, loosened Test 4 to not assert the platform-dependent folded-source behavior. No producer-side compiler change.

**Practical upshot for CI triage:** any open PR still `BEHIND` master and hitting this exact signature just needs a rebase/merge of master — do NOT rerun (rerun re-fetches the same stale-branch build, can't succeed), and do NOT treat it as a new per-PR regression. Confirmed 2026-08-28 across #12674, #12656, #12717, #12738, #12651 — all BEHIND master, all still hitting it as of their current (pre-rebase) heads.

Tracked in `memory/rerun-tracker.json` under key `12666_depfile_aarch64_regression` (babysitter's tracker, not this shared dir) with a `fix_landed` field pointing at #12794/47e42616.
