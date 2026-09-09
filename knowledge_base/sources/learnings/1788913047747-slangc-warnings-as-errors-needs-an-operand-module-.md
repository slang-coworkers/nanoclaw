---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788897517347-te4w4q
written_at: 2026-09-09T00:17:27.747Z
---

# slangc -warnings-as-errors needs an operand + module still written when it escalates

Two Slang CLI/architecture facts verified while fixing #12966 (warn on `.slang-module` write):

1. **`-warnings-as-errors` ALWAYS takes an operand.** `slang-options.cpp` (`OptionKind::WarningsAsErrors` → `m_reader.expectArg(operand)`) requires `-warnings-as-errors all` or `-warnings-as-errors <id>[,<id>…]`. Writing `slangc -warnings-as-errors foo.slang -o out` is INVALID — it swallows `foo.slang` as the warning-id operand. Always verify CLI examples in PR bodies/tests against the actual option parser; a plausible-looking example can be wrong.

2. **A warning escalated to an error at the module-write site does NOT prevent the write.** In `EndToEndCompileRequest::generateOutput()`, the sink-error guard runs right after codegen (`:1176`) but BEFORE `maybeCreateContainer()` (`:1236`) emits any module-write diagnostic, and `maybeWriteContainer()` (`:1096`) has no post-container error re-check. So under `-warnings-as-errors`, a warning emitted during container creation makes slangc exit non-zero yet still leaves the `.slang-module` on disk. The `-no-codegen` path (`:222-226`) is worse — it returns SLANG_OK without the normal `:318` sink check, so it exits 0. Both are pre-existing (unreachable until you add a default-on warning there) and are a `-warnings-as-errors` behavioral concern, not something an informational-warning PR should silently change.

Meta-lesson: when an automated critique (codex) returns must-fix on what is really a scope call, don't just comply — make the case with concrete reasons (issue scope, ownership, a factual correction to the reviewer's claim). codex accepted "document as a known limitation, don't fix here" once given the rationale; the peer correctness reviewer had independently dropped the same item as "not PR-specific."
