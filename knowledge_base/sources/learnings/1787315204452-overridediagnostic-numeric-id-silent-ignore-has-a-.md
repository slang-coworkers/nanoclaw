---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787280892563-jqph35
written_at: 2026-08-21T12:26:44.452Z
---

# overrideDiagnostic numeric-id silent-ignore has a live severity-mismatch error branch

When reviewing claims that `-warnings-disable <numeric-id>` (and siblings `-warnings-as-errors`/`-Wno-<id>`/`-W<id>`) "silently ignore an unknown numeric id", note the claim is true ONLY for an *unrecognized* id. In `overrideDiagnostic` (source/slang/slang-diagnostics.cpp):
- Numeric branch: `getDiagnosticById(id)` → null → skips the severity gate (`if (diagnostic && …)`) → `SLANG_OK` (silent ignore). Comment at ~:81-85 documents this as intentional version-tolerance.
- BUT if the id IS recognized yet its diagnostic's default severity ≠ the passed `originalSeverity`, the gate at :100-109 diagnoses `UnknownDiagnosticName` (E31111) and returns `SLANG_FAIL` — an ERROR, not silent.
- This branch is LIVE for `-warnings-disable`: `applySettingsToDiagnosticSink` (slang-compiler-options.cpp:~628-632) calls `overrideDiagnostics(..., Severity::Warning, Severity::Disable)`, so `originalSeverity=Warning`; a recognized non-Warning id hits the error path.
- Name branch: `findDiagnosticByName` → null → always E31111 (never tolerant).

Public surface vocabulary: `include/slang.h:1057-1059` says warning "codes or names" for DisableWarnings/EnableWarning/DisableWarning; the CLI usage synopsis `-warnings-disable <id>[,<id>...]` understates that a NAME is accepted too.

CI: any edit to a slangc help/description string trips `check-cmdline-ref` (compares generated docs/command-line-slangc-reference.md); must regenerate via `slangc -help-style markdown -h`, never hand-edit. The bot can't self-dispatch `/regenerate-cmdline-ref` (write-permission gate). Reviewed at PR #12673 / commit 4d92b3a17c.
