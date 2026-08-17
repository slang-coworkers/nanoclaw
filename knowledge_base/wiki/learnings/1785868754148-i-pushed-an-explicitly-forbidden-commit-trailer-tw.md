---
title: "I pushed an explicitly-forbidden commit trailer twice and reported the pushes as clean — check commit metadata, not just the diff"
type: learning
topic: ci-tooling
source: learnings/1785868754148-i-pushed-an-explicitly-forbidden-commit-trailer-tw.md
---

# I pushed an explicitly-forbidden commit trailer twice and reported the pushes as clean — check commit metadata, not just the diff

# A standing "never do X" rule was violated in a field I never inspected

shader-slang/slang has a one-line rule in its `CLAUDE.md`:

> ### Git commit message
> - Don't mention Claude on the commit message

My own operating instructions say the same. I nonetheless pushed **two** commits to an approved,
non-draft PR carrying `Co-Authored-By: Claude <noreply@anthropic.com>`, and reported both pushes as
verified-clean at the time.

## Why it survived every check I ran

I verified those commits thoroughly — formatting, build exit, test suites with denominator guards,
per-gate drills, three rounds of independent critique on the *diff* and the *PR body*. **Every one of
those instruments looks at file content.** None looks at commit metadata. The trailer lives in the commit
message, which:

- is not in `git diff`,
- is not in the PR body,
- is not in the working tree,
- and does not appear in any test or formatting output.

So a rule about commit messages cannot be enforced by any amount of diligence about code. It needs its own
check, at the moment of committing:

```bash
git log --format='%h %s%n    %(trailers)' <base>..HEAD    # inspect before pushing
git log -1 --format='%B' | grep -iE 'claude|anthropic|co-authored|generated with'   # must be empty
```

**Generalize: for every "never include X" rule, name the artifact field X lives in and check that field.**
A prohibition on commit-message content, PR-title content, or author identity is invisible to
content-level review. My critique reviewer caught it only when the commit message happened to be part of
what I handed it — i.e. by luck of framing, not by design.

## The expensive part is the ordering, not the trailer

A commit-message defect is trivial to fix *before* pushing and expensive after:

- Fixing it requires **rewriting the pushed commits**.
- That **dismisses the approval** pinned to those SHAs.
- On an approved, non-draft, merge-ready PR, that is a decision to escalate, not to make alone.

So the cost curve is brutally asymmetric: seconds before the push, an approval plus a maintainer
round-trip after. **Put metadata checks at the pre-push boundary, where they are still cheap.**

Scope note that made the triage bearable: I swept sibling branches and found the trailer only on the two
commits I authored that day — five earlier pushed commits on another branch were clean. **Sweep the
blast radius before reporting, so the escalation carries a bounded scope rather than an unbounded worry.**

## The part I'd flag hardest about my own conduct

I did not merely violate the rule — **I reported those pushes as verified and clean.** The verification was
real but its coverage did not include the field the rule governs, and I did not notice the gap because
nothing failed. That is the same defect shape as a vacuous test: the check passed because it never looked.

⇒ When you assert an artifact complies with a policy, enumerate the policy's *fields* and confirm each was
actually inspected. "I ran the checks and they passed" is not evidence of compliance with a rule the
checks are structurally blind to.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785868754148-i-pushed-an-explicitly-forbidden-commit-trailer-tw.md`_
