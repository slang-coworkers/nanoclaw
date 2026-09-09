---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787269675272-rgyjlr
written_at: 2026-08-24T21:12:21.441Z
---

# [approver/confirmed-safe] Symbol-visibility version-script hardening (allow-list, guarded, silent-drop fallback) merged unchanged — a low-risk change class

## Outcome (calibration join)
slang PR #12379 ("Stop re-exporting libstdc++ symbols from slang-glslang") — my
WOULD_APPROVE @9c2da497 was joined by the human outcome: **merged by jkwak-work
at exactly that head_sha** (squash merge_commit 49e46b0 on master, 2026-08-24).
Zero commits between my decision head and the merged head; the squash landed the
identical 3-file delta. MEMBER approval + merge with no follow-up edits =>
WOULD_APPROVE was correct, no divergence to mine. Confirms the shape is safe.

## The safe change class (for Step-0 recall on similar PRs)
An ELF `--version-script` allow-list added to bound a dlopen'd module's exported
symbols has a low false-approve risk WHEN all of these hold (each verified at head
here):
1. The export boundary is an EXPLICIT name list closing with `local: *`, NOT a
   prefix wildcard (`glslang_*` would leak upstream's own same-prefix C-API
   symbols). Verify by reading the script.
2. Every listed name has a matching `extern "C"` definition, and every consumer
   `dlsym`/`findFuncByName` lookup site (grep the WHOLE tree — there were TWO
   loaders here) is covered by the list. Internal helpers stay `static`.
3. The flag is added via a helper that routes through `check_linker_flag`
   (silent-drop on an unsupported toolchain) — so the worst case on any platform
   is "no hardening = the pre-existing status quo," never a broken build. This is
   also why the platform guard (`NOT WIN32 AND NOT APPLE`) matters and why macOS
   (needs `-exported_symbols_list`) is correctly deferred.
4. Main CI is green at the exact head (the ELF link path actually links).

## Meta-lessons that recurred on this PR (both cost round-trips; worth internalizing)
- A review signal must be provenance-bound to the pinned head. Devin exposes no
  SHA — infer provenance from the filenames/linecounts it cites vs the current
  delta. A stale-looking Devin (old filename) => not head-current => don't set
  reviewers_complete=true / don't hand-set commit_id=head. (First head ce08f478:
  correctly ABSTAIN for exactly this reason; second head 9c2da497: Devin re-run
  was genuinely head-current, so WOULD_APPROVE.)
- A green CI check proves only what it BUILT. The wasm job builds `--target
  slang-wasm`, which doesn't link the slang-glslang MODULE — so it says nothing
  about that target's version-script link. Don't cite it as proof for the target.
