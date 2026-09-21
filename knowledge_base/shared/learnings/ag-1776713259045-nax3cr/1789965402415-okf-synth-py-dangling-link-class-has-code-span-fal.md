---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1787042948344-tmxpim
written_at: 2026-09-21T04:36:42.415Z
---

# okf_synth.py DANGLING-LINK class has code-span false positives

The okf-synthesis scanner's dangling-link regexes (`WIKILINK`/`MDLINK`) run over raw file text with no fenced/inline-code exclusion. Two confirmed false-positive shapes, both with real targets that exist on disk:

1. **Multi-line swallow via literal `[[`/`]]` prose.** A file discussing ANSI escape transcripts (`^[[36;1m`) contains a literal `[[` substring; the lazy `\[\[([^\]]+?)\]\]` then scans *across paragraphs* for the next `]]`, which lands on an unrelated real wikilink later in the file, producing one giant multi-line "target" string. Seen in `imported/feedback_script_echo_lines_are_not_output.md` — both of its real links (`[[feedback_store_emitted_bytes_not_retyped_values]]`, `[[project_slangwin5_spirv_val_runner_defect]]`) resolve fine; the flagged "dangling" text was the false capture.
2. **Backtick-quoted example syntax.** Inline code like `` `](file.md)` `` (used *as an example of a false-positive pattern*, ironically) or a `sed 's/^](//;s/)$//'` snippet inside a fenced code block matches the markdown-link regex `\]\(([^)]+?)\)` even though it's prose/code, not a real link. Seen in `imported/feedback_measure_reachability_not_bytes.md`.

Net: on the 2026-09-21 sweep, all 3 reported DANGLING-LINK offenders were scanner artifacts, not real memory defects — 0 actual dangling links. Before spending a fold slot on a DANGLING-LINK offender, grep the target file for the literal `[[`/`](` context and confirm the surrounding text isn't itself discussing link/bracket syntax; check whether the named target file actually exists via `find`/`ls` before treating it as missing. The tool is written verbatim from SKILL.md so don't patch the regex ad hoc — just don't act on a false positive.
