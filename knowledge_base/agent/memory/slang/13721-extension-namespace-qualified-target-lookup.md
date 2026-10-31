---
type: chain
title: slang#13721 — `extension N::T` body can't see `N`'s members
description: Human-filed (skiminki-nv) language-semantics question; triaged + parked on a maintainer A/A′/B/C choice 2026-10-16
---

# slang#13721 — extension with a namespace-qualified target doesn't search that namespace

- Filed 2026-10-16 by skiminki-nv (no labels at filing). `extension N::T { … namespaceValue … }`
  fails with E30015; the author would accept either (a) making the body see `N`'s members or
  (b) rejecting qualified extension targets.
- Routed to slang-triager 10-16 on thread `gh-issue-shader-slang/slang-13721`.
- **Triaged 10-16 19:26Z** (cmt 6223072037, verified: nv-slang-bot, label `reproduced`, issue OPEN).
  Enhancement / frontend name lookup / P2; reproduced on ToT `2caaf254a`. Triager's finding: the
  extension scope chain is purely lexical (`slang-parser.cpp:4462` parents it on the file scope;
  `_lookUpInScopes`, `slang-lookup.cpp:895-915`, adds only the target type's members). The same
  gap applies to `A::B::T`, signature types, and nested-struct targets.
  Related: #9157, #11442, #11531/#11532 (fixed by #11577, which made a file-scope
  `extension N::T` header resolve — so option B conflicts with it).
- Options in the triage report: A (C++-style: enclosing namespaces after members, before lexical
  parents; changes binding when a global `v` shadows `N::v`), A′ (fallback only, strictly
  additive), B (reject qualified targets, breaking), C (document + "did you mean" note).
  The triager leans to A, with low confidence.
- **PARKED** on a language maintainer choosing A/A′/B/C and deciding whether enclosing struct
  scopes count. slang-fixer NOT dispatched. Triager one-shot re-check `t-5f0897` at
  2026-10-23T19:00Z. Triager memo: their `memory/issues/triage-13721.md` (copy received at
  `/workspace/inbox/a2a-1792178844535-c6j7gy/triage-13721.md`).
- **Re-check 2026-10-23 (t-5f0897 fired; verified on GitHub by me):** #13721 still OPEN, no comment
  since 6223072037 (10-16), still parked. Triager posted nothing and did not hand off to the fixer.
  Signal from a sibling issue: on #13750 (`using namespace` lookup priority), skiminki-nv (also the
  #13721 assignee) said on 10-21 "I discussed this yesterday with @tangent-vector. The conclusion is
  to tentatively use the C++ semantics." That points toward Approach A here but is **not** a
  decision on #13721; treat it as a lead only. If the 10-30 re-check is still silent, the natural
  next step is one short question on #13721 asking whether the #13750 direction also covers
  qualified extension targets (needs operator OK first, since it pings a maintainer).
  Next one-shot re-check: triager `t-aaff5f` at 2026-10-30T19:00Z.
- **Re-check 2026-10-30 (t-aaff5f fired; verified on GitHub by me):** still OPEN, assignee
  skiminki-nv, label `reproduced`, 1 comment (ours, 6223072037). The only timeline event since
  10-16 is a bot cross-reference from #13750 on 10-19. Triager posted nothing. New context: the
  assignee's 202c umbrella proposal #13956 (10-26; see
  [imported/project_13956_name_lookup_overload_resolution_overhaul_202c.md](../imported/project_13956_name_lookup_overload_resolution_overhaul_202c.md))
  is redesigning lookup, but does not name extensions or #13721 yet. **My call: no nudge comment
  and no operator ask now.** The maintainer is actively writing the lookup redesign, so a ping
  on #13721 adds noise. Revisit the nudge only if #13956 settles without covering extension
  targets. Next one-shot re-check: triager `i13721-recheck-1106-9fef` at 2026-11-06T19:00Z
  (also watches #13956).
