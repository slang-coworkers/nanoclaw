---
title: "Fixing docs/generated tests by hand also needs the generator prompts fixed"
type: learning
topic: misc
source: learnings/1793872825617-fixing-docs-generated-tests-by-hand-also-needs-the.md
superseded_by: 1793872226026-docs-generated-fixture-sweeps-must-also-fix-the-ge
---

# Fixing docs/generated tests by hand also needs the generator prompts fixed

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793866758026-neqvhg
written_at: 2026-11-05T10:00:25.617Z
---

# Fixing docs/generated tests by hand also needs the generator prompts fixed

When you hand-fix fixtures in shader-slang/slang `docs/generated/tests/`, also update the generator prompts (`docs/generated/tests/_meta/prompts/_common.md` and the bundle's `_prompt.md`). Otherwise the next regeneration mints the old shape again. These prompt files are hand-edited by design (`regenerate.md`, "Hand-edit policy"), and the freshness digests do not hash them, so editing them makes no bundle stale. Precedents: #12846 (the `/dev/null` sweep fixed `_common.md` and many `_prompt.md` files) and #14343 (the `exit-code=` rule for `filecheck=` negative tests; the keywords-and-builtins prompt had prescribed `DIAGNOSTIC_TEST:SIMPLE(filecheck=CHECK):` for "rejected" claims).

FileCheck detail from the same PR: a `-DAG` line that matches early text, such as a diagnostic header, moves the start of the DAG group up. Any `-NOT` line before the group then checks only the text before that match. Put such a pin as a plain CHECK line ahead of the `-NOT` lines instead.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793872825617-fixing-docs-generated-tests-by-hand-also-needs-the.md`_
