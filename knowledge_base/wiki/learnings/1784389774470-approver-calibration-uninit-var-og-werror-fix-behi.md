---
title: "[approver/calibration] uninit-var -Og -Werror fix behind result-returning helper is behavior-inert"
type: learning
topic: review-approval
source: learnings/1784389774470-approver-calibration-uninit-var-og-werror-fix-behi.md
---

# [approver/calibration] uninit-var -Og -Werror fix behind result-returning helper is behavior-inert

**Symptom:** A PR initializes local variables to an enum default/sentinel purely to silence GCC `-Werror=maybe-uninitialized` warnings that appear only under `-Og` (Slang's `-Og` Debug build was introduced by PR #12140; #12153 was its build-fix follow-up). The change looks like it could alter behavior (a "default value" now flows where none did before).

**Root cause / why it's safe:** In Slang's `OptionsParser::_parse()` (`source/slang/slang-options.cpp`), the parse helpers `_getValue<T>` (slang-options.cpp:1489) and `_expectValue<T>` (:1520) both do `SLANG_RETURN_ON_FAIL(...)` **before** assigning `ioValue = T(value)`, and assign only on the `SLANG_OK` path. So on success the parsed value always overwrites the initializer; on failure the caller returns before the value is ever read. The initializer is therefore runtime-inert — the pre-PR code had no reachable uninitialized read. GCC's `-Og` diagnostic is a genuine **data-flow false-positive across the result-returning-helper call boundary** (the optimizer can't prove the write-on-success / return-on-failure contract through the helper).

**How to catch it (the transferable check):** For an "initialize-to-default to fix a warning" PR touching a `SLANG_RETURN_ON_FAIL`-style out-param helper, the behavior-preservation question is exactly: *does the helper write the out-param only on the success path, and does the caller return on failure before reading it?* If yes on both, the initializer is inert and the fix is CLEAN regardless of what default value was chosen (only need the value to be a valid/defined enum member). Verify (a) the chosen initializer is a real existing enum default/sentinel at the pinned head, and (b) the helper's write-gate. This is the "build-flag/init-only PR whose only realistic failure is a CI-visible build break" class: green affected build legs (esp. the exact leg that failed pre-fix — here `build-linux-debug-gcc-x86_64`) are sufficient challenger evidence; codegen-blindness of automated reviewers doesn't apply because there is no runtime behavior change to be blind to.

**Fix:** WOULD_APPROVE / CLEAN. Watch-out: a misleading branch name (`fix-cmake-options-july-18`) suggested cmake/protected-path changes — always classify protected paths from the actual changed-file list (`gh pr view --json files`), never the branch name. Here only `source/slang/slang-options.cpp` was touched → no_protected_paths PASS.

Decided 2026-07-18, shadow mode, mode=live, @9f4958e881e2de572793e9fe9ed33f674b56901f.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784389774470-approver-calibration-uninit-var-og-werror-fix-behi.md`_
