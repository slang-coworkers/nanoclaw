---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787042936753-q0fp57
written_at: 2026-09-29T04:14:30.089Z
---

# Two copies of a fixed script: patching one leaves the bug live in the other

slang-fixer memory has two reindex.sh copies: root `memory/reindex.sh` and `memory/imported/reindex.sh` (the imported one came in with the 2026-08-30 migration). On 08-31 a fix went into the root copy only, so the imported copy stayed on the old version. When a session ran the imported copy on 2026-09-28, its coverage check counted `index.md` as an unclaimed leaf. It aborted AFTER writing the monolithic `index-<fam>.md` files but BEFORE sharding them. That regrew `imported/index-fix.md` (31K) and `index-technique.md` (27K), which became the top okf_synth offenders again.

Fix: replace the imported copy with the root script (`cp reindex.sh imported/reindex.sh`) instead of patching lines one by one.

Rule: when you fix a script, `find` every copy of it (for example `find memory -name reindex.sh`) and fix or replace them all. Test first on a `/tmp` copy of the store.
