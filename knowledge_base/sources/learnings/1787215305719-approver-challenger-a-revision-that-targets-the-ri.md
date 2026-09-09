---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787213436865-39m9ue
written_at: 2026-08-20T08:41:45.719Z
---

# [approver/challenger] A revision that targets the right area is not a fix — re-read CI, the break can move

**Symptom.** slangpy#1120 R1 abstained on a verified Windows MSVC build failure rooted in a custom vcpkg overlay (`external/vcpkg-overlays/crashpad/portfile.cmake:61`, "Could not find debug library z;zlib;zlibd"). R2 (synchronize) pushed a commit "Use built-in vcpkg Crashpad port" that *deleted the entire failing overlay* and switched to vcpkg's built-in crashpad port. The diff was coherent and clearly aimed at exactly the finding — tempting to read as "fixed". It was NOT: CI went RED again with a **different** root cause — the built-in port failed to *compile* under MSVC (`mini_chromium` C3646 `'requires': unknown override specifier`, C2039 `'string_view' is not a member of 'std'`, C3861 `WideToUTF8` not found → `vcpkg install failed` → `cmake --preset windows-msvc -DSGL_ENABLE_CRASHPAD=ON` exit 1). The fix swapped one PR-introduced Windows break for another.

**Root cause of the trap.** On a revision chain, the strong prior is "they addressed my last finding, so it's better now." That prior is about *intent*, not *outcome*. Deleting the code that threw error A does not mean error A's absence is validated — it means the code path changed, and the replacement path (here: the built-in port, which lacked the overlay's `fix-std-20.patch` handling MSVC's C++-standard needs) has its own untested behavior. The diff being larger and more surgical actually raises risk, not lowers it.

**How to catch it.** Re-run the FULL procedure on the new head (the skill already mandates this) and — critically — **re-read the build check-runs from scratch on the new commit**. Never infer "fixed" from "the code I flagged is gone" or from a green combined-status (still CodeRabbit+CLA only, still blind to build check-runs — see [[approver/clause-gap ci_green_on_sha reads combined status]]). Wait for the specific job that failed last time (here the two `build (windows, x86_64, msvc, …)` jobs) to reach terminal state; one terminal failure on a shipped config (`-DSGL_ENABLE_CRASHPAD=ON`) is decisive and you need not wait for its sibling. Re-confirm attribution against base `main` each revision (main stayed green; only the PR's diffs differ ⇒ still PR-introduced).

**Fix / decision shape.** Verdict class is unchanged from R1: `ABSTAIN_POLICY:CHALLENGER_CONCERN`, one fresh ledger row per revision commit, with the challenger field naming the NEW root cause (not carried over from R1). Record the prior revision as context so the human sees the chain, but decide only on this revision's evidence.
