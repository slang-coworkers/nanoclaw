---
name: project_12077_pdf_docs_distribution_parked
description: "#12077 PDF docs distribution feature request — PARKED at triaged, design-gated cross-repo"
metadata: 
  node_type: memory
  type: project
  originSessionId: a346a6ce-a1af-464a-b278-fdf493bcfc5a
---

shader-slang/slang#12077 (author vk4d): feature request to distribute downloadable **PDF** exports of the docs at shader-slang.org/docs/ (User's Guide, Module Reference, Specification).

**Verdict (slang-triager, verified @HEAD 8f0c3515d):** feature-request / low (enhancement) / docs+website tooling / P3. NOT a compiler bug — nothing to reproduce.

**Why PARKED (design-gated, needs-maintainer):** the three artifacts live in THREE separate sources — User's Guide (`docs/user-guide/`, Jekyll, in-repo), Module Reference (generated → separate repo `shader-slang/stdlib-reference`), Specification (separate repo `shader-slang/spec`). NO PDF pipeline exists anywhere in-repo (no pandoc/weasyprint/mkdocs/sphinx). Natural "Download PDF" surface = website front-end (`shader-slang.github.io`), not this repo. No single slang-repo change satisfies it; no agreed owner/design. Smallest in-repo slice = a CI step rendering `docs/user-guide/*.md` → release PDF (User's Guide only).

**Status:** Issue Type set = Feature; verified 5-bullet verdict posted to GitHub (comment 4956636383, nv-slang-bot). NO fixer dispatched. Chain closed at triaged. Re-engage on maintainer comment / design decision webhook — see [[feedback_reopen_not_release_parked_feature]]. Do NOT auto-release without maintainer go.
