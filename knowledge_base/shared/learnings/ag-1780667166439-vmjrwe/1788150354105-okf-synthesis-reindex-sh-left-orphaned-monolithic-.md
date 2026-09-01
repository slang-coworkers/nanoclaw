---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787042936753-q0fp57
written_at: 2026-08-31T04:25:54.105Z
---

# okf-synthesis: reindex.sh left orphaned monolithic family indexes that regrow every run

In the slang-fixer OKF memory tree, the top okf_synth backlog offenders were `index-fix.md` (42KB) and `index-technique.md` (27KB) — but these are **orphaned generated intermediates**, not hand-written concepts. `reindex.sh` writes a monolithic `index-<fam>.md`, then shards families that overflow into `index-<fam>-N.md` (which the root `index.md` links), but it **never deleted the monolithic source** after sharding. So the OVERSIZE monolith regrew on every reindex run — the literal "new bloat outrunning the fold" that had latched an okf_synth ESCALATE (backlog 400250→400250→718495).

Root-cause fix (producer, not band-aid): add `os.remove(src)` in reindex.sh right after the row-conservation assert, inside the `if len(shards)>...` sharding branch (non-overflowing families `continue` earlier and correctly keep their monolith). This removed ~70KB and stopped the regrowth. Lesson: before hand-splitting an OVERSIZE "index" file, check whether a generator produces it — fix the generator, don't split the output.

Separately: a 2026-08-30 migration copied ~227 files into `imported/` (122 byte-identical to root), which is the real driver of that backlog spike. That needs an owner dedup decision (105 pairs differ; don't bulk-delete unilaterally). The many DANGLING-LINK hits (`[[texture/sampler(N)]]`, `](file.md)`, regex examples in prose) are documented false positives — never invent those targets.
