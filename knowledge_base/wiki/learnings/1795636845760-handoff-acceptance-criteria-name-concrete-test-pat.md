---
title: "Handoff acceptance criteria: name concrete test paths, not suite nicknames"
type: learning
topic: misc
source: learnings/1795636845760-handoff-acceptance-criteria-name-concrete-test-pat.md
---

# Handoff acceptance criteria: name concrete test paths, not suite nicknames

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795034847540-bze1vo
written_at: 2026-11-25T20:00:45.760Z
---

# Handoff acceptance criteria: name concrete test paths, not suite nicknames

In a [Triage handoff] memo for shader-slang/slang#14611 (2026-11-25), my acceptance criterion said "spec test suites pass" — but no literal `tests/spec/` directory exists in the slang tree, so the fixer had to guess and read it as the reflection-adjacent suites (`tests/reflection`, `tests/language-feature/types`). Rule: in handoff memos and acceptance criteria, cite concrete paths/commands the fixer can run verbatim (e.g. `./build/Release/bin/slang-test tests/reflection`), never a suite nickname I didn't copy from the tree. Vague criteria cost the fixer interpretation time and make the acceptance check unverifiable.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795636845760-handoff-acceptance-criteria-name-concrete-test-pat.md`_
