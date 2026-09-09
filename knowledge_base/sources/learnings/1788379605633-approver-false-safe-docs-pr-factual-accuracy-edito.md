---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787938188929-grsurk
written_at: 2026-09-02T20:06:45.633Z
---

# [approver/false-safe] Docs PR: factual accuracy ≠ editorial appropriateness — probe whether a barely-implemented feature SHOULD be documented

## Symptom

shader-slang/slang PR #12820 ("docs: document what `constexpr` does and does not
do") — approver returned **WOULD_APPROVE** twice (@5aac51a33d54, @81af8c1beb55).
Maintainer **tangent-vector** then **CHANGES_REQUESTED** on 81af8c1beb55. Clean
false-safe (WOULD_APPROVE → human CHANGES_REQUESTED).

## Root cause

The decision (and its challenger) treated an in-domain docs PR purely as a
**fact-checking** problem: it verified every documented claim (diagnostics
40013/31227/31228, "constexpr only supported on a parameter", "no user-defined
function compile-time evaluation") against compiler source at the head — and
they were all correct. But the maintainer's objection was **not factual at
all**; it was **editorial/design**:

- "We should **not** be documenting this use case in the user guide, and
  probably not even in the reference. This feature is only implemented just
  barely enough to get the cases of `constexpr` in the core modules working,
  and is not intended as a user-facing language feature."
- The section should **open** with an explicit "constexpr is not fully
  implemented, will not behave as C++ users expect, and its use is currently
  **discouraged**" — i.e. lead with the discouragement, not with a how-to.
- It should state the warnings **may become errors** in a future language
  version.
- The user guide should **not link out to the issue tracker**.

A factually-correct document can still be the wrong document. The approver had
no probe for "*should* this be documented, here, framed this way?" — so a
maintainer's framing/placement objection was invisible to it.

## How to catch it (transferable probe for docs / user-guide PRs)

When a docs PR **documents the behavior of a language/compiler feature**, after
confirming the facts, ask the maintainer-judgment questions the facts can't
answer:

1. **Is this feature *meant* to be user-facing?** A feature that exists "just
   barely enough" for the core module / internal use (constexpr here;
   `__intrinsic*`, `no_diff` internals, undocumented builtins) is a
   **discourage-don't-teach** candidate. Signal: grep the feature's own
   diagnostics/tests — if the compiler already emits "not a supported feature"
   warnings (31227/31228 literally say "is not a supported Slang feature"),
   documenting it as a feature contradicts the compiler's own stance. **That
   warning text was in my own evidence and I read past it.**
2. **Does the section LEAD with the right stance?** For a discouraged/partial
   feature, the opening sentence should be the discouragement, not a usage
   example. A "here's how to use X" framing for a feature the compiler warns
   against is a framing bug even when every fact is right.
3. **User-guide house style:** does it link out to the issue tracker, promise
   unshipped behavior, or omit "this may become an error later"? These are
   standing maintainer preferences a fact-check never surfaces.

None of these are `eval-clauses.py` predicates (they need reading the prose and
judgment) — they belong in the challenger for any user-guide/reference PR.

## Fix

For docs PRs about compiler/language features, the challenger must run an
**editorial-appropriateness pass** in addition to fact-checking: (a) is the
feature intended to be user-facing (check for "not supported"/discouraged
signals in the feature's own diagnostics/tests), (b) does the framing lead with
the correct stance, (c) house-style (no issue-tracker links, future-error
caveats). Treat a "documents a feature the compiler itself warns against as if
it were a feature" shape as at least an OPEN_GAP (ABSTAIN), not a clean approve —
the maintainer is likely to want it reframed or removed.
