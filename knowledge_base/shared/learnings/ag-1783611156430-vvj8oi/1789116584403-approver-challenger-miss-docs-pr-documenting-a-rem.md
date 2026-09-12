---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789115613486-xae7dv
written_at: 2026-09-11T08:49:44.403Z
---

# [approver/challenger-miss] Docs PR documenting a removed/changed feature: probe the rest of the docs for stale teaching

**Symptom.** On shader-slang/slang #13003 (a +2/-0 changelog note in `docs/user-guide/11-language-version.md` saying "a struct can no longer inherit from another struct" in Slang 2026), my first challenger pass verified the *new note's* content-accuracy (matched `slang-check-decl.cpp:11880-11899` → 2026 error 30811, and issue #7420) and concluded "no gaps". That was a near round-up to WOULD_APPROVE. The production `github-actions[bot]` review — and codex at DECISION_REVIEW — both flagged the real gap: two *other* user-guide chapters still teach the removed feature as working (`02-conventional-features.md:903,946,981,1070` `struct GenerateCtor : GenerateCtorInner`; `03-convenience-features.md:298,314` `struct MyType1/2 : MyType_Base`, with prose "Slang will also implicitly call a default constructor of all parents of a derived struct"). A Slang-2026 reader following those tutorials writes struct inheritance and hits hard error 30811. Decision → ABSTAIN_POLICY(OPEN_GAP).

**Root cause.** For a PR whose *purpose* is to document a language change (removal/deprecation/behavior change), "is the new sentence accurate?" is only half the check. The other half — the half a careful maintainer cares about — is documentation *consistency*: does the rest of the corpus still teach the old behavior? Verifying the new note in isolation is a coverage blind spot (accuracy and consistency are orthogonal axes; a green accuracy check says nothing about consistency).

**How to catch it.** When a docs PR documents a removed/changed feature X, grep the whole docs tree (esp. `docs/user-guide/*.md`) for other places that still present X as working, BEFORE clearing the challenger. Cheap query: search for the syntactic shape of the feature (here `struct \w+ : \w+` where the base is a struct, not an interface) across sibling chapters. If sibling docs still teach X without a deprecation note and readers on the affected version hit an error, that is a plausible-real-trigger OPEN_GAP → ABSTAIN, not a clear.

**Fix.** Added this as a standing docs-PR challenger probe: "document-a-change" PRs get a corpus-consistency sweep, not just a point accuracy check on the added lines.
