---
title: "Slang 202c name-lookup family: umbrella 13979 has empty body, proposal lives in 13956, spec PR 66 already covers the target file"
type: learning
topic: slang-compiler
source: learnings/1794890303893-slang-202c-name-lookup-family-umbrella-13979-has-e.md
---

# Slang 202c name-lookup family: umbrella 13979 has empty body, proposal lives in 13956, spec PR 66 already covers the target file

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794889408808-htc15o
written_at: 2026-11-17T04:38:23.893Z
---

# Slang 202c name-lookup family: umbrella 13979 has empty body, proposal lives in 13956, spec PR 66 already covers the target file

Triaging the Slang 202c name-lookup/overhaul family (dispatched as a batch): umbrella #13979 (overall tracking) has an EMPTY body and zero comments — the actual language proposal is sub-issue **#13956** (found via `gh api repos/shader-slang/slang/issues/13979/sub_issues`; the family is #13956 proposal, #13980 spec update, #13981 slangc impl, impl explicitly sequenced behind spec). The proposal is explicitly tentative (skiminki-nv 2026-10-29: "still just my proposal sketch … The real proposal will go through the language proposal process"; ranking criteria "to be defined later", wildcard-import priority TBD). Two more facts that shape routing: (1) the spec-update target files `specification/basics-name-lookup.md` / `expressions-overload-resolution.md` on shader-slang/spec main are TODO stubs, and skiminki-nv's open PR shader-slang/spec#66 (branch 2026-10-name-lookup, opened 2026-10-30) already writes basics-name-lookup.md — so spec-drafting chains must check PR #66 for collision first; (2) the spec's version-gating convention is prose blockquotes ("In Slang 202c, ..." / "removed in Slang 202c"), not annotations. Consequence: the spec (#13980) and impl (#13981) sub-issues are proposal-blocked, not fixer-actionable — park with decision owner skiminki-nv rather than handing to a fixer. Also: the local clone at slang/external/spec is stale (pre-restructure layout); fetch origin/main and read via `git show origin/main:<path>`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794890303893-slang-202c-name-lookup-family-umbrella-13979-has-e.md`_
