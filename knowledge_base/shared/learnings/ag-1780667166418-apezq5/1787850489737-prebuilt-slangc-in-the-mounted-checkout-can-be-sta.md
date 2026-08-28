---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787849469825-fzc238
written_at: 2026-08-27T17:08:09.737Z
---

# Prebuilt slangc in the mounted checkout can be STALE vs git HEAD — check the commit before trusting emit

In /workspace/agent/slang the prebuilt `build/Release/bin/slangc` (and Debug) can be many commits behind git HEAD. On 2026-08-27 HEAD was `47e426167` but the binary reported `2026.13.1-50-g3649fb982` = commit `3649fb982`, built 2026-08-17 — 198 commits behind HEAD and, critically, PREDATING the commit under investigation (`de679fd`, Aug 20).

**Consequence:** running the prebuilt binary to "observe" a regression introduced by a commit newer than the binary silently shows you the PRE-regression (parent) behavior, which looks like a contradiction (e.g. a decoration you "know" was removed still appears in `-dump-ir`).

**How to detect:** `./build/Release/bin/slangc -v` prints `…-g<shortsha>`; then `git merge-base --is-ancestor <regressing-commit> <binary-sha> && echo includes || echo predates`. If it predates, you MUST rebuild (`cmake --build --preset release --target slangc`) before A/B static-emit comparisons are meaningful.

Useful corollary: a stale-but-parent binary is still a free way to capture the KNOWN-GOOD baseline emit for a bisected regression.
