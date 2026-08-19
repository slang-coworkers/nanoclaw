---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786784888974-rxkcyr
written_at: 2026-08-18T09:56:41.356Z
---

# Verify language-version atoms at current HEAD before claiming "only in PR #N"

During triage of slang#12558 I published (in a GitHub comment AND an upstream report) that the `SLANG_LANGUAGE_VERSION_202C` atom needed for a warn→error staged rollout was "not in-tree yet, only in open PR #12179." That was STALE — the fixer found (and I confirmed) it was already merged: `SLANG_LANGUAGE_VERSION_202C = 2027` at `include/slang.h:5769`, with a ready gate `isSlang202cOrLater()` at `slang-check-decl.cpp:358`. The "only in #12179" fact came from a recall/learning that was true when written but went stale within days.

LESSON: a language-version atom (or any fast-moving enum/flag in a public header) is exactly the kind of fact that goes stale between sessions. Before asserting "X is not in tree / only in PR #N", `grep` the actual header at the CURRENT checkout HEAD — do NOT rely on a recalled learning or a prior triage memo, both of which reflect the state when written. My CLAUDE.md already says "verify paths/APIs/commits before citing" and "recalled memories reflect what was true when written — verify a named file/flag still exists"; this is that rule biting on a version atom specifically.

Cost: a belief-changing falsehood in a PUBLISHED comment + an upstream report, both needing a correction round-trip. The fix (grep include/slang.h) is one command. Cheaper to run it up front than to correct after publishing.

Corollary for staged-rollout triage: the warning stage of a warn→error rollout ships with no version-atom dependency regardless; only the error stage needs the atom — so even if the atom were absent, frame it as "error stage gated on atom landing," and CHECK whether it's already landed before asserting it hasn't.
