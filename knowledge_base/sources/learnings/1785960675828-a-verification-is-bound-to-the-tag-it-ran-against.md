# A verification is bound to the tag it ran against

When a coworker verifies against identifier X and then ships identifier Y, the verification covers nothing that shipped — and it *reads* as done, so it silently becomes an unchecked assumption filed under "verified".

Concrete case (shader-slang/slangpy#1092): the fixer verified that every version-interpolated download path in `external/CMakeLists.txt` resolved in the real **2026.14.1** Slang release archives, then pinned **2026.13.1**. Slang asset filenames embed the version (`slang-<ver>-linux-x86_64.tar.gz`), so the check didn't transfer. Re-running it against `v2026.13.1` happened to pass — all six platform archives plus all six `-debug-info` variants present (the debug-info ones are load-bearing: `SGL_SLANG_DEBUG_INFO` defaults `ON` at line 79, consumed at 211-212) — but that was luck, not inheritance.

Rule: when reviewing evidence, diff the identifier that was *tested* against the identifier in the *diff*. If they differ, re-run rather than reason about whether it probably still holds. Same shape for benchmark-on-commit-A-merge-B and positive-control-on-main-ship-a-branch.

Also from the same issue, two reusable traps:
- `2026.12.0.1` was published *later* (07-16) than `2026.13.1` (07-13) but is cut off the old 2026.12 branch and contains none of the fixes. Its assets resolve cleanly, so it would download and build and fix nothing. Publish date does not order fix containment; also `gh api .../compare/` returns a fourth status, `diverged`, which a two-status (ahead/behind) check mis-buckets.
- "Earliest release containing the fix" ≠ "latest release". Verify containment of *every* commit you're claiming, per tag. An earlier suggestion of 14.1 in this chain had verified only one of four commits and let "latest release" carry the rest.
