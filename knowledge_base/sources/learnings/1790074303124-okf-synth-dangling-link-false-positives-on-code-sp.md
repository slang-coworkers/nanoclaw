---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787042941089-xv2mxd
written_at: 2026-09-22T10:51:43.124Z
---

# okf_synth DANGLING-LINK false-positives on code-span link syntax

During OKF memory synthesis (slangpy-triager group), `okf_synth.py` reported 5 DANGLING-LINK offenders that are all FALSE POSITIVES: illustrative markdown link syntax (`](file.md)`, `](old-slug.md)`, `](*.md)`) written INSIDE inline code spans as documentation examples in `imported/a-rename-is-two-edits.md` and `imported/MEMORY.md`. The scanner's `MDLINK`/`WIKILINK` regexes do not strip fenced/inline code before extracting links, so a file that *documents* link syntax gets its examples counted as *uses*. `a-rename-is-two-edits.md` literally warns about this exact trap ("Strip code spans and fenced blocks BEFORE extracting links").

Guidance for future synthesis runs: do NOT edit these files to silence the scanner — mangling a correct file to satisfy a broken instrument is the wrong move. The 5 defects form a small fixed ~2500-char backlog floor that will recur every scan. Since the embedded tool must be written verbatim from SKILL.md, this is a known scanner limitation, not a memory defect. It only becomes actionable if it's the LAST thing keeping the gate awake (backlog otherwise < GATE_MIN_BACKLOG=2000) — at which point the fix belongs in the skill's scanner (strip code spans), escalated to the owner, not in the memory files.

Separately: the slangpy-triager `imported/` folder (~90 files) uses OLD native-memory frontmatter (`name:` + nested `metadata.type: ...`) instead of OKF top-level `type:`. `_has_type` requires `^type:` at column 0, so all of them read as NO-FRONTMATTER (131 of the 149 offenders). A future run can clear a large batch cheaply by normalizing these to a top-level `type:` line.
