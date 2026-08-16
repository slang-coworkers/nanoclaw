---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786734534539-5plq0h
written_at: 2026-08-14T20:55:12.407Z
---

# A handoff calling a fix a one-liner mirror of PR X is a claim to verify — read X's actual diff first

**Context:** slang#12403 fix handoff said "add `[ForceUnroll]`, ONE LINE, mirror #12417 EXACTLY, no semantic dependency, either can land first." Reading #12417's actual diff (`gh pr diff 12417`) showed it is NOT a one-liner: it introduced a shared C++ constant `kCoreModule_MaxVectorElementCount` (slang-type-system-shared.h) + a `static_assert` + a bounded loop `i<N && i<4` + an IR-validate maxCount change. That constant does NOT exist on master.

**Why it matters:** "Mirror X exactly" is only safe if X is what you think it is. Copying #12417's guarded form would have either (a) hard-depended on the unmerged #12417 branch, or (b) caused a redefinition compile error the moment both PRs merged — directly contradicting the handoff's own "either can land first." The handoff author had an accurate mental model of the *intent* (unroll the twin) but an inaccurate model of the *reference PR's shape*.

**How to apply:**
- When a handoff says "mirror PR X" / "same shape as X" / "one-liner like X", pull X's real diff before copying. `gh pr diff <n> -R <repo>` (or fetch its head + `git diff master...HEAD`). Do not trust the handoff's characterization of X's size or contents.
- Check whether X's change introduces NEW SYMBOLS not on master. If so, "mirror exactly" creates a dependency or a merge conflict — decide independently whether you need those symbols. Apply CLAUDE.md's "name the test that fails without it": here, a bare `[ForceUnroll]` was safe because over-wide N is rejected (E38206) before the unroller, and 3 existing bare `[ForceUnroll]` loops in the same file were precedent — no test failed without the guard.
- A "same file, different hunk, no conflict" claim in a handoff is also verifiable: `gh pr diff X` + look at whether X touches the SAME arm/lines. #12417 added a comment at the exact `default:` arm I was editing ⇒ real textual conflict, and X's comment becomes FALSE after my change (it said "Not force-unrolled" about the arm I unroll). Flag second-lander cleanup in the PR body.

**Companion instrument fact:** E38206 "invalid vector element count" is diagnosed from `slang-ir-validate.cpp` (`VectorWithInvalidElementCountEncountered`), i.e. IR validation — NOT the front-end type checker. It does not fire without a `-target` (no IR built). Don't call it a "type-check" diagnostic.
