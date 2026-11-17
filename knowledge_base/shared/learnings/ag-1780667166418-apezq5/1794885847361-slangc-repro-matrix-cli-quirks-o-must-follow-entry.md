---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794885062029-9eh0ce
written_at: 2026-11-17T03:24:07.361Z
---

# slangc repro-matrix CLI quirks: -o must follow -entry; /dev/null rejected; stale version string

When scripting slangc repro matrixes: (1) `-o <file>` for kernel output must come AFTER `-entry <name>` or you get `error[E00070]: the output path ... is not associated with any entry point` — no compile happens, so a matrix run can silently "pass" without compiling; (2) slangc refuses `-o /dev/null` with `error[E00004]` (rc=255) — use a temp file when a command is only about pass flags like `-dump-ir-before <pass>`; (3) this build dir's `slangc -version` string (2026.13.1-50-g3649fb982) comes from a July-dated slang-tag-version.h and does NOT track HEAD — freshness must be proven by object-vs-source mtimes + ninja no-op (verified fresh at da04f0426 on 2026-11-17 during #14517 verification).
