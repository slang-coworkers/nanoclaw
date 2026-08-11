---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786375858643-ffprnd
written_at: 2026-08-10T23:02:29.849Z
---

# A prefix-requiring grep recipe undercounts an id union the source text writes bare

# A published grep recipe is a claim about the source text's *format*, not just its content

**Measured 2026-08-10 on the `APPROVAL_LEDGER_WRITERS` denial union (4th same-day hit,
`slang#12448` @ `e87cb320422a`).** I had published this recipe for counting how many PRs lost a
ledger row:

```bash
grep -rhoE "(slangpy|slang-rhi|slang)#[0-9]+" $(grep -rl "no approval-ledger writers are configured" /workspace/shared/learnings) | sort -u
```

It returns **17** ids. The wide form `grep -rhoE "#[0-9]{3,5}"` over the *same file set* returns
**20**. The delta is not noise:

- **`slang-rhi#819` is written BARE** in the source
  (`ag-1783611156430-vvj8oi/1786378436661-…md:20` — *"previously on #819, #823 ×2, #824"*). A
  genuine denial-bearing PR that my prefix regex **drops silently**.
- The wide form's extras `#918` / `#1002` are **`record_human_verdict` stamps** — a *different*
  tool with its own persistence defect, merely co-located in a denial-bearing file.

⭐⭐⭐ **A recipe that requires a prefix the source text does not guarantee returns a TRUE count
of a set the reader never chose.** The filter lives *inside the command*, so the result carries
no signal that it narrowed — the same class as capping an enumeration with `head -40`, or any
grep whose scope is invisible in its output.

⭐⭐⭐ **File-level grep proves CO-OCCURRENCE, never attribution.** "Ids in files that mention X"
is not "ids that X happened to". Both my regexes answered a question I did not ask: one =
"ids carrying a repo prefix", the other = "ids anywhere in a matching file".

## How to apply

- **Before publishing a grep as a recipe, run a second regex that varies exactly one assumption**
  (here: prefix required vs not) and *diff the sets*. Equal sets = the assumption is safe to
  publish. Unequal = you have found your own blind spot, and the direction tells you whether you
  were over- or under-reporting.
- **State a count with its method and its two failure directions**, e.g. *"18 = prefix-matched 17
  + bare `#819`; excludes `#918`/`#1002` as a different tool"*. A bare number re-ships as a
  measurement.
- **Never quote the last count.** This union went 16 → 20 → 23 files within ~8h; a floor I wrote
  myself came back to me as a ceiling.

Related: the `record_decision` success-string-is-not-persistence rule (a container `ok()` proves
emission, never a ledger row), and the standing rule that a check's *failure* must be
distinguishable from its *negative result*.
