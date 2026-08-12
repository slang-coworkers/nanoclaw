---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786346030668-v6zm0g
written_at: 2026-08-11T07:09:25.046Z
---

# devin-fetch.sh: empty "## Flags" section can be a SCRAPE-FORMAT artifact, not absence of flags

## Symptom

`devin-fetch.sh` exited **0** on slang-rhi#598 and wrote `devin-flags.md` whose `## Flags`
section was **completely empty** — while the `## AI Analysis` blob above it contained
`0 Bugs`, `2 Flags`, and both flag titles with `file:line` refs.

Reading only the `## Flags` heading yields a **false clean**.

## Root cause

`agent-browser eval 'document.body.innerText'` returned the page as a **JSON-quoted
single-line string** — literal two-character `\n` sequences, not real newlines
(`wc -l devin-page.txt` == 1). The script's splitter is:

```python
re.split(r'\n\s*\d+\s*Flags?\s*\n', text, maxsplit=1)
```

That regex needs **real** newlines, so it never matches. Everything falls into
`parts[0]` (→ `## AI Analysis`) and `flags` stays `''`. The existing body-integrity
guards do not catch this: the file is 1305 B (over `DEVIN_MIN_BYTES=200`) and contains
no `Generating…`, so it exits 0 legitimately.

## How to catch it

Never read the `## Flags` section alone. Always:

1. `wc -l <out>/devin-page.txt` — a count of **1** means escaped-newline scrape ⇒ the
   `## Flags` split silently failed.
2. Grep the WHOLE file for the positive counter tokens `N Bugs` / `N Flags` /
   `No flags`. Absence of the counter = no verdict rendered; `0 Bugs / 2 Flags`
   present in the analysis blob = the flags exist regardless of section placement.

This is the "empty findings section + exit 0 = FALSE CLEAN ⇒ demand a positive token"
maxim, in a new dress: here the positive token is present but **mislocated**, so a
section-scoped read is what fails, not the run.

## Fix

When consuming `devin-flags.md`, treat the whole file as the findings surface. A
durable script fix would normalize before splitting — e.g. if the scrape starts with
`"` and contains no real `\n`, `json.loads()` it (or `.replace('\\n', '\n')`) before
running the split regex.

Also observed on this run: the page still carried `Loading diffs… This may take a few
moments for large PRs` even at a completed verdict (`Checks 23/23`), so that string is
NOT a reliable still-streaming signal — the flags carried concrete `cuda-device.cpp:298-302`
line refs, proving the diff had in fact been read.
