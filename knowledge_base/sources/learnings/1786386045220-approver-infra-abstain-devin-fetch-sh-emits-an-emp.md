---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786383081044-aco4mj
written_at: 2026-08-10T18:20:45.220Z
---

# [approver/infra-abstain] devin-fetch.sh emits an EMPTY Flags section on a FLAGGED review — innerText comes back JSON-escaped, so the splitter never matches

## Symptom

On slang-rhi#826, `devin-fetch.sh` exited **0** and produced a `devin-flags.md`
whose `## Flags` section was **completely empty** — zero characters after the
heading. Read at face value: "Devin ran, found nothing."

Devin had in fact found things. The sibling scrape `devin-page.txt` carried the
count rail **`0 Bugs` / `1 Flag`** plus four named findings with file:line anchors,
including one *Investigate* flag that turned out to be a real, source-confirmable
concurrency issue.

## Root cause (verified, not inferred)

`agent-browser eval 'document.body.innerText'` returns the page as a **single
JSON-quoted line with literal `\n` escape sequences** — `devin-page.txt` contains
**1 real newline and 311 literal backslash-`n` pairs**. The fetch script splits the
findings section with a real-newline regex:

```python
re.split(r'\n\s*\d+\s*Flags?\s*\n', page)
```

It never matches, so the entire page falls into `## AI Analysis` and `## Flags`
comes out empty. The script's ~200-byte body-integrity guard passes anyway, because
the misrouted analysis blob is large. Exit 0 + non-trivial file size + empty
findings = a **false clean that looks fully healthy.**

## How to catch it

This is the concrete instance of the standing rule *"an empty findings section +
exit 0 = FALSE CLEAN ⇒ demand a POSITIVE TOKEN"*. Operationally, for Devin:

1. Never accept an empty `## Flags` as clean. Require an explicit count token —
   `N Bugs` / `M Flags` — to be **present in the artifact you are reading**.
2. If `devin-flags.md`'s Flags section is empty, **open `devin-page.txt`** and grep
   for the count rail and finding entries before concluding anything.
3. Cheap detector for the escaping defect: compare real vs literal newlines.
   `python3 -c "d=open(f).read(); print(d.count(chr(10)), d.count('\\\\n'))"` —
   `1` real against hundreds of literal is the signature.
4. Also demand a **liveness** token (rendered analysis, `End of changes`, the count
   rail) to separate "ran and found nothing" from "never started / rate-limited",
   which look identical in a bare file.
5. `devin-error.txt` is written only on failure and is **not cleared on a later
   success** — a stale error file alongside fresh artifacts is expected, not
   evidence. Date artifacts by mtime before believing them.

## Fix

Treat `devin-flags.md` as a *derived* artifact and `devin-page.txt` as the source of
record: when they disagree, the page wins. The extractor should normalize
JSON-escaped `\n` to real newlines before splitting, and its integrity guard should
assert on the **presence of the count token**, not on total body size — a size guard
cannot distinguish "findings present" from "everything misrouted into one blob."

Wider point: this is my own instrument silently under-reporting, and the failure
direction is the dangerous one — it hides findings rather than inventing them, so it
degrades toward *approval*. The scrutiny I aim at a PR's evidence is owed to the
tools that produce my evidence; here, believing my own tool would have discarded the
only review signal available for this head.
