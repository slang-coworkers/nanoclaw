---
title: "SlangPy Tests 'undefined identifier MatrixLayoutMode' = base-skew signature, not a compiler regression"
type: learning
topic: slang-compiler
source: learnings/1789436787439-slangpy-tests-undefined-identifier-matrixlayoutmod.md
---

# SlangPy Tests "undefined identifier MatrixLayoutMode" = base-skew signature, not a compiler regression

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-15T01:46:27.439Z
---

# SlangPy Tests "undefined identifier MatrixLayoutMode" = base-skew signature, not a compiler regression

Fast-classify heuristic for CI sweeps: if a PR's SlangPy Tests fail with `undefined identifier 'MatrixLayoutMode'` (diagnostic cascade E30015→E30624→E30855, typically surfacing at `print.slang:260`), this is a **base-skew** signature, not a live compiler regression — the PR forked before shader-slang/slang#12986 (`578d571f9e`, "Fix matrix layout specialization by giving the layout its own type") landed, which is what added the `MatrixLayoutMode` enum to `source/slang/core.meta.slang`.

Why the mechanism matters: an "undefined identifier" is a front-end name-lookup diagnostic emitted *before* any IR is loaded, so it can never be produced by an IR-op/stable-name change — only by the enum genuinely being absent from the PR's tree. Confirmed on #13078 (2026-09-15): `git grep "enum MatrixLayoutMode" -- source/slang/core.meta.slang` at the PR's HEAD returns nothing, while #13071 HEAD has it at line 2298.

**How to check a suspect PR (works even on a shallow clone):**
```bash
git fetch origin pull/<N>/head:pr-<N>-check
git grep "enum MatrixLayoutMode" pr-<N>-check -- source/slang/core.meta.slang   # empty => enum missing
git merge-base --is-ancestor 578d571f9e pr-<N>-check; echo $?   # nonzero => #12986 not in history => base skew
```
Don't infer "has the enum" from GitHub's `baseRefOid` in PR metadata — that field is the base branch's *current* tip, not the PR's actual fork point, and will always show the enum present even when the PR itself forked before it existed. Always test the PR's own HEAD tree directly.

Disposition: relabel `needs-rebase` (same bucket as #12783/#12992), no fix PR/tracking issue/bot comment needed — the author rebasing past #12986 clears it. Note: `git merge-base <head> origin/master` can return empty/exit-1 on a shallow clone even when the histories aren't actually unrelated (shallow-fetch depth limit) — use pairwise `--is-ancestor` checks against a known commit instead of relying on merge-base's auto-computed fork point.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789436787439-slangpy-tests-undefined-identifier-matrixlayoutmod.md`_
