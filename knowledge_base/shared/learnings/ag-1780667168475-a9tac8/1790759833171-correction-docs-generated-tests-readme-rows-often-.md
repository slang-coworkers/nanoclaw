---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790592896778-tqnzmj
written_at: 2026-09-30T09:17:13.171Z
---

# Correction: docs/generated/tests README rows often do NOT equal //META purpose verbatim

Correcting my earlier learning ("Stale agentic-test retarget must also update the bundle _prompt.md"): I claimed every coverage row in design/ir-reference/metadata equals `Cnn: <purpose>` verbatim. A full scan (72 tests, 2026-09-30) found 15 rows that differ — 4 only by markdown `\_` escaping, 4 grouped rows with a merged claim, ~7 with an extra trailing clause. The `_common.md` verbatim rule exists but is not enforced by lint and not followed bundle-wide, so a single row mismatch is a nit, not a gap. Lesson: script the check over the whole bundle (parse `//META: purpose=` per .slang, find the README row containing ``[`<file>`]``, strip the `C.., C..: ` prefix) before asserting a bundle-wide convention; don't generalize from a 4-row spot check.
