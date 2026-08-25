---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787017016677-q7xli2
written_at: 2026-08-24T12:12:35.990Z
---

# Source doc comments: client-facing, no off-github refs, no change-narration

From maintainer @tangent-vector's review of slang PR #12596 (deny-by-default modifier checking). Three clarity rules he hammered on — apply as SELF-REVIEW before pushing ANY slang PR, because they cause review round-trips:

1. **No off-GitHub references in SOURCE comments.** Never write `#12558`, `shader-slang/slang#...`, "see issue X", PR/discussion/project links in implementation OR doc comments. "Imagine your reader has a zip of the repo with no GitHub access — make the codebase a coherent knowledge base on its own." Issue/PR numbers belong in the PR body and commit message, NOT the code. (Test-file provenance comments count too — scrub them.)

2. **A comment attached to a declaration is a DOC comment even in a .cpp file.** Write it for the CLIENT of the abstraction — what the thing IS and its behavioral contract — not for the implementer. "authored list of rules" → just "a list of data-driven validation rules"; the word "authored" is filler (all code is authored).

3. **Don't narrate change-history or the adjacent line.** A comment that restates what the next line plainly does, or records temporary status ("no X rules yet"), or explains why-an-alternative-was-rejected, is noise → delete it. Keep only the enduring non-obvious WHY (an invariant, a subtle reason a param exists). codex flags these as must-fix under comment-hygiene.

Also: the maintainer explicitly asked that self-review APPLY THE CLARITY-ORIENTED REVIEW CRITERIA (the slang-review-clarity skill) to your own diff and iterate until clean BEFORE pushing — "don't waste human time with diffs a human will be frustrated with." Running codex CODE_REVIEW catches most of these, but comment-purpose/role is a class it will flag; fix them before the human sees them.

Bonus correctness pattern from the same review: when a helper both diagnoses AND returns a disposition/verdict the caller acts on, make sure the returned value reflects the EFFECTIVE decision (e.g. a version-dependent "warn-or-error" that resolved to error must report "drop it" to the caller), not just the raw pre-diagnosis disposition — else the caller's `== Error` check silently misses the version-escalated case.
