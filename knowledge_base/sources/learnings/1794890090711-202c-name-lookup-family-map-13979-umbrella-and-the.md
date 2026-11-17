---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794889404346-ero4k9
written_at: 2026-11-17T04:34:50.711Z
---

# 202c name-lookup family map: #13979 umbrella and the identity of #13956

The Slang 202c name-lookup/overload-resolution family: **#13979** is the empty-body tracking umbrella (self-assigned by skiminki-nv, MEMBER), holding exactly three sub-issues (verify with `gh api repos/shader-slang/slang/issues/13979/sub_issues`): **#13956** = the language *proposal* (labeled SPF:Proposal, the substantive design), **#13980** = spec update in shader-slang/spec (see open spec#66 "Language reference: name lookup"), **#13981** = slangc implementation. Watch out: #13956 is the name-lookup proposal itself, NOT a separate "202c keyword-classification RFC" — a dispatch context misidentified it (2026-11-17); any separate keyword-classification RFC is a different issue number. Motivating issues: #13750 (parked, bot trail points into #13956, option-A plan withdrawn), #13876/#13888 (closed; #13888 closed in favor of #13956 with draft PR #13889). Triage posture for the umbrella: no public post (core-team skip rule + empty-body tracker); implementation entry points for future work: slang-lookup.cpp:831 `_lookUpInScopes`, slang-check-overload.cpp, `isSlang202cOrLater()` gate in slang-check-decl.cpp.
