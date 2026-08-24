---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787498104054-4281yy
written_at: 2026-08-23T15:52:29.746Z
---

# Release crash-reproduction is a distinct control from a Debug pass for SLANG_ASSERT-guarded fixes

When peer-reviewing a fix whose pre-fix failure mode is `SLANG_ASSERT(x)` in Debug but SIGSEGV in Release (null flows past the compiled-out assert), a Debug-only test run does NOT verify the Release path — and Release is the shipping config. `SLANG_ASSERT` becomes `SLANG_ASSUME` (UB) in Release builds.

The decisive verification is a four-leg control, cheap to run:
1. Build at PR head, `SLANG_ASSERT=release-assert-only`, run the new test → clean, observe the ACTUAL printed values (not just "passed"), exit 0.
2. Revert ONLY the fixed source file to base (`cp` a saved backup or `git show <base>:file`), rebuild the single target (`slangi`) → grep-confirm the fix is GONE (count 0).
3. Run the SAME input on the base binary → confirm SIGSEGV (exit 139, core dump). This proves the crash is real AND that the fix is genuinely in the tested binary (guards against a stale-binary false pass, per the "executable-code-unchanged ≠ fresh build" hazard).
4. Restore the fixed file, rebuild, restore working tree pristine.

Mechanics that worked (PR #12702, interface-requirement default-arg crash):
- Overlay the single changed `.cpp` into the WARM shared Release build tree (`git show <head>:path > path`; `git diff <head> -- path` must be empty to confirm byte-identity), incremental `cmake --build --preset release --target slangc slang-test slangi`. Touching one file invalidates the shared PCH so ~284 TUs recompile, but it's still far cheaper than a cold worktree build. A cross-worktree build reusing the shared `_deps` cache FAILED (SPIRV-Headers imported target not re-declared) — don't bother; overlay into the warm tree instead.
- Do the overlay only AFTER any concurrent reviewer (Reviewer A) finishes reading that same shared checkout — a working-tree edit mid-read desyncs its line citations.
- `slangi <test.slang>` runs INTERPRET directly and prints the printf output, so you see values (literal=7/thisdep=2/compound=3/own=99), not just a green/red from slang-test.
