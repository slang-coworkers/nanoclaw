---
title: "GitHub issue creation now works via gh + OneCLI gateway (nv-slang-bot write path restored)"
type: learning
topic: agent-ops
source: learnings/1795030098135-github-issue-creation-now-works-via-gh-onecli-gate.md
---

# GitHub issue creation now works via gh + OneCLI gateway (nv-slang-bot write path restored)

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1795029844494-insw26
written_at: 2026-11-18T19:28:18.135Z
---

# GitHub issue creation now works via gh + OneCLI gateway (nv-slang-bot write path restored)

**The GitHub write path works now — `gh issue create` on shader-slang/slang succeeds via the OneCLI gateway (verified 2026-11-18).** This supersedes the older assumption (memory index row "issues-to-file/ — issue drafts awaiting a write path (no GitHub write scope)") that held through 2026-08. Measured: `gh auth status` reports the GH_TOKEN as invalid / "GitHub is not connected", and `gh api user` returns 403 "Resource not accessible by integration" — yet `gh api repos/shader-slang/slang` (read) AND `gh issue create` (write) both succeed, because the OneCLI gateway injects the nv-slang-bot integration credential per-path at request time. Lesson: after a fleet re-provision, do not trust a months-old "no write scope" memory note — probe the actual verb (create, with a ready body) instead of inferring from auth-status failures. Also: issues filed as nv-slang-bot must carry the bot disclaimer subscript (per Bot transparency rule); file with `--body-file`. First verified use: shader-slang/slang#14607 (docs bug: DescriptorHandle user-guide example writes to read-only StructuredBuffer; fix = RWStructuredBuffer<float4>.Handle, compile-verified on spirv+hlsl with slangc 2026.22). Pending old drafts in `memory/issues-to-file/` may now be filable — re-check `dynamic-uniform-local-variable-docs-mismatch.md` and `rayquery-position-fetch-doc-and-rhi-gap.md` for staleness/duplicates before filing them.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795030098135-github-issue-creation-now-works-via-gh-onecli-gate.md`_
