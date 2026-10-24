---
type: chain
title: slang#13888 — spurious outer-scope candidates for ambiguous non-overloadable lookup
description: "MEMBER-filed (skiminki-nv) 10-23 10:36Z + bot mention 'reproduce and suggest a PR'. Reproduced, fixed in draft PR #13889 (pr: breaking change, head 7ac97a3 after the 10-23 maintainer review round). PARKED on skiminki-nv accepting the breaking cases + un-drafting. Re-chase rechase-slang-13888-r1 10-27 13:00Z."
tags: [slang, name-lookup, slang-lookup, using-namespace, breaking-change]
resource: https://github.com/shader-slang/slang/issues/13888
---

# slang#13888

**Ask (10-23 10:36Z).** Issue author skiminki-nv, comment 6362973794: "@nv-slang-bot : Please reproduce
and suggest a PR." Follow-up comment 6363023031 changed the rule from *all* to *any*: "If any
declaration in the initial set was overloadable, then the lookup continues to parents."

**Routing.** Main → slang-triager on `gh-issue-shader-slang/slang-13888`. The triager owns the
fixer handoff. Triager comment 6363122011 (verified on GitHub 10-23; label `reproduced`).

**Cause (triager's finding).** `_lookUpInScopes` (slang-lookup.cpp:1019) keeps walking outward on
`result.isOverloaded()` (= `items.getCount() > 1`), so 2+ non-callable hits at one level pull in
outer same-named decls. The clause came from #2199 (2022).

**Fix.** Draft PR #13889, branch `fix/issue-13888` (verified 10-23: OPEN, draft, label
`pr: breaking change`; pr-mappings → fixer session `sess-1792752303270-zzb0ym`). It adds the helper
`_doesLookupResultContainOverloadableDecl`. Fixer Report 12:47Z, head 032241c: slang-reviewer gave
APPROVE_WITH_NITS; full slang-test 11170/11173 (the 3 fp8-cuda failures also fail on master).

**Breaking cases disclosed in the PR:** `h(7)` with two shadowing variables now errors (E39999);
two imported `max` variables hide core `max` (E39999); `S s;` gives E30060; two inaccessible decls
now hide an accessible outer decl (E30600); one extension `K` case changes value from 100 to 2;
`IA.X`/`IB.X` give E39999 instead of E38106; some former E39999 cases now compile.

**Caveat.** g++ lists all 3 candidates for the issue's exact repro (C++ puts using-directive names
in the enclosing namespace), so the primary test uses a nested-namespace variant that stays stable
under the C++ semantics proposed in #13750. Draft #13718 touches the same hunk (text-only conflict).

**Follow-up (not in the PR).** Step 6 of `docs/generated/design/name-resolution/lookup.md` still
describes the old rule.

**10-23 13:35Z, maintainer engaged.** skiminki-nv reviewed the PR (r4359833720: cache the
overloadable check once per lookup). The fixer pushed 7ac97a3 (local `collectsOuterHits`, no behavior
change) and replied (r4360100634), leaving the thread open for them. The fixer corrected its earlier
figure: the generated name-resolution tests do not run when their directory is passed to slang-test;
they pass 251/251 when run file by file.

**State 10-23 12:49Z.** PARKED on maintainer decision. Re-chase `rechase-slang-13888-r1`
(task-hygiene slot r1) set for 10-27 13:00Z.
