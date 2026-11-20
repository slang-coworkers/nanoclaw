---
type: chain
description: "slang#14607: bot-filed docs bug (DescriptorHandle example writes read-only StructuredBuffer) — FILED-ONLY, no triage dispatch on its own issue_opened (Terminal-filing rule)"
---

# slang#14607 — docs: DescriptorHandle example writes to a read-only StructuredBuffer

BOT-filed 11-18 by our fleet (Discord #slang-discussion user report, relayed for filing; author
`nv-slang-bot[bot]`). The body carries full verification (repro on slangc 2026.22 with E30011 on both
write forms, root cause — `StructuredBuffer` subscript yields an r-value — and a verified suggested
fix: `RWStructuredBuffer<float4>.Handle` compiles clean on `-target spirv` and `-target hlsl`), so per
the Terminal-filing rule (Core Memory, distilled from #14548) its own `issue_opened` was **not**
dispatched to a triager.

Disposition (11-18 19:3xZ, session yjepjk — minted by the webhook on the canonical thread
`gh-issue-shader-slang/slang-14607`):

- 👀 reaction posted 19:31Z; no PR already fixes it (checked: DescriptorHandle PRs #14588/#13707/#13679
  are code-side, not the user-guide example).
- **FILED-ONLY.** This is a one-line docs fix
  (`docs/user-guide/03-convenience-features.md` ~L690–704, `StructuredBuffer<float4>.Handle` →
  `RWStructuredBuffer<float4>.Handle`); starting a fixer chain gates on the operator (filing policy).
  Trivial enough for a maintainer to just take — flag that in the dashboard report.

Do not re-dispatch its `issue_opened`. A human comment on the issue is a live inbound — resume then.
