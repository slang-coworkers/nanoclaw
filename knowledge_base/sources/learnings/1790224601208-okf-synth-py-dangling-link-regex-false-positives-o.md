---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1787042948344-tmxpim
written_at: 2026-09-24T04:36:41.208Z
---

# okf_synth.py DANGLING-LINK regex false-positives on fenced code containing ](...) or [[ patterns

## What happened

Running `/okf-synthesis`'s embedded `okf_synth.py scan` on a memory tree with two files that
document markdown-link false-positive classes (`feedback_measure_reachability_not_bytes.md`,
`feedback_script_echo_lines_are_not_output.md`) produced 3 `DANGLING-LINK` offenders that are not
real links at all:

- A fenced ```bash``` code block containing `grep -oE '\]\([A-Za-z0-9_-]+\.md\)' ... sed 's/^](//;s/)$//''`
  gets matched by the tool's `MDLINK = re.compile(r"\]\(([^)]+?)\)")` regex — the literal shell
  snippet `](...)` inside the code fence looks like a markdown link to the naive regex.
- A code block containing literal ANSI escape text like `^[[36;1m  echo "..."^[[0m` gets matched by
  `WIKILINK = re.compile(r"\[\[([^\]]+?)\]\]")` — because `[^\]]` (character class) matches
  newlines too, the lazy capture spans dozens of lines until it finds the next real `]]` anywhere
  later in the file (e.g. a genuine `[[wikilink]]` two paragraphs down), producing a garbled
  multi-hundred-character "link target" in the offender detail.

Neither regex excludes fenced code blocks (```` ``` ```` … ```` ``` ````) from scanning, and
`WIKILINK`'s character class allows the capture to cross newlines unboundedly.

## Why it matters

This is the *exact* false-positive class both affected files were written to warn about
(`feedback_wikilink_check_false_positives.md`, `feedback_measure_reachability_not_bytes.md`
line 64) — a link-integrity checker tripped by link-shaped text that is documentation/example
content, not an actual link. It cost nothing this run (3 defects × 500 = 1500 backlog units stay
below `GATE_MIN_BACKLOG=2000` once other offenders are folded, so the gate won't wake forever on
these alone), but a future synthesis pass could waste a fold slot trying to "fix" a non-existent
dangling link, or worse, mangle the documenting file's own code example to make the checker happy.

## How to apply

Before treating a `DANGLING-LINK` offender as real, open the file and check whether the flagged
span sits inside a fenced code block or contains literal ANSI/regex example text. If so, it's a
scanner artifact — do not edit the memory content; just note it and move on. If maintaining
`okf_synth.py` going forward, the real fix is to strip fenced-code-block spans before running
`WIKILINK`/`MDLINK` over the text, and to bound `WIKILINK`'s capture from crossing blank lines or
code-fence boundaries.
