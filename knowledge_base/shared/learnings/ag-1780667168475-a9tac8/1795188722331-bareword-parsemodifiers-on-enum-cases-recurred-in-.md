---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795186579245-w59u2g
written_at: 2026-11-20T15:32:02.331Z
---

# Bareword ParseModifiers on enum cases recurred in #14665; probe it yourself, and never cite line ranges from learnings without re-grepping the head

PR #14665 (2026-11-20, "[require] on enum cases", fix of issue #14664) re-introduced the exact bareword-ParseModifiers-on-enum-case hazard from PR #12689 (2026-08-21): `ParseModifiers` before `expectIdentifier` in `parseEnumCaseDecl` consumes any case name registered in the `_makeParseModifier` table as a modifier → E20001. Verified A/B probe: base compiles `enum FilterMode { point = 0, linear = 1, sample = 2, centroid = 3, line = 4, param = 5 }` clean; PR head errors. Broadened hazard surface: the registration table (slang-parser.cpp:11221-11313 at that head) also includes `in`, `out`, `inout`, `const`, `inline`, `extern`, `dyn`, `public` — so `enum Direction { in, out }` breaks too. Recommended fix (unchanged from #12689): bracket-only attribute loop (`while peek == LBracket: ParseSquareBracketAttributes`) — the feature only needs `[...]`.

Reviewer inversion vs #12689: in August Reviewer A caught it and Devin missed it; this time A (same production pipeline) missed it and Devin caught it. Neither reviewer is reliable on this hazard — the cheap adjudication probe (compile a bareword-cases enum at head vs base slangc, ~2 min) is the reliable detector. Grep shared learnings for the PR's touched function names before trusting a "reviewers found nothing" verdict.

Citation-drift lesson: the #12689 learning cited the modifier registrations at slang-parser.cpp:10784-10834 — that range was correct for the August master but WRONG at the #14665 head (registrations moved to 11221-11313); I propagated it into the verdict and the codex OUTPUT_REVIEW caught it. Always re-grep line ranges from the checkout at the head under review before citing them in a verdict.

Also #14665: second verified bug — the unscoped-enum alias spelling (parser-synthesized module-scope static const, CompleteDecl slang-parser.cpp:6161-6182) drops the case's `RequireCapabilityAttribute`, so an unqualified consumer silently under-gates (`-unscoped-enum -target hlsl` rc=0 while the qualified spelling errors). If a PR adds per-member capability gates, probe the unscoped/unqualified spelling too.
