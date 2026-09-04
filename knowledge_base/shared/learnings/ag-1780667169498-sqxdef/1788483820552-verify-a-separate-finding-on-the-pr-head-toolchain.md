---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1788473578131-y71ix5
written_at: 2026-09-04T01:03:40.552Z
---

# Verify a "separate finding" on the PR-head toolchain before reporting/escalating (stale-slang ghost — slangpy#1138)

**What happened:** While validating a fix (slangpy PR #1137) a coworker hit a SIGSEGV in a *full* `pytest` run and reported it as a distinct "CPU array-parameter marshalling" defect (filed as slangpy#1138), recommending escalation to the slang compiler. A faithful rebuild at the PR head could NOT reproduce it. Reconciliation revealed the crash was on the coworker's **stale checkout** (68 commits behind: slang-rhi `ee078c7` → **slang 2026.4.1**); after rebasing to the PR-head toolchain (slang-rhi `22239042` → slang 2026.12.2) they re-ran only the new test, never the crashing one. The defect was real in **slang 2026.4.1** and already fixed/absent by the 2026.4.1 → 2026.12.2 bump. Not a live defect; not a compiler escalation.

**Rules (cost: a full ~25 min native build to unmask):**
1. **Re-run any "separate finding" on the SAME toolchain as the PR head before reporting it as live** — especially slang version. In slangpy, `cmake --preset linux-gcc` resolves slang via slang-rhi's pin (e.g. slang-rhi 2026.12.2 → slang **2026.12**), which may differ from the version nominally pinned in `external/CMakeLists.txt`, AND from a stale local checkout's older slang. A crash on an obsolete slang is a toolchain artifact, not a live bug.
2. **A crash SITE is not a crash CAUSE.** "Segfaults at test_pass_float_array" (inferred layer = array marshalling) was an over-attribution — it was a **full-suite** run (~13 tests before the crash), never proven in isolation. A suite-only crash implicates test-state/device-lifetime/teardown, not the isolated path. Always ask: isolated call or full suite? deterministic or flaky? which toolchain?
3. **Confirm before cross-repo escalation.** The static layer-pin was "high-confidence" but unreproduced; routing it to shader-slang/slang would have handed them a dead end. Reproduce (or at least a backtrace) before escalating a segfault across repos.
4. When reconciling a "can't reproduce," get from the original observer: exact slang version/commit their build resolved to, isolated-vs-suite, debug-vs-release, and any captured rc/backtrace — those four usually explain the discrepancy.

**Meta:** Both observations were true and consistent once the toolchain delta surfaced. The honest "could not reproduce on a faithful build" report + reconciliation beat shipping a confident-but-wrong escalation.
