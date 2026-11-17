---
title: "Slang 202c name-lookup family: umbrella #13979, proposal #13956, spec #13980, impl #13981"
type: concept
group: slang-language-core
tags: [slang, 202c, name-lookup, overload-resolution, 13979, 13956, 13980, 13981, umbrella, skiminki-nv, SPF-Proposal, spec, version-gating]
source_count: 2
---

# Slang 202c name-lookup family: umbrella #13979, proposal #13956, spec #13980, impl #13981

The Slang 202c name-lookup/overload-resolution overhaul is tracked as a family under umbrella #13979 (self-assigned by skiminki-nv, MEMBER). The umbrella has an EMPTY body and zero comments — the substantive language proposal is sub-issue **#13956** (labeled SPF:Proposal), with #13980 the spec update in shader-slang/spec and #13981 the slangc implementation. Verify the family with `gh api repos/shader-slang/slang/issues/13979/sub_issues`; #13956 is the proposal itself, NOT a separate "202c keyword-classification RFC" (a 2026-11-17 dispatch misidentified it).

## TL;DR

- The proposal is explicitly tentative (skiminki-nv 2026-10-29: "still just my proposal sketch … The real proposal will go through the language proposal process"); ranking criteria and wildcard-import priority are TBD.
- Spec (#13980) and impl (#13981) are proposal-blocked — park with decision owner skiminki-nv, don't hand to a fixer. Posture for the umbrella: no public post (core-team skip rule + empty-body tracker).
- Spec-drafting chains must check open shader-slang/spec PR #66 ("Language reference: name lookup", branch 2026-10-name-lookup) for collision first — it already writes `basics-name-lookup.md`, one of the target files; the target spec files on main are TODO stubs.
- The spec's version-gating convention is prose blockquotes ("In Slang 202c, ..." / "removed in Slang 202c"), not annotations.
- The local clone at `slang/external/spec` is stale (pre-restructure layout); fetch and read via `git show origin/main:<path>`.

## Family map and routing

Motivating issues around the family: #13750 (parked; its bot trail points into #13956 and the option-A plan was withdrawn), #13876/#13888 (closed; #13888 closed in favor of #13956, draft PR #13889). Implementation entry points for eventual work: `_lookUpInScopes` (slang-lookup.cpp ~831), slang-check-overload.cpp, and the `isSlang202cOrLater()` gate in slang-check-decl.cpp ([family map](../learnings/1794890090711-202c-name-lookup-family-map-13979-umbrella-and-the.md)). Impl is explicitly sequenced behind spec, so both sub-issues wait on the proposal landing ([umbrella has empty body](../learnings/1794890303893-slang-202c-name-lookup-family-umbrella-13979-has-e.md)).

**Source learnings (2):**
- [202c family map: umbrella #13979 and #13956's identity](../learnings/1794890090711-202c-name-lookup-family-map-13979-umbrella-and-the.md)
- [Umbrella empty; spec PR #66 covers the target file](../learnings/1794890303893-slang-202c-name-lookup-family-umbrella-13979-has-e.md)
