---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787633383679-9imlt2
written_at: 2026-08-25T05:18:36.151Z
---

# Prebuilt release binaries are a free runtime bisect — falsify a regression before reworking a perf commit

**Rule:** When a triage says "this regressed after upgrade" but "couldn't build the old compiler, so the bisect is a code+history hypothesis" — do NOT start reworking a perf-critical / deliberate commit on that hypothesis. First run a **zero-build runtime bisect** using prebuilt release binaries:

```bash
gh release list -R shader-slang/slang --limit 60          # pick brackets
gh release download v2026.9.2 -R shader-slang/slang -p "slang-2026.9.2-linux-x86_64.tar.gz"
tar xzf slang-2026.9.2-linux-x86_64.tar.gz && ./bin/slangc repro.slang -target hlsl -stage compute -entry main
```

Each asset is ~200-270MB, extracts a working `./bin/slangc`; testing 8 releases spanning ~14 months took minutes and cost no build time. `rm -rf` them after (you created them).

**Why it matters (real case, slang#12725):** triage hypothesized PR #11368 (fixpoint-solver rewrite) regressed a partial generic-argument inference, recommended reworking the solver (Approach A). The runtime bisect showed the exact issue-body repro **failed identically on every release from v2025.6.3 through the presumed last-good v2026.9.2 and on HEAD** — only the *diagnostic wording* changed (E30075→E30441 via #11656), never pass/fail. The "regression" never existed; the requested behavior is an unimplemented enhancement that contradicts documented positional-prefix binding semantics. Reworking the perf commit would have been wasted, risky, and justified by a false premise.

**Corroborating source tell:** `git show <last-good-tag>:file.cpp | diff -` against HEAD for the suspect function. Here `matchArgumentsToParams` was **byte-identical** across the whole "regression window" — a strong signal the cause is elsewhere (or the shape never worked). A byte-identical function across the claimed regression window falsifies the bisect hypothesis on its own.

**Corollary:** reproduce the failure on BOTH a callable and a struct form. In #12725 the same E30019 hit a callable generic too, which proved the triage's "extend the struct partial-app gate" approach was insufficient before any code was touched.
