---
title: "Name a predicate after what it tests, not what you intend — and expect to reintroduce this one rung up"
type: learning
topic: misc
source: learnings/1786032280928-name-a-predicate-after-what-it-tests-not-what-you-.md
---

# Name a predicate after what it tests, not what you intend — and expect to reintroduce this one rung up

## The rule

When you widen or rename a predicate, name it for the condition it **actually evaluates**, not the
concept you intend it to stand for. A name broader than its implementation is a latent bug: the next
caller reaches for it expecting the broad meaning and silently doesn't get it.

## The case

A maintainer asked me to remove a semantic-specific special case from a guard in the Slang compiler.
I replaced `systemValueSemantic.toLower() == "sv_target"` with `.startsWith("sv_")` and named the
helper `isSystemValueSemantic`.

That name was wrong. The file's *actual* system-value classification is
`startsWith("sv_") || startsWith("nv_")` — and `NV_`-prefixed semantics are real (`NV_X_RIGHT`,
`NV_VIEWPORT_MASK` exist in the test suite). So the name promised `NV_` coverage the body didn't
provide. Renamed to `hasSVPrefixSemantic`, with the narrowing stated in the doc comment.

## The part actually worth sharing

**In the same change I had already fixed this once, then reintroduced it one level up.** The original
helper was `isSVTargetSemantic`; when the test widened I knew the name had to track the body, so I
renamed it. Then I named the replacement for the *intent* rather than the *test* — the identical
defect at the next level of abstraction.

Getting the principle right once does not inoculate you, because **the second instance looks like a
better name, not a worse one.** "Is a system value" reads as the concept the code is *about*, which
is exactly why it slipped past me. Abstraction-level names feel like an improvement over
implementation-level ones.

**Tell:** if the name states a *category* and the body tests a *prefix, suffix, or single member* of
that category, the name is broader than the code. Ask: "what would a caller assume this returns true
for, and does it?"

## What turns the rename into a decision

Renaming alone leaves the real question open. What closes it is verifying the exclusion is *safe*:
both upstream special cases match exact names, so any `NV_` semantic falls through to a default
branch with a zero direction mask and acquires no varying resource — therefore no `NV_` semantic can
reach this code at all. Verified by reading the exit paths, not inferred from the naming. Put that
reason in the comment so the narrowing reads as deliberate rather than accidental.

## Two adjacent traps from the same task

- **Amending a commit 404s every permalink you already pinned to the old SHA.** I pinned three
  GitHub permalinks in a maintainer-facing reply, then amended the commit twice. Pin links *after*
  the final commit exists — dead links in a reply undercut the whole message.
- **A claim whose truth depends on which revision the reader has checked out is not worth making.**
  I wrote that a review thread's line anchor "now points at unrelated code." True on my branch,
  false on `master`. A reviewer disputed it and we were both right. Drop such a claim rather than
  defend it.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786032280928-name-a-predicate-after-what-it-tests-not-what-you-.md`_
