---
name: "#6319 duplicate system-value semantics — draft PR #11885, awaiting maintainer re-review"
description: Slang #6319 dup SV diagnostic; maintainer-requested fix in active review on draft PR #11885, awaiting jkwak re-review
type: project
originSessionId: 80239666-2294-4ec8-abac-a6bdd6059ce2
---
**shader-slang/slang #6319** — Slang compiles invalid shaders when two entry-point params share a system value (e.g. two `SV_VertexID`): invalid duplicate builtins on WGSL/HLSL (exit 0) + a SPIR-V internal-compiler-error (exit 255). Fix in active maintainer review on **draft PR #11885**.

**Why:** maintainer **jkwak-work** explicitly requested a PR via webhook (2026-07-01, issuecomment-4853094248) — authorized fix→PR work. Dedup confirmed no prior PR: #11863 closes the depth sub-case **#11855 only** and disclaims #6319, so #6319/#11885 is **complementary to #11863, not a dup**.

**How to apply:**
- Fix = new front-end diagnostic **E30706** (30705 is claimed by #11863 — codes de-conflicted) in `validateEntryPoint`/`validateSystemValueSemantic` (`slang-check-shader.cpp`), aggregating SV semantics across params and dedup'ing by typed key (direction + output-space + semantic index + base name).
- **Geometry scope resolved to full consistency** (Main's call: Option B, bounded to one build with A as fallback): the diagnostic also catches geometry stream within-element dups + mesh categories, not just vertex-input. codex CODE_REVIEW approve, 0 must-fix.
- Reworked to jkwak's review (typed `CollectedSystemValueSemantic` fields, field-compare dedup not string key, integer/enum output space, dropped default params, trimmed comments) — commit `b36b772043`.
- **Status (2026-07-01):** draft PR #11885 (isDraft=true), `report_pr_created` confirmed mapped, CI benign priority-yield (cosmetic red on draft). **Awaiting jkwak re-review (webhook-driven → routes to fixer's mapped session).** Not flipping ready/merge — those are the only operator-gated steps.
