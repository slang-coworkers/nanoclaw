---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786453430063-fe5us0
written_at: 2026-08-11T13:42:56.539Z
---

# [approver/clause-gap] Deleting a field a REPORT reads through — a refactor that makes `gen` optional silently blanks every docstring-derived blurb

## Symptom

shader-slang/slang#12439 replaces `WorkloadSpec.external_corpus` + a fake generator with
a declarative `source_dir`, so `gen` becomes `None` for static workloads
(`lib/manifest.py:94`, `mdl_dxr`). Two report generators derive their per-workload
description from the generator's **docstring**:

- `breakdown.py:692` — `desc = (inspect.getdoc(spec.gen) if spec and spec.gen else "") or "(no description)"`
- `sweep_report.py:420` — the identical expression

With `gen=None` both fall through to the literal `"(no description)"`. The suite's one
real-world workload loses its blurb on the published report page. Confirmed by executing
the head tree, and the base docstring text ("Real MDL/DXR path-tracing shaders…") exists
nowhere at head — deleted, not relocated.

The primary review missed it entirely; only Devin flagged it. Notably the PR *does* edit
`breakdown.py` for this exact class of problem (`:537`, "a static workload has no
generator… should render its real sources just the same") — the **sources** were
migrated to `corpus.sources()`, the **description** was not, and `sweep_report.py` was
never touched.

## Root cause

The docstring of a callable was doing double duty as data. When the callable becomes
optional, every consumer that read *through* it must acquire an alternative — but a
`getdoc(x) if x else ""` guard **fails silently to a plausible-looking default** instead
of raising. Nothing in CI or the review can see it: the expression is still valid Python,
the value is still a string, the page still renders.

## How to catch it

When a diff makes a field optional, nullable, or removes it, do not stop at the sites
the diff touched. Enumerate **every reader of that field in the whole tool/module**, then
ask of each: *what does it produce now that the field can be absent?*

```sh
# every reader, not just the edited ones — and include sibling tools
grep -rn "\.gen\b\|external_corpus\|source_dir" --include='*.py' <tool-dir>
```

The dangerous readers are the ones with an `or`/ternary fallback, because they convert a
missing value into a wrong value with no error. Two heuristics:

- **A field read for *metadata* (docstring, `__name__`, `repr`) is easy to miss** — it
  does not look like a data dependency, so a "who calls this?" sweep aimed at behaviour
  skips it.
- **A partially-migrated file is evidence of an incomplete sweep, not of a completed
  one.** When the diff fixes one consumer in a file for exactly this reason, treat the
  remaining consumers in that file — and its siblings — as unverified. The author already
  demonstrated the class exists.

## Fix

For the decision: an introduced, user-visible reporting regression in a file the PR
edits is an `OPEN_GAP`, not a nit — the discriminator is *did the PR make it worse* (yes:
the blurb existed at base) versus *did it leave a pre-existing same-class gap* (no).

For the code: the description belongs on the spec (a `desc:` field), not on whichever
callable happens to implement it — then it survives any change of source mechanism.
Deriving report text from a docstring couples documentation to an implementation detail
the refactor is explicitly trying to make swappable.
