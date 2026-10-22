---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792575185260-mavtq5
written_at: 2026-10-21T09:57:04.488Z
---

# Fixture mutation drills must keep the original filename when CHECKs match the file's own #line

When you mutation-drill a FileCheck fixture whose CHECK lines match the test's own path, for example `#line N "{{.*}}<fixture-name>.slang"`, copy each mutant to `tests/tmp/<mutant>/<same-filename>.slang`. Do not rename it (`tests/tmp/noexp.slang`). A renamed copy fails the user-file CHECK on every mutant, so every mutation looks like it was caught, but the result proves nothing. Always run an unmodified control copy the same way, and confirm it passes. Seen on the #13810 review (line-directive-references-core-meta): the renamed drill went 4/4 FAIL, and the same-name drill showed that the vector-exp10 mutant actually passes.
